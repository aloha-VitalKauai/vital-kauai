// Sessions V4 Build 2 — fan-out unit tests.
//
// webhook.test.ts proves the full anchor → series → fan-out path; this file
// drives runSeriesFanout and convertAnchorToSeries directly for the edges:
// the allowance ceiling, retry idempotency, the echo-won-the-race claim,
// past occurrences, and the unconfigured fallback.

import { test } from "node:test";
import assert from "node:assert/strict";

import { convertAnchorToSeries, runSeriesFanout } from "./fanout.ts";

const COACH_URI = "https://api.calendly.com/event_types/COACH";
const PROFILE = "profile-a";
const ANCHOR_ISO = "2099-01-05T20:00:00.000Z";
const WEEKS = [
  "2099-01-05T20:00:00.000Z",
  "2099-01-12T20:00:00.000Z",
  "2099-01-19T20:00:00.000Z",
  "2099-01-26T20:00:00.000Z",
  "2099-02-02T20:00:00.000Z",
  "2099-02-09T20:00:00.000Z",
];

type Row = Record<string, any>;
type Db = {
  calendly_event_mappings: Row[];
  session_bookings: Row[];
  member_session_allowances: Row[];
  session_series: Row[];
  journeys: Row[];
};

function fakeSupabase(db: Db) {
  let nextId = 1;
  const builder = (table: keyof Db) => {
    const state = {
      op: "select" as "select" | "insert" | "update",
      patch: null as Row | null,
      inserted: null as Row | null,
      filters: [] as ((r: Row) => boolean)[],
      orderBy: null as { col: string; asc: boolean } | null,
      limit: null as number | null,
    };
    const run = () => {
      if (state.op === "insert") {
        const row = { id: `row-${nextId++}`, ...state.inserted };
        if (
          table === "session_bookings" &&
          row.calendly_invitee_uri != null &&
          db.session_bookings.some((b) => b.calendly_invitee_uri === row.calendly_invitee_uri)
        ) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        if (
          table === "session_series" &&
          (row.status ?? "active") === "active" &&
          db.session_series.some(
            (s) => s.member_id === row.member_id && s.session_type === row.session_type && s.status === "active",
          )
        ) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        db[table].push(row);
        return { data: row, error: null };
      }
      let rows = db[table].filter((r) => state.filters.every((f) => f(r)));
      if (state.op === "update") {
        rows.forEach((r) => Object.assign(r, state.patch));
        return { data: rows, error: null };
      }
      if (state.orderBy) {
        const { col, asc } = state.orderBy;
        rows = [...rows].sort((a, b) =>
          a[col] < b[col] ? (asc ? -1 : 1) : a[col] > b[col] ? (asc ? 1 : -1) : 0,
        );
      }
      if (state.limit != null) rows = rows.slice(0, state.limit);
      return { data: rows, error: null };
    };
    const chain: any = {
      select: () => chain,
      insert: (row: Row) => ((state.op = "insert"), (state.inserted = row), chain),
      update: (patch: Row) => ((state.op = "update"), (state.patch = patch), chain),
      eq: (col: string, v: any) => (state.filters.push((r) => r[col] === v), chain),
      neq: (col: string, v: any) => (state.filters.push((r) => r[col] !== v), chain),
      is: (col: string, v: any) => (state.filters.push((r) => (r[col] ?? null) === v), chain),
      order: (col: string, opts: { ascending: boolean }) =>
        ((state.orderBy = { col, asc: opts.ascending }), chain),
      limit: (n: number) => ((state.limit = n), chain),
      maybeSingle: () => {
        const { data, error } = run();
        return Promise.resolve({ data: (data as Row[])[0] ?? null, error });
      },
      single: () => {
        const { data, error } = run();
        if (error) return Promise.resolve({ data: null, error });
        const row = Array.isArray(data) ? data[0] : data;
        return Promise.resolve(
          row ? { data: row, error: null } : { data: null, error: { code: "PGRST116", message: "no rows" } },
        );
      },
      then: (ok: any, err: any) => Promise.resolve(run()).then(ok, err),
    };
    return chain;
  };
  return { from: (table: keyof Db) => builder(table) } as never;
}

function makeDb(coachingQuantity = 10): Db {
  return {
    calendly_event_mappings: [
      { calendly_event_type_uri: COACH_URI, session_type: "coaching", active: true },
    ],
    session_bookings: [],
    member_session_allowances: [
      { member_id: PROFILE, session_type: "coaching", quantity: coachingQuantity },
    ],
    session_series: [],
    journeys: [
      { id: "journey-1", member_id: PROFILE, status: "in_progress", created_at: "2026-08-01T00:00:00Z" },
    ],
  };
}

function seedSeries(db: Db, planned: number): Row {
  const series = {
    id: "series-1",
    member_id: PROFILE,
    journey_id: "journey-1",
    session_type: "coaching",
    first_session_at: ANCHOR_ISO,
    timezone: "Pacific/Honolulu",
    planned_sessions: planned,
    status: "active",
  };
  db.session_series.push(series);
  return series;
}

function seedAnchor(db: Db) {
  db.session_bookings.push({
    id: "bk-anchor",
    member_id: PROFILE,
    session_type: "coaching",
    calendly_invitee_uri: "inv-anchor",
    scheduled_at: ANCHOR_ISO,
    status: "scheduled",
    counts_against_allowance: true,
    needs_review: false,
    series_id: "series-1",
  });
}

function calendlyMock() {
  const calls: { url: string; method: string; body?: any }[] = [];
  let n = 0;
  const fetchImpl = (async (url: any, init?: any) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, method, body });
    const json = (payload: any) => ({ ok: true, status: 200, json: async () => payload });
    if (u.includes("/event_type_available_times")) {
      const params = new URL(u).searchParams;
      const occ = new Date(
        (new Date(params.get("start_time")!).getTime() + new Date(params.get("end_time")!).getTime()) / 2,
      ).toISOString();
      return json({ collection: [{ status: "available", start_time: occ }] });
    }
    if (u.endsWith("/invitees") && method === "POST") {
      n++;
      return json({
        resource: {
          uri: `https://api.calendly.com/scheduled_events/EVF${n}/invitees/INVF${n}`,
          event: `https://api.calendly.com/scheduled_events/EVF${n}`,
        },
      });
    }
    if (u.includes("/scheduled_events/EVF")) {
      return json({ resource: { location: { type: "zoom", join_url: "https://zoom.example/j/x" } } });
    }
    throw new Error(`unexpected ${method} ${u}`);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

function withToken<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CALENDLY_API_TOKEN;
  process.env.CALENDLY_API_TOKEN = "tok";
  return fn().finally(() => {
    if (prev === undefined) delete process.env.CALENDLY_API_TOKEN;
    else process.env.CALENDLY_API_TOKEN = prev;
  });
}

const DEPS = (fetchImpl: typeof fetch) => ({
  inviteeEmail: "a@test.local",
  inviteeName: "Member A",
  fetchImpl,
});

test("fan-out never books past the ledger: it stops the moment nothing remains", async () => {
  await withToken(async () => {
    // planned 6 was snapshotted, but the allowance shrank to anchor + 2
    // (a founder correction landed mid-flight). Only 2 more may be booked.
    const db = makeDb(3);
    const series = seedSeries(db, 6);
    seedAnchor(db);
    const { fetchImpl } = calendlyMock();

    const summary = await runSeriesFanout(fakeSupabase(db), series as any, DEPS(fetchImpl));

    assert.equal(summary.created, 2);
    assert.equal(summary.stoppedAtAllowance, true);
    const counting = db.session_bookings.filter((b) => b.counts_against_allowance);
    assert.equal(counting.length, 3, "anchor + 2 — never one past the allowance");
  });
});

test("a re-run is a no-op: every claimed occurrence is skipped and Calendly is not called again", async () => {
  await withToken(async () => {
    const db = makeDb();
    const series = seedSeries(db, 6);
    seedAnchor(db);
    const first = calendlyMock();
    await runSeriesFanout(fakeSupabase(db), series as any, DEPS(first.fetchImpl));
    assert.equal(db.session_bookings.length, 6);

    const second = calendlyMock();
    const summary = await runSeriesFanout(fakeSupabase(db), series as any, DEPS(second.fetchImpl));

    assert.equal(summary.created, 0);
    assert.equal(summary.skippedExisting, 6);
    assert.equal(second.calls.length, 0, "no Calendly traffic on a clean re-run");
    assert.equal(db.session_bookings.length, 6);
  });
});

test("a canceled week stays canceled: the re-run never silently rebooks it", async () => {
  await withToken(async () => {
    const db = makeDb();
    const series = seedSeries(db, 6);
    seedAnchor(db);
    const first = calendlyMock();
    await runSeriesFanout(fakeSupabase(db), series as any, DEPS(first.fetchImpl));

    const week3 = db.session_bookings.find((b) => b.scheduled_at === WEEKS[2])!;
    week3.status = "canceled";
    week3.counts_against_allowance = false;

    const second = calendlyMock();
    const summary = await runSeriesFanout(fakeSupabase(db), series as any, DEPS(second.fetchImpl));

    assert.equal(summary.created, 0);
    assert.equal(second.calls.length, 0);
    assert.equal(
      db.session_bookings.filter((b) => b.scheduled_at === WEEKS[2]).length,
      1,
      "the canceled row still claims its slot",
    );
  });
});

test("when the webhook echo wins the insert race, the fan-out claims the parked row for the series", async () => {
  await withToken(async () => {
    const db = makeDb();
    const series = seedSeries(db, 2);
    seedAnchor(db);
    // The echo of the fan-out's own API creation processed first: parked,
    // unauthorized, no series. The mock will mint exactly this invitee URI.
    db.session_bookings.push({
      id: "bk-echo",
      member_id: PROFILE,
      session_type: "coaching",
      calendly_invitee_uri: "https://api.calendly.com/scheduled_events/EVF1/invitees/INVF1",
      scheduled_at: WEEKS[1],
      status: "scheduled",
      counts_against_allowance: false,
      needs_review: true,
      series_id: null,
    });
    // The parked row has no series_id yet, so its instant is not claimed and
    // the fan-out attempts the week — hitting the unique index.
    const { fetchImpl } = calendlyMock();
    const summary = await runSeriesFanout(fakeSupabase(db), series as any, DEPS(fetchImpl));

    assert.equal(summary.created, 1);
    const claimed = db.session_bookings.find((b) => b.id === "bk-echo")!;
    assert.equal(claimed.series_id, "series-1");
    assert.equal(claimed.counts_against_allowance, true, "the fan-out is the authorization");
    assert.equal(claimed.needs_review, false);
    assert.equal(
      db.session_bookings.filter((b) => b.scheduled_at === WEEKS[1]).length,
      1,
      "one week, one row — never a duplicate",
    );
  });
});

test("an occurrence already in the past is recorded as needs_scheduling, not booked", async () => {
  await withToken(async () => {
    const db = makeDb();
    const series = seedSeries(db, 3);
    seedAnchor(db);
    const { fetchImpl, calls } = calendlyMock();
    // "Now" sits after week 2: the anchor row claims week 1, week 2 is
    // unbookable history, week 3 is bookable future.
    const now = () => new Date("2099-01-15T00:00:00.000Z");

    const summary = await runSeriesFanout(fakeSupabase(db), series as any, {
      ...DEPS(fetchImpl),
      now,
    });

    assert.equal(summary.created, 1);
    assert.equal(summary.needsScheduling, 1);
    const parked = db.session_bookings.find((b) => b.status === "needs_scheduling")!;
    assert.equal(parked.scheduled_at, WEEKS[1]);
    assert.equal(
      calls.filter((c) => c.method === "POST").length,
      1,
      "no booking attempt is made for a past slot",
    );
  });
});

test("without a token the fan-out reports itself unconfigured and touches nothing", async () => {
  const prev = process.env.CALENDLY_API_TOKEN;
  delete process.env.CALENDLY_API_TOKEN;
  try {
    const db = makeDb();
    const series = seedSeries(db, 6);
    seedAnchor(db);
    const { fetchImpl, calls } = calendlyMock();
    const summary = await runSeriesFanout(fakeSupabase(db), series as any, DEPS(fetchImpl));
    assert.deepEqual(summary, { ok: false, reason: "fanout_not_configured" });
    assert.equal(calls.length, 0);
    assert.equal(db.session_bookings.length, 1);
  } finally {
    if (prev === undefined) delete process.env.CALENDLY_API_TOKEN;
    else process.env.CALENDLY_API_TOKEN = prev;
  }
});

test("convertAnchorToSeries snapshots planned from the live ledger and defaults the timezone", async () => {
  await withToken(async () => {
    const db = makeDb(10);
    // 4 used + the anchor already recorded and counting → remaining 5.
    for (let i = 1; i <= 4; i++) {
      db.session_bookings.push({
        id: `used-${i}`,
        member_id: PROFILE,
        session_type: "coaching",
        calendly_invitee_uri: `inv-used-${i}`,
        status: "completed",
        counts_against_allowance: true,
        needs_review: false,
      });
    }
    db.session_bookings.push({
      id: "bk-anchor",
      member_id: PROFILE,
      session_type: "coaching",
      calendly_invitee_uri: "inv-anchor",
      scheduled_at: ANCHOR_ISO,
      status: "scheduled",
      counts_against_allowance: true,
      needs_review: false,
    });
    const { fetchImpl } = calendlyMock();

    const summary = await convertAnchorToSeries(fakeSupabase(db), {
      profileId: PROFILE,
      sessionType: "coaching",
      anchorBookingId: "bk-anchor",
      anchorStartTime: ANCHOR_ISO,
      inviteeTimezone: null,
      inviteeEmail: "a@test.local",
      inviteeName: "Member A",
      fetchImpl,
    });

    assert.equal(summary.planned, 6, "anchor + 5 remaining — the ledger decides, never a constant");
    assert.equal(db.session_series.length, 1);
    assert.equal(db.session_series[0].timezone, "Pacific/Honolulu");
    assert.equal(db.session_series[0].journey_id, "journey-1");
    assert.equal(
      db.session_bookings.find((b) => b.id === "bk-anchor")!.series_id,
      db.session_series[0].id,
    );
    assert.equal(summary.created, 5);
  });
});
