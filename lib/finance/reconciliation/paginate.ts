/**
 * Financials V2 — PR 3B: exhaustive Stripe pagination with retry.
 *
 * Acceptance 6 requires every object type to paginate to exhaustion — notably a
 * charge with more refunds than fit in one page must yield every refund. A loop
 * that reads one page and stops is the most likely way for reconciliation to
 * silently under-report, because it looks like it worked.
 *
 * Transport-agnostic: the caller supplies a `fetchPage` function, so this is
 * driven by deterministic fixtures in tests and by the Stripe SDK in production.
 */

import {
  classifyError,
  retryBudgetExhausted,
  retryDelayMs,
  shouldRetry,
  type ClassifiableError,
  type ErrorClass,
} from "@/lib/finance/reconciliation/policy";

export type StripePage<T> = {
  data: T[];
  has_more: boolean;
};

export type PageRequest = {
  /** Stripe's cursor: the id of the last object from the previous page. */
  startingAfter?: string;
  limit: number;
};

export type PaginateOptions<T> = {
  fetchPage: (req: PageRequest) => Promise<StripePage<T>>;
  /** Stripe's own maximum is 100. */
  limit?: number;
  /** Identity of an object, for the cursor. */
  idOf: (item: T) => string;
  /** Await a delay. Injected so tests need not really wait. */
  sleep?: (ms: number) => Promise<void>;
  /** Jitter source, injected for determinism. */
  random?: () => number;
  /** Retries already spent by this run; the budget is per-run, not per-call. */
  retriesSoFar?: number;
  /** Hard ceiling on objects, so a runaway list cannot exhaust memory. */
  maxItems?: number;
  /** True when a 4xx here means the request was wrong, not one object. */
  duringList?: boolean;
};

export type PaginateResult<T> = {
  items: T[];
  /** API calls made, including retries — feeds the run's api_calls counter. */
  apiCalls: number;
  /** Retries made, feeding the run's retries counter and its budget. */
  retries: number;
  /** True when `maxItems` stopped the walk before Stripe ran out. */
  truncated: boolean;
};

/** Raised when a failure must end the run rather than skip an object. */
export class ReconciliationFatal extends Error {
  readonly errorClass: ErrorClass;
  constructor(message: string, errorClass: ErrorClass) {
    super(message);
    this.name = "ReconciliationFatal";
    this.errorClass = errorClass;
  }
}

export const DEFAULT_PAGE_LIMIT = 100;

/**
 * Walk a Stripe list to exhaustion, retrying transient failures.
 *
 * Termination is keyed on `has_more` rather than on a short page. Stripe may
 * return fewer items than requested while still having more, so treating a short
 * page as the end would drop the tail — exactly the silent under-report
 * acceptance 6 exists to prevent.
 */
export async function paginateAll<T>(opts: PaginateOptions<T>): Promise<PaginateResult<T>> {
  const {
    fetchPage,
    limit = DEFAULT_PAGE_LIMIT,
    idOf,
    sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
    random = Math.random,
    retriesSoFar = 0,
    maxItems = Number.POSITIVE_INFINITY,
    duringList = true,
  } = opts;

  if (limit < 1 || limit > 100) {
    throw new Error(`paginateAll: limit must be 1..100, got ${limit}`);
  }

  const items: T[] = [];
  let startingAfter: string | undefined;
  let apiCalls = 0;
  let retries = 0;
  let truncated = false;

  for (;;) {
    let page: StripePage<T> | undefined;
    let attempt = 0;

    // Retry loop for one page.
    for (;;) {
      attempt += 1;
      try {
        apiCalls += 1;
        page = await fetchPage({ startingAfter, limit });
        break;
      } catch (raw) {
        const err = raw as ClassifiableError & { message?: string };
        const cls = classifyError({ ...err, duringList });

        if (!shouldRetry(attempt, cls)) {
          throw new ReconciliationFatal(
            `pagination failed (${cls}) after ${attempt} attempt(s): ${err.message ?? "unknown"}`,
            cls,
          );
        }

        // The budget is per RUN, so a single pathological list cannot spend what
        // the rest of the run still needs.
        retries += 1;
        if (retryBudgetExhausted(retriesSoFar + retries)) {
          throw new ReconciliationFatal(
            `retry budget exhausted during pagination after ${retriesSoFar + retries} retries`,
            "run_fatal",
          );
        }

        await sleep(
          retryDelayMs({
            attempt,
            retryAfter: (raw as { headers?: Record<string, string> }).headers?.["retry-after"],
            random,
          }),
        );
      }
    }

    for (const item of page.data) {
      if (items.length >= maxItems) {
        truncated = true;
        return { items, apiCalls, retries, truncated };
      }
      items.push(item);
    }

    if (!page.has_more) break;

    if (page.data.length === 0) {
      // has_more with an empty page would loop forever, since the cursor cannot
      // advance. Refuse rather than hang: a stuck job is harder to notice than a
      // failed one.
      throw new ReconciliationFatal(
        "pagination stalled: Stripe reported has_more with an empty page",
        "run_fatal",
      );
    }

    startingAfter = idOf(page.data[page.data.length - 1]);
  }

  return { items, apiCalls, retries, truncated };
}
