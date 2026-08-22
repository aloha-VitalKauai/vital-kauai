/**
 * PR 6 closeout — stranded-attempt and stale-session recovery.
 *
 * Every branch here only ever runs after something already went wrong, so none
 * of it is exercised by ordinary use. The Stripe surface is injected and the
 * Supabase client is faked at `.schema().rpc()`; what is asserted is which
 * database call was made, which was NOT made, and whether the single-flight
 * slot moved.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  findSessionsForAttempt,
  recoverStaleSession,
  recoverStrandedAttempt,
  runCheckoutRecovery,
  ENUMERATION_MAX_PAGES,
  IDEMPOTENCY_WINDOW_HOURS,
  MAX_RECOVERY_ATTEMPTS,
  type CheckoutGateway,
  type GatewaySession,
  type StaleSession,
  type StrandedAttempt,
} from "./checkout-recovery.ts";

type RpcCall = { fn: string; args: Record<string, unknown> };

function fakeClient(
  handlers: Record<string, (args: Record<string, unknown>) => unknown> = {},
  balance: { payable_remaining_cents: number; payment_state: string } | null =
    { payable_remaining_cents: 10000, payment_state: "unpaid" },
) {
  const calls: RpcCall[] = [];
  const client = {
    schema() {
      return {
        from() {
          return {
            select() { return this; },
            eq() { return this; },
            returns() { return Promise.resolve({ data: balance ? [balance] : [], error: null }); },
          };
        },
        rpc(fn: string, args: Record<string, unknown>) {
          calls.push({ fn, args });
          const h = handlers[fn];
          if (!h) return Promise.resolve({ data: null, error: null });
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

function called(calls: RpcCall[], fn: string): RpcCall[] {
  return calls.filter((c) => c.fn === fn);
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}

function attempt(o: Partial<StrandedAttempt> = {}): StrandedAttempt {
  return {
    attempt_id: "att_1",
    agreement_id: "agr_1",
    payment_link_id: null,
    amount_cents: 10000,
    idempotency_key: "vk2_member_contribution_m1_r1",
    livemode: true,
    created_at: hoursAgo(1),
    recovery_attempts: 1,
    purpose: "journey_contribution",
    ...o,
  };
}

function staleSession(o: Partial<StaleSession> = {}): StaleSession {
  return {
    attempt_id: "att_1",
    agreement_id: "agr_1",
    stripe_session_id: "cs_live_1",
    livemode: true,
    expires_at: hoursAgo(2),
    recovery_attempts: 1,
    ...o,
  };
}

/** Gateway whose pages/objects are declared per test; records every call. */
function gateway(opts: {
  pages?: GatewaySession[][];
  retrieve?: GatewaySession | (() => GatewaySession);
  expire?: GatewaySession | (() => GatewaySession);
  create?: { id: string; expiresAt: number | null } | (() => never);
  listThrows?: boolean;
} = {}): {
  gw: CheckoutGateway; log: string[]; createKeys: string[];
  windows: { createdGte: number; createdLte: number }[];
} {
  const log: string[] = [];
  const createKeys: string[] = [];
  const windows: { createdGte: number; createdLte: number }[] = [];
  const pages = opts.pages ?? [[]];
  let pageIndex = 0;
  const gw: CheckoutGateway = {
    async listSessionsPage(params) {
      log.push("list");
      windows.push({ createdGte: params.createdGte, createdLte: params.createdLte });
      if (opts.listThrows) throw new Error("stripe unreachable");
      const data = pages[pageIndex] ?? [];
      pageIndex += 1;
      return { data, hasMore: pageIndex < pages.length };
    },
    async retrieveSession(id) {
      log.push("retrieve");
      const r = typeof opts.retrieve === "function" ? opts.retrieve() : opts.retrieve;
      if (!r) throw new Error("retrieve failed");
      return { ...r, id };
    },
    async expireSession(id) {
      log.push("expire");
      const e = typeof opts.expire === "function" ? opts.expire() : opts.expire;
      if (!e) throw new Error("expire refused");
      return { ...e, id };
    },
    async memberEmail() {
      log.push("email");
      return "member@example.com";
    },
    async createSession({ idempotencyKey }) {
      log.push("create");
      createKeys.push(idempotencyKey);
      if (typeof opts.create === "function") opts.create();
      if (!opts.create) throw new Error("create failed");
      return opts.create;
    },
  };
  return { gw, log, createKeys, windows };
}

const S = (id: string, attemptId: string, o: Partial<GatewaySession> = {}): GatewaySession => ({
  id, status: "open", expires_at: 1800000000, metadata: { attempt_id: attemptId }, ...o,
});

// ── Enumeration ──────────────────────────────────────────────────────────────

test("enumeration walks every page and matches only on attempt_id", async () => {
  const { gw, log } = gateway({
    pages: [
      [S("cs_a", "other"), S("cs_b", "other")],
      [S("cs_c", "att_1")],
      [S("cs_d", "other")],
    ],
  });
  const found = await findSessionsForAttempt(gw, "att_1", Date.now());
  assert.equal(log.filter((l) => l === "list").length, 3, "must exhaust all pages");
  assert.equal(found.exhaustive, true);
  assert.deepEqual(found.matches.map((m) => m.id), ["cs_c"]);
});

test("a truncated page walk is reported as NOT exhaustive", async () => {
  // Every page says there is more, so the cap is hit with pages outstanding.
  const pages = Array.from({ length: ENUMERATION_MAX_PAGES + 5 }, () => [S("cs_x", "other")]);
  const { gw } = gateway({ pages });
  const found = await findSessionsForAttempt(gw, "att_1", Date.now());
  assert.equal(found.exhaustive, false);
  assert.equal(found.matches.length, 0);
});

// ── Stranded attempts ────────────────────────────────────────────────────────

test("crash after the Stripe Session was created: enumeration adopts it, no new Session", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[S("cs_found", "att_1")]] });

  const outcome = await recoverStrandedAttempt(client, gw, attempt());

  assert.equal(outcome, "finalized");
  assert.ok(!log.includes("create"), "must never create a second Session when one exists");
  const fin = called(calls, "finalize_checkout_session");
  assert.equal(fin.length, 1);
  assert.equal(fin[0]!.args.p_stripe_session_id, "cs_found");
  assert.equal(called(calls, "raise_reconciliation_exception").length, 0);
});

test("crash before the Stripe call, inside 23h: replays with the EXACT persisted key", async () => {
  const { client, calls } = fakeClient();
  const { gw, createKeys } = gateway({
    pages: [[]],
    create: { id: "cs_new", expiresAt: 1800000000 },
  });

  const a = attempt({ created_at: hoursAgo(2), idempotency_key: "vk2_checkout_att_1" });
  const outcome = await recoverStrandedAttempt(client, gw, a);

  assert.equal(outcome, "replayed");
  assert.deepEqual(createKeys, ["vk2_checkout_att_1"], "replay must reuse the persisted key");
  assert.equal(called(calls, "finalize_checkout_session")[0]!.args.p_stripe_session_id, "cs_new");
});

test("beyond 23h with zero matches after exhaustive enumeration: cancels, never replays", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[S("cs_other", "someone_else")]] });

  const a = attempt({ created_at: hoursAgo(IDEMPOTENCY_WINDOW_HOURS + 2) });
  const outcome = await recoverStrandedAttempt(client, gw, a);

  assert.equal(outcome, "canceled");
  assert.ok(!log.includes("create"), "the idempotency key is dead; replay would mint a second Session");
  const tr = called(calls, "transition_checkout_session");
  assert.equal(tr.length, 1);
  assert.equal(tr[0]!.args.p_to_status, "canceled");
});

test("beyond 23h with exactly one match: adopts it", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[S("cs_late", "att_1")]] });

  const outcome = await recoverStrandedAttempt(
    client, gw, attempt({ created_at: hoursAgo(IDEMPOTENCY_WINDOW_HOURS + 10) }),
  );

  assert.equal(outcome, "finalized");
  assert.ok(!log.includes("create"));
  assert.equal(called(calls, "finalize_checkout_session").length, 1);
});

test("multiple Sessions claiming one attempt is ambiguous: no write, typed exception", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[S("cs_1", "att_1"), S("cs_2", "att_1")]] });

  const outcome = await recoverStrandedAttempt(client, gw, attempt());

  assert.equal(outcome, "ambiguous");
  assert.ok(!log.includes("create"));
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
  assert.equal(called(calls, "transition_checkout_session").length, 0);
  const exc = called(calls, "raise_reconciliation_exception");
  assert.equal(exc.length, 1);
  assert.equal(exc[0]!.args.p_kind, "stranded_checkout_attempt");
  const detail = exc[0]!.args.p_detail as { reason: string; candidates: string[] };
  assert.equal(detail.reason, "multiple_sessions_match_attempt");
  assert.deepEqual(detail.candidates, ["cs_1", "cs_2"]);
});

test("a non-exhaustive sweep never concludes the Session is absent", async () => {
  const { client, calls } = fakeClient();
  const pages = Array.from({ length: ENUMERATION_MAX_PAGES + 1 }, () => [S("cs_x", "other")]);
  const { gw, log } = gateway({ pages });

  const outcome = await recoverStrandedAttempt(client, gw, attempt({ created_at: hoursAgo(40) }));

  assert.equal(outcome, "ambiguous");
  assert.equal(called(calls, "transition_checkout_session").length, 0, "must not cancel on unproven absence");
  assert.ok(!log.includes("create"));
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "enumeration_not_exhaustive",
  );
});

test("an idempotency collision on replay is reported, never guessed at", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({
    pages: [[]],
    create: () => { throw new Error("Keys for idempotent requests can only be used with the same parameters"); },
  });

  const outcome = await recoverStrandedAttempt(client, gw, attempt({ created_at: hoursAgo(3) }));

  assert.equal(outcome, "ambiguous");
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "idempotency_key_already_used",
  );
});

test("a Session that already completed is never adopted as open", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ pages: [[S("cs_done", "att_1", { status: "complete" })]] });

  const outcome = await recoverStrandedAttempt(client, gw, attempt());

  assert.equal(outcome, "ambiguous");
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "session_completed_while_attempt_stranded",
  );
});

test("a provider read failure releases the claim and changes nothing", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ listThrows: true });

  const outcome = await recoverStrandedAttempt(client, gw, attempt());

  assert.equal(outcome, "error");
  assert.equal(called(calls, "transition_checkout_session").length, 0);
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
  assert.equal(called(calls, "release_recovery_claim").length, 1, "must be retried next cycle");
});

test("the circuit breaker stops after MAX_RECOVERY_ATTEMPTS without calling Stripe", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[S("cs_1", "att_1")]] });

  const outcome = await recoverStrandedAttempt(
    client, gw, attempt({ recovery_attempts: MAX_RECOVERY_ATTEMPTS + 1 }),
  );

  assert.equal(outcome, "exhausted");
  assert.deepEqual(log, [], "no Stripe call once the breaker is open");
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "recovery_exhausted",
  );
});

// ── Stale sessions ───────────────────────────────────────────────────────────

test("Stripe-confirmed expiry frees the single-flight slot", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ retrieve: { id: "cs_live_1", status: "expired" } });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "expired");
  const tr = called(calls, "transition_checkout_session");
  assert.equal(tr.length, 1);
  assert.equal(tr[0]!.args.p_to_status, "expired");
  assert.equal(called(calls, "raise_reconciliation_exception").length, 0);
});

test("a session Stripe still calls open is expired, then CONFIRMED before the slot moves", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({
    retrieve: { id: "cs_live_1", status: "open" },
    expire: { id: "cs_live_1", status: "expired" },
  });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "expired");
  assert.deepEqual(log, ["retrieve", "expire"]);
  assert.equal(called(calls, "transition_checkout_session")[0]!.args.p_to_status, "expired");
});

test("unconfirmed expiry PRESERVES the slot and raises stale_session_expiry_failed", async () => {
  const { client, calls } = fakeClient();
  // Stripe accepts the call but still does not report the session expired.
  const { gw } = gateway({
    retrieve: { id: "cs_live_1", status: "open" },
    expire: { id: "cs_live_1", status: "open" },
  });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "unconfirmed");
  assert.equal(called(calls, "transition_checkout_session").length, 0, "slot must stay held");
  const exc = called(calls, "raise_reconciliation_exception");
  assert.equal(exc[0]!.args.p_kind, "stale_session_expiry_failed");
  assert.equal((exc[0]!.args.p_detail as { reason: string }).reason, "expiry_not_confirmed");
});

test("an expire call that throws preserves the slot", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ retrieve: { id: "cs_live_1", status: "open" }, expire: undefined });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "unconfirmed");
  assert.equal(called(calls, "transition_checkout_session").length, 0);
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "expire_call_failed",
  );
});

test("a retrieve failure preserves the slot and never expires blind", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ retrieve: undefined });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "unconfirmed");
  assert.equal(called(calls, "transition_checkout_session").length, 0);
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "retrieve_failed",
  );
});

test("a settled session is closed as completed, not expired", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ retrieve: { id: "cs_live_1", status: "complete", payment_status: "paid" } });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "completed");
  assert.equal(called(calls, "transition_checkout_session")[0]!.args.p_to_status, "completed");
});

test("complete-but-unpaid is not interpreted: slot held, exception raised", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ retrieve: { id: "cs_live_1", status: "complete", payment_status: "unpaid" } });

  const outcome = await recoverStaleSession(client, gw, staleSession());

  assert.equal(outcome, "unconfirmed");
  assert.equal(called(calls, "transition_checkout_session").length, 0);
  assert.equal(
    (called(calls, "raise_reconciliation_exception")[0]!.args.p_detail as { reason: string }).reason,
    "session_complete_but_unpaid",
  );
});

// ── Orchestration ────────────────────────────────────────────────────────────

test("the sweep claims through the database, which is what makes it single-flight", async () => {
  const { client, calls } = fakeClient({
    claim_stranded_attempts: () => [attempt()],
    claim_stale_sessions: () => [],
  });
  const { gw } = gateway({ pages: [[S("cs_found", "att_1")]] });

  const result = await runCheckoutRecovery(client, gw);

  assert.equal(result.strandedClaimed, 1);
  assert.equal(result.outcomes.finalized, 1);
  // A second worker sees whatever the claim function returns — the exclusion is
  // the persisted claim, not anything in this process.
  const claim = called(calls, "claim_stranded_attempts")[0]!;
  assert.equal(claim.args.p_older_than, "15 minutes", "fresh attempts are left alone");
  assert.equal(claim.args.p_claim_ttl, "10 minutes");
});

test("a second concurrent sweep claims nothing and does nothing", async () => {
  // The database hands the rows to the first caller only; the loser gets [].
  const { client, calls } = fakeClient({
    claim_stranded_attempts: () => [],
    claim_stale_sessions: () => [],
  });
  const { gw, log } = gateway();

  const result = await runCheckoutRecovery(client, gw);

  assert.equal(result.strandedClaimed, 0);
  assert.equal(result.staleClaimed, 0);
  assert.deepEqual(log, [], "no Stripe traffic for an empty claim");
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
});

test("a claim failure surfaces instead of being reported as a clean sweep", async () => {
  const { client } = fakeClient({
    claim_stranded_attempts: () => { throw new Error("deadlock detected"); },
  });
  const { gw } = gateway();
  await assert.rejects(() => runCheckoutRecovery(client, gw), /deadlock detected/);
});

// ── Adversarial-review fixes ─────────────────────────────────────────────────

test("enumeration searches up to NOW, so a Session created by a late replay is visible", async () => {
  // The duplicate-charge path: an attempt from 22h ago whose replay created a
  // Session 22h AFTER the row. A window anchored to created_at + 2h would miss
  // it, read zero as proof of absence, and cancel a live payable Session.
  const createdAtMs = Date.now() - 22 * 3_600_000;
  const { gw, windows } = gateway({ pages: [[]] });

  await findSessionsForAttempt(gw, "att_1", createdAtMs);

  const w = windows[0]!;
  assert.ok(
    w.createdLte >= Math.floor(Date.now() / 1000),
    "upper bound must reach the present, not a fixed offset from the attempt row",
  );
  assert.ok(w.createdGte <= Math.floor(createdAtMs / 1000), "lower bound must precede the attempt");
  const spanHours = (w.createdLte - w.createdGte) / 3600;
  assert.ok(spanHours > 22, `window spanned only ${spanHours.toFixed(1)}h`);
});

test("a Session created hours after its attempt row is still adopted, never cancelled", async () => {
  const { client, calls } = fakeClient();
  // Beyond the idempotency window, with the Session found by the widened sweep.
  const { gw, log } = gateway({ pages: [[S("cs_late_replay", "att_1")]] });

  const outcome = await recoverStrandedAttempt(
    client, gw, attempt({ created_at: hoursAgo(30) }),
  );

  assert.equal(outcome, "finalized");
  assert.equal(called(calls, "transition_checkout_session").length, 0, "must not cancel a live Session");
  assert.ok(!log.includes("create"));
});

test("fail-closed: with checkout paused, recovery never mints a new payable Session", async () => {
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[]], create: { id: "cs_should_not_exist", expiresAt: null } });

  const outcome = await recoverStrandedAttempt(
    client, gw, attempt({ created_at: hoursAgo(2) }), { allowSessionCreation: false },
  );

  assert.equal(outcome, "deferred");
  assert.ok(!log.includes("create"), "a paused platform must not create Sessions");
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
  assert.equal(called(calls, "release_recovery_claim").length, 1, "claim released for a later pass");
});

test("with checkout paused, cleanup still adopts and still cancels", async () => {
  const adopt = fakeClient();
  const { gw: gwAdopt } = gateway({ pages: [[S("cs_found", "att_1")]] });
  assert.equal(
    await recoverStrandedAttempt(adopt.client, gwAdopt, attempt(), { allowSessionCreation: false }),
    "finalized",
  );

  const cancel = fakeClient();
  const { gw: gwCancel } = gateway({ pages: [[]] });
  assert.equal(
    await recoverStrandedAttempt(cancel.client, gwCancel, attempt({ created_at: hoursAgo(40) }),
      { allowSessionCreation: false }),
    "canceled",
  );
});

test("the sweep passes the readiness gate through to each attempt", async () => {
  const { client, calls } = fakeClient({
    claim_stranded_attempts: () => [attempt({ created_at: hoursAgo(2) })],
    claim_stale_sessions: () => [],
  });
  const { gw, log } = gateway({ pages: [[]], create: { id: "cs_x", expiresAt: null } });

  const result = await runCheckoutRecovery(client, gw, { allowSessionCreation: false });

  assert.equal(result.outcomes.deferred, 1);
  assert.ok(!log.includes("create"));
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
});

// ── Bounded adversarial review fixes ─────────────────────────────────────────

test("a deferred pass does NOT spend one of the attempt's lives", async () => {
  // recovery_attempts is incremented at claim time. Without an undo, pausing
  // checkout for an hour exhausts every in-flight attempt and holds its slot
  // forever — the opposite of what the kill switch is for.
  const { client, calls } = fakeClient();
  const { gw } = gateway({ pages: [[]], create: { id: "cs_no", expiresAt: null } });

  const outcome = await recoverStrandedAttempt(
    client, gw, attempt({ created_at: hoursAgo(2) }), { allowSessionCreation: false },
  );

  assert.equal(outcome, "deferred");
  const rel = called(calls, "release_recovery_claim");
  assert.equal(rel.length, 1);
  assert.equal(rel[0]!.args.p_undo_attempt, true, "a no-decision pass must roll the counter back");
});

test("a provider read outage does NOT spend one of the attempt's lives", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ listThrows: true });

  await recoverStrandedAttempt(client, gw, attempt());

  assert.equal(called(calls, "release_recovery_claim")[0]!.args.p_undo_attempt, true);
});

test("the sweep claims only the mode its Stripe key belongs to", async () => {
  const { client, calls } = fakeClient({
    claim_stranded_attempts: () => [],
    claim_stale_sessions: () => [],
  });
  const { gw } = gateway();

  await runCheckoutRecovery(client, gw, { livemode: true });

  assert.equal(called(calls, "claim_stranded_attempts")[0]!.args.p_livemode, true);
  assert.equal(called(calls, "claim_stale_sessions")[0]!.args.p_livemode, true);

  const test2 = fakeClient({ claim_stranded_attempts: () => [], claim_stale_sessions: () => [] });
  await runCheckoutRecovery(test2.client, gateway().gw, { livemode: false });
  assert.equal(called(test2.calls, "claim_stranded_attempts")[0]!.args.p_livemode, false);
});

test("a founder-link attempt is never replayed: its request cannot be rebuilt", async () => {
  // cancel_url embeds the raw token, which is hashed at rest. A rebuilt request
  // would differ, so Stripe would reject the key and the replay could never
  // return the original Session.
  const { client, calls } = fakeClient();
  const { gw, log } = gateway({ pages: [[]], create: { id: "cs_never", expiresAt: null } });

  const outcome = await recoverStrandedAttempt(
    client, gw, attempt({ created_at: hoursAgo(2), payment_link_id: "link_1" }),
  );

  assert.equal(outcome, "canceled");
  assert.ok(!log.includes("create"));
  assert.equal(called(calls, "transition_checkout_session")[0]!.args.p_to_status, "canceled");
});

test("a drifted amount cancels instead of replaying a stale figure", async () => {
  // The attempt captured 10000 up to 23h ago; canonical truth now says 25000.
  const { client, calls } = fakeClient({}, { payable_remaining_cents: 25000, payment_state: "unpaid" });
  const { gw, log } = gateway({ pages: [[]], create: { id: "cs_stale", expiresAt: null } });

  const outcome = await recoverStrandedAttempt(client, gw, attempt({ created_at: hoursAgo(2) }));

  assert.equal(outcome, "canceled");
  assert.ok(!log.includes("create"), "must not send the member to a figure they never agreed to");
  assert.equal(called(calls, "transition_checkout_session")[0]!.args.p_to_status, "canceled");
});

test("an agreement already paid is never given a new payable Session", async () => {
  const { client, calls } = fakeClient({}, { payable_remaining_cents: 0, payment_state: "paid" });
  const { gw, log } = gateway({ pages: [[]], create: { id: "cs_paid", expiresAt: null } });

  const outcome = await recoverStrandedAttempt(client, gw, attempt({ created_at: hoursAgo(2) }));

  assert.equal(outcome, "canceled");
  assert.ok(!log.includes("create"));
  assert.equal(called(calls, "finalize_checkout_session").length, 0);
});

test("a replay whose finalize fails expires the Session it just created", async () => {
  // Otherwise a live payable Session carrying valid V2 metadata exists that the
  // database will never reference again.
  const { client, calls } = fakeClient({
    finalize_checkout_session: () => { throw new Error("finalize: attempt is open, expected creating"); },
  });
  const { gw, log } = gateway({
    pages: [[]],
    create: { id: "cs_orphan", expiresAt: null },
    expire: { id: "cs_orphan", status: "expired" },
  });

  const outcome = await recoverStrandedAttempt(client, gw, attempt({ created_at: hoursAgo(2) }));

  assert.equal(outcome, "error");
  assert.ok(log.includes("expire"), "the orphaned Session must be unwound at Stripe");
  assert.equal(called(calls, "raise_reconciliation_exception").length, 0);
});

test("an orphaned Session that cannot be expired becomes a founder-visible exception", async () => {
  const { client, calls } = fakeClient({
    finalize_checkout_session: () => { throw new Error("finalize failed"); },
  });
  const { gw } = gateway({
    pages: [[]],
    create: { id: "cs_orphan2", expiresAt: null },
    expire: undefined,
  });

  const outcome = await recoverStrandedAttempt(client, gw, attempt({ created_at: hoursAgo(2) }));

  assert.equal(outcome, "ambiguous");
  const exc = called(calls, "raise_reconciliation_exception")[0]!;
  assert.equal(exc.args.p_provider_object_id, "cs_orphan2");
  assert.equal(
    (exc.args.p_detail as { reason: string }).reason,
    "orphaned_session_after_finalize_failure",
  );
});

test("stale-session transitions name the Session they inspected", async () => {
  const { client, calls } = fakeClient();
  const { gw } = gateway({ retrieve: { id: "cs_live_1", status: "expired" } });

  await recoverStaleSession(client, gw, staleSession());

  assert.equal(
    called(calls, "transition_checkout_session")[0]!.args.p_stripe_session_id,
    "cs_live_1",
    "the database must be able to refuse an event that belongs to another Session",
  );
});
