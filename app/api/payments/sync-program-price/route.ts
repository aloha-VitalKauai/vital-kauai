import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Founder-only. Keeps the member-facing "amount owed" in lockstep with the
 * program_price the founder sets in the member editor. If the member has an
 * active financial_commitment (status in draft/active/partially_paid), we
 * update its expected_amount_cents to match. If none exists yet (no journey
 * yet), we no-op — the member editor save already wrote program_price, and
 * the Love Exchange page reads program_price as a preview until a commitment
 * is created via the booking flow.
 */
export async function POST(req: Request) {
  const { member_id, amount_cents } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));

  if (!member_id || typeof member_id !== "string") {
    return NextResponse.json({ error: "member_id required" }, { status: 400 });
  }
  const cents = Number(amount_cents);
  if (!Number.isFinite(cents) || cents < 0) {
    return NextResponse.json({ error: "amount_cents must be >= 0" }, { status: 400 });
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

  const service = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Find the member's most recent open commitment (excludes paid/waived/canceled).
  const { data: commitment } = await service
    .from("financial_commitments")
    .select("id, status")
    .eq("member_id", member_id)
    .in("status", ["draft", "active", "partially_paid"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!commitment) {
    return NextResponse.json({ ok: true, skipped: "no_active_commitment" });
  }

  const { error } = await service
    .from("financial_commitments")
    .update({ expected_amount_cents: cents })
    .eq("id", commitment.id);

  if (error) {
    console.error("sync-program-price: update failed", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, commitment_id: commitment.id });
}
