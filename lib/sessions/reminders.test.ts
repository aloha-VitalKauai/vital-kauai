// Day-of session reminder tests.
//
// The claims under test:
//   * exactly the sessions happening TODAY — in the series timezone, not
//     the server's — get one SMS with the exact local time and the
//     canonical meeting URL;
//   * a failed send retries on the next run, a successful one never
//     repeats, and a session already underway is never reminded late;
//   * sessions outside a series, members without a phone, and future days
//     are all left alone.

import assert from "node:assert/strict";
import { test } from "node:test";

import { reminderSmsMessage, runSessionReminders, sameDayInZone } from "./reminders.ts";
import type { SmsSender } from "../checkins/schedule.ts";

type Row = Record<string, any>;
type Db = {
  session_bookings: Row[];
  session_series: Row[];
  member_profiles: Row[];
  members: Row[];
};

function fakeSupabase(db: Db) {
  const builder = (table: keyof Db) => {
    const state = {
      op: "select" as "select" | "update",
      patch: null as Row | null,
      filters: [] as ((r: Row) => boolean)[],
    };
    const run = () => {
      const rows = db[table].filter((r) => state.filters.every((f) => f(r)));
      if (state.op === "update") {
        rows.forEach((r) => Object.assign(r, state.patch));
        return { data: rows, error: null };
      }
      return { data: rows, error: null };
    };
    const chain: any = {
      select: () => chain,
      update: (patch: Row) => ((state.op = "update"), (state.patch = patch), chain),
      eq: (col: string, v: any) => (state.filters.push((r) => r[col] === v), chain),
      is: (col: string, v: any) => (state.filters.push((r) => (r[col] ?? null) === v), chain),
      not: (col: string, _op: string, v: any) =>
        (state.filters.push((r) => (r[col] ?? null) !== v), chain),
      gt: (col: string, v: any) => (state.filters.push((r) => r[col] > v), chain),
      lte: (col: string, v: any) => (state.filters.push((r) => r[col] <= v), chain),
      maybeSingle: () => {
        const { data, error } = run();
        return Promise.resolve({ data: (data as Row[])[0] ?? null, error });
      },
      then: (ok: any, err: any) => Promise.resolve(run()).then(ok, err),
    };
    return chain;
  };
  return { from: (table: keyof Db) => builder(table) } as never;
}

const PROFILE = "profile-a";
// 6:00 AM HST on Tuesday, September 15, 2026 — the cron's daily moment.
const CRON_NOW = new Date("2026-09-15T16:00:00.000Z");

function makeDb(): Db {
  return {
    session_bookings: [],
    session_series: [{ id: "series-1", timezone: "Pacific/Honolulu" }],
    member_profiles: [{ id: PROFILE, full_name: "Ana Aloha", phone: "+18085550100" }],
    members: [{ profile_id: PROFILE, full_name: "Ana Aloha", phone: null }],
  };
}

function seriesSession(db: Db, overrides: Row = {}) {
  db.session_bookings.push({
    id: overrides.id ?? "bk-1",
    member_id: PROFILE,
    series_id: "series-1",
    session_type: "coaching",
    scheduled_at: "2026-09-15T20:00:00.000Z", // 10:00 AM HST today
    status: "scheduled",
    meeting_url: "https://zoom.example/j/1",
    reminder_sent_at: null,
    ...overrides,
  });
}

function recordingSms(results: { ok: boolean }[] = []) {
  const calls: { to: string; message: string; memberId: string }[] = [];
  const sender: SmsSender = async (args) => {
    calls.push({ to: args.to, message: args.message, memberId: args.memberId });
    return results.shift() ?? { ok: true };
  };
  return { calls, sender };
}

const OPTS = (sender: SmsSender) => ({
  sendSms: sender,
  siteUrl: "https://vitalkauai.com",
  now: CRON_NOW,
});

test("a session later today gets one SMS with the exact local time and the canonical URL", async () => {
  const db = makeDb();
  seriesSession(db);
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.sent, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "+18085550100");
  assert.match(calls[0].message, /Aloha Ana — your integration session is today at 10:00 AM HST/);
  assert.match(calls[0].message, /Join: https:\/\/zoom\.example\/j\/1/);
  assert.notEqual(db.session_bookings[0].reminder_sent_at, null);
});

test("'today' is the series timezone's day, never the server's UTC day", async () => {
  const db = makeDb();
  // 4:00 PM HST on Sep 15 = 02:00 UTC on Sep 16 — a UTC day-match would
  // wrongly call this tomorrow.
  seriesSession(db, { scheduled_at: "2026-09-16T02:00:00.000Z" });
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.sent, 1);
  assert.match(calls[0].message, /today at 4:00 PM HST/);
});

test("a session tomorrow is left alone", async () => {
  const db = makeDb();
  seriesSession(db, { scheduled_at: "2026-09-16T20:00:00.000Z" });
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.sent, 0);
  assert.equal(report.notToday, 1);
  assert.equal(calls.length, 0);
  assert.equal(db.session_bookings[0].reminder_sent_at, null);
});

test("an already-reminded session never repeats; a failed send retries next run", async () => {
  const db = makeDb();
  seriesSession(db);
  const first = recordingSms([{ ok: false }]);
  const failedRun = await runSessionReminders(fakeSupabase(db), OPTS(first.sender));
  assert.equal(failedRun.failed, 1);
  assert.equal(db.session_bookings[0].reminder_sent_at, null, "a failed send leaves the stamp clear");

  const second = recordingSms();
  const retryRun = await runSessionReminders(fakeSupabase(db), OPTS(second.sender));
  assert.equal(retryRun.sent, 1);

  const third = recordingSms();
  const repeatRun = await runSessionReminders(fakeSupabase(db), OPTS(third.sender));
  assert.equal(repeatRun.candidates, 0, "a stamped reminder never re-enters the sweep");
  assert.equal(third.calls.length, 0);
});

test("a session already underway is never reminded late", async () => {
  const db = makeDb();
  seriesSession(db, { scheduled_at: "2026-09-15T15:00:00.000Z" }); // 5:00 AM HST, before the cron
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.candidates, 0);
  assert.equal(calls.length, 0);
});

test("sessions outside a series are not this cron's to text", async () => {
  const db = makeDb();
  seriesSession(db, { series_id: null });
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.candidates, 0);
  assert.equal(calls.length, 0);
});

test("a member with no phone on file is counted and left unstamped", async () => {
  const db = makeDb();
  db.member_profiles[0].phone = null;
  seriesSession(db);
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.noPhone, 1);
  assert.equal(calls.length, 0);
  assert.equal(db.session_bookings[0].reminder_sent_at, null);
});

test("the operational record's phone wins over the profile's", async () => {
  const db = makeDb();
  db.members[0].phone = "+18085550999";
  seriesSession(db);
  const { calls, sender } = recordingSms();

  await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(calls[0].to, "+18085550999");
});

test("a session whose Zoom link is still provisioning points at the portal instead", async () => {
  const db = makeDb();
  seriesSession(db, { meeting_url: null });
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(fakeSupabase(db), OPTS(sender));

  assert.equal(report.sent, 1);
  assert.match(calls[0].message, /Your join link is in the portal: https:\/\/vitalkauai\.com\/portal\/journey/);
});

test("a mainland series reminds on the member's own day with their own clock", async () => {
  const db = makeDb();
  db.session_series[0].timezone = "America/New_York";
  // 10:00 AM EDT = 14:00 UTC, still Sep 15 everywhere relevant.
  seriesSession(db, { scheduled_at: "2026-09-15T18:00:00.000Z" });
  const { calls, sender } = recordingSms();

  const report = await runSessionReminders(
    fakeSupabase(db),
    { ...OPTS(sender), now: new Date("2026-09-15T10:00:00.000Z") },
  );

  assert.equal(report.sent, 1);
  assert.match(calls[0].message, /today at 2:00 PM EDT/);
});

test("sameDayInZone and reminderSmsMessage stay exact at the edges", () => {
  // Midnight boundary in HST.
  assert.equal(
    sameDayInZone(new Date("2026-09-16T09:59:00.000Z"), new Date("2026-09-15T20:00:00.000Z"), "Pacific/Honolulu"),
    true,
  );
  assert.equal(
    sameDayInZone(new Date("2026-09-16T10:01:00.000Z"), new Date("2026-09-15T20:00:00.000Z"), "Pacific/Honolulu"),
    false,
  );
  assert.equal(
    reminderSmsMessage({ firstName: null, localTime: "10:00 AM HST", meetingUrl: "https://z/1", portalUrl: "p" }),
    "Aloha — your integration session is today at 10:00 AM HST. Join: https://z/1",
  );
});
