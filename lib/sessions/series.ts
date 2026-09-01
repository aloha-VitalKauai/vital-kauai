// Sessions V4 — recurring-series derivations (Build 1).
//
// Nothing here is stored. Same philosophy as balance.ts: "sessions
// remaining", "next session" and "needs scheduling" are derived on every
// read from the series row and its occurrence rows, so cancellations,
// reschedules and completions can never drift a counter.
//
// The card's "sessions remaining" is planned − done. It decreases when a
// session is COMPLETED (or its time has passed), not when it is booked —
// deliberately different from balance.ts's allowance remaining, which counts
// bookings and therefore drops to zero the moment a series is scheduled.
// Both definitions are correct; they answer different questions.

export const SESSION_DURATION_MINUTES = 60;

const MS_PER_MINUTE = 60_000;

export type SeriesRow = {
  first_session_at: string;
  timezone: string;
  planned_sessions: number;
  status: string;
};

export type SeriesOccurrenceRow = {
  scheduled_at: string | null;
  status: string;
};

// A session's slot has been consumed: it was held (completed or no-show), or
// its scheduled time — plus the hour it runs — is behind us and nobody
// canceled it. status='completed' is not yet written anywhere, so time
// passing is the working definition; an explicit founder marking simply
// agrees with it.
export function occurrenceDone(row: SeriesOccurrenceRow, now: Date): boolean {
  if (row.status === "completed" || row.status === "no_show") return true;
  if (row.status !== "scheduled" || !row.scheduled_at) return false;
  const ends =
    new Date(row.scheduled_at).getTime() +
    SESSION_DURATION_MINUTES * MS_PER_MINUTE;
  return ends <= now.getTime();
}

// A live occurrence still holds its place in the series: booked and not yet
// over. Canceled and needs_scheduling rows have given their slot back.
function occurrenceLive(row: SeriesOccurrenceRow, now: Date): boolean {
  return row.status === "scheduled" && !occurrenceDone(row, now);
}

/** Sessions remaining = planned − done. Decreases on completion, never on booking. */
export function seriesRemaining(
  series: SeriesRow,
  occurrences: SeriesOccurrenceRow[],
  now: Date,
): number {
  const done = occurrences.filter((row) => occurrenceDone(row, now)).length;
  return Math.max(0, series.planned_sessions - done);
}

/**
 * The occurrence the portal shows as "next": the earliest booked session
 * that has not finished — which keeps the current session (and its Join
 * Call link) on screen while it is underway.
 */
export function nextOccurrence(
  occurrences: SeriesOccurrenceRow[],
  now: Date,
): SeriesOccurrenceRow | null {
  const upcoming = occurrences
    .filter((row) => occurrenceLive(row, now) && row.scheduled_at)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at as string).getTime() -
        new Date(b.scheduled_at as string).getTime(),
    );
  return upcoming[0] ?? null;
}

/**
 * How many of the planned sessions have no live-or-done occurrence — weeks
 * that were unavailable at fan-out or were canceled and not rebooked. A
 * count, not a date match, so a rescheduled occurrence keeps covering its
 * slot wherever it moved.
 */
export function unscheduledCount(
  series: SeriesRow,
  occurrences: SeriesOccurrenceRow[],
  now: Date,
): number {
  const covering = occurrences.filter(
    (row) => occurrenceLive(row, now) || occurrenceDone(row, now),
  ).length;
  return Math.max(0, series.planned_sessions - covering);
}
