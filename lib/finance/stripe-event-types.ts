/**
 * Financials V2 — the authoritative Stripe event subscription.
 *
 * ONE list, referenced by the Stripe dashboard configuration, the handler, the
 * documentation and the tests, so the four cannot drift apart.
 *
 * ── The contradiction, and how it resolves ──────────────────────────────────
 *
 * `PR_PLAN.md` (PR 3, line 48) says ingestion covers "**all** Stripe events into
 * `finance.stripe_events`". `ARCHITECTURE.md` §10 instead enumerates exactly four
 * event types, and §10a rule 7 names four OBJECT types reconciliation walks.
 *
 * These are not actually in conflict once the two questions are separated:
 *
 *   1. WHAT DOES THE HANDLER DO WITH WHAT ARRIVES? PR_PLAN's "all" governs this.
 *      The handler filters nothing — every delivered event is recorded. Filtering
 *      at the handler would discard evidence that Stripe already committed to
 *      delivering, and D-078's whole lesson is that discarding provider events is
 *      the expensive mistake.
 *
 *   2. WHAT SHOULD THE ENDPOINT BE SUBSCRIBED TO? Neither document states this
 *      directly. ARCHITECTURE §10's four-type list is NOT the answer: it is the
 *      predicate of the partial unique index `stripe_events_terminal_at_most_once_uq`
 *      and governs DEDUPLICATION, not subscription. D-056 says so explicitly, and
 *      §10 adds that "under-including a type costs nothing, while over-including
 *      one silently discards a real event" — a statement about the index.
 *
 * So "all events" is not a subscription mandate, and the four at-most-once types
 * are not a subscription list either. The controlling constraint on subscription
 * is §10a rule 7: reconciliation enumerates **PaymentIntent, Charge, Refund and
 * Checkout Session**. The subscription is therefore the finance-relevant event
 * types of exactly those four objects — derived from the architecture of record
 * rather than from the plan's shorthand.
 *
 * Subscribing to literally every Stripe event was rejected: it would record
 * `customer.*`, `invoice.*`, `product.*` and similar types that serve no
 * requirement, inflating a table with a 24-month retention obligation and
 * diluting the shadow signal PR 3 exists to produce.
 *
 * ── Why the handler still records unlisted types ────────────────────────────
 *
 * If the dashboard is later configured beyond this list, those events are still
 * recorded (question 1 above) and reported as unexpected. Silence would let the
 * subscription drift away from this file unnoticed, which is precisely the class
 * of drift this module exists to prevent.
 */

/**
 * The four types ARCHITECTURE §10 / D-056 / D-076 declare at-most-once **per
 * object**, matching the partial unique index predicate exactly.
 *
 * `payment_intent.payment_failed` is deliberately ABSENT: Stripe emits it per
 * failed ATTEMPT, so two are legitimate for one PaymentIntent (acceptance 18k).
 * It is still subscribed — it is simply not structurally deduplicated.
 */
export const TERMINAL_AT_MOST_ONCE_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.canceled",
] as const;

/** The object types §10a rule 7 requires reconciliation to enumerate. */
export const RECONCILED_OBJECT_TYPES = [
  "payment_intent",
  "charge",
  "refund",
  "checkout_session",
] as const;

export type ReconciledObjectType = (typeof RECONCILED_OBJECT_TYPES)[number];

/**
 * THE authoritative subscription. Configure the Stripe endpoint with exactly
 * these, and nothing else.
 */
export const SUBSCRIBED_EVENT_TYPES: readonly string[] = [
  // ── Checkout Session ──
  "checkout.session.async_payment_failed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.completed",
  "checkout.session.expired",

  // ── PaymentIntent ──
  // D-030 requires verifying PaymentIntent status before writing a stripe_payment,
  // so the non-terminal states are observed too rather than inferred.
  "payment_intent.amount_capturable_updated",
  "payment_intent.canceled",
  "payment_intent.payment_failed",
  "payment_intent.processing",
  "payment_intent.requires_action",
  "payment_intent.succeeded",

  // ── Charge ──
  "charge.captured",
  "charge.expired",
  "charge.failed",
  "charge.refunded",
  "charge.succeeded",
  "charge.updated",

  // ── Refund ──
  // Acceptance 19: a refund status regression must raise an exception, which
  // requires seeing refund transitions rather than only the terminal state.
  "charge.refund.updated",
  "refund.created",
  "refund.failed",
  "refund.updated",
] as const;

/** Which reconciled object an event type concerns, or null if unrelated. */
export function objectTypeForEvent(eventType: string): ReconciledObjectType | null {
  if (eventType.startsWith("checkout.session.")) return "checkout_session";
  // Order matters: `charge.refund.updated` is a Refund event despite its prefix.
  if (eventType.startsWith("charge.refund.")) return "refund";
  if (eventType.startsWith("refund.")) return "refund";
  if (eventType.startsWith("payment_intent.")) return "payment_intent";
  if (eventType.startsWith("charge.")) return "charge";
  return null;
}

/**
 * Is this type part of the declared subscription?
 *
 * A `false` does NOT mean discard — the handler records it regardless. It means
 * the endpoint is configured beyond this file and that divergence should be
 * visible.
 */
export function isSubscribedEventType(eventType: string): boolean {
  return SUBSCRIBED_EVENT_TYPES.includes(eventType);
}

/** Is this type structurally deduplicated by the at-most-once index? */
export function isTerminalAtMostOnce(eventType: string): boolean {
  return (TERMINAL_AT_MOST_ONCE_EVENT_TYPES as readonly string[]).includes(eventType);
}
