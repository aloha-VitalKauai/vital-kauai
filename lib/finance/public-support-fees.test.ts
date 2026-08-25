/**
 * PR 10B (amended) — the card processing fee: deterministic integer math.
 *
 * The founder-facing promise is exact: "$100 contribution → $3.30 card
 * processing fee → $103.30 charged, so approximately the full $100 reaches
 * Vital Kauaʻi." The fee is ALWAYS applied — there is no opt-out quote. These
 * tests pin those figures and the invariant behind them: the net after the
 * modeled fee never falls below the intended contribution.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteProcessingFee, DEFAULT_FEE_POLICY } from "./public-support-fees.ts";

test("the founder's example: $100 → $3.30 fee, $103.30 total", () => {
  const q = quoteProcessingFee(10000, DEFAULT_FEE_POLICY);
  assert.equal(q.processingFeeCents, 330);
  assert.equal(q.totalCents, 10330);
  assert.equal(q.feePolicyVersion, "stripe-standard-v1");
});

test("known values across the range", () => {
  for (const [contribution, fee] of [
    [500, 46],       // $5 minimum → $5.46 charged
    [2500, 106],     // $25 → $26.06 charged
    [100000, 3018],  // $1,000 → $1,030.18 charged
  ] as const) {
    const q = quoteProcessingFee(contribution, DEFAULT_FEE_POLICY);
    assert.equal(q.processingFeeCents, fee,
      `${contribution}¢ expected ${fee}¢ fee, got ${q.processingFeeCents}¢`);
    assert.equal(q.totalCents, contribution + fee);
  }
});

test("the fee is never zero: the supporter always pays processing costs", () => {
  for (const c of [500, 10000, 100000, 499999900]) {
    assert.ok(quoteProcessingFee(c, DEFAULT_FEE_POLICY).processingFeeCents > 0);
  }
});

test("INVARIANT: the modeled net never falls below the contribution", () => {
  // net = total − (total * bps / 10000) − fixed, using the same integer model.
  for (let c = 500; c <= 500000; c += 137) {
    const { totalCents } = quoteProcessingFee(c, DEFAULT_FEE_POLICY);
    const modeledFee = Math.ceil((totalCents * DEFAULT_FEE_POLICY.feeBps) / 10000)
      + DEFAULT_FEE_POLICY.feeFixedCents;
    assert.ok(totalCents - modeledFee >= c - 1,
      `at ${c}¢: total ${totalCents}¢ nets ${totalCents - modeledFee}¢`);
  }
});

test("determinism: same input, same quote, every time", () => {
  const a = quoteProcessingFee(73342, DEFAULT_FEE_POLICY);
  const b = quoteProcessingFee(73342, DEFAULT_FEE_POLICY);
  assert.deepEqual(a, b);
});

test("corrupt configuration is refused, never quoted", () => {
  assert.throws(() => quoteProcessingFee(0, DEFAULT_FEE_POLICY));
  assert.throws(() => quoteProcessingFee(100.5, DEFAULT_FEE_POLICY));
  assert.throws(() => quoteProcessingFee(-100, DEFAULT_FEE_POLICY));
  assert.throws(() => quoteProcessingFee(10000, { ...DEFAULT_FEE_POLICY, feeBps: 10000 }));
  assert.throws(() => quoteProcessingFee(10000, { ...DEFAULT_FEE_POLICY, feeFixedCents: -1 }));
});
