/**
 * Financials V2 — PR 4: exception resolution and quarantine release.
 *
 * Same authorization shape as the approval route, because it is the same
 * boundary: the action runs on the FOUNDER'S OWN SESSION, never the service
 * role. `finance.resolve_exception` and `finance.release_quarantine` authorise
 * via `is_founder()` reading `auth.uid()`, and their EXECUTE grants go to
 * `authenticated` only — the façade wrappers are SECURITY INVOKER, so calling
 * them through the service role would be refused by Postgres anyway.
 *
 * Actor and timestamp are set INSIDE the database functions. This route supplies
 * only the target status and a non-blank note, exactly as PR_PLAN specifies; it
 * never reads a role or user id from request data and never touches a token.
 */

import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

async function requireFounder() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "not_authenticated" };

  const { data: isFounder, error } = await supabase.rpc("is_founder");
  if (error) return { ok: false as const, status: 500, error: "founder_check_failed" };
  if (isFounder !== true) return { ok: false as const, status: 403, error: "founder_required" };

  return { ok: true as const, supabase };
}

type Body = {
  action: "resolve" | "dismiss" | "release";
  exceptionId: string;
  note: string;
};

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const exceptionId = typeof body.exceptionId === "string" ? body.exceptionId.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!exceptionId) return NextResponse.json({ error: "exception_id_required" }, { status: 400 });
  // The database also refuses a blank note; checking here gives the founder a
  // clear message instead of a constraint error.
  if (!note) return NextResponse.json({ error: "note_required" }, { status: 400 });

  // Literal RPC names at each call site, deliberately: the writer-inventory gate
  // resolves .rpc() targets statically, and a name passed through a variable
  // shows up as <dynamic> — an opaque entry in exactly the manifest that exists
  // to make every database call site visible.
  const fin = auth.supabase.schema("finance_api");
  let result: { error: { message: string } | null };
  switch (body.action) {
    case "resolve":
      result = await fin.rpc("resolve_exception", {
        p_exception_id: exceptionId,
        p_resolution: "resolved",
        p_note: note,
      });
      break;
    case "dismiss":
      // Dismissal is a terminal resolution too — same function, different status,
      // so the audit trail records which judgement the founder made.
      result = await fin.rpc("resolve_exception", {
        p_exception_id: exceptionId,
        p_resolution: "dismissed",
        p_note: note,
      });
      break;
    case "release":
      result = await fin.rpc("release_quarantine", {
        p_exception_id: exceptionId,
        p_note: note,
      });
      break;
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  const { error } = result;
  if (error) {
    // Postgres refused: not a founder, already resolved, not quarantined, etc.
    // The message names the reason; surfacing it verbatim is acceptable on a
    // founder-only route and saves a support round-trip.
    console.error(`finance/exceptions: ${body.action} refused`, error.message);
    return NextResponse.json({ error: "refused", detail: error.message }, { status: 409 });
  }

  return NextResponse.json({ ok: true, action: body.action, exception_id: exceptionId });
}
