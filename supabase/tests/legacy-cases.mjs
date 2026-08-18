import { squareSignature, TEST_URL } from "./legacy-fixtures.mjs";

/**
 * The routes that must REFUSE while legacy payments are off, with a request body
 * valid enough to get past their own input validation.
 *
 * The body matters: if a route 400s on malformed input before reaching anything,
 * a "no side effects occurred" assertion would pass for the wrong reason and
 * prove nothing about the guard.
 *
 * `expect` is the precise instrumented call the ENABLED positive control must
 * observe. Every entry is a legacy-table MUTATION — proving each route was
 * stopped from doing its actual write, not merely stopped somewhere.
 *
 * The Square webhook was briefly the one exception, because reaching its write
 * needs a valid HMAC. That was closed rather than accepted: `signed: true` cases
 * carry a real signature computed from the same fixed fake key the stubbed
 * `getSquareEnv` returns, so the route's own verifier admits them. No
 * reachability-only cases remain, and a test asserts that none can be added.
 */
export const ROUTE_CASES = [
  {
    file: "app/api/donations/create-session/route.ts",
    body: { amount_cents: 5000 },
    expect: /\(donations\)\.insert/,
  },
  {
    file: "app/api/donations/create-gift-session/route.ts",
    body: { amount_cents: 5000 },
    expect: /\(donations\)\.insert/,
  },
  {
    file: "app/api/payments/create-journey-session/route.ts",
    body: { journey_id: "j1", amount_cents: 5000 },
    expect: /\(donations\)\.insert/,
  },
  {
    file: "app/api/square/create-payment-link/route.ts",
    body: { amount_cents: 5000 },
    expect: /\(donations\)\.insert/,
  },
  {
    file: "app/api/square/webhook/route.ts",
    // A Square webhook is only reachable with a valid HMAC over
    // (notificationUrl + rawBody). The signature is computed from the same fixed
    // fake key the stubbed `getSquareEnv` returns, so the route's real verifier
    // accepts it and the handler runs its true processing path. This is what
    // upgraded this case from reachability-only to mutation-precise.
    body: {
      event_id: "evt-probe-1",
      type: "payment.updated",
      data: {
        type: "payment",
        object: {
          payment: {
            id: "sqpay-probe-1",
            status: "COMPLETED",
            order_id: "sqord-probe-1",
            amount_money: { amount: 5000, currency: "USD" },
          },
        },
      },
    },
    signed: true,
    expect: /\(donations\)\.(insert|update)/,
  },
  {
    file: "app/api/payments/record-offline/route.ts",
    body: { commitment_id: "c1", amount_cents: 5000 },
    expect: /\(donations\)\.insert/,
  },
  {
    file: "app/api/payments/email-link/route.ts",
    body: { commitment_id: "c1" },
    expect: /\(payment_tokens\)\.insert/,
  },
  {
    file: "app/api/payments/generate-link/route.ts",
    body: { commitment_id: "c1" },
    expect: /\(payment_tokens\)\.insert/,
  },
  {
    file: "app/api/payments/revoke-token/route.ts",
    body: { token: "t1" },
    expect: /\(payment_tokens\)\.update/,
  },
  {
    file: "app/api/payments/sync-program-price/route.ts",
    body: { member_id: "m1", amount_cents: 5000 },
    expect: /\(financial_commitments\)\.update/,
  },
  {
    file: "app/api/payments/adjust-collected/route.ts",
    body: { journey_id: "j1", collected_cents: 5000 },
    expect: /\(donations\)\.insert/,
  },
  {
    file: "app/api/payments/adjust-booked/route.ts",
    body: { journey_id: "j1", booked_cents: 5000 },
    expect: /\(financial_commitments\)\.update/,
  },
  {
    file: "app/api/payments/adjust-outstanding/route.ts",
    body: { journey_id: "j1", outstanding_cents: 5000 },
    expect: /\(financial_commitments\)\.update/,
  },
  {
    // The replacement for the removed browser-direct write. Its control is
    // mutation-precise on purpose: this endpoint exists solely to make that
    // write refusable, so proving it reaches the write is the whole point.
    file: "app/api/payments/adjust-commitment/route.ts",
    body: { commitment_id: "c1", action: "set_amount", amount_cents: 5000 },
    expect: /\(financial_commitments\)\.update/,
  },
];
