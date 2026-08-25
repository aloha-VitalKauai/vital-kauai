/**
 * Financials V2 — PR 3B: the §10a run orchestration.
 *
 * Wires the policy core, the paginator and the diff to the D-079/D-080 database
 * functions. All I/O is behind two injected interfaces, so the control flow —
 * which is where the acceptance requirements live — is exercised with fakes
 * rather than against Stripe.
 *
 * The orchestration deliberately owns no invariants of its own. Single-flight,
 * the approval gate, the exhausted-window rule and "a dry run writes nothing" are
 * all enforced in Postgres; this code is arranged so those refusals surface as
 * clear failures rather than being pre-empted by duplicate checks that could
 * drift out of agreement with the database.
 */

import {
  ceilingReached,
  computeWindow,
  retryBudgetExhausted,
  MAX_OBJECTS_PER_RUN,
  type ReconciliationWindow,
} from "@/lib/finance/reconciliation/policy";
import {
  assertNoReversals,
  countByKind,
  diffWindow,
  type LedgerRow,
  type PlannedException,
  type PublicEntryRow,
  type PlannedLedgerEntry,
  type ProviderPayment,
  type ProviderRefund,
} from "@/lib/finance/reconciliation/diff";
import { ReconciliationFatal } from "@/lib/finance/reconciliation/paginate";

export type RunStatus = "completed" | "partial" | "failed" | "abandoned";

/** Everything the run reads or writes in Postgres, all via D-079 functions. */
export type FinanceDb = {
  startRun(args: {
    livemode: boolean;
    implementationVersion: string;
    windowStart: Date;
    windowEnd: Date;
    dryRun: boolean;
    cursor?: Record<string, unknown>;
    resumedFromRunId?: string | null;
    authorizedByRunId?: string | null;
  }): Promise<string>;

  advanceRun(args: {
    runId: string;
    cursor?: Record<string, unknown> | null;
    objectsScanned?: number;
    objectsMatched?: number;
    apiCalls?: number;
    retries?: number;
    exceptionsCreated?: number;
    exceptionsReopened?: number;
  }): Promise<void>;

  finishRun(args: {
    runId: string;
    status: RunStatus;
    windowExhausted?: boolean;
    error?: string | null;
    cursor?: Record<string, unknown> | null;
  }): Promise<void>;

  recordDryRunReport(args: {
    runId: string;
    wouldCreateCount: number;
    wouldReopenCount: number;
    prospectiveByKind: Record<string, number>;
    reportSamples: unknown;
    reportVersion: string;
  }): Promise<void>;

  raiseException(args: PlannedException & { runId: string }): Promise<string>;
  writeLedgerEntry(entry: PlannedLedgerEntry & { runId: string }): Promise<void>;

  lastCompletedWindowEnd(livemode: boolean): Promise<Date | null>;
  earliestLedgerOccurredAt(livemode: boolean): Promise<Date | null>;
  ledgerForWindow(args: {
    livemode: boolean;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<LedgerRow[]>;
  /** PR 10B: public support entries for the window, matched but never written. */
  publicEntriesForWindow(args: {
    livemode: boolean;
    windowStart: Date;
    windowEnd: Date;
  }): Promise<PublicEntryRow[]>;
  quarantinedObjectIds(livemode: boolean): Promise<Set<string>>;
  /** `kind:provider_object_id` for every OPEN exception, for the reopen count. */
  openExceptionSubjects(livemode: boolean): Promise<string[]>;
};

/**
 * Provider enumeration. Each call paginates to exhaustion unless `maxItems`
 * truncates it.
 *
 * `maxItems` is what makes the object ceiling REAL. Checking a ceiling after
 * enumerating everything bounds nothing — it only relabels a fully-covered window
 * as `partial`, and because the watermark advances only on `completed`, a window
 * with more objects than the ceiling would be re-scanned forever and no dry run
 * would ever become approvable.
 */
export type StripeSource = {
  listPayments(
    w: ReconciliationWindow & { livemode: boolean; maxItems?: number },
  ): Promise<{
    payments: ProviderPayment[];
    apiCalls: number;
    retries: number;
    truncated: boolean;
  }>;
  listRefunds(
    w: ReconciliationWindow & { livemode: boolean; maxItems?: number },
  ): Promise<{
    refunds: ProviderRefund[];
    apiCalls: number;
    retries: number;
    truncated: boolean;
  }>;
};

export type RunOptions = {
  db: FinanceDb;
  source: StripeSource;
  livemode: boolean;
  dryRun: boolean;
  /**
   * The deployed build identifier, read from process configuration only (18f0).
   * Never accepted from request-shaped input, and a run refuses to start without
   * it rather than substituting a placeholder.
   */
  implementationVersion: string;
  now: Date;
  /** Required for a writing run; the database refuses one without it (18f). */
  authorizedByRunId?: string | null;
  resumedFromRunId?: string | null;
  /** Inherited verbatim by the successor of a partial run (18b). */
  inheritedWindow?: ReconciliationWindow | null;
  reportVersion?: string;
  maxObjects?: number;
  maxApiCalls?: number;
  maxDurationMs?: number;
  /** Elapsed-time source, injected so ceilings are testable without waiting. */
  elapsedMs?: () => number;
};

export type RunOutcome = {
  runId: string;
  status: RunStatus;
  windowExhausted: boolean;
  window: ReconciliationWindow;
  objectsScanned: number;
  objectsMatched: number;
  exceptionsCreated: number;
  entriesWritten: number;
  apiCalls: number;
  retries: number;
  error?: string;
};

export const REPORT_VERSION = "1";

/**
 * Execute one reconciliation run.
 *
 * Ordering is deliberate: the run row is created BEFORE any Stripe call, so a
 * crash mid-enumeration leaves a `running` row with a heartbeat that the sweeper
 * can find and abandon (acceptance 5). Creating it afterwards would leave the
 * work invisible.
 */
export async function executeReconciliationRun(opts: RunOptions): Promise<RunOutcome> {
  const {
    db,
    source,
    livemode,
    dryRun,
    implementationVersion,
    now,
    authorizedByRunId = null,
    resumedFromRunId = null,
    inheritedWindow = null,
    reportVersion = REPORT_VERSION,
    elapsedMs = () => 0,
  } = opts;

  if (!implementationVersion || implementationVersion.trim() === "") {
    // 18f0 — also enforced in start_reconciliation_run. Failing here keeps a
    // misconfigured deploy from even opening a run row.
    throw new Error("executeReconciliationRun: implementationVersion is required");
  }

  // 18b — a successor inherits its predecessor's window verbatim. Recomputing it
  // would silently move the boundary and let the watermark advance past work the
  // partial run never finished.
  const window =
    inheritedWindow ??
    computeWindow({
      now,
      lastCompletedWindowEnd: await db.lastCompletedWindowEnd(livemode),
      earliestLedgerOccurredAt: await db.earliestLedgerOccurredAt(livemode),
    });

  const runId = await db.startRun({
    livemode,
    implementationVersion,
    windowStart: window.windowStart,
    windowEnd: window.windowEnd,
    dryRun,
    cursor: {},
    resumedFromRunId,
    authorizedByRunId,
  });

  let apiCalls = 0;
  let retries = 0;
  let objectsScanned = 0;
  let objectsMatched = 0;
  let exceptionsCreated = 0;
  let entriesWritten = 0;

  const finishFailed = async (message: string): Promise<RunOutcome> => {
    // The cursor is left untouched so the next run resumes rather than restarting
    // (acceptance 11, 18d).
    //
    // Guarded: `finish_reconciliation_run` raises if the run is no longer
    // `running` (a sweeper may have abandoned it) or if the error text is blank.
    // An unhandled rejection here would strand the run in `running` and hold the
    // single-flight lock — the failure path must not be able to fail.
    try {
      await db.finishRun({
        runId,
        status: "failed",
        windowExhausted: false,
        error: message || "unknown error",
      });
    } catch (finishErr) {
      console.error(
        "reconciliation: could not finish a failed run; the sweeper will abandon it",
        runId,
        finishErr,
      );
    }
    return {
      runId,
      status: "failed",
      windowExhausted: false,
      window,
      objectsScanned,
      objectsMatched,
      exceptionsCreated,
      entriesWritten,
      apiCalls,
      retries,
      error: message,
    };
  };

  try {
    // Heartbeat between the two Stripe walks. Each can legitimately take minutes
    // (8 retry attempts at up to 30s per page), and `abandon_stale_runs` reclaims
    // a run after 15 minutes of silence — a healthy run must not look dead, or the
    // single-flight slot is released to a second writer while this one is still
    // going.
    const objectBudget = opts.maxObjects ?? MAX_OBJECTS_PER_RUN;
    const paymentsResult = await source.listPayments({
      ...window,
      livemode,
      maxItems: objectBudget,
    });
    await db.advanceRun({ runId, apiCalls: paymentsResult.apiCalls, retries: paymentsResult.retries });
    const refundsResult = await source.listRefunds({
      ...window,
      livemode,
      // Whatever the payments walk did not consume.
      maxItems: Math.max(objectBudget - paymentsResult.payments.length, 0),
    });
    apiCalls += paymentsResult.apiCalls + refundsResult.apiCalls;
    retries += paymentsResult.retries + refundsResult.retries;

    if (retryBudgetExhausted(retries)) {
      return await finishFailed(`retry budget exhausted (${retries} retries)`);
    }

    const [ledger, publicEntries, quarantined] = [
      await db.ledgerForWindow({ livemode, ...window }),
      await db.publicEntriesForWindow({ livemode, ...window }),
      await db.quarantinedObjectIds(livemode),
    ];

    const plan = diffWindow({
      payments: paymentsResult.payments,
      refunds: refundsResult.refunds,
      ledger,
      publicEntries,
      livemode,
      quarantinedObjectIds: quarantined,
    });

    // Belt-and-braces over the plan: reconciliation may never write a reversal
    // (acceptance 19), and a future edit to diffWindow must not be able to
    // introduce one quietly.
    assertNoReversals(plan.entries);

    objectsScanned = plan.objectsScanned;
    objectsMatched = plan.objectsMatched;

    // Record what was examined BEFORE writing anything. If a write throws
    // mid-loop the ledger rows already inserted are real, and a run row still
    // reporting zero work would be a false audit trail.
    await db.advanceRun({
      runId,
      objectsScanned,
      objectsMatched,
      apiCalls: refundsResult.apiCalls,
      retries: refundsResult.retries,
    });

    // Truncated enumeration means the window genuinely was not covered. The
    // api-call and duration limits are observed resource ceilings and are checked
    // the same way; the object ceiling is now enforced by `maxItems` above rather
    // than discovered after the fact.
    const truncated = paymentsResult.truncated || refundsResult.truncated;
    const ceiling =
      (truncated ? "objects" : false) ||
      ceilingReached({
        objectsScanned: 0,
        apiCalls,
        elapsedMs: elapsedMs(),
        maxApiCalls: opts.maxApiCalls,
        maxDurationMs: opts.maxDurationMs,
      });

    if (dryRun) {
      // 17/18i — a dry run writes no ledger entry and no exception. Its real
      // counters stay 0 (the CHECK run_dry_writes_nothing enforces that at the
      // table) and its findings go to the prospective columns instead.
      // Counters were already recorded before the write phase; advancing them
      // again would DOUBLE them, because every counter on the run row is additive
      // (D-049). Only the cursor moves here.
      await db.advanceRun({
        runId,
        cursor: { window_end: window.windowEnd.toISOString() },
      });
      // `would_reopen_count` is the subset whose subject already has an OPEN
      // exception: a writing run would bump those rather than create them.
      // Hard-coding 0 told the founder nothing would be reopened even when it
      // would, which is an incomplete picture to approve against.
      const openSubjects = new Set(
        (await db.openExceptionSubjects(livemode)) ?? [],
      );
      const wouldReopen = plan.exceptions.filter(
        (e) => e.providerObjectId && openSubjects.has(`${e.kind}:${e.providerObjectId}`),
      ).length;

      await db.recordDryRunReport({
        runId,
        wouldCreateCount: plan.exceptions.length - wouldReopen,
        wouldReopenCount: wouldReopen,
        prospectiveByKind: countByKind(plan.exceptions),
        reportSamples: sampleFindings(plan.exceptions),
        reportVersion,
      });
    } else {
      for (const entry of plan.entries) {
        await db.writeLedgerEntry({ ...entry, runId });
        entriesWritten += 1;
      }
      for (const exception of plan.exceptions) {
        await db.raiseException({ ...exception, runId });
        exceptionsCreated += 1;
      }
      // As above: only the cursor and the exceptions actually created in this
      // phase. Re-sending the enumeration counters would double them.
      await db.advanceRun({
        runId,
        cursor: { window_end: window.windowEnd.toISOString() },
        exceptionsCreated,
      });
    }

    // Acceptance 18 — a run that hit a ceiling ends `partial` with the window NOT
    // exhausted and the cursor preserved. It must never report `completed`, which
    // would advance the watermark past objects never examined.
    const status: RunStatus = ceiling ? "partial" : "completed";
    await db.finishRun({
      runId,
      status,
      windowExhausted: status === "completed",
      error: ceiling ? `stopped at ceiling: ${ceiling}` : null,
    });

    return {
      runId,
      status,
      windowExhausted: status === "completed",
      window,
      objectsScanned,
      objectsMatched,
      exceptionsCreated,
      entriesWritten,
      apiCalls,
      retries,
    };
  } catch (err) {
    // A run-fatal provider failure ends the run `failed` with the cursor intact
    // and exactly one reconciliation_run_failed exception (18d). An object-level
    // problem never reaches here — the diff turns it into an exception and the
    // run continues.
    const message =
      err instanceof ReconciliationFatal
        ? `${err.errorClass}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);

    try {
      // A dry run writes NOTHING — including here. `raise_reconciliation_exception`
      // inserts without touching run counters, so neither the
      // run_dry_writes_nothing CHECK nor the report guard would catch it, and the
      // guarantee the founder approves against would be quietly false.
      if (dryRun) throw new Error("dry run: exception suppressed");
      await db.raiseException({
        kind: "reconciliation_run_failed" as PlannedException["kind"],
        livemode,
        detail: { message },
        providerObjectId: `run:${runId}`,
        runId,
      });
    } catch {
      // Recording the failure must never mask the failure itself.
    }
    return await finishFailed(message);
  }
}

/**
 * Deterministic, bounded, PII-free samples for the dry-run report (18i).
 *
 * Sorted by a stable key so two identical runs produce identical samples, and
 * carrying only ids and amounts — never cardholder name, address, email or phone,
 * which have no place in a report a founder may export or share.
 */
export function sampleFindings(exceptions: PlannedException[], cap = 20): unknown[] {
  return [...exceptions]
    .sort((a, b) =>
      `${a.kind}:${a.providerObjectId ?? ""}`.localeCompare(
        `${b.kind}:${b.providerObjectId ?? ""}`,
      ),
    )
    .slice(0, cap)
    .map((e) => ({
      kind: e.kind,
      provider_object_id: e.providerObjectId ?? null,
      ledger_entry_id: e.ledgerEntryId ?? null,
      amount_cents: e.amountCents ?? null,
      currency: e.currency ?? null,
    }));
}
