/**
 * PR 3 phase 1 — ingestion mapping tests.
 *
 * Covers the parts of ingestion that are decidable without a network: the event →
 * row mapping, mode fidelity, object-id resolution, and duplicate classification.
 * Signature verification and the insert itself are exercised by the phase 1
 * integration tests against the Stripe test-mode API.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isDuplicateEvent,
  resolveObjectId,
  toStripeEventRow,
  PG_UNIQUE_VIOLATION,
  type IngestableStripeEvent,
} from "./stripe-events.ts";

function event(overrides: Partial<IngestableStripeEvent> = {}): IngestableStripeEvent {
  return {
    id: "evt_1",
    type: "payment_intent.succeeded",
    livemode: true,
    data: { object: { id: "pi_123" } },
    ...overrides,
  };
}

test("maps a verified event to its row", () => {
  const row = toStripeEventRow(event());
  assert.equal(row.event_id, "evt_1");
  assert.equal(row.event_type, "payment_intent.succeeded");
  assert.equal(row.object_id, "pi_123");
  assert.equal(row.livemode, true);
});

test("retains the whole event as payload", () => {
  const e = event();
  assert.equal(toStripeEventRow(e).payload, e);
});

test("livemode is taken from the event, never inferred", () => {
  // Mode isolation downstream depends entirely on this field being Stripe's own
  // report rather than a guess from whichever key happened to be configured.
  assert.equal(toStripeEventRow(event({ livemode: false })).livemode, false);
  assert.equal(toStripeEventRow(event({ livemode: true })).livemode, true);
});

test("resolves the object id for each object type reconciliation enumerates", () => {
  for (const id of ["pi_1", "ch_2", "re_3", "cs_4"]) {
    assert.equal(resolveObjectId(event({ data: { object: { id } } })), id);
  }
});

test("falls back to the event id when the object carries none", () => {
  // object_id is NOT NULL, and dropping a verified event would be worse than
  // recording it against a fallback identity.
  assert.equal(resolveObjectId(event({ data: { object: {} } })), "evt_1");
  assert.equal(resolveObjectId(event({ data: {} })), "evt_1");
  assert.equal(resolveObjectId(event({ data: undefined })), "evt_1");
  assert.equal(resolveObjectId(event({ data: { object: null } })), "evt_1");
});

test("does not accept a non-string or empty object id", () => {
  assert.equal(resolveObjectId(event({ data: { object: { id: 42 } } })), "evt_1");
  assert.equal(resolveObjectId(event({ data: { object: { id: "" } } })), "evt_1");
});

test("rejects an event missing the fields the row requires", () => {
  assert.throws(() => toStripeEventRow(event({ id: "" })), /no id/);
  assert.throws(() => toStripeEventRow(event({ type: "" })), /no type/);
  assert.throws(
    () => toStripeEventRow(event({ livemode: undefined as unknown as boolean })),
    /no livemode/,
  );
});

test("classifies a unique violation as a duplicate delivery", () => {
  // Stripe redelivers freely, so this is the routine case, not the exceptional
  // one. Misclassifying it would make every retry collide and never settle.
  assert.equal(isDuplicateEvent({ code: PG_UNIQUE_VIOLATION }), true);
});

test("does not classify other failures as duplicates", () => {
  // 42501 is permission denied — precisely what a missing grant produces. If that
  // were read as a duplicate, the route would return 200 and Stripe would stop
  // retrying, silently discarding an event that was never recorded.
  assert.equal(isDuplicateEvent({ code: "42501" }), false);
  assert.equal(isDuplicateEvent({ code: "23503" }), false);
  assert.equal(isDuplicateEvent({ code: null }), false);
  assert.equal(isDuplicateEvent({}), false);
  assert.equal(isDuplicateEvent(null), false);
});

test("two distinct events for the same object both map to distinct rows", () => {
  // Acceptance item 18k: two payment_intent.payment_failed events for the same
  // PaymentIntent are both retained. They differ by event id, so neither collides.
  const first = toStripeEventRow(
    event({ id: "evt_a", type: "payment_intent.payment_failed" }),
  );
  const second = toStripeEventRow(
    event({ id: "evt_b", type: "payment_intent.payment_failed" }),
  );
  assert.notEqual(first.event_id, second.event_id);
  assert.equal(first.object_id, second.object_id);
});
