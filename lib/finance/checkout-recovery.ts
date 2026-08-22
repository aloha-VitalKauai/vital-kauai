/**
 * Financials V2 — PR 6 closeout: stranded-attempt and stale-session recovery.
 *
 * Two failure shapes hold the one-live-Session slot for an agreement forever,
 * and PR 6 shipped without a driver for either:
 *
 *   1. STRANDED ATTEMPT — the durable `creating` row exists but we never learned
 *      Stripe's answer (crash, timeout, or a finalize that failed after the
 *      Session was created). We do not know whether a Session exists.
 *   2. STALE SESSION — an `open` row past its expiry. Our `expires_at` is a hint
 *      copied from Stripe at finalize; only Stripe may confirm the Session is
 *      actually dead.
 *
 * The governing rule in both cases is that ambiguity is never resolved by
 * guessing. Every branch below either reaches certainty about Stripe's state or
 * raises a typed exception and leaves the database exactly as it found it. A
 * wrong guess here is duplicate money or a member charged for an amount they
 * never agreed to.
 *
 * ORDER: enumeration (a read) comes before any write, even inside the
 * idempotency window. Finding the Session by `attempt_id` resolves the attempt
 * with no Stripe write at all, and it is the only way to learn the Session id —
 * an idempotent replay that collides returns an error, not the original object.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { v2StripeClient, v2Metadata, STRIPE_V2_API_VERSION } from "@/lib/finance/checkout";

/**
 * Stripe idempotency keys live 24 hours. We stop replaying at 23 so a key can
 * never expire mid-flight between the decision and the request.
 */
export const IDEMPOTENCY_WINDOW_HOURS = 23;

/** An attempt this many times unresolved stops burning Stripe calls. */
export const MAX_RECOVERY_ATTEMPTS = 5;

/** Fresh attempts are owned by the request that created them, not by us. */
export const STRANDED_AFTER = "15 minutes";

export const ENUMERATION_PAGE_SIZE = 100;
/**
 * Page cap. Hitting it means enumeration was NOT exhaustive, which is treated
 * as ambiguity — never as "no Session exists".
 */
export const ENUMERATION_MAX_PAGES = 50;

/**
 * Enumeration starts slightly before the attempt row to absorb clock skew and
 * runs to NOW — never to a fixed offset from the row.
 *
 * A replay may create the Session at any point inside the 23-hour window, so a
 * Session belonging to an attempt created at T0 can legitimately carry a Stripe
 * `created` of T0+22h. Bounding the search at T0+2h would make that Session
 * invisible to the next sweep, which would then read "zero matches" as proof of
 * absence and cancel the attempt — freeing the single-flight slot while a live,
 * payable Session still exists at Stripe. Two payable Sessions for one
 * agreement is the duplicate-charge case this whole module exists to prevent.
 */
const ENUMERATION_LOOKBACK_MS = 10 * 60 * 1000;
const ENUMERATION_SKEW_AHEAD_MS = 10 * 60 * 1000;

export type StrandedAttempt = {
  attempt_id: string;
  agreement_id: string;
  payment_link_id: string | null;
  amount_cents: number;
  idempotency_key: string;
  livemode: boolean;
  created_at: string;
  recovery_attempts: number;
};

export type StaleSession = {
  attempt_id: string;
  agreement_id: string;
  stripe_session_id: string;
  livemode: boolean;
  expires_at: string;
  recovery_attempts: number;
};

export type GatewaySession = {
  id: string;
  status: string | null;
  payment_status?: string | null;
  expires_at?: number | null;
  metadata?: Record<string, string> | null;
};

/**
 * The Stripe surface recovery needs. Injected so every branch — including the
 * ones that only happen after a crash — is exercised by tests rather than
 * trusted.
 */
export interface CheckoutGateway {
  listSessionsPage(params: {
    createdGte: number;
    createdLte: number;
    startingAfter?: string;
    limit: number;
  }): Promise<{ data: GatewaySession[]; hasMore: boolean }>;
  retrieveSession(id: string): Promise<GatewaySession>;
  expireSession(id: string): Promise<GatewaySession>;
  createSession(
    attempt: StrandedAttempt,
    idempotencyKey: string,
  ): Promise<{ id: string; expiresAt: number | null }>;
}

export type RecoveryOutcome =
  | "finalized"
  | "replayed"
  | "canceled"
  | "expired"
  | "completed"
  | "ambiguous"
  | "unconfirmed"
  | "exhausted"
  | "deferred"
  | "error";

export type RecoveryResult = {
  strandedClaimed: number;
  staleClaimed: number;
  outcomes: Record<string, number>;
};

function bump(out: Record<string, number>, key: RecoveryOutcome): void {
  out[key] = (out[key] ?? 0) + 1;
}

/** Exhaustive enumeration, matching ONLY on our own attempt_id in metadata. */
export async function findSessionsForAttempt(
  gateway: CheckoutGateway,
  attemptId: string,
  createdAtMs: number,
): Promise<{ matches: GatewaySession[]; exhaustive: boolean }> {
  const createdGte = Math.floor((createdAtMs - ENUMERATION_LOOKBACK_MS) / 1000);
  const createdLte = Math.ceil((Date.now() + ENUMERATION_SKEW_AHEAD_MS) / 1000);

  const matches: GatewaySession[] = [];
  let startingAfter: string | undefined;

  for (let page = 0; page < ENUMERATION_MAX_PAGES; page += 1) {
    const { data, hasMore } = await gateway.listSessionsPage({
      createdGte,
      createdLte,
      startingAfter,
      limit: ENUMERATION_PAGE_SIZE,
    });
    for (const s of data) {
      // Amount, timing and customer are all forgeable coincidences. The only
      // identity we accept is the id we minted and wrote into metadata.
      if (s.metadata?.attempt_id === attemptId) matches.push(s);
    }
    if (!hasMore) return { matches, exhaustive: true };
    const last = data[data.length - 1];
    if (!last) return { matches, exhaustive: true };
    startingAfter = last.id;
  }
  // Page cap reached with more pages outstanding: we cannot claim to know.
  return { matches, exhaustive: false };
}

async function raiseException(
  fin: ReturnType<SupabaseClient["schema"]>,
  args: {
    kind: "stranded_checkout_attempt" | "stale_session_expiry_failed";
    livemode: boolean;
    detail: Record<string, unknown>;
    agreementId: string;
    providerObjectId?: string | null;
    amountCents?: number | null;
  },
): Promise<void> {
  const { error } = await fin.rpc("raise_reconciliation_exception", {
    p_kind: args.kind,
    p_livemode: args.livemode,
    p_detail: args.detail,
    p_run_id: null,
    p_provider_object_id: args.providerObjectId ?? null,
    p_ledger_entry_id: null,
    p_agreement_id: args.agreementId,
    p_legacy_donation_id: null,
    p_amount_cents: args.amountCents ?? null,
    p_currency: null,
  });
  if (error) console.error("checkout-recovery: could not raise exception", error.message);
}

/**
 * Resolve one stranded `creating` attempt.
 *
 * Returns the outcome; the caller counts them. The attempt's claim is released
 * only when a decision was reached — an ambiguous attempt keeps its claim until
 * the TTL so the same exception is not re-raised every cron tick.
 */
export async function recoverStrandedAttempt(
  client: SupabaseClient,
  gateway: CheckoutGateway,
  attempt: StrandedAttempt,
  opts: { allowSessionCreation?: boolean } = {},
): Promise<RecoveryOutcome> {
  const allowSessionCreation = opts.allowSessionCreation ?? true;
  const fin = client.schema("finance_api");

  // Circuit breaker before any Stripe call.
  if (attempt.recovery_attempts > MAX_RECOVERY_ATTEMPTS) {
    await raiseException(fin, {
      kind: "stranded_checkout_attempt",
      livemode: attempt.livemode,
      agreementId: attempt.agreement_id,
      amountCents: attempt.amount_cents,
      detail: {
        attempt_id: attempt.attempt_id,
        reason: "recovery_exhausted",
        recovery_attempts: attempt.recovery_attempts,
        note: "Automatic recovery gave up; resolve by hand before re-enabling this agreement's checkout.",
      },
    });
    return "exhausted";
  }

  const createdAtMs = new Date(attempt.created_at).getTime();
  const ageHours = (Date.now() - createdAtMs) / 3_600_000;

  let found: { matches: GatewaySession[]; exhaustive: boolean };
  try {
    found = await findSessionsForAttempt(gateway, attempt.attempt_id, createdAtMs);
  } catch (err) {
    // A provider read failure is not evidence of anything. Release and retry.
    console.error("checkout-recovery: enumeration failed", attempt.attempt_id,
      err instanceof Error ? err.message : err);
    await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
    return "error";
  }

  // More than one Session carrying our attempt_id must never be auto-resolved:
  // picking one silently decides which charge is real.
  if (found.matches.length > 1) {
    await raiseException(fin, {
      kind: "stranded_checkout_attempt",
      livemode: attempt.livemode,
      agreementId: attempt.agreement_id,
      amountCents: attempt.amount_cents,
      providerObjectId: null,
      detail: {
        attempt_id: attempt.attempt_id,
        reason: "multiple_sessions_match_attempt",
        candidates: found.matches.map((m) => m.id),
        note: "Two or more Checkout Sessions claim this attempt. No automatic choice is safe.",
      },
    });
    return "ambiguous";
  }

  if (found.matches.length === 1) {
    const session = found.matches[0]!;
    // Stripe already settled this Session: adopting it as `open` would be a lie,
    // and the ledger belongs to the PaymentIntent path either way.
    if (session.status === "complete") {
      await raiseException(fin, {
        kind: "stranded_checkout_attempt",
        livemode: attempt.livemode,
        agreementId: attempt.agreement_id,
        amountCents: attempt.amount_cents,
        providerObjectId: session.id,
        detail: {
          attempt_id: attempt.attempt_id,
          reason: "session_completed_while_attempt_stranded",
          note: "Session completed at Stripe but our attempt never opened. Confirm the ledger entry exists.",
        },
      });
      return "ambiguous";
    }
    const { error } = await fin.rpc("finalize_checkout_session", {
      p_attempt_id: attempt.attempt_id,
      p_stripe_session_id: session.id,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    });
    if (error) {
      console.error("checkout-recovery: finalize failed", attempt.attempt_id, error.message);
      await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
      return "error";
    }
    await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
    return "finalized";
  }

  // ── Zero matches ──
  // Only trustworthy if the sweep was exhaustive. A truncated page walk that
  // found nothing is indistinguishable from a Session we failed to reach.
  if (!found.exhaustive) {
    await raiseException(fin, {
      kind: "stranded_checkout_attempt",
      livemode: attempt.livemode,
      agreementId: attempt.agreement_id,
      amountCents: attempt.amount_cents,
      detail: {
        attempt_id: attempt.attempt_id,
        reason: "enumeration_not_exhaustive",
        pages_scanned: ENUMERATION_MAX_PAGES,
        note: "Ran out of pages before Stripe ran out of Sessions; absence is unproven.",
      },
    });
    return "ambiguous";
  }

  if (ageHours < IDEMPOTENCY_WINDOW_HOURS) {
    // Fail-closed: while checkout is paused, recovery may still adopt, cancel
    // and expire — but it must not mint a NEW payable Session. Otherwise
    // rolling the readiness flag back would not actually stop money moving.
    if (!allowSessionCreation) {
      await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
      return "deferred";
    }
    // Inside the window the persisted key still protects us: if a Session was
    // in fact created, Stripe collapses this into that same object rather than
    // making a second one.
    try {
      const created = await gateway.createSession(attempt, attempt.idempotency_key);
      const { error } = await fin.rpc("finalize_checkout_session", {
        p_attempt_id: attempt.attempt_id,
        p_stripe_session_id: created.id,
        p_expires_at: created.expiresAt ? new Date(created.expiresAt * 1000).toISOString() : null,
      });
      if (error) {
        console.error("checkout-recovery: finalize after replay failed", attempt.attempt_id, error.message);
        await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
        return "error";
      }
      await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
      return "replayed";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // An idempotency collision proves a Session exists that enumeration could
      // not see (Stripe list lag). Never guess its id — say so and let the next
      // pass find it.
      const collision = /idempot/i.test(message);
      await raiseException(fin, {
        kind: "stranded_checkout_attempt",
        livemode: attempt.livemode,
        agreementId: attempt.agreement_id,
        amountCents: attempt.amount_cents,
        detail: {
          attempt_id: attempt.attempt_id,
          reason: collision ? "idempotency_key_already_used" : "replay_failed",
          provider_message: message.slice(0, 300),
          note: collision
            ? "A Session exists for this key but was not visible to enumeration; it will be adopted on a later pass."
            : "Replay inside the idempotency window failed; nothing was charged.",
        },
      });
      return collision ? "ambiguous" : "error";
    }
  }

  // Beyond the window the key is dead: replaying would mint a SECOND Session.
  // Exhaustive enumeration already proved none exists, so the attempt is
  // provably empty and the slot is safe to free.
  const { error } = await fin.rpc("transition_checkout_session", {
    p_attempt_id: attempt.attempt_id,
    p_to_status: "canceled",
  });
  if (error) {
    console.error("checkout-recovery: cancel failed", attempt.attempt_id, error.message);
    await fin.rpc("release_recovery_claim", { p_attempt_id: attempt.attempt_id });
    return "error";
  }
  return "canceled";
}

/**
 * Resolve one `open` session past its expiry.
 *
 * The slot is freed only on Stripe's word. If we cannot get that word, the slot
 * stays held and a `stale_session_expiry_failed` exception is raised — holding a
 * slot is an inconvenience, releasing one that is still live risks two payable
 * Sessions for the same agreement.
 */
export async function recoverStaleSession(
  client: SupabaseClient,
  gateway: CheckoutGateway,
  session: StaleSession,
): Promise<RecoveryOutcome> {
  const fin = client.schema("finance_api");

  if (session.recovery_attempts > MAX_RECOVERY_ATTEMPTS) {
    await raiseException(fin, {
      kind: "stale_session_expiry_failed",
      livemode: session.livemode,
      agreementId: session.agreement_id,
      providerObjectId: session.stripe_session_id,
      detail: {
        attempt_id: session.attempt_id,
        reason: "recovery_exhausted",
        recovery_attempts: session.recovery_attempts,
        note: "Expiry could not be confirmed after repeated tries; the single-flight slot is still held.",
      },
    });
    return "exhausted";
  }

  let current: GatewaySession;
  try {
    current = await gateway.retrieveSession(session.stripe_session_id);
  } catch (err) {
    await raiseException(fin, {
      kind: "stale_session_expiry_failed",
      livemode: session.livemode,
      agreementId: session.agreement_id,
      providerObjectId: session.stripe_session_id,
      detail: {
        attempt_id: session.attempt_id,
        reason: "retrieve_failed",
        provider_message: (err instanceof Error ? err.message : String(err)).slice(0, 300),
        note: "Stripe state unknown; the slot is preserved deliberately.",
      },
    });
    return "unconfirmed";
  }

  // Settled, not stale. Closing it as `completed` is the truthful terminal
  // state and frees the slot; the ledger is written by the PaymentIntent path
  // and is unaffected by this transition.
  if (current.status === "complete") {
    if (current.payment_status === "paid") {
      const { error } = await fin.rpc("transition_checkout_session", {
        p_attempt_id: session.attempt_id,
        p_to_status: "completed",
      });
      if (error) {
        console.error("checkout-recovery: complete transition failed", session.attempt_id, error.message);
        return "error";
      }
      return "completed";
    }
    // Complete but unpaid is a state we must not interpret.
    await raiseException(fin, {
      kind: "stale_session_expiry_failed",
      livemode: session.livemode,
      agreementId: session.agreement_id,
      providerObjectId: session.stripe_session_id,
      detail: {
        attempt_id: session.attempt_id,
        reason: "session_complete_but_unpaid",
        payment_status: current.payment_status ?? null,
        note: "Stripe reports the Session complete without payment; not expiring it.",
      },
    });
    return "unconfirmed";
  }

  if (current.status === "expired") {
    const { error } = await fin.rpc("transition_checkout_session", {
      p_attempt_id: session.attempt_id,
      p_to_status: "expired",
    });
    if (error) {
      console.error("checkout-recovery: expire transition failed", session.attempt_id, error.message);
      return "error";
    }
    return "expired";
  }

  // Stripe still considers it open: our expires_at ran ahead of the provider.
  // Ask Stripe to expire it, then require Stripe to say it did.
  let confirmed: GatewaySession;
  try {
    confirmed = await gateway.expireSession(session.stripe_session_id);
    if (confirmed.status !== "expired") {
      confirmed = await gateway.retrieveSession(session.stripe_session_id);
    }
  } catch (err) {
    await raiseException(fin, {
      kind: "stale_session_expiry_failed",
      livemode: session.livemode,
      agreementId: session.agreement_id,
      providerObjectId: session.stripe_session_id,
      detail: {
        attempt_id: session.attempt_id,
        reason: "expire_call_failed",
        provider_message: (err instanceof Error ? err.message : String(err)).slice(0, 300),
        note: "Expiry was refused or unreachable; the slot is preserved.",
      },
    });
    return "unconfirmed";
  }

  if (confirmed.status !== "expired") {
    await raiseException(fin, {
      kind: "stale_session_expiry_failed",
      livemode: session.livemode,
      agreementId: session.agreement_id,
      providerObjectId: session.stripe_session_id,
      detail: {
        attempt_id: session.attempt_id,
        reason: "expiry_not_confirmed",
        provider_status: confirmed.status ?? null,
        note: "Stripe did not report the Session expired; the slot stays held.",
      },
    });
    return "unconfirmed";
  }

  const { error } = await fin.rpc("transition_checkout_session", {
    p_attempt_id: session.attempt_id,
    p_to_status: "expired",
  });
  if (error) {
    console.error("checkout-recovery: expire transition failed", session.attempt_id, error.message);
    return "error";
  }
  return "expired";
}

/** Claim and drive both recovery families. Safe to run concurrently. */
export async function runCheckoutRecovery(
  client: SupabaseClient,
  gateway: CheckoutGateway,
  opts: { strandedAfter?: string; limit?: number; allowSessionCreation?: boolean } = {},
): Promise<RecoveryResult> {
  const fin = client.schema("finance_api");
  const outcomes: Record<string, number> = {};

  const { data: strandedData, error: strandedErr } = await fin.rpc("claim_stranded_attempts", {
    p_older_than: opts.strandedAfter ?? STRANDED_AFTER,
    p_claim_ttl: "10 minutes",
    p_limit: opts.limit ?? 20,
  });
  if (strandedErr) throw new Error(`claim_stranded_attempts: ${strandedErr.message}`);
  const stranded = (strandedData as unknown as StrandedAttempt[] | null) ?? [];
  for (const attempt of stranded) {
    bump(outcomes, await recoverStrandedAttempt(client, gateway, attempt, {
      allowSessionCreation: opts.allowSessionCreation ?? true,
    }));
  }

  const { data: staleData, error: staleErr } = await fin.rpc("claim_stale_sessions", {
    p_claim_ttl: "10 minutes",
    p_limit: opts.limit ?? 20,
  });
  if (staleErr) throw new Error(`claim_stale_sessions: ${staleErr.message}`);
  const stale = (staleData as unknown as StaleSession[] | null) ?? [];
  for (const session of stale) {
    bump(outcomes, await recoverStaleSession(client, gateway, session));
  }

  return { strandedClaimed: stranded.length, staleClaimed: stale.length, outcomes };
}

/** The live gateway. Kept at the edge so the logic above stays pure. */
export function stripeCheckoutGateway(): CheckoutGateway {
  const stripe = v2StripeClient();
  return {
    async listSessionsPage({ createdGte, createdLte, startingAfter, limit }) {
      const page = await stripe.checkout.sessions.list({
        limit,
        created: { gte: createdGte, lte: createdLte },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      return {
        data: page.data.map((s) => ({
          id: s.id,
          status: s.status ?? null,
          payment_status: s.payment_status ?? null,
          expires_at: s.expires_at ?? null,
          metadata: s.metadata ?? null,
        })),
        hasMore: page.has_more,
      };
    },
    async retrieveSession(id) {
      const s = await stripe.checkout.sessions.retrieve(id);
      return {
        id: s.id,
        status: s.status ?? null,
        payment_status: s.payment_status ?? null,
        expires_at: s.expires_at ?? null,
        metadata: s.metadata ?? null,
      };
    },
    async expireSession(id) {
      const s = await stripe.checkout.sessions.expire(id);
      return { id: s.id, status: s.status ?? null };
    },
    async createSession(attempt, idempotencyKey) {
      const s = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: attempt.amount_cents,
                product_data: { name: "Vital Kauaʻi Contribution" },
              },
            },
          ],
          metadata: v2Metadata(attempt.agreement_id, attempt.attempt_id),
          payment_intent_data: { metadata: v2Metadata(attempt.agreement_id, attempt.attempt_id) },
          success_url: "https://vitalkauai.com/portal/donate?checkout=confirming&attempt=" + attempt.attempt_id,
          cancel_url: "https://vitalkauai.com/portal/donate?checkout=canceled&attempt=" + attempt.attempt_id,
        },
        { idempotencyKey },
      );
      return { id: s.id, expiresAt: s.expires_at ?? null };
    },
  };
}

/** Exported for the migration-alignment test. */
export const RECOVERY_STRIPE_API_VERSION = STRIPE_V2_API_VERSION;
