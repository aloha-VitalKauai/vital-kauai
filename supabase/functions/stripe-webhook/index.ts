/**
 * PR 9 (D-086): retired legacy Stripe webhook — deployable tombstone.
 *
 * This Edge Function once verified signatures and wrote to a retired table. It is
 * kept deployed, and deliberately inert, so that a provider still holding the
 * old endpoint receives a definite answer rather than a timeout or a 404 that
 * might be read as a transient fault.
 *
 * It has NO Stripe SDK, NO Supabase client, NO network access, NO environment
 * flag and NO reference to any retired table. There is nothing here to
 * re-enable: restoring the old behaviour would require writing a new function,
 * not flipping a switch. The retirement gate asserts this file imports nothing.
 *
 * 410 Gone is returned rather than 503: the endpoint is not temporarily
 * unavailable, it is permanently retired, and Stripe must not retry it.
 */

Deno.serve(() =>
  new Response(
    JSON.stringify({
      error: "endpoint_retired",
      message:
        "This webhook endpoint has been permanently retired. Vital Kauaʻi processes payments through Financials V2.",
    }),
    { status: 410, headers: { "content-type": "application/json" } },
  )
);
