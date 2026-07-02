import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * POST /api/lead-capture
 * Body: { fullName: string, email: string, source?: string }
 *
 * Public endpoint for lightweight lead-capture forms (e.g. the "Begin the
 * Journey" stay-connected strip). Records a row in `leads` so it surfaces in
 * the founder leads dashboard for follow-up. Does not send any email — it is
 * purely a record-the-contact step.
 */

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "Lead Capture";

  if (!fullName || !email || !isValidEmail(email)) {
    return NextResponse.json(
      { error: "name and a valid email are required" },
      { status: 400 },
    );
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !supaKey) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 500 });
  }

  const service = createServiceSupabase(supaUrl, supaKey, {
    auth: { persistSession: false },
  });

  const { error } = await service.from("leads").insert({
    full_name: fullName,
    email,
    source,
    lead_date: new Date().toISOString(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
