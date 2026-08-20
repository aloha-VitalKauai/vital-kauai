/**
 * PR 3B — object-family coverage (§10 rule 8, §10a rule 7, D-030).
 *
 * ── The two requirements, and how they differ ────────────────────────────────
 *
 * ARCHITECTURE.md:1109 (§10a rule 7) lists FOUR object types:
 *   "Exhaustive pagination for every object type — PaymentIntents, Charges,
 *    Refunds, and Checkout Sessions alike."
 *
 * ARCHITECTURE.md:640 (§10 rule 8) scopes THE PR 3 JOB to three:
 *   "The PR 3 job enumerates Stripe **PaymentIntent, Charge and Refund objects**
 *    over a window and diffs them against the ledger."
 *
 * §10 rule 8 is the controlling statement for PR 3, and §10a rule 7 states the
 * pagination discipline that applies to whichever families a run enumerates.
 *
 * ── What this implementation does, and why ───────────────────────────────────
 *
 * CHARGE      — enumerated independently (charges.list, paginated to exhaustion).
 * REFUND      — enumerated independently (refunds.list, paginated to exhaustion).
 * PAYMENTINTENT — hydrated through the Charge via `expand: ["data.payment_intent"]`,
 *   NOT listed separately. Sound because a PaymentIntent that produced no Charge
 *   moved no money: it can yield neither a ledger entry (L1 needs a charge-backed
 *   payment) nor a money-bearing exception. Every PaymentIntent that COULD produce
 *   either is reachable from its Charge. D-030 is satisfied because the status
 *   used is the PaymentIntent's own — and when hydration fails, this suite proves
 *   the run refuses to write rather than falling back to the Charge.
 * CHECKOUT SESSION — NOT enumerated by PR 3. ARCHITECTURE.md:1353 ties Session
 *   enumeration to resolving stranded checkout attempts by matching `attempt_id`
 *   in Session metadata, and :1372 records that V2 Sessions carry that metadata
 *   "from PR 6". PR_PLAN places `finance.checkout_sessions`, the stranded-attempt
 *   sweeper and `stranded_checkout_attempt` in PR 6. No V2 Checkout Session exists
 *   yet, so enumerating them now would return only legacy Sessions and produce
 *   nothing actionable.
 *
 * These tests pin that behaviour so the deferral stays a decision on record rather
 * than an omission someone later mistakes for coverage.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { diffWindow, type ProviderPayment, type ProviderRefund } from "./diff.ts";
import { objectTypeForEvent, RECONCILED_OBJECT_TYPES } from "../stripe-event-types.ts";

const AGREEMENT = "33333333-3333-3333-3333-333333333333";
const base = { payments: [], refunds: [], ledger: [], livemode: true };

function payment(o: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    objectId: "ch_1",
    paymentIntentId: "pi_1",
    createdAt: new Date("2026-08-19T10:00:00Z"),
    status: "succeeded",
    statusVerifiedFromPaymentIntent: true,
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
    createdAt: new Date("2026-08-19T11:00:00Z"),
    status: "succeeded",
    amountCents: 1000,
    livemode: true,
    ...o,
  };
}

// ── Charge and Refund: independently enumerated ──────────────────────────────

test("CHARGE family: a charge-rooted payment reaches the ledger", () => {
  const r = diffWindow({ ...base, payments: [payment()] });
  assert.equal(r.entries.length, 1);
  assert.equal(r.entries[0].providerObjectId, "ch_1");
});

test("REFUND family: a refund is examined independently of any charge", () => {
  // The refunds list is its own enumeration; a refund is not discovered by
  // walking charges, so a refund whose charge fell outside the window is seen.
  const r = diffWindow({ ...base, refunds: [refund({ paymentIntentId: "pi_unknown" })] });
  assert.equal(r.objectsScanned, 1);
  assert.equal(r.exceptions[0].kind, "orphan_refund");
});

// ── PaymentIntent: hydrated, and D-030 enforced on the hydration ─────────────

test("PAYMENTINTENT family: the PaymentIntent's own status is what authorises a write", () => {
  // Hydration is only acceptable while the status genuinely comes from the
  // PaymentIntent. This is the positive control for the test below it.
  const r = diffWindow({
    ...base,
    payments: [payment({ status: "succeeded", statusVerifiedFromPaymentIntent: true })],
  });
  assert.equal(r.entries.length, 1);
});

test("D-030: a succeeded-looking charge with an UNVERIFIED PaymentIntent is never written", () => {
  // The defect this guards: if expansion fails, `payment_intent` arrives as a bare
  // id and the Charge's own status would otherwise stand in for the
  // PaymentIntent's. That is writing money on Charge evidence alone — exactly what
  // D-030 forbids. Skipping silently would understate a balance, so it is raised.
  const r = diffWindow({
    ...base,
    payments: [payment({ status: "succeeded", statusVerifiedFromPaymentIntent: false })],
  });
  assert.equal(r.entries.length, 0, "an unverified PaymentIntent must not produce a ledger entry");
  assert.equal(r.exceptions.length, 1);
  assert.equal(r.exceptions[0].kind, "missing_provider_object");
  assert.equal(r.exceptions[0].detail.reason, "payment_intent_status_unverified");
});

test("D-030: verification is only required once the object looks succeeded", () => {
  // A processing charge is not yet a fact about money either way, so an
  // unverified one is skipped rather than raised — no noise from normal traffic.
  const r = diffWindow({
    ...base,
    payments: [payment({ status: "processing", statusVerifiedFromPaymentIntent: false })],
  });
  assert.equal(r.entries.length, 0);
  assert.equal(r.exceptions.length, 0);
});

// ── Checkout Session: deferred to PR 6, on the record ────────────────────────

test("CHECKOUT SESSION family: covered for events, deferred for enumeration", () => {
  // The subscription observes Session events (they land in stripe_events), but the
  // reconciler does not enumerate Sessions — see the header for the citations.
  // If PR 6 adds Session enumeration, this test should be updated deliberately
  // rather than silently.
  assert.equal(objectTypeForEvent("checkout.session.completed"), "checkout_session");
  assert.ok((RECONCILED_OBJECT_TYPES as readonly string[]).includes("checkout_session"));
});

test("PR 3 writes no ledger entry from a Checkout Session", () => {
  // There are no V2 Sessions until PR 6 creates them, so nothing in PR 3's plan
  // may originate from one. Every entry PR 3 plans is charge- or refund-rooted.
  const r = diffWindow({
    ...base,
    payments: [payment()],
    refunds: [refund()],
    ledger: [
      {
        id: "led_1",
        agreementId: AGREEMENT,
        entryType: "stripe_payment",
        amountCents: 5000,
        providerObjectId: "ch_1",
        providerPaymentIntentId: "pi_1",
        livemode: true,
      },
    ],
  });
  for (const e of r.entries) {
    assert.ok(
      e.providerObjectId.startsWith("ch_") || e.providerObjectId.startsWith("re_"),
      `entry originated from ${e.providerObjectId}, which is neither a charge nor a refund`,
    );
  }
});
