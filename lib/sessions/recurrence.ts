// Sessions V4 — recurring-series date generation (Build 1).
//
// A series is "the same wall-clock time every week in the member's timezone",
// starting from the anchor session. That is NOT the same as adding 7 × 24
// hours: a mainland member's 10:00 AM stays 10:00 AM across a DST change,
// which shifts the UTC instant by an hour. Hawaiʻi observes no DST, so for
// Pacific/Honolulu the two definitions coincide — but the math here is
// correct for any IANA zone.
//
// The output is deterministic: the same (firstSessionAt, timezone, count)
// always yields the same instants. Build 2's fan-out and self-healing sweep
// lean on that determinism for idempotency — re-deriving the list and
// checking what already exists is always safe.

type WallClock = {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function wallClockInZone(instant: Date, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (type: string) => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`recurrence: missing ${type} part`);
    return Number(part.value);
  };
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // Intl renders midnight as "24" under hour12:false in some engines.
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

// The UTC instant at which `timeZone` shows this wall-clock time. Start from
// the UTC interpretation of the wall clock, then correct by however far the
// zone's rendering of that guess misses — twice, because the first correction
// can cross a DST boundary. A wall-clock time skipped by spring-forward
// resolves to the instant after the jump rather than throwing.
function zonedWallClockToUtc(wall: WallClock, timeZone: string): Date {
  let guess = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  for (let i = 0; i < 2; i++) {
    const rendered = wallClockInZone(new Date(guess), timeZone);
    const renderedAsUtc = Date.UTC(
      rendered.year,
      rendered.month - 1,
      rendered.day,
      rendered.hour,
      rendered.minute,
      rendered.second,
    );
    const wallAsUtc = Date.UTC(
      wall.year,
      wall.month - 1,
      wall.day,
      wall.hour,
      wall.minute,
      wall.second,
    );
    const missBy = wallAsUtc - renderedAsUtc;
    if (missBy === 0) break;
    guess += missBy;
  }
  return new Date(guess);
}

export type WeeklyOccurrenceArgs = {
  /** ISO instant of the anchor session (UTC or offset form). */
  firstSessionAt: string;
  /** IANA zone the member booked in, e.g. "Pacific/Honolulu". */
  timezone: string;
  /** Total occurrences including the first. */
  count: number;
};

/**
 * The series' occurrence instants: the anchor, then the same wall-clock time
 * on the same weekday for each following week, as ISO UTC strings.
 */
export function generateWeeklyOccurrences(args: WeeklyOccurrenceArgs): string[] {
  const { firstSessionAt, timezone, count } = args;
  if (!Number.isInteger(count) || count < 1) {
    throw new Error(`recurrence: count must be a positive integer, got ${count}`);
  }
  const first = new Date(firstSessionAt);
  if (Number.isNaN(first.getTime())) {
    throw new Error(`recurrence: invalid firstSessionAt: ${firstSessionAt}`);
  }
  // Surfaces an invalid IANA zone immediately (Intl throws RangeError).
  const anchorWall = wallClockInZone(first, timezone);

  const occurrences: string[] = [first.toISOString()];
  for (let week = 1; week < count; week++) {
    // Calendar arithmetic on the wall-clock date; Date.UTC normalizes
    // month/year overflow. The hour/minute/second never move.
    const shifted = new Date(
      Date.UTC(anchorWall.year, anchorWall.month - 1, anchorWall.day + week * 7),
    );
    const occurrence = zonedWallClockToUtc(
      {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: anchorWall.hour,
        minute: anchorWall.minute,
        second: anchorWall.second,
      },
      timezone,
    );
    occurrences.push(occurrence.toISOString());
  }
  return occurrences;
}

/**
 * The recurring rhythm for display — "Tuesdays · 10:00 AM" — derived from
 * the anchor instant in the series timezone, never stored.
 */
export function weeklyRhythm(
  firstSessionAt: string,
  timezone: string,
): { weekday: string; time: string } {
  const first = new Date(firstSessionAt);
  if (Number.isNaN(first.getTime())) {
    throw new Error(`recurrence: invalid firstSessionAt: ${firstSessionAt}`);
  }
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(first);
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(first);
  return { weekday, time };
}
