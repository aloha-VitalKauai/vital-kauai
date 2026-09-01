// Presentation state for the post-integration coaching panel — tests.
//
// The claims under test:
//   * the row converts to "Set My Weekly Time" exactly when the member is
//     post-ceremony with sessions remaining and no active series — and the
//     number shown is the ACTUAL ledger balance, never a forced 6;
//   * an active series shows the next future session, the weekly rhythm,
//     and a remaining count that decreases when a session completes, not
//     when it is booked;
//   * the Join Call URL is the next session's canonical meeting_url;
//   * a fully-run series returns the row to the ordinary booking state.

import assert from "node:assert/strict";
import { test } from "node:test";

import { seriesPanelState, type SeriesOccurrence } from "./sessionSeriesState.ts";

const ANCHOR_ISO = "2026-09-15T20:00:00.000Z"; // Tuesday, 10:00 AM HST
const WEEKS = [
  "2026-09-15T20:00:00.000Z",
  "2026-09-22T20:00:00.000Z",
  "2026-09-29T20:00:00.000Z",
  "2026-10-06T20:00:00.000Z",
  "2026-10-13T20:00:00.000Z",
  "2026-10-20T20:00:00.000Z",
];

const SERIES = {
  first_session_at: ANCHOR_ISO,
  timezone: "Pacific/Honolulu",
  planned_sessions: 6,
  status: "active",
};

const scheduled = (at: string, meetingUrl: string | null = "https://zoom.example/j/1"): SeriesOccurrence => ({
  scheduled_at: at,
  status: "scheduled",
  meeting_url: meetingUrl,
});

test("pre-ceremony stays the ordinary booking row, whatever the balance", () => {
  const state = seriesPanelState({
    postCeremony: false,
    balanceRemaining: 6,
    series: null,
    occurrences: [],
  });
  assert.deepEqual(state, { kind: "book" });
});

test("post-ceremony with sessions remaining and no series → Set My Weekly Time with the real number", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 6,
    series: null,
    occurrences: [],
  });
  assert.deepEqual(state, { kind: "set_weekly", remaining: 6 });
});

test("a member arriving with other than 6 remaining sees their actual balance, never a forced 6", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 3,
    series: null,
    occurrences: [],
  });
  assert.deepEqual(state, { kind: "set_weekly", remaining: 3 });
});

test("post-ceremony with nothing remaining stays the ordinary row (which reflects the ledger)", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: null,
    occurrences: [],
  });
  assert.deepEqual(state, { kind: "book" });
});

test("an active series shows the next FUTURE session in the series timezone with its rhythm", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0, // fully committed — irrelevant while the series runs
    series: SERIES,
    occurrences: WEEKS.map((w) => scheduled(w)),
    now: new Date("2026-09-25T00:00:00.000Z"), // two sessions have run
  });
  assert.equal(state.kind, "series");
  if (state.kind !== "series") return;
  assert.equal(state.nextDate, "Tuesday, September 29");
  assert.equal(state.nextTime, "10:00 AM HST");
  assert.equal(state.rhythm, "Tuesdays · 10:00 AM");
  assert.equal(state.remaining, 4, "remaining decreases as sessions complete, never on booking");
});

test("before anything has run, the whole series remains and the anchor is next", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: SERIES,
    occurrences: WEEKS.map((w) => scheduled(w)),
    now: new Date("2026-09-10T00:00:00.000Z"),
  });
  assert.equal(state.kind, "series");
  if (state.kind !== "series") return;
  assert.equal(state.remaining, 6);
  assert.equal(state.nextDate, "Tuesday, September 15");
});

test("Join Call carries the NEXT session's canonical meeting URL", () => {
  const occurrences = [
    scheduled(WEEKS[0], "https://zoom.example/j/first"),
    scheduled(WEEKS[1], "https://zoom.example/j/second"),
  ];
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: { ...SERIES, planned_sessions: 2 },
    occurrences,
    now: new Date("2026-09-16T00:00:00.000Z"),
  });
  assert.equal(state.kind, "series");
  if (state.kind !== "series") return;
  assert.equal(state.meetingUrl, "https://zoom.example/j/second");
});

test("a next session whose Zoom link is still provisioning yields no Join URL rather than a wrong one", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: { ...SERIES, planned_sessions: 1 },
    occurrences: [scheduled(WEEKS[0], null)],
    now: new Date("2026-09-10T00:00:00.000Z"),
  });
  assert.equal(state.kind, "series");
  if (state.kind !== "series") return;
  assert.equal(state.meetingUrl, null);
});

test("a canceled or unbookable week surfaces in the count and schedule without shifting the series", () => {
  const occurrences = [
    scheduled(WEEKS[0]),
    { scheduled_at: WEEKS[1], status: "canceled", meeting_url: null },
    { scheduled_at: WEEKS[2], status: "needs_scheduling", meeting_url: null },
    scheduled(WEEKS[3]),
  ];
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: { ...SERIES, planned_sessions: 4 },
    occurrences,
    now: new Date("2026-09-10T00:00:00.000Z"),
  });
  assert.equal(state.kind, "series");
  if (state.kind !== "series") return;
  assert.equal(state.unscheduled, 2);
  assert.equal(state.nextDate, "Tuesday, September 15");
  assert.deepEqual(
    state.schedule.map((entry) => entry.state),
    ["next", "canceled", "needs_scheduling", "upcoming"],
  );
  assert.equal(state.schedule[0].date, "Tuesday, September 15");
  assert.equal(state.schedule[0].time, "10:00 AM");
});

test("the schedule marks completed sessions and the timezone drives every rendered time", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: { ...SERIES, timezone: "America/New_York" },
    occurrences: WEEKS.slice(0, 2).map((w) => scheduled(w)),
    now: new Date("2026-09-20T00:00:00.000Z"),
  });
  assert.equal(state.kind, "series");
  if (state.kind !== "series") return;
  // 20:00 UTC renders as 4:00 PM in New York (EDT) — the member's zone wins.
  assert.equal(state.nextTime, "4:00 PM EDT");
  assert.equal(state.schedule[0].state, "done");
  assert.equal(state.rhythm, "Tuesdays · 4:00 PM");
});

test("a fully-run series returns the row to the ordinary booking state", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 0,
    series: SERIES,
    occurrences: WEEKS.map((w) => scheduled(w)),
    now: new Date("2026-12-01T00:00:00.000Z"),
  });
  assert.deepEqual(state, { kind: "book" });
});

test("a series row that is somehow inactive is ignored entirely", () => {
  const state = seriesPanelState({
    postCeremony: true,
    balanceRemaining: 2,
    series: { ...SERIES, status: "canceled" },
    occurrences: [],
  });
  assert.deepEqual(state, { kind: "set_weekly", remaining: 2 });
});
