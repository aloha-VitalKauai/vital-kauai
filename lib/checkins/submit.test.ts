import { test } from "node:test";
import assert from "node:assert/strict";
import { submitCheckin } from "./submit.ts";

// ── stateful fake for the exact chains submit.ts uses ───────────────────────

type CheckinRow = {
  id: string;
  member_id: string;
  week_number: number;
  status: string;
  questions_snapshot: unknown;
  responses: Record<string, unknown>;
  submitted_at: string | null;
};

const SNAPSHOT = [
  { key: "overall", type: "scale", label: "How has this week been overall?", min: 1, max: 5, required: true },
  { key: "body", type: "scale", label: "How is your body feeling?", min: 1, max: 5, required: true },
  { key: "notes", type: "text", label: "Anything you would like your care team to know?", required: false },
];

type FakeState = {
  rows: CheckinRow[];
  readError: boolean;
  writeError: boolean;
  /** Runs between the ownership read and the guarded update — the race window. */
  beforeUpdate?: () => void;
};

type QueryOutcome = { data: unknown; error: { message: string } | null };

type Chain = {
  select: (columns?: string) => Chain;
  update: (patch: Partial<CheckinRow>) => Chain;
  eq: (col: keyof CheckinRow, v: unknown) => Chain;
  neq: (col: keyof CheckinRow, v: unknown) => Chain;
  maybeSingle: () => Promise<QueryOutcome>;
  then: (resolve: (v: QueryOutcome) => void) => void;
};

function fakeSupabase(state: FakeState) {
  const builder = (): Chain => {
    const s = {
      op: "select" as "select" | "update",
      patch: null as Partial<CheckinRow> | null,
      filters: [] as ((r: CheckinRow) => boolean)[],
    };
    const rows = () => state.rows.filter((r) => s.filters.every((f) => f(r)));
    const chain: Chain = {
      select: () => chain,
      update: (patch) => ((s.op = "update"), (s.patch = patch), chain),
      eq: (col, v) => (s.filters.push((r) => r[col] === v), chain),
      neq: (col, v) => (s.filters.push((r) => r[col] !== v), chain),
      maybeSingle: async () => {
        if (state.readError) return { data: null, error: { message: "read failed" } };
        const found = rows();
        return { data: found[0] ?? null, error: null };
      },
      then: (resolve) => {
        // Awaiting the chain without maybeSingle() executes the update.
        if (s.op === "update") {
          state.beforeUpdate?.();
          if (state.writeError) return resolve({ data: null, error: { message: "write failed" } });
          const matched = rows();
          matched.forEach((r) => Object.assign(r, s.patch));
          return resolve({ data: matched, error: null });
        }
        return resolve({ data: rows(), error: null });
      },
    };
    return chain;
  };
  return {
    from: (table: string) => (assert.equal(table, "member_checkins"), builder()),
  } as never;
}

function week1Row(): CheckinRow {
  return {
    id: "checkin-1",
    member_id: "member-a",
    week_number: 1,
    status: "sent",
    questions_snapshot: SNAPSHOT,
    responses: {},
    submitted_at: null,
  };
}

const GOOD_ANSWERS = { overall: 4, body: 3, notes: "steadier this week" };

test("the owner submits valid answers: stored, status submitted, submitted_at set", async () => {
  const state: FakeState = { rows: [week1Row()], readError: false, writeError: false };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: GOOD_ANSWERS,
  });
  assert.ok(result.ok);
  const row = state.rows[0];
  assert.equal(row.status, "submitted");
  assert.deepEqual(row.responses, GOOD_ANSWERS);
  assert.ok(row.submitted_at, "submitted_at is populated");
  if (result.ok) {
    assert.equal(result.checkin.week_number, 1);
    assert.equal(result.checkin.submitted_at, row.submitted_at);
  }
});

test("another member's submit answers exactly like a missing check-in", async () => {
  const state: FakeState = { rows: [week1Row()], readError: false, writeError: false };
  const asIntruder = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-b",
    answers: GOOD_ANSWERS,
  });
  const asNobody = await submitCheckin(fakeSupabase(state), {
    checkinId: "no-such-row",
    memberId: "member-b",
    answers: GOOD_ANSWERS,
  });
  assert.deepEqual(asIntruder, { ok: false, reason: "not_found" });
  assert.deepEqual(asNobody, { ok: false, reason: "not_found" });
  assert.equal(state.rows[0].status, "sent", "the row is untouched");
  assert.deepEqual(state.rows[0].responses, {}, "no answer text leaked in");
});

test("an already-submitted check-in is never overwritten", async () => {
  const row = week1Row();
  row.status = "submitted";
  row.submitted_at = "2026-08-25T10:00:00.000Z";
  row.responses = { overall: 5, body: 5, notes: "the original words" };
  const state: FakeState = { rows: [row], readError: false, writeError: false };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: { overall: 1, body: 1, notes: "overwrite attempt" },
  });
  assert.deepEqual(result, { ok: false, reason: "already_submitted" });
  assert.deepEqual(state.rows[0].responses, { overall: 5, body: 5, notes: "the original words" });
  assert.equal(state.rows[0].submitted_at, "2026-08-25T10:00:00.000Z");
});

test("a concurrent submit that wins the race is reported as already_submitted", async () => {
  const state: FakeState = { rows: [week1Row()], readError: false, writeError: false };
  state.beforeUpdate = () => {
    // Another tab submits between our read and our guarded update.
    state.rows[0].status = "submitted";
    state.rows[0].responses = { overall: 2, body: 2 };
    state.beforeUpdate = undefined;
  };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: GOOD_ANSWERS,
  });
  assert.deepEqual(result, { ok: false, reason: "already_submitted" });
  assert.deepEqual(state.rows[0].responses, { overall: 2, body: 2 }, "the winner's answers stand");
});

test("invalid answers are rejected against the stored snapshot and nothing is written", async () => {
  const state: FakeState = { rows: [week1Row()], readError: false, writeError: false };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: { overall: 9, body: 3 },
  });
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.reason, "invalid_responses");
    if (result.reason === "invalid_responses") {
      assert.match(result.errors[0], /between 1 and 5/);
    }
  }
  assert.equal(state.rows[0].status, "sent");
});

test("unknown keys are stripped before storage", async () => {
  const state: FakeState = { rows: [week1Row()], readError: false, writeError: false };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: { ...GOOD_ANSWERS, is_founder: true, "; drop table": "x" },
  });
  assert.ok(result.ok);
  assert.deepEqual(state.rows[0].responses, GOOD_ANSWERS);
});

test("a failed read reports write_failed, never not_found", async () => {
  const state: FakeState = { rows: [week1Row()], readError: true, writeError: false };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: GOOD_ANSWERS,
  });
  assert.deepEqual(result, { ok: false, reason: "write_failed" });
});

test("a failed update reports write_failed and the row keeps its state", async () => {
  const state: FakeState = { rows: [week1Row()], readError: false, writeError: true };
  const result = await submitCheckin(fakeSupabase(state), {
    checkinId: "checkin-1",
    memberId: "member-a",
    answers: GOOD_ANSWERS,
  });
  assert.deepEqual(result, { ok: false, reason: "write_failed" });
  assert.equal(state.rows[0].status, "sent");
});
