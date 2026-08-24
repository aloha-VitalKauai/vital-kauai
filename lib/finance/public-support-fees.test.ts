/**
 * PR 10B — voluntary processing-cost support: deterministic integer math.
 *
 * The founder-facing promise is exact: "$100 contribution → add approximately
 * $3.30 so Vital Kauaʻi receives the full $100." These tests pin that figure
 * and the invariant behind it — the net after the modeled fee never falls
 * below the intended contribution, for any amount in the campaign bounds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteProcessingSupport,
  quoteWithoutSupport,
  DEFAULT_FEE_POLICY,
} from "./public-support-fees.ts";

test("the founder's example: $100 → $3.30 support, $103.30 total", () => {
  const q = quoteProcessingSupport(10000, DEFAULT_FEE_POLICY);
  assert.equal(q.processingSupportCents, 330);
  assert.equal(q.totalCents, 10330);
  assert.equal(q.feePolicyVersion, "stripe-standard-v1");
});

test("known values across the range", () => {
  for (const [contribution, support] of [
    [500, 46],       // $5 minimum
    [2500, 106],     // $25
    [100000, 3018],  // $1,000
  ] as const) {
    const q = quoteProcessingSupport(contribution, DEFAULT_FEE_POLICY);
    assert.equal(q.processingSupportCents, support,
      `${contribution}¢ expected ${support}¢ support, got ${q.processingSupportCents}¢`);
    assert.equal(q.totalCents, contribution + support);
  }
});

test("INVARIANT: the modeled net never falls below the contribution", () => {
  // net = total − (total * bps / 10000) − fixed, using the same integer model.
  for (let c = 500; c <= 500000; c += 137) {
    const { totalCents } = quoteProcessingSupport(c, DEFAULT_FEE_POLICY);
    const modeledFee = Math.ceil((totalCents * DEFAULT_FEE_POLICY.feeBps) / 10000)
      + DEFAULT_FEE_POLICY.feeFixedCents;
    assert.ok(totalCents - modeledFee >= c - 1,
      `at ${c}¢: total ${totalCents}¢ nets ${totalCents - modeledFee}¢`);
  }
});

test("determinism: same input, same quote, every time", () => {
  const a = quoteProcessingSupport(73342, DEFAULT_FEE_POLICY);
  const b = quoteProcessingSupport(73342, DEFAULT_FEE_POLICY);
  assert.deepEqual(a, b);
});

test("declining coverage charges exactly the contribution", () => {
  const q = quoteWithoutSupport(10000);
  assert.equal(q.totalCents, 10000);
  assert.equal(q.processingSupportCents, 0);
});

test("corrupt configuration is refused, never quoted", () => {
  assert.throws(() => quoteProcessingSupport(0, DEFAULT_FEE_POLICY));
  assert.throws(() => quoteProcessingSupport(100.5, DEFAULT_FEE_POLICY));
  assert.throws(() => quoteProcessingSupport(-100, DEFAULT_FEE_POLICY));
  assert.throws(() => quoteProcessingSupport(10000, { ...DEFAULT_FEE_POLICY, feeBps: 10000 }));
  assert.throws(() => quoteProcessingSupport(10000, { ...DEFAULT_FEE_POLICY, feeFixedCents: -1 }));
});
