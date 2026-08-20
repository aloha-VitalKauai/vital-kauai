import "server-only";

/**
 * Centralised fail-closed guard for the LEGACY payment integration
 * (pre-Financials-V2 Stripe and Square paths that write to `public.donations`,
 * `public.financial_commitments` and `public.payment_tokens`).
 *
 * WHY THIS EXISTS — D-078.
 * PR 3's directive recorded that "Stripe is disconnected from the runtime
 * system." That was false: the `stripe-webhook` Edge Function was deployed and
 * ACTIVE, and four server paths created Stripe Checkout Sessions. Those paths
 * write to tables that D-077 deliberately emptied, so any checkout initiated
 * from the app would repopulate them and restore synthetic figures to the
 * legacy dashboard.
 *
 * FAIL-CLOSED CONTRACT.
 * Enabled if and only if the environment variable is exactly the string "true".
 * Absent, empty, malformed, "1", "yes", "TRUE" — every other value disables.
 * This is deliberate: a financial capability must never switch on because a
 * variable was mistyped, truncated, or unset during a deploy.
 *
 * Contrast `lib/payment-provider.ts`, which defaults to `"stripe"` when unset
 * and therefore fails OPEN. That is the defect this module exists not to repeat.
 * `legacyPaymentsEnabled()` gates the whole legacy surface regardless of which
 * provider `PAYMENT_PROVIDER` happens to select.
 *
 * Server-only: importing this from a client component is a build error, so the
 * flag can never be evaluated in the browser where it could be tampered with.
 */
export function legacyPaymentsEnabled(): boolean {
  return process.env.LEGACY_PAYMENTS_ENABLED === "true";
}

/** Machine-readable reason returned to callers while the legacy surface is off. */
export const LEGACY_DISABLED_CODE = "legacy_payments_disabled" as const;

/**
 * The single response every blocked legacy route returns.
 *
 * 503 rather than 404: the endpoint exists and is deliberately unavailable, and
 * a client distinguishing "retired" from "temporarily off" should see the
 * difference. Nothing is written and no provider request is made before this.
 */
export function legacyPaymentsDisabledResponse(): Response {
  return new Response(
    JSON.stringify({
      error: LEGACY_DISABLED_CODE,
      message:
        "Legacy payments are disabled. Financials V2 supersedes this path; see D-078.",
    }),
    { status: 503, headers: { "content-type": "application/json" } },
  );
}
