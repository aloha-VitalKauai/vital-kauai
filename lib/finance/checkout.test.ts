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
const issued = { link_id: "8c1d3f2b-4b6c-4e5a-9f0a-8d7e1b2c3d4e", amount_cents: 500000, expires_at: "2026-09-11T00:00:00Z" };

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
  founderSession((args) => { seen = args; return { data: [{ ...issued, amount_cents: 1250000 }], error: null }; });
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
  assert.ok(src.includes("unit_amount: amount.amountCents"), "Stripe receives the same checked amount");
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
