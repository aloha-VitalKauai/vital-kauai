/**
 * PR 3B — run orchestration tests (acceptance 1, 2, 11, 15, 17, 18, 18b, 18d, 18i).
 *
 * Driven by an in-memory FinanceDb and StripeSource, so the control flow is
 * exercised without Stripe or Postgres. The database's own refusals are modelled
 * by having the fake throw exactly where the real functions raise.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  executeReconciliationRun,
  sampleFindings,
  type FinanceDb,
  type StripeSource,
} from "./run.ts";
import { ReconciliationFatal } from "./paginate.ts";
import type { ProviderPayment, PlannedException } from "./diff.ts";

const AGREEMENT = "22222222-2222-2222-2222-222222222222";
const NOW = new Date("2026-08-20T12:00:00Z");

type Calls = {
  started: unknown[];
  advanced: unknown[];
  finished: unknown[];
  reports: unknown[];
  exceptions: unknown[];
  entries: unknown[];
};

function fakeDb(over: Partial<FinanceDb> = {}): { db: FinanceDb; calls: Calls } {
  const calls: Calls = {
    started: [],
    advanced: [],
    finished: [],
    reports: [],
    exceptions: [],
    entries: [],
  };
  const db: FinanceDb = {
    async startRun(a) {
      calls.started.push(a);
      return "run_1";
    },
    async advanceRun(a) {
      calls.advanced.push(a);
    },
    async finishRun(a) {
      calls.finished.push(a);
    },
    async recordDryRunReport(a) {
      calls.reports.push(a);
    },
    async raiseException(a) {
      calls.exceptions.push(a);
      return "exc_1";
    },
    async writeLedgerEntry(a) {
      calls.entries.push(a);
    },
    async lastCompletedWindowEnd() {
      return null;
    },
    async earliestLedgerOccurredAt() {
      return null;
    },
    async ledgerForWindow() {
      return [];
    },
    async quarantinedObjectIds() {
      return new Set<string>();
    },
    ...over,
  };
  return { db, calls };
}

function payment(o: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    objectId: "ch_1",
    paymentIntentId: "pi_1",
    status: "succeeded",
    amountCents: 5000,
    currency: "usd",
    livemode: true,
    metadata: { financial_version: "v2", agreement_id: AGREEMENT },
    ...o,
  };
}

function fakeSource(payments: ProviderPayment[] = [], over: Partial<StripeSource> = {}): StripeSource {
  return {
    async listPayments() {
      return { payments, apiCalls: 2, retries: 0 };
    },
    async listRefunds() {
      return { refunds: [], apiCalls: 1, retries: 0 };
    },
    ...over,
  };
}

const base = {
  livemode: true,
  implementationVersion: "build-abc",
  now: NOW,
} as const;

// ── Ordering and lifecycle ───────────────────────────────────────────────────

test("the run row is created before any Stripe call", async () => {
  // A crash mid-enumeration must leave a `running` row the sweeper can abandon
  // (A5). Creating it afterwards would make the work invisible.
  const order: string[] = [];
  const { db } = fakeDb({
    async startRun() {
      order.push("start");
      return "run_1";
    },
  });
  const source = fakeSource([], {
    async listPayments() {
      order.push("stripe");
      return { payments: [], apiCalls: 1, retries: 0 };
    },
  });
  await executeReconciliationRun({ ...base, db, source, dryRun: true });
  assert.deepEqual(order.slice(0, 2), ["start", "stripe"]);
});

test("A1: the window is recorded on the run row with the settlement lag applied", async () => {
  const { db, calls } = fakeDb();
  await executeReconciliationRun({ ...base, db, source: fakeSource(), dryRun: true });
  const started = calls.started[0] as { windowStart: Date; windowEnd: Date };
  assert.equal(started.windowEnd.toISOString(), "2026-08-20T11:30:00.000Z");
  assert.ok(started.windowStart < started.windowEnd);
});

test("A2: with an empty ledger the first run uses the 90-day lookback", async () => {
  const { db, calls } = fakeDb();
  await executeReconciliationRun({ ...base, db, source: fakeSource(), dryRun: true });
  const s = calls.started[0] as { windowStart: Date; windowEnd: Date };
  const days = (s.windowEnd.getTime() - s.windowStart.getTime()) / 86_400_000;
  assert.equal(days, 90);
});

test("A18b: a successor inherits its predecessor's window verbatim", async () => {
  // Recomputing would move the boundary and let the watermark advance past work
  // the partial run never finished.
  const inherited = {
    windowStart: new Date("2026-01-01T00:00:00Z"),
    windowEnd: new Date("2026-01-02T00:00:00Z"),
  };
  const { db, calls } = fakeDb({
    async lastCompletedWindowEnd() {
      return new Date("2026-08-01T00:00:00Z"); // would produce a different window
    },
  });
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource(),
    dryRun: true,
    inheritedWindow: inherited,
    resumedFromRunId: "run_prev",
  });
  const s = calls.started[0] as { windowStart: Date; windowEnd: Date; resumedFromRunId: string };
  assert.equal(s.windowStart.toISOString(), inherited.windowStart.toISOString());
  assert.equal(s.windowEnd.toISOString(), inherited.windowEnd.toISOString());
  assert.equal(s.resumedFromRunId, "run_prev");
});

test("18f0: a blank build identifier refuses before a run row is opened", async () => {
  const { db, calls } = fakeDb();
  await assert.rejects(
    executeReconciliationRun({
      ...base,
      implementationVersion: "   ",
      db,
      source: fakeSource(),
      dryRun: true,
    }),
    /implementationVersion is required/,
  );
  assert.equal(calls.started.length, 0, "no run row may be created");
});

// ── Dry run (17, 18i) ────────────────────────────────────────────────────────

test("A17/A18i: a dry run writes no ledger entry and no exception", async () => {
  const { db, calls } = fakeDb();
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment({ metadata: {} })]),
    dryRun: true,
  });
  assert.equal(calls.entries.length, 0);
  assert.equal(calls.exceptions.length, 0);
});

test("A18i: a dry run's real write counters stay zero", async () => {
  const { db, calls } = fakeDb();
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment({ metadata: {} })]),
    dryRun: true,
  });
  const adv = calls.advanced[0] as { exceptionsCreated?: number };
  // The table's CHECK run_dry_writes_nothing rejects any non-zero value here.
  assert.ok(
    adv.exceptionsCreated === undefined || adv.exceptionsCreated === 0,
    `dry run advanced exceptionsCreated=${adv.exceptionsCreated}`,
  );
});

test("A18i: the prospective columns carry the findings instead", async () => {
  const { db, calls } = fakeDb();
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([
      payment({ objectId: "ch_a", paymentIntentId: "pi_a", metadata: {} }),
      payment({ objectId: "ch_b", paymentIntentId: "pi_b", currency: "gbp", metadata: {} }),
    ]),
    dryRun: true,
  });
  const rep = calls.reports[0] as {
    wouldCreateCount: number;
    prospectiveByKind: Record<string, number>;
  };
  assert.equal(rep.wouldCreateCount, 2);
  assert.deepEqual(rep.prospectiveByKind, {
    unattributable_payment: 1,
    currency_violation: 1,
  });
});

test("A18i: samples are deterministic across two identical runs", async () => {
  const mk = async () => {
    const { db, calls } = fakeDb();
    await executeReconciliationRun({
      ...base,
      db,
      source: fakeSource([
        payment({ objectId: "ch_z", paymentIntentId: "pi_z", metadata: {} }),
        payment({ objectId: "ch_a", paymentIntentId: "pi_a", metadata: {} }),
      ]),
      dryRun: true,
    });
    return (calls.reports[0] as { reportSamples: unknown }).reportSamples;
  };
  assert.deepEqual(await mk(), await mk());
});

test("A18i: samples are capped and carry no cardholder detail", () => {
  const many: PlannedException[] = Array.from({ length: 50 }, (_, i) => ({
    kind: "unattributable_payment",
    livemode: true,
    providerObjectId: `ch_${i}`,
    detail: { cardholder_name: "SHOULD NOT APPEAR", email: "x@y.z" },
  }));
  const samples = sampleFindings(many);
  assert.equal(samples.length, 20);
  const text = JSON.stringify(samples);
  assert.ok(!text.includes("SHOULD NOT APPEAR"), "sample leaked a cardholder name");
  assert.ok(!text.includes("x@y.z"), "sample leaked an email");
});

// ── Writing run ──────────────────────────────────────────────────────────────

test("a writing run writes entries and raises exceptions", async () => {
  const { db, calls } = fakeDb();
  const out = await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment(), payment({ objectId: "ch_2", paymentIntentId: "pi_2", metadata: {} })]),
    dryRun: false,
    authorizedByRunId: "run_dry",
  });
  assert.equal(calls.entries.length, 1);
  assert.equal(calls.exceptions.length, 1);
  assert.equal(out.entriesWritten, 1);
  assert.equal(out.exceptionsCreated, 1);
});

test("18f: the authorising run id is passed through to the database gate", async () => {
  // The refusal itself lives in tg_run_authorization; the orchestration must not
  // pre-empt it, only supply the evidence.
  const { db, calls } = fakeDb();
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource(),
    dryRun: false,
    authorizedByRunId: "run_dry",
  });
  assert.equal((calls.started[0] as { authorizedByRunId: string }).authorizedByRunId, "run_dry");
});

test("a database refusal of an unauthorized writing run surfaces, not swallowed", async () => {
  const { db } = fakeDb({
    async startRun() {
      throw new Error("authorization run  does not exist");
    },
  });
  await assert.rejects(
    executeReconciliationRun({ ...base, db, source: fakeSource(), dryRun: false }),
    /authorization run/,
  );
});

// ── Ceilings and completion (18) ─────────────────────────────────────────────

test("A18: a run hitting a ceiling ends partial with the window NOT exhausted", async () => {
  const { db, calls } = fakeDb();
  const out = await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment(), payment({ objectId: "ch_2", paymentIntentId: "pi_2" })]),
    dryRun: true,
    maxObjects: 1,
  });
  assert.equal(out.status, "partial");
  assert.equal(out.windowExhausted, false);
  const fin = calls.finished[0] as { status: string; windowExhausted: boolean };
  assert.equal(fin.status, "partial");
  assert.equal(fin.windowExhausted, false);
});

test("A18: an unconstrained run ends completed with the window exhausted", async () => {
  const { db, calls } = fakeDb();
  const out = await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment()]),
    dryRun: true,
  });
  assert.equal(out.status, "completed");
  assert.equal((calls.finished[0] as { windowExhausted: boolean }).windowExhausted, true);
});

test("A18: the duration ceiling also produces partial", async () => {
  const { db } = fakeDb();
  const out = await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment()]),
    dryRun: true,
    elapsedMs: () => 11 * 60_000,
  });
  assert.equal(out.status, "partial");
});

// ── Failure handling (11, 18d) ───────────────────────────────────────────────

test("A18d: a run-fatal provider failure ends the run failed, cursor untouched", async () => {
  const { db, calls } = fakeDb();
  const source = fakeSource([], {
    async listPayments() {
      throw new ReconciliationFatal("401 unauthorized", "run_fatal");
    },
  });
  const out = await executeReconciliationRun({ ...base, db, source, dryRun: true });
  assert.equal(out.status, "failed");
  const fin = calls.finished[0] as { status: string; cursor?: unknown; windowExhausted: boolean };
  assert.equal(fin.status, "failed");
  assert.equal(fin.windowExhausted, false);
  assert.equal(fin.cursor, undefined, "a failed run must not advance the cursor");
});

test("A18d: a run-fatal failure raises exactly one reconciliation_run_failed", async () => {
  const { db, calls } = fakeDb();
  const source = fakeSource([], {
    async listPayments() {
      throw new ReconciliationFatal("403 forbidden", "run_fatal");
    },
  });
  await executeReconciliationRun({ ...base, db, source, dryRun: true });
  assert.equal(calls.exceptions.length, 1);
  assert.equal((calls.exceptions[0] as { kind: string }).kind, "reconciliation_run_failed");
});

test("recording the failure never masks the failure", async () => {
  // If raising the exception itself fails, the run must still end `failed`.
  const { db, calls } = fakeDb({
    async raiseException() {
      throw new Error("exception table unreachable");
    },
  });
  const source = fakeSource([], {
    async listPayments() {
      throw new ReconciliationFatal("500", "transient");
    },
  });
  const out = await executeReconciliationRun({ ...base, db, source, dryRun: true });
  assert.equal(out.status, "failed");
  assert.equal((calls.finished[0] as { status: string }).status, "failed");
});

test("A11: exhausting the retry budget ends the run failed", async () => {
  const { db } = fakeDb();
  const source = fakeSource([], {
    async listPayments() {
      return { payments: [], apiCalls: 10, retries: 100 };
    },
  });
  const out = await executeReconciliationRun({ ...base, db, source, dryRun: true });
  assert.equal(out.status, "failed");
  assert.match(out.error ?? "", /retry budget exhausted/);
});

// ── Counters (15) ────────────────────────────────────────────────────────────

test("A15: every counter on the run row matches the observed work", async () => {
  const { db, calls } = fakeDb();
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment(), payment({ objectId: "ch_2", paymentIntentId: "pi_2", metadata: {} })]),
    dryRun: true,
  });
  const adv = calls.advanced[0] as {
    objectsScanned: number;
    apiCalls: number;
  };
  assert.equal(adv.objectsScanned, 2);
  assert.equal(adv.apiCalls, 3, "2 from payments + 1 from refunds");
});

// ── Quarantine (12) ──────────────────────────────────────────────────────────

test("A12: a quarantined object is skipped by the run", async () => {
  const { db, calls } = fakeDb({
    async quarantinedObjectIds() {
      return new Set(["ch_1"]);
    },
  });
  await executeReconciliationRun({
    ...base,
    db,
    source: fakeSource([payment()]),
    dryRun: false,
    authorizedByRunId: "run_dry",
  });
  assert.equal(calls.entries.length, 0);
  assert.equal((calls.advanced[0] as { objectsScanned: number }).objectsScanned, 0);
});
