import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import type { SmsSender } from "@/lib/checkins/schedule";
import { runSessionReminders } from "@/lib/sessions/reminders";

export const runtime = "nodejs";

/**
 * Daily cron (16:00 UTC = 6:00 AM HST) — texts each member on the day of
 * their recurring integration session: the exact local time and the
 * session's canonical meeting URL. Idempotent by construction: a null
 * reminder_sent_at dedups the send (stamped only after the edge function
 * confirms), and a session already underway is never reminded late.
 *
 * Auth: Bearer ${CRON_SECRET} OR ?secret=... (same shape as the other crons).
 * SMS rides the existing send-notification edge function (Twilio + sms_logs).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[session-reminders-cron] CRON_SECRET not set");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const url = new URL(req.url);
  const authorized =
    req.headers.get("authorization") === `Bearer ${secret}` ||
    url.searchParams.get("secret") === secret;
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    console.error("[session-reminders-cron] NEXT_PUBLIC_SITE_URL not set");
    return NextResponse.json({ error: "site_url_not_configured" }, { status: 500 });
  }

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const sendSms: SmsSender = async ({ to, message, memberId, memberName }) => {
    const { data, error } = await supabase.functions.invoke("send-notification", {
      body: {
        channel: "sms",
        to,
        message,
        member_id: memberId,
        to_name: memberName,
      },
    });
    if (error) return { ok: false, error: error.message };
    const body = data as { ok?: boolean; error?: string | null } | null;
    if (!body?.ok) return { ok: false, error: body?.error ?? "send failed" };
    return { ok: true };
  };

  try {
    const report = await runSessionReminders(supabase, { sendSms, siteUrl });
    console.log("[session-reminders-cron]", report);
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    console.error("[session-reminders-cron] run failed", err);
    return NextResponse.json({ error: "reminders_failed" }, { status: 500 });
  }
}
