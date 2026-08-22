/**
 * Financials V2 — PR 3B: the entrypoint that actually runs the worker.
 *
 * Without this, `runEventWorker`, the two sweepers and the retention job are
 * dead code: `stripe_events` would grow unbounded in `received`, a crashed run
 * would hold the single-flight lock forever, and nothing would ever drain. The
 * modules existing is not the same as their being called.
 *
 * Order matters. Sweeping runs FIRST so a run stranded by a previous crash is
 * released before anything tries to start a new one, and so events stranded in
 * `processing` are back in `received` before the claim.
 */

import { NextResponse } from "next/server";
import { financeServiceClient } from "@/lib/finance/reconciliation/supabase-db";
import {
  purgeExpiredPayloads,
  runEventWorker,
  sweepAbandonedRuns,
  sweepStaleClaims,
} from "@/lib/finance/reconciliation/worker";
import { runCheckoutRecovery, stripeCheckoutGateway } from "@/lib/finance/checkout-recovery";

export const runtime = "nodejs";
// Draining a backlog can outlast the default budget; a truncated run would leave
// events claimed and waiting on the stale sweep.
export const maxDuration = 300;

/** Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. */
function authorized(req: Request, secret: string): boolean {
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("finance-worker: CRON_SECRET is not set");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Both modes are drained. Which one carries traffic depends on the deployed
  // key, and an empty sweep is cheap — skipping a mode would silently strand it.
  const modes = [true, false];
  const now = new Date();
  const result: Record<string, unknown> = {};

  try {
    result.abandonedRuns = await sweepAbandonedRuns(financeServiceClient());
    // PR 6: claimed links with no Stripe-bound attempt return to active after
    // the 15-minute TTL (D-035 — safe because no Stripe call was made).
    {
      const { data, error } = await financeServiceClient()
        .schema("finance_api")
        .rpc("restore_orphaned_link_claims", { p_stale_after: "15 minutes" });
      if (error) console.error("finance-worker: orphan restore failed", error.message);
      result.orphanedLinksRestored = (data as number | null) ?? 0;
    }

    // PR 6 closeout: attempts stranded in `creating` and sessions left `open`
    // past expiry both hold the one-live slot. This is a DIFFERENT failure from
    // the orphan restore above, which only covers a claimed link that never
    // reached an attempt row. Recovery talks to Stripe, so it is isolated: a
    // provider outage must not stop the event queue from draining.
    try {
      result.checkoutRecovery = await runCheckoutRecovery(
        financeServiceClient(),
        stripeCheckoutGateway(),
        // Cleanup (adopt, cancel, expire) always runs. Creating a new payable
        // Session is gated on the same readiness flag as issuance, so rolling
        // the flag back actually stops money moving.
        { allowSessionCreation: process.env.FINANCE_V2_CHECKOUT_READY === "true" },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("finance-worker: checkout recovery failed", message);
      result.checkoutRecovery = { error: message };
    }

    for (const livemode of modes) {
      const client = financeServiceClient();
      const key = livemode ? "live" : "test";
      const swept = await sweepStaleClaims(client, livemode);
      const worked = await runEventWorker(client, { livemode });
      result[key] = { swept, ...worked };
    }

    // Retention last: it is the least urgent and the most likely to be throttled
    // by the duration budget, and losing a pass costs nothing.
    result.payloadsPurged = await purgeExpiredPayloads(financeServiceClient(), now);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("finance-worker failed", message);
    // 500 so a failing cron is visible in Vercel rather than reported as success.
    return NextResponse.json({ ok: false, error: message, ...result }, { status: 500 });
  }
}
