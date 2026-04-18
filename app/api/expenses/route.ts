import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (role?.role !== "founder") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    scope,
    journey_id,
    cohort_id,
    category,
    amount_cents,
    vendor,
    notes,
    receipt_url,
    incurred_at,
  } = body;

  if (!scope || !category || !amount_cents || !incurred_at) {
    return NextResponse.json(
      { error: "missing required fields" },
      { status: 400 },
    );
  }
  if (amount_cents <= 0) {
    return NextResponse.json(
      { error: "amount must be positive" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("expense_entries")
    .insert({
      scope,
      journey_id: scope === "journey" ? journey_id : null,
      cohort_id: scope === "cohort" ? cohort_id : null,
      category,
      amount_cents,
      vendor: vendor || null,
      notes: notes || null,
      receipt_url: receipt_url || null,
      incurred_at,
      created_by: user.id,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ expense: data });
}
