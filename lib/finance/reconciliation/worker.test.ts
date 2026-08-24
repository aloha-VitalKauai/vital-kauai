/**
 * PR 3B — worker, sweeping and retention (acceptance 3, 5).
 *
 * The Supabase client is faked at the `.schema().rpc()` boundary, so the loop's
 * control flow is exercised without a database.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  purgeExpiredPayloads,
  retentionCutoff,
  runEventWorker,
  sweepAbandonedRuns,
  sweepStaleClaims,
  PAYLOAD_RETENTION_MONTHS,
  type ClaimedEvent,
} from "./worker.ts";

type RpcCall = { fn: string; args: Record<string, unknown> };

/** Minimal stand-in for the parts of SupabaseClient the worker touches. */
function fakeClient(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: RpcCall[] = [];
  const client = {
    schema() {
      return {
        rpc(fn: string, args: Record<string, unknown>) {
          calls.push({ fn, args });
          const h = handlers[fn];
          if (!h) return Promise.resolve({ data: null, error: { message: `no handler ${fn}` } });
          try {
            return Promise.resolve({ data: h(args), error: null });
          } catch (e) {
            const err = e as Error & { code?: string };
            return Promise.resolve({ data: null, error: { message: err.message, code: err.code } });
          }
        },
      };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  return { client, calls };
}

function ev(o: Partial<ClaimedEvent> = {}): ClaimedEvent {
  return {
    event_id: "evt_1",
    event_type: "payment_intent.succeeded",
    object_id: "pi_1",
    livemode: false,
    attempt_count: 1,
    payload: {},
    ...o,
  };
}

test("a claimed subscribed event is driven to processed", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev()],
    complete_stripe_event: () => null,
  });
  const r = await runEventWorker(client, { livemode: false });
  assert.equal(r.claimed, 1);
  assert.equal(r.processed, 1);
  const complete = calls.find((c) => c.fn === "complete_stripe_event");
  assert.equal(complete?.args.p_status, "processed");
});

test("an event outside the subscription is closed as ignored, not processed", async () => {
  // The distinction is what makes subscription drift visible in the table rather
  // than only in a log line.
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev({ event_type: "customer.created", object_id: "cus_1" })],
    complete_stripe_event: () => null,
  });
  const r = await runEventWorker(client, { livemode: false });
  assert.equal(r.ignored, 1);
  assert.equal(r.processed, 0);
  assert.equal(calls.find((c) => c.fn === "complete_stripe_event")?.args.p_status, "ignored");
});

test("EVERY claimed event reaches a terminal state in one pass", async () => {
  // An event left `processing` is invisible to the next `received` query and only
  // returns via the stale sweep, so a silent skip would look like progress while
  // stalling the queue.
  const events = [
    ev({ event_id: "a" }),
    ev({ event_id: "b", event_type: "customer.created" }),
    ev({ event_id: "c", event_type: "charge.refunded", object_id: "ch_1" }),
  ];
  const { client, calls } = fakeClient({
    claim_stripe_events: () => events,
    complete_stripe_event: () => null,
  });
  const r = await runEventWorker(client, { livemode: false });
  const completed = calls.filter((c) => c.fn === "complete_stripe_event");
  assert.equal(completed.length, events.length);
  assert.equal(r.processed + r.ignored + r.failed, events.length);
});

test("a processing error closes that event as failed and carries the reason", async () => {
  let first = true;
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev()],
    complete_stripe_event: () => {
      if (first) {
        first = false;
        throw new Error("downstream exploded");
      }
      return null;
    },
  });
  const r = await runEventWorker(client, { livemode: false });
  assert.equal(r.failed, 1);
  const failed = calls.filter((c) => c.fn === "complete_stripe_event").at(-1);
  assert.equal(failed?.args.p_status, "failed");
  assert.match(String(failed?.args.p_error), /downstream exploded/);
});

test("an event whose failure cannot even be recorded is left for the sweeper", async () => {
  // Leaving it `processing` is the safe outcome: the stale sweep returns it to
  // `received` and it is retried. Throwing here would abandon the whole batch.
  const { client } = fakeClient({
    claim_stripe_events: () => [ev(), ev({ event_id: "evt_2" })],
    complete_stripe_event: () => {
      throw new Error("db unreachable");
    },
  });
  const r = await runEventWorker(client, { livemode: false });
  assert.equal(r.claimed, 2);
  assert.equal(r.processed + r.ignored + r.failed, 0);
});

test("an empty claim batch is a no-op, not an error", async () => {
  const { client } = fakeClient({ claim_stripe_events: () => [] });
  const r = await runEventWorker(client, { livemode: false });
  assert.deepEqual(r, { claimed: 0, processed: 0, failed: 0, ignored: 0 });
});

test("a null claim result is treated as empty", async () => {
  const { client } = fakeClient({ claim_stripe_events: () => null });
  const r = await runEventWorker(client, { livemode: false });
  assert.equal(r.claimed, 0);
});

test("the claim is scoped to the requested livemode", async () => {
  // Mode isolation starts at the claim: a live worker must never take test rows.
  const { client, calls } = fakeClient({ claim_stripe_events: () => [] });
  await runEventWorker(client, { livemode: true });
  assert.equal(calls[0].args.p_livemode, true);
});

test("A3: sweeping stale claims returns the count", async () => {
  const { client, calls } = fakeClient({ sweep_stale_event_claims: () => 4 });
  assert.equal(await sweepStaleClaims(client, false), 4);
  assert.equal(calls[0].args.p_livemode, false);
});

test("A5: sweeping abandoned runs is not scoped by livemode", async () => {
  // A stranded run blocks the single-flight slot for its own mode; both need
  // clearing, so the sweep deliberately takes no livemode argument.
  const { client, calls } = fakeClient({ abandon_stale_runs: () => 2 });
  assert.equal(await sweepAbandonedRuns(client), 2);
  assert.equal("p_livemode" in calls[0].args, false);
});

// ── Retention ────────────────────────────────────────────────────────────────

test("the retention cutoff is exactly 24 months back", () => {
  const cutoff = retentionCutoff(new Date("2026-08-20T12:00:00Z"));
  assert.equal(cutoff.toISOString(), "2024-08-20T12:00:00.000Z");
  assert.equal(PAYLOAD_RETENTION_MONTHS, 24);
});

test("the cutoff handles month-end without rolling into the wrong month", () => {
  // 31 May minus 24 months is 31 May, not a drifted date.
  assert.equal(
    retentionCutoff(new Date("2026-05-31T00:00:00Z")).toISOString(),
    "2024-05-31T00:00:00.000Z",
  );
});

test("purging repeats until a batch comes back short", async () => {
  // One invocation must clear a backlog, without a single long-lived lock.
  const sizes = [5000, 5000, 17];
  let i = 0;
  const { client, calls } = fakeClient({
    purge_expired_event_payloads: () => sizes[i++],
  });
  const total = await purgeExpiredPayloads(client, new Date("2026-08-20T12:00:00Z"));
  assert.equal(total, 10_017);
  assert.equal(calls.length, 3);
});

test("purging stops at maxBatches so a bad horizon cannot spin", async () => {
  const { client, calls } = fakeClient({ purge_expired_event_payloads: () => 10 });
  await purgeExpiredPayloads(client, new Date("2026-08-20T12:00:00Z"), {
    batch: 10,
    maxBatches: 3,
  });
  assert.equal(calls.length, 3);
});

test("the purge horizon sent to the database is the computed cutoff", async () => {
  const { client, calls } = fakeClient({ purge_expired_event_payloads: () => 0 });
  await purgeExpiredPayloads(client, new Date("2026-08-20T12:00:00Z"));
  assert.equal(calls[0].args.p_before, "2024-08-20T12:00:00.000Z");
});

// ── PR 6 closeout: Stripe-driven session expiry ──────────────────────────────

test("checkout.session.expired releases only the attempt named in its metadata", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev({
      event_type: "checkout.session.expired",
      object_id: "cs_1",
      livemode: true,
      payload: { data: { object: { id: "cs_1", metadata: { attempt_id: "att_target" } } } },
    })],
    complete_stripe_event: () => null,
    transition_checkout_session: () => null,
  });

  const result = await runEventWorker(client, { livemode: true });

  const tr = calls.filter((c) => c.fn === "transition_checkout_session");
  assert.equal(tr.length, 1, "exactly one attempt may be touched");
  assert.equal(tr[0]!.args.p_attempt_id, "att_target");
  assert.equal(tr[0]!.args.p_to_status, "expired");
  // The Session id is pinned so the database can refuse an event belonging to
  // a different Session that merely carries our attempt_id in its metadata.
  assert.equal(tr[0]!.args.p_stripe_session_id, "cs_1");
  assert.equal(result.processed, 1);
});

test("an expired Session without V2 attribution touches no attempt", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev({
      event_type: "checkout.session.expired",
      object_id: "cs_foreign",
      livemode: true,
      payload: { data: { object: { id: "cs_foreign", metadata: {} } } },
    })],
    complete_stripe_event: () => null,
  });

  await runEventWorker(client, { livemode: true });

  assert.equal(calls.filter((c) => c.fn === "transition_checkout_session").length, 0);
});

test("an expiry transition that is refused does not fail the event", async () => {
  // A `creating` attempt refuses the transition; that corner belongs to the
  // stranded sweeper, and the event itself is still validly processed.
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev({
      event_type: "checkout.session.expired",
      object_id: "cs_1",
      livemode: true,
      payload: { data: { object: { id: "cs_1", metadata: { attempt_id: "att_creating" } } } },
    })],
    complete_stripe_event: () => null,
    transition_checkout_session: () => { throw new Error("transition: creating may only be canceled"); },
  });

  const result = await runEventWorker(client, { livemode: true });

  assert.equal(result.processed, 1);
  assert.equal(result.failed, 0);
  const done = calls.filter((c) => c.fn === "complete_stripe_event");
  assert.equal(done[0]!.args.p_status, "processed");
});

// ── PR 10B: public support ───────────────────────────────────────────────────

function vkErr(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

const publicPi = (over: Record<string, unknown> = {}) => ev({
  event_id: "evt_pub_pi",
  object_id: "pi_pub",
  livemode: true,
  payload: { data: { object: {
    id: "pi_pub", status: "succeeded", amount_received: 10330, created: 1_766_000_000,
    latest_charge: "ch_pub",
    metadata: { financial_version: "public_support_v1", attempt_id: "att_pub" },
    ...over,
  } } },
});

const publicCs = (over: Record<string, unknown> = {}) => ev({
  event_id: "evt_pub_cs",
  event_type: "checkout.session.completed",
  object_id: "cs_pub",
  livemode: true,
  payload: { data: { object: {
    id: "cs_pub", payment_status: "paid", payment_intent: "pi_pub",
    metadata: { financial_version: "public_support_v1", attempt_id: "att_pub" },
    customer_details: { email: "Supporter@Example.com", name: "A Supporter" },
    ...over,
  } } },
});

test("a public-support PaymentIntent records the FULL charged amount exactly once", async () => {
  // $100 contribution + $3.30 voluntary processing support = one entry for
  // $103.30, attributed through OUR attempt row — never metadata alone.
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [publicPi()],
    record_public_support_payment: () => "entry_1",
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  const rec = calls.filter((c) => c.fn === "record_public_support_payment");
  assert.equal(rec.length, 1);
  assert.equal(rec[0]!.args.p_amount_cents, 10330);
  assert.equal(rec[0]!.args.p_payment_intent_id, "pi_pub");
  assert.equal(rec[0]!.args.p_attempt_id, "att_pub");
  assert.equal(rec[0]!.args.p_charge_id, "ch_pub");
  assert.equal(rec[0]!.args.p_livemode, true);
  assert.equal(rec[0]!.args.p_origin_event_id, "evt_pub_pi");
  // The member path must not fire for a public payment.
  assert.equal(calls.filter((c) => c.fn === "record_v2_stripe_payment").length, 0);
  assert.equal(r.processed, 1);
});

test("a public PaymentIntent without attempt attribution writes no money", async () => {
  // Metadata missing attempt_id: nothing to attribute through, so nothing is
  // recorded — reconciliation surfaces it, the worker never guesses.
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [publicPi({ metadata: { financial_version: "public_support_v1" } })],
    complete_stripe_event: () => null,
  });

  await runEventWorker(client, { livemode: true });

  assert.equal(calls.filter((c) => c.fn === "record_public_support_payment").length, 0);
  assert.equal(calls.filter((c) => c.fn === "record_v2_stripe_payment").length, 0);
});

test("the member PaymentIntent path is untouched by the public branch", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [publicPi({
      metadata: { financial_version: "v2", agreement_id: "agr_1" }, amount_received: 10000,
    })],
    record_v2_stripe_payment: () => "row_1",
    complete_stripe_event: () => null,
  });

  await runEventWorker(client, { livemode: true });

  const member = calls.filter((c) => c.fn === "record_v2_stripe_payment");
  assert.equal(member.length, 1);
  assert.equal(member[0]!.args.p_amount_cents, 10000);
  assert.equal(calls.filter((c) => c.fn === "record_public_support_payment").length, 0);
});

test("a paid public Session links identity and never touches member session rows", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [publicCs()],
    link_public_supporter: () => null,
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  const link = calls.filter((c) => c.fn === "link_public_supporter");
  assert.equal(link.length, 1);
  assert.equal(link[0]!.args.p_payment_intent_id, "pi_pub");
  assert.equal(link[0]!.args.p_session_id, "cs_pub");
  assert.equal(link[0]!.args.p_email, "Supporter@Example.com");
  assert.equal(link[0]!.args.p_display_name, "A Supporter");
  // The member checkout-session transition must not fire for a public Session.
  assert.equal(calls.filter((c) => c.fn === "transition_checkout_session").length, 0);
  assert.equal(r.processed, 1);
});

test("identity arriving before money is DEFERRED, not failed and not completed", async () => {
  // VK404 = the public entry does not exist yet (the PI event has not landed).
  // The event is left `processing` for the stale sweep, so event order can
  // never change the financial result — and the rest of the batch continues.
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [
      publicCs(),
      ev({ event_id: "evt_after", event_type: "customer.created", object_id: "cus_1" }),
    ],
    link_public_supporter: () => vkErr("VK404", "no public entry for pi_pub"),
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  const done = calls.filter((c) => c.fn === "complete_stripe_event");
  assert.equal(done.length, 1, "only the FOLLOWING event may be completed");
  assert.equal(done[0]!.args.p_event_id, "evt_after");
  assert.equal(r.failed, 0);
  assert.equal(r.processed, 0);
  assert.equal(r.ignored, 1);
});

test("after 5 attempts a VK404 link stops deferring and the event closes", async () => {
  // A Session that will never match (e.g. its PI was test-mode noise) must not
  // cycle through the sweep forever; the link failure is logged, not fatal.
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [publicCs() ].map((e) => ({ ...e, attempt_count: 5 })),
    link_public_supporter: () => vkErr("VK404", "no public entry for pi_pub"),
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  assert.equal(r.processed, 1);
  assert.equal(calls.filter((c) => c.fn === "complete_stripe_event").length, 1);
});

test("a member Session completion still transitions its attempt", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [publicCs({
      id: "cs_member", metadata: { financial_version: "v2", attempt_id: "att_member" },
      customer_details: null,
    })],
    transition_checkout_session: () => null,
    complete_stripe_event: () => null,
  });

  await runEventWorker(client, { livemode: true });

  const tr = calls.filter((c) => c.fn === "transition_checkout_session");
  assert.equal(tr.length, 1);
  assert.equal(tr[0]!.args.p_attempt_id, "att_member");
  assert.equal(calls.filter((c) => c.fn === "link_public_supporter").length, 0);
});

test("a refund on a public contribution becomes one parented NEGATIVE entry", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev({
      event_id: "evt_rf",
      event_type: "charge.refunded",
      object_id: "ch_pub",
      livemode: true,
      payload: { data: { object: {
        id: "ch_pub", payment_intent: "pi_pub",
        refunds: { data: [
          { id: "re_1", amount: 10330, created: 1_766_100_000 },
          { id: "re_zero", amount: 0 }, // malformed: skipped, never sent as 0
        ] },
      } } },
    })],
    record_public_support_refund: () => "entry_rf",
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  const rf = calls.filter((c) => c.fn === "record_public_support_refund");
  assert.equal(rf.length, 1);
  assert.equal(rf[0]!.args.p_refund_id, "re_1");
  assert.equal(rf[0]!.args.p_payment_intent_id, "pi_pub");
  assert.equal(rf[0]!.args.p_amount_cents, -10330, "stored refund is negative");
  assert.equal(rf[0]!.args.p_livemode, true);
  assert.equal(r.processed, 1);
});

test("a refund on a MEMBER charge is not the public path's business", async () => {
  // VK404 from the refund recorder means the PI belongs to the member ledger;
  // member refunds flow through reconciliation as before.
  const { client } = fakeClient({
    claim_stripe_events: () => [ev({
      event_id: "evt_rf_member",
      event_type: "charge.refunded",
      object_id: "ch_member",
      livemode: true,
      payload: { data: { object: {
        id: "ch_member", payment_intent: "pi_member",
        refunds: { data: [{ id: "re_m", amount: 500 }] },
      } } },
    })],
    record_public_support_refund: () => vkErr("VK404", "not a public entry"),
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  assert.equal(r.processed, 1);
  assert.equal(r.failed, 0);
});

test("a real refund-recording failure fails the event with the reason", async () => {
  const { client, calls } = fakeClient({
    claim_stripe_events: () => [ev({
      event_id: "evt_rf_bad",
      event_type: "charge.refunded",
      object_id: "ch_pub",
      livemode: true,
      payload: { data: { object: {
        id: "ch_pub", payment_intent: "pi_pub",
        refunds: { data: [{ id: "re_1", amount: 10330 }] },
      } } },
    })],
    record_public_support_refund: () => vkErr("VK500", "refund exceeds remaining"),
    complete_stripe_event: () => null,
  });

  const r = await runEventWorker(client, { livemode: true });

  assert.equal(r.failed, 1);
  const done = calls.filter((c) => c.fn === "complete_stripe_event").at(-1);
  assert.equal(done?.args.p_status, "failed");
  assert.match(String(done?.args.p_error), /refund exceeds remaining/);
});
