/**
 * PR 10E (D-092) — one fee formula, proven equal (criterion 7).
 *
 * The gross-up exists exactly twice by necessity: the authoritative SQL
 * function finance.quote_processing_fee, and the display-only TypeScript
 * quoteProcessingFee. This file pins the TypeScript half against the committed
 * vector fixture, pins the fixture against exact integer arithmetic (so a
 * rounded figure can never enter it), pins the SQL proof's embedded copies of
 * the fixture and of the migration body byte-for-byte to their sources, and
 * greps the live code for any third expression of the formula. The SQL half —
 * every vector through finance.quote_processing_fee, and begin_public_checkout
 * before/after the rewire — is supabase/tests/proofs/pr10e_link_processing_fee.sql.
 * No database, no Stripe, no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

import { quoteProcessingFee } from "./public-support-fees.ts";

const FIXTURE = "supabase/tests/fixtures/fee_vectors.json";
const MIGRATION = "supabase/migrations/20260908010000_finance_pr10e_link_processing_fee.sql";
const PROOF = "supabase/tests/proofs/pr10e_link_processing_fee.sql";
const TS_FORMULA = "lib/finance/public-support-fees.ts";

type Vector = {
  name: string; contribution_cents: number; fee_bps: number; fee_fixed_cents: number;
  processing_fee_cents: number; total_cents: number;
};
const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as { vectors: Vector[] };

/** ceil((c + fixed) * 10000 / (10000 - bps)) in exact integer arithmetic. */
function exactTotal(c: number, bps: number, fixed: number): bigint {
  const d = 10000n - BigInt(bps);
  return ((BigInt(c) + BigInt(fixed)) * 10000n + d - 1n) / d;
}

// ── The fixture itself ───────────────────────────────────────────────────────

test("the fixture carries every vector the brief names", () => {
  const byName = new Map(fixture.vectors.map((v) => [v.name, v]));
  const has = (name: string) => assert.ok(byName.has(name), `missing vector ${name}`);
  has("one_cent_default_policy");                    // contribution = 1
  has("zero_bps");                                   // bps = 0
  has("zero_fixed");                                 // fixed = 0
  has("criterion_3_ten_thousand_dollars");           // the ceiling rounds up
  has("divides_exactly_default_policy");             // divides exactly
  has("two_to_the_forty");                           // contribution = 2^40
  has("founder_drill_one_dollar");                   // criterion 20: $1.00 + $0.34
  assert.equal(byName.get("one_cent_default_policy")!.contribution_cents, 1);
  assert.equal(byName.get("zero_bps")!.fee_bps, 0);
  assert.equal(byName.get("zero_fixed")!.fee_fixed_cents, 0);
  assert.equal(byName.get("two_to_the_forty")!.contribution_cents, 2 ** 40);
  assert.equal(byName.get("criterion_3_ten_thousand_dollars")!.total_cents, 1029898);
  assert.equal(byName.get("founder_drill_one_dollar")!.total_cents, 134);
  assert.ok(fixture.vectors.length >= 10);
  assert.equal(new Set(fixture.vectors.map((v) => v.name)).size, fixture.vectors.length, "vector names are unique");
});

test("every fixture figure is the exact integer ceiling, and fee = total - contribution", () => {
  for (const v of fixture.vectors) {
    assert.ok(Number.isSafeInteger(v.contribution_cents) && v.contribution_cents > 0, v.name);
    assert.ok(Number.isSafeInteger(v.total_cents) && Number.isSafeInteger(v.processing_fee_cents), v.name);
    assert.equal(BigInt(v.total_cents), exactTotal(v.contribution_cents, v.fee_bps, v.fee_fixed_cents), `${v.name}: total is not the exact ceiling`);
    assert.equal(v.processing_fee_cents, v.total_cents - v.contribution_cents, `${v.name}: fee is not total - contribution`);
  }
});

test("a rounds-up vector and a divides-exactly vector are both present, by arithmetic not by name", () => {
  const remainder = (v: Vector) =>
    ((BigInt(v.contribution_cents) + BigInt(v.fee_fixed_cents)) * 10000n) % (10000n - BigInt(v.fee_bps));
  assert.ok(fixture.vectors.some((v) => remainder(v) !== 0n), "no vector where the ceiling rounds up");
  assert.ok(fixture.vectors.some((v) => remainder(v) === 0n), "no vector where the division is exact");
});

// ── Criterion 7, TypeScript half ─────────────────────────────────────────────

test("quoteProcessingFee yields the fixture's total and fee for every vector", () => {
  for (const v of fixture.vectors) {
    const q = quoteProcessingFee(v.contribution_cents, {
      feeBps: v.fee_bps, feeFixedCents: v.fee_fixed_cents, feePolicyVersion: "stripe-standard-v1",
    });
    assert.equal(q.totalCents, v.total_cents, `${v.name}: total`);
    assert.equal(q.processingFeeCents, v.processing_fee_cents, `${v.name}: fee`);
    assert.equal(q.contributionCents, v.contribution_cents, `${v.name}: contribution echoed`);
  }
});

// ── The proof carries the fixture and the migration verbatim ─────────────────

function proofSection(src: string, open: string, close: string): string {
  const a = src.indexOf(open);
  const b = src.indexOf(close, a + open.length);
  assert.ok(a > -1 && b > a, `proof is missing the ${open.trim()} … ${close.trim()} block`);
  return src.slice(a + open.length, b);
}

test("the SQL proof embeds fee_vectors.json verbatim", () => {
  const proof = readFileSync(PROOF, "utf8");
  const embedded = proofSection(proof, "$vectors$\n", "\n$vectors$::jsonb");
  assert.deepEqual(JSON.parse(embedded), JSON.parse(readFileSync(FIXTURE, "utf8")));
  assert.equal(embedded, readFileSync(FIXTURE, "utf8").replace(/\n$/, ""), "byte-identical, not merely equivalent");
});

test("the SQL proof embeds the migration body byte-for-byte, with no COMMIT anywhere", () => {
  const migration = readFileSync(MIGRATION, "utf8").split("\n");
  const begin = migration.findIndex((l) => l.trim() === "begin;");
  const commit = migration.findIndex((l) => l.trim() === "commit;");
  assert.ok(begin > -1 && commit > begin, "the migration is one begin/commit transaction");
  assert.equal(migration.filter((l) => /^\s*(begin|commit)\s*;/i.test(l)).length, 2, "exactly one begin and one commit in the migration");
  const body = migration.slice(begin + 1, commit).join("\n").replace(/^\n+|\n+$/g, "");
  const proof = readFileSync(PROOF, "utf8");
  const embedded = proofSection(
    proof,
    "-- >>> migration body (verbatim from supabase/migrations/20260908010000_finance_pr10e_link_processing_fee.sql) >>>\n",
    "\n-- <<< end migration body <<<",
  );
  assert.equal(embedded, body, "the proof's copy of the migration has drifted from the migration file");
  assert.ok(!/^\s*commit\s*;/im.test(proof), "the proof must contain no COMMIT statement");
  assert.ok(/raise exception 'PR 10E proof complete/.test(proof), "the proof ends by raising, so it can only roll back");
});

// ── Criterion 7: exactly two expressions of the gross-up in live code ────────

const SCAN_ROOTS = ["lib", "app", "components", "scripts", "supabase/tests", "supabase/functions"];
const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".sql"]);
const PRUNED = new Set(["node_modules", ".next", ".git"]);
/** The proof carries the migration body (pinned byte-identical above); this test file names the formula to check it. */
const CARRIERS = new Set([PROOF, "lib/finance/fee-parity.test.ts"]);

function walk(dir: string, out: string[]) {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) { if (!PRUNED.has(e)) walk(p, out); }
    else if (SCAN_EXT.has(extname(p))) out.push(p);
  }
}

/** A gross-up site constructs the (10000 - bps) denominator AND takes the ceiling with "- 1) /". */
const DENOMINATOR = /\b10000\s*-\s*[A-Za-z_(]/;
const CEILING = /-\s*1\s*\)\s*\//;

test("the gross-up expression exists in exactly two live places: the TypeScript twin and the SQL function", () => {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) walk(root, files);
  files.push(MIGRATION);
  const sites = files.filter((f) => {
    if (CARRIERS.has(f)) return false;
    const src = readFileSync(f, "utf8");
    return DENOMINATOR.test(src) && CEILING.test(src);
  }).sort();
  assert.deepEqual(sites, [TS_FORMULA, MIGRATION].sort());

  // Inside the migration the denominator appears only in quote_processing_fee's
  // body (twice: the ceiling term and the divisor). begin_public_checkout calls
  // the function and carries no inline arithmetic.
  const mig = readFileSync(MIGRATION, "utf8");
  const fnStart = mig.indexOf("create function finance.quote_processing_fee(");
  const fnEnd = mig.indexOf("end $fn$;", fnStart);
  assert.ok(fnStart > -1 && fnEnd > fnStart);
  const body = mig.slice(fnStart, fnEnd);
  assert.equal((body.match(/\(10000 - p_fee_bps\)/g) ?? []).length, 2);
  assert.equal((mig.match(/\(10000 - p_fee_bps\)/g) ?? []).length, 2, "the denominator appears nowhere else in the migration");
  const pcStart = mig.indexOf("create or replace function finance.begin_public_checkout(");
  const pcEnd = mig.indexOf("end $fn$;", pcStart);
  const pc = mig.slice(pcStart, pcEnd);
  assert.ok(pc.includes("finance.quote_processing_fee(p_contribution_cents, v_c.fee_bps, v_c.fee_fixed_cents)"));
  assert.ok(!/\+\s*\(10000\s*-/.test(pc), "begin_public_checkout carries no inline gross-up");
});

test("no route, component or view re-derives a fee: the display twin is imported, never re-implemented", () => {
  const files: string[] = [];
  for (const root of ["lib", "app", "components"]) walk(root, files);
  const offenders = files.filter((f) => {
    if (f === TS_FORMULA || f.endsWith(".test.ts")) return false;
    const src = readFileSync(f, "utf8");
    // Any percentage-of-amount arithmetic keyed on a fee policy outside the twin.
    return /feeBps\s*\)?\s*\/\s*10000|\*\s*(policy\.)?feeBps|10000\s*-\s*(policy\.)?feeBps|fee_bps\s*\)\s*\/\s*10000/.test(src);
  });
  assert.deepEqual(offenders, []);
});
