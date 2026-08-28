/**
 * PR 8 — truth, privacy and isolation proofs (build spec §11).
 *
 * Static proofs over the rendered member experience and its API boundary. The
 * database-side authorization matrix (four roles, cross-member VK404, gift
 * idempotency, façade revocation) is proven behaviorally in the migration's
 * in-transaction assertions and the rolled-back production proof — these tests
 * pin the application-side rules that could silently regress.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PAGE = "app/portal/donate/page.tsx";
const CLIENT = "app/portal/donate/ContributionPortalClient.tsx";
const ROUTE = "app/api/finance/member-checkout/route.ts";
const SERVICE = "lib/finance/member-checkout.ts";
const MIGRATION = "supabase/migrations/20260821220000_finance_pr8_member_portal.sql";
const REDIRECTS = [
  "app/portal/journey/payment/page.tsx",
  "app/portal/onboarding/donation/page.tsx",
];

// Legacy-read absence is proven repository-wide by the PR 9 retirement gate.
test("a failed member read renders unknown, never zero", () => {
  const src = readFileSync(PAGE, "utf8");
  assert.match(src, /overviewRes\.error \? null/);
  assert.match(src, /agreementsRes\.error \? null/);
  assert.match(src, /activityRes\.error \? null/);
});

test("no client-side money arithmetic beyond display formatting", () => {
  const src = readFileSync(CLIENT, "utf8");
  // Received/Remaining/Contribution must never be derived from one another.
  assert.ok(!/remaining_cents\s*[-+]/.test(src), "client recomputes remaining");
  assert.ok(!/contribution_cents\s*-\s*/.test(src), "client derives a balance");
  assert.ok(!/net_received_cents\s*[-+]/.test(src), "client recomputes received");
});

test("the approved Contribution language is verbatim", () => {
  const src = readFileSync(CLIENT, "utf8");
  for (const line of [
    "Mahalo for your contribution.",
    // D-089 moved the scholarship line to the gift section, where it belongs:
    // scholarships are funded by gifts, not by a member's own Contribution.
    "Your membership contribution goes toward your entire journey—six weeks of preparation, eight days on Kauaʻi, and six weeks of integration.",
    "Your gift helps us provide scholarships for members in need, particularly for our first responders and essential workers.",
    "An additional gift is separate from your Contribution and never changes what remains.",
  ]) {
    assert.ok(src.includes(line), `approved copy missing: ${line}`);
  }
  // Forbidden vocabulary (spec §3).
  for (const word of ["debt", "collections", "invoice", "donation balance", "amount owed", "delinquent"]) {
    assert.ok(!src.toLowerCase().includes(word), `forbidden word present: ${word}`);
  }
});

test("member-facing states use the approved terminology", () => {
  const src = readFileSync(CLIENT, "utf8");
  for (const label of ["Payment needed", "Partially received", "Received in full", "More than Contribution received"]) {
    assert.ok(src.includes(label), `state label missing: ${label}`);
  }
});

test("contribution checkout rejects any client amount", () => {
  const src = readFileSync(ROUTE, "utf8");
  assert.match(src, /"amountCents" in body \|\| "amount" in body \|\| "amount_cents" in body/);
  assert.match(src, /amount_not_accepted/);
});

test("identity comes from the session, never the body", () => {
  const src = readFileSync(ROUTE, "utf8");
  for (const field of ["body.memberId", "body.member_id", "body.email", "body.role", "body.userId"]) {
    assert.ok(!src.includes(field), `route reads identity from body: ${field}`);
  }
  assert.match(src, /auth\.getUser\(\)/);
});

test("ownership failures are 404, checkout gate is 503, provider failure is 502", () => {
  const src = readFileSync(ROUTE, "utf8");
  assert.match(src, /not_found: 404/);
  assert.match(src, /checkout_unavailable.*503|503.*checkout_unavailable/s);
  assert.match(src, /provider_unavailable: 502/);
});

test("the member service returns no Stripe secret material to the caller", () => {
  const src = readFileSync(SERVICE, "utf8");
  // The result type carries only ok/url/attemptId or a typed refusal.
  assert.ok(!/ok: true[^}]*stripe_session_id/s.test(src), "result leaks a session id field");
  assert.ok(!/ok: true[^}]*idempotency_key/s.test(src), "result leaks the idempotency key");
  // The Stripe key material is read via the machine view, service-role only.
  assert.match(src, /machine_checkout_attempts/);
});

test("gift bounds are named server constants, and the client agrees with them", () => {
  const src = readFileSync(SERVICE, "utf8");
  // A client-only limit is exactly what the spec forbids: the browser would
  // accept an amount the server then refuses with a generic error.
  const client = readFileSync(CLIENT, "utf8");
  const clientMax = Number(/GIFT_MAX_DOLLARS = (\d+)/.exec(client)?.[1]);
  const serverMax = Number(/GIFT_MAX_CENTS = ([\d_]+)/.exec(src)?.[1].replace(/_/g, ""));
  assert.equal(clientMax * 100, serverMax, "client and server gift ceilings must agree");
  const clientMin = Number(/GIFT_MIN_DOLLARS = (\d+)/.exec(client)?.[1]);
  const serverMin = Number(/GIFT_MIN_CENTS = ([\d_]+)/.exec(src)?.[1].replace(/_/g, ""));
  assert.equal(clientMin * 100, serverMin, "client and server gift floors must agree");
  assert.match(src, /GIFT_MIN_CENTS = 500/);
  assert.match(src, /GIFT_MAX_CENTS = 500_000_000/);
});

test("superseded portal payment routes are pure redirects", () => {
  for (const f of REDIRECTS) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /redirect\("\/portal\/donate"\)/);
    assert.ok(!src.includes("Card"), `${f} still renders a legacy component`);
    assert.ok(!src.includes("supabase"), `${f} still reads data`);
  }
});

test("portal navigation says Contribution", () => {
  for (const f of ["components/portal-nav.tsx", "components/portal/MobileSanctuaryDock.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.ok(src.includes("Contribution"), `${f} lost the Contribution label`);
    assert.ok(!/>Donate</.test(src) && !/label: "Donate"/.test(src), `${f} still says Donate`);
  }
});

test("the migration pins the privacy boundary", () => {
  const src = readFileSync(MIGRATION, "utf8");
  assert.match(src, /finance\.current_member_id\(\)/);
  for (const revoke of [
    "revoke select on finance_api.agreement_amounts   from authenticated",
    "revoke select on finance_api.ledger_entries      from authenticated",
    "revoke select on finance_api.checkout_sessions   from authenticated",
  ]) {
    assert.ok(src.includes(revoke), `missing revoke: ${revoke}`);
  }
  // Member-callable checkout returns no Stripe/idempotency material (also
  // asserted in-transaction; pinned here so an edit is caught pre-apply).
  assert.match(src, /pg_get_function_result\(p\.oid\) ilike '%stripe%'/);
  // Full remaining is derived under lock, never accepted.
  assert.match(src, /for update/);
  assert.ok(!/begin_member_contribution_checkout\([^)]*amount/i.test(src.split("returns table")[0]),
    "contribution checkout accepts an amount parameter");
});

test("checkout readiness gates issuance only, never the read source", () => {
  const page = readFileSync(PAGE, "utf8");
  // The flag is read server-side and passed as a boolean; the reads above it
  // are unconditional.
  assert.match(page, /FINANCE_V2_CHECKOUT_READY === "true"/);
  assert.ok(
    page.indexOf("member_contribution_overview") < page.indexOf("process.env.FINANCE_V2_CHECKOUT_READY"),
    "reads must not depend on the readiness flag",
  );
});
