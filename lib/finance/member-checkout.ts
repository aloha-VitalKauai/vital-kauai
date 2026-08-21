/**
 * PR 8 (D-085): the authenticated member checkout service.
 *
 * PR 6 owns the payment engine; this is the member-safe caller on top of it.
 * Authorization and the amount live in Postgres: the begin_* functions resolve
 * the member from their JWT (finance.current_member_id()), lock the agreement,
 * and derive the FULL payable remaining — no amount is ever accepted for a
 * Contribution, and a member's rpc reply carries no Stripe or idempotency
 * material. Only after the database has authorized and persisted the attempt
 * does service-role code read the attempt's key (machine_checkout_attempts)
 * and talk to Stripe, exactly as the PR 6 token path does.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  financeServiceClient,
  v2StripeClient,
  v2Metadata,
  memberEmailForAgreement,
} from "./checkout";

/** Organizational gift bounds (spec §4.5): whole dollars, $5–$25,000. */
export const GIFT_MIN_CENTS = 500;
export const GIFT_MAX_CENTS = 2_500_000;

export type MemberCheckoutRefusal =
  | "not_found"            // not the member's agreement / not a member — 404, no enumeration
  | "invalid_request"      // malformed body, bad amount — 400
  | "not_active"           // draft/canceled/waived agreement — 409
  | "nothing_payable"      // paid/zero remaining — 409, refresh figures
  | "already_received"     // attempt already completed — 409
  | "gift_in_progress"     // another gift attempt is live — 409
  | "amount_changed"       // contribution amended mid-flight — 409, retry with new request
  | "stale_attempt"        // replayed request maps to an expired/canceled attempt — 409, new request
  | "provider_unavailable" // Stripe temporary failure — 502, attempt recoverable
  | "conflict";            // anything else typed but unresumable right now — 409

export type MemberCheckoutResult =
  | { ok: true; url: string; attemptId: string }
  | { ok: false; reason: MemberCheckoutRefusal; retryWithNewRequest?: boolean };

type BeginRow = {
  attempt_id: string;
  agreement_id: string;
  amount_cents: number;
  status: string;
  current_payable_cents?: number;
};

type MachineAttempt = {
  id: string;
  agreement_id: string;
  stripe_session_id: string | null;
  idempotency_key: string;
  amount_cents: number;
  status: string;
  expires_at: string | null;
};

function refusalFromRpcError(code: string | undefined, message: string): MemberCheckoutRefusal {
  if (code === "VK404") return "not_found";
  if (code === "VK400") return "invalid_request";
  if (code === "VK409") {
    if (message.includes("not active")) return "not_active";
    if (message.includes("nothing payable")) return "nothing_payable";
    if (message.includes("in progress")) return "gift_in_progress";
    if (message.includes("unavailable")) return "gift_in_progress";
    return "conflict";
  }
  return "conflict";
}

/**
 * Begin (or resume) checkout for the signed-in member.
 *
 * `memberClient` MUST be the caller's own authenticated Supabase client — it is
 * what carries identity to finance.current_member_id(). The service client is
 * created here and used only after the database has authorized the attempt.
 */
export async function startMemberCheckout(
  memberClient: SupabaseClient,
  input:
    | { kind: "contribution"; agreementId: string; requestId: string }
    | { kind: "additional_gift"; amountCents: number; requestId: string },
  origin: string,
): Promise<MemberCheckoutResult> {
  const memberFin = memberClient.schema("finance_api");

  // 1. Authorize + persist the attempt inside Postgres, as the member.
  const rpc =
    input.kind === "contribution"
      ? await memberFin.rpc("begin_member_contribution_checkout", {
          p_agreement_id: input.agreementId,
          p_request_id: input.requestId,
        })
      : await memberFin.rpc("begin_member_gift_checkout", {
          p_amount_cents: input.amountCents,
          p_request_id: input.requestId,
        });
  if (rpc.error) {
    return { ok: false, reason: refusalFromRpcError(rpc.error.code, rpc.error.message ?? "") };
  }
  const begun = (rpc.data as unknown as BeginRow[] | null)?.[0];
  if (!begun) return { ok: false, reason: "conflict" };

  if (begun.status === "completed") return { ok: false, reason: "already_received" };
  if (begun.status === "expired" || begun.status === "canceled") {
    // A replayed request bound to a finished attempt is a stale intent; the
    // client must confirm the current figures and retry as a NEW intent.
    return { ok: false, reason: "stale_attempt", retryWithNewRequest: true };
  }

  // 2. From here on the database has authorized this attempt for this member;
  //    Stripe material is read with the service role, never returned raw.
  const service = financeServiceClient();
  const fin = service.schema("finance_api");
  const { data: machineData, error: machineErr } = await fin
    .from("machine_checkout_attempts")
    .select("id, agreement_id, stripe_session_id, idempotency_key, amount_cents, status, expires_at")
    .eq("id", begun.attempt_id)
    .returns<MachineAttempt[]>();
  const attempt = machineData?.[0];
  if (machineErr || !attempt) return { ok: false, reason: "conflict" };

  const stripe = v2StripeClient();

  // 3. Contribution drift: the founder amended between render and click, or a
  //    payment landed. The stale amount must be CONFIRMED expired at Stripe
  //    before anything replaces it (spec §6.3); the retry is a new intent so
  //    the member consents to the new figure.
  if (
    input.kind === "contribution" &&
    typeof begun.current_payable_cents === "number" &&
    begun.current_payable_cents !== attempt.amount_cents
  ) {
    if (attempt.stripe_session_id && attempt.status === "open") {
      try {
        await stripe.checkout.sessions.expire(attempt.stripe_session_id);
      } catch {
        // Refusing to expire usually means the Session just completed. Never
        // replace it; the webhook/worker will settle the truth.
        return { ok: false, reason: "conflict" };
      }
      const { error: trErr } = await fin.rpc("transition_checkout_session", {
        p_attempt_id: attempt.id,
        p_to_status: "expired",
      });
      if (trErr) return { ok: false, reason: "conflict" };
    }
    return { ok: false, reason: "amount_changed", retryWithNewRequest: true };
  }

  // 4. Resume a still-valid open Session — never create a second one.
  if (attempt.status === "open" && attempt.stripe_session_id) {
    try {
      const s = await stripe.checkout.sessions.retrieve(attempt.stripe_session_id);
      if (s.status === "open" && s.url) return { ok: true, url: s.url, attemptId: attempt.id };
      if (s.status === "complete") return { ok: false, reason: "already_received" };
      // Stripe says expired: record it, then ask for a fresh intent.
      const { error: trErr } = await fin.rpc("transition_checkout_session", {
        p_attempt_id: attempt.id,
        p_to_status: "expired",
      });
      if (trErr) return { ok: false, reason: "conflict" };
      return { ok: false, reason: "stale_attempt", retryWithNewRequest: true };
    } catch {
      return { ok: false, reason: "provider_unavailable" };
    }
  }

  if (attempt.status !== "creating") return { ok: false, reason: "conflict" };

  // 5. Create the hosted Session with the attempt's persisted deterministic
  //    key — a double-click or route replay reaches Stripe as ONE request.
  try {
    const email = await memberEmailForAgreement(service, attempt.agreement_id);
    const productName =
      input.kind === "contribution"
        ? "Vital Kauaʻi Journey Contribution"
        : "Vital Kauaʻi Additional Gift";
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        customer_email: email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: attempt.amount_cents,
              product_data: { name: productName },
            },
          },
        ],
        // D-033: Session metadata does not propagate to the PaymentIntent, so
        // attribution is written to BOTH.
        metadata: v2Metadata(attempt.agreement_id, attempt.id),
        payment_intent_data: { metadata: v2Metadata(attempt.agreement_id, attempt.id) },
        success_url: `${origin}/portal/donate?checkout=confirming&attempt=${attempt.id}`,
        cancel_url: `${origin}/portal/donate?checkout=canceled&attempt=${attempt.id}`,
      },
      { idempotencyKey: attempt.idempotency_key },
    );

    const { error: finErr } = await fin.rpc("finalize_checkout_session", {
      p_attempt_id: attempt.id,
      p_stripe_session_id: session.id,
      p_expires_at: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
    });
    if (finErr) {
      // Session exists at Stripe, attempt row holds the key: the stranded-
      // attempt path reconciles. Never send the member onward unfinalized.
      console.error("member-checkout: finalize failed", finErr.message);
      return { ok: false, reason: "conflict" };
    }
    return session.url
      ? { ok: true, url: session.url, attemptId: attempt.id }
      : { ok: false, reason: "provider_unavailable" };
  } catch (err) {
    console.error("member-checkout: stripe create failed", err instanceof Error ? err.message : err);
    // The attempt stays `creating` and recoverable; nothing was charged.
    return { ok: false, reason: "provider_unavailable" };
  }
}
