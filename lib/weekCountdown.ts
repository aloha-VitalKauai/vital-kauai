/**
 * Per-week countdown for the pre-ceremony and post-ceremony arcs.
 *
 * Anchor is the member's ceremony start date (start_at). Each week is a
 * 7-day window. Pre-ceremony Week 1 begins 42 days before ceremony;
 * Week 6 begins 7 days before. Post-ceremony Week 1 begins on the
 * ceremony day; Week 6 begins 35 days after.
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
  // Post-ceremony Week 1 = 0,  Week 6 = +35.
  const offset = arc === "pre" ? -42 + weekIndex * 7 : weekIndex * 7;
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
