#!/usr/bin/env node
/**
 * Remove every retired financial object from the generated Supabase types.
 *
 * `supabase gen types` emits one entry per table in the schema, including the
 * ones Financials V2 retired. Leaving them in would (a) trip the retirement
 * gate, which forbids the vocabulary anywhere outside its own two files, and
 * (b) leave `Tables<'…'>` available for a retired table, so a future writer
 * would get a clean compile and be caught only by a grep.
 *
 * Stripping them makes the retirement structural: a retired table is not a
 * lint finding, it is a type error. The gate stays the backstop for raw SQL
 * and string-built queries, which types cannot see.
 *
 * Runs as the second half of `npm run db:types`. Idempotent.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { RETIRED_TABLES, RETIRED_VIEWS } from "./retirement-gate.mjs";

const TARGET = process.argv[2] ?? "lib/database.types.ts";
const RETIRED = new Set([...RETIRED_TABLES, ...RETIRED_VIEWS]);

const lines = readFileSync(TARGET, "utf8").split("\n");
const drop = new Array(lines.length).fill(false);

/** Mark `[start, end]` where end is the line closing the block opened at start. */
function markBlock(start) {
  const indent = lines[start].match(/^\s*/)[0].length;
  for (let i = start; i < lines.length; i++) {
    drop[i] = true;
    // The block closes at the first line back at the opening indent that
    // starts with `}` — generated output is uniformly indented, so this is
    // unambiguous without a full brace parse.
    if (i > start) {
      const m = lines[i].match(/^(\s*)\}/);
      if (m && m[1].length === indent) return;
    }
  }
  throw new Error(`unterminated block opened at line ${start + 1}`);
}

// 1. Whole table/view entries: `      <name>: {`
const removedEntries = [];
for (let i = 0; i < lines.length; i++) {
  if (drop[i]) continue;
  const m = lines[i].match(/^\s*([a-z0-9_]+): \{$/);
  if (m && RETIRED.has(m[1])) {
    markBlock(i);
    removedEntries.push(m[1]);
  }
}

// 2. Relationship objects on surviving tables that point at a retired one.
let removedRels = 0;
for (let i = 0; i < lines.length; i++) {
  if (drop[i]) continue;
  const m = lines[i].match(/^\s*referencedRelation: "([a-z0-9_]+)"$/);
  if (!m || !RETIRED.has(m[1])) continue;
  // Walk back to the `{` that opens this relationship object, then mark it.
  let open = i;
  while (open >= 0 && !/^\s*\{$/.test(lines[open])) open--;
  if (open < 0) throw new Error(`orphan referencedRelation at line ${i + 1}`);
  markBlock(open);
  removedRels++;
}

const out = lines.filter((_, i) => !drop[i]).join("\n");

// Fail loudly rather than emit a file that still carries the vocabulary.
const leaked = [...RETIRED].filter((n) => new RegExp(`\\b${n}\\b`).test(out));
if (leaked.length) {
  console.error(`strip-retired-types: ${leaked.length} name(s) survived stripping.`);
  process.exit(1);
}

writeFileSync(TARGET, out);
console.log(
  `strip-retired-types: removed ${removedEntries.length} entries, ` +
    `${removedRels} relationships (${lines.length - out.split("\n").length} lines).`,
);
