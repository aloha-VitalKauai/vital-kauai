import { NextResponse } from "next/server";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import {
  FOLLOWUP_STOPPED_TYPE,
  FOLLOWUP_TYPE_PREFIX,
  dueStep,
  renderFollowupEmail,
  sendFollowupEmail,
  type FollowupLead,
  type SentRecord,
} from "@/lib/lead-followups";
import { NUDGE_TYPE_PREFIX, dueNudge, renderNudgeEmail, type NudgeLead } from "@/lib/lead-invite-nudges";
import { createSetupToken, setupAccountUrl } from "@/lib/setup-tokens";

export const runtime = "nodejs";

/**
 * Daily cron — sends the next follow-up note to every lead who reached out
 * and has not booked a discovery call. See lib/lead-followups.ts for the
 * schedule and the stop rules.
 *
 * Auth: Bearer ${CRON_SECRET} OR ?secret=... (same shape as the other crons).
 *
 * Each send is recorded in notification_log as `lead_followup_<step>` before
 * the email goes out (status queued), then marked sent or failed. A failed
 * row is retried on the next run only if it is deleted by a founder; the
 * sequence never double-sends.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[lead-followups] CRON_SECRET not set");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  const url = new URL(req.url);
  const authorized =
    req.headers.get("authorization") === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
  if (!authorized) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.error("[lead-followups] RESEND_API_KEY not set");
    return NextResponse.json({ error: "email_not_configured" }, { status: 500 });
  }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vitalkauai.com";

  const supabase = createServiceSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: leads, error: lErr } = await supabase
    .from("leads")
    .select("id, full_name, email, source, created_at, discovery_call_booked, converted_to_member, approval_status")
    .or("discovery_call_booked.is.null,discovery_call_booked.eq.false")
    .or("converted_to_member.is.null,converted_to_member.eq.false");
  if (lErr) {
    console.error("[lead-followups] leads query failed", lErr);
    return NextResponse.json({ error: "leads_query_failed" }, { status: 500 });
  }

  const ids = (leads ?? []).map((l) => l.id as string);
  const { data: logRows, error: nErr } = ids.length
    ? await supabase
        .from("notification_log")
        .select("lead_id, notification_type, sent_at, created_at")
        .in("lead_id", ids)
        .or(`notification_type.like.${FOLLOWUP_TYPE_PREFIX}%,notification_type.eq.${FOLLOWUP_STOPPED_TYPE}`)
    : { data: [], error: null };
  if (nErr) {
    console.error("[lead-followups] notification_log query failed", nErr);
    return NextResponse.json({ error: "log_query_failed" }, { status: 500 });
  }

  const sentByLead = new Map<string, SentRecord[]>();
  for (const r of logRows ?? []) {
    const list = sentByLead.get(r.lead_id as string) ?? [];
    list.push({
      notification_type: r.notification_type as string,
      sent_at: r.sent_at as string | null,
      created_at: r.created_at as string,
    });
    sentByLead.set(r.lead_id as string, list);
  }

  const now = new Date();
  const results: { lead_id: string; step: string; status: "sent" | "failed" }[] = [];

  for (const row of leads ?? []) {
    const lead = row as unknown as FollowupLead;
    const step = dueStep(lead, sentByLead.get(lead.id) ?? [], now);
    if (!step) continue;

    const type = `${FOLLOWUP_TYPE_PREFIX}${step.key}`;
    // Claim the send first; the unique row is the dedup key.
    const { data: logRow, error: insErr } = await supabase
      .from("notification_log")
      .insert({
        lead_id: lead.id,
        notification_type: type,
        recipient: [lead.email],
        status: "queued",
        payload: { step: step.key, source: lead.source },
      })
      .select("id")
      .single();
    if (insErr || !logRow) {
      console.error("[lead-followups] could not claim send", lead.id, step.key, insErr);
      continue;
    }

    try {
      const { subject, html } = await renderFollowupEmail({ step, lead, siteUrl });
      const resendId = await sendFollowupEmail({ toEmail: lead.email, subject, html, resendKey });
      await supabase
        .from("notification_log")
        .update({ status: "sent", sent_at: new Date().toISOString(), payload: { step: step.key, source: lead.source, resend_id: resendId } })
        .eq("id", logRow.id);
      results.push({ lead_id: lead.id, step: step.key, status: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[lead-followups] send failed", lead.id, step.key, msg);
      await supabase.from("notification_log").update({ status: "failed", failure_reason: msg }).eq("id", logRow.id);
      results.push({ lead_id: lead.id, step: step.key, status: "failed" });
    }
  }

  // ── Pass two: invitation reminders for approved leads who have not set up ──
  const nudges: { lead_id: string; step: string; status: "sent" | "failed" }[] = [];
  const { data: approved } = await supabase
    .from("leads")
    .select("id, full_name, email, member_id, approval_status, converted_to_member, invite_sent_at")
    .eq("approval_status", "approved")
    .or("converted_to_member.is.null,converted_to_member.eq.false")
    .not("invite_sent_at", "is", null);
  const approvedIds = (approved ?? []).map((l) => l.id as string);
  const { data: nudgeLog } = approvedIds.length
    ? await supabase
        .from("notification_log")
        .select("lead_id, notification_type, sent_at, created_at")
        .in("lead_id", approvedIds)
        .or(`notification_type.like.${NUDGE_TYPE_PREFIX}invite_nudge%,notification_type.eq.${FOLLOWUP_STOPPED_TYPE}`)
    : { data: [] };
  const nudgeByLead = new Map<string, SentRecord[]>();
  for (const r of nudgeLog ?? []) {
    const list = nudgeByLead.get(r.lead_id as string) ?? [];
    list.push({ notification_type: r.notification_type as string, sent_at: r.sent_at as string | null, created_at: r.created_at as string });
    nudgeByLead.set(r.lead_id as string, list);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? siteUrl;
  for (const row of approved ?? []) {
    const lead = row as unknown as NudgeLead;
    const key = dueNudge(lead, nudgeByLead.get(lead.id) ?? [], now);
    if (!key) continue;
    const type = `${NUDGE_TYPE_PREFIX}${key}`;
    const { data: logRow, error: insErr } = await supabase
      .from("notification_log")
      .insert({ lead_id: lead.id, notification_type: type, recipient: [lead.email], status: "queued", payload: { step: key } })
      .select("id")
      .single();
    if (insErr || !logRow) continue;
    try {
      const token = await createSetupToken({ userId: lead.member_id as string, email: lead.email, fullName: lead.full_name });
      const setupUrl = setupAccountUrl(token, appUrl);
      const { subject, html } = await renderNudgeEmail({ key, fullName: lead.full_name, setupUrl });
      const resendId = await sendFollowupEmail({ toEmail: lead.email, subject, html, resendKey });
      await supabase.from("notification_log").update({ status: "sent", sent_at: new Date().toISOString(), payload: { step: key, resend_id: resendId } }).eq("id", logRow.id);
      nudges.push({ lead_id: lead.id, step: key, status: "sent" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[lead-followups] nudge failed", lead.id, key, msg);
      await supabase.from("notification_log").update({ status: "failed", failure_reason: msg }).eq("id", logRow.id);
      nudges.push({ lead_id: lead.id, step: key, status: "failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    nudges,
    considered: leads?.length ?? 0,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
