/**
 * Financials V2 — PR 3B: the minimal founder control for the dry-run → approval →
 * canary sequence.
 *
 * Deliberately the smallest surface that lets a founder do four things: see a
 * completed dry-run report, approve that specific run, start the authorized
 * canary, and see the result. The designed founder financial controls are PR 4
 * and PR 5; this is not them.
 *
 * ── Why approval MUST run on the founder's own session ──────────────────────
 *
 * `finance.approve_dry_run` is SECURITY DEFINER and authorizes through
 * `public.is_founder()`, which reads `auth.uid()` from the JWT. Its EXECUTE grant
 * is to `authenticated`, not `service_role` — PR 1 chose that split deliberately.
 *
 * So approval here is issued through the caller's own Supabase session and the
 * real access token that session already carries. Postgres remains authoritative:
 * if the caller is not a founder, `is_founder()` is false and the function raises,
 * regardless of anything this route believes or any field in the request body.
 *
 * Consequently this route NEVER:
 *   - uses the service role to approve — that would bypass `is_founder()` entirely
 *     and make the attribution a fiction;
 *   - reads a role, user id or founder flag from request data — a client-supplied
 *     role is not a credential;
 *   - constructs, forwards or logs a token.
 *
 * Starting the canary is different: `finance.start_reconciliation_run` is granted
 * to `service_role` only, because it is machine work. The founder's session is
 * still what authorizes it — this route verifies `is_founder()` on that session
 * first and refuses otherwise — and the service role is only the executor.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import {
  executeReconciliationRun,
  REPORT_VERSION,
} from "@/lib/finance/reconciliation/run";
import { createSupabaseFinanceDb } from "@/lib/finance/reconciliation/supabase-db";
import { createStripeSource } from "@/lib/finance/reconciliation/stripe-source";

export const runtime = "nodejs";
// The canary now executes inline, which means Stripe enumeration happens inside
// this request; the default budget would truncate it mid-run.
export const maxDuration = 300;

/** Canary containment: at most 24 hours, per acceptance 18g. */
export const CANARY_MAX_SPAN_MS = 24 * 60 * 60 * 1000;

/**
 * The generated Supabase types cover `public` only, so `finance` rows are typed
 * here explicitly rather than left as `any`.
 */
type ReconciliationRunRow = {
  id: string;
  livemode: boolean;
  dry_run: boolean;
  status: string;
  window_start: string;
  window_end: string;
  window_exhausted: boolean;
  implementation_version: string;
  started_at: string;
  finished_at: string | null;
  objects_scanned: number;
  objects_matched: number;
  exceptions_created: number;
  api_calls: number;
  retries: number;
  error: string | null;
  would_create_count: number | null;
  would_reopen_count: number | null;
  prospective_by_kind: Record<string, number> | null;
  report_samples: unknown;
  report_version: string | null;
  report_completed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  approval_note: string | null;
  authorized_by_run_id: string | null;
};

/**
 * Clamp a canary to the approved window and to 24 hours (acceptance 18g).
 *
 * Exported so the containment rule is executed by a test rather than trusted:
 * this is the bound on how much live money a first writing run can touch.
 */
export function canaryWindowEnd(windowStart: Date, approvedEnd: Date): Date {
  return new Date(Math.min(approvedEnd.getTime(), windowStart.getTime() + CANARY_MAX_SPAN_MS));
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  return createServiceSupabase(url, key, { auth: { persistSession: false } });
}

/**
 * Resolve the caller's founder status from their session alone.
 *
 * `is_founder()` is evaluated inside Postgres against `auth.uid()`, so this
 * reflects the signed token rather than anything the client asserted.
 */
async function requireFounder() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "not_authenticated" };

  const { data: isFounder, error } = await supabase.rpc("is_founder");
  if (error) return { ok: false as const, status: 500, error: "founder_check_failed" };
  if (isFounder !== true) return { ok: false as const, status: 403, error: "founder_required" };

  return { ok: true as const, supabase, userId: user.id };
}

/**
 * GET — the founder's view.
 *
 * Reads through the founder's own session, so the `founder_reads_runs` RLS policy
 * is what admits the rows. A non-founder sees nothing, not a filtered subset.
 */
export async function GET() {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data: runs, error } = await auth.supabase
    .schema("finance_api")
    .from("reconciliation_runs")
    .select(
      "id, livemode, dry_run, status, window_start, window_end, window_exhausted, " +
        "implementation_version, started_at, finished_at, objects_scanned, objects_matched, " +
        "exceptions_created, api_calls, retries, error, " +
        "would_create_count, would_reopen_count, prospective_by_kind, report_samples, " +
        "report_version, report_completed_at, approved_at, approved_by, approval_note, " +
        "authorized_by_run_id",
    )
    .order("started_at", { ascending: false })
    .limit(25)
    .returns<ReconciliationRunRow[]>();

  if (error) {
    console.error("finance/reconciliation: run read failed", error.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  // The dry run a canary could cite: completed, reported, window exhausted, no error.
  const approvable = (runs ?? []).find(
    (r) =>
      r.dry_run &&
      r.status === "completed" &&
      r.window_exhausted &&
      r.error === null &&
      r.report_completed_at !== null &&
      r.approved_at === null,
  );

  const approved = (runs ?? []).find((r) => r.dry_run && r.approved_at !== null);

  return NextResponse.json({
    runs,
    awaiting_approval: approvable ?? null,
    latest_approved: approved ?? null,
    report_version: REPORT_VERSION,
  });
}

type ApproveBody = { action: "approve"; runId: string; note: string };
type CanaryBody = { action: "start_canary"; approvedRunId: string };

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: ApproveBody | CanaryBody;
  try {
    body = (await req.json()) as ApproveBody | CanaryBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body?.action === "approve") return approve(auth, body);
  if (body?.action === "start_canary") return startCanary(auth, body);
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

async function approve(
  auth: Extract<Awaited<ReturnType<typeof requireFounder>>, { ok: true }>,
  body: ApproveBody,
) {
  const runId = typeof body.runId === "string" ? body.runId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!runId) return NextResponse.json({ error: "run_id_required" }, { status: 400 });
  // Run-specific and auditable: an approval with no stated reason is not evidence
  // of a decision, and PR 4's queue renders this text.
  if (!note) return NextResponse.json({ error: "note_required" }, { status: 400 });

  // Idempotent: re-approving is a no-op that reports the existing approval rather
  // than raising. A founder double-clicking must not see an error, and D-059
  // freezes approved evidence so a second approval could not be applied anyway.
  const { data: existing, error: readErr } = await auth.supabase
    .schema("finance_api")
    .from("reconciliation_runs")
    .select("id, dry_run, approved_at, approved_by, approval_note")
    .eq("id", runId)
    .returns<Pick<ReconciliationRunRow, "id"|"dry_run"|"approved_at"|"approved_by"|"approval_note">[]>()
    .maybeSingle();

  if (readErr) {
    console.error("finance/reconciliation: approval pre-read failed", readErr.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  // RLS already scoped this read to a founder, so "not found" means exactly that.
  if (!existing) return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  if (!existing.dry_run) {
    return NextResponse.json({ error: "not_a_dry_run" }, { status: 409 });
  }
  if (existing.approved_at !== null) {
    return NextResponse.json({
      approved: true,
      already_approved: true,
      run_id: existing.id,
      approved_at: existing.approved_at,
      approved_by: existing.approved_by,
      approval_note: existing.approval_note,
    });
  }

  // The actual approval, on the founder's session. Attribution is set INSIDE the
  // function from auth.uid(); this route cannot supply or influence it.
  const { error } = await auth.supabase
    .schema("finance_api")
    .rpc("approve_dry_run", { p_run_id: runId, p_note: note });

  if (error) {
    // Postgres refused — not a founder, run incomplete, unreported, or errored.
    console.error("finance/reconciliation: approve_dry_run refused", error.message);
    return NextResponse.json(
      { error: "approval_refused", detail: error.message },
      { status: 409 },
    );
  }

  return NextResponse.json({ approved: true, already_approved: false, run_id: runId });
}

async function startCanary(
  auth: Extract<Awaited<ReturnType<typeof requireFounder>>, { ok: true }>,
  body: CanaryBody,
) {
  const approvedRunId =
    typeof body.approvedRunId === "string" ? body.approvedRunId.trim() : "";
  if (!approvedRunId) {
    return NextResponse.json({ error: "approved_run_id_required" }, { status: 400 });
  }

  // Read the authorizing run through the FOUNDER's session, so RLS confirms they
  // may see it before the service role is used for anything.
  const { data: dry, error: readErr } = await auth.supabase
    .schema("finance_api")
    .from("reconciliation_runs")
    .select(
      "id, livemode, dry_run, status, approved_at, window_start, window_end, implementation_version",
    )
    .eq("id", approvedRunId)
    .returns<Pick<ReconciliationRunRow, "id"|"livemode"|"dry_run"|"status"|"approved_at"|"window_start"|"window_end"|"implementation_version">[]>()
    .maybeSingle();

  if (readErr) {
    console.error("finance/reconciliation: canary pre-read failed", readErr.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (!dry) return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  if (!dry.dry_run || dry.approved_at === null) {
    return NextResponse.json({ error: "run_not_approved" }, { status: 409 });
  }

  // One approval authorises ONE canary. tg_run_authorization checks that the
  // cited run is approved, but not that it has already been spent, so without
  // this a second click would start another writing run over the same window —
  // contradicting what the founder was told they were approving.
  const { data: existingCanary, error: canaryReadErr } = await auth.supabase
    .schema("finance_api")
    .from("reconciliation_runs")
    .select("id, status")
    .eq("authorized_by_run_id", approvedRunId)
    .eq("dry_run", false)
    .limit(1)
    .returns<{ id: string; status: string }[]>();

  if (canaryReadErr) {
    console.error("finance/reconciliation: canary dedup read failed", canaryReadErr.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
  if (existingCanary && existingCanary.length > 0) {
    return NextResponse.json(
      {
        error: "canary_already_started",
        run_id: existingCanary[0].id,
        status: existingCanary[0].status,
      },
      { status: 409 },
    );
  }

  // 18g — the canary is contained within the approved window and spans at most 24
  // hours. tg_run_authorization independently enforces the window_start and
  // implementation_version match; this narrows the END, which is the part that
  // decides how much live money a first writing run can touch.
  const start = new Date(dry.window_start);
  const approvedEnd = new Date(dry.window_end);
  const cappedEnd = canaryWindowEnd(start, approvedEnd);

  const implementationVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!implementationVersion) {
    // 18f0: refuse rather than substitute a placeholder, which would misattribute
    // provenance for every entry the canary writes.
    return NextResponse.json({ error: "build_identifier_unavailable" }, { status: 503 });
  }

  // CREATE AND EXECUTE IN ONE OPERATION.
  //
  // Calling `start_reconciliation_run` alone would insert a row with status
  // `running` that nothing ever advances: the reconcile cron always starts its own
  // DRY run and never adopts an existing writing run. The orphan then holds the
  // single-flight lock for its livemode until `abandon_stale_runs` reclaims it 15
  // minutes later — so the canary would block ordinary reconciliation and, worse,
  // would never actually rehearse anything.
  //
  // `executeReconciliationRun` opens the run AND drives it to a terminal state, so
  // an orphan is not representable. Authorization is unchanged: it passes
  // `authorizedByRunId` through to the same `start_reconciliation_run`, and
  // `tg_run_authorization` re-checks the approval independently.
  //
  // The window is passed as `inheritedWindow` so the 24-hour cap computed above is
  // the window actually used, rather than being recomputed from the watermark.
  try {
    const outcome = await executeReconciliationRun({
      db: createSupabaseFinanceDb(serviceClient()),
      source: createStripeSource(),
      livemode: dry.livemode,
      dryRun: false,
      implementationVersion,
      now: new Date(),
      authorizedByRunId: approvedRunId,
      inheritedWindow: { windowStart: start, windowEnd: cappedEnd },
    });

    return NextResponse.json({
      started: true,
      run_id: outcome.runId,
      status: outcome.status,
      livemode: dry.livemode,
      window_start: start.toISOString(),
      window_end: cappedEnd.toISOString(),
      authorized_by_run_id: approvedRunId,
      objects_scanned: outcome.objectsScanned,
      entries_written: outcome.entriesWritten,
      exceptions_created: outcome.exceptionsCreated,
      error: outcome.error ?? null,
    });
  } catch (err) {
    // A refusal from tg_run_authorization surfaces here rather than leaving a
    // half-created run behind.
    const message = err instanceof Error ? err.message : String(err);
    console.error("finance/reconciliation: canary refused", message);
    return NextResponse.json({ error: "canary_refused", detail: message }, { status: 409 });
  }
}
