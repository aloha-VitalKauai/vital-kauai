// Presentation state for the post-integration coaching panel (V4 Build 3).
//
// Pure functions, same shape as sessionCardState.ts: the component hands in
// what it read (balance, active series, occurrence rows) and gets back
// exactly one of three states to render. All time math delegates to the
// canonical series derivations — nothing here re-implements a formula.
//
//   book        → the ordinary booking row, exactly as before. Pre-ceremony
//                 members, members with nothing remaining, and members whose
//                 series has fully run all land here.
//   set_weekly  → post-ceremony, sessions remaining, no active series: the
//                 row converts to "Set My Weekly Time". remaining is the
//                 member's ACTUAL ledger balance, surfaced as-is — a member
//                 arriving with other than 6 sees their real number.
//   series      → an active series exists: the next session, the weekly
//                 rhythm, sessions remaining (decreases when a session
//                 completes, never merely when booked), the canonical join
//                 URL, and the full schedule.

import {
  nextOccurrence,
  occurrenceDone,
  seriesRemaining,
  unscheduledCount,
  type SeriesRow,
} from "@/lib/sessions/series";
import { weeklyRhythm } from "@/lib/sessions/recurrence";

export type SeriesOccurrence = {
  scheduled_at: string | null;
  status: string;
  meeting_url: string | null;
};

export type ScheduleEntry = {
  date: string; // "Tuesday, September 15"
  time: string; // "10:00 AM"
  state: "done" | "next" | "upcoming" | "needs_scheduling" | "canceled";
};

export type SeriesPanelState =
  | { kind: "book" }
  | { kind: "set_weekly"; remaining: number }
  | {
      kind: "series";
      nextDate: string | null; // null once every session has run
      nextTime: string | null; // includes the zone label, e.g. "10:00 AM HST"
      rhythm: string; // "Tuesdays · 10:00 AM"
      remaining: number;
      meetingUrl: string | null;
      unscheduled: number;
      schedule: ScheduleEntry[];
    };

function formatDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string, timeZone: string, withZone: boolean): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(withZone ? { timeZoneName: "short" } : {}),
  }).format(new Date(iso));
}

function scheduleEntries(
  occurrences: SeriesOccurrence[],
  timeZone: string,
  nextAt: string | null,
  now: Date,
): ScheduleEntry[] {
  return occurrences
    .filter((occ) => occ.scheduled_at != null)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at as string).getTime() -
        new Date(b.scheduled_at as string).getTime(),
    )
    .map((occ) => {
      const at = occ.scheduled_at as string;
      const state: ScheduleEntry["state"] =
        occ.status === "canceled"
          ? "canceled"
          : occ.status === "needs_scheduling"
            ? "needs_scheduling"
            : occurrenceDone(occ, now)
              ? "done"
              : at === nextAt
                ? "next"
                : "upcoming";
      return { date: formatDate(at, timeZone), time: formatTime(at, timeZone, false), state };
    });
}

export function seriesPanelState(args: {
  postCeremony: boolean;
  balanceRemaining: number;
  series: (SeriesRow & { timezone: string }) | null;
  occurrences: SeriesOccurrence[];
  now?: Date;
}): SeriesPanelState {
  const now = args.now ?? new Date();
  const { series } = args;

  if (series && series.status === "active") {
    const remaining = seriesRemaining(series, args.occurrences, now);
    // Every planned session has run: the rhythm is complete, and the row
    // returns to the ordinary booking state (which reflects the ledger).
    if (remaining <= 0) return { kind: "book" };

    const next = nextOccurrence(args.occurrences, now);
    const nextAt = next?.scheduled_at ?? null;
    return {
      kind: "series",
      nextDate: nextAt ? formatDate(nextAt, series.timezone) : null,
      nextTime: nextAt ? formatTime(nextAt, series.timezone, true) : null,
      rhythm: (() => {
        const { weekday, time } = weeklyRhythm(series.first_session_at, series.timezone);
        return `${weekday}s · ${time}`;
      })(),
      remaining,
      meetingUrl: (next as SeriesOccurrence | null)?.meeting_url ?? null,
      unscheduled: unscheduledCount(series, args.occurrences, now),
      schedule: scheduleEntries(args.occurrences, series.timezone, nextAt, now),
    };
  }

  if (args.postCeremony && args.balanceRemaining > 0) {
    return { kind: "set_weekly", remaining: args.balanceRemaining };
  }

  return { kind: "book" };
}
