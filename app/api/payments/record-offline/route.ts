import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { commitment_id, amount_cents, notes } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));

  if (!commitment_id) {
    return NextResponse.json({ error: "commitment_id required" }, { status: 400 });
  }
  const cents = Number(amount_cents);
  if (!Number.isFinite(cents) || cents < 100) {
    return NextResponse.json({ error: "amount_cents must be at least 100" }, { status: 400 });
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Founder gate
  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "founder") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Fetch commitment to get journey_id and validate it exists
  const { data: commitment } = await service
    .from("financial_commitments")
    .select("id, member_id, journey_id, expected_amount_cents, status")
    .eq("id", commitment_id)
    .single();

  if (!commitment) {
    return NextResponse.json({ error: "commitment not found" }, { status: 404 });
  }
  if (["paid", "waived"].includes(commitment.status)) {
    return NextResponse.json({ error: "commitment is already closed" }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Insert completed donation (no Stripe — offline record)
  const { data: donation, error: donationErr } = await service
    .from("donations")
    .insert({
      member_id: commitment.member_id,
      journey_id: commitment.journey_id ?? null,
      amount_cents: cents,
      currency: "usd",
      status: "completed",
      kind: "journey_contribution",
      completed_at: now,
      metadata: { offline: true, notes: notes ?? null, recorded_by: user.id },
    })
    .select("id")
    .single();

  if (donationErr || !donation) {
    console.error("offline donation insert failed", donationErr);
    return NextResponse.json({ error: "db_insert_failed" }, { status: 500 });
  }

  // Compute remaining capacity so we don't over-allocate
  const { data: priorAllocs } = await service
    .from("payment_allocations")
    .select("allocated_amount_cents")
    .eq("commitment_id", commitment_id);

  const alreadyAllocated = (priorAllocs ?? []).reduce(
    (sum: number, r: { allocated_amount_cents: number }) => sum + r.allocated_amount_cents,
    0,
  );
  const capacity = Math.max(commitment.expected_amount_cents - alreadyAllocated, 0);
  const toAllocate = Math.min(cents, capacity);

  if (toAllocate > 0) {
    const { error: allocErr } = await service.from("payment_allocations").insert({
      donation_id: donation.id,
      commitment_id,
      allocated_amount_cents: toAllocate,
    });
    if (allocErr) {
      console.error("allocation insert failed", allocErr);
      return NextResponse.json({ error: "allocation_failed" }, { status: 500 });
    }
  }

  // If now fully paid, flip commitment status
  const newCollected = alreadyAllocated + toAllocate;
  if (newCollected >= commitment.expected_amount_cents) {
    await service
      .from("financial_commitments")
      .update({ status: "paid" })
      .eq("id", commitment_id);
  } else if (commitment.status === "draft" || commitment.status === "active") {
    await service
      .from("financial_commitments")
      .update({ status: "partially_paid" })
      .eq("id", commitment_id);
  }

  return NextResponse.json({ ok: true, donation_id: donation.id });
}
