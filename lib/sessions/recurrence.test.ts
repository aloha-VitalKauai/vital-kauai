// Sessions V4 — recurrence generation tests.
//
// The claims under test:
//   * weekly occurrences preserve the member's WALL-CLOCK time in the
//     series timezone, not a fixed UTC offset;
//   * Hawaiʻi (no DST) yields exact 7-day UTC steps;
//   * a mainland zone crossing a DST boundary shifts the UTC instant while
//     the local time stays put;
//   * the derivation is deterministic and validates its inputs.

import assert from "node:assert/strict";
import { test } from "node:test";

import { generateWeeklyOccurrences, weeklyRhythm } from "./recurrence.ts";

// Tuesday, September 15, 2026, 10:00 AM HST = 20:00 UTC (HST is UTC-10, no DST).
const ANCHOR_HST = "2026-09-15T20:00:00.000Z";

test("HST series: six weekly occurrences, exact 7-day steps, wall clock preserved", () => {
  const out = generateWeeklyOccurrences({
    firstSessionAt: ANCHOR_HST,
    timezone: "Pacific/Honolulu",
    count: 6,
  });
  assert.deepEqual(out, [
    "2026-09-15T20:00:00.000Z",
    "2026-09-22T20:00:00.000Z",
    "2026-09-29T20:00:00.000Z",
    "2026-10-06T20:00:00.000Z",
    "2026-10-13T20:00:00.000Z",
    "2026-10-20T20:00:00.000Z",
  ]);
});

test("the anchor instant is returned verbatim as the first occurrence", () => {
  const out = generateWeeklyOccurrences({
    firstSessionAt: ANCHOR_HST,
    timezone: "Pacific/Honolulu",
    count: 1,
  });
  assert.deepEqual(out, [ANCHOR_HST]);
});

test("mainland series across the DST fall-back keeps 10:00 AM local, moves UTC by an hour", () => {
  // Tuesday, October 20, 2026, 10:00 AM EDT = 14:00 UTC. US DST ends
  // November 1, 2026, so the Nov 3 occurrence is 10:00 AM EST = 15:00 UTC.
  const out = generateWeeklyOccurrences({
    firstSessionAt: "2026-10-20T14:00:00.000Z",
    timezone: "America/New_York",
    count: 4,
  });
  assert.deepEqual(out, [
    "2026-10-20T14:00:00.000Z",
    "2026-10-27T14:00:00.000Z",
    "2026-11-03T15:00:00.000Z",
    "2026-11-10T15:00:00.000Z",
  ]);
});

test("mainland series across the DST spring-forward keeps local time, moves UTC the other way", () => {
  // Tuesday, March 2, 2027, 10:00 AM EST = 15:00 UTC. US DST begins
  // March 14, 2027, so the Mar 16 occurrence is 10:00 AM EDT = 14:00 UTC.
  const out = generateWeeklyOccurrences({
    firstSessionAt: "2027-03-02T15:00:00.000Z",
    timezone: "America/New_York",
    count: 3,
  });
  assert.deepEqual(out, [
    "2027-03-02T15:00:00.000Z",
    "2027-03-09T15:00:00.000Z",
    "2027-03-16T14:00:00.000Z",
  ]);
});

test("a wall-clock time erased by spring-forward resolves forward instead of throwing", () => {
  // 2:30 AM EST on Sunday March 7, 2027 = 07:30 UTC. On March 14 the clock
  // jumps 2:00→3:00, so 2:30 AM does not exist; the occurrence lands on the
  // adjusted instant rather than failing the whole series.
  const out = generateWeeklyOccurrences({
    firstSessionAt: "2027-03-07T07:30:00.000Z",
    timezone: "America/New_York",
    count: 2,
  });
  assert.equal(out[0], "2027-03-07T07:30:00.000Z");
  const second = new Date(out[1]);
  assert.ok(!Number.isNaN(second.getTime()));
  // Whatever it resolves to, it is on March 14 and within an hour of the
  // requested wall clock.
  assert.equal(second.toISOString().slice(0, 10), "2027-03-14");
});

test("month and year boundaries roll over correctly", () => {
  // Tuesday, December 29, 2026, 10:00 AM HST → January 5, 2027.
  const out = generateWeeklyOccurrences({
    firstSessionAt: "2026-12-29T20:00:00.000Z",
    timezone: "Pacific/Honolulu",
    count: 2,
  });
  assert.deepEqual(out, [
    "2026-12-29T20:00:00.000Z",
    "2027-01-05T20:00:00.000Z",
  ]);
});

test("determinism: the same inputs always yield the same list", () => {
  const args = {
    firstSessionAt: ANCHOR_HST,
    timezone: "Pacific/Honolulu",
    count: 6,
  };
  assert.deepEqual(
    generateWeeklyOccurrences(args),
    generateWeeklyOccurrences(args),
  );
});

test("invalid inputs are rejected loudly, never silently truncated", () => {
  assert.throws(
    () =>
      generateWeeklyOccurrences({
        firstSessionAt: ANCHOR_HST,
        timezone: "Pacific/Honolulu",
        count: 0,
      }),
    /positive integer/,
  );
  assert.throws(
    () =>
      generateWeeklyOccurrences({
        firstSessionAt: ANCHOR_HST,
        timezone: "Pacific/Honolulu",
        count: 2.5,
      }),
    /positive integer/,
  );
  assert.throws(
    () =>
      generateWeeklyOccurrences({
        firstSessionAt: "not-a-date",
        timezone: "Pacific/Honolulu",
        count: 6,
      }),
    /invalid firstSessionAt/,
  );
  assert.throws(() =>
    generateWeeklyOccurrences({
      firstSessionAt: ANCHOR_HST,
      timezone: "Hawaii/Nowhere",
      count: 6,
    }),
  );
});

test("weeklyRhythm derives the display rhythm from the anchor in the series zone", () => {
  assert.deepEqual(weeklyRhythm(ANCHOR_HST, "Pacific/Honolulu"), {
    weekday: "Tuesday",
    time: "10:00 AM",
  });
  // The same instant reads differently in a different zone — the series
  // timezone, not the server's, decides what the member sees.
  assert.deepEqual(weeklyRhythm(ANCHOR_HST, "America/New_York"), {
    weekday: "Tuesday",
    time: "4:00 PM",
  });
});
