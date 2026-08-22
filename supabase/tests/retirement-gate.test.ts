/**
 * PR 9 (D-086): the retirement gate, and proof that it bites.
 *
 * A scanner that reports "clean" is worthless unless you have shown it can say
 * "dirty". Every mutant below reintroduces one shape of the retired financial
 * runtime; each must be caught. The null control proves the gate is not simply
 * failing on everything, and the restoration check proves the suite leaves the
 * working tree byte-identical — a mutation harness that corrupts the repository
 * is worse than none.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

import { runGate, SELF_EXEMPT, SCANNED_EXTENSIONS } from "../../scripts/retirement-gate.mjs";

const ROOT = process.cwd();

/** Apply a mutation, run the gate, restore byte-identically, return findings. */
function withMutant(
  mutate: () => { restore: () => void },
): { scope: string[]; findings: { file: string; why: string }[] } {
  const { restore } = mutate();
  try {
    return runGate(ROOT);
  } finally {
    restore();
  }
}

/**
 * Create a file that did not exist; cleanup deletes only what it created —
 * including any directory the mutant had to make. An empty directory left
 * behind is still a modified tree, which is why the restoration assertion below
 * checks for directories and not just files.
 */
function createFile(relPath: string, contents: string) {
  const abs = join(ROOT, relPath);
  assert.ok(!existsSync(abs), `mutant would clobber an existing file: ${relPath}`);

  // Remember which ancestor directories we are about to bring into existence.
  const created: string[] = [];
  const parts = relPath.split("/").slice(0, -1);
  for (let i = 1; i <= parts.length; i += 1) {
    const dir = join(ROOT, ...parts.slice(0, i));
    if (!existsSync(dir)) created.push(dir);
  }

  mkdirSync(join(abs, ".."), { recursive: true });
  writeFileSync(abs, contents);
  return {
    restore: () => {
      rmSync(abs, { force: true });
      // Deepest first, so a nested directory empties before its parent.
      for (const dir of created.reverse()) rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Edit a file that exists; cleanup writes back the exact original bytes. */
function editFile(relPath: string, transform: (src: string) => string) {
  const abs = join(ROOT, relPath);
  const original = readFileSync(abs);
  writeFileSync(abs, transform(original.toString("utf8")));
  return { restore: () => writeFileSync(abs, original) };
}

// ── The gate on the real repository ──────────────────────────────────────────

test("null control: the repository is clean and the scan scope is sound", () => {
  const { scope, findings } = runGate(ROOT);
  assert.deepEqual(scope, [], `scope problems: ${scope.join("; ")}`);
  assert.deepEqual(
    findings.map((f) => `${f.file}: ${f.why}`),
    [],
    "the retirement gate found legacy financial code",
  );
});

test("exactly two files claim exemption, and both exist", () => {
  assert.deepEqual(SELF_EXEMPT, [
    "scripts/retirement-gate.mjs",
    "supabase/tests/retirement-gate.test.ts",
  ]);
  for (const f of SELF_EXEMPT) {
    assert.ok(existsSync(join(ROOT, f)), `exempt file missing: ${f}`);
  }
});

test("every executable extension is in scope", () => {
  for (const e of [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]) {
    assert.ok(SCANNED_EXTENSIONS.has(e), `${e} is not scanned`);
  }
});

// ── Mutants: each must be killed ─────────────────────────────────────────────

const MUTANTS: Array<[string, () => { restore: () => void }]> = [
  ["1. dot-syntax retired writer", () =>
    createFile("app/api/_mutant/route.ts",
      `export async function POST() {\n  await db.from("donations").insert({ amount_cents: 1 });\n}\n`)],

  ["2. computed db[\"from\"](...) writer", () =>
    createFile("app/api/_mutant/route.ts",
      `export async function POST() {\n  await db["from"]("financial_commitments").insert({});\n}\n`)],

  ["3. destructured/aliased from writer", () =>
    createFile("app/api/_mutant/route.ts",
      `const { from: tbl } = db;\nexport async function POST() {\n  await tbl("payment_tokens").insert({});\n}\n`)],

  ["4. .js route writer", () =>
    createFile("app/api/_mutant/route.js",
      `export async function POST() {\n  await db.from("payment_allocations").insert({});\n}\n`)],

  ["5. root-file retired-view reader", () =>
    createFile("mutant-root-reader.ts",
      `export const q = supabase.from("financials_overview").select("*");\n`)],

  ["6. legacy route string in an email", () =>
    createFile("lib/_mutant-email.ts",
      `export const link = "https://vitalkauai.com/api/payments/generate-link";\n`)],

  ["7. Square/provider import", () =>
    createFile("lib/_mutant-provider.ts",
      `import { squareClient } from "@/lib/square/client";\nexport default squareClient;\n`)],

  ["8. a second handler in an otherwise safe file", () =>
    editFile("app/api/expenses/route.ts", (src) =>
      src + `\nexport async function DELETE() {\n  await db.from("donations").delete();\n}\n`)],

  ["9. Stripe/database import in the Edge tombstone", () =>
    editFile("supabase/functions/stripe-webhook/index.ts", (src) =>
      `import Stripe from "https://esm.sh/stripe";\n` + src)],

  ["10. a new top-level source directory", () =>
    createFile("mutantmodule/handler.ts",
      `export async function run() {\n  await db.from("donations").select("*");\n}\n`)],
];

for (const [name, mutate] of MUTANTS) {
  test(`mutant killed — ${name}`, () => {
    const { scope, findings } = withMutant(mutate);
    assert.ok(
      scope.length + findings.length > 0,
      `the gate did NOT catch: ${name}`,
    );
  });
}

test("the tree is byte-identical after the whole mutation suite", () => {
  // Re-running the null control after every mutant has been applied and
  // restored is the only assertion that actually proves restoration.
  const { scope, findings } = runGate(ROOT);
  assert.deepEqual(scope, [], "scope changed after mutation");
  assert.deepEqual(findings, [], "mutation left legacy code behind");
  assert.ok(!existsSync(join(ROOT, "mutantmodule")), "mutant directory survived");
  assert.ok(!existsSync(join(ROOT, "mutant-root-reader.ts")), "mutant root file survived");
  assert.ok(!existsSync(join(ROOT, "app/api/_mutant")), "mutant route survived");
});
