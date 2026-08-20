/**
 * PR 3B — §10a policy tests.
 *
 * Each test names the PR 3 acceptance requirement it executes. Jitter and the
 * clock are injected, so these are deterministic rather than merely repeatable.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ceilingReached,
  classifyError,
  computeWindow,
  retryBudgetExhausted,
  retryDelayMs,
  shouldQuarantine,
  shouldRetry,
  INITIAL_LOOKBACK_DAYS,
  RETRY_CAP_MS,
  RETRY_MAX_ATTEMPTS,
  SETTLEMENT_LAG_MINUTES,
  WINDOW_OVERLAP_MINUTES,
} from "./policy.ts";

const MIN = 60_000;
const at = (iso: string) => new Date(iso);

// ── Acceptance 9 / 18d — error classification ────────────────────────────────

test("A9: an object-scoped 4xx is object-terminal so the run continues", () => {
  assert.equal(classifyError({ statusCode: 400 }), "object_terminal");
  assert.equal(classifyError({ statusCode: 404 }), "object_terminal");
  assert.equal(classifyError({ statusCode: 422 }), "object_terminal");
});

test("A18d: 401 and 403 are run-fatal, never an object-level skip", () => {
  // Treating auth failure as object-terminal would skip every object in turn and
  // report a successful run that examined nothing.
  assert.equal(classifyError({ statusCode: 401 }), "run_fatal");
  assert.equal(classifyError({ statusCode: 403 }), "run_fatal");
});

test("A18d: a 4xx on a list request is run-fatal, not object-terminal", () => {
  // There is no object to blame yet; skipping "the object" would skip a page.
  assert.equal(classifyError({ statusCode: 400, duringList: true }), "run_fatal");
  assert.equal(classifyError({ statusCode: 404, duringList: true }), "run_fatal");
});

test("A7/A8: 429, 5xx, timeouts and connection resets are transient", () => {
  assert.equal(classifyError({ statusCode: 429 }), "transient");
  assert.equal(classifyError({ statusCode: 500 }), "transient");
  assert.equal(classifyError({ statusCode: 503 }), "transient");
  assert.equal(classifyError({ code: "ETIMEDOUT" }), "transient");
  assert.equal(classifyError({ code: "ECONNRESET" }), "transient");
  assert.equal(classifyError({ type: "api_connection_error" }), "transient");
});

test("a 429 is transient even though it is a 4xx", () => {
  // Ordering matters: the generic 4xx branch would otherwise make rate limiting
  // terminal, and reconciliation would quarantine objects for being busy.
  assert.equal(classifyError({ statusCode: 429, duringList: true }), "transient");
});

test("an unrecognised failure is transient, not terminal", () => {
  // A retry costs one API call; a wrong quarantine suppresses an object for three
  // runs (18e). The asymmetry decides the default.
  assert.equal(classifyError({}), "transient");
});

// ── Acceptance 7 — Retry-After and backoff ───────────────────────────────────

test("A7: Retry-After in seconds is honoured exactly", () => {
  assert.equal(retryDelayMs({ attempt: 1, retryAfter: "2" }), 2000);
  assert.equal(retryDelayMs({ attempt: 5, retryAfter: "0" }), 0);
});

test("A7: Retry-After as an HTTP date is honoured relative to now", () => {
  const now = at("2026-08-20T00:00:00Z");
  const delay = retryDelayMs({
    attempt: 1,
    retryAfter: "Thu, 20 Aug 2026 00:00:05 GMT",
    now,
  });
  assert.equal(delay, 5000);
});

test("A7: a past Retry-After date clamps to zero rather than going negative", () => {
  const now = at("2026-08-20T00:01:00Z");
  assert.equal(
    retryDelayMs({ attempt: 1, retryAfter: "Thu, 20 Aug 2026 00:00:00 GMT", now }),
    0,
  );
});

test("A7: Retry-After is capped, so a hostile header cannot stall a run", () => {
  assert.equal(retryDelayMs({ attempt: 1, retryAfter: "86400" }), RETRY_CAP_MS);
});

test("A7: an unparseable Retry-After falls back to backoff instead of trusting it", () => {
  const d = retryDelayMs({ attempt: 1, retryAfter: "soon", random: () => 0 });
  assert.equal(d, 250); // half of the 500ms base, jitter at its floor
});

test("A7: backoff doubles with jitter and is capped", () => {
  // random()=1 yields the top of each jitter band, making the doubling visible.
  const full = (attempt: number) => retryDelayMs({ attempt, random: () => 1 });
  assert.equal(full(1), 500);
  assert.equal(full(2), 1000);
  assert.equal(full(3), 2000);
  assert.equal(full(4), 4000);
  assert.equal(full(10), RETRY_CAP_MS);
});

test("A7: jitter spreads retries across a band rather than a single instant", () => {
  // Without this, every worker throttled together retries in lockstep and
  // recreates the burst that caused the rate limit.
  const low = retryDelayMs({ attempt: 4, random: () => 0 });
  const high = retryDelayMs({ attempt: 4, random: () => 0.999 });
  assert.equal(low, 2000);
  assert.ok(high > low && high <= 4000, `expected jitter band, got ${low}..${high}`);
});

test("A7: retrying stops at 8 attempts, and never for a terminal class", () => {
  assert.equal(shouldRetry(1, "transient"), true);
  assert.equal(shouldRetry(RETRY_MAX_ATTEMPTS - 1, "transient"), true);
  assert.equal(shouldRetry(RETRY_MAX_ATTEMPTS, "transient"), false);
  assert.equal(shouldRetry(1, "object_terminal"), false);
  assert.equal(shouldRetry(1, "run_fatal"), false);
});

test("attempt must be at least 1", () => {
  assert.throws(() => retryDelayMs({ attempt: 0 }), /attempt must be >= 1/);
});

// ── Acceptance 1, 2 — window computation ─────────────────────────────────────

test("A1: window_end stops short of now by the settlement lag", () => {
  const now = at("2026-08-20T12:00:00Z");
  const { windowEnd } = computeWindow({ now });
  assert.equal(windowEnd.toISOString(), "2026-08-20T11:30:00.000Z");
  assert.equal((now.getTime() - windowEnd.getTime()) / MIN, SETTLEMENT_LAG_MINUTES);
});

test("A1: window_start reaches back before the last completed end by the overlap", () => {
  // Windows must overlap, not abut: an object landing on the seam would
  // otherwise be examined by neither run.
  const now = at("2026-08-20T12:00:00Z");
  const { windowStart } = computeWindow({
    now,
    lastCompletedWindowEnd: at("2026-08-20T10:00:00Z"),
  });
  assert.equal(windowStart.toISOString(), "2026-08-20T09:00:00.000Z");
  assert.equal(
    (at("2026-08-20T10:00:00Z").getTime() - windowStart.getTime()) / MIN,
    WINDOW_OVERLAP_MINUTES,
  );
});

test("A2: run #1 with an empty ledger uses the 90-day lookback", () => {
  const now = at("2026-08-20T12:00:00Z");
  const { windowStart, windowEnd } = computeWindow({ now });
  const days = (windowEnd.getTime() - windowStart.getTime()) / (24 * 60 * MIN);
  assert.equal(days, INITIAL_LOOKBACK_DAYS);
});

test("A2: run #1 with a populated ledger starts at the earliest occurred_at", () => {
  // Anything already recorded must fall inside the examined range, however old.
  const now = at("2026-08-20T12:00:00Z");
  const earliest = at("2025-01-05T08:30:00Z");
  const { windowStart } = computeWindow({ now, earliestLedgerOccurredAt: earliest });
  assert.equal(windowStart.toISOString(), earliest.toISOString());
});

test("A2: a completed predecessor outranks the ledger fallback", () => {
  const now = at("2026-08-20T12:00:00Z");
  const { windowStart } = computeWindow({
    now,
    lastCompletedWindowEnd: at("2026-08-20T10:00:00Z"),
    earliestLedgerOccurredAt: at("2025-01-05T08:30:00Z"),
  });
  assert.equal(windowStart.toISOString(), "2026-08-20T09:00:00.000Z");
});

test("a back-to-back run still produces a valid non-empty window", () => {
  // The overlap can reach past the lagged end. start_reconciliation_run rejects
  // window_start >= window_end, so this must not be handed to the database.
  const now = at("2026-08-20T12:00:00Z");
  const { windowStart, windowEnd } = computeWindow({
    now,
    lastCompletedWindowEnd: at("2026-08-20T13:00:00Z"),
  });
  assert.ok(windowStart < windowEnd, `${windowStart.toISOString()} >= ${windowEnd.toISOString()}`);
});

// ── Acceptance 18, 11, 12 — ceilings, budget, quarantine ─────────────────────

test("A18: each ceiling is reported by name, and an idle run hits none", () => {
  assert.equal(ceilingReached({ objectsScanned: 0, apiCalls: 0, elapsedMs: 0 }), false);
  assert.equal(
    ceilingReached({ objectsScanned: 10_000, apiCalls: 0, elapsedMs: 0 }),
    "objects",
  );
  assert.equal(
    ceilingReached({ objectsScanned: 0, apiCalls: 2_000, elapsedMs: 0 }),
    "api_calls",
  );
  assert.equal(
    ceilingReached({ objectsScanned: 0, apiCalls: 0, elapsedMs: 10 * 60_000 }),
    "duration",
  );
});

test("A18: ceilings are configurable per run", () => {
  assert.equal(
    ceilingReached({ objectsScanned: 5, apiCalls: 0, elapsedMs: 0, maxObjects: 5 }),
    "objects",
  );
});

test("A11: the retry budget is exhausted at the limit, not past it", () => {
  assert.equal(retryBudgetExhausted(99), false);
  assert.equal(retryBudgetExhausted(100), true);
  assert.equal(retryBudgetExhausted(3, 3), true);
});

test("A12/A18e: quarantine triggers on three consecutive failure RUNS", () => {
  // Runs, not attempts — one run retrying an object ten times is one failure.
  assert.equal(shouldQuarantine(0), false);
  assert.equal(shouldQuarantine(2), false);
  assert.equal(shouldQuarantine(3), true);
  assert.equal(shouldQuarantine(4), true);
});
