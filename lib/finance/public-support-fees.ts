/**
 * PR 10B (D-088, amended): the card processing fee on public support.
 *
 * FOUNDER DECISION (2026-08-24, non-negotiable): the supporter pays the
 * processing fee. Vital Kauaʻi receives the intended contribution amount after
 * standard card processing costs; the fee is always added, never optional.
 * The fee is an ESTIMATE built from founder-configured fee parameters —
 * Stripe's actual fee is a PR 11 accounting fact and is never inferred here.
 *
 * All arithmetic is integer cents with deterministic ceiling rounding, computed
 * on the server from configuration. The browser never does fee math and never
 * submits a fee amount — only the contribution and an opaque request id.
 *
 * Model: if the processor takes pct (basis points) plus a fixed fee, the total
 * T that nets the intended contribution C satisfies T = C + fixed + T*pct, so
 *   T = (C + fixed) / (1 - pct)
 * rounded UP to the next cent so the net never falls short by rounding:
 *   T = ceil((C + fixed) * 10000 / (10000 - bps))
 */

export type FeePolicy = {
  /** e.g. 290 = 2.9% */
  feeBps: number;
  /** e.g. 30 = $0.30 */
  feeFixedCents: number;
  /** versioned configuration marker recorded on every attempt */
  feePolicyVersion: string;
};

/** Founder-configurable; stored per campaign. These are the shipped defaults. */
export const DEFAULT_FEE_POLICY: FeePolicy = {
  feeBps: 290,
  feeFixedCents: 30,
  feePolicyVersion: "stripe-standard-v1",
};

export type ProcessingFeeQuote = {
  contributionCents: number;
  processingFeeCents: number;
  totalCents: number;
  feePolicyVersion: string;
};

/**
 * Deterministic integer gross-up. Throws on inputs that could silently produce
 * nonsense — a fee policy at or above 100% is configuration corruption, not a
 * quote.
 */
export function quoteProcessingFee(
  contributionCents: number,
  policy: FeePolicy,
): ProcessingFeeQuote {
  if (!Number.isSafeInteger(contributionCents) || contributionCents <= 0) {
    throw new Error(`invalid contribution: ${contributionCents}`);
  }
  if (!Number.isSafeInteger(policy.feeBps) || policy.feeBps < 0 || policy.feeBps >= 10000) {
    throw new Error(`invalid fee bps: ${policy.feeBps}`);
  }
  if (!Number.isSafeInteger(policy.feeFixedCents) || policy.feeFixedCents < 0) {
    throw new Error(`invalid fixed fee: ${policy.feeFixedCents}`);
  }

  const numerator = (contributionCents + policy.feeFixedCents) * 10000;
  const denominator = 10000 - policy.feeBps;
  // Integer ceiling division: never under-collect by rounding down.
  const totalCents = Math.floor((numerator + denominator - 1) / denominator);
  return {
    contributionCents,
    processingFeeCents: totalCents - contributionCents,
    totalCents,
    feePolicyVersion: policy.feePolicyVersion,
  };
}
