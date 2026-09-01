import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSessionEvent, processSessionWebhook } from "./webhook.ts";
import { computeSessionBalance, type SessionType } from "./balance.ts";

// ── in-memory fake of the exact supabase-js chains webhook.ts uses ──────────

type Row = Record<string, any>;
type Db = {
  members: Row[];
  calendly_event_mappings: Row[];
  session_bookings: Row[];
  session_booking_holds: Row[];
  webhook_receipts: Row[];
  session_series: Row[];
  journeys: Row[];
  member_session_allowances: Row[];
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
      wantRows: false,
    };
    const run = () => {
      if (state.op === "insert") {
        const row = { id: `row-${nextId++}`, ...state.inserted };
        if (
          table === "session_bookings" &&
          row.calendly_invitee_uri != null &&
          db.session_bookings.some(
            (b) => b.calendly_invitee_uri === row.calendly_invitee_uri,
          )
        ) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        // Mirrors session_series_active_member_type_key: one ACTIVE series
        // per member per session type, ever.
        if (
          table === "session_series" &&
          (row.status ?? "active") === "active" &&
          db.session_series.some(
            (s) =>
              s.member_id === row.member_id &&
              s.session_type === row.session_type &&
              s.status === "active",
          )
        ) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
        db[table].push(row);
        return { data: row, error: null };
      }
      let rows = db[table].filter((r) => state.filters.every((f) => f(r)));
      if (state.op === "update") {
        if (
          table === "webhook_receipts" &&
          state.patch?.idempotency_key != null &&
          db.webhook_receipts.some(
            (r) =>
              !rows.includes(r) &&
              r.idempotency_key === state.patch!.idempotency_key,
          )
        ) {
          return { data: null, error: { code: "23505", message: "duplicate key" } };
        }
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
      select: () => ((state.wantRows = true), chain),
      insert: (row: Row) => ((state.op = "insert"), (state.inserted = row), chain),
      update: (patch: Row) => ((state.op = "update"), (state.patch = patch), chain),
      eq: (col: string, v: any) => (state.filters.push((r) => r[col] === v), chain),
      neq: (col: string, v: any) => (state.filters.push((r) => r[col] !== v), chain),
      ilike: (col: string, v: string) =>
        (state.filters.push(
          (r) => String(r[col]).toLowerCase() === v.toLowerCase(),
        ),
        chain),
      is: (col: string, v: any) => (state.filters.push((r) => (r[col] ?? null) === v), chain),
      gt: (col: string, v: any) => (state.filters.push((r) => r[col] > v), chain),
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
          row
            ? { data: row, error: null }
            : { data: null, error: { code: "PGRST116", message: "no rows" } },
        );
      },
      then: (ok: any, err: any) => Promise.resolve(run()).then(ok, err),
    };
    return chain;
  };
  return { from: (table: keyof Db) => builder(table) } as never;
}

// ── fixtures ────────────────────────────────────────────────────────────────

const COACH_URI = "https://api.calendly.com/event_types/COACH";
const PNE_URI = "https://api.calendly.com/event_types/PNE";
const PROFILE_A = "profile-a";
const ALLOWANCES = [
  { session_type: "coaching", quantity: 10 },
  { session_type: "pne", quantity: 6 },
];

function makeDb(): Db {
  return {
    members: [
      { id: "member-a", email: "a@test.local", profile_id: PROFILE_A },
    ],
    calendly_event_mappings: [
      { calendly_event_type_uri: COACH_URI, session_type: "coaching", active: true },
      { calendly_event_type_uri: PNE_URI, session_type: "pne", active: true },
    ],
    session_bookings: [],
    session_booking_holds: [],
    webhook_receipts: [{ id: "receipt-1" }],
    session_series: [],
    journeys: [
      { id: "journey-1", member_id: PROFILE_A, status: "in_progress", created_at: "2026-08-01T00:00:00Z" },
    ],
    member_session_allowances: ALLOWANCES.map((a) => ({
      member_id: PROFILE_A,
      session_type: a.session_type,
      quantity: a.quantity,
    })),
  };
}

// An issued booking authorization (hold with its single-use link attached).
function activeHold(
  db: Db,
  id: string,
  sessionType = "coaching",
  createdAt = "2026-08-26T00:00:00Z",
  purpose = "single",
) {
  db.session_booking_holds.push({
    id,
    member_id: PROFILE_A,
    session_type: sessionType,
    consumed_at: null,
    expires_at: "2099-01-01T00:00:00Z",
    booking_url: `https://calendly.com/d/${id}`,
    created_at: createdAt,
    purpose,
  });
}

function created(opts: {
  inviteeUri: string;
  email?: string | null;
  typeUri?: string;
  oldInvitee?: string;
  startTime?: string;
  timezone?: string;
  joinUrl?: string | null;
}) {
  return {
    event: "invitee.created",
    payload: {
      uri: opts.inviteeUri,
      invitee: { email: opts.email ?? "a@test.local", name: "Member A" },
      old_invitee: opts.oldInvitee ?? null,
      timezone: opts.timezone ?? null,
      scheduled_event: {
        uri: "https://api.calendly.com/scheduled_events/EV1",
        event_type: opts.typeUri ?? COACH_URI,
        start_time: opts.startTime ?? "2026-09-01T10:00:00Z",
        ...(opts.joinUrl !== undefined
          ? { location: { type: "zoom", join_url: opts.joinUrl } }
          : {}),
      },
    },
  };
}

function canceled(opts: { inviteeUri: string; typeUri?: string }) {
  return {
    event: "invitee.canceled",
    payload: {
      uri: opts.inviteeUri,
      invitee: { email: "a@test.local", name: "Member A" },
      scheduled_event: {
        uri: "https://api.calendly.com/scheduled_events/EV1",
        event_type: opts.typeUri ?? COACH_URI,
      },
    },
  };
}

function remainingFor(db: Db, memberId: string, type: SessionType): number {
  const bookings = db.session_bookings
    .filter((b) => b.member_id === memberId)
    .map((b) => ({
      session_type: b.session_type,
      counts_against_allowance: b.counts_against_allowance,
    }));
  return computeSessionBalance(ALLOWANCES, bookings, type).remaining;
}

// ── acceptance: book / cancel / reschedule / duplicate / unknown ────────────

test("authorized booking → recorded, hold consumed, coaching 10 → 9", async () => {
  const db = makeDb();
  activeHold(db, "hold-1");
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-1" }),
    "receipt-1",
  );
  assert.equal(outcome.handled, true);
  assert.equal(db.session_bookings.length, 1);
  const b = db.session_bookings[0];
  assert.equal(b.member_id, PROFILE_A);
  assert.equal(b.session_type, "coaching");
  assert.equal(b.counts_against_allowance, true);
  assert.equal(b.needs_review, false);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);
  assert.notEqual(db.session_booking_holds[0].consumed_at, null);
  assert.equal(db.session_booking_holds[0].consumed_by_booking_id, b.id);
  assert.equal(db.webhook_receipts[0].processing_status, "processed");
});

test("authorized PNE booking → pne 6 → 5, coaching untouched at 10", async () => {
  const db = makeDb();
  activeHold(db, "hold-p1", "pne");
  await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-p1", typeUri: PNE_URI }),
    "receipt-1",
  );
  assert.equal(remainingFor(db, PROFILE_A, "pne"), 5);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);
});

test("direct Calendly booking with NO authorization → parked, balance untouched", async () => {
  // A matched email alone must never deduct: without a valid hold the
  // booking is recorded for founder review but cannot count.
  const db = makeDb();
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-direct" }),
    "receipt-1",
  );
  assert.equal(outcome.handled, true);
  assert.equal((outcome as any).response.needsReview, true);
  const b = db.session_bookings[0];
  assert.equal(b.member_id, PROFILE_A);
  assert.equal(b.counts_against_allowance, false);
  assert.equal(b.needs_review, true);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);
});

test("unauthorized booking cannot launder into counting via reschedule", async () => {
  // Direct Calendly booking with no Vital authorization → parked. The member
  // then reschedules it: the replacement must INHERIT needs_review, not gain
  // counting status from old_invitee's mere presence.
  const db = makeDb(); // no holds anywhere
  await processSessionWebhook(fakeSupabase(db), created({ inviteeUri: "inv-direct" }), "receipt-1");
  assert.equal(db.session_bookings[0].needs_review, true);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);

  db.webhook_receipts.push({ id: "receipt-2" });
  await processSessionWebhook(fakeSupabase(db), canceled({ inviteeUri: "inv-direct" }), "receipt-2");
  db.webhook_receipts.push({ id: "receipt-3" });
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-direct-2", oldInvitee: "inv-direct" }),
    "receipt-3",
  );

  assert.equal((outcome as any).response.needsReview, true);
  const replacement = db.session_bookings.find(
    (b) => b.calendly_invitee_uri === "inv-direct-2",
  )!;
  assert.equal(replacement.counts_against_allowance, false);
  assert.equal(replacement.needs_review, true);
  assert.equal(db.session_bookings.filter((b) => b.counts_against_allowance).length, 0);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);
});

test("reschedule whose previous booking is unknown fails closed — even with a hold available", async () => {
  const db = makeDb();
  activeHold(db, "hold-1");
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-new", oldInvitee: "inv-ghost" }),
    "receipt-1",
  );
  assert.equal((outcome as any).response.needsReview, true);
  const b = db.session_bookings[0];
  assert.equal(b.counts_against_allowance, false);
  assert.equal(b.needs_review, true);
  // The reschedule branch must not fall back to consuming a hold.
  assert.equal(db.session_booking_holds[0].consumed_at, null);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);
});

test("one entitlement produces exactly one counted booking", async () => {
  const db = makeDb();
  activeHold(db, "hold-1");
  await processSessionWebhook(fakeSupabase(db), created({ inviteeUri: "inv-1" }), "receipt-1");
  db.webhook_receipts.push({ id: "receipt-2" });
  await processSessionWebhook(fakeSupabase(db), created({ inviteeUri: "inv-2" }), "receipt-2");

  const counting = db.session_bookings.filter((b) => b.counts_against_allowance);
  const parked = db.session_bookings.filter((b) => b.needs_review);
  assert.equal(counting.length, 1);
  assert.equal(counting[0].calendly_invitee_uri, "inv-1");
  assert.equal(parked.length, 1);
  assert.equal(parked[0].calendly_invitee_uri, "inv-2");
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);
});

test("canceled → booking stops counting, the session returns", async () => {
  const db = makeDb();
  db.session_bookings.push({
    id: "bk-1",
    member_id: PROFILE_A,
    session_type: "coaching",
    calendly_invitee_uri: "inv-1",
    status: "scheduled",
    counts_against_allowance: true,
  });
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);

  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    canceled({ inviteeUri: "inv-1" }),
    "receipt-1",
  );
  assert.equal(outcome.handled, true);
  assert.equal(db.session_bookings[0].status, "canceled");
  assert.equal(db.session_bookings[0].counts_against_allowance, false);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);
});

test("reschedule (canceled + created with old_invitee) → net balance unchanged, hold untouched", async () => {
  const db = makeDb();
  db.session_bookings.push({
    id: "bk-1",
    member_id: PROFILE_A,
    session_type: "coaching",
    calendly_invitee_uri: "inv-old",
    status: "scheduled",
    counts_against_allowance: true,
    needs_review: false,
  });
  db.session_booking_holds.push({
    id: "hold-1",
    member_id: PROFILE_A,
    session_type: "coaching",
    consumed_at: null,
    expires_at: "2099-01-01T00:00:00Z",
    created_at: "2026-08-26T00:00:00Z",
  });
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);

  await processSessionWebhook(
    fakeSupabase(db),
    canceled({ inviteeUri: "inv-old" }),
    "receipt-1",
  );
  db.webhook_receipts.push({ id: "receipt-2" });
  await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-new", oldInvitee: "inv-old" }),
    "receipt-2",
  );

  const counting = db.session_bookings.filter((b) => b.counts_against_allowance);
  assert.equal(counting.length, 1);
  assert.equal(counting[0].calendly_invitee_uri, "inv-new");
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);
  // The reschedule must not eat an unrelated in-flight booking hold.
  assert.equal(db.session_booking_holds[0].consumed_at, null);
});

test("duplicate webhook (same receipt claim) → ignored, balance unchanged, hold consumed once", async () => {
  const db = makeDb();
  activeHold(db, "hold-1");
  await processSessionWebhook(fakeSupabase(db), created({ inviteeUri: "inv-1" }), "receipt-1");
  db.webhook_receipts.push({ id: "receipt-2" });
  const dup = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-1" }),
    "receipt-2",
  );
  assert.equal(dup.handled, true);
  assert.equal((dup as any).response.deduplicated, true);
  assert.equal(db.session_bookings.length, 1);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);
  assert.equal(db.session_booking_holds[0].consumed_by_booking_id, db.session_bookings[0].id);
});

test("duplicate webhook (no receipt, unique index backstop) → ignored", async () => {
  const db = makeDb();
  activeHold(db, "hold-1");
  await processSessionWebhook(fakeSupabase(db), created({ inviteeUri: "inv-1" }), "receipt-1");
  const dup = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-1" }),
    null,
  );
  assert.equal(dup.handled, true);
  assert.equal((dup as any).response.deduplicated, true);
  assert.equal(db.session_bookings.length, 1);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 9);
});

test("unknown email → needs_review, member null, zero balance impact", async () => {
  const db = makeDb();
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-x", email: "stranger@elsewhere.com" }),
    "receipt-1",
  );
  assert.equal(outcome.handled, true);
  assert.equal((outcome as any).response.needsReview, true);
  const b = db.session_bookings[0];
  assert.equal(b.member_id, null);
  assert.equal(b.needs_review, true);
  assert.equal(b.counts_against_allowance, false);
  assert.equal(remainingFor(db, PROFILE_A, "coaching"), 10);
});

test("fresh booking consumes the member's OLDEST active hold", async () => {
  const db = makeDb();
  db.session_booking_holds.push(
    {
      id: "hold-newer",
      member_id: PROFILE_A,
      session_type: "coaching",
      consumed_at: null,
      expires_at: "2099-01-01T00:00:00Z",
      created_at: "2026-08-26T00:10:00Z",
    },
    {
      id: "hold-older",
      member_id: PROFILE_A,
      session_type: "coaching",
      consumed_at: null,
      expires_at: "2099-01-01T00:00:00Z",
      created_at: "2026-08-26T00:00:00Z",
    },
  );
  await processSessionWebhook(fakeSupabase(db), created({ inviteeUri: "inv-1" }), "receipt-1");
  const older = db.session_booking_holds.find((h) => h.id === "hold-older")!;
  const newer = db.session_booking_holds.find((h) => h.id === "hold-newer")!;
  assert.notEqual(older.consumed_at, null);
  assert.equal(older.consumed_by_booking_id, db.session_bookings[0].id);
  assert.equal(newer.consumed_at, null);
});

test("cancel for a booking we never recorded → audited, nothing changes", async () => {
  const db = makeDb();
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    canceled({ inviteeUri: "inv-ghost" }),
    "receipt-1",
  );
  assert.equal(outcome.handled, true);
  assert.equal((outcome as any).response.recorded, "cancel_unmatched");
  assert.equal(db.session_bookings.length, 0);
});

test("unmapped event type → handled:false, database untouched", async () => {
  const db = makeDb();
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({
      inviteeUri: "inv-d",
      typeUri: "https://api.calendly.com/event_types/DISCOVERY",
    }),
    "receipt-1",
  );
  assert.deepEqual(outcome, { handled: false });
  assert.equal(db.session_bookings.length, 0);
});

test("non-invitee events → handled:false", async () => {
  const db = makeDb();
  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    { event: "routing_form_submission.created", payload: {} },
    "receipt-1",
  );
  assert.deepEqual(outcome, { handled: false });
});

// ── payload extraction variants ─────────────────────────────────────────────

test("extractSessionEvent falls back to payload.event_type when scheduled_event is absent", () => {
  const event = extractSessionEvent({
    event: "invitee.created",
    payload: {
      uri: "inv-1",
      email: "a@test.local",
      event: "https://api.calendly.com/scheduled_events/EV9",
      event_type: COACH_URI,
    },
  });
  assert.ok(event);
  assert.equal(event!.eventTypeUri, COACH_URI);
  assert.equal(event!.scheduledEventUri, "https://api.calendly.com/scheduled_events/EV9");
  assert.equal(event!.email, "a@test.local");
});

test("extractSessionEvent returns null for other event kinds", () => {
  assert.equal(extractSessionEvent({ event: "invitee_no_show.created", payload: {} }), null);
});

// ── recurring series: anchor conversion + weekly fan-out (V4 Build 2) ───────

// Far-future Tuesdays, 10:00 AM HST — no occurrence can be in the past.
const ANCHOR_ISO = "2099-01-05T20:00:00.000Z";
const SERIES_WEEKS = [
  "2099-01-05T20:00:00.000Z",
  "2099-01-12T20:00:00.000Z",
  "2099-01-19T20:00:00.000Z",
  "2099-01-26T20:00:00.000Z",
  "2099-02-02T20:00:00.000Z",
  "2099-02-09T20:00:00.000Z",
];

function withToken<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CALENDLY_API_TOKEN;
  process.env.CALENDLY_API_TOKEN = "tok-series";
  return fn().finally(() => {
    if (prev === undefined) delete process.env.CALENDLY_API_TOKEN;
    else process.env.CALENDLY_API_TOKEN = prev;
  });
}

// The exact Calendly surface the fan-out touches: availability lookups,
// invitee creation, event fetches for the Zoom join URL.
function calendlyMock(opts: { unavailable?: string[]; failCreate?: string[]; omitJoinUrl?: boolean } = {}) {
  const calls: { url: string; method: string; body?: any }[] = [];
  let n = 0;
  const epochOf = (iso: string) => new Date(iso).getTime();
  const fetchImpl = (async (url: any, init?: any) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url: u, method, body });
    const json = (payload: any) => ({ ok: true, status: 200, json: async () => payload });

    if (u.includes("/event_type_available_times")) {
      const params = new URL(u).searchParams;
      // availabilityWindow spans occurrence ± 1h, so the midpoint IS the slot.
      const occ = new Date(
        (epochOf(params.get("start_time")!) + epochOf(params.get("end_time")!)) / 2,
      ).toISOString();
      const closed = (opts.unavailable ?? []).some((s) => epochOf(s) === epochOf(occ));
      return json({ collection: closed ? [] : [{ status: "available", start_time: occ }] });
    }
    if (u.endsWith("/invitees") && method === "POST") {
      if ((opts.failCreate ?? []).some((s) => epochOf(s) === epochOf(body.start_time))) {
        return { ok: false, status: 500, json: async () => ({}) };
      }
      n++;
      return json({
        resource: {
          uri: `https://api.calendly.com/scheduled_events/EVF${n}/invitees/INVF${n}`,
          event: `https://api.calendly.com/scheduled_events/EVF${n}`,
        },
      });
    }
    if (u.includes("/scheduled_events/EVF")) {
      const id = u.split("/").pop();
      return json({
        resource: {
          location: opts.omitJoinUrl ? {} : { type: "zoom", join_url: `https://zoom.example/j/${id}` },
        },
      });
    }
    throw new Error(`calendlyMock: unexpected call ${method} ${u}`);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

// Four coaching sessions already used through preparation and ceremony: the
// member enters post-integration with 6 of the 10-session grant remaining.
function seedPreCeremonyUsage(db: Db) {
  for (let i = 1; i <= 4; i++) {
    db.session_bookings.push({
      id: `used-${i}`,
      member_id: PROFILE_A,
      session_type: "coaching",
      calendly_invitee_uri: `inv-used-${i}`,
      status: "completed",
      counts_against_allowance: true,
      needs_review: false,
    });
  }
}

function anchorEvent(inviteeUri = "inv-anchor") {
  return created({
    inviteeUri,
    startTime: ANCHOR_ISO,
    timezone: "Pacific/Honolulu",
    joinUrl: "https://zoom.example/j/anchor",
  });
}

test("verified series anchor → planned snapshots the ACTUAL remaining balance, weekly fan-out books the rest", async () => {
  await withToken(async () => {
    const db = makeDb();
    seedPreCeremonyUsage(db);
    activeHold(db, "hold-anchor", "coaching", "2026-08-26T00:00:00Z", "series_anchor");
    const { fetchImpl } = calendlyMock();

    const outcome = await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-1", {
      verified: true,
      fetchImpl,
    });

    const series = (outcome as any).response.series;
    assert.equal(series.ok, true);
    assert.equal(series.planned, 6, "10 granted − 4 used → anchor + 5 = 6, from the ledger, never hard-coded");
    assert.equal(series.created, 5);

    assert.equal(db.session_series.length, 1);
    const s = db.session_series[0];
    assert.equal(s.member_id, PROFILE_A);
    assert.equal(s.journey_id, "journey-1");
    assert.equal(s.first_session_at, ANCHOR_ISO);
    assert.equal(s.timezone, "Pacific/Honolulu");
    assert.equal(s.status, "active");

    const anchor = db.session_bookings.find((b) => b.calendly_invitee_uri === "inv-anchor")!;
    assert.equal(anchor.series_id, s.id);
    assert.equal(anchor.meeting_url, "https://zoom.example/j/anchor");

    const fanout = db.session_bookings.filter(
      (b) => b.series_id === s.id && b.calendly_invitee_uri !== "inv-anchor",
    );
    assert.equal(fanout.length, 5);
    assert.deepEqual(
      fanout.map((b) => b.scheduled_at).sort(),
      SERIES_WEEKS.slice(1),
      "occurrences land on the same wall-clock time each following week",
    );
    for (const b of fanout) {
      assert.equal(b.counts_against_allowance, true);
      assert.equal(b.needs_review, false);
      assert.equal(b.status, "scheduled");
      assert.match(b.meeting_url, /^https:\/\/zoom\.example\/j\//);
    }
    assert.equal(remainingFor(db, PROFILE_A, "coaching"), 0, "the whole allowance is now committed");
  });
});

test("an UNVERIFIED delivery records the booking but can never create a series", async () => {
  await withToken(async () => {
    const db = makeDb();
    seedPreCeremonyUsage(db);
    activeHold(db, "hold-anchor", "coaching", "2026-08-26T00:00:00Z", "series_anchor");
    const { fetchImpl, calls } = calendlyMock();

    const outcome = await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-1", {
      fetchImpl, // verified deliberately absent → fail closed
    });

    assert.equal((outcome as any).response.series.reason, "series_requires_verified_signature");
    assert.equal(db.session_series.length, 0);
    assert.equal(calls.length, 0, "no Calendly call may be made for an unverified payload");
    // The ordinary booking contract is untouched: recorded and counted.
    const anchor = db.session_bookings.find((b) => b.calendly_invitee_uri === "inv-anchor")!;
    assert.equal(anchor.counts_against_allowance, true);
    assert.equal(remainingFor(db, PROFILE_A, "coaching"), 5);
  });
});

test("a replayed anchor webhook never creates a duplicate series or duplicate weekly bookings", async () => {
  await withToken(async () => {
    const db = makeDb();
    seedPreCeremonyUsage(db);
    activeHold(db, "hold-anchor", "coaching", "2026-08-26T00:00:00Z", "series_anchor");
    const mock = calendlyMock();
    await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-1", {
      verified: true,
      fetchImpl: mock.fetchImpl,
    });
    const bookingsAfterFirst = db.session_bookings.length;
    const callsAfterFirst = mock.calls.length;

    db.webhook_receipts.push({ id: "receipt-2" });
    const replay = await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-2", {
      verified: true,
      fetchImpl: mock.fetchImpl,
    });

    assert.equal((replay as any).response.deduplicated, true);
    assert.equal(db.session_series.length, 1);
    assert.equal(db.session_bookings.length, bookingsAfterFirst);
    assert.equal(mock.calls.length, callsAfterFirst, "a replay makes no Calendly calls");
  });
});

test("a second anchor while a series is active resumes the EXISTING series — never a second one", async () => {
  await withToken(async () => {
    const db = makeDb();
    seedPreCeremonyUsage(db);
    activeHold(db, "hold-anchor", "coaching", "2026-08-26T00:00:00Z", "series_anchor");
    const mock = calendlyMock();
    await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-1", {
      verified: true,
      fetchImpl: mock.fetchImpl,
    });
    const firstSeriesId = db.session_series[0].id;

    // A founder grants one more session; the member somehow books a second
    // anchor. The active series absorbs it instead of restarting anything.
    db.member_session_allowances.push({ member_id: PROFILE_A, session_type: "coaching", quantity: 1 });
    activeHold(db, "hold-anchor-2", "coaching", "2026-08-27T00:00:00Z", "series_anchor");
    db.webhook_receipts.push({ id: "receipt-2" });
    const second = await processSessionWebhook(
      fakeSupabase(db),
      created({ inviteeUri: "inv-anchor-2", startTime: "2099-03-02T20:00:00.000Z", timezone: "Pacific/Honolulu" }),
      "receipt-2",
      { verified: true, fetchImpl: mock.fetchImpl },
    );

    assert.equal(db.session_series.length, 1, "the active-series unique index holds");
    assert.equal((second as any).response.series.seriesId, firstSeriesId);
    assert.equal((second as any).response.series.created, 0, "every existing occurrence is already claimed");
    assert.equal(db.session_series[0].first_session_at, ANCHOR_ISO, "the rhythm never shifts");
  });
});

test("one unavailable week parks ONLY that occurrence as needs_scheduling", async () => {
  await withToken(async () => {
    const db = makeDb();
    seedPreCeremonyUsage(db);
    activeHold(db, "hold-anchor", "coaching", "2026-08-26T00:00:00Z", "series_anchor");
    const { fetchImpl } = calendlyMock({ unavailable: [SERIES_WEEKS[2]] });

    const outcome = await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-1", {
      verified: true,
      fetchImpl,
    });

    assert.equal((outcome as any).response.series.created, 4);
    assert.equal((outcome as any).response.series.needsScheduling, 1);
    const parked = db.session_bookings.filter((b) => b.status === "needs_scheduling");
    assert.equal(parked.length, 1);
    assert.equal(parked[0].scheduled_at, SERIES_WEEKS[2]);
    assert.equal(parked[0].counts_against_allowance, false, "an unbooked week never touches the balance");
    const scheduled = db.session_bookings.filter(
      (b) => b.series_id != null && b.status === "scheduled" && b.calendly_invitee_uri !== "inv-anchor",
    );
    assert.deepEqual(
      scheduled.map((b) => b.scheduled_at).sort(),
      [SERIES_WEEKS[1], SERIES_WEEKS[3], SERIES_WEEKS[4], SERIES_WEEKS[5]],
      "the other valid weeks are preserved",
    );
  });
});

test("a Calendly failure on one creation never takes down the rest of the series", async () => {
  await withToken(async () => {
    const db = makeDb();
    seedPreCeremonyUsage(db);
    activeHold(db, "hold-anchor", "coaching", "2026-08-26T00:00:00Z", "series_anchor");
    const { fetchImpl } = calendlyMock({ failCreate: [SERIES_WEEKS[3]] });

    const outcome = await processSessionWebhook(fakeSupabase(db), anchorEvent(), "receipt-1", {
      verified: true,
      fetchImpl,
    });

    assert.equal((outcome as any).response.series.created, 4);
    const parked = db.session_bookings.filter((b) => b.status === "needs_scheduling");
    assert.equal(parked.length, 1);
    assert.equal(parked[0].scheduled_at, SERIES_WEEKS[3]);
  });
});

test("a duplicate delivery backfills meeting_url onto a row still missing one", async () => {
  const db = makeDb();
  db.session_bookings.push({
    id: "bk-echo",
    member_id: PROFILE_A,
    session_type: "coaching",
    calendly_invitee_uri: "inv-late-zoom",
    status: "scheduled",
    counts_against_allowance: true,
    needs_review: false,
    meeting_url: null,
  });

  const outcome = await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-late-zoom", joinUrl: "https://zoom.example/j/late" }),
    null,
  );

  assert.equal((outcome as any).response.deduplicated, true);
  assert.equal(db.session_bookings[0].meeting_url, "https://zoom.example/j/late");
});

test("a duplicate delivery never OVERWRITES an existing meeting_url", async () => {
  const db = makeDb();
  db.session_bookings.push({
    id: "bk-set",
    member_id: PROFILE_A,
    session_type: "coaching",
    calendly_invitee_uri: "inv-has-zoom",
    status: "scheduled",
    counts_against_allowance: true,
    needs_review: false,
    meeting_url: "https://zoom.example/j/original",
  });
  await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-has-zoom", joinUrl: "https://zoom.example/j/other" }),
    null,
  );
  assert.equal(db.session_bookings[0].meeting_url, "https://zoom.example/j/original");
});

test("rescheduling one series occurrence keeps its series_id — only that occurrence moves", async () => {
  const db = makeDb();
  db.session_series.push({
    id: "series-1",
    member_id: PROFILE_A,
    session_type: "coaching",
    first_session_at: ANCHOR_ISO,
    timezone: "Pacific/Honolulu",
    planned_sessions: 6,
    status: "active",
  });
  db.session_bookings.push({
    id: "bk-occ",
    member_id: PROFILE_A,
    session_type: "coaching",
    calendly_invitee_uri: "inv-occ",
    scheduled_at: SERIES_WEEKS[2],
    status: "scheduled",
    counts_against_allowance: true,
    needs_review: false,
    series_id: "series-1",
  });

  await processSessionWebhook(fakeSupabase(db), canceled({ inviteeUri: "inv-occ" }), "receipt-1");
  db.webhook_receipts.push({ id: "receipt-2" });
  await processSessionWebhook(
    fakeSupabase(db),
    created({ inviteeUri: "inv-occ-moved", oldInvitee: "inv-occ", startTime: "2099-01-20T20:00:00.000Z" }),
    "receipt-2",
  );

  const moved = db.session_bookings.find((b) => b.calendly_invitee_uri === "inv-occ-moved")!;
  assert.equal(moved.series_id, "series-1");
  assert.equal(moved.counts_against_allowance, true);
  assert.equal(db.session_series[0].first_session_at, ANCHOR_ISO, "the series anchor never shifts");
});

test("canceling one occurrence preserves its history and leaves the rest of the series intact", async () => {
  const db = makeDb();
  db.session_series.push({
    id: "series-1",
    member_id: PROFILE_A,
    session_type: "coaching",
    first_session_at: ANCHOR_ISO,
    timezone: "Pacific/Honolulu",
    planned_sessions: 6,
    status: "active",
  });
  for (let i = 1; i <= 3; i++) {
    db.session_bookings.push({
      id: `bk-${i}`,
      member_id: PROFILE_A,
      session_type: "coaching",
      calendly_invitee_uri: `inv-${i}`,
      scheduled_at: SERIES_WEEKS[i],
      status: "scheduled",
      counts_against_allowance: true,
      needs_review: false,
      series_id: "series-1",
    });
  }

  await processSessionWebhook(fakeSupabase(db), canceled({ inviteeUri: "inv-2" }), "receipt-1");

  const canceledRow = db.session_bookings.find((b) => b.calendly_invitee_uri === "inv-2")!;
  assert.equal(canceledRow.status, "canceled");
  assert.equal(canceledRow.series_id, "series-1", "history stays attached to its series");
  assert.equal(db.session_series[0].status, "active");
  const untouched = db.session_bookings.filter((b) => b.status === "scheduled");
  assert.equal(untouched.length, 2);
});
