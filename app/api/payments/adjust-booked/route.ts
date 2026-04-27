import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { verifyFounder } from "@/lib/auth/founder-check";

export const runtime = "nodejs";

/**
 * Founder-only. Sets the "Booked" total on a private ceremony journey by
 * writing the journey commitment's expected_amount_cents directly. Mirrors
 * /api/payments/adjust-outstanding but sets the absolute booked figure
 * instead of computing it from collected.
 *
 * Sync targets (all read from financial_commitments):
 *   • private_ceremony_summary view → booked_cents on the Private Ceremony tab
 *   • financials_overview view → booked_revenue_cents on KPI row
 *   • MemberFinancialSection → Pledged on the member detail page
 *
 * Commitment selection (avoids double-counting):
 *   1. journey-scoped commitment for this journey → update
 *   2. member-level commitment with no journey_id → adopt + update
 *   3. otherwise → insert a new journey-scoped commitment
 */
export async function POST(req: Request) {
  const founder = await verifyFounder();
  if (!founder) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const journey_id = body.journey_id;
  const booked_cents = Number(body.booked_cents);

  if (!journey_id || typeof journey_id !== "string") {
    return NextResponse.json({ error: "journey_id required" }, { status: 400 });
  }
  if (!Number.isFinite(booked_cents) || booked_cents < 0) {
    return NextResponse.json(
      { error: "booked_cents must be a non-negative number" },
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

  const expectedCents = Math.round(booked_cents);

  const { data: journeyCommit } = await service
    .from("financial_commitments")
    .select("id, status")
    .eq("journey_id", journey_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (journeyCommit) {
    const nextStatus =
      journeyCommit.status === "canceled" || journeyCommit.status === "waived"
        ? "active"
        : journeyCommit.status;
    const { error } = await service
      .from("financial_commitments")
      .update({ expected_amount_cents: expectedCents, status: nextStatus })
      .eq("id", journeyCommit.id);
    if (error) {
      console.error("[adjust-booked] update journey commitment failed", error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      commitment_id: journeyCommit.id,
      mode: "updated_journey_commitment",
      expected_amount_cents: expectedCents,
    });
  }

  const { data: memberCommit } = await service
    .from("financial_commitments")
    .select("id, status")
    .eq("member_id", journey.member_id)
    .is("journey_id", null)
    .not("status", "in", "(canceled,waived)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (memberCommit) {
    const { error } = await service
      .from("financial_commitments")
      .update({
        expected_amount_cents: expectedCents,
        journey_id,
        status: memberCommit.status === "draft" ? "active" : memberCommit.status,
      })
      .eq("id", memberCommit.id);
    if (error) {
      console.error("[adjust-booked] adopt member commitment failed", error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      commitment_id: memberCommit.id,
      mode: "attached_member_commitment",
      expected_amount_cents: expectedCents,
    });
  }

  const { data: created, error: insertErr } = await service
    .from("financial_commitments")
    .insert({
      member_id: journey.member_id,
      journey_id,
      kind: "journey_contribution",
      expected_amount_cents: expectedCents,
      status: "active",
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    console.error("[adjust-booked] insert commitment failed", insertErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    commitment_id: created.id,
    mode: "created_journey_commitment",
    expected_amount_cents: expectedCents,
  });
}
