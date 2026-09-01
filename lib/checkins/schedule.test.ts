import { test } from "node:test";
import assert from "node:assert/strict";
import {
  currentCheckinWeek,
  weekDueAt,
  checkinSmsMessage,
  runCheckinScheduler,
  type SmsSender,
} from "./schedule.ts";

// ── week math ───────────────────────────────────────────────────────────────

const START = "2026-06-01T18:00:00Z";
const day = (n: number) => new Date(Date.parse("2026-06-01T00:00:00Z") + n * 86400000);

test("current week: nothing is due during the journey's first week", () => {
  assert.equal(currentCheckinWeek(START, day(-3)), null);
  assert.equal(currentCheckinWeek(START, day(0)), null);
  assert.equal(currentCheckinWeek(START, day(6)), null);
});

test("current week: week N is due from day 7N through day 7N+6", () => {
  assert.equal(currentCheckinWeek(START, day(7)), 1);
  assert.equal(currentCheckinWeek(START, day(13)), 1);
  assert.equal(currentCheckinWeek(START, day(14)), 2);
  assert.equal(currentCheckinWeek(START, day(91)), 13);
  assert.equal(currentCheckinWeek(START, day(97)), 13);
});

test("current week: weeks outside 1-13 are ignored", () => {
  assert.equal(currentCheckinWeek(START, day(98)), null, "week 14 never exists");
  assert.equal(currentCheckinWeek(START, day(400)), null);
});

test("current week: missing or malformed start dates yield nothing", () => {
  assert.equal(currentCheckinWeek(null, day(20)), null);
  assert.equal(currentCheckinWeek(undefined, day(20)), null);
  assert.equal(currentCheckinWeek("not-a-date", day(20)), null);
});

test("SMS copy carries the first name and the link", () => {
  assert.equal(
    checkinSmsMessage("Kai Mahelona", "https://vitalkauai.com/portal/checkin"),
    "Aloha Kai — your Vital Kauaʻi weekly check-in is ready. It takes about a minute: https://vitalkauai.com/portal/checkin",
  );
  assert.match(checkinSmsMessage(null, "L"), /^Aloha — your/);
});

// ── stateful fake for the exact chains schedule.ts uses ─────────────────────

type Row = Record<string, unknown>;
type Tables = {
  journeys: Row[];
  member_checkins: Row[];
  checkin_templates: Row[];
  member_profiles: Row[];
  members: Row[];
};
type FakeState = { tables: Tables; failInsertWith?: { code: string; message: string } };

function fakeSupabase(state: FakeState) {
  let nextId = 1;
  const builder = (table: keyof Tables) => {
    const s = {
      op: "select" as "select" | "insert" | "update",
      payload: null as Row | null,
      filters: [] as ((r: Row) => boolean)[],
    };
    const rows = () => state.tables[table].filter((r) => s.filters.every((f) => f(r)));
    const outcome = () => {
      if (s.op === "insert") {
        if (state.failInsertWith) return { data: null, error: state.failInsertWith };
        state.tables[table].push({ id: `${table}-${nextId++}`, sent_at: null, ...s.payload });
        return { data: null, error: null };
      }
      if (s.op === "update") {
        rows().forEach((r) => Object.assign(r, s.payload));
        return { data: null, error: null };
      }
      return { data: rows(), error: null };
    };
    const chain = {
      select: () => chain,
      insert: (payload: Row) => ((s.op = "insert"), (s.payload = payload), chain),
      update: (payload: Row) => ((s.op = "update"), (s.payload = payload), chain),
      eq: (col: string, v: unknown) => (s.filters.push((r) => r[col] === v), chain),
      in: (col: string, vs: unknown[]) => (s.filters.push((r) => vs.includes(r[col])), chain),
      not: (col: string, _op: string, v: unknown) =>
        (s.filters.push((r) => r[col] !== v), chain),
      is: (col: string, v: unknown) => (s.filters.push((r) => r[col] === v), chain),
      lte: (col: string, v: string) =>
        (s.filters.push((r) => typeof r[col] === "string" && (r[col] as string) <= v), chain),
      maybeSingle: async () => {
        const found = rows();
        return { data: found[0] ?? null, error: null };
      },
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => resolve(outcome()),
    };
    return chain;
  };
  return { from: (table: string) => builder(table as keyof Tables) } as never;
}

const QUESTIONS = [{ key: "overall", type: "scale", label: "How was it?", min: 1, max: 5, required: true }];

function baseState(): FakeState {
  return {
    tables: {
      journeys: [
        { id: "j-1", member_id: "m-1", start_at: START, status: "in_progress" },
      ],
      checkin_templates: [
        { id: "t-2", week_number: 2, questions: QUESTIONS, active: true },
        { id: "t-2-old", week_number: 2, questions: [], active: false },
      ],
      member_checkins: [],
      member_profiles: [{ id: "m-1", full_name: "Kai Mahelona", phone: null }],
      members: [{ profile_id: "m-1", full_name: "Kai Mahelona", phone: "+18085551234" }],
    },
  };
}

function recordingSms(log: Array<{ to: string; message: string }>, ok = true): SmsSender {
  return async ({ to, message }) => {
    log.push({ to, message });
    return ok ? { ok: true } : { ok: false, error: "twilio down" };
  };
}

const OPTS = { siteUrl: "https://vitalkauai.com/", now: day(14) };

test("a due journey gets exactly one row: right week, active template snapshotted, scheduled_at set", async () => {
  const state = baseState();
  const sms: Array<{ to: string; message: string }> = [];
  const report = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(sms) });

  assert.equal(report.created, 1);
  const row = state.tables.member_checkins[0];
  assert.equal(row.week_number, 2, "day 14 is week 2");
  assert.equal(row.member_id, "m-1");
  assert.equal(row.journey_id, "j-1");
  assert.equal(row.template_id, "t-2", "the ACTIVE template is selected");
  assert.deepEqual(row.questions_snapshot, QUESTIONS, "questions are snapshotted at creation");
  assert.equal(row.scheduled_at, weekDueAt(START, 2));
  assert.equal(row.status, "sent", "marked sent after the successful SMS");
  assert.ok(row.sent_at, "sent_at set after the successful send");
  assert.equal(sms.length, 1);
  assert.equal(sms[0].to, "+18085551234", "members.phone is the texting number");
  assert.match(sms[0].message, /^Aloha Kai — /);
  assert.match(sms[0].message, /https:\/\/vitalkauai\.com\/portal\/checkin$/);
});

test("re-running creates no duplicate row and sends no second SMS", async () => {
  const state = baseState();
  const sms: Array<{ to: string; message: string }> = [];
  await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(sms) });
  const report2 = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(sms) });

  assert.equal(state.tables.member_checkins.length, 1);
  assert.equal(report2.created, 0);
  assert.equal(report2.alreadyCreated, 1);
  assert.equal(report2.smsSent, 0);
  assert.equal(sms.length, 1, "one SMS total across both runs");
});

test("a failed send leaves the row scheduled with sent_at null, and the next run retries", async () => {
  const state = baseState();
  const failed: Array<{ to: string; message: string }> = [];
  const r1 = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(failed, false) });
  assert.equal(r1.smsFailed, 1);
  const row = state.tables.member_checkins[0];
  assert.equal(row.status, "scheduled");
  assert.equal(row.sent_at, null, "a failed send never sets sent_at");

  const ok: Array<{ to: string; message: string }> = [];
  const r2 = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(ok) });
  assert.equal(r2.smsSent, 1, "the retry sends");
  assert.equal(ok.length, 1);
  assert.equal(row.status, "sent");
  assert.ok(row.sent_at);
});

test("journeys before week 1 or past week 13 produce nothing", async () => {
  const state = baseState();
  state.tables.journeys = [
    { id: "j-early", member_id: "m-1", start_at: START, status: "in_progress" },
  ];
  const sms: Array<{ to: string; message: string }> = [];
  const early = await runCheckinScheduler(fakeSupabase(state), { siteUrl: "https://x", now: day(3), sendSms: recordingSms(sms) });
  assert.equal(early.journeys, 0);
  const late = await runCheckinScheduler(fakeSupabase(state), { siteUrl: "https://x", now: day(120), sendSms: recordingSms(sms) });
  assert.equal(late.journeys, 0);
  assert.equal(state.tables.member_checkins.length, 0);
  assert.equal(sms.length, 0);
});

test("a week with no active template is skipped and reported, not invented", async () => {
  const state = baseState();
  state.tables.checkin_templates = state.tables.checkin_templates.map((t) => ({ ...t, active: false }));
  const report = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms([]) });
  assert.equal(report.noTemplate, 1);
  assert.equal(state.tables.member_checkins.length, 0);
});

test("a member with no phone anywhere keeps the row but sends nothing", async () => {
  const state = baseState();
  state.tables.members = [];
  const sms: Array<{ to: string; message: string }> = [];
  const report = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(sms) });
  assert.equal(report.created, 1);
  assert.equal(report.noPhone, 1);
  assert.equal(sms.length, 0);
  assert.equal(state.tables.member_checkins[0].status, "scheduled", "still eligible once a phone exists");
});

test("member_profiles.phone is the fallback when the operational record has none", async () => {
  const state = baseState();
  state.tables.members = [{ profile_id: "m-1", full_name: "Kai Mahelona", phone: null }];
  state.tables.member_profiles = [{ id: "m-1", full_name: "Kai Mahelona", phone: "+18085550000" }];
  const sms: Array<{ to: string; message: string }> = [];
  await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(sms) });
  assert.equal(sms[0].to, "+18085550000");
});

test("a submitted check-in is never touched or re-sent", async () => {
  const state = baseState();
  state.tables.member_checkins = [
    {
      id: "c-2", member_id: "m-1", journey_id: "j-1", week_number: 2,
      status: "submitted", sent_at: "2026-06-15T00:00:00.000Z",
      submitted_at: "2026-06-15T01:00:00.000Z",
      responses: { overall: 4 }, scheduled_at: weekDueAt(START, 2),
    },
  ];
  const sms: Array<{ to: string; message: string }> = [];
  const report = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms(sms) });
  assert.equal(report.alreadyCreated, 1, "the existing week-2 row blocks re-creation");
  assert.equal(sms.length, 0);
  assert.deepEqual(state.tables.member_checkins[0].responses, { overall: 4 });
  assert.equal(state.tables.member_checkins[0].status, "submitted");
});

test("a concurrent insert losing to the unique key is absorbed as already-created", async () => {
  const state = baseState();
  state.failInsertWith = { code: "23505", message: "duplicate key" };
  const report = await runCheckinScheduler(fakeSupabase(state), { ...OPTS, sendSms: recordingSms([]) });
  assert.equal(report.created, 0);
  assert.equal(report.alreadyCreated, 1);
});
