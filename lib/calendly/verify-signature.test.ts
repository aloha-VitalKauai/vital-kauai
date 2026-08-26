import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "crypto";
import {
  verifyCalendlySignature,
  isProductionRuntime,
  REPLAY_TOLERANCE_SECONDS,
} from "./verify-signature.ts";

const KEY = "vital-signing-key";
const PNE_KEY = "pne-signing-key";
const BODY = JSON.stringify({ event: "invitee.created", payload: { uri: "inv-1" } });
const NOW = 1_800_000_000;

function sign(body: string, key: string, t = NOW): string {
  const v1 = createHmac("sha256", key).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

const base = {
  rawBody: BODY,
  signingKeys: [KEY],
  isProduction: true,
  nowSeconds: NOW,
};

test("a correctly signed request is verified", () => {
  const v = verifyCalendlySignature({ ...base, signatureHeader: sign(BODY, KEY) });
  assert.deepEqual(v, { ok: true, reason: "verified" });
});

test("either organization's key can sign (Vital team + PNE)", () => {
  const args = { ...base, signingKeys: [KEY, PNE_KEY] };
  assert.equal(verifyCalendlySignature({ ...args, signatureHeader: sign(BODY, KEY) }).ok, true);
  assert.equal(verifyCalendlySignature({ ...args, signatureHeader: sign(BODY, PNE_KEY) }).ok, true);
});

test("a signature from an unknown key is rejected", () => {
  const v = verifyCalendlySignature({ ...base, signatureHeader: sign(BODY, "attacker-key") });
  assert.deepEqual(v, { ok: false, reason: "no_key_matched" });
});

test("a tampered body invalidates the signature", () => {
  const header = sign(BODY, KEY);
  const tampered = JSON.stringify({ event: "invitee.created", payload: { uri: "inv-EVIL" } });
  const v = verifyCalendlySignature({ ...base, signatureHeader: header, rawBody: tampered });
  assert.deepEqual(v, { ok: false, reason: "no_key_matched" });
});

test("a captured signature goes stale — replay outside the window is rejected", () => {
  const header = sign(BODY, KEY, NOW - REPLAY_TOLERANCE_SECONDS - 1);
  const v = verifyCalendlySignature({ ...base, signatureHeader: header });
  assert.deepEqual(v, { ok: false, reason: "stale_timestamp" });
});

test("a signature inside the replay window is still accepted (clock skew tolerated)", () => {
  const recent = verifyCalendlySignature({
    ...base,
    signatureHeader: sign(BODY, KEY, NOW - REPLAY_TOLERANCE_SECONDS + 5),
  });
  assert.equal(recent.ok, true);
  const skewedFuture = verifyCalendlySignature({
    ...base,
    signatureHeader: sign(BODY, KEY, NOW + 30),
  });
  assert.equal(skewedFuture.ok, true);
});

test("a timestamp far in the future is rejected, like a stale one", () => {
  const v = verifyCalendlySignature({
    ...base,
    signatureHeader: sign(BODY, KEY, NOW + REPLAY_TOLERANCE_SECONDS + 1),
  });
  assert.deepEqual(v, { ok: false, reason: "stale_timestamp" });
});

test("a missing or malformed header is rejected", () => {
  assert.deepEqual(verifyCalendlySignature({ ...base, signatureHeader: null }), {
    ok: false,
    reason: "missing_header",
  });
  assert.deepEqual(verifyCalendlySignature({ ...base, signatureHeader: "garbage" }), {
    ok: false,
    reason: "malformed_header",
  });
  assert.deepEqual(
    verifyCalendlySignature({ ...base, signatureHeader: `t=notanumber,v1=abc` }),
    { ok: false, reason: "malformed_header" },
  );
  // v1 present but no timestamp
  assert.deepEqual(verifyCalendlySignature({ ...base, signatureHeader: "v1=abc" }), {
    ok: false,
    reason: "malformed_header",
  });
});

test("a v1 of the wrong length cannot crash the comparison", () => {
  const v = verifyCalendlySignature({ ...base, signatureHeader: `t=${NOW},v1=ab` });
  assert.deepEqual(v, { ok: false, reason: "no_key_matched" });
});

// ── the actual hardening: unconfigured key must not silently pass in prod ────

test("PRODUCTION fails closed when no signing key is configured", () => {
  const v = verifyCalendlySignature({
    ...base,
    signingKeys: [],
    signatureHeader: sign(BODY, KEY),
  });
  assert.deepEqual(v, { ok: false, reason: "no_signing_key_configured" });
});

test("outside production, an unconfigured key still allows local development", () => {
  const v = verifyCalendlySignature({
    ...base,
    signingKeys: [undefined, null],
    isProduction: false,
    signatureHeader: null,
  });
  assert.deepEqual(v, { ok: true, reason: "unsigned_allowed_outside_production" });
});

test("isProductionRuntime prefers VERCEL_ENV over NODE_ENV", () => {
  assert.equal(isProductionRuntime({ VERCEL_ENV: "production" } as never), true);
  assert.equal(isProductionRuntime({ VERCEL_ENV: "preview", NODE_ENV: "production" } as never), false);
  assert.equal(isProductionRuntime({ NODE_ENV: "production" } as never), true);
  assert.equal(isProductionRuntime({ NODE_ENV: "development" } as never), false);
  assert.equal(isProductionRuntime({} as never), false);
});
