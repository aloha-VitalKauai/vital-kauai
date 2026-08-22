/**
 * Financials V2 — PR 5: founder financial controls, data and actions.
 *
 * Everything runs on the FOUNDER'S OWN SESSION. The finance_api wrappers are
 * SECURITY INVOKER and the inner functions authorise via is_founder() reading
 * auth.uid(), so identity and timestamps are derived in Postgres — this route
 * supplies only inputs and a reason, never an actor or a time. service_role
 * holds EXECUTE on none of the five actions (asserted in the migration), so no
 * machine path to them exists at all.
 *
 * Idempotency (D-083): the CLIENT generates the external-payment key once per
 * form open and the DATABASE enforces it. This route just passes it through —
 * an enforcement that lived here would vanish on retry at exactly the wrong
 * moment.
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

type BalanceRow = {
  agreement_id: string;
  member_id: string;
  journey_id: string | null;
  purpose: string;
  contribution_cents: number;
  gross_received_cents: number;
  refunded_cents: number;
  reversed_cents: number;
  net_received_cents: number;
  remaining_cents: number;
  payable_remaining_cents: number;
  payment_state: string;
};

export async function GET(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const memberId = new URL(req.url).searchParams.get("memberId")?.trim();
  if (!memberId) return NextResponse.json({ error: "member_id_required" }, { status: 400 });

  const fin = auth.supabase.schema("finance_api");

  const { data: balances, error: balErr } = await fin
    .from("agreement_balances")
    .select("*")
    .eq("member_id", memberId)
    .returns<BalanceRow[]>();
  if (balErr) {
    console.error("finance/agreements: balances read failed", balErr.message);
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }

  const agreements = balances ?? [];
  const ids = agreements.map((a) => a.agreement_id);

  // Histories: append-only rows ARE the permanent audit trail.
  const [amountsRes, lifecycleRes, ledgerRes, journeysRes, statusRes] = await Promise.all([
    ids.length
      ? fin.from("founder_agreement_amount_history").select("*").in("agreement_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? fin.from("founder_lifecycle_history").select("*").in("agreement_id", ids)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? fin.from("founder_ledger_history").select("*").in("agreement_id", ids)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    // Journey options for the create form, under the founder's own session.
    auth.supabase
      .from("journeys")
      .select("id, booking_type, status, start_at")
      .eq("member_id", memberId)
      .order("start_at", { ascending: false }),
    // Current lifecycle status per agreement = latest event's to_status.
    ids.length
      ? fin.from("founder_lifecycle_history").select("agreement_id, to_status, occurred_at, seq")
          .in("agreement_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Latest lifecycle status per agreement, ordered as the enforcement orders it.
  const statusByAgreement: Record<string, string> = {};
  const statusRows = (statusRes.data ?? []) as {
    agreement_id: string; to_status: string; occurred_at: string; seq: number;
  }[];
  statusRows.sort((a, b) =>
    a.occurred_at === b.occurred_at ? a.seq - b.seq : a.occurred_at < b.occurred_at ? -1 : 1,
  );
  for (const r of statusRows) statusByAgreement[r.agreement_id] = r.to_status;

  return NextResponse.json({
    agreements: agreements.map((a) => ({
      ...a,
      lifecycle_status: statusByAgreement[a.agreement_id] ?? "draft",
    })),
    amounts: amountsRes.data ?? [],
    lifecycle: lifecycleRes.data ?? [],
    ledger: ledgerRes.data ?? [],
    journeys: journeysRes.data ?? [],
  });
}

type ActionBody = {
  action: "create" | "amend" | "record_external_payment" | "reverse" | "transition";
  memberId?: string;
  agreementId?: string;
  journeyId?: string | null;
  purpose?: string;
  amountCents?: number;
  method?: string;
  occurredAt?: string;
  entryId?: string;
  toStatus?: string;
  reason?: string;
  idempotencyKey?: string;
};

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });

  const fin = auth.supabase.schema("finance_api");
  // Literal RPC names at every call site so the writer inventory names each
  // target rather than reporting <dynamic>.
  let result: { data: unknown; error: { message: string } | null };
  switch (body.action) {
    case "create": {
      if (!body.memberId) return NextResponse.json({ error: "member_id_required" }, { status: 400 });
      if (!Number.isInteger(body.amountCents) || (body.amountCents as number) < 0) {
        return NextResponse.json({ error: "amount_invalid" }, { status: 400 });
      }
      result = await fin.rpc("create_agreement_with_contribution", {
        p_member_id: body.memberId,
        p_journey_id: body.journeyId ?? null,
        p_purpose: body.purpose ?? "journey_contribution",
        p_contribution_cents: body.amountCents,
        p_reason: reason,
      });
      break;
    }
    case "amend": {
      if (!body.agreementId) return NextResponse.json({ error: "agreement_id_required" }, { status: 400 });
      if (!Number.isInteger(body.amountCents) || (body.amountCents as number) < 0) {
        return NextResponse.json({ error: "amount_invalid" }, { status: 400 });
      }
      result = await fin.rpc("amend_contribution", {
        p_agreement_id: body.agreementId,
        p_amount_cents: body.amountCents,
        p_reason: reason,
      });
      break;
    }
    case "record_external_payment": {
      if (!body.agreementId) return NextResponse.json({ error: "agreement_id_required" }, { status: 400 });
      if (!Number.isInteger(body.amountCents) || (body.amountCents as number) <= 0) {
        return NextResponse.json({ error: "amount_invalid" }, { status: 400 });
      }
      if (!body.idempotencyKey) {
        // D-083: the key is what makes a retry safe; a submission without one is
        // malformed, not a permitted variant.
        return NextResponse.json({ error: "idempotency_key_required" }, { status: 400 });
      }
      result = await fin.rpc("record_external_payment", {
        p_agreement_id: body.agreementId,
        p_amount_cents: body.amountCents,
        p_method: body.method ?? "other",
        p_occurred_at: body.occurredAt ?? new Date().toISOString(),
        p_reason: reason,
        p_idempotency_key: body.idempotencyKey,
      });
      break;
    }
    case "reverse": {
      if (!body.entryId) return NextResponse.json({ error: "entry_id_required" }, { status: 400 });
      result = await fin.rpc("reverse_ledger_entry", {
        p_entry_id: body.entryId,
        p_reason: reason,
      });
      break;
    }
    case "transition": {
      if (!body.agreementId) return NextResponse.json({ error: "agreement_id_required" }, { status: 400 });
      if (!body.toStatus) return NextResponse.json({ error: "to_status_required" }, { status: 400 });
      result = await fin.rpc("transition_agreement", {
        p_agreement_id: body.agreementId,
        p_to_status: body.toStatus,
        p_reason: reason,
      });
      break;
    }
    default:
      return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  if (result.error) {
    console.error(`finance/agreements: ${body.action} refused`, result.error.message);
    return NextResponse.json({ error: "refused", detail: result.error.message }, { status: 409 });
  }
  return NextResponse.json({ ok: true, action: body.action, result: result.data ?? null });
}
