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
            return Promise.resolve({ data: null, error: { message: (e as Error).message } });
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
