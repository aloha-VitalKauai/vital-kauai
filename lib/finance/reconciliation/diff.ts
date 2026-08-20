/**
 * Financials V2 — PR 3B: the reconciliation diff.
 *
 * Given provider objects and the ledger rows for a window, decide what should be
 * written and what should be raised. Pure: no clock, no network, no database, so
 * every rule below is executed by tests rather than described.
 *
 * The job applies the result; a dry run reports it and applies nothing. That
 * split is what makes acceptance 17/18i checkable — the same function produces
 * both, so a dry run cannot diverge from the writing run it authorises.
 */

/** Mirrors the `finance.exception_kind` enum; only the kinds PR 3 raises. */
export type ExceptionKind =
  | "unattributable_payment"
  | "provider_without_ledger"
  | "ledger_without_provider"
  | "amount_mismatch"
  | "currency_violation"
  | "missing_provider_object"
  | "orphan_refund"
  | "refund_status_regression";

/** A Stripe payment as reconciliation sees it. */
export type ProviderPayment = {
  objectId: string;
  paymentIntentId: string | null;
  /** When Stripe says it happened. The ledger records this, never ingest time. */
  createdAt: Date;
  /** Verified against the PaymentIntent, per D-030. */
  status: string;
  /**
   * True only when `status` came from the PaymentIntent itself.
   *
   * D-030 requires PaymentIntent verification before any `stripe_payment` is
   * written, because a Charge can exist for a payment that never succeeded.
   * A Charge whose PaymentIntent could not be read is NOT evidence of money.
   */
  statusVerifiedFromPaymentIntent: boolean;
  amountCents: number;
  currency: string;
  livemode: boolean;
  metadata: Record<string, string | undefined>;
};

export type ProviderRefund = {
  objectId: string;
  /** The PaymentIntent the refunded charge belongs to. */
  paymentIntentId: string | null;
  /** When Stripe says it happened. */
  createdAt: Date;
  status: string;
  amountCents: number;
  livemode: boolean;
};

export type LedgerRow = {
  id: string;
  agreementId: string;
  entryType: "stripe_payment" | "external_payment" | "refund" | "reversal";
  amountCents: number;
  providerObjectId: string | null;
  providerPaymentIntentId: string | null;
  livemode: boolean;
};

/**
 * A ledger entry the run intends to write.
 *
 * The shape is dictated by the CHECK constraints on `finance.ledger_entries`, not
 * by convenience:
 *   - L1 `stripe_payment`: amount > 0, source stripe, provider_payment_intent_id
 *     NOT NULL, no parent.
 *   - L3 `refund`: amount < 0, parent_entry_id NOT NULL, and for a stripe source
 *     provider_object_id NOT NULL.
 * A plan that violates either fails at INSERT with 23514, so the planner enforces
 * them rather than discovering them in production.
 */
export type PlannedLedgerEntry = {
  agreementId: string;
  entryType: "stripe_payment" | "refund";
  /** Negative for a refund (L3), positive for a payment (L1). */
  amountCents: number;
  providerObjectId: string;
  providerPaymentIntentId: string | null;
  /** Required for a refund (L3); null for a payment (L1 forbids one). */
  parentEntryId: string | null;
  /**
   * `ledger_entries.occurred_at` is NOT NULL and means when the money moved, per
   * Stripe. Defaulting it to ingest time would misdate every entry and corrupt
   * the earliest-occurred_at lookback that run #1 depends on (acceptance 2).
   */
  occurredAt: Date;
  livemode: boolean;
};

export type PlannedException = {
  kind: ExceptionKind;
  livemode: boolean;
  detail: Record<string, unknown>;
  providerObjectId?: string;
  ledgerEntryId?: string;
  agreementId?: string;
  amountCents?: number;
  currency?: string;
};

export type DiffInput = {
  payments: ProviderPayment[];
  refunds: ProviderRefund[];
  ledger: LedgerRow[];
  livemode: boolean;
  /** Objects actively quarantined; skipped entirely (acceptance 12, 18e). */
  quarantinedObjectIds?: ReadonlySet<string>;
};

export type DiffResult = {
  entries: PlannedLedgerEntry[];
  exceptions: PlannedException[];
  /** Provider objects examined — feeds objects_scanned (D-049). */
  objectsScanned: number;
  /** Provider objects matched to an existing ledger row. */
  objectsMatched: number;
  skippedQuarantined: number;
};

/**
 * Stripe's terminal success state. Only this may become a `stripe_payment`.
 *
 * D-030: status is verified on the PaymentIntent before any ledger write, because
 * a Charge can exist for a payment that never succeeded.
 */
const SUCCEEDED = "succeeded";

/**
 * Attribution is by identity ONLY (acceptance 21).
 *
 * `financial_version` must be present and `agreement_id` must be a V2 agreement.
 * There is deliberately no fallback to amount, timestamp, member name or any
 * other coincidence: a heuristic match writes money against the wrong agreement
 * and looks exactly like a correct one afterwards.
 */
export function resolveAgreementId(
  metadata: Record<string, string | undefined>,
): string | null {
  if (metadata.financial_version !== "v2") return null;
  const id = metadata.agreement_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Does this object carry legacy provenance markers? */
function looksLegacy(metadata: Record<string, string | undefined>): boolean {
  return Boolean(metadata.donation_id || metadata.commitment_id || metadata.token_used);
}

export function diffWindow(input: DiffInput): DiffResult {
  const { payments, refunds, ledger, livemode, quarantinedObjectIds = new Set() } = input;

  const entries: PlannedLedgerEntry[] = [];
  const exceptions: PlannedException[] = [];
  let objectsScanned = 0;
  let objectsMatched = 0;
  let skippedQuarantined = 0;

  // Identity indexes. Matching is by these alone — never by amount or time.
  const byObjectId = new Map<string, LedgerRow>();
  const byPaymentIntent = new Map<string, LedgerRow>();
  for (const row of ledger) {
    if (row.livemode !== livemode) continue;
    if (row.providerObjectId) byObjectId.set(row.providerObjectId, row);
    // ONLY payments. A refund row also carries the PaymentIntent, so indexing it
    // here would let a second refund pick the first refund as its parent — which
    // trigger L3b rejects ("a stripe refund must target a stripe_payment"),
    // failing the whole run — or let a refund masquerade as the payment for a
    // charge, producing a false amount_mismatch AND skipping the genuinely
    // missing payment.
    if (row.entryType === "stripe_payment" && row.providerPaymentIntentId) {
      byPaymentIntent.set(row.providerPaymentIntentId, row);
    }
  }

  const matchLedger = (objectId: string, paymentIntentId: string | null) =>
    byObjectId.get(objectId) ??
    (paymentIntentId ? byPaymentIntent.get(paymentIntentId) : undefined);

  // ── Payments ──────────────────────────────────────────────────────────────
  for (const p of payments) {
    // Mode isolation: a live-mode run never considers a test-mode object.
    if (p.livemode !== livemode) continue;

    if (quarantinedObjectIds.has(p.objectId)) {
      skippedQuarantined += 1;
      continue;
    }
    objectsScanned += 1;

    const existing = matchLedger(p.objectId, p.paymentIntentId);

    if (existing) {
      objectsMatched += 1;
      if (existing.amountCents !== p.amountCents) {
        exceptions.push({
          kind: "amount_mismatch",
          livemode,
          providerObjectId: p.objectId,
          ledgerEntryId: existing.id,
          agreementId: existing.agreementId,
          amountCents: p.amountCents,
          currency: p.currency,
          detail: {
            provider_amount_cents: p.amountCents,
            ledger_amount_cents: existing.amountCents,
          },
        });
      }
      continue;
    }

    // D-014: the ledger is USD-only. Recording a foreign-currency payment would
    // silently misstate a balance, so it is reported and not written.
    if (p.currency !== "usd") {
      exceptions.push({
        kind: "currency_violation",
        livemode,
        providerObjectId: p.objectId,
        amountCents: p.amountCents,
        currency: p.currency,
        detail: { currency: p.currency },
      });
      continue;
    }

    // D-030: only a verified `succeeded` PaymentIntent may become a payment. A
    // pending or failed object is simply not yet a fact about money.
    if (p.status !== SUCCEEDED) continue;

    // Looks succeeded, but the status did not come from the PaymentIntent. Writing
    // on Charge evidence alone is precisely what D-030 forbids, and silently
    // skipping would understate a balance — so it is raised.
    if (!p.statusVerifiedFromPaymentIntent) {
      exceptions.push({
        kind: "missing_provider_object",
        livemode,
        providerObjectId: p.objectId,
        amountCents: p.amountCents,
        currency: p.currency,
        detail: {
          reason: "payment_intent_status_unverified",
          payment_intent_id: p.paymentIntentId ?? null,
        },
      });
      continue;
    }

    const agreementId = resolveAgreementId(p.metadata);

    if (agreementId) {
      // L1 requires provider_payment_intent_id NOT NULL on a stripe_payment. A
      // succeeded, attributable payment with no PaymentIntent cannot be written,
      // and dropping it silently would understate a balance — so it is raised.
      if (!p.paymentIntentId) {
        exceptions.push({
          kind: "missing_provider_object",
          livemode,
          providerObjectId: p.objectId,
          agreementId,
          amountCents: p.amountCents,
          currency: p.currency,
          detail: { reason: "no_payment_intent_id", object_id: p.objectId },
        });
        continue;
      }
      entries.push({
        agreementId,
        entryType: "stripe_payment",
        amountCents: p.amountCents,
        providerObjectId: p.objectId,
        providerPaymentIntentId: p.paymentIntentId,
        parentEntryId: null, // L1 forbids a parent on a payment.
        occurredAt: p.createdAt,
        livemode,
      });
      continue;
    }

    // Not attributable to a V2 agreement. Which exception depends on WHY.
    if (looksLegacy(p.metadata)) {
      // The intended shadow-phase output, not a defect: money taken by the legacy
      // system, which V2 does not own and must not import (PR_PLAN, PR 3).
      exceptions.push({
        kind: "provider_without_ledger",
        livemode,
        providerObjectId: p.objectId,
        amountCents: p.amountCents,
        currency: p.currency,
        detail: { reason: "legacy_provenance", metadata_keys: Object.keys(p.metadata).sort() },
      });
    } else {
      // Acceptance 20: no resolvable attribution — raised, never ingested.
      exceptions.push({
        kind: "unattributable_payment",
        livemode,
        providerObjectId: p.objectId,
        amountCents: p.amountCents,
        currency: p.currency,
        detail: { reason: "no_v2_attribution", metadata_keys: Object.keys(p.metadata).sort() },
      });
    }
  }

  // ── Refunds ───────────────────────────────────────────────────────────────
  for (const r of refunds) {
    if (r.livemode !== livemode) continue;
    if (quarantinedObjectIds.has(r.objectId)) {
      skippedQuarantined += 1;
      continue;
    }
    objectsScanned += 1;

    const already = byObjectId.get(r.objectId);
    if (already) {
      objectsMatched += 1;
      // Acceptance 19: a refund that has gone backwards is reported, never
      // corrected by writing a reversal.
      if (r.status === "failed" || r.status === "canceled") {
        exceptions.push({
          kind: "refund_status_regression",
          livemode,
          providerObjectId: r.objectId,
          ledgerEntryId: already.id,
          detail: { provider_status: r.status },
        });
      }
      continue;
    }

    // A refund's parent is the payment it reverses, found by PaymentIntent.
    const parent = r.paymentIntentId ? byPaymentIntent.get(r.paymentIntentId) : undefined;
    if (!parent) {
      exceptions.push({
        kind: "orphan_refund",
        livemode,
        providerObjectId: r.objectId,
        amountCents: r.amountCents,
        detail: { payment_intent_id: r.paymentIntentId ?? null },
      });
      continue;
    }

    if (r.status !== "succeeded") continue;

    entries.push({
      agreementId: parent.agreementId,
      entryType: "refund",
      // L3: a refund is NEGATIVE. Stripe reports refund amounts as positive
      // magnitudes, so the sign is applied here; writing the provider's value
      // verbatim would fail the CHECK and, if it ever passed, would inflate the
      // balance it was meant to reduce.
      amountCents: -Math.abs(r.amountCents),
      providerObjectId: r.objectId,
      providerPaymentIntentId: r.paymentIntentId,
      // L3 requires a parent. It is the payment this refund reverses, matched by
      // PaymentIntent identity above — never inferred.
      parentEntryId: parent.id,
      occurredAt: r.createdAt,
      livemode,
    });
  }

  // ── Ledger rows with no provider object ───────────────────────────────────
  const providerIds = new Set<string>([
    ...payments.map((p) => p.objectId),
    ...refunds.map((r) => r.objectId),
  ]);
  for (const row of ledger) {
    if (row.livemode !== livemode) continue;
    // Only Stripe-sourced rows are expected to have a provider object; an
    // external payment legitimately has none.
    if (row.entryType !== "stripe_payment" && row.entryType !== "refund") continue;
    if (!row.providerObjectId) continue;
    if (providerIds.has(row.providerObjectId)) continue;

    exceptions.push({
      kind: "ledger_without_provider",
      livemode,
      ledgerEntryId: row.id,
      agreementId: row.agreementId,
      providerObjectId: row.providerObjectId,
      amountCents: row.amountCents,
      detail: { entry_type: row.entryType },
    });
  }

  return { entries, exceptions, objectsScanned, objectsMatched, skippedQuarantined };
}

/**
 * Reconciliation may never write a `reversal` (acceptance 19).
 *
 * A reversal is a founder-authored correction, not something a machine infers
 * from provider state. This is asserted over the plan as a belt-and-braces check
 * so a future edit to `diffWindow` cannot introduce one quietly.
 */
export function assertNoReversals(entries: PlannedLedgerEntry[]): void {
  for (const e of entries) {
    if ((e.entryType as string) === "reversal") {
      throw new Error(
        `reconciliation planned a reversal for ${e.providerObjectId}; reversals are founder-only`,
      );
    }
  }
}

/** Group planned exceptions by kind — the dry run's `prospective_by_kind`. */
export function countByKind(exceptions: PlannedException[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of exceptions) out[e.kind] = (out[e.kind] ?? 0) + 1;
  return out;
}
