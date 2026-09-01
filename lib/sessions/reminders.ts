// Day-of integration-session SMS — everything testable behind
// GET /api/cron/session-reminders. The route stays thin (CRON_SECRET auth +
// service client plumbing, same as the check-ins cron); the sweep, timezone
// day-matching, and dedup live here.
//
// The sweep: every series occurrence still ahead of us today — status
// 'scheduled', attached to a series, reminder never successfully sent —
// gets one SMS with the session's exact local time and its canonical
// meeting URL. "Today" is the calendar day in the SERIES timezone, never
// the server's: a mainland member's Tuesday evening session reminds on
// their Tuesday.
//
// Dedup is the check-ins convention: reminder_sent_at is stamped only
// after the send-notification edge function confirms the send, with a
// null-guard on the update, so a failed send retries on the next run and a
// successful one never repeats. A session that has already started is
// excluded outright — a reminder after the fact is noise, and once the day
// has passed the day-match excludes it forever.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmsSender } from "@/lib/checkins/schedule";

// How far ahead the sweep looks. Generous enough to cover any same-day
// session from an early-morning run in every timezone; the day-match does
// the precise gating.
const LOOKAHEAD_HOURS = 36;

export function sameDayInZone(a: Date, b: Date, timeZone: string): boolean {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return day.format(a) === day.format(b);
}

export function reminderSmsMessage(args: {
  firstName: string | null;
  localTime: string; // "10:00 AM HST"
  meetingUrl: string | null;
  portalUrl: string;
}): string {
  const name = args.firstName?.trim() ? ` ${args.firstName.trim().split(/\s+/)[0]}` : "";
  const where = args.meetingUrl
    ? `Join: ${args.meetingUrl}`
    : `Your join link is in the portal: ${args.portalUrl}`;
  return `Aloha${name} — your integration session is today at ${args.localTime}. ${where}`;
}

export type ReminderReport = {
  candidates: number;
  sent: number;
  failed: number;
  noPhone: number;
  notToday: number;
};

export async function runSessionReminders(
  supabase: SupabaseClient,
  {
    sendSms,
    siteUrl,
    now = new Date(),
  }: { sendSms: SmsSender; siteUrl: string; now?: Date },
): Promise<ReminderReport> {
  const report: ReminderReport = { candidates: 0, sent: 0, failed: 0, noPhone: 0, notToday: 0 };
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 60 * 60 * 1000);

  const { data: upcoming, error: qErr } = await supabase
    .from("session_bookings")
    .select("id, member_id, series_id, scheduled_at, meeting_url")
    .eq("status", "scheduled")
    .is("reminder_sent_at", null)
    .not("series_id", "is", null)
    .gt("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon.toISOString());
  if (qErr) throw new Error(`reminder sweep query failed: ${qErr.message}`);

  const portalUrl = `${siteUrl.replace(/\/$/, "")}/portal/journey`;
  const timezones = new Map<string, string>();

  for (const booking of upcoming ?? []) {
    report.candidates += 1;
    const seriesId = booking.series_id as string;
    const memberId = booking.member_id as string | null;
    const startsAt = new Date(booking.scheduled_at as string);
    if (!memberId) continue;

    let timezone = timezones.get(seriesId);
    if (!timezone) {
      const { data: series } = await supabase
        .from("session_series")
        .select("timezone")
        .eq("id", seriesId)
        .maybeSingle();
      timezone = (series?.timezone as string | undefined) ?? "Pacific/Honolulu";
      timezones.set(seriesId, timezone);
    }

    if (!sameDayInZone(startsAt, now, timezone)) {
      report.notToday += 1;
      continue;
    }

    // Same lookup precedence as the check-in scheduler: the operational
    // record often carries the phone the team actually texts.
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("id, full_name, phone")
      .eq("id", memberId)
      .maybeSingle();
    const { data: member } = await supabase
      .from("members")
      .select("full_name, phone")
      .eq("profile_id", memberId)
      .maybeSingle();
    const phone = member?.phone ?? profile?.phone ?? null;
    const name = member?.full_name ?? profile?.full_name ?? null;
    if (!phone) {
      report.noPhone += 1;
      continue;
    }

    const localTime = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZoneName: "short",
    }).format(startsAt);

    const result = await sendSms({
      to: phone,
      message: reminderSmsMessage({
        firstName: name,
        localTime,
        meetingUrl: (booking.meeting_url as string | null) ?? null,
        portalUrl,
      }),
      memberId,
      memberName: name,
    });
    if (!result.ok) {
      // reminder_sent_at stays null; the next run today retries.
      report.failed += 1;
      continue;
    }

    // The null guard keeps a concurrent run from double-marking; the send
    // itself already happened, so this is bookkeeping, not a gate.
    const { error: markErr } = await supabase
      .from("session_bookings")
      .update({ reminder_sent_at: now.toISOString() })
      .eq("id", booking.id as string)
      .is("reminder_sent_at", null);
    if (markErr) throw new Error(`reminder_sent_at update failed: ${markErr.message}`);
    report.sent += 1;
  }

  return report;
}
