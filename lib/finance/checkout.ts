/**
 * Financials V2 — PR 6: the checkout service.
 *
 * Three-phase protocol (D-035): claim the link, persist the attempt, then
 * create/finalise the Stripe Session. Every phase is durable before the next
 * begins, so a crash leaves a row a sweeper can act on rather than an untracked
 * Stripe object. The idempotency key derives deterministically from the attempt
 * id, so replaying phase 3 returns the SAME Session from Stripe.
 *
 * The amount is computed inside `issue_payment_link` from the canonical view and
 * re-validated here before Stripe creation. The browser never supplies it.
 */

import { createHash, randomBytes } from "node:crypto";
import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** One V2 Stripe version everywhere; matches the live Workbench destination. */
export const STRIPE_V2_API_VERSION = "2026-03-25.dahlia";

export function financeServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function v2StripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(key, { apiVersion: STRIPE_V2_API_VERSION as any });
}

/** 32 random bytes, base64url — possession is the credential. Never stored. */
export function generateLinkToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 hash is stored or queried (spec §5). */
export function hashLinkToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64");
}

/** Deterministic per-attempt key: a replay reaches the SAME Stripe Session. */
export function checkoutIdempotencyKey(attemptId: string): string {
  return `vk2_checkout_${attemptId}`;
}

type PeekRow = {
  link_id: string; agreement_id: string; link_status: string;
  link_expires_at: string; session_id: string | null; session_status: string | null;
  stripe_session_id: string | null; session_amount_cents: number | null;
  payable_remaining_cents: number | null; payment_state: string | null;
};

export type TokenState =
  | { state: "unknown" }
  | { state: "expired" }
  | { state: "revoked" }
  | { state: "paid" }
  | { state: "open_session"; sessionId: string; stripeSessionId: string; amountCents: number }
  | { state: "processing" }
  | { state: "confirmed"; amountCents: number }
  | { state: "ready"; amountCents: number }
  | { state: "review" };

/**
 * What should this token holder see? Read-only: zero mutations and zero Stripe
 * calls for every terminal state (behavioral proof #21).
 */
export async function resolveTokenState(token: string): Promise<TokenState> {
  const fin = financeServiceClient().schema("finance_api");
  const { data, error } = await fin.rpc("peek_payment_link", {
    p_token_hash: hashLinkToken(token),
  });
  if (error) throw new Error(`peek failed: ${error.message}`);
  const row = (data as unknown as PeekRow[] | null)?.[0];
  if (!row) return { state: "unknown" };

  // Money already settled? The canonical state outranks every link state.
  if (row.payment_state === "paid" || row.payment_state === "overpaid") {
    if (row.session_status === "completed") {
      return { state: "confirmed", amountCents: row.session_amount_cents ?? 0 };
    }
    return { state: "paid" };
  }

  if (row.link_status === "revoked") return { state: "revoked" };

  if (row.link_status === "consumed") {
    if (row.session_status === "open" && row.stripe_session_id && row.session_id) {
      return {
        state: "open_session",
        sessionId: row.session_id,
        stripeSessionId: row.stripe_session_id,
        amountCents: row.session_amount_cents ?? 0,
      };
    }
    if (row.session_status === "completed") return { state: "processing" };
    // consumed but its session expired/canceled: nothing payable through this link
    return { state: "review" };
  }

  if (row.link_status === "creating") {
    // Claimed but not finalised: either a checkout is mid-flight or a crash left
    // it for the sweeper. Either way, do not start another.
    return { state: "review" };
  }

  if (new Date(row.link_expires_at).getTime() <= Date.now()) return { state: "expired" };

  const payable = row.payable_remaining_cents ?? 0;
  if (payable <= 0) return { state: "paid" };
  return { state: "ready", amountCents: payable };
}

/**
 * Phases 1–3: claim → attempt → Stripe Session → finalise.
 * Returns the Stripe-hosted URL to redirect the participant to.
 */
export async function startCheckout(token: string, origin: string): Promise<
  | { ok: true; url: string }
  | { ok: false; reason: "not_ready" | "provider_unavailable" | "conflict" }
> {
  const db = financeServiceClient();
  const fin = db.schema("finance_api");
  const hash = hashLinkToken(token);

  // Re-resolve immediately before claiming (proof #1: server-computed amount).
  const pre = await resolveTokenState(token);
  if (pre.state === "open_session") {
    // Resume, never create another (proof #3/#4).
    const url = await sessionUrl(pre.stripeSessionId);
    return url ? { ok: true, url } : { ok: false, reason: "provider_unavailable" };
  }
  if (pre.state !== "ready") return { ok: false, reason: "not_ready" };

  // Phase 1: atomic claim (active → creating; DB guard checks expiry).
  const { data: claimData, error: claimErr } = await fin.rpc("claim_payment_link", {
    p_token_hash: hash,
  });
  const claim = (claimData as unknown as { link_id: string; agreement_id: string }[] | null)?.[0];
  if (claimErr || !claim) return { ok: false, reason: "conflict" };
  const { link_id, agreement_id } = claim;

  // The amount, re-read from the canonical view AFTER the claim.
  const { data: bal } = await fin
    .from("agreement_balances")
    .select("payable_remaining_cents")
    .eq("agreement_id", agreement_id)
    .returns<{ payable_remaining_cents: number }[]>();
  const amount = bal?.[0]?.payable_remaining_cents ?? 0;
  if (amount <= 0) return { ok: false, reason: "not_ready" };

  // Phase 2: durable attempt BEFORE any Stripe call. The single-flight index
  // refuses a second payable attempt for this agreement+mode.
  const livemode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
  const { data: attemptData, error: attErr } = await fin.rpc("begin_checkout_attempt", {
    p_link_id: link_id,
    p_agreement_id: agreement_id,
    p_amount_cents: amount,
    p_livemode: livemode,
  });
  const attempt = (attemptData as unknown as { attempt_id: string; idempotency_key: string }[] | null)?.[0];
  if (attErr || !attempt) return { ok: false, reason: "conflict" };
  const attemptId = attempt.attempt_id;

  // Phase 3: create the Session with the deterministic key, then finalise.
  try {
    const stripe = v2StripeClient();
    const member = await memberEmailForAgreement(db, agreement_id);
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: member ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amount,
              product_data: { name: "Vital Kauaʻi Journey Contribution" },
            },
          },
        ],
        // D-033: Session metadata does not propagate to the PaymentIntent, so
        // attribution is written to BOTH.
        metadata: v2Metadata(agreement_id, String(attemptId)),
        payment_intent_data: { metadata: v2Metadata(agreement_id, String(attemptId)) },
        success_url: `${origin}/contribute/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/contribute/${token}`,
      },
      { idempotencyKey: attempt.idempotency_key },
    );

    const { error: finErr } = await fin.rpc("finalize_checkout_session", {
      p_attempt_id: attemptId,
      p_stripe_session_id: session.id,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    });
    if (finErr) {
      // The Session exists at Stripe and the attempt row records the key; the
      // stranded-attempt sweeper reconciles. Do not send the member onward.
      console.error("checkout: finalize failed", finErr.message);
      return { ok: false, reason: "conflict" };
    }
    return session.url ? { ok: true, url: session.url } : { ok: false, reason: "provider_unavailable" };
  } catch (err) {
    console.error("checkout: stripe create failed", err instanceof Error ? err.message : err);
    // Attempt row remains `creating`; the sweeper replays or raises. The link
    // stays consumed-or-creating so no duplicate payable path opens.
    return { ok: false, reason: "provider_unavailable" };
  }
}

function v2Metadata(agreementId: string, attemptId: string): Record<string, string> {
  return { financial_version: "v2", agreement_id: agreementId, attempt_id: attemptId };
}

async function sessionUrl(stripeSessionId: string): Promise<string | null> {
  try {
    const s = await v2StripeClient().checkout.sessions.retrieve(stripeSessionId);
    return s.url ?? null;
  } catch {
    return null;
  }
}

async function memberEmailForAgreement(db: SupabaseClient, agreementId: string): Promise<string | null> {
  const { data: agr } = await db
    .schema("finance_api")
    .from("agreement_balances")
    .select("member_id")
    .eq("agreement_id", agreementId)
    .returns<{ member_id: string }[]>();
  const memberId = agr?.[0]?.member_id;
  if (!memberId) return null;
  const { data: prof } = await db
    .from("member_profiles")
    .select("email")
    .eq("id", memberId)
    .returns<{ email: string | null }[]>();
  return prof?.[0]?.email ?? null;
}

/** Canonical confirmation for the thank-you page: session + ledger, never the redirect. */
export async function confirmBySessionId(stripeSessionId: string): Promise<
  { state: "confirmed"; amountCents: number } | { state: "pending" } | { state: "unknown" }
> {
  const fin = financeServiceClient().schema("finance_api");
  const { data: rows } = await fin
    .from("checkout_sessions")
    .select("id, agreement_id, amount_cents, status, livemode")
    .eq("stripe_session_id", stripeSessionId)
    .returns<{ id: string; agreement_id: string; amount_cents: number; status: string; livemode: boolean }[]>();
  const cs = rows?.[0];
  if (!cs) return { state: "unknown" };
  if (cs.status !== "completed") return { state: "pending" };
  const { data: led } = await fin
    .from("ledger_entries")
    .select("id")
    .eq("agreement_id", cs.agreement_id)
    .eq("entry_type", "stripe_payment")
    .eq("livemode", cs.livemode)
    .returns<{ id: string }[]>();
  return led && led.length > 0
    ? { state: "confirmed", amountCents: cs.amount_cents }
    : { state: "pending" };
}
