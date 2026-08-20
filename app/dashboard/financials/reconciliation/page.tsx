/**
 * Financials V2 — PR 3B: the founder's reconciliation page.
 *
 * The operational minimum that lets a founder complete the dry-run → approval →
 * canary sequence by signing into the portal they already use. No token, no
 * console, no hand-built request. The polished Financials dashboard is PR 7.
 *
 * Reads run on the founder's own session, so the `founder_reads_runs` RLS policy
 * is what admits the rows: a non-founder sees nothing, and that is enforced by
 * Postgres rather than by this file.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ReconciliationControls from "./ReconciliationControls";

export const metadata = { title: "Reconciliation — Vital Kauaʻi" };

// Approval state changes under the founder's hands; a cached page would show a
// stale "awaiting approval" and invite a second, confusing attempt.
export const dynamic = "force-dynamic";

type RunRow = {
  id: string;
  livemode: boolean;
  dry_run: boolean;
  status: string;
  window_start: string;
  window_end: string;
  window_exhausted: boolean;
  implementation_version: string;
  objects_scanned: number;
  objects_matched: number;
  would_create_count: number | null;
  prospective_by_kind: Record<string, number> | null;
  report_completed_at: string | null;
  approved_at: string | null;
  approval_note: string | null;
  error: string | null;
};

export default async function ReconciliationPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Founder status comes from Postgres evaluating auth.uid(), never from a claim
  // this page makes about the user.
  const { data: isFounder } = await supabase.rpc("is_founder");
  if (isFounder !== true) {
    return (
      <main style={{ padding: "2rem", maxWidth: 720 }}>
        <h1 style={{ fontSize: 20 }}>Reconciliation</h1>
        <p style={{ color: "#6b6b60" }}>
          This page is limited to founders. If you believe that is wrong, your account may
          not carry the founder role.
        </p>
      </main>
    );
  }

  const { data, error } = await supabase
    .schema("finance")
    .from("reconciliation_runs")
    .select(
      "id, livemode, dry_run, status, window_start, window_end, window_exhausted, " +
        "implementation_version, objects_scanned, objects_matched, would_create_count, " +
        "prospective_by_kind, report_completed_at, approved_at, approval_note, error",
    )
    .order("started_at", { ascending: false })
    .limit(25)
    .returns<RunRow[]>();

  if (error) {
    return (
      <main style={{ padding: "2rem", maxWidth: 720 }}>
        <h1 style={{ fontSize: 20 }}>Reconciliation</h1>
        <p style={{ color: "#8b2f2f" }}>Could not load runs: {error.message}</p>
      </main>
    );
  }

  const runs = data ?? [];

  // The dry run a canary could cite: completed, window exhausted, error-free,
  // reported, and not yet approved. Every one of those is also re-checked by
  // tg_run_authorization when the canary starts — this only decides what to show.
  const awaitingApproval =
    runs.find(
      (r) =>
        r.dry_run &&
        r.status === "completed" &&
        r.window_exhausted &&
        r.error === null &&
        r.report_completed_at !== null &&
        r.approved_at === null,
    ) ?? null;

  const latestApproved = runs.find((r) => r.dry_run && r.approved_at !== null) ?? null;

  return (
    <main style={{ padding: "2rem", maxWidth: 820 }}>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Reconciliation</h1>
      <p style={{ color: "#6b6b60", marginTop: 0, marginBottom: "1.5rem", fontSize: 14 }}>
        Financials V2 observes Stripe and compares it against its own ledger. Before any
        run may write, you review a dry run and approve it.
      </p>
      <ReconciliationControls
        awaitingApproval={awaitingApproval}
        latestApproved={latestApproved}
        recentRuns={runs}
      />
    </main>
  );
}
