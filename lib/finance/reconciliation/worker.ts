/**
 * Financials V2 — PR 3B: the event worker, sweepers and retention.
 *
 * Phase 1 records events; this drains them. Draining is deliberately modest in
 * PR 3: an event is claimed, marked processed, and released. It writes NO ledger
 * entry, because attribution during the shadow window is reconciliation's job
 * (PR_PLAN: "PR 3 writes ledger entries only for events it can attribute to a V2
 * agreement by reconciliation matching"; tag-based routing arrives in PR 6).
 *
 * The loop exists now anyway because without it `stripe_events` grows unbounded
 * in `received`, and the claim/recovery machinery is what acceptance 3 and 5 are
 * about — those must be proven before live traffic, not after.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSubscribedEventType,
  objectTypeForEvent,
} from "@/lib/finance/stripe-event-types";

export const DEFAULT_CLAIM_BATCH = 50;
export const DEFAULT_STALE_AFTER = "15 minutes";

/** 24-month payload retention (PR 3 scope: the retention job). */
export const PAYLOAD_RETENTION_MONTHS = 24;

export type ClaimedEvent = {
  event_id: string;
  event_type: string;
  object_id: string;
  livemode: boolean;
  attempt_count: number;
  payload: unknown;
};

export type WorkerResult = {
  claimed: number;
  processed: number;
  failed: number;
  ignored: number;
};

function must<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

/**
 * Claim a batch and drive each event to a terminal state.
 *
 * Every claimed event MUST reach a terminal state in this pass. An event left
 * `processing` is invisible to the next `received` query and only returns via the
 * stale sweep, so a silent `continue` here would look like progress while
 * quietly stalling the queue.
 */
export async function runEventWorker(
  client: SupabaseClient,
  opts: { livemode: boolean; batch?: number; staleAfter?: string } = { livemode: false },
): Promise<WorkerResult> {
  const fin = () => client.schema("finance_api");
  const batch = opts.batch ?? DEFAULT_CLAIM_BATCH;

  const claimed = must(
    await fin().rpc("claim_stripe_events", {
      p_livemode: opts.livemode,
      p_limit: batch,
      p_stale_after: opts.staleAfter ?? DEFAULT_STALE_AFTER,
    }),
    "claim_stripe_events",
  ) as ClaimedEvent[] | null;

  const events = claimed ?? [];
  const result: WorkerResult = { claimed: events.length, processed: 0, failed: 0, ignored: 0 };

  for (const ev of events) {
    try {
      // An event outside the authoritative subscription is recorded but carries no
      // reconciliation meaning, so it is closed as `ignored` rather than
      // `processed` — the distinction is what makes subscription drift visible in
      // the table instead of only in a log line.
      const relevant = isSubscribedEventType(ev.event_type) && objectTypeForEvent(ev.event_type);

      // PR 6: a VERIFIED succeeded PaymentIntent carrying V2 attribution records
      // exactly one ledger payment. The event object IS the PaymentIntent (D-030
      // status verified at the source); record_v2_stripe_payment is idempotent on
      // (payment_intent, livemode), so duplicate deliveries return the same row.
      if (relevant && ev.event_type === "payment_intent.succeeded") {
        const pi = (ev.payload as { data?: { object?: {
          id?: string; status?: string; amount_received?: number; amount?: number;
          created?: number; metadata?: Record<string, string>;
        } } } | null)?.data?.object;
        const meta = pi?.metadata ?? {};
        if (pi?.id && pi.status === "succeeded" && meta.financial_version === "v2" && meta.agreement_id) {
          const amount = pi.amount_received ?? pi.amount ?? 0;
          if (amount > 0) {
            must(
              await fin().rpc("record_v2_stripe_payment", {
                p_agreement_id: meta.agreement_id,
                p_amount_cents: amount,
                p_provider_object_id: pi.id,
                p_payment_intent_id: pi.id,
                p_occurred_at: pi.created ? new Date(pi.created * 1000).toISOString() : null,
                p_livemode: ev.livemode,
                p_origin_event_id: ev.event_id,
              }),
              "record_v2_stripe_payment",
            );
          }
        }
      }

      // checkout.session.completed transitions OUR session row only when Stripe
      // says the money is settled — an unpaid/processing completion writes
      // nothing (proof #7). The ledger is written by the PaymentIntent path
      // above, never from the Session event (proof #6 holds without it).
      if (relevant && ev.event_type === "checkout.session.completed") {
        const cs = (ev.payload as { data?: { object?: {
          id?: string; payment_status?: string; metadata?: Record<string, string>;
        } } } | null)?.data?.object;
        const attemptId = cs?.metadata?.attempt_id;
        if (cs?.id && attemptId && cs.payment_status === "paid") {
          const { error: trErr } = await fin().rpc("transition_checkout_session", {
            p_attempt_id: attemptId,
            p_to_status: "completed",
          });
          if (trErr) console.error("worker: session transition failed", cs.id, trErr.message);
        }
      }

      must(
        await fin().rpc("complete_stripe_event", {
          p_event_id: ev.event_id,
          p_status: relevant ? "processed" : "ignored",
          p_error: null,
        }),
        "complete_stripe_event",
      );

      if (relevant) result.processed += 1;
      else result.ignored += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        must(
          await fin().rpc("complete_stripe_event", {
            p_event_id: ev.event_id,
            p_status: "failed",
            p_error: message.slice(0, 2000),
          }),
          "complete_stripe_event(failed)",
        );
        result.failed += 1;
      } catch {
        // Could not even record the failure. Leaving it `processing` is safe: the
        // stale sweep returns it to `received` and it is retried, which is exactly
        // the recovery path acceptance 3 requires.
        console.error("finance/worker: could not record failure", ev.event_id, message);
      }
    }
  }

  return result;
}

/**
 * Return events stranded in `processing` to `received` (acceptance 3).
 *
 * `claim_stripe_events` already re-claims stale rows, so this matters most when
 * no worker is running: without it a crash during a quiet period leaves events
 * invisible to any `received`-only query.
 */
export async function sweepStaleClaims(
  client: SupabaseClient,
  livemode: boolean,
  staleAfter: string = DEFAULT_STALE_AFTER,
): Promise<number> {
  return (must(
    await client.schema("finance_api").rpc("sweep_stale_event_claims", {
      p_livemode: livemode,
      p_stale_after: staleAfter,
    }),
    "sweep_stale_event_claims",
  ) ?? 0) as number;
}

/**
 * Mark runs whose heartbeat has gone stale as `abandoned` (acceptance 5).
 *
 * Not scoped by livemode: a stranded run blocks the single-flight slot for its
 * own mode, and both modes need clearing.
 */
export async function sweepAbandonedRuns(
  client: SupabaseClient,
  staleAfter: string = DEFAULT_STALE_AFTER,
): Promise<number> {
  return (must(
    await client.schema("finance_api").rpc("abandon_stale_runs", { p_stale_after: staleAfter }),
    "abandon_stale_runs",
  ) ?? 0) as number;
}

/**
 * The retention cutoff: payloads older than 24 months are dropped.
 *
 * Exported and pure so the boundary is executed by a test rather than trusted —
 * an off-by-one here either keeps cardholder-adjacent payloads past their
 * retention commitment or destroys evidence early.
 */
export function retentionCutoff(now: Date, months = PAYLOAD_RETENTION_MONTHS): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  return cutoff;
}

/**
 * Drop payloads past the retention horizon, in bounded batches.
 *
 * Repeats until a batch comes back short, so one invocation clears a backlog
 * without holding a single long-lived lock over years of rows. `maxBatches` caps
 * it so a misconfigured horizon cannot spin indefinitely.
 */
export async function purgeExpiredPayloads(
  client: SupabaseClient,
  now: Date,
  opts: { months?: number; batch?: number; maxBatches?: number } = {},
): Promise<number> {
  const { months = PAYLOAD_RETENTION_MONTHS, batch = 5000, maxBatches = 20 } = opts;
  const before = retentionCutoff(now, months).toISOString();

  let total = 0;
  for (let i = 0; i < maxBatches; i += 1) {
    const purged = (must(
      await client.schema("finance_api").rpc("purge_expired_event_payloads", {
        p_before: before,
        p_limit: batch,
      }),
      "purge_expired_event_payloads",
    ) ?? 0) as number;
    total += purged;
    if (purged < batch) break;
  }
  return total;
}
