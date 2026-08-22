/**
 * Per-week countdown for the pre-ceremony and post-ceremony arcs.
 *
 * Anchor is the member's ceremony start date (start_at). Each week is a
 * 7-day window. Pre-ceremony Week 1 begins 42 days before ceremony;
 * Week 6 begins 7 days before. The ceremony week itself (day 0 through
 * day 6) belongs to no arc week — members are on-island. Post-ceremony
 * Week 1 begins 7 days after ceremony; Week 6 begins 42 days after.
 *
 * Returns a phase tag and a short, plain-spoken label. Returns null
 * if the ceremony date is unknown — caller can render a fallback.
 */

export type WeekArc = "pre" | "post";
export type WeekPhase = "future" | "current" | "past";

export type WeekCountdown = {
  phase: WeekPhase;
  /** Days until weekStart (negative when past). */
  daysUntilStart: number;
  /** Days until weekEnd (start + 7). Negative when fully past. */
  daysUntilEnd: number;
  /** Short label suitable for a header strip. */
  label: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function diffDaysUTC(a: Date, b: Date): number {
  return Math.round((startOfDayUTC(a).getTime() - startOfDayUTC(b).getTime()) / MS_PER_DAY);
}

/**
 * @param ceremonyStartAt ISO string of the ceremony's start_at, or null/undefined.
 * @param arc "pre" or "post"
 * @param weekIndex 0..5 (Week 1..6)
 * @param now optional override for testing.
 */
export function getWeekCountdown(
  ceremonyStartAt: string | null | undefined,
  arc: WeekArc,
  weekIndex: number,
  now: Date = new Date(),
): WeekCountdown | null {
  if (!ceremonyStartAt) return null;
  const ceremony = new Date(ceremonyStartAt);
  if (Number.isNaN(ceremony.getTime())) return null;

  // Week start offset relative to ceremony, in days.
  // Pre-ceremony Week 1 = -42, Week 6 = -7.
  // Ceremony week = 0..+6, no arc week.
  // Post-ceremony Week 1 = +7, Week 6 = +42.
  const offset = arc === "pre" ? -42 + weekIndex * 7 : 7 + weekIndex * 7;
  const weekStart = new Date(ceremony.getTime() + offset * MS_PER_DAY);
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY);

  const daysUntilStart = diffDaysUTC(weekStart, now);
  const daysUntilEnd = diffDaysUTC(weekEnd, now);

  let phase: WeekPhase;
  let label: string;
  if (daysUntilStart > 0) {
    phase = "future";
    label = daysUntilStart === 1 ? "Begins tomorrow" : `Begins in ${daysUntilStart} days`;
  } else if (daysUntilEnd > 0) {
    phase = "current";
    const left = daysUntilEnd;
    label = left === 1 ? "Last day" : `${left} days remaining`;
  } else {
    phase = "past";
    label = "Complete";
  }

  return { phase, daysUntilStart, daysUntilEnd, label };
}

/**
 * The (arc, week) a member is in right now, by the same week calendar the
 * weekly journey emails follow. The arc spans 42 days before ceremony
 * through 49 days after: six preparation weeks, the ceremony week, then
 * six integration weeks. Returns null when today falls outside that
 * window — before it begins, after it ends, during the ceremony week
 * itself, or when the ceremony date is unknown — so the caller can fall
 * back to resume-where-you-left-off instead of pinning the member to
 * Week 1 or the final week.
 */
export function getCurrentArcWeek(
  ceremonyStartAt: string | null | undefined,
  now: Date = new Date(),
): { arc: WeekArc; weekIndex: number } | null {
  if (!ceremonyStartAt) return null;
  const ceremony = new Date(ceremonyStartAt);
  if (Number.isNaN(ceremony.getTime())) return null;

  // Days since pre-ceremony Week 1 began (42 days before ceremony).
  const arcStart = new Date(ceremony.getTime() - 42 * MS_PER_DAY);
  const daysIn = diffDaysUTC(now, arcStart);
  if (daysIn < 0) return null; // before the arc begins

  // Week 0..5 = pre-ceremony; week 6 = the ceremony week itself, which
  // belongs to no arc week; week 7..12 = post-ceremony. Beyond week 12 the
  // arc is complete.
  const week = Math.floor(daysIn / 7);
  if (week <= 5) return { arc: "pre", weekIndex: week };
  if (week === 6) return null; // ceremony week — members are on-island
  if (week <= 12) return { arc: "post", weekIndex: week - 7 };
  return null; // arc complete
}
