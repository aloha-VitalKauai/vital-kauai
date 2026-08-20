/**
 * PR 3B — Stripe source guards (acceptance 2, 14).
 *
 * The two rules here are load-bearing for correctness rather than convenience:
 * the key/mode check is the ONLY thing that makes a refund's mode label sound,
 * and the timestamp conversion decides whether every ledger entry is dated
 * correctly or in 1970.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assertKeyMatchesMode,
  keyIsLiveMode,
  stripeTime,
  STRIPE_API_VERSION,
} from "./stripe-source.ts";

test("the pinned Stripe API version matches the rest of the repo", () => {
  // Every other Stripe caller pins this. A silent drift here would change object
  // shapes underneath reconciliation without any code changing.
  assert.equal(STRIPE_API_VERSION, "2024-06-20");
});

test("live and test key prefixes are distinguished", () => {
  assert.equal(keyIsLiveMode("sk_live_abc"), true);
  assert.equal(keyIsLiveMode("rk_live_abc"), true);
  assert.equal(keyIsLiveMode("sk_test_abc"), false);
  assert.equal(keyIsLiveMode("rk_test_abc"), false);
});

test("A14: a live run against a test key is refused", () => {
  // Stripe's Refund object carries NO livemode field, so a refund's mode is only
  // knowable from the key that fetched it. Without this check every refund would
  // be labelled live and written into the live ledger — mode isolation inverted
  // silently rather than violated loudly.
  assert.throws(
    () => assertKeyMatchesMode(true, "sk_test_abc"),
    /key mode mismatch.*livemode=true.*test/s,
  );
});

test("A14: a test run against a live key is refused", () => {
  assert.throws(
    () => assertKeyMatchesMode(false, "sk_live_abc"),
    /key mode mismatch.*livemode=false.*live/s,
  );
});

test("a matching key and mode is accepted in both directions", () => {
  assert.doesNotThrow(() => assertKeyMatchesMode(true, "sk_live_abc"));
  assert.doesNotThrow(() => assertKeyMatchesMode(false, "sk_test_abc"));
});

test("a missing key is refused rather than defaulted", () => {
  assert.throws(() => assertKeyMatchesMode(false, undefined), /not configured/);
  assert.throws(() => assertKeyMatchesMode(false, ""), /not configured/);
});

test("an unrecognised key prefix is treated as test, so a live run refuses it", () => {
  // Failing closed: an unknown prefix must not be allowed to pass as live.
  assert.throws(() => assertKeyMatchesMode(true, "sk_weird_abc"), /mismatch/);
});

test("A2: Stripe seconds convert to milliseconds, not 1970", () => {
  // Getting this wrong dates every entry to the epoch and corrupts the
  // earliest-occurred_at lookback run #1 depends on.
  assert.equal(stripeTime(1_787_000_000).toISOString(), "2026-08-17T20:53:20.000Z");
  assert.ok(stripeTime(1_787_000_000).getUTCFullYear() > 2000);
});
