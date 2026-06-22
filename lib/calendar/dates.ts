// Calendar date helpers — string-first (YYYY-MM-DD) to stay free of timezone
// drift.
//
// `new Date("2026-06-21")` parses as UTC midnight and can render as the
// previous day in negative-offset zones (e.g. Pacific/Honolulu). These helpers
// never rely on that: arithmetic runs on a UTC anchor, and the only Date we
// hand back for display is built from explicit local Y/M/D components.

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoToUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function utcToIso(dt: Date): string {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function toIso(year: number, month1: number, day: number): string {
  return `${year}-${pad(month1)}-${pad(day)}`;
}

// Today's local date as YYYY-MM-DD (no timezone shift).
export function todayIso(): string {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function addDays(iso: string, n: number): string {
  const dt = isoToUtc(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return utcToIso(dt);
}

// Whole calendar days from `aIso` to `bIso` (b - a). Same day => 0.
export function diffDays(aIso: string, bIso: string): number {
  return Math.round((isoToUtc(bIso).getTime() - isoToUtc(aIso).getTime()) / 86400000);
}

// A Date at *local* midnight for the given ISO day — safe to pass to
// toLocaleDateString without a day-shift. Use only for display formatting.
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isCurrentMonth(iso: string, year: number, month1: number): boolean {
  const [y, m] = iso.split("-").map(Number);
  return y === year && m === month1;
}

// 1-based day number within a journey for a given calendar date. Day 1 is the
// start_date. (Not clamped — callers decide whether the date falls in range.)
export function journeyDayNumber(startIso: string, dateIso: string): number {
  return diffDays(startIso, dateIso) + 1;
}

export function journeyLengthDays(startIso: string, endIso: string): number {
  return diffDays(startIso, endIso) + 1;
}

export function isWithinJourney(
  dateIso: string,
  startIso: string,
  endIso: string,
): boolean {
  return dateIso >= startIso && dateIso <= endIso;
}

// A fixed 6-row × 7-col month grid (Sunday-first), as ISO date strings. Leading
// and trailing cells spill into the adjacent months so journeys that straddle a
// month boundary still render. 42 cells keeps the grid height stable across
// months.
export function monthGrid(year: number, month1: number): string[][] {
  const firstOfMonth = new Date(Date.UTC(year, month1 - 1, 1));
  const weekday = firstOfMonth.getUTCDay(); // 0 = Sunday
  const gridStart = utcToIso(firstOfMonth);
  const start = addDays(gridStart, -weekday);

  const weeks: string[][] = [];
  let cursor = start;
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

// Inclusive [start, end] ISO bounds of the 6-week grid for a month — the range
// to request from the calendar API so spanning journeys load fully.
export function monthGridBounds(
  year: number,
  month1: number,
): { start: string; end: string } {
  const weeks = monthGrid(year, month1);
  return { start: weeks[0][0], end: weeks[5][6] };
}

export function addMonths(
  year: number,
  month1: number,
  delta: number,
): { year: number; month1: number } {
  const zeroBased = month1 - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth0 = ((zeroBased % 12) + 12) % 12;
  return { year: newYear, month1: newMonth0 + 1 };
}

// "08:00" / "08:00:00" -> "8:00 AM". Tolerant of bad input (returns it as-is).
export function formatClock(time: string): string {
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${ampm}`;
}

// Compact form for tight chips: "8:00a" / "12:30p".
export function formatClockShort(time: string): string {
  const parts = time.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const ampm = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${ampm}` : `${h12}:${pad(m)}${ampm}`;
}

// Whole-hour key (0–23) for an "HH:MM" time, for bucketing events into the
// hourly timeline.
export function hourOf(time: string): number {
  return Number(time.split(":")[0]);
}
