// Weekly check-in scheduler — everything testable behind
// GET /api/cron/checkins. The route stays thin (CRON_SECRET auth + service
// client plumbing); week math, row creation, and SMS dispatch live here.
//
// Timing model (mirrors lib/journey-emails.ts: journeys.start_at is the
// ceremony/journey start, and program weeks are 7-day steps from it):
//
//   check-in week N becomes due at start_at + N*7 days — the member reflects
//   on the week they just completed, so week 1 arrives seven days in and
//   week 13 arrives 91 days in.
//
// Each run creates only the CURRENT due week's row (never all 13 upfront, so
// a question edit lands in every not-yet-created week), snapshotting the
// active template at creation. Row existence is the dedup for creation; a
// null sent_at is the dedup for SMS — sent_at is set only after Twilio (via
// the send-notification edge function) confirms the send, so a failed send
// retries on the next run and a successful one never repeats.

import type { SupabaseClient } from "@supabase/supabase-js";

export const TOTAL_WEEKS = 13;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The check-in week currently due for a journey, or null when none is
    (journey hasn't completed week 1 yet, is past week 13, or has no usable
    start date). UTC day arithmetic, same as weekToSendToday. */
export function currentCheckinWeek(
  startAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!startAt) return null;
  const start = new Date(startAt);
  if (Number.isNaN(start.getTime())) return null;
  const dayKey = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const elapsedDays = Math.floor((dayKey(now) - dayKey(start)) / MS_PER_DAY);
  const week = Math.floor(elapsedDays / 7);
  if (week < 1 || week > TOTAL_WEEKS) return null;
  return week;
}

/** When week N of a journey became due — midnight UTC of the due day, the
    same day arithmetic currentCheckinWeek uses, so a week judged due always
    has a scheduled_at that has already passed. */
export function weekDueAt(startAt: string, week: number): string {
  const start = new Date(startAt);
  const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  return new Date(startDay + week * 7 * MS_PER_DAY).toISOString();
}

export function checkinSmsMessage(firstName: string | null, link: string): string {
  const name = firstName?.trim() ? ` ${firstName.trim().split(/\s+/)[0]}` : "";
  return `Aloha${name} — your Vital Kauaʻi weekly check-in is ready. It takes about a minute: ${link}`;
}

/** Sends one SMS; resolves ok=false (never throws) on failure. Production
    passes the send-notification edge function; tests pass a fake. */
export type SmsSender = (args: {
  to: string;
  message: string;
  memberId: string;
  memberName: string | null;
}) => Promise<{ ok: boolean; error?: string }>;

export type SchedulerReport = {
  journeys: number;
  created: number;
  alreadyCreated: number;
  noTemplate: number;
  smsSent: number;
  smsFailed: number;
  noPhone: number;
};

export async function runCheckinScheduler(
  supabase: SupabaseClient,
  {
    sendSms,
    siteUrl,
    now = new Date(),
  }: { sendSms: SmsSender; siteUrl: string; now?: Date },
): Promise<SchedulerReport> {
  const report: SchedulerReport = {
    journeys: 0,
    created: 0,
    alreadyCreated: 0,
    noTemplate: 0,
    smsSent: 0,
    smsFailed: 0,
    noPhone: 0,
  };

  // ── 1. create the current week's row for each eligible journey ────────────
  const { data: journeys, error: jErr } = await supabase
    .from("journeys")
    .select("id, member_id, start_at, status")
    .in("status", ["scheduled", "in_progress"])
    .not("start_at", "is", null);
  if (jErr) throw new Error(`journeys query failed: ${jErr.message}`);

  const due = (journeys ?? [])
    .map((j) => ({ journey: j, week: currentCheckinWeek(j.start_at as string, now) }))
    .filter((d): d is { journey: (typeof d)["journey"]; week: number } => d.week !== null);
  report.journeys = due.length;

  for (const { journey, week } of due) {
    const { data: existing, error: exErr } = await supabase
      .from("member_checkins")
      .select("id")
      .eq("journey_id", journey.id as string)
      .eq("week_number", week)
      .maybeSingle();
    if (exErr) throw new Error(`existing-row check failed: ${exErr.message}`);
    if (existing) {
      report.alreadyCreated += 1;
      continue;
    }

    const { data: template, error: tErr } = await supabase
      .from("checkin_templates")
      .select("id, questions")
      .eq("week_number", week)
      .eq("active", true)
      .maybeSingle();
    if (tErr) throw new Error(`template query failed: ${tErr.message}`);
    if (!template) {
      report.noTemplate += 1;
      continue;
    }

    const { error: insErr } = await supabase.from("member_checkins").insert({
      member_id: journey.member_id as string,
      journey_id: journey.id as string,
      week_number: week,
      template_id: template.id as string,
      questions_snapshot: template.questions,
      scheduled_at: weekDueAt(journey.start_at as string, week),
      status: "scheduled",
    });
    if (insErr) {
      // 23505 = the journey+week unique key: a concurrent run won the insert.
      if (insErr.code === "23505") {
        report.alreadyCreated += 1;
        continue;
      }
      throw new Error(`check-in insert failed: ${insErr.message}`);
    }
    report.created += 1;
  }

  // ── 2. send the one SMS for every due, never-successfully-sent check-in ───
  // Includes rows from earlier runs whose send failed (sent_at still null).
  const { data: unsent, error: uErr } = await supabase
    .from("member_checkins")
    .select("id, member_id, week_number")
    .eq("status", "scheduled")
    .is("sent_at", null)
    .lte("scheduled_at", now.toISOString());
  if (uErr) throw new Error(`unsent query failed: ${uErr.message}`);

  const link = `${siteUrl.replace(/\/$/, "")}/portal/checkin`;
  for (const checkin of unsent ?? []) {
    const memberId = checkin.member_id as string;
    const { data: profile } = await supabase
      .from("member_profiles")
      .select("id, full_name, phone")
      .eq("id", memberId)
      .maybeSingle();
    // The operational record often carries the phone the team actually texts.
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

    const result = await sendSms({
      to: phone,
      message: checkinSmsMessage(name, link),
      memberId,
      memberName: name,
    });
    if (!result.ok) {
      // sent_at stays null; the next run retries.
      report.smsFailed += 1;
      continue;
    }

    // The null-sent_at guard keeps a concurrent run from double-marking; the
    // send itself already happened, so this is bookkeeping, not a gate.
    const { error: markErr } = await supabase
      .from("member_checkins")
      .update({ status: "sent", sent_at: now.toISOString() })
      .eq("id", checkin.id as string)
      .is("sent_at", null);
    if (markErr) throw new Error(`sent_at update failed: ${markErr.message}`);
    report.smsSent += 1;
  }

  return report;
}
