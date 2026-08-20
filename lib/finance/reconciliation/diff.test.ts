/**
 * PR 3B — reconciliation diff tests (acceptance 13, 14, 17, 19, 20, 21).
 *
 * Deterministic fixtures; each test names the requirement it executes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertNoReversals,
  countByKind,
  diffWindow,
  resolveAgreementId,
  type LedgerRow,
  type ProviderPayment,
  type ProviderRefund,
} from "./diff.ts";

const AGREEMENT = "11111111-1111-1111-1111-111111111111";

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

function refund(o: Partial<ProviderRefund> = {}): ProviderRefund {
  return {
    objectId: "re_1",
    paymentIntentId: "pi_1",
    status: "succeeded",
    amountCents: 1000,
    livemode: true,
    ...o,
  };
}

function ledgerRow(o: Partial<LedgerRow> = {}): LedgerRow {
  return {
    id: "led_1",
    agreementId: AGREEMENT,
    entryType: "stripe_payment",
    amountCents: 5000,
    providerObjectId: "ch_1",
    providerPaymentIntentId: "pi_1",
    livemode: true,
    ...o,
  };
}

const base = { payments: [], refunds: [], ledger: [], livemode: true };

// ── Acceptance 20 — attribution ──────────────────────────────────────────────

test("A20: a succeeded PaymentIntent with valid v2 metadata is ingested", () => {
  const r = diffWindow({ ...base, payments: [payment()] });
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].agreementId, AGREEMENT);
  assert.equal(r.entries[0].entryType, "stripe_payment");
  assert.equal(r.exceptions.length, 0);
});

test("A20: no resolvable attribution raises unattributable_payment and writes nothing", () => {
  const r = diffWindow({ ...base, payments: [payment({ metadata: {} })] });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions[0].kind, "unattributable_payment");
});

test("A20: metadata without financial_version=v2 is not attribution", () => {
  // An agreement_id alone could be anything; the version marker is what makes it
  // a V2 claim rather than a coincidence of key naming.
  assert.equal(resolveAgreementId({ agreement_id: AGREEMENT }), null);
  assert.equal(resolveAgreementId({ financial_version: "v1", agreement_id: AGREEMENT }), null);
  assert.equal(resolveAgreementId({ financial_version: "v2" }), null);
  assert.equal(resolveAgreementId({ financial_version: "v2", agreement_id: "" }), null);
  assert.equal(resolveAgreementId({ financial_version: "v2", agreement_id: AGREEMENT }), AGREEMENT);
});

test("legacy-tagged money yields provider_without_ledger, the intended shadow signal", () => {
  // PR_PLAN: this is the expected output during the shadow phase, not a defect.
  // It must be distinguishable from "we have no idea what this is".
  const r = diffWindow({
    ...base,
    payments: [payment({ metadata: { donation_id: "d1" } })],
  });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions[0].kind, "provider_without_ledger");
});

// ── Acceptance 21 — no heuristic matching ────────────────────────────────────

test("A21: an amount-and-mode coincidence with no identity match does NOT match", () => {
  // Same amount, same mode, different identity. A heuristic matcher would join
  // these and write money against the wrong agreement — indistinguishable from a
  // correct write afterwards.
  const r = diffWindow({
    ...base,
    payments: [payment({ objectId: "ch_OTHER", paymentIntentId: "pi_OTHER", metadata: {} })],
    ledger: [ledgerRow()],
  });
  assert.equal(r.objectsMatched, 0);
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions.some((e) => e.kind === "unattributable_payment"), true);
});

test("A21: matching by PaymentIntent id is identity, and is allowed", () => {
  const r = diffWindow({
    ...base,
    payments: [payment({ objectId: "ch_DIFFERENT" })],
    ledger: [ledgerRow({ providerObjectId: null })],
  });
  assert.equal(r.objectsMatched, 1);
  assert.equal(r.entries.length, 0);
});

// ── Acceptance 13 — idempotence ──────────────────────────────────────────────

test("A13: an already-recorded payment produces no second entry", () => {
  const r = diffWindow({ ...base, payments: [payment()], ledger: [ledgerRow()] });
  assert.equal(r.entries.length, 0);
  assert.equal(r.objectsMatched, 1);
  assert.equal(r.exceptions.length, 0);
});

test("running the same window twice is stable", () => {
  const input = { ...base, payments: [payment()], ledger: [ledgerRow()] };
  assert.deepEqual(diffWindow(input), diffWindow(input));
});

// ── Acceptance 14 — mode isolation ───────────────────────────────────────────

test("A14: a live-mode run ignores test-mode objects entirely", () => {
  const r = diffWindow({
    ...base,
    livemode: true,
    payments: [payment({ livemode: false })],
  });
  assert.equal(r.objectsScanned, 0);
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions.length, 0);
});

test("A14: a test-mode run ignores live-mode ledger rows", () => {
  const r = diffWindow({
    ...base,
    livemode: false,
    payments: [payment({ livemode: false })],
    ledger: [ledgerRow({ livemode: true })],
  });
  // The live row must not satisfy the test-mode object.
  assert.equal(r.objectsMatched, 0);
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].livemode, false);
});

// ── Amount and currency ──────────────────────────────────────────────────────

test("a differing amount raises amount_mismatch and writes nothing", () => {
  const r = diffWindow({
    ...base,
    payments: [payment({ amountCents: 7000 })],
    ledger: [ledgerRow({ amountCents: 5000 })],
  });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions[0].kind, "amount_mismatch");
  assert.equal(r.exceptions[0].detail.provider_amount_cents, 7000);
  assert.equal(r.exceptions[0].detail.ledger_amount_cents, 5000);
});

test("a non-USD payment is reported, never written", () => {
  // D-014. Writing it would silently misstate a balance in a currency the ledger
  // has no concept of.
  const r = diffWindow({ ...base, payments: [payment({ currency: "eur" })] });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions[0].kind, "currency_violation");
});

// ── D-030 — status verification ──────────────────────────────────────────────

test("D-030: only a succeeded payment becomes a ledger entry", () => {
  for (const status of ["processing", "requires_action", "canceled", "requires_payment_method"]) {
    const r = diffWindow({ ...base, payments: [payment({ status })] });
    assert.equal(r.entries.length, 0, `${status} must not be ingested`);
    assert.equal(r.exceptions.length, 0, `${status} is not yet a fact, not an exception`);
  }
});

// ── Acceptance 19 — refunds, and never a reversal ────────────────────────────

test("A19: reconciliation never plans a reversal", () => {
  const r = diffWindow({
    ...base,
    payments: [payment()],
    refunds: [refund()],
    ledger: [ledgerRow()],
  });
  assert.equal(r.entries.every((e) => e.entryType !== "reversal"), true);
  assert.doesNotThrow(() => assertNoReversals(r.entries));
});

test("A19: assertNoReversals is a real backstop, not decoration", () => {
  assert.throws(
    () =>
      assertNoReversals([
        {
          agreementId: AGREEMENT,
          entryType: "reversal" as never,
          amountCents: 1,
          providerObjectId: "ch_x",
          providerPaymentIntentId: null,
          livemode: true,
        },
      ]),
    /reversals are founder-only/,
  );
});

test("A19: a refund status regression raises an exception only", () => {
  const r = diffWindow({
    ...base,
    refunds: [refund({ status: "failed" })],
    ledger: [ledgerRow({ id: "led_r", entryType: "refund", providerObjectId: "re_1" })],
  });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions[0].kind, "refund_status_regression");
});

test("a refund parented by PaymentIntent becomes a refund entry", () => {
  const r = diffWindow({ ...base, refunds: [refund()], ledger: [ledgerRow()] });
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].entryType, "refund");
  assert.equal(r.entries[0].agreementId, AGREEMENT);
  assert.equal(r.entries[0].amountCents, 1000);
});

test("a refund with no parent payment raises orphan_refund", () => {
  const r = diffWindow({ ...base, refunds: [refund({ paymentIntentId: "pi_UNKNOWN" })] });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions[0].kind, "orphan_refund");
});

// ── Ledger rows with no provider object ──────────────────────────────────────

test("a stripe ledger row whose provider object is absent raises ledger_without_provider", () => {
  const r = diffWindow({ ...base, ledger: [ledgerRow()] });
  assert.equal(r.exceptions[0].kind, "ledger_without_provider");
});

test("an external payment is not expected to have a provider object", () => {
  const r = diffWindow({
    ...base,
    ledger: [ledgerRow({ entryType: "external_payment", providerObjectId: null })],
  });
  assert.equal(r.exceptions.length, 0);
});

// ── Acceptance 12 / 18e — quarantine ─────────────────────────────────────────

test("A12: a quarantined object is skipped entirely by the next run", () => {
  const r = diffWindow({
    ...base,
    payments: [payment()],
    quarantinedObjectIds: new Set(["ch_1"]),
  });
  assert.equal(r.skippedQuarantined, 1);
  assert.equal(r.objectsScanned, 0);
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions.length, 0);
});

// ── Acceptance 17 / 18i — the dry-run report shares this computation ─────────

test("A18i: prospective_by_kind counts exactly the planned exceptions", () => {
  const r = diffWindow({
    ...base,
    payments: [
      payment({ objectId: "ch_a", paymentIntentId: "pi_a", metadata: {} }),
      payment({ objectId: "ch_b", paymentIntentId: "pi_b", metadata: {} }),
      payment({ objectId: "ch_c", paymentIntentId: "pi_c", currency: "gbp", metadata: {} }),
    ],
  });
  assert.deepEqual(countByKind(r.exceptions), {
    unattributable_payment: 2,
    currency_violation: 1,
  });
});

test("counters reflect work examined, not objects supplied", () => {
  // D-049: counters count examinations by this run.
  const r = diffWindow({
    ...base,
    payments: [payment(), payment({ objectId: "ch_2", paymentIntentId: "pi_2", metadata: {} })],
    ledger: [ledgerRow()],
  });
  assert.equal(r.objectsScanned, 2);
  assert.equal(r.objectsMatched, 1);
});
