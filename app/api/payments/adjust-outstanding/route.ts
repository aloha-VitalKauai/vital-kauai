import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { verifyFounder } from "@/lib/auth/founder-check";

export const runtime = "nodejs";

/**
 * Founder-only. Adjusts the "Outstanding" amount on a private ceremony journey.
 *
 * Outstanding = booked − collected. Editing it is really editing the booked
 * total: we set the journey's commitment expected_amount_cents to
 * (collected + new_outstanding). That value flows everywhere automatically:
 *   • private_ceremony_summary view → booked_cents (Financials > Private Ceremony tab)
 *   • financials_overview view → booked_revenue_cents (Overview, KPI row)
 *   • MemberFinancialSection → Pledged / Remaining on the member detail page
 *
 * To avoid double-counting, we prefer updating an existing commitment over
 * creating a new one:
 *   1. journey-scoped commitment for this journey → update amount
 *   2. member-level commitment with no journey_id → attach to journey + update amount
 *   3. otherwise → insert a fresh journey-scoped commitment
 */
export async function POST(req: Request) {
  const founder = await verifyFounder();
  if (!founder) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const journey_id = body.journey_id;
  const outstanding_cents = Number(body.outstanding_cents);

  if (!journey_id || typeof journey_id !== "string") {
    return NextResponse.json({ error: "journey_id required" }, { status: 400 });
  }
  if (!Number.isFinite(outstanding_cents) || outstanding_cents < 0) {
    return NextResponse.json(
      { error: "outstanding_cents must be a non-negative number" },
      { status: 400 },
    );
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Resolve member from the journey.
  const { data: journey, error: journeyErr } = await service
    .from("journeys")
    .select("id, member_id, booking_type")
    .eq("id", journey_id)
    .single();
  if (journeyErr || !journey) {
    return NextResponse.json({ error: "journey_not_found" }, { status: 404 });
  }
  if (!journey.member_id) {
    return NextResponse.json({ error: "journey_has_no_member" }, { status: 400 });
  }

  // Sum donations attributed to this journey (matches private_ceremony_summary).
  const { data: donationRows } = await service
    .from("donations")
    .select("amount_cents")
    .eq("journey_id", journey_id)
    .eq("status", "completed");
  const collectedCents = (donationRows ?? []).reduce(
    (acc: number, r: { amount_cents: number | null }) =>
      acc + (r.amount_cents ?? 0),
    0,
  );

  const newExpectedCents = collectedCents + Math.round(outstanding_cents);

  // 1. Existing journey-scoped commitment.
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
      .update({
        expected_amount_cents: newExpectedCents,
        status: nextStatus,
      })
      .eq("id", journeyCommit.id);
    if (error) {
      console.error("[adjust-outstanding] update journey commitment failed", error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      commitment_id: journeyCommit.id,
      mode: "updated_journey_commitment",
      collected_cents: collectedCents,
      expected_amount_cents: newExpectedCents,
    });
  }

  // 2. Member-level commitment with no journey attached: adopt it for this journey.
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
        expected_amount_cents: newExpectedCents,
        journey_id,
        status:
          memberCommit.status === "draft" ? "active" : memberCommit.status,
      })
      .eq("id", memberCommit.id);
    if (error) {
      console.error("[adjust-outstanding] adopt member commitment failed", error);
      return NextResponse.json({ error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      commitment_id: memberCommit.id,
      mode: "attached_member_commitment",
      collected_cents: collectedCents,
      expected_amount_cents: newExpectedCents,
    });
  }

  // 3. No existing commitment — create a journey-scoped one.
  const { data: created, error: insertErr } = await service
    .from("financial_commitments")
    .insert({
      member_id: journey.member_id,
      journey_id,
      kind: "journey_contribution",
      expected_amount_cents: newExpectedCents,
      status: "active",
    })
    .select("id")
    .single();
  if (insertErr || !created) {
    console.error("[adjust-outstanding] insert commitment failed", insertErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    commitment_id: created.id,
    mode: "created_journey_commitment",
    collected_cents: collectedCents,
    expected_amount_cents: newExpectedCents,
  });
}
