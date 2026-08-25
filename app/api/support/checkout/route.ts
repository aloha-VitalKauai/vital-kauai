/**
 * PR 10B (D-088, amended): POST /api/support/checkout — the public support
 * entrance.
 *
 * Anonymous by design; there is no identity to check. The body may carry ONLY
 * the contribution amount and an opaque request id — the card processing fee
 * is always computed by the server from founder configuration, so a request
 * that tries to smuggle a fee, a total, or the retired coverage flag is
 * rejected outright. Whether checkout is possible at all is the campaign's
 * founder-approved state in the database: no active campaign, no Session
 * (fail-closed while the campaign is draft).
 */

import { NextResponse } from "next/server";
import {
  startPublicCheckout,
  PUBLIC_SUPPORT_HARD_MAX_CENTS,
  type PublicCheckoutRefusal,
} from "@/lib/finance/public-checkout";
import { fetchPublicCampaign } from "@/lib/finance/public-support-page";
import { quoteProcessingFee } from "@/lib/finance/public-support-fees";

export const runtime = "nodejs";

/**
 * GET ?amount=<cents> — a pure server-derived quote so the page can show
 * Contribution / Card processing fee / Total charged BEFORE anything is
 * created. Runs with anon authority (public_campaign_status is all it reads),
 * computes with the founder-configured parameters, writes nothing, and
 * touches Stripe never. No active campaign → no quote.
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("amount") ?? "";
  const amount = Number(raw);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > PUBLIC_SUPPORT_HARD_MAX_CENTS) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }
  const campaign = await fetchPublicCampaign();
  if (!campaign || campaign.status !== "active") {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  if (amount < campaign.min_amount_cents || amount > campaign.max_amount_cents) {
    return NextResponse.json(
      {
        error: "invalid_amount",
        minCents: campaign.min_amount_cents,
        maxCents: campaign.max_amount_cents,
      },
      { status: 400 },
    );
  }
  const quote = quoteProcessingFee(amount, {
    feeBps: campaign.fee_bps,
    feeFixedCents: campaign.fee_fixed_cents,
    feePolicyVersion: campaign.fee_policy_version,
  });
  return NextResponse.json({ ok: true, quote });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Any of these in the body is an attempt to do the server's fee math — the
 * fee is mandatory and server-derived, so the retired coverage flag is just
 * as forbidden as a smuggled amount. */
const FORBIDDEN_KEYS = [
  "totalCents", "total_cents", "total",
  "feeCents", "fee_cents", "fee",
  "processingFeeCents", "processing_fee_cents",
  "supportCents", "support_cents",
  "processingSupportCents", "processing_support_cents",
  "coverProcessing", "cover_processing",
];

const REFUSAL_STATUS: Record<PublicCheckoutRefusal, number> = {
  unavailable: 503,
  invalid_amount: 400,
  request_conflict: 409,
  already_received: 409,
  stale_attempt: 409,
  provider_unavailable: 502,
  conflict: 409,
};

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  for (const key of FORBIDDEN_KEYS) {
    if (key in body) {
      return NextResponse.json({ error: "amount_math_not_accepted" }, { status: 400 });
    }
  }

  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!UUID_RE.test(requestId)) {
    return NextResponse.json({ error: "request_id_required" }, { status: 400 });
  }

  const contributionCents = body.contributionCents;
  if (
    typeof contributionCents !== "number" ||
    !Number.isSafeInteger(contributionCents) ||
    contributionCents <= 0 ||
    contributionCents > PUBLIC_SUPPORT_HARD_MAX_CENTS
  ) {
    return NextResponse.json({ error: "invalid_amount" }, { status: 400 });
  }

  const result = await startPublicCheckout(
    { contributionCents, requestId },
    new URL(req.url).origin,
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, retryWithNewRequest: result.retryWithNewRequest ?? false },
      { status: REFUSAL_STATUS[result.reason] },
    );
  }
  return NextResponse.json({ ok: true, url: result.url, quote: result.quote });
}
