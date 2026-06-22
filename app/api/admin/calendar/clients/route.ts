import { NextResponse } from "next/server";
import { requireFounder } from "@/lib/auth/founder-check";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/calendar/clients
// Lightweight member list for the "link a client" picker in the journey form.
// Reads public.members under the founder's session (members RLS already lets
// founders read the roster). Optional ?q= filters by name/email.
export async function GET(req: Request) {
  const ctx = await requireFounder();
  if (!ctx.ok) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  let query = ctx.supabase
    .from("members")
    .select("id, full_name, email, status")
    .order("full_name", { ascending: true })
    .limit(500);

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: "Failed to load clients" },
      { status: 500 },
    );
  }

  return NextResponse.json({ clients: data ?? [] });
}
