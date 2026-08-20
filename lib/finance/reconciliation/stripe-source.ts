/**
 * Financials V2 — PR 3B: the Stripe implementation of `StripeSource`.
 *
 * Enumerates Charges and Refunds over the run's window, paginating each to
 * exhaustion. Objects are read from the API rather than from delivered events:
 * ARCHITECTURE §10 — "reconciliation trusts objects, not delivery" — because a
 * webhook that never arrived leaves no trace, whereas the object is still there.
 *
 * D-030 is honoured by carrying the PaymentIntent's own status onto the payment
 * the diff sees, so `diffWindow` never has to infer success from a Charge alone.
 */

import Stripe from "stripe";
import { paginateAll } from "@/lib/finance/reconciliation/paginate";
import type {
  ProviderPayment,
  ProviderRefund,
} from "@/lib/finance/reconciliation/diff";
import type { StripeSource } from "@/lib/finance/reconciliation/run";

/** Pinned deliberately; every other Stripe caller in the repo uses this. */
export const STRIPE_API_VERSION = "2024-06-20";

export function financeStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    apiVersion: STRIPE_API_VERSION as any,
  });
}

/** Does the configured secret key address live mode? */
export function keyIsLiveMode(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

/**
 * Refuse to enumerate when the configured key's mode differs from the run's.
 *
 * This exists because of an asymmetry in the Stripe API: Charge and Event carry
 * `livemode`, but **Refund does not**. A refund's mode is therefore only knowable
 * from which key fetched it. If a live-mode run ran against a test key, every
 * refund would be labelled `livemode: true` and written into the live ledger —
 * mode isolation (acceptance 14) would be silently inverted rather than
 * violated loudly. Checking the key up front makes that unrepresentable.
 */
export function assertKeyMatchesMode(livemode: boolean, key = process.env.STRIPE_SECRET_KEY): void {
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  const keyLive = keyIsLiveMode(key);
  if (keyLive !== livemode) {
    throw new Error(
      `Stripe key mode mismatch: run is livemode=${livemode} but STRIPE_SECRET_KEY is ` +
        `${keyLive ? "live" : "test"}. Refunds carry no livemode field, so enumerating ` +
        "under a mismatched key would mislabel every refund.",
    );
  }
}

function idOf(o: { id: string }): string {
  return o.id;
}

function metadataOf(m: Stripe.Metadata | null | undefined): Record<string, string | undefined> {
  return (m ?? {}) as Record<string, string | undefined>;
}

/**
 * Stripe timestamps are seconds; JavaScript wants milliseconds. Getting this
 * wrong silently dates every entry to 1970, which would corrupt the
 * earliest-`occurred_at` lookback run #1 depends on (acceptance 2).
 */
export function stripeTime(seconds: number): Date {
  return new Date(seconds * 1000);
}

export function createStripeSource(stripe?: Stripe): StripeSource {
  const client = stripe ?? financeStripeClient();

  return {
    async listPayments(w) {
      assertKeyMatchesMode(w.livemode);
      // Charges carry the settled amount and the PaymentIntent link, so they are
      // the enumeration root; the PaymentIntent is expanded for its status (D-030)
      // rather than fetched per object, which would multiply API calls.
      const { items, apiCalls, retries } = await paginateAll<Stripe.Charge>({
        idOf,
        fetchPage: async ({ startingAfter, limit }) => {
          const page = await client.charges.list({
            limit,
            starting_after: startingAfter,
            created: {
              gte: Math.floor(w.windowStart.getTime() / 1000),
              lt: Math.floor(w.windowEnd.getTime() / 1000),
            },
            expand: ["data.payment_intent"],
          });
          return { data: page.data, has_more: page.has_more };
        },
      });

      const payments: ProviderPayment[] = items
        // Mode isolation is also enforced in the diff, but filtering here keeps a
        // mis-keyed client from even presenting the wrong mode's objects.
        .filter((c) => c.livemode === w.livemode)
        .map((c) => {
          const pi =
            typeof c.payment_intent === "string" || c.payment_intent == null
              ? null
              : (c.payment_intent as Stripe.PaymentIntent);
          const paymentIntentId =
            typeof c.payment_intent === "string" ? c.payment_intent : (pi?.id ?? null);

          return {
            objectId: c.id,
            paymentIntentId,
            createdAt: stripeTime(c.created),
            // D-030: prefer the PaymentIntent's status. A Charge can be present
            // for a payment that never succeeded, so the Charge's own flag is not
            // sufficient evidence to write money.
            status: pi?.status ?? (c.status === "succeeded" ? "succeeded" : c.status),
            amountCents: c.amount,
            currency: c.currency,
            livemode: c.livemode,
            // Session metadata does not propagate to the PaymentIntent (D-033), so
            // both are consulted, with the PaymentIntent winning where it is set.
            metadata: { ...metadataOf(c.metadata), ...metadataOf(pi?.metadata) },
          };
        });

      return { payments, apiCalls, retries };
    },

    async listRefunds(w) {
      // Guarded above and here: this is the call whose objects carry no mode flag.
      assertKeyMatchesMode(w.livemode);
      const { items, apiCalls, retries } = await paginateAll<Stripe.Refund>({
        idOf,
        fetchPage: async ({ startingAfter, limit }) => {
          const page = await client.refunds.list({
            limit,
            starting_after: startingAfter,
            created: {
              gte: Math.floor(w.windowStart.getTime() / 1000),
              lt: Math.floor(w.windowEnd.getTime() / 1000),
            },
          });
          return { data: page.data, has_more: page.has_more };
        },
      });

      const refunds: ProviderRefund[] = items
        // No `.filter` on livemode is possible: Stripe's Refund object has no such
        // field. `assertKeyMatchesMode` above is what makes the label below sound —
        // the key determines the result set, and the key has been proven to match.
        .map((r) => ({
          objectId: r.id,
          paymentIntentId:
            typeof r.payment_intent === "string"
              ? r.payment_intent
              : (r.payment_intent?.id ?? null),
          createdAt: stripeTime(r.created),
          status: r.status ?? "unknown",
          // Stripe reports a positive magnitude; the diff applies the sign L3 needs.
          amountCents: r.amount,
          livemode: w.livemode,
        }));

      return { refunds, apiCalls, retries };
    },
  };
}
