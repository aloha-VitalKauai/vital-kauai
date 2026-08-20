/**
 * Financials V2 — PR 3 phase 1: V2 Stripe webhook ingestion.
 *
 * Records every delivered Stripe event into `finance.stripe_events`. It writes
 * nothing else: no ledger entry, no attribution, no interpretation. Those belong
 * to the reconciliation job, which reads this table. PR 3 observes Stripe; it does
 * not route payments (PR_PLAN.md: "no change to which webhook handles live
 * sessions. No payment-flow cutover").
 *
 * THIS IS NOT THE LEGACY WEBHOOK, AND IS NOT GUARDED BY D-078.
 * The legacy `stripe-webhook` Supabase Edge Function stays shut behind
 * `LEGACY_PAYMENTS_ENABLED`, which must never be "true" (D-078 R5). This route is
 * the replacement surface, so it deliberately does NOT call
 * `legacyPaymentsEnabled()` — doing so would tie V2 to a flag contractually
 * pinned off, disabling ingestion forever. The two are separate Stripe endpoints
 * against the same account: the legacy one disabled, this one live.
 *
 * SIGNING SECRET. Each Stripe endpoint has its own secret, so this reads
 * `STRIPE_V2_WEBHOOK_SECRET` and never `STRIPE_WEBHOOK_SECRET` (the legacy
 * endpoint's). Sharing one would couple the two surfaces and make re-enabling or
 * rotating either of them unsafe.
 *
 * STATUS CODES. Stripe retains and retries any non-2xx, so a non-2xx is how this
 * route says "not durably recorded — send it again." Every failure path below
 * therefore returns non-2xx, and 200 is returned only once the row is committed
 * (or already present). A 200 on a failed write would silently discard the event.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createServiceSupabase } from "@supabase/supabase-js";
import {
  mapRecordEventStatus,
  toStripeEventRow,
  type IngestableStripeEvent,
  type RecordEventStatus,
} from "@/lib/finance/stripe-events";
import { isSubscribedEventType } from "@/lib/finance/stripe-event-types";

// Raw body access and the Node crypto used by signature verification.
export const runtime = "nodejs";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: "2024-06-20" as any,
  });
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service credentials are not configured");
  return createServiceSupabase(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  // Fail closed on verification. Without the secret this route cannot tell a
  // genuine Stripe delivery from an attacker posting a forged payment event, and
  // an unverified event in the finance event log is worse than a retried one.
  const webhookSecret = process.env.STRIPE_V2_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("finance/stripe-webhook: STRIPE_V2_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "v2_ingestion_unconfigured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    // No signature means this did not come from Stripe. 400 is terminal by
    // design: retrying an unsigned request would never succeed.
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  // Must be the raw body — any parsing or re-serialisation invalidates the HMAC.
  const rawBody = await req.text();

  let event: IngestableStripeEvent;
  try {
    event = (await getStripe().webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    )) as unknown as IngestableStripeEvent;
  } catch (err) {
    console.error("finance/stripe-webhook: signature verification failed", err);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let row;
  try {
    row = toStripeEventRow(event);
  } catch (err) {
    // A verified event that cannot be mapped is genuinely Stripe's, so losing it
    // is not acceptable. 500 keeps it in Stripe's retry queue and surfaces the
    // shape problem rather than swallowing it.
    console.error("finance/stripe-webhook: could not map event", err);
    return NextResponse.json({ error: "unmappable_event" }, { status: 500 });
  }

  // Record everything delivered, but say so when the endpoint is configured
  // beyond the authoritative subscription. Filtering here would DISCARD an event
  // Stripe already committed to delivering; staying silent would let the
  // dashboard drift away from lib/finance/stripe-event-types.ts unnoticed.
  if (!isSubscribedEventType(row.event_type)) {
    console.warn(
      "finance/stripe-webhook: event type outside the authoritative subscription — recording it, but the Stripe endpoint configuration has drifted",
      { event_type: row.event_type, event_id: row.event_id },
    );
  }

  // Through the façade, never `finance` directly: that schema is not exposed to
  // PostgREST, which is what keeps its other tables off the REST surface. The
  // function returns a STATUS rather than making this route parse an error
  // message for a constraint name.
  const { data, error } = await getServiceClient()
    .schema("finance_api")
    .rpc("record_stripe_event", {
      p_event_id: row.event_id,
      p_event_type: row.event_type,
      p_object_id: row.object_id,
      p_livemode: row.livemode,
      p_payload: row.payload,
    });

  if (error) {
    console.error("finance/stripe-webhook: record_stripe_event failed", error);
    return NextResponse.json({ error: "not_recorded" }, { status: 500 });
  }

  const outcome = mapRecordEventStatus(data as RecordEventStatus);
  if (outcome.http === 409) {
    console.error(
      "finance/stripe-webhook: at-most-once conflict — second terminal event for one object",
      { event_id: row.event_id, event_type: row.event_type, object_id: row.object_id },
    );
  }
  return NextResponse.json(outcome.body, { status: outcome.http });
}
