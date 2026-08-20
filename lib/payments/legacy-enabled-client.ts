/**
 * PRESENTATION-ONLY companion to `lib/payments/legacy-enabled.ts` (D-078).
 *
 * This exists so legacy payment UI can hide its own controls. It is NOT the
 * enforcement point and must never be treated as one: a browser value can be
 * edited, so the only thing standing between a caller and a Stripe request is
 * the server-side `legacyPaymentsEnabled()` guard, which runs before any
 * provider call or database write in all five legacy paths.
 *
 * Fail-closed on the same rule as the server flag: enabled if and only if the
 * value is exactly "true".
 *
 * If this flag and the server flag ever disagree, the failure is cosmetic in
 * one direction only:
 *   - client says enabled, server disabled  -> button shows, request returns 503
 *   - client says disabled, server enabled  -> button hidden, nothing charged
 * Neither case can move money. That asymmetry is why a second variable is
 * acceptable here rather than a second source of truth for authorisation.
 */
export function legacyPaymentsEnabledForDisplay(): boolean {
  return process.env.NEXT_PUBLIC_LEGACY_PAYMENTS_ENABLED === "true";
}

export const LEGACY_DISABLED_NOTICE =
  "Contributions through this page are temporarily unavailable while we move to a new system. Nothing has been charged.";
