import { test } from "node:test";
import assert from "node:assert/strict";
import { spotsLeftLabel, isCohortFull, groupCohortsByDate } from "./cohorts.ts";

// The four public pages all render whatever spotsLeftLabel returns, and pick
// "Next Ceremony" as the first cohort that is not full. These pin the three
// public states and the interaction between them.

const cohort = (start: string, over: Partial<{ capacity: number | null; assigned_count: number }> = {}) => ({
  id: start,
  title: "Ceremony",
  start_at: `${start}T22:00:00+00:00`,
  end_at: null,
  capacity: 3,
  assigned_count: 0,
  ...over,
});

test("October 2–9 reads Full, and counts as full", () => {
  const c = cohort("2026-10-02");
  assert.equal(spotsLeftLabel(c), "Full");
  assert.equal(isCohortFull(c), true);
});

test("November 3–10 reads Filling Now, and is still bookable", () => {
  const c = cohort("2026-11-03");
  assert.equal(spotsLeftLabel(c), "Filling Now");
  // "Filling Now" must not be mistaken for full — the page's /full/i test on
  // the label would strike the card through and skip it for Next Ceremony.
  assert.equal(isCohortFull(c), false);
  assert.equal(/full/i.test("Filling Now"), false);
});

test("a ceremony with no listing reads Open", () => {
  assert.equal(spotsLeftLabel(cohort("2026-12-18")), null);
});

test("selling out still wins over a Filling Now listing", () => {
  assert.equal(spotsLeftLabel(cohort("2026-11-03", { assigned_count: 3 })), "Full");
});

test("Next Ceremony lands on November while October is forced full", () => {
  const grouped = groupCohortsByDate([cohort("2026-10-02"), cohort("2026-11-03"), cohort("2026-12-18")]);
  assert.equal(grouped.findIndex((c) => !isCohortFull(c)), 1);
});
