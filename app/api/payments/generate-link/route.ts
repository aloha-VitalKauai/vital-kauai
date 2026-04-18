import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { commitment_id } = await req
    .json()
    .catch(() => ({} as Record<string, unknown>));
  if (!commitment_id) {
    return NextResponse.json(
      { error: "commitment_id required" },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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

  const { data: commit } = await service
    .from("financial_commitments")
    .select("id, status")
    .eq("id", commitment_id)
    .single();
  if (
    !commit ||
    !["draft", "active", "partially_paid"].includes(commit.status)
  ) {
    return NextResponse.json(
      { error: "commitment not open" },
      { status: 400 },
    );
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error: insertErr } = await service.from("payment_tokens").insert({
    token,
    commitment_id,
    created_by: user.id,
    expires_at: expiresAt,
  });
  if (insertErr) {
    return NextResponse.json(
      { error: "token_insert_failed" },
      { status: 500 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://vital-kauai.vercel.app";
  return NextResponse.json({
    url: `${siteUrl}/pay/${token}`,
    expires_at: expiresAt,
  });
}
