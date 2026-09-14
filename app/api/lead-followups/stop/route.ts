import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { FOLLOWUP_STOPPED_TYPE, verifyStopToken } from "@/lib/lead-followups";

export const runtime = "nodejs";

/**
 * GET /api/lead-followups/stop?l=<lead id>&t=<token>
 *
 * The "Stop these notes" link in every follow-up email. A valid token records
 * a `lead_followup_stopped` row for the lead, which the cron treats as a
 * permanent stop. Idempotent; a second click is a no-op with the same page.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const leadId = url.searchParams.get("l") ?? "";
  const token = url.searchParams.get("t") ?? "";

  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let ok = false;
  try {
    ok = uuid.test(leadId) && token.length > 0 && verifyStopToken(leadId, token);
  } catch (err) {
    console.error("[lead-followups/stop] secret not configured", err);
    return page("Something went wrong on our side. Email aloha@vitalkauai.com and we will take care of it.", 500);
  }
  if (!ok) return page("This link is not valid. Email aloha@vitalkauai.com and we will take care of it.", 400);

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: lead } = await supabase.from("leads").select("id, email").eq("id", leadId).maybeSingle();
  if (!lead) return page("This link is not valid. Email aloha@vitalkauai.com and we will take care of it.", 400);

  const { data: existing } = await supabase
    .from("notification_log")
    .select("id")
    .eq("lead_id", leadId)
    .eq("notification_type", FOLLOWUP_STOPPED_TYPE)
    .limit(1);
  if (!existing || existing.length === 0) {
    const { error } = await supabase.from("notification_log").insert({
      lead_id: leadId,
      notification_type: FOLLOWUP_STOPPED_TYPE,
      recipient: [lead.email as string],
      status: "sent",
      sent_at: new Date().toISOString(),
      payload: { via: "stop_link" },
    });
    if (error) {
      console.error("[lead-followups/stop] insert failed", error);
      return page("Something went wrong on our side. Email aloha@vitalkauai.com and we will take care of it.", 500);
    }
  }

  return page("Done. You will receive no more notes from us. The door stays open whenever you are ready: aloha@vitalkauai.com.", 200);
}

function page(message: string, status: number) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vital Kauaʻi</title>
<style>body{margin:0;background:#0e1a10;color:#f5f0e8;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}main{max-width:480px;text-align:center}h1{font-weight:300;letter-spacing:.15em;text-transform:uppercase;font-size:20px;margin:0 0 20px}p{font-size:18px;line-height:1.7;color:rgba(245,240,232,.85)}</style></head>
<body><main><h1>Vital Kauaʻi</h1><p>${message.replace(/</g, "&lt;")}</p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
