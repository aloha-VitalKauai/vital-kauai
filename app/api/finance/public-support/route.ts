/**
 * PR 10C: founder controls for the public support campaign.
 *
 * Everything runs on the FOUNDER'S OWN SESSION: the configuration and
 * activation functions authorise via is_founder() reading auth.uid() inside
 * Postgres, and service_role holds EXECUTE on none of them (asserted in the
 * migrations) — no machine path to founder approval exists. This route
 * supplies inputs and a reason, never an actor or a time.
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

function rpcRefusal(code: string | undefined, message: string) {
  const status = code === "VK404" ? 404 : code === "VK400" ? 400 : code === "VK428" ? 428 : 409;
  return NextResponse.json({ error: message, code: code ?? null }, { status });
}

const str = (v: unknown, max = 4000): string | null =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;

export async function POST(req: Request) {
  const auth = await requireFounder();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const fin = auth.supabase.schema("finance_api");

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.action === "configure_entity") {
    const legalName = str(body.legalName, 300);
    const taxLanguage = str(body.ackTaxLanguage);
    const noGoods = str(body.ackNoGoodsStatement);
    if (!legalName || !taxLanguage || !noGoods) {
      return NextResponse.json({ error: "legal_name_and_wording_required" }, { status: 400 });
    }
    const einLast4 = typeof body.einLast4 === "string" && /^\d{4}$/.test(body.einLast4) ? body.einLast4 : null;
    const { error } = await fin.rpc("configure_legal_entity", {
      p_entity_id: str(body.entityId, 40),
      p_legal_name: legalName,
      p_ein_last4: einLast4,
      p_receipt_footer: str(body.receiptFooter, 2000),
      p_receipt_contact: str(body.receiptContact, 300),
      p_tax_exempt_basis: str(body.taxExemptBasis, 200),
      p_ack_tax_language: taxLanguage,
      p_ack_no_goods_statement: noGoods,
      p_enable_acknowledgments: body.enableAcknowledgments === true,
    });
    if (error) return rpcRefusal(error.code, error.message);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_bounds") {
    const min = body.minCents, max = body.maxCents;
    if (
      typeof min !== "number" || typeof max !== "number" ||
      !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min <= 0 || max < min
    ) {
      return NextResponse.json({ error: "invalid_bounds" }, { status: 400 });
    }
    const { error } = await fin.rpc("set_campaign_bounds", {
      p_campaign_id: str(body.campaignId, 40),
      p_min_amount_cents: min,
      p_max_amount_cents: max,
    });
    if (error) return rpcRefusal(error.code, error.message);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "set_fee_policy") {
    const bps = body.feeBps, fixed = body.feeFixedCents;
    if (
      typeof bps !== "number" || typeof fixed !== "number" ||
      !Number.isSafeInteger(bps) || !Number.isSafeInteger(fixed) ||
      bps < 0 || bps >= 10000 || fixed < 0
    ) {
      return NextResponse.json({ error: "invalid_fee_policy" }, { status: 400 });
    }
    const version = str(body.feePolicyVersion, 100);
    if (!version) return NextResponse.json({ error: "fee_policy_version_required" }, { status: 400 });
    const { error } = await fin.rpc("set_campaign_fee_policy", {
      p_campaign_id: str(body.campaignId, 40),
      p_fee_bps: bps,
      p_fee_fixed_cents: fixed,
      p_fee_policy_version: version,
    });
    if (error) return rpcRefusal(error.code, error.message);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "activate" || body.action === "retire") {
    const reason = str(body.reason, 1000);
    if (!reason) return NextResponse.json({ error: "reason_required" }, { status: 400 });
    const { error } = await fin.rpc(
      body.action === "activate" ? "activate_public_campaign" : "retire_public_campaign",
      { p_campaign_id: str(body.campaignId, 40), p_reason: reason },
    );
    if (error) return rpcRefusal(error.code, error.message);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
