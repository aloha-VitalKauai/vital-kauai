import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { verifyFounder } from "@/lib/auth/founder-check";

export const runtime = "nodejs";

/**
 * Founder-only. Sets the "Collected" total on a private ceremony journey by
 * inserting a single adjustment donation that brings the journey's
 * completed-donations sum to the target value.
 *
 * Collected on the dashboard is computed as
 *   SUM(donations.amount_cents WHERE journey_id = j AND status = 'completed')
 * so the only honest way to "edit" it is to write a donation row. We insert
 * one synthetic donation with amount_cents = (target − current). The amount
 * may be negative when collected needs to come down (no CHECK >= 0 on the
 * column). The row is tagged `metadata.adjustment = true` so it is
 * identifiable and never confused with a real Stripe / offline payment.
 *
 * Sync targets:
 *   • private_ceremony_summary view → revenue_cents (Collected on this tab)
 *   • financials_overview view → total_revenue_cents, journey_revenue_cents
 *   • MemberFinancialSection → Collected stat + Payment History row
 *
 * No payment_allocations row is written — adjustments aren't tied to a
 * commitment payment schedule, they're an accounting reconciliation.
 */
export async function POST(req: Request) {
  const founder = await verifyFounder();
  if (!founder) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const journey_id = body.journey_id;
  const collected_cents = Number(body.collected_cents);

  if (!journey_id || typeof journey_id !== "string") {
    return NextResponse.json({ error: "journey_id required" }, { status: 400 });
  }
  if (!Number.isFinite(collected_cents) || collected_cents < 0) {
    return NextResponse.json(
      { error: "collected_cents must be a non-negative number" },
      { status: 400 },
    );
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: journey, error: journeyErr } = await service
    .from("journeys")
    .select("id, member_id")
    .eq("id", journey_id)
    .single();
  if (journeyErr || !journey) {
    return NextResponse.json({ error: "journey_not_found" }, { status: 404 });
  }
  if (!journey.member_id) {
    return NextResponse.json({ error: "journey_has_no_member" }, { status: 400 });
  }

  const { data: rows } = await service
    .from("donations")
    .select("amount_cents")
    .eq("journey_id", journey_id)
    .eq("status", "completed");

  const currentCents = (rows ?? []).reduce(
    (acc: number, r: { amount_cents: number | null }) =>
      acc + (r.amount_cents ?? 0),
    0,
  );
  const target = Math.round(collected_cents);
  const delta = target - currentCents;

  if (delta === 0) {
    return NextResponse.json({
      ok: true,
      mode: "noop",
      current_cents: currentCents,
      target_cents: target,
    });
  }

  const { data: created, error: insertErr } = await service
    .from("donations")
    .insert({
      member_id: journey.member_id,
      journey_id,
      amount_cents: delta,
      currency: "usd",
      status: "completed",
      kind: "journey_contribution",
      completed_at: new Date().toISOString(),
      metadata: {
        adjustment: true,
        adjusted_by: founder.id,
        adjusted_by_email: founder.email,
        previous_collected_cents: currentCents,
        target_collected_cents: target,
      },
    })
    .select("id")
    .single();

  if (insertErr || !created) {
    console.error("[adjust-collected] insert donation failed", insertErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    donation_id: created.id,
    mode: delta > 0 ? "increase" : "decrease",
    delta_cents: delta,
    current_cents: target,
  });
}
