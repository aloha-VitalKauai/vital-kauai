/**
 * The subscription list is the one place Stripe configuration, handler dispatch,
 * documentation and tests must agree. These tests are what makes that agreement
 * checkable rather than asserted.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isSubscribedEventType,
  isTerminalAtMostOnce,
  objectTypeForEvent,
  RECONCILED_OBJECT_TYPES,
  SUBSCRIBED_EVENT_TYPES,
  TERMINAL_AT_MOST_ONCE_EVENT_TYPES,
} from "./stripe-event-types.ts";

test("every at-most-once type is subscribed", () => {
  // Otherwise the database structurally deduplicates a type the endpoint never
  // receives — an invariant defending nothing.
  for (const t of TERMINAL_AT_MOST_ONCE_EVENT_TYPES) {
    assert.ok(isSubscribedEventType(t), `${t} is deduplicated but not subscribed`);
  }
});

test("the at-most-once list matches the database index predicate exactly", () => {
  // Mirrors stripe_events_terminal_at_most_once_uq (D-056, D-076). If the index
  // changes, this fails rather than the two drifting apart silently.
  assert.deepEqual([...TERMINAL_AT_MOST_ONCE_EVENT_TYPES], [
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.succeeded",
    "payment_intent.canceled",
  ]);
});

test("payment_intent.payment_failed is subscribed but NOT deduplicated", () => {
  // Acceptance 18k: Stripe emits it per failed ATTEMPT, so two are legitimate for
  // one PaymentIntent and both must be retained. Including it in the index would
  // silently discard the second.
  assert.ok(isSubscribedEventType("payment_intent.payment_failed"));
  assert.equal(isTerminalAtMostOnce("payment_intent.payment_failed"), false);
});

test("every subscribed type maps to an object reconciliation enumerates", () => {
  // §10a rule 7 lists PaymentIntent, Charge, Refund and Checkout Session. A
  // subscribed type outside those is noise in a table with a 24-month retention
  // obligation.
  for (const t of SUBSCRIBED_EVENT_TYPES) {
    const obj = objectTypeForEvent(t);
    assert.ok(obj !== null, `${t} maps to no reconciled object type`);
    assert.ok(
      (RECONCILED_OBJECT_TYPES as readonly string[]).includes(obj as string),
      `${t} maps to ${obj}, which reconciliation does not enumerate`,
    );
  }
});

test("all four reconciled object types are covered by the subscription", () => {
  // The converse check: an object type reconciliation walks but never observes
  // events for would be reconciled blind.
  const covered = new Set(SUBSCRIBED_EVENT_TYPES.map(objectTypeForEvent));
  for (const obj of RECONCILED_OBJECT_TYPES) {
    assert.ok(covered.has(obj), `no subscribed event covers ${obj}`);
  }
});

test("charge.refund.updated is classified as a Refund, not a Charge", () => {
  // Prefix order matters — `charge.` would otherwise capture it and the refund
  // path would never see it.
  assert.equal(objectTypeForEvent("charge.refund.updated"), "refund");
  assert.equal(objectTypeForEvent("charge.refunded"), "charge");
  assert.equal(objectTypeForEvent("refund.created"), "refund");
});

test("unrelated Stripe events map to no reconciled object", () => {
  // These are exactly what subscribing to "all events" would have recorded.
  for (const t of [
    "customer.created",
    "invoice.paid",
    "product.updated",
    "payout.paid",
    "radar.early_fraud_warning.created",
  ]) {
    assert.equal(objectTypeForEvent(t), null, `${t} unexpectedly mapped`);
    assert.equal(isSubscribedEventType(t), false, `${t} must not be subscribed`);
  }
});

test("the list has no duplicates and is sorted within its groups", () => {
  // A duplicated entry in the dashboard is easy to create and hard to see.
  const seen = new Set(SUBSCRIBED_EVENT_TYPES);
  assert.equal(seen.size, SUBSCRIBED_EVENT_TYPES.length, "duplicate event type");
});

test("the subscription is a fixed, reviewable size", () => {
  // A guard against casual growth: adding a type should be a deliberate edit that
  // updates this number, not an incidental one.
  assert.equal(SUBSCRIBED_EVENT_TYPES.length, 20);
});
