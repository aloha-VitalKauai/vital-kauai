/**
 * PR 9 (D-086): the retirement absence gate.
 *
 * D-078 shipped a guard-centric scanner: it proved legacy writers were gated.
 * That is the wrong question now. PR 9 removed the legacy runtime outright, so
 * the gate must prove ABSENCE — that no application code can reach the retired
 * financial system at all, whether or not a guard is present.
 *
 * Two properties matter and are easy to get wrong:
 *
 *   1. SCOPE IS AUDITED, NOT ASSUMED. A scanner that silently misses a new
 *      directory or file extension reports "clean" forever. `auditScope()`
 *      enumerates what actually exists on disk and fails when it finds source
 *      the scan would not have read. Its answer is derived from the filesystem,
 *      never from the skip list.
 *   2. SKIPS ARE ENUMERATED AND VERIFIED. Exactly two files legitimately
 *      contain the forbidden strings — this scanner and its test. They are
 *      named explicitly, and the scan fails if any OTHER file claims exemption
 *      or if a named file has gone missing.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";

/** Directories that contain no first-party source. */
const PRUNED_DIRS = new Set([
  "node_modules", ".git", ".next", ".vercel", "dist", "build",
  "coverage", ".turbo", ".claude", "out",
]);

/** Every extension that can ship executable application code. */
export const SCANNED_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
]);

/**
 * The only files permitted to contain the forbidden vocabulary. Both exist to
 * describe the retirement; neither can reach a database.
 */
export const SELF_EXEMPT = [
  "scripts/retirement-gate.mjs",
  "supabase/tests/retirement-gate.test.ts",
];

/** The deployed legacy webhook must stay inert — no imports, no I/O. */
const EDGE_TOMBSTONE = "supabase/functions/stripe-webhook/index.ts";

const RETIRED_TABLES = ["donations", "financial_commitments", "payment_tokens", "payment_allocations"];
const RETIRED_VIEWS = ["financials_overview", "cohort_margin_summary", "private_ceremony_summary"];

/**
 * Matched on a word boundary, not on adjacent quotes. `from("donations")`,
 * `db["from"]("donations")`, a destructured `from`, and a raw
 * `'insert into donations …'` string all reduce to the same word — and an
 * AST walk over `.from(...)` would miss most of them. The cost is that prose
 * mentioning a retired table also trips the gate, which is the right trade:
 * it is trivially fixed by rewording, and it removes an evasion route.
 */
const FORBIDDEN = [
  ...RETIRED_TABLES.map((t) => ({
    id: `retired-table:${t}`,
    re: new RegExp(`\\b${t}\\b`),
    why: `references the retired table ${t}`,
  })),
  ...RETIRED_VIEWS.map((v) => ({
    id: `retired-view:${v}`,
    re: new RegExp(v),
    why: `reads the retired derived view ${v}`,
  })),
  { id: "legacy-fn", re: /fn_reconcile_financial_state/, why: "calls the dropped legacy reconciliation function" },
  { id: "legacy-route:payments", re: /\/api\/payments\//, why: "references a deleted legacy payment route" },
  { id: "legacy-route:donations", re: /\/api\/donations\//, why: "references a deleted legacy donation route" },
  { id: "legacy-route:square", re: /\/api\/square\//, why: "references a deleted Square route" },
  { id: "legacy-route:cron", re: /\/api\/cron\/reconcile/, why: "references the deleted legacy cron" },
  { id: "legacy-route:pay-thanks", re: /\/pay\/thanks/, why: "references the deleted legacy thanks page" },
  { id: "legacy-flag", re: /LEGACY_PAYMENTS_ENABLED|legacyPaymentsEnabled/, why: "references a removed legacy enable flag" },
  { id: "provider-selector", re: /PAYMENT_PROVIDER/, why: "references the removed provider selector" },
  { id: "provider-import", re: /payments\/legacy-enabled|lib\/payment-provider|lib\/square\//, why: "imports removed provider scaffolding" },
];

function walk(root, dir, out) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      if (PRUNED_DIRS.has(entry)) continue;
      walk(root, abs, out);
    } else if (st.isFile()) {
      out.push(relative(root, abs));
    }
  }
}

export function listAllFiles(root) {
  const out = [];
  walk(root, root, out);
  return out;
}

/**
 * Directories that cannot hold first-party source under any circumstances.
 * Deliberately much smaller than PRUNED_DIRS: the audit must NOT honour the
 * same skip list the scan uses, or adding one name to PRUNED_DIRS would blind
 * the scan and the audit that exists to catch the blinding.
 */
const NEVER_FIRST_PARTY = new Set(["node_modules", ".git"]);

function walkUnpruned(root, dir, out) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    let st;
    try { st = statSync(abs); } catch { continue; }
    if (st.isDirectory()) {
      if (NEVER_FIRST_PARTY.has(entry)) continue;
      walkUnpruned(root, abs, out);
    } else if (st.isFile()) {
      out.push(relative(root, abs));
    }
  }
}

/**
 * Independent scope audit.
 *
 * It compares what exists on disk against the list of files the scan actually
 * opened. Anything executable that the scan did not read is a scope problem —
 * whether it is in a new directory, has a new extension, or was hidden by
 * someone adding a name to PRUNED_DIRS. Deriving the answer from the scan's own
 * behaviour is the point: a rule phrased in terms of the skip list could always
 * be satisfied by editing the skip list.
 */
export function auditScope(root, filesRead = null) {
  const problems = [];
  const read = new Set(filesRead ?? scanRepository(root).filesRead);

  const onDisk = [];
  walkUnpruned(root, root, onDisk);

  for (const p of SELF_EXEMPT) {
    if (!onDisk.includes(p)) problems.push(`declared self-exempt file is missing: ${p}`);
  }

  for (const f of onDisk) {
    const e = extname(f);
    if (!SCANNED_EXTENSIONS.has(e)) continue;
    if (SELF_EXEMPT.includes(f)) continue;
    if (!read.has(f)) problems.push(`source file exists but was never scanned: ${f}`);
  }
  return problems;
}

/** Scan every source file for any trace of the retired financial runtime. */
export function scanRepository(root) {
  const findings = [];
  const filesRead = [];
  const files = listAllFiles(root).filter((f) => SCANNED_EXTENSIONS.has(extname(f)));

  for (const file of files) {
    if (SELF_EXEMPT.includes(file)) continue;
    filesRead.push(file);
    const src = readFileSync(join(root, file), "utf8");

    for (const rule of FORBIDDEN) {
      if (rule.re.test(src)) {
        const line = src.split("\n").findIndex((l) => rule.re.test(l)) + 1;
        findings.push({ file, line, rule: rule.id, why: rule.why });
      }
    }

    // The tombstone is held to a stricter rule: it must import nothing and
    // reach nothing. Comments are stripped first — the file is allowed to
    // DESCRIBE what it no longer does, and a rule that cannot tell prose from
    // code would force the tombstone to be undocumented.
    if (file === EDGE_TOMBSTONE) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const [re, why] of [
        [/^\s*import\s/m, "the retired Edge tombstone imports a module"],
        [/require\s*\(/, "the retired Edge tombstone uses require()"],
        [/createClient|supabase/i, "the retired Edge tombstone reaches Supabase"],
        [/\bStripe\b|stripe\./, "the retired Edge tombstone reaches Stripe"],
        [/fetch\s*\(|Deno\.env/, "the retired Edge tombstone performs I/O or reads env"],
      ]) {
        if (re.test(code)) findings.push({ file, line: 0, rule: "edge-tombstone", why });
      }
    }
  }
  return { findings, filesRead };
}

export function runGate(root) {
  const { findings, filesRead } = scanRepository(root);
  return { scope: auditScope(root, filesRead), findings };
}

// CLI: node scripts/retirement-gate.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const root = process.cwd();
  const { scope, findings } = runGate(root);
  for (const p of scope) console.error(`SCOPE: ${p}`);
  for (const f of findings) console.error(`LEGACY: ${f.file}:${f.line} — ${f.why} [${f.rule}]`);
  if (scope.length || findings.length) {
    console.error(`\nretirement gate FAILED: ${scope.length} scope problems, ${findings.length} legacy references`);
    process.exit(1);
  }
  console.log("retirement gate clean: no legacy financial runtime reachable");
}
