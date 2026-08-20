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

/**
 * Is this insert error a duplicate delivery rather than a failure?
 *
 * Stripe redelivers on any non-2xx and can deliver the same event more than once
 * even on success, so duplicates are routine rather than exceptional.
 * `event_id` is the primary key, so the second insert raises 23505 — which means
 * the event is already durably recorded and the delivery has succeeded.
 *
 * Treating this as an error would be actively harmful: a 500 makes Stripe retry,
 * which raises 23505 again, and the event never stops being redelivered.
 */
export function isDuplicateEvent(error: { code?: string | null } | null): boolean {
  return error?.code === PG_UNIQUE_VIOLATION;
}
