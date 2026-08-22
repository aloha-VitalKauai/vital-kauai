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
 * the retired payment runtime. The D-078 guard existed to keep those RETIRED
 * payment paths shut; PR 9 removed that legacy runtime outright
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

/**
 * What `finance_api.record_stripe_event` reports back.
 *
 * The distinction that matters (D-081) is now decided in SQL from the constraint
 * diagnostic rather than by parsing an error message here, which is strictly more
 * robust: two different unique violations are possible and they mean opposite
 * things.
 */
export type RecordEventStatus = "recorded" | "duplicate" | "at_most_once_conflict";

export type RecordEventOutcome = {
  http: number;
  body: Record<string, unknown>;
};

/**
 * Map the recorded status onto the HTTP answer Stripe receives.
 *
 * Stripe retains and retries any non-2xx, so the status code IS the contract:
 *
 *   recorded / duplicate  -> 200. The event is durably stored (the second is the
 *     same event id arriving twice, which is routine). A non-2xx would make
 *     Stripe retry into the same collision forever.
 *
 *   at_most_once_conflict -> 409. A DIFFERENT event of a terminal type for the
 *     same object: a distinct event the at-most-once invariant says cannot exist.
 *     Answering 200 would acknowledge and destroy it — the exact hazard §10 names.
 *     Failing loudly keeps it in Stripe's queue; retries keep colliding, which is
 *     deliberate, because a stuck noisy event is recoverable and a silently
 *     discarded one is not.
 */
export function mapRecordEventStatus(status: RecordEventStatus | string): RecordEventOutcome {
  switch (status) {
    case "recorded":
      return { http: 200, body: { received: true } };
    case "duplicate":
      return { http: 200, body: { received: true, duplicate: true } };
    case "at_most_once_conflict":
      return { http: 409, body: { error: "at_most_once_conflict" } };
    default:
      // An unrecognised status is not assumed benign; treating it as success
      // would reintroduce the silent discard by another route.
      return { http: 500, body: { error: "unrecognised_record_status", status } };
  }
}
