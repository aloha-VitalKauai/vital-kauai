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
      ilike: (col: string, v: string) =>
        (state.filters.push(
          (r) => String(r[col]).toLowerCase() === v.toLowerCase(),
        ),
        chain),
      is: (col: string, v: any) => (state.filters.push((r) => r[col] === v), chain),
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
  };
}

// An issued booking authorization (hold with its single-use link attached).
function activeHold(db: Db, id: string, sessionType = "coaching", createdAt = "2026-08-26T00:00:00Z") {
  db.session_booking_holds.push({
    id,
    member_id: PROFILE_A,
    session_type: sessionType,
    consumed_at: null,
    expires_at: "2099-01-01T00:00:00Z",
    booking_url: `https://calendly.com/d/${id}`,
    created_at: createdAt,
  });
}

function created(opts: {
  inviteeUri: string;
  email?: string | null;
  typeUri?: string;
  oldInvitee?: string;
}) {
  return {
    event: "invitee.created",
    payload: {
      uri: opts.inviteeUri,
      invitee: { email: opts.email ?? "a@test.local", name: "Member A" },
      old_invitee: opts.oldInvitee ?? null,
      scheduled_event: {
        uri: "https://api.calendly.com/scheduled_events/EV1",
        event_type: opts.typeUri ?? COACH_URI,
        start_time: "2026-09-01T10:00:00Z",
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
