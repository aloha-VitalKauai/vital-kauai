/**
 * Financials V2 — PR 3B: the entrypoint that runs a reconciliation pass.
 *
 * DRY RUN BY DEFAULT. A writing run happens only when an approved dry run exists
 * to authorise it, and even then Postgres re-checks the approval in
 * `tg_run_authorization` — this route cannot manufacture permission, only supply
 * evidence.
 *
 * Auth is the cron secret, same as every other cron route. This is machine work;
 * founder authority enters through the approval, not through this endpoint.
 */

import { NextResponse } from "next/server";
import { createSupabaseFinanceDb, financeServiceClient } from "@/lib/finance/reconciliation/supabase-db";
import { createStripeSource, keyIsLiveMode } from "@/lib/finance/reconciliation/stripe-source";
import { executeReconciliationRun } from "@/lib/finance/reconciliation/run";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: Request, secret: string): boolean {
  const header = req.headers.get("authorization");
  if (header === `Bearer ${secret}`) return true;
  return new URL(req.url).searchParams.get("secret") === secret;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("finance-reconcile: CRON_SECRET is not set");
    return NextResponse.json({ error: "cron_not_configured" }, { status: 500 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  // The deployment addresses exactly one Stripe mode, and Refund objects carry no
  // `livemode`, so the run's mode must follow the key rather than be chosen here.
  const livemode = keyIsLiveMode(stripeKey);

  // 18f0: read from process configuration only, and refuse rather than
  // substituting a placeholder that would misattribute every entry's provenance.
  const implementationVersion = process.env.VERCEL_GIT_COMMIT_SHA ?? "";
  if (!implementationVersion) {
    return NextResponse.json({ error: "build_identifier_unavailable" }, { status: 503 });
  }

  try {
    const outcome = await executeReconciliationRun({
      db: createSupabaseFinanceDb(financeServiceClient()),
      source: createStripeSource(),
      livemode,
      // Always a dry run here. Writing runs are started deliberately by the
      // founder through the canary control, never on a schedule.
      dryRun: true,
      implementationVersion,
      now: new Date(),
    });

    return NextResponse.json({ ok: true, ...outcome });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("finance-reconcile failed", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
