// Calendly webhook signature verification.
//
// Extracted from the route so it can be tested directly, and hardened in three
// ways that matter now that webhooks move session balances:
//
//   1. FAIL CLOSED IN PRODUCTION. Previously an unset signing key silently
//      disabled verification entirely — production ran unverified for months
//      without any signal. Production now rejects when no key is configured;
//      only local/preview may run unverified, and they say so loudly.
//   2. REPLAY WINDOW. A signature is only accepted while it is fresh. Without
//      this, one captured request stays valid forever and can be replayed to
//      re-drive booking and cancellation events.
//   3. CONSTANT-TIME COMPARE. Digest equality no longer short-circuits on the
//      first differing byte.
//
// Two Calendly organizations deliver to the same endpoint (Vital team + PNE),
// each with its own signing key, so a signature is valid if it matches ANY
// configured key.

import { createHmac, timingSafeEqual } from "crypto";

export const REPLAY_TOLERANCE_SECONDS = 300;

export type SignatureVerdict = {
  ok: boolean;
  reason:
    | "verified"
    | "unsigned_allowed_outside_production"
    | "no_signing_key_configured"
    | "missing_header"
    | "malformed_header"
    | "stale_timestamp"
    | "no_key_matched";
};

function hexEqual(a: string, b: string): boolean {
  // timingSafeEqual throws on length mismatch, which would itself leak length
  // and turn a bad signature into a 500. Compare lengths first, then bytes.
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

export function verifyCalendlySignature(args: {
  signatureHeader: string | null;
  rawBody: string;
  signingKeys: (string | undefined | null)[];
  isProduction: boolean;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): SignatureVerdict {
  const keys = args.signingKeys.filter((k): k is string => Boolean(k));

  if (keys.length === 0) {
    // No key configured. Outside production this is a convenience; in
    // production it is a misconfiguration that must not pass silently.
    return args.isProduction
      ? { ok: false, reason: "no_signing_key_configured" }
      : { ok: true, reason: "unsigned_allowed_outside_production" };
  }

  if (!args.signatureHeader) return { ok: false, reason: "missing_header" };

  const parts: Record<string, string> = {};
  for (const part of args.signatureHeader.split(",")) {
    const idx = part.indexOf("=");
    if (idx > 0) parts[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  if (!parts.t || !parts.v1) return { ok: false, reason: "malformed_header" };

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "malformed_header" };

  const now = args.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = args.toleranceSeconds ?? REPLAY_TOLERANCE_SECONDS;
  // Absolute difference: a timestamp far in the future is as suspect as a
  // stale one, and clock skew cuts both ways.
  if (Math.abs(now - timestamp) > tolerance) {
    return { ok: false, reason: "stale_timestamp" };
  }

  const signedPayload = `${parts.t}.${args.rawBody}`;
  for (const key of keys) {
    const expected = createHmac("sha256", key).update(signedPayload).digest("hex");
    if (hexEqual(expected, parts.v1)) return { ok: true, reason: "verified" };
  }
  return { ok: false, reason: "no_key_matched" };
}

// Vercel sets VERCEL_ENV to production/preview/development; NODE_ENV is the
// fallback for non-Vercel runtimes.
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.NODE_ENV === "production";
}
