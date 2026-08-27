/**
 * PR 10B (D-088, amended): the public support checkout service.
 *
 * FOUNDER DECISION (2026-08-24, non-negotiable): the supporter pays the card
 * processing fee. Vital Kauaʻi receives the intended contribution amount after
 * standard processing costs; the fee is always added, never optional.
 *
 * An anonymous supporter chooses a contribution amount on /support. EVERYTHING
 * trusted is derived on the server: begin_public_checkout computes the
 * processing fee from founder-configured fee parameters inside Postgres,
 * persists an append-only attempt bound to the request id, and only then does
 * service-role code create the Stripe Checkout Session with the attempt's
 * deterministic idempotency key. The browser submits ONLY the contribution
 * amount and an opaque request id — never a fee, never a total.
 *
 * The estimated processing fee is an ESTIMATE from configuration; Stripe's
 * actual fee is a PR 11 accounting fact and is never inferred here.
 */

import { financeServiceClient, v2StripeClient } from "@/lib/finance/checkout";

/** The permanent public campaign. /support never moves, the QR encodes it. */
export const PUBLIC_SUPPORT_CAMPAIGN_SLUG = "general-support";

/** Route-level sanity ceiling; the campaign's founder-approved bounds are the
 * real limits and are enforced inside begin_public_checkout. */
export const PUBLIC_SUPPORT_HARD_MAX_CENTS = 500_000_000;

export type PublicCheckoutRefusal =
  | "unavailable"          // no active campaign in this mode — the page shows nothing else
  | "invalid_amount"       // outside the campaign's founder-approved bounds — 400
  | "request_conflict"     // request id replayed with different inputs — 409, new request
  | "already_received"     // this request's payment already completed — 409
  | "stale_attempt"        // attempt finished without payment — 409, new request
  | "provider_unavailable" // Stripe temporary failure — 502, same request may retry
  | "conflict";            // typed but unresumable right now — 409

export type PublicCheckoutResult =
  | {
      ok: true;
      url: string;
      /** Server-derived breakdown, shown to the supporter before redirect:
       * Contribution / Card processing fee / Total charged. */
      quote: {
        contributionCents: number;
        processingFeeCents: number;
        totalCents: number;
        feePolicyVersion: string;
      };
    }
  | { ok: false; reason: PublicCheckoutRefusal; retryWithNewRequest?: boolean };

type BeginRow = {
  attempt_id: string;
  campaign_id: string;
  legal_entity_id: string;
  fund_id: string;
  requested_contribution_cents: number;
  processing_fee_cents: number;
  total_charge_cents: number;
  fee_policy_version: string;
  status: string;
  stripe_session_id: string | null;
};

function refusalFromRpcError(code: string | undefined, message: string): PublicCheckoutRefusal {
  if (code === "VK404" || code === "VK428") return "unavailable";
  if (code === "VK400") return "invalid_amount";
  if (code === "VK409") return "request_conflict";
  console.error("public-checkout: untyped rpc error", message);
  return "conflict";
}

function publicSupportMetadata(row: BeginRow): Record<string, string> {
  // D-033: Session metadata does not propagate to the PaymentIntent, so the
  // caller writes this to BOTH. Attribution is proven through OUR attempt row;
  // the metadata is the pointer, never the authority.
  return {
    financial_version: "public_support_v1",
    campaign_id: row.campaign_id,
    legal_entity_id: row.legal_entity_id,
    fund_id: row.fund_id,
    attempt_id: row.attempt_id,
  };
}

/**
 * Begin (or resume) a public support checkout. Anonymous by design: there is
 * no caller identity to carry — authorization is the campaign's founder-
 * approved state and bounds, enforced inside the database.
 */
export async function startPublicCheckout(
  input: { contributionCents: number; requestId: string },
  origin: string,
): Promise<PublicCheckoutResult> {
  const service = financeServiceClient();
  const fin = service.schema("finance_api");

  // 1. Persist the attempt inside Postgres. The processing fee and total are
  //    computed there from founder configuration; a replayed request id
  //    returns the SAME attempt and is refused if the inputs changed.
  const rpc = await fin.rpc("begin_public_checkout", {
    p_campaign_slug: PUBLIC_SUPPORT_CAMPAIGN_SLUG,
    p_contribution_cents: input.contributionCents,
    p_request_id: input.requestId,
  });
  if (rpc.error) {
    const reason = refusalFromRpcError(rpc.error.code, rpc.error.message ?? "");
    return {
      ok: false,
      reason,
      retryWithNewRequest: reason === "request_conflict" ? true : undefined,
    };
  }
  const begun = (rpc.data as unknown as BeginRow[] | null)?.[0];
  if (!begun) return { ok: false, reason: "conflict" };

  const quote = {
    contributionCents: begun.requested_contribution_cents,
    processingFeeCents: begun.processing_fee_cents,
    totalCents: begun.total_charge_cents,
    feePolicyVersion: begun.fee_policy_version,
  };

  if (begun.status === "completed") return { ok: false, reason: "already_received" };
  if (begun.status === "expired" || begun.status === "canceled") {
    return { ok: false, reason: "stale_attempt", retryWithNewRequest: true };
  }

  const stripe = v2StripeClient();

  // 2. Resume a still-open Session — a double-click never creates a second.
  if (begun.status === "open" && begun.stripe_session_id) {
    try {
      const s = await stripe.checkout.sessions.retrieve(begun.stripe_session_id);
      if (s.status === "open" && s.url) return { ok: true, url: s.url, quote };
      if (s.status === "complete") return { ok: false, reason: "already_received" };
      return { ok: false, reason: "stale_attempt", retryWithNewRequest: true };
    } catch {
      return { ok: false, reason: "provider_unavailable" };
    }
  }

  if (begun.status !== "creating") return { ok: false, reason: "conflict" };

  // 3. Create the hosted Session under the attempt's deterministic key —
  //    'vk_ps_' + requestId, exactly what the database stored — so a route
  //    replay reaches Stripe as ONE request.
  try {
    const metadata = publicSupportMetadata(begun);
    const lineItems = [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: begun.requested_contribution_cents,
          product_data: { name: "Vital Kauaʻi—General Support" },
        },
      },
    ];
    if (begun.processing_fee_cents > 0) {
      // Its own line, so the supporter's Stripe receipt shows the same
      // breakdown they confirmed: Contribution + Card processing fee = Total.
      // (Guarded so a founder-configured zero fee can never send Stripe a
      // zero-amount line item.)
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: begun.processing_fee_cents,
          product_data: { name: "Card processing fee" },
        },
      });
    }
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        submit_type: "donate",
        payment_method_types: ["card"],
        line_items: lineItems,
        metadata,
        payment_intent_data: { metadata },
        success_url: `${origin}/support/thank-you?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/support?checkout=canceled`,
      },
      { idempotencyKey: `vk_ps_${input.requestId}` },
    );

    const { error: finErr } = await fin.rpc("finalize_public_checkout", {
      p_attempt_id: begun.attempt_id,
      p_stripe_session_id: session.id,
      p_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    });
    if (finErr) {
      // The Session exists at Stripe and the attempt row is still `creating`
      // with its key: a retry of the SAME request resumes through Stripe's
      // idempotency layer. Never send the supporter onward unfinalized.
      console.error("public-checkout: finalize failed", finErr.message);
      return { ok: false, reason: "conflict" };
    }
    return session.url ? { ok: true, url: session.url, quote } : { ok: false, reason: "provider_unavailable" };
  } catch (err) {
    console.error("public-checkout: stripe create failed", err instanceof Error ? err.message : err);
    return { ok: false, reason: "provider_unavailable" };
  }
}
