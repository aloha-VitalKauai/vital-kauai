#!/usr/bin/env node
/**
 * Diagnostic: with the flag ENABLED and the shared resolver installed, show the
 * deepest legacy-table mutation each guarded route reaches.
 *
 * This is how the `expect` regexes in legacy-shutdown.test.ts were derived — by
 * observation, not by guessing what a route "should" do. Run it after changing
 * a route to see whether its positive control is still mutation-precise.
 */
import { ROUTE_CASES } from "../supabase/tests/legacy-cases.mjs";
import { FAKE_ENV, RESOLVER, squareSignature, TEST_URL } from "../supabase/tests/legacy-fixtures.mjs";

Object.assign(process.env, FAKE_ENV);
process.env.LEGACY_PAYMENTS_ENABLED = "true";
globalThis.__VK_RESOLVE = RESOLVER;

const LEGACY = /\((donations|financial_commitments|payment_tokens)\)\.(insert|update|upsert|delete)/;

for (const { file, body, signed } of ROUTE_CASES) {
  globalThis.__VK_CALLS.length = 0;
  const mod = await import(process.cwd() + "/" + file);
  try {
    const raw = JSON.stringify(body);
    const headers = { "content-type": "application/json" };
    if (signed) headers["x-square-hmacsha256-signature"] = squareSignature(raw, TEST_URL);
    await mod.POST(new Request(TEST_URL, { method: "POST", headers, body: raw }));
  } catch {
    /* the deepest reached call is what matters, not the outcome */
  }
  const paths = globalThis.__VK_CALLS.map((c) => c.path);
  const hits = paths.filter((p) => LEGACY.test(p));
  console.log(`${file}`);
  console.log(`   legacy write : ${hits[0] ?? "(NONE REACHED)"}`);
  if (!hits.length) console.log(`   deepest      : ${paths.at(-1) ?? "(no calls)"}`);
}
