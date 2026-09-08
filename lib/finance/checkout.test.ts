/**
 * PR 10B (D-090) — the founder-chosen collection amount, application side.
 *
 * The database half (issuance cap, attempt cap, link–attempt consistency, role
 * boundary, single overload) is proven by supabase/tests/proofs/
 * pr10b_partial_collection.sql in a rolled-back transaction. These tests pin
 * the TypeScript rules that could regress silently: the shape check that runs
 * before any RPC, the pure amount rule the bridge applies, the founder route's
 * behaviour under the recording loader, and the source facts the brief's
 * acceptance criteria name. No database, no Stripe, no network.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { parseCollectionAmountCents, attemptAmountFor } from "./checkout.ts";
import { POST } from "../../app/api/finance/payment-links/route.ts";

const MIGRATION = "supabase/migrations/20260904010000_finance_pr10b_chosen_amount.sql";
const PR6_MIGRATION = "supabase/migrations/20260821140000_finance_pr6_checkout.sql";
const CHECKOUT = "lib/finance/checkout.ts";
const FOUNDER_ROUTE = "app/api/finance/payment-links/route.ts";
const MEMBER_ROUTE = "app/api/finance/member-checkout/route.ts";
const MEMBER_SERVICE = "lib/finance/member-checkout.ts";
const PANEL = "app/components/dashboard/financials/V2FinancialPanel.tsx";

/** SQL with comments removed, so a pin cannot be satisfied by a comment. */
function sqlCode(path: string): string {
  return readFileSync(path, "utf8").replace(/--.*$/gm, "");
}

// ── parseCollectionAmountCents (criterion 6) ─────────────────────────────────

test("an omitted amount means the full remaining and is passed through as null", () => {
  assert.deepEqual(parseCollectionAmountCents(undefined), { ok: true, amountCents: null });
  assert.deepEqual(parseCollectionAmountCents(null), { ok: true, amountCents: null });
});

test("a safe positive integer number of cents is accepted as is", () => {
  assert.deepEqual(parseCollectionAmountCents(500000), { ok: true, amountCents: 500000 });
  assert.deepEqual(parseCollectionAmountCents(1), { ok: true, amountCents: 1 });
  assert.deepEqual(parseCollectionAmountCents(Number.MAX_SAFE_INTEGER), { ok: true, amountCents: Number.MAX_SAFE_INTEGER });
});

test("zero, negative, fractional, string, NaN, Infinity and 2^53 are refused", () => {
  for (const input of [0, -1, 50.5, "5000", NaN, Infinity, -Infinity, 2 ** 53, "", true, {}, []]) {
    assert.deepEqual(parseCollectionAmountCents(input), { ok: false, reason: "invalid_amount" }, `${String(input)} must be refused`);
  }
});

// ── attemptAmountFor (criteria 1, 2, 7) ──────────────────────────────────────

test("a link without a figure collects the full payable remaining", () => {
  assert.deepEqual(attemptAmountFor(null, 1250000), { ok: true, amountCents: 1250000 });
});

test("a link with a figure within the payable remaining collects that figure", () => {
  assert.deepEqual(attemptAmountFor(500000, 1250000), { ok: true, amountCents: 500000 });
  assert.deepEqual(attemptAmountFor(500000, 500000), { ok: true, amountCents: 500000 });
});

test("a balance that moved below the link's figure is refused, never clamped", () => {
  assert.deepEqual(attemptAmountFor(500000, 450000), { ok: false, reason: "exceeds_remaining" });
});

test("nothing payable refuses regardless of the link's figure", () => {
  assert.deepEqual(attemptAmountFor(null, 0), { ok: false, reason: "nothing_payable" });
  assert.deepEqual(attemptAmountFor(500000, 0), { ok: false, reason: "nothing_payable" });
  assert.deepEqual(attemptAmountFor(null, null), { ok: false, reason: "nothing_payable" });
  assert.deepEqual(attemptAmountFor(500000, -1), { ok: false, reason: "nothing_payable" });
});

// ── The founder route under the recording loader (criterion 6) ──────────────

type Call = { call: string; arg0?: string };
type Harness = {
  __VK_CALLS: Call[];
  __VK_RESOLVE?: (call: string, args: unknown[]) => unknown;
};
const harness = globalThis as unknown as Harness;

/** Drive the stubbed Supabase client as an authenticated founder. */
function founderSession(onIssue: (args: Record<string, unknown>) => unknown) {
  harness.__VK_RESOLVE = (call, args) => {
    if (call.endsWith("auth.getUser")) return { data: { user: { id: "founder", email: "founder@vitalkauai.com" } } };
    if (call.endsWith(".rpc") && args[0] === "is_founder") return { data: true, error: null };
    if (call.endsWith(".rpc") && args[0] === "issue_payment_link") return onIssue(args[1] as Record<string, unknown>);
    return undefined;
  };
}

function post(body: unknown): Request {
  return new Request("https://vitalkauai.com/api/finance/payment-links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const AGREEMENT = "3f2b8c1d-4e5a-4b6c-8d7e-9f0a1b2c3d4e";
const issueBody = { action: "issue", agreementId: AGREEMENT, reason: "Deposit for the spring journey", email: false };
// The database replies with three figures (PR 10E); with the fee off they are amount, 0, amount.
const issued = { link_id: "8c1d3f2b-4b6c-4e5a-9f0a-8d7e1b2c3d4e", amount_cents: 500000, processing_fee_cents: 0, total_cents: 500000, expires_at: "2026-09-11T00:00:00Z" };

beforeEach(() => {
  harness.__VK_CALLS.length = 0;
  process.env.FINANCE_V2_CHECKOUT_READY = "true";
});

test("a non-integer amount is refused with 400 invalid_amount before any RPC", async () => {
  // NaN and Infinity cannot travel as JSON numbers (JSON.stringify emits null,
  // which is "omitted"); they are refused at the function level above, and a
  // literal NaN in a body is not JSON at all — covered below.
  for (const amountCents of [50.5, "5000", 2 ** 53, 0, -1, "", true]) {
    harness.__VK_CALLS.length = 0;
    founderSession(() => { throw new Error("issue_payment_link must not be reached"); });
    const res = await POST(post({ ...issueBody, amountCents }));
    assert.equal(res.status, 400, `${String(amountCents)} must be refused`);
    assert.equal((await res.json()).error, "invalid_amount");
    const rpcs = harness.__VK_CALLS.filter((c) => c.arg0 === "issue_payment_link");
    assert.equal(rpcs.length, 0, `${String(amountCents)} reached the database`);
  }
});

test("a literal NaN in the body is not JSON and never reaches the database", async () => {
  founderSession(() => { throw new Error("issue_payment_link must not be reached"); });
  const res = await POST(new Request("https://vitalkauai.com/api/finance/payment-links", {
    method: "POST", headers: { "content-type": "application/json" },
    body: '{"action":"issue","agreementId":"x","reason":"r","email":false,"amountCents":NaN}',
  }));
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_json");
  assert.equal(harness.__VK_CALLS.filter((c) => c.arg0 === "issue_payment_link").length, 0);
});

test("a chosen amount is forwarded as p_amount_cents and echoed from the database's reply", async () => {
  let seen: Record<string, unknown> | null = null;
  founderSession((args) => { seen = args; return { data: [issued], error: null }; });
  const res = await POST(post({ ...issueBody, amountCents: 500000 }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.amountCents, 500000);
  assert.ok(seen, "issue_payment_link was called");
  assert.equal(seen!.p_amount_cents, 500000);
  assert.equal(seen!.p_agreement_id, AGREEMENT);
  // The hash reaches the database; the raw token exists only in the response.
  assert.equal(seen!.p_token_hash, createHash("sha256").update(json.url.split("/contribute/")[1], "utf8").digest("base64"));
});

test("an omitted amount omits p_amount_cents entirely so the database default applies", async () => {
  let seen: Record<string, unknown> | null = null;
  founderSession((args) => { seen = args; return { data: [{ ...issued, amount_cents: 1250000, total_cents: 1250000 }], error: null }; });
  const res = await POST(post(issueBody));
  assert.equal(res.status, 200);
  assert.equal((await res.json()).amountCents, 1250000);
  assert.ok(seen, "issue_payment_link was called");
  assert.equal("p_amount_cents" in seen!, false, "p_amount_cents must be absent, not null");
});

test("a database refusal (the cap) is a 409 that carries the message", async () => {
  founderSession(() => ({ data: null, error: { message: "issue_payment_link: amount 1250001 exceeds payable remaining 1250000" } }));
  const res = await POST(post({ ...issueBody, amountCents: 1250001 }));
  assert.equal(res.status, 409);
  const json = await res.json();
  assert.equal(json.error, "refused");
  assert.match(json.detail, /exceeds payable remaining/);
});

// ── Source pins (criteria 2, 7, 13, 15) ──────────────────────────────────────

test("startCheckout refuses before phase 1 and sends the checked amount to both the attempt and Stripe", () => {
  const src = readFileSync(CHECKOUT, "utf8");
  const ready = src.indexOf('if (pre.state !== "ready") return { ok: false, reason: "not_ready" };');
  const claim = src.indexOf('fin.rpc("claim_payment_link"');
  const attempt = src.indexOf("attemptAmountFor(post?.link_amount_cents ?? null, post?.payable_remaining_cents ?? null)");
  const begin = src.indexOf('fin.rpc("begin_checkout_attempt"');
  assert.ok(ready > -1 && claim > ready, "the ready check runs before claim_payment_link");
  assert.ok(attempt > claim && begin > attempt, "attemptAmountFor runs after the claim and before begin_checkout_attempt");
  assert.ok(src.includes("p_amount_cents: amount.amountCents"), "the attempt carries the checked amount");
  // PR 10E: Stripe receives the CHARGE the database derived (contribution +
  // fee), read from begin_checkout_attempt's reply and never computed here.
  assert.ok(src.includes("const charge = attempt.charge_amount_cents;"), "the charge is the database's figure");
  assert.ok(src.includes("unit_amount: charge,"), "Stripe receives the database's charge");
  assert.ok(!src.includes("unit_amount: amount.amountCents"), "Stripe no longer receives the bare contribution");
  assert.ok(src.includes("contribution + fee !== charge"), "a reply whose parts do not sum to the charge is refused");
  // resolveTokenState: the link's figure against the live payable, review on excess.
  assert.ok(src.includes("attemptAmountFor(row.link_amount_cents, row.payable_remaining_cents)"));
  assert.ok(src.includes('amount.reason === "nothing_payable" ? { state: "paid" } : { state: "review" }'));
});

test("the founder route forwards p_amount_cents only when one was supplied", () => {
  const src = readFileSync(FOUNDER_ROUTE, "utf8");
  assert.ok(src.includes("if (amountCents !== null) args.p_amount_cents = amountCents;"));
  assert.ok(src.includes("parseCollectionAmountCents(body.amountCents)"));
  assert.ok(src.includes("for your contribution payment of <strong>"), "the email names a payment, not the whole contribution");
});

test("the member path still refuses any amount and never reaches begin_checkout_attempt", () => {
  const route = readFileSync(MEMBER_ROUTE, "utf8");
  assert.ok(route.includes("amount_not_accepted"));
  assert.ok(route.includes('"amountCents" in body || "amount" in body || "amount_cents" in body'));
  assert.ok(!route.includes("p_amount_cents"), "the member route must not mention p_amount_cents");
  const service = readFileSync(MEMBER_SERVICE, "utf8");
  assert.ok(!service.includes("begin_checkout_attempt"), "member checkout inserts through begin_member_* only");
});

test("the Collect drawer converts dollars to cents as integers and sends the full remaining as no amount", () => {
  const src = readFileSync(PANEL, "utf8");
  assert.ok(src.includes("function dollarsToCents(input: string): number | null"));
  assert.ok(src.includes("Number(m[1]) * 100 + Number((m[2] ?? \"\").padEnd(2, \"0\"))"), "integer parse, no parseFloat");
  assert.ok(src.includes("if (collectCents !== drawer.agreement.remaining_cents) body.amountCents = collectCents;"));
  assert.ok(src.includes("Leave as is to collect the full balance."));
  assert.ok(!/parseFloat\(collectAmount/.test(src), "the collect amount never goes through parseFloat");
});

// ── The migration (criteria 9, 12, 14, 15) ───────────────────────────────────

test("the column is nullable with the named CHECK, and no fact table gains an UPDATE or DELETE", () => {
  const code = sqlCode(MIGRATION);
  assert.ok(code.includes("add column amount_cents bigint null"));
  assert.ok(code.includes("constraint payment_links_amount_cents_positive check (amount_cents is null or amount_cents > 0)"));
  assert.ok(!/\b(update|delete\s+from)\s+finance\.(ledger_entries|agreement_amounts|agreement_lifecycle_events)\b/i.test(code));
});

test("the three-argument signatures are dropped in both schemas and one defaulted overload remains", () => {
  const code = sqlCode(MIGRATION);
  assert.ok(code.includes("drop function finance_api.issue_payment_link(uuid, text, text);"));
  assert.ok(code.includes("drop function finance.issue_payment_link(uuid, text, text);"));
  assert.equal((code.match(/create function finance\.issue_payment_link\(/g) ?? []).length, 1);
  assert.equal((code.match(/create function finance_api\.issue_payment_link\(/g) ?? []).length, 1);
  assert.equal((code.match(/p_amount_cents bigint default null/g) ?? []).length, 2);
});

test("every new signature is REVOKEd from public before it is granted", () => {
  const code = sqlCode(MIGRATION);
  for (const sig of [
    "finance.issue_payment_link(uuid, text, text, bigint)",
    "finance_api.issue_payment_link(uuid, text, text, bigint)",
    "finance.peek_payment_link(text)",
    "finance_api.peek_payment_link(text)",
  ]) {
    const revoke = code.indexOf(`revoke all on function ${sig} from public;`);
    const grant = code.indexOf(`grant execute on function ${sig} to `);
    assert.ok(revoke > -1, `missing REVOKE for ${sig}`);
    assert.ok(grant > revoke, `GRANT must follow REVOKE for ${sig}`);
  }
  assert.ok(code.includes("grant execute on function finance_api.issue_payment_link(uuid, text, text, bigint) to authenticated;"));
  assert.ok(code.includes("grant execute on function finance_api.peek_payment_link(text) to service_role;"));
});

test("the migration touches no index, no balance view and no ledger function", () => {
  // Comments and string literals removed: what remains is the DDL itself. The
  // closing assertion reads checkout_sessions_live_uq by name inside literals
  // only; no statement may name it.
  const code = sqlCode(MIGRATION).replace(/'(?:[^']|'')*'/g, "''");
  assert.ok(!/\b(create|drop|alter)\s+(unique\s+)?index\b/i.test(code), "no index DDL at all");
  assert.ok(!code.includes("checkout_sessions_live_uq"), "checkout_sessions_live_uq is only read, never defined");
  assert.ok(!/(view|function)\s+finance\.(v_agreement_balances|f_balances)\b/i.test(code));
  assert.ok(!/record_v2_stripe_payment|record_external_payment|reverse_ledger_entry/.test(code));
});

test("the PR 6 migration is byte-identical", () => {
  const digest = createHash("sha256").update(readFileSync(PR6_MIGRATION)).digest("hex");
  assert.equal(digest, "c010d68a971fc9d2758d99555f8af8283e469e52d7811c6e5156aee27181edd1");
});

// ═════════════════════════════════════════════════════════════════════════════
// PR 10E (D-092) — the processing fee on founder-issued links, application side.
// The database half is supabase/tests/proofs/pr10e_link_processing_fee.sql.
// ═════════════════════════════════════════════════════════════════════════════

import { tokenStateFor, linkChargeFor, lineItemDescription } from "./checkout.ts";
import { FORBIDDEN_KEYS, GET } from "../../app/api/finance/payment-links/route.ts";
import { RETIRED_TABLES } from "../../scripts/retirement-gate.mjs";

const PR10E_MIGRATION = "supabase/migrations/20260908010000_finance_pr10e_link_processing_fee.sql";
const PR10E_PROOF = "supabase/tests/proofs/pr10e_link_processing_fee.sql";
const BRIDGE_PAGE = "app/contribute/[token]/page.tsx";
const CONTRIBUTE_ROUTE = "app/api/contribute/route.ts";
const WORKER = "lib/finance/reconciliation/worker.ts";
const RECON_DB = "lib/finance/reconciliation/supabase-db.ts";

type PeekRowT = Parameters<typeof tokenStateFor>[0];
const FUTURE = "2999-01-01T00:00:00Z";
function peekRow(o: Partial<PeekRowT> = {}): PeekRowT {
  return {
    link_id: "lnk", agreement_id: "agr", link_status: "active", link_expires_at: FUTURE,
    session_id: null, session_status: null, stripe_session_id: null, session_amount_cents: null,
    payable_remaining_cents: 1000000, payment_state: "unpaid",
    link_amount_cents: 1000000,
    link_fee_bps: null, link_fee_fixed_cents: null, link_fee_policy_version: null,
    session_contribution_cents: null, session_processing_fee_cents: null,
    ...o,
  };
}
const SNAPSHOT = { link_fee_bps: 290, link_fee_fixed_cents: 30, link_fee_policy_version: "stripe-standard-v1" };

// ── linkChargeFor: the link's own snapshot, or exactly the contribution ──────

test("PR10E: a link with no snapshot charges exactly its contribution (G)", () => {
  assert.deepEqual(linkChargeFor(1000000, peekRow()), { contributionCents: 1000000, processingFeeCents: 0, totalCents: 1000000 });
});

test("PR10E: a link with a snapshot is quoted by the one formula: 1000000 -> 29898 / 1029898; 100 -> 34 / 134", () => {
  assert.deepEqual(linkChargeFor(1000000, peekRow(SNAPSHOT)), { contributionCents: 1000000, processingFeeCents: 29898, totalCents: 1029898 });
  assert.deepEqual(linkChargeFor(100, peekRow(SNAPSHOT)), { contributionCents: 100, processingFeeCents: 34, totalCents: 134 });
});

test("PR10E: a partial snapshot is corrupt and throws — the bridge fails closed, never under-quotes", () => {
  assert.throws(() => linkChargeFor(100, peekRow({ link_fee_bps: 290, link_fee_fixed_cents: null, link_fee_policy_version: "v" })));
  assert.throws(() => linkChargeFor(100, peekRow({ link_fee_bps: null, link_fee_fixed_cents: 30, link_fee_policy_version: "v" })));
});

// ── tokenStateFor: criteria 2, 12, 13 ────────────────────────────────────────

test("PR10E: a NULL-snapshot link renders exactly today's single figure (fee 0, total = contribution)", () => {
  const s = tokenStateFor(peekRow());
  assert.deepEqual(s, { state: "ready", amountCents: 1000000, contributionCents: 1000000, processingFeeCents: 0, totalCents: 1000000 });
});

test("PR10E: a fee-bearing link is ready with the three figures the database will derive", () => {
  const s = tokenStateFor(peekRow(SNAPSHOT));
  assert.deepEqual(s, { state: "ready", amountCents: 1000000, contributionCents: 1000000, processingFeeCents: 29898, totalCents: 1029898 });
});

test("PR10E: the cap applies to the contribution — a fee-bearing link whose contribution equals the payable remaining is ready", () => {
  // Total 1029898 exceeds the payable remaining 1000000 by exactly the fee, and
  // that is the intended case (H). Nothing compares the total to the cap.
  const s = tokenStateFor(peekRow({ ...SNAPSHOT, link_amount_cents: 1000000, payable_remaining_cents: 1000000 }));
  assert.equal(s.state, "ready");
  const moved = tokenStateFor(peekRow({ ...SNAPSHOT, link_amount_cents: 1000000, payable_remaining_cents: 999999 }));
  assert.deepEqual(moved, { state: "review" });
});

const openFeeSession = (over: Partial<PeekRowT> = {}) => peekRow({
  ...SNAPSHOT,
  link_status: "consumed", session_id: "att_fee", session_status: "open", stripe_session_id: "cs_fee",
  session_amount_cents: 1029898, session_contribution_cents: 1000000, session_processing_fee_cents: 29898,
  payable_remaining_cents: 1000000, payment_state: "unpaid",
  ...over,
});

test("PR10E criterion 13: a fee-bearing open Session with unchanged Payable Remaining resumes as open_session, not review (M)", () => {
  const s = tokenStateFor(openFeeSession());
  assert.deepEqual(s, {
    state: "open_session", sessionId: "att_fee", stripeSessionId: "cs_fee",
    amountCents: 1029898, contributionCents: 1000000, processingFeeCents: 29898, totalCents: 1029898,
  });
});

test("PR10E criterion 13: after an external payment moves Payable Remaining below the Session's contribution, it is review", () => {
  assert.deepEqual(tokenStateFor(openFeeSession({ payable_remaining_cents: 500000, payment_state: "partial" })), { state: "review" });
  assert.deepEqual(tokenStateFor(openFeeSession({ payable_remaining_cents: null })), { state: "review" });
  // Exactly the contribution is still fine; one cent under is not.
  assert.equal(tokenStateFor(openFeeSession({ payable_remaining_cents: 1000000 })).state, "open_session");
  assert.equal(tokenStateFor(openFeeSession({ payable_remaining_cents: 999999 })).state, "review");
});

test("PR10E: a pre-10E open Session (no composition recorded) compares its whole amount as contribution", () => {
  const s = tokenStateFor(openFeeSession({
    link_fee_bps: null, link_fee_fixed_cents: null, link_fee_policy_version: null,
    session_amount_cents: 500000, session_contribution_cents: 500000, session_processing_fee_cents: 0,
    payable_remaining_cents: 500000, payment_state: "partial",
  }));
  assert.equal(s.state, "open_session");
  if (s.state === "open_session") assert.deepEqual([s.contributionCents, s.processingFeeCents, s.totalCents], [500000, 0, 500000]);
});

test("PR10E: the resolver's pure rule is what resolveTokenState applies", () => {
  const src = readFileSync(CHECKOUT, "utf8");
  assert.ok(src.includes("return tokenStateFor(row);"));
  assert.ok(src.includes("contributionCents > row.payable_remaining_cents"), "the reuse comparison is on the contribution");
  assert.ok(!src.includes("session_amount_cents > row.payable_remaining_cents"), "never on the total");
});

// ── The Stripe line item states the split (L) ────────────────────────────────

test("PR10E: the line item description states contribution + fee = total", () => {
  assert.equal(
    lineItemDescription({ contributionCents: 1000000, processingFeeCents: 29898, totalCents: 1029898 }),
    "Contribution $10,000.00 + card processing fee $298.98 = $10,298.98 charged",
  );
  const src = readFileSync(CHECKOUT, "utf8");
  assert.ok(src.includes("fee > 0 ? { description: lineItemDescription("), "the description is attached only when a fee applies");
});

// ── Criterion 6: the browser cannot do fee math ──────────────────────────────

test("PR10E criterion 6: every forbidden key is refused with 400 amount_math_not_accepted and no issue RPC", async () => {
  assert.deepEqual([...FORBIDDEN_KEYS].sort(), [
    "feeBps", "feeCents", "feePolicyVersion", "fee_bps", "fee_cents", "fee_policy_version",
    "processingFeeCents", "processing_fee_cents", "totalCents", "total_cents",
  ].sort());
  for (const key of FORBIDDEN_KEYS) {
    harness.__VK_CALLS.length = 0;
    founderSession(() => { throw new Error("issue_payment_link must not be reached"); });
    const res = await POST(post({ ...issueBody, amountCents: 100, [key]: 34 }));
    assert.equal(res.status, 400, `${key} must be refused`);
    assert.equal((await res.json()).error, "amount_math_not_accepted");
    const rpcs = harness.__VK_CALLS.filter((c) => c.call.endsWith(".rpc") && c.arg0 !== "is_founder");
    assert.equal(rpcs.length, 0, `${key}: an RPC other than the founder check was made`);
  }
});

test("PR10E: the route echoes the database's three figures and forwards no fee to it", async () => {
  let seen: Record<string, unknown> | null = null;
  founderSession((args) => {
    seen = args;
    return { data: [{ ...issued, amount_cents: 100, processing_fee_cents: 34, total_cents: 134 }], error: null };
  });
  const res = await POST(post({ ...issueBody, amountCents: 100 }));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual([json.amountCents, json.processingFeeCents, json.totalCents], [100, 34, 134]);
  assert.ok(seen);
  assert.deepEqual(Object.keys(seen!).sort(), ["p_agreement_id", "p_amount_cents", "p_reason", "p_token_hash"]);
});

test("PR10E: a reply whose figures do not add up is refused rather than shown", async () => {
  founderSession(() => ({ data: [{ ...issued, amount_cents: 100, processing_fee_cents: 34, total_cents: 135 }], error: null }));
  const res = await POST(post({ ...issueBody, amountCents: 100 }));
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, "issue_failed");
});

test("PR10E: POST /api/contribute accepts no amount or fee field at all", () => {
  const src = readFileSync(CONTRIBUTE_ROUTE, "utf8");
  assert.ok(src.includes('as { token?: string }).token'), "the body yields the token only");
  assert.ok(!/amount|fee|total/i.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")), "no amount, fee or total is read");
});

// ── The founder's quote endpoint: server-derived, never browser math ─────────

function quoteRequest(q: string): Request {
  return new Request(`https://vitalkauai.com/api/finance/payment-links?quoteContributionCents=${q}`, { method: "GET" });
}
function founderReadingSettings(row: Record<string, unknown> | null) {
  harness.__VK_RESOLVE = (call, args) => {
    if (call.endsWith("auth.getUser")) return { data: { user: { id: "founder", email: "founder@vitalkauai.com" } } };
    if (call.endsWith(".rpc") && args[0] === "is_founder") return { data: true, error: null };
    if (call.includes("(fee_settings)") && call.endsWith(".returns")) return { data: row ? [row] : [], error: null };
    return undefined;
  };
}

test("PR10E: the quote endpoint returns the server's quote from the policy in force", async () => {
  founderReadingSettings({ fee_enabled: true, fee_bps: 290, fee_fixed_cents: 30, fee_policy_version: "stripe-standard-v1" });
  const res = await GET(quoteRequest("1000000"));
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.feeEnabled, true);
  assert.deepEqual(json.quote, { contributionCents: 1000000, processingFeeCents: 29898, totalCents: 1029898, feePolicyVersion: "stripe-standard-v1" });
});

test("PR10E: with the fee off the quote is the contribution with fee 0, and a missing settings row is never a zero", async () => {
  founderReadingSettings({ fee_enabled: false, fee_bps: 290, fee_fixed_cents: 30, fee_policy_version: "stripe-standard-v1" });
  const off = await GET(quoteRequest("1000000"));
  assert.equal(off.status, 200);
  const j = await off.json();
  assert.equal(j.feeEnabled, false);
  assert.deepEqual(j.quote, { contributionCents: 1000000, processingFeeCents: 0, totalCents: 1000000, feePolicyVersion: null });
  founderReadingSettings(null);
  const missing = await GET(quoteRequest("1000000"));
  assert.equal(missing.status, 503);
  assert.equal((await missing.json()).error, "fee_settings_unavailable");
});

test("PR10E: the quote endpoint refuses anything but a safe positive integer", async () => {
  founderReadingSettings({ fee_enabled: true, fee_bps: 290, fee_fixed_cents: 30, fee_policy_version: "stripe-standard-v1" });
  for (const q of ["0", "-1", "50.5", "abc", "", "9007199254740992", "1e3"]) {
    const res = await GET(quoteRequest(q));
    assert.equal(res.status, 400, `${q} must be refused`);
    assert.equal((await res.json()).error, "invalid_amount");
  }
});

// ── Criterion 12: the bridge itemizes; the single figure survives (source pins) ──

test("PR10E criterion 12: the bridge renders Contribution / Card processing fee / Total charged only when a fee applies", () => {
  const src = readFileSync(BRIDGE_PAGE, "utf8");
  const gate = src.indexOf("{s.processingFeeCents > 0 ? (");
  const contribution = src.indexOf('<Row label="Contribution" value={usd(s.contributionCents)} />');
  const fee = src.indexOf('<Row label="Card processing fee" value={usd(s.processingFeeCents)} />');
  const total = src.indexOf('<Row label="Total charged" value={usd(s.totalCents)} strong />');
  const single = src.indexOf("Amount due today");
  assert.ok(gate > -1 && contribution > gate && fee > contribution && total > fee, "three lines, in order, inside the fee branch");
  assert.ok(single > total, "the single-figure branch is the else branch");
  assert.ok(src.includes("{usd(s.amountCents)}"), "the single figure is still the link's figure");
  assert.ok(!/quoteProcessingFee|feeBps|10000/.test(src), "the page computes nothing");
});

// ── The worker forwards identity, the reconciliation reads the fee ───────────

test("PR10E: the worker forwards p_attempt_id from PaymentIntent metadata on the V2 branch only", () => {
  const src = readFileSync(WORKER, "utf8");
  assert.equal((src.match(/p_attempt_id: meta\.attempt_id \?\? null,/g) ?? []).length, 1);
  const v2 = src.indexOf('fin().rpc("record_v2_stripe_payment"');
  const pub = src.indexOf('fin().rpc("record_public_support_payment"');
  const at = src.indexOf("p_attempt_id: meta.attempt_id ?? null,");
  assert.ok(v2 > -1 && at > v2 && at < pub, "the addition sits inside the V2 call");
  assert.ok(!/p_processing_fee|p_contribution_cents|p_total/.test(src), "the worker sends no fee arithmetic");
});

test("PR10E criterion 11: reconciliation selects the fee column and refuses a row without it", () => {
  const src = readFileSync(RECON_DB, "utf8");
  assert.ok(src.includes("amount_cents, processing_fee_cents, provider_object_id"));
  assert.ok(src.includes("processing_fee_cents missing on ledger entry"), "a missing fee is an error, never a zero");
  const diff = readFileSync("lib/finance/reconciliation/diff.ts", "utf8");
  assert.ok(diff.includes("existing.amountCents + existing.processingFeeCents"));
  assert.ok(diff.includes("if (ledgerGrossCents !== p.amountCents)"));
});

// ── The migration (criteria 14, 17, 18) ──────────────────────────────────────

test("PR10E: the ledger column is NOT NULL DEFAULT 0 with both CHECKs, and no fact table gains an UPDATE or DELETE", () => {
  const code = sqlCode(PR10E_MIGRATION);
  assert.ok(code.includes("add column processing_fee_cents bigint not null default 0"));
  assert.ok(code.includes("constraint ledger_fee_nonnegative check (processing_fee_cents >= 0)"));
  assert.ok(code.includes("check (processing_fee_cents = 0 or (entry_type = 'stripe_payment' and source = 'stripe'))"));
  assert.ok(!/\b(update|delete\s+from)\s+finance\.(ledger_entries|agreement_amounts|agreement_lifecycle_events)\b/i.test(code));
  // The only UPDATE in the file is the founder setter on the config row.
  const updates = code.match(/\bupdate\s+finance\.\w+/gi) ?? [];
  assert.deepEqual(updates, ["update finance.fee_settings"]);
});

test("PR10E: every old signature is dropped in both schemas and every new one is REVOKEd from public before it is granted", () => {
  const code = sqlCode(PR10E_MIGRATION);
  for (const drop of [
    "drop function finance_api.issue_payment_link(uuid, text, text, bigint);",
    "drop function finance.issue_payment_link(uuid, text, text, bigint);",
    "drop function finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean);",
    "drop function finance.begin_checkout_attempt(uuid, uuid, bigint, boolean);",
    "drop function finance_api.peek_payment_link(text);",
    "drop function finance.peek_payment_link(text);",
    "drop function finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text);",
    "drop function finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text);",
  ]) assert.ok(code.includes(drop), `missing ${drop}`);
  const sigs: Array<[string, string]> = [
    ["finance.quote_processing_fee(bigint, integer, integer)", ""],
    ["finance.set_fee_settings(boolean, integer, integer, text)", "authenticated"],
    ["finance_api.set_fee_settings(boolean, integer, integer, text)", "authenticated"],
    ["finance.issue_payment_link(uuid, text, text, bigint)", "authenticated"],
    ["finance_api.issue_payment_link(uuid, text, text, bigint)", "authenticated"],
    ["finance.begin_checkout_attempt(uuid, uuid, bigint, boolean)", "service_role"],
    ["finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean)", "service_role"],
    ["finance.peek_payment_link(text)", "service_role"],
    ["finance_api.peek_payment_link(text)", "service_role"],
    ["finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text, uuid)", "service_role"],
    ["finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text, uuid)", "service_role"],
  ];
  for (const [sig, role] of sigs) {
    const revoke = code.indexOf(`revoke all on function ${sig} from public;`);
    assert.ok(revoke > -1, `missing REVOKE for ${sig}`);
    if (role) {
      const grant = code.indexOf(`grant execute on function ${sig} to ${role};`);
      assert.ok(grant > revoke, `GRANT to ${role} must follow REVOKE for ${sig}`);
    } else {
      assert.ok(!code.includes(`grant execute on function ${sig}`), `${sig} is granted to nobody`);
    }
  }
  assert.equal((code.match(/create function finance\.issue_payment_link\(/g) ?? []).length, 1);
  assert.equal((code.match(/create function finance_api\.issue_payment_link\(/g) ?? []).length, 1);
  assert.equal((code.match(/p_attempt_id uuid default null/g) ?? []).length, 2);
});

test("PR10E: the migration touches no index, no balance view and no ledger function other than the four it recreates", () => {
  const code = sqlCode(PR10E_MIGRATION).replace(/'(?:[^']|'')*'/g, "''");
  assert.ok(!/\b(create|drop|alter)\s+(unique\s+)?index\b/i.test(code), "no index DDL at all");
  assert.ok(!code.includes("checkout_sessions_live_uq"), "checkout_sessions_live_uq is only read, never defined");
  assert.ok(!/(view|function)\s+finance\.(v_agreement_balances|f_balances|v_member_financials|v_journey_financials|v_agreement_lifecycle)\b/i.test(code));
  assert.ok(!/record_external_payment|reverse_ledger_entry|begin_member_contribution_checkout|begin_member_gift_checkout/.test(code));
  // The retired tables, by the gate's own list — never named here.
  assert.ok(!new RegExp("\\b(" + [...RETIRED_TABLES, "bookings"].join("|") + ")\\b").test(code), "no legacy table is named");
});

test("PR10E: the fee settings are one founder-written row, readable through a façade view only", () => {
  const code = sqlCode(PR10E_MIGRATION);
  assert.ok(code.includes("constraint fee_settings_singleton check (id)"));
  assert.ok(code.includes("values (true, false, 290, 30, 'stripe-standard-v1');"));
  assert.ok(code.includes("revoke all on finance.fee_settings from public, anon, authenticated, service_role;"));
  assert.ok(code.includes("grant select on finance.fee_settings to authenticated, service_role;"));
  assert.ok(code.includes("for select to authenticated using (public.is_founder());"));
  assert.ok(code.includes("create view finance_api.fee_settings with (security_invoker = true) as"));
  assert.ok(!/grant\s+(insert|update|delete|all)\s+on\s+finance\.fee_settings/i.test(code));
});

test("PR10E: the D-090 migration is byte-identical", () => {
  const digest = createHash("sha256").update(readFileSync(MIGRATION)).digest("hex");
  assert.equal(digest, "690d9f6d26c0057f092bbf9464ae1d76652566c3979971fcaa27aea252399cc7");
});

test("PR10E: the proof is the migration plus the proof in one transaction that ends by raising", () => {
  const proof = readFileSync(PR10E_PROOF, "utf8");
  assert.ok(proof.includes(">>> migration body (verbatim from supabase/migrations/20260908010000_finance_pr10e_link_processing_fee.sql) >>>"));
  assert.ok(!/^\s*commit\s*;/im.test(proof), "no COMMIT anywhere");
  assert.ok(proof.trim().endsWith("rollback;"));
  assert.ok(proof.includes("raise exception 'PR 10E proof complete"));
});
