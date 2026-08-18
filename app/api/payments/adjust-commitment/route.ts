import { NextResponse } from "next/server";
import { legacyPaymentsEnabled, legacyPaymentsDisabledResponse } from "@/lib/payments/legacy-enabled";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Founder-only replacement for the two browser-direct writes that used to live
 * in `app/dashboard/[id]/MemberFinancialSection.tsx` (D-078).
 *
 * WHY THIS ENDPOINT EXISTS.
 * The dashboard previously updated `financial_commitments` straight from the
 * browser through the founder's own RLS session. No server-side flag could
 * intercept that, so the legacy shutdown had a hole no amount of UI gating could
 * close: hiding a button removes the path from the product, but an authenticated
 * founder could still issue the UPDATE from a console. Moving the write behind a
 * server route makes `legacyPaymentsEnabled()` genuinely authoritative for every
 * writer to the retired tables.
 *
 * AUDIT ATTRIBUTION. The old browser write carried the founder's identity
 * implicitly, because it ran as that user. A service-role write does not, so the
 * acting founder is logged explicitly here. That is a deliberate replacement for
 * attribution that would otherwise be lost in the move, not incidental logging.
 *
 * Two actions, matching exactly what the UI did before — no more:
 *   set_amount     -> expected_amount_cents = amount_cents  (minimum 100, as the UI enforced)
 *   mark_fulfilled -> status = "paid"
 */

type Action = "set_amount" | "mark_fulfilled";

export async function POST(req: Request) {
  // D-078: fail-closed legacy shutdown. First statement in the handler —
  // before any provider call, auth lookup, email send or database write.
  if (!legacyPaymentsEnabled()) return legacyPaymentsDisabledResponse();

  const { commitment_id, action, amount_cents } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));

  if (!commitment_id || typeof commitment_id !== "string") {
    return NextResponse.json({ error: "commitment_id required" }, { status: 400 });
  }
  if (action !== "set_amount" && action !== "mark_fulfilled") {
    return NextResponse.json(
      { error: "action must be set_amount or mark_fulfilled" },
      { status: 400 },
    );
  }

  // Mirrors the client-side rule the dashboard enforced before this moved
  // server-side, so the founder sees the same refusal for the same input.
  let cents = 0;
  if (action === "set_amount") {
    cents = Math.round(Number(amount_cents));
    if (!Number.isFinite(cents) || cents < 100) {
      return NextResponse.json(
        { error: "amount_cents must be at least 100" },
        { status: 400 },
      );
    }
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "founder") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // NOTE: no service-role client here, deliberately. The read and the write both
  // go through the caller's own session, so Postgres — not this handler — has the
  // final say via the `founders write commitments` policy (ALL, `is_founder()`).
  // A service-role client would bypass RLS and make this route's own role check
  // the only thing standing in front of the table. It also preserves exactly the
  // authorisation path the removed browser code used, so nothing widens.
  const { data: commitment } = await supabase
    .from("financial_commitments")
    .select("id")
    .eq("id", commitment_id)
    .maybeSingle();

  if (!commitment) {
    return NextResponse.json({ error: "commitment_not_found" }, { status: 404 });
  }

  const patch =
    action === "set_amount"
      ? { expected_amount_cents: cents }
      : { status: "paid" };

  const { error } = await supabase
    .from("financial_commitments")
    .update(patch)
    .eq("id", commitment_id);

  if (error) {
    console.error("[adjust-commitment] update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  // Durable record: the `audit_commitments` trigger writes before/after state to
  // public.audit_log for this UPDATE. That trigger is SECURITY DEFINER, so it
  // records even though RLS grants the caller no INSERT on audit_log.
  //
  // LIMITATION, stated precisely. `fn_audit_trigger` reads the actor from the
  // `app.actor_id` GUC, which PostgREST cannot set per request, so the audit row
  // is attributed `actor_type = 'system'` rather than to this founder. Making
  // actor_id durable requires changing that trigger to fall back to `auth.uid()`
  // — a migration, and migrations are out of scope for this hotfix. What IS
  // durable today: the row change itself, and the fact that RLS permitted it
  // only because `is_founder()` was true for this session.
  console.log(
    `[adjust-commitment] founder=${user.id} action=${action} commitment=${commitment_id}` +
      (action === "set_amount" ? ` amount_cents=${cents}` : ""),
  );

  return NextResponse.json({ ok: true, commitment_id, action });
}
