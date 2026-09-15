import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { FOLLOWUP_STOPPED_TYPE } from "@/lib/lead-followups";
import { recipientsFrom, stopReasonFor, verifyResendSignature } from "@/lib/resend-webhook";

export const runtime = "nodejs";

/**
 * POST /api/resend-webhook
 *
 * Resend delivery events. A bounce or a spam complaint for a lead's address
 * records a `lead_followup_stopped` row for that lead, so the follow-up
 * sequence never writes to a dead or unwilling address again. Everything
 * else is acknowledged and ignored.
 *
 * Setup (once): Resend dashboard, Webhooks, add
 *   https://vitalkauai.com/api/resend-webhook
 * with events email.bounced and email.complained, then put the signing
 * secret in RESEND_WEBHOOK_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  const rawBody = await req.text();
  const ok = verifyResendSignature({
    secret,
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
    rawBody,
  });
  if (!ok) return NextResponse.json({ error: "invalid_signature" }, { status: 401 });

  let body: { type?: string } = {};
  try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const reason = stopReasonFor(body.type ?? "");
  if (!reason) return NextResponse.json({ ok: true, ignored: body.type ?? null });

  const emails = recipientsFrom(body);
  if (emails.length === 0) return NextResponse.json({ ok: true, ignored: "no_recipient" });

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: leads } = await supabase.from("leads").select("id, email").in("email", emails);
  let stopped = 0;
  for (const lead of leads ?? []) {
    const { data: existing } = await supabase
      .from("notification_log")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("notification_type", FOLLOWUP_STOPPED_TYPE)
      .limit(1);
    if (existing && existing.length) continue;
    const { error } = await supabase.from("notification_log").insert({
      lead_id: lead.id,
      notification_type: FOLLOWUP_STOPPED_TYPE,
      recipient: [lead.email],
      status: "sent",
      sent_at: new Date().toISOString(),
      payload: { via: "resend_webhook", reason },
    });
    if (!error) stopped += 1;
    else console.error("[resend-webhook] stop insert failed", lead.id, error);
  }

  return NextResponse.json({ ok: true, reason, matched: leads?.length ?? 0, stopped });
}
