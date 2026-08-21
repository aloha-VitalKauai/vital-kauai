/**
 * PR 7 — truth and isolation proofs (build spec §10).
 *
 * Static: the command center must contain NO read of any retired financial
 * object, and no legacy fallback. These are the two rules D-084 exists to
 * enforce; a regression here is a silent lie on the money dashboard.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FILES = [
  "app/dashboard/financials/page.tsx",
  "app/dashboard/financials/FounderFinancialCommandCenter.tsx",
];
const RETIRED = [
  "financials_overview", "cohort_margin_summary", "private_ceremony_summary",
  '"donations"', "financial_commitments", "payment_tokens", "payment_allocations",
  "FinancialKpiRow", "CohortAndPrivateTabs",
];

test("the command center reads no retired financial object", () => {
  for (const f of FILES) {
    const src = readFileSync(f, "utf8");
    for (const name of RETIRED) {
      assert.ok(!src.includes(name), `${f} references retired object ${name}`);
    }
  }
});

test("a failed overview read renders unknown, never zero", () => {
  const src = readFileSync("app/dashboard/financials/page.tsx", "utf8");
  // The overview must become null on error — not a zero-filled default object.
  assert.match(src, /overviewRes\.error \? null/);
  assert.ok(!src.includes("total_revenue_cents: 0"), "legacy zero-fallback object survives");
});

test("no client-side balance formula: money fields pass through from SQL", () => {
  const src = readFileSync("app/dashboard/financials/FounderFinancialCommandCenter.tsx", "utf8");
  // Received/Remaining/margin must never be derived by arithmetic on other money
  // fields in React. The only arithmetic permitted is display formatting (/100)
  // and the percentage hint, which divides two canonical values.
  assert.ok(!/net_received_cents\s*[-+]\s*/.test(src), "React recomputes received");
  assert.ok(!/operating_margin_cents\s*=/.test(src), "React recomputes margin");
});
