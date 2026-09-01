// Sessions V4 — series derivation tests.
//
// The claims under test:
//   * "sessions remaining" decreases when a session completes (or its time
//     passes), never merely because it was booked;
//   * canceled and needs_scheduling occurrences give their slot back and
//     surface as "needs scheduling", without touching remaining;
//   * "next session" is the earliest booked occurrence that has not
//     finished, including one currently underway.

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextOccurrence,
  occurrenceDone,
  seriesRemaining,
  unscheduledCount,
} from "./series.ts";

const NOW = new Date("2026-09-25T00:00:00.000Z");

const SERIES = {
  first_session_at: "2026-09-15T20:00:00.000Z",
  timezone: "Pacific/Honolulu",
  planned_sessions: 6,
  status: "active",
};

// Six weekly Tuesdays at 20:00 UTC (10:00 AM HST) from September 15, 2026.
const WEEKS = [
  "2026-09-15T20:00:00.000Z",
  "2026-09-22T20:00:00.000Z",
  "2026-09-29T20:00:00.000Z",
  "2026-10-06T20:00:00.000Z",
  "2026-10-13T20:00:00.000Z",
  "2026-10-20T20:00:00.000Z",
];

const scheduled = (at: string) => ({ scheduled_at: at, status: "scheduled" });

test("booking the whole series does not reduce sessions remaining", () => {
  const occurrences = WEEKS.map(scheduled);
  const now = new Date("2026-09-15T00:00:00.000Z"); // before the anchor runs
  assert.equal(seriesRemaining(SERIES, occurrences, now), 6);
  assert.equal(unscheduledCount(SERIES, occurrences, now), 0);
});

test("remaining decreases as sessions pass, not before", () => {
  const occurrences = WEEKS.map(scheduled);
  // Sep 25: the Sep 15 and Sep 22 sessions have run; four have not.
  assert.equal(seriesRemaining(SERIES, occurrences, NOW), 4);
});

test("an explicitly completed or no-show occurrence counts as done regardless of time", () => {
  const future = "2026-10-20T20:00:00.000Z";
  assert.equal(
    occurrenceDone({ scheduled_at: future, status: "completed" }, NOW),
    true,
  );
  assert.equal(
    occurrenceDone({ scheduled_at: future, status: "no_show" }, NOW),
    true,
  );
});

test("a session is done only after its full hour has run", () => {
  const startsAt = "2026-09-25T20:00:00.000Z";
  const row = scheduled(startsAt);
  assert.equal(occurrenceDone(row, new Date("2026-09-25T20:30:00.000Z")), false);
  assert.equal(occurrenceDone(row, new Date("2026-09-25T21:00:00.000Z")), true);
});

test("a canceled occurrence keeps remaining intact and surfaces as needing scheduling", () => {
  const occurrences = [
    ...WEEKS.slice(0, 5).map(scheduled),
    { scheduled_at: WEEKS[5], status: "canceled" },
  ];
  // Two have passed; the canceled week is neither done nor live.
  assert.equal(seriesRemaining(SERIES, occurrences, NOW), 4);
  assert.equal(unscheduledCount(SERIES, occurrences, NOW), 1);
});

test("a needs_scheduling occurrence behaves like a missing week, and a week with no row at all counts the same", () => {
  const withPlaceholder = [
    ...WEEKS.slice(0, 5).map(scheduled),
    { scheduled_at: null, status: "needs_scheduling" },
  ];
  const withMissingRow = WEEKS.slice(0, 5).map(scheduled);
  assert.equal(unscheduledCount(SERIES, withPlaceholder, NOW), 1);
  assert.equal(unscheduledCount(SERIES, withMissingRow, NOW), 1);
  assert.equal(seriesRemaining(SERIES, withPlaceholder, NOW), 4);
});

test("next session is the earliest booked occurrence that has not finished", () => {
  const occurrences = WEEKS.map(scheduled);
  const next = nextOccurrence(occurrences, NOW);
  assert.equal(next?.scheduled_at, "2026-09-29T20:00:00.000Z");
});

test("a session currently underway is still the next session", () => {
  const occurrences = WEEKS.map(scheduled);
  const duringAnchor = new Date("2026-09-15T20:30:00.000Z");
  assert.equal(
    nextOccurrence(occurrences, duringAnchor)?.scheduled_at,
    "2026-09-15T20:00:00.000Z",
  );
});

test("canceled and needs_scheduling occurrences are never the next session", () => {
  const occurrences = [
    { scheduled_at: "2026-09-29T20:00:00.000Z", status: "canceled" },
    { scheduled_at: null, status: "needs_scheduling" },
    scheduled("2026-10-06T20:00:00.000Z"),
  ];
  assert.equal(
    nextOccurrence(occurrences, NOW)?.scheduled_at,
    "2026-10-06T20:00:00.000Z",
  );
});

test("a fully run series has zero remaining and no next session — clamped, never negative", () => {
  const occurrences = WEEKS.map(scheduled);
  const after = new Date("2026-12-01T00:00:00.000Z");
  assert.equal(seriesRemaining(SERIES, occurrences, after), 0);
  assert.equal(nextOccurrence(occurrences, after), null);
  // Even with a stray extra done occurrence, remaining stays at zero.
  const extra = [...occurrences, scheduled("2026-10-27T20:00:00.000Z")];
  assert.equal(seriesRemaining(SERIES, extra, after), 0);
});

test("a member entering with other than 6 remaining is surfaced as-is, never forced to 6", () => {
  const series = { ...SERIES, planned_sessions: 4 };
  const occurrences = WEEKS.slice(0, 4).map(scheduled);
  const before = new Date("2026-09-15T00:00:00.000Z");
  assert.equal(seriesRemaining(series, occurrences, before), 4);
  assert.equal(unscheduledCount(series, occurrences, before), 0);
});
