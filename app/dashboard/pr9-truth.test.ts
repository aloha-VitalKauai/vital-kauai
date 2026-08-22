/**
 * PR 9 (D-086) — retirement truth proofs.
 *
 * The repository-wide absence of legacy code is proven by the retirement gate.
 * These tests pin the *replacements*: that the surfaces which used to read
 * retired data now read canonical V2 data, scope it to the right member, and
 * stay honest when a read fails.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const OVERVIEW = "app/dashboard/page.tsx";
const OPS = "app/dashboard/ops/page.tsx";
const MEMBER = "app/dashboard/[id]/page.tsx";
const EDITOR = "app/dashboard/[id]/MemberProfileEditor.tsx";
const TIMELINE = "app/dashboard/[id]/memberTimeline.ts";
const PAY = "app/pay/[token]/page.tsx";

test("founder dashboards read the canonical V2 overview", () => {
  for (const f of [OVERVIEW, OPS]) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /founder_financial_overview/, `${f} does not read the V2 overview`);
  }
});

test("a failed or non-founder read renders unavailable, never a dollar figure", () => {
  const overview = readFileSync(OVERVIEW, "utf8");
  // The row is absent for BOTH an error and a non-founder, and both must show
  // the same honest word rather than a fabricated zero.
  assert.match(overview, /"Unavailable"/);
  assert.ok(!/fmt\(0 \/ 100/.test(overview), "overview falls back to a zero figure");

  const ops = readFileSync(OPS, "utf8");
  assert.match(ops, /finReady\s*=\s*finOverview\s*!=\s*null/);
  assert.match(ops, /'Unavailable'/);
});

test("operating margin is never recomputed outside SQL", () => {
  for (const f of [OVERVIEW, OPS]) {
    const src = readFileSync(f, "utf8");
    // A margin derived by subtraction in the page is the exact defect D-086
    // forbids: it can disagree with the canonical view.
    assert.ok(
      !/margin\w*\s*=\s*\w+\s*-\s*\w+/i.test(src),
      `${f} derives margin by subtraction instead of reading operating_margin_cents`,
    );
    assert.match(src, /operating_margin_cents/);
  }
});

test("member timeline lifecycle events are scoped to that member's agreements", () => {
  const src = readFileSync(MEMBER, "utf8");
  // Lifecycle rows are keyed by agreement, not member. They must be restricted
  // by an explicit id list; an empty list must mean "no events", never "all".
  assert.match(src, /\.in\("agreement_id", agreementIds\)/);
  assert.ok(
    !/agreementIds\.size === 0 \|\|/.test(src),
    "an empty agreement set falls through to showing every member's lifecycle",
  );
  assert.match(src, /agreement_balances"\)\.select\("agreement_id"\)\.eq\("member_id", id\)/);
});

test("the timeline receives no provider, actor or reason field", () => {
  const src = readFileSync(MEMBER, "utf8");
  for (const leak of ["actor_id", "reason", "provider_object_id", "stripe_session_id", "idempotency_key"]) {
    assert.ok(!src.includes(leak), `member page projects ${leak} toward the client`);
  }
  const timeline = readFileSync(TIMELINE, "utf8");
  assert.match(timeline, /financeEvents/);
});

test("saving a member profile cannot mutate financial truth", () => {
  const src = readFileSync(EDITOR, "utf8");
  assert.ok(!src.includes("sync-program-price"), "profile save still syncs a financial amount");
  assert.match(src, /non-canonical/i);
});

test("the retired payment link performs no lookup of any kind", () => {
  const src = readFileSync(PAY, "utf8");
  for (const f of ["createClient", "supabase", "await ", "params"]) {
    assert.ok(!src.includes(f), `retired link page performs ${f}`);
  }
  assert.match(src, /This link has retired\./);
  assert.match(src, /Nothing has been charged\./);
});
