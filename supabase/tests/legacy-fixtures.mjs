/**
 * Shared fixtures for the D-078 behavioural tests.
 *
 * `RESOLVER` drives a route down a realistic authorised path — founder session,
 * existing rows — so the ENABLED positive control can observe each route reach
 * the specific legacy table mutation it exists to perform, rather than merely
 * touching some instrumented dependency such as the auth lookup. A control that
 * only proves "the auth check ran" would still pass if the write were removed,
 * which is the class of weak evidence this whole exercise is correcting.
 */

import { createHmac } from "node:crypto";

/**
 * Fixed fake Square signing key. Square's scheme is
 *   base64( HMAC-SHA256( signatureKey, notificationUrl || rawBody ) )
 * so knowing the key lets the test forge a signature the real verifier accepts,
 * exactly as Square itself would produce. Nothing here is a real credential.
 */
export const SQUARE_SIGNATURE_KEY = "probe-square-signature-key-not-real";

/** The URL every test request uses; it is part of the signed payload. */
export const TEST_URL = "http://localhost/test";

export function squareSignature(rawBody, notificationUrl = TEST_URL) {
  const hmac = createHmac("sha256", SQUARE_SIGNATURE_KEY);
  hmac.update(notificationUrl);
  hmac.update(rawBody);
  return hmac.digest("base64");
}

export const FAKE_ENV = {
  STRIPE_SECRET_KEY: "sk_test_probe_not_a_real_key",
  STRIPE_WEBHOOK_SECRET: "whsec_probe_not_a_real_secret",
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "probe-service-role-not-real",
  SQUARE_ACCESS_TOKEN: "probe-square-not-real",
  SQUARE_ENVIRONMENT: "sandbox",
  SQUARE_LOCATION_ID: "probe-location",
  SQUARE_WEBHOOK_SIGNATURE_KEY: "probe-square-sig",
  RESEND_API_KEY: "re_probe_not_a_real_key",
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

const future = () => new Date(Date.now() + 9_000_000).toISOString();

export function RESOLVER(call) {
  const endsWith = (s) => call.endsWith(s);
  const table = (t) => call.includes(`(${t})`);
  const terminal = /\.(single|maybeSingle)$/.test(call);

  if (endsWith("auth.getUser")) {
    return { data: { user: { id: "founder-1", email: "founder@probe.test" } } };
  }
  if (endsWith("verifyFounder")) return { id: "founder-1", email: "founder@probe.test" };
  if (endsWith("requireFounder")) {
    return { ok: true, founder: { id: "founder-1", email: "founder@probe.test" } };
  }
  if (endsWith("isSquareActive")) return true;

  // Must be a REAL key, not a proxy: the webhook feeds it to createHmac, and the
  // test forges a matching signature from the same constant. Without this the
  // Square webhook could never be driven past signature verification, which is
  // what previously forced it to be a weaker "reachability-only" case.
  if (endsWith("getSquareEnv")) {
    return {
      webhookSignatureKey: SQUARE_SIGNATURE_KEY,
      accessToken: "probe-square-not-real",
      environment: "sandbox",
      locationId: "probe-location",
    };
  }
  if (endsWith("getMembershipDonationConfig")) {
    return { amount_cents: 5000, currency: "usd", label: "Probe membership" };
  }

  if (terminal && table("bookings")) {
    return {
      data: {
        id: "b1",
        member_id: "m1",
        amount_due_cents: 700_000,
        amount_paid_cents: 0,
        booking_status: "invited",
      },
    };
  }

  if (terminal && table("user_roles")) return { data: { role: "founder" } };
  if (terminal && table("journeys")) {
    return { data: { id: "j1", member_id: "m1", booking_type: "journey", title: "J" } };
  }
  if (terminal && table("financial_commitments")) {
    return {
      data: {
        id: "c1",
        member_id: "m1",
        journey_id: "j1",
        status: "active",
        kind: "journey_contribution",
        expected_amount_cents: 100_000,
      },
    };
  }
  if (terminal && table("members")) {
    return { data: { id: "m1", email: "member@probe.test", full_name: "Probe Member" } };
  }
  if (terminal && table("payment_tokens")) {
    return {
      data: { token: "t1", commitment_id: "c1", expires_at: future(), consumed_at: null },
    };
  }
  if (terminal && table("donations")) return { data: null };
  if (terminal) return { data: null };

  return undefined;
}

/**
 * Resolver for the two ONBOARDING routes (`approve-member`,
 * `add-member-manually`).
 *
 * These are not full-refusal routes: only their `$0` draft commitment seed is
 * suppressed, so their positive control has to reach
 * `financial_commitments.insert` specifically. Independent review found this was
 * previously untested — the disabled-state assertion held on routes that could
 * not reach the seed under the harness at all, which made it vacuous in exactly
 * the way commit 0f75583 was. These fixtures exist to make that control real:
 * no duplicate member, an approvable lead, a created auth user, a new journey.
 */
export function ONBOARDING_RESOLVER(call, args) {
  const terminal = /\.(single|maybeSingle)$/.test(call);

  // The duplicate-member probe must find nothing, or the route 409s early.
  if (terminal && call.includes("(members)")) return { data: null, error: null };

  // The "does a commitment already exist?" probe must find nothing, or the seed
  // is skipped and the positive control would prove nothing about the write.
  if (terminal && call.includes("(financial_commitments)")) {
    return { data: null, error: null };
  }

  // approve-member looks the lead up by approval_token; it must exist.
  if (terminal && call.includes("(leads)")) {
    return {
      data: {
        id: "lead-1",
        email: "probe@onboarding.test",
        full_name: "Probe Onboarding",
        approval_token: "tok1",
        // The route gates on `approval_status`, and on `created_at` being
        // inside a 7-day TTL — both are required to reach the commitment seed.
        approval_status: "pending",
        created_at: new Date().toISOString(),
        calendly_booked_at: new Date().toISOString(),
        phone: null,
      },
      error: null,
    };
  }

  // Creating the auth user, and the journey the commitment hangs off.
  if (call.includes("auth.admin.createUser")) {
    return { data: { user: { id: "user-new-1" } }, error: null };
  }
  if (terminal && call.includes("(journeys)")) {
    return { data: { id: "journey-new-1" }, error: null };
  }

  return RESOLVER(call, args);
}

/**
 * Canned HTTP responses for the onboarding positive control only.
 *
 * `approve-member` creates its auth user through the Supabase admin REST API
 * with raw `fetch`, so without this the route cannot reach the commitment seed.
 * Only the admin-user endpoints are answered; anything else (notably the Resend
 * email endpoint) is left unhandled so the loader still records and blocks it.
 */
export function ONBOARDING_FETCH(url) {
  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  if (url.includes("/auth/v1/admin/users?")) return json({ users: [] });
  if (url.includes("/auth/v1/admin/users")) {
    return json({ id: "user-new-1", email: "probe@onboarding.test" });
  }
  return undefined;
}
