/**
 * Financials V2 — PR 3B: reconciliation policy.
 *
 * The decision-making core of the §10a job, kept pure so every rule can be
 * exercised deterministically: no clock, no network, no database. The job passes
 * `now` in and supplies its own jitter source, so the same inputs always produce
 * the same outputs and the acceptance requirements can be executed rather than
 * described.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Error classification (acceptance 8, 9, 18d)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `transient`       — retry the same call.
 * `object_terminal` — this object cannot be processed; raise
 *                     `provider_object_processing_failed` and CONTINUE the run.
 * `run_fatal`       — the run cannot proceed at all; end `failed`, cursor intact.
 *
 * The distinction is the whole point of acceptance 9 and 18d. Treating an auth
 * failure as object-terminal would quietly skip every object and report a
 * successful run over nothing; treating one malformed charge as run-fatal would
 * stop reconciliation over a single bad row.
 */
export type ErrorClass = "transient" | "object_terminal" | "run_fatal";

/** What the classifier needs. Structural, so tests need no Stripe SDK. */
export type ClassifiableError = {
  statusCode?: number;
  /** Stripe's error `type`, e.g. "api_connection_error". */
  type?: string;
  /** Node syscall codes such as ETIMEDOUT / ECONNRESET. */
  code?: string;
  /** True when the failing call was a list/enumeration rather than one object. */
  duringList?: boolean;
};

const TRANSIENT_NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "EAI_AGAIN",
  "ENOTFOUND",
  "ECONNABORTED",
]);

const TRANSIENT_STRIPE_TYPES = new Set([
  "api_connection_error",
  "rate_limit_error",
  "api_error",
]);

export function classifyError(err: ClassifiableError): ErrorClass {
  // Network faults never reached Stripe, so nothing about the object is implied.
  if (err.code && TRANSIENT_NETWORK_CODES.has(err.code)) return "transient";
  if (err.type && TRANSIENT_STRIPE_TYPES.has(err.type)) return "transient";

  const status = err.statusCode;
  if (status === undefined) {
    // An unrecognised failure is treated as transient rather than terminal: a
    // retry costs one API call, whereas wrongly quarantining a healthy object
    // suppresses it for three runs (18e).
    return "transient";
  }

  if (status === 429) return "transient";
  if (status >= 500) return "transient";

  // Credentials are wrong or revoked. Every subsequent call fails identically,
  // so continuing would burn the retry budget and report a hollow success.
  if (status === 401 || status === 403) return "run_fatal";

  if (status >= 400) {
    // A 4xx on enumeration means the REQUEST is wrong (bad filter, bad params),
    // not that one object is bad — there is no object to blame yet, and skipping
    // "the object" would silently skip an entire page. Acceptance 18d.
    return err.duringList ? "run_fatal" : "object_terminal";
  }

  return "transient";
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry scheduling (acceptance 7)
// ─────────────────────────────────────────────────────────────────────────────

export const RETRY_BASE_MS = 500;
export const RETRY_CAP_MS = 30_000;
export const RETRY_MAX_ATTEMPTS = 8;

export type RetryInput = {
  /** 1 for the first retry. */
  attempt: number;
  /** Raw `Retry-After` header, if Stripe sent one. Seconds or HTTP-date. */
  retryAfter?: string | null;
  /** Jitter source in [0,1). Injected so tests are deterministic. */
  random?: () => number;
  /** Reference point for HTTP-date form. */
  now?: Date;
};

/**
 * Delay before the next attempt.
 *
 * `Retry-After` wins when present: Stripe is telling us when capacity returns,
 * and guessing shorter just wastes an attempt. Otherwise the delay doubles with
 * jitter and is capped.
 *
 * Jitter matters more than it looks. Without it, every worker that hit the same
 * rate limit retries at the same instant and re-creates the burst that caused it.
 */
export function retryDelayMs(input: RetryInput): number {
  const { attempt, retryAfter, random = Math.random, now = new Date() } = input;

  if (attempt < 1) throw new Error(`retryDelayMs: attempt must be >= 1, got ${attempt}`);

  if (retryAfter != null && retryAfter !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.round(seconds * 1000), RETRY_CAP_MS);
    }
    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) {
      return Math.min(Math.max(asDate - now.getTime(), 0), RETRY_CAP_MS);
    }
    // Unparseable header: fall through to backoff rather than trusting it.
  }

  const exponential = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_CAP_MS);
  // Full jitter over [half, full] keeps the doubling shape while spreading load.
  const half = exponential / 2;
  return Math.round(half + random() * half);
}

/** Acceptance 7: the call must succeed within 8 attempts or stop retrying. */
export function shouldRetry(attempt: number, cls: ErrorClass): boolean {
  return cls === "transient" && attempt < RETRY_MAX_ATTEMPTS;
}

// ─────────────────────────────────────────────────────────────────────────────
// Window computation (acceptance 1, 2, 18b)
// ─────────────────────────────────────────────────────────────────────────────

export const SETTLEMENT_LAG_MINUTES = 30;
export const WINDOW_OVERLAP_MINUTES = 60;
export const INITIAL_LOOKBACK_DAYS = 90;

export type WindowInput = {
  now: Date;
  /** `window_end` of the last run that reached `completed`, if any. */
  lastCompletedWindowEnd?: Date | null;
  /** Earliest `occurred_at` in the ledger, if the ledger is populated. */
  earliestLedgerOccurredAt?: Date | null;
  settlementLagMinutes?: number;
  overlapMinutes?: number;
  lookbackDays?: number;
};

export type ReconciliationWindow = { windowStart: Date; windowEnd: Date };

/**
 * Compute the window a new run should cover.
 *
 * `window_end` stops short of now by the settlement lag, because very recent
 * objects are still moving and reconciling them produces mismatches that resolve
 * themselves — noise indistinguishable from real findings.
 *
 * `window_start` reaches back BEFORE the last completed end by the overlap.
 * Windows must overlap rather than abut: an object created microseconds after a
 * boundary, or backdated slightly by Stripe, would fall in the seam between two
 * runs and never be examined by either.
 *
 * Acceptance 2 — the first run has no predecessor. With a populated ledger it
 * starts at the earliest `occurred_at`, so nothing already recorded is outside
 * the examined range; with an empty ledger it falls back to a 90-day lookback.
 */
export function computeWindow(input: WindowInput): ReconciliationWindow {
  const {
    now,
    lastCompletedWindowEnd = null,
    earliestLedgerOccurredAt = null,
    settlementLagMinutes = SETTLEMENT_LAG_MINUTES,
    overlapMinutes = WINDOW_OVERLAP_MINUTES,
    lookbackDays = INITIAL_LOOKBACK_DAYS,
  } = input;

  const windowEnd = new Date(now.getTime() - settlementLagMinutes * 60_000);

  let windowStart: Date;
  if (lastCompletedWindowEnd) {
    windowStart = new Date(lastCompletedWindowEnd.getTime() - overlapMinutes * 60_000);
  } else if (earliestLedgerOccurredAt) {
    windowStart = new Date(earliestLedgerOccurredAt.getTime());
  } else {
    windowStart = new Date(windowEnd.getTime() - lookbackDays * 24 * 60 * 60_000);
  }

  if (windowStart >= windowEnd) {
    // Can happen when a run follows another closely: the overlap reaches past the
    // lagged end. A zero-or-negative window is rejected by
    // finance.start_reconciliation_run, so collapse it to a minimal valid span
    // rather than letting the caller hit a database error it cannot act on.
    windowStart = new Date(windowEnd.getTime() - 60_000);
  }

  return { windowStart, windowEnd };
}

// ─────────────────────────────────────────────────────────────────────────────
// Work ceilings (acceptance 18)
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_OBJECTS_PER_RUN = 10_000;
export const MAX_API_CALLS_PER_RUN = 2_000;
export const MAX_RUN_DURATION_MS = 10 * 60_000;

export type CeilingInput = {
  objectsScanned: number;
  apiCalls: number;
  elapsedMs: number;
  maxObjects?: number;
  maxApiCalls?: number;
  maxDurationMs?: number;
};

/**
 * Has this run hit a ceiling?
 *
 * A run that stops here ends `partial` with `window_exhausted = false` and its
 * cursor preserved — never `completed`. Reporting `completed` would advance the
 * watermark past objects that were never examined, and nothing downstream would
 * ever look at them again. `finance.finish_reconciliation_run` enforces the same
 * rule in the database, so this is the polite half of a guarantee that does not
 * depend on the caller being polite.
 */
export function ceilingReached(input: CeilingInput): false | "objects" | "api_calls" | "duration" {
  const {
    objectsScanned,
    apiCalls,
    elapsedMs,
    maxObjects = MAX_OBJECTS_PER_RUN,
    maxApiCalls = MAX_API_CALLS_PER_RUN,
    maxDurationMs = MAX_RUN_DURATION_MS,
  } = input;

  if (objectsScanned >= maxObjects) return "objects";
  if (apiCalls >= maxApiCalls) return "api_calls";
  if (elapsedMs >= maxDurationMs) return "duration";
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry budget (acceptance 11)
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_RETRIES_PER_RUN = 100;

/**
 * A run that spends its whole retry budget is failing systemically, not unluckily.
 * It ends `failed` with the cursor intact so the next run resumes rather than
 * restarting, and so the failure is visible instead of being absorbed as slowness.
 */
export function retryBudgetExhausted(retries: number, budget = MAX_RETRIES_PER_RUN): boolean {
  return retries >= budget;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quarantine (acceptance 12, 18e)
// ─────────────────────────────────────────────────────────────────────────────

export const QUARANTINE_AFTER_CONSECUTIVE_FAILURE_RUNS = 3;

/**
 * An object that fails terminally in three consecutive RUNS is quarantined and
 * skipped thereafter until a founder releases it.
 *
 * The unit is runs, not attempts: a single run retrying one object ten times is
 * one failure, not ten. `finance.raise_reconciliation_exception` maintains the
 * streak on that basis, and a successful examination resets it.
 */
export function shouldQuarantine(consecutiveFailureRuns: number): boolean {
  return consecutiveFailureRuns >= QUARANTINE_AFTER_CONSECUTIVE_FAILURE_RUNS;
}
