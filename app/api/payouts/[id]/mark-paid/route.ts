import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

  const { data, error } = await supabase
    .from("payout_commitments")
    .update({ status: "paid" })
    .eq("id", id)
    .in("status", ["pending", "scheduled"])
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "payout not found or already terminal" },
      { status: 404 },
    );
  }
  return NextResponse.json({ payout: data });
}
