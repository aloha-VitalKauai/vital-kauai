import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import { FOUNDER_ALERT_EMAILS } from "@/lib/founder-alerts";

export const runtime = "nodejs";

/**
 * Monday morning summary to the founders: the week's leads by source, calls
 * booked, follow-up notes sent, invitations outstanding, and the running
 * count toward 50 discovery calls a month. Founders only; no member email.
 *
 * Auth: Bearer ${CRON_SECRET} OR ?secret=... (same shape as the other crons).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  const url = new URL(req.url);
  const authorized =
    req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return NextResponse.json({ error: "email_not_configured" }, { status: 500 });

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [{ data: weekLeads }, { data: prevLeads }, { data: monthLeads }, { data: notes }, { data: invites }] =
    await Promise.all([
      supabase.from("leads").select("source, discovery_call_booked, converted_to_member, calendly_booked_at, created_at").gte("created_at", weekAgo),
      supabase.from("leads").select("source, calendly_booked_at, created_at").gte("created_at", twoWeeksAgo).lt("created_at", weekAgo),
      supabase.from("leads").select("calendly_booked_at").gte("calendly_booked_at", monthStart),
      supabase.from("notification_log").select("notification_type").gte("created_at", weekAgo).like("notification_type", "lead_%"),
      supabase.from("leads").select("id").eq("approval_status", "approved").or("converted_to_member.is.null,converted_to_member.eq.false"),
    ]);

  const bySource = new Map<string, number>();
  for (const l of weekLeads ?? []) bySource.set(l.source ?? "unknown", (bySource.get(l.source ?? "unknown") ?? 0) + 1);
  const bookedWeek = (weekLeads ?? []).filter((l) => l.calendly_booked_at && l.calendly_booked_at >= weekAgo).length;
  const bookedPrev = (prevLeads ?? []).filter((l) => l.calendly_booked_at && l.calendly_booked_at >= twoWeeksAgo && l.calendly_booked_at < weekAgo).length;
  const bookedMonth = (monthLeads ?? []).length;
  const notesSent = (notes ?? []).filter((n) => n.notification_type.startsWith("lead_followup_") && n.notification_type !== "lead_followup_stopped").length;
  const nudgesSent = (notes ?? []).filter((n) => n.notification_type.startsWith("lead_invite_nudge")).length;
  const invitesOpen = invites?.length ?? 0;

  const sourceLines = [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}: ${n}`).join(", ") || "none";
  const text = [
    `Vital Kauaʻi · week ending ${now.toISOString().slice(0, 10)}`,
    ``,
    `Discovery calls booked this week: ${bookedWeek} (previous week ${bookedPrev})`,
    `Booked so far this month: ${bookedMonth} of 50`,
    `New leads this week: ${weekLeads?.length ?? 0} (${sourceLines})`,
    `Follow-up notes sent: ${notesSent}. Invitation reminders sent: ${nudgesSent}.`,
    `Invitations open, waiting on setup: ${invitesOpen}`,
    ``,
    `Full detail and the learning log: the status page in Claude.`,
  ].join("\n");
  const html = `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.75;color:#1a1a18;max-width:560px">
    <p style="font-family:'Helvetica Neue',sans-serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#a88a45;margin:0 0 12px">Vital Kauaʻi · Monday summary</p>
    <p style="font-size:28px;margin:0 0 18px"><strong>${bookedWeek}</strong> discovery calls booked this week<span style="color:#7d7f73;font-size:16px"> · previous week ${bookedPrev}</span></p>
    <p><strong>${bookedMonth} of 50</strong> booked so far this month.</p>
    <p>New leads: <strong>${weekLeads?.length ?? 0}</strong> (${sourceLines}).</p>
    <p>Follow-up notes sent: ${notesSent}. Invitation reminders sent: ${nudgesSent}. Invitations open, waiting on setup: ${invitesOpen}.</p>
    <p style="color:#7d7f73;font-size:14px">Full detail and the learning log are on the status page in Claude.</p>
  </div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: "Vital Kauaʻi <aloha@vitalkauai.com>",
      to: [...FOUNDER_ALERT_EMAILS],
      subject: `${bookedWeek} discovery calls this week · ${bookedMonth} of 50 this month`,
      html,
      text,
    }),
  });
  if (!res.ok) {
    console.error("[weekly-summary] Resend", res.status, await res.text());
    return NextResponse.json({ ok: false, error: "send_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, bookedWeek, bookedPrev, bookedMonth, leads: weekLeads?.length ?? 0, notesSent, nudgesSent, invitesOpen });
}
