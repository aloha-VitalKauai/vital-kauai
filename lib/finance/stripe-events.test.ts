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
  mapRecordEventStatus,
  resolveObjectId,
  toStripeEventRow,
  TERMINAL_AT_MOST_ONCE_EVENT_TYPES,
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

test("a recorded event answers 200", () => {
  const o = mapRecordEventStatus("recorded");
  assert.equal(o.http, 200);
  assert.equal(o.body.received, true);
});

test("a duplicate delivery answers 200, not an error", () => {
  // Same event id arriving twice is routine — Stripe redelivers freely. A non-2xx
  // would make it retry into the same collision forever.
  const o = mapRecordEventStatus("duplicate");
  assert.equal(o.http, 200);
  assert.equal(o.body.duplicate, true);
});

test("an at-most-once conflict answers 409 and is NOT reported as received", () => {
  // The decisive case (D-081). This is a DIFFERENT event of a terminal type for
  // the same object. Answering 200 would acknowledge and destroy a real event —
  // the hazard ARCHITECTURE §10 names: "over-including one silently discards a
  // real event". 409 keeps it in Stripe's retry queue instead.
  const o = mapRecordEventStatus("at_most_once_conflict");
  assert.equal(o.http, 409);
  assert.equal(o.body.received, undefined);
  assert.equal(o.body.error, "at_most_once_conflict");
});

test("a duplicate and an at-most-once conflict never map to the same answer", () => {
  // Both originate from SQLSTATE 23505. Conflating them is what destroyed data
  // before; the database now distinguishes them by constraint name.
  assert.notEqual(
    mapRecordEventStatus("duplicate").http,
    mapRecordEventStatus("at_most_once_conflict").http,
  );
});

test("an unrecognised status is not assumed benign", () => {
  // Defaulting to success would reintroduce the silent discard by another route.
  for (const bogus of ["", "ok", "inserted", "unknown"]) {
    const o = mapRecordEventStatus(bogus);
    assert.equal(o.http, 500, `status "${bogus}" must not be treated as success`);
    assert.notEqual(o.body.received, true);
  }
});

test("the at-most-once list matches the index in the database exactly", () => {
  // D-056 / D-076. payment_intent.payment_failed must NOT appear: Stripe emits it
  // per failed ATTEMPT, so two are legitimate for one PaymentIntent (18k).
  assert.deepEqual([...TERMINAL_AT_MOST_ONCE_EVENT_TYPES], [
    "checkout.session.completed",
    "checkout.session.expired",
    "payment_intent.succeeded",
    "payment_intent.canceled",
  ]);
  assert.ok(
    !TERMINAL_AT_MOST_ONCE_EVENT_TYPES.includes("payment_intent.payment_failed" as never),
  );
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
