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

function fakeClient(handlers: Record<string, (args: Record<string, unknown>) => unknown> = {}) {
  const calls: RpcCall[] = [];
  const client = {
    schema() {
      return {
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
} = {}): { gw: CheckoutGateway; log: string[]; createKeys: string[] } {
  const log: string[] = [];
  const createKeys: string[] = [];
  const pages = opts.pages ?? [[]];
  let pageIndex = 0;
  const gw: CheckoutGateway = {
    async listSessionsPage() {
      log.push("list");
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
    async createSession(_a, key) {
      log.push("create");
      createKeys.push(key);
      if (typeof opts.create === "function") opts.create();
      if (!opts.create) throw new Error("create failed");
      return opts.create;
    },
  };
  return { gw, log, createKeys };
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
