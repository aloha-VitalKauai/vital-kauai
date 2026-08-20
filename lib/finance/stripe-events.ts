/**
 * Financials V2 — PR 3 phase 1: Stripe event ingestion mapping.
 *
 * Pure functions that turn a verified Stripe event into a `finance.stripe_events`
 * row. Deliberately separated from the route so the mapping can be tested without
 * a webhook, a network, or a database.
 *
 * SCOPE. Phase 1 records events and nothing else. It writes no ledger entry,
 * resolves no attribution, and interprets no event type. Interpretation belongs
 * to the reconciliation job (phase 3), which reads this table. That separation is
 * the point of shadow ingestion: observing Stripe must not be able to change a
 * balance.
 *
 * NOT the legacy surface. This module has no relationship to
 * `lib/payments/legacy-enabled.ts`. The D-078 guard exists to keep the RETIRED
 * payment paths shut, and `LEGACY_PAYMENTS_ENABLED` must never be "true"
 * (D-078 R5). Gating V2 ingestion on that flag would disable V2 permanently.
 */

/** The subset of a Stripe event this module needs. Structural, so tests need no SDK. */
export type IngestableStripeEvent = {
  id: string;
  type: string;
  livemode: boolean;
  data?: { object?: unknown };
};

/** A row destined for `finance.stripe_events`. */
export type StripeEventRow = {
  event_id: string;
  event_type: string;
  object_id: string;
  livemode: boolean;
  payload: unknown;
};

/**
 * Resolve the Stripe object id an event is about.
 *
 * `finance.stripe_events.object_id` is NOT NULL, so this must always produce
 * something. Nearly every event carries `data.object.id` (`pi_…`, `ch_…`,
 * `re_…`, `cs_…`). A handful of event types do not — and for those, losing the
 * event would be worse than recording it against a fallback identity, so the
 * event id is used and the anomaly stays visible in the payload.
 *
 * Reconciliation matches on the payload rather than this column, so a fallback
 * here cannot cause a mis-attribution; it only makes the row self-describing.
 */
export function resolveObjectId(event: IngestableStripeEvent): string {
  const object = event.data?.object;
  if (object !== null && typeof object === "object") {
    const id = (object as { id?: unknown }).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return event.id;
}

/**
 * Map a verified Stripe event to its row.
 *
 * `livemode` is taken from the event as Stripe reports it and is never inferred
 * from which API key happened to be configured. Mode isolation downstream is only
 * as trustworthy as this field, and a key can be swapped without the event log
 * being rewritten.
 *
 * The whole event is retained as `payload`. Phase 3 needs fields this phase has no
 * opinion about, and re-fetching from Stripe later is neither free nor guaranteed
 * to return what was originally delivered.
 */
export function toStripeEventRow(event: IngestableStripeEvent): StripeEventRow {
  if (typeof event.id !== "string" || event.id.length === 0) {
    throw new Error("stripe event has no id");
  }
  if (typeof event.type !== "string" || event.type.length === 0) {
    throw new Error(`stripe event ${event.id} has no type`);
  }
  if (typeof event.livemode !== "boolean") {
    throw new Error(`stripe event ${event.id} has no livemode flag`);
  }

  return {
    event_id: event.id,
    event_type: event.type,
    object_id: resolveObjectId(event),
    livemode: event.livemode,
    payload: event,
  };
}

/** Postgres unique-violation SQLSTATE. */
export const PG_UNIQUE_VIOLATION = "23505";

/** The at-most-once index from ARCHITECTURE §10 / D-056 / D-076. */
export const TERMINAL_AT_MOST_ONCE_INDEX = "stripe_events_terminal_at_most_once_uq";

/** Primary key on `event_id`. */
export const STRIPE_EVENTS_PKEY = "stripe_events_pkey";

/**
 * The four event types ARCHITECTURE §10 declares at-most-once **per object**,
 * matching `stripe_events_terminal_at_most_once_uq` exactly.
 *
 * Deliberately NOT the set of types worth subscribing to — this is only the set
 * the database structurally deduplicates. `payment_intent.payment_failed` is
 * absent because Stripe emits it per failed ATTEMPT, so two are legitimate for
 * one PaymentIntent (acceptance 18k).
 */
export const TERMINAL_AT_MOST_ONCE_EVENT_TYPES = [
  "checkout.session.completed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.canceled",
] as const;

export type InsertOutcome = "duplicate_delivery" | "at_most_once_conflict" | "other_error";

type PgErrorish = { code?: string | null; message?: string | null; details?: string | null } | null;

/**
 * Classify an insert failure.
 *
 * 23505 has TWO causes here, and conflating them destroys data:
 *
 *   1. `stripe_events_pkey` — the same `event_id` arriving twice. Stripe
 *      redelivers on any non-2xx and may redeliver even after success, so this is
 *      routine. The event is already durably recorded; answering 200 is correct,
 *      and answering non-2xx would make Stripe retry into the same collision
 *      forever.
 *
 *   2. `stripe_events_terminal_at_most_once_uq` — a DIFFERENT event (different
 *      `event_id`) of a terminal type for the same object. This is not a
 *      duplicate delivery: it is a distinct event that the at-most-once invariant
 *      says should not exist. ARCHITECTURE §10 names this exact hazard —
 *      "over-including one silently discards a real event" — and answering 200
 *      would do precisely that, acknowledging an event that was never stored.
 *
 * So the constraint name, not the SQLSTATE, decides. Matching on 23505 alone
 * would let case 2 masquerade as case 1.
 */
export function classifyInsertError(error: PgErrorish): InsertOutcome {
  if (error?.code !== PG_UNIQUE_VIOLATION) return "other_error";

  const haystack = `${error?.message ?? ""} ${error?.details ?? ""}`;
  if (haystack.includes(TERMINAL_AT_MOST_ONCE_INDEX)) return "at_most_once_conflict";
  if (haystack.includes(STRIPE_EVENTS_PKEY)) return "duplicate_delivery";

  // A 23505 naming no constraint we recognise is not assumed benign. Defaulting
  // to "duplicate" here would reintroduce the silent discard by another route.
  return "at_most_once_conflict";
}

/**
 * Is this a routine redelivery of an event already recorded?
 *
 * True only for a primary-key collision. See `classifyInsertError`.
 */
export function isDuplicateEvent(error: PgErrorish): boolean {
  return classifyInsertError(error) === "duplicate_delivery";
}
