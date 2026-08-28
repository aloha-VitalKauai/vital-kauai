import { test } from "node:test";
import assert from "node:assert/strict";
import { spotsLeftLabel, isCohortFull, groupCohortsByDate, type PublicCohort } from "./cohorts.ts";

// The four public pages all render whatever spotsLeftLabel returns, and pick
// "Next Ceremony" as the first cohort that is not full. These pin the three
// public states, and the rules that keep a founder override honest.

const cohort = (over: Partial<PublicCohort> = {}): PublicCohort => ({
  id: "c1",
  title: "Ceremony",
  start_at: "2026-10-02T22:00:00+00:00",
  end_at: null,
  capacity: 3,
  assigned_count: 0,
  ...over,
});

test("public_status 'full' reads Full, and counts as full", () => {
  const c = cohort({ public_status: "full" });
  assert.equal(spotsLeftLabel(c), "Full");
  assert.equal(isCohortFull(c), true);
});

test("public_status 'filling' reads Filling Now, and is still bookable", () => {
  const c = cohort({ public_status: "filling" });
  assert.equal(spotsLeftLabel(c), "Filling Now");
  // "Filling Now" must not be mistaken for full — two pages test the label
  // with /full/i, which would strike the card through and skip it for Next
  // Ceremony.
  assert.equal(isCohortFull(c), false);
  assert.equal(/full/i.test("Filling Now"), false);
});

test("'auto', 'open', and an absent column all read Open when spots remain", () => {
  assert.equal(spotsLeftLabel(cohort({ public_status: "auto" })), null);
  assert.equal(spotsLeftLabel(cohort({ public_status: "open" })), null);
  assert.equal(spotsLeftLabel(cohort()), null);
  assert.equal(spotsLeftLabel(cohort({ public_status: null })), null);
});

test("selling out wins over every override", () => {
  for (const status of ["auto", "open", "filling", undefined]) {
    const c = cohort({ public_status: status, assigned_count: 3 });
    assert.equal(spotsLeftLabel(c), "Full", `status ${status}`);
  }
});

test("an unrecognised status falls back to deriving from capacity", () => {
  assert.equal(spotsLeftLabel(cohort({ public_status: "sold-out-ish" })), null);
  assert.equal(spotsLeftLabel(cohort({ public_status: "sold-out-ish", assigned_count: 3 })), "Full");
});

test("a cohort with no capacity set reads Open unless overridden", () => {
  assert.equal(spotsLeftLabel(cohort({ capacity: null })), null);
  assert.equal(spotsLeftLabel(cohort({ capacity: null, public_status: "full" })), "Full");
});

test("Next Ceremony lands on the first cohort that is not full", () => {
  const grouped = groupCohortsByDate([
    cohort({ id: "oct", start_at: "2026-10-02T22:00:00+00:00", public_status: "full" }),
    cohort({ id: "nov", start_at: "2026-11-03T22:00:00+00:00", public_status: "filling" }),
    cohort({ id: "dec", start_at: "2026-12-18T22:00:00+00:00" }),
  ]);
  assert.equal(grouped.findIndex((c) => !isCohortFull(c)), 1);
});

test("merging same-week cohorts keeps the most closed status", () => {
  // Two journeys on one week merge into a single card. The merged row must not
  // drop an override and advertise the week as open.
  const week = (a?: string, b?: string) =>
    groupCohortsByDate([
      cohort({ id: "a", title: "Men's Iboga Journey", public_status: a }),
      cohort({ id: "b", title: "Women's Iboga Journey", public_status: b }),
    ]);

  assert.equal(week("full", "open").length, 1);
  assert.equal(spotsLeftLabel(week("full", "open")[0]), "Full");
  assert.equal(spotsLeftLabel(week("filling", "auto")[0]), "Filling Now");
  assert.equal(spotsLeftLabel(week("open", "open")[0]), null);
  assert.equal(spotsLeftLabel(week()[0]), null);
});

test("a merged week is Full once its summed capacity is taken", () => {
  const grouped = groupCohortsByDate([
    cohort({ id: "a", title: "Men's Iboga Journey", capacity: 2, assigned_count: 2 }),
    cohort({ id: "b", title: "Women's Iboga Journey", capacity: 1, assigned_count: 1 }),
  ]);
  assert.equal(grouped.length, 1);
  assert.equal(spotsLeftLabel(grouped[0]), "Full");
});
