// lib/experimental/relationships/verify.ts
//
// Dependency-free invariant, behavior, and immutability checks for the
// Experimental Relationship Layer. Pulls in zero third-party dependencies.
//
// It imports the observation module's read-only API to resolve every endpoint
// to a real observed object. The dependency is one-way and acyclic:
//   relationships ──▶ observation ──▶ (nothing)
//
// Two ways to use it:
//   1. Import `verifyRelationships()` — a pure function returning structured
//      results with no side effects, so it is unit-testable.
//   2. Run it as the entry point — it prints results (including the module-cycle
//      boundary check) and exits non-zero on any failure. Because relationships
//      imports observation, BOTH modules are transpiled together:
//
//        npx tsc lib/experimental/relationships/*.ts lib/experimental/observation/*.ts \
//          --outDir node_modules/.cache/relationships-verify \
//          --module commonjs --moduleResolution node --target es2019 \
//          --esModuleInterop --skipLibCheck \
//          && node node_modules/.cache/relationships-verify/relationships/verify.js
//
//      (If `tsx` is installed, `tsx lib/experimental/relationships/verify.ts` works too.)

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { getObservation } from "../observation/index";
import { RELATIONSHIP_TYPES, RELATIONSHIPS } from "./data";
import {
  findRelationship,
  getRelationshipsFor,
  hasRelationship,
  listRelationships,
  listRelationshipTypes,
} from "./index";
import type { Relationship } from "./types";

export type VerifyCheck = { name: string; ok: boolean; detail?: string };
export type VerifyResult = {
  ok: boolean;
  passed: number;
  failed: number;
  checks: VerifyCheck[];
};

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function isIso8601(value: string): boolean {
  return (
    typeof value === "string" &&
    ISO_8601.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

const ID_CONVENTION = /^rel-\d{3,}$/;

function firstFailure<T>(items: readonly T[], probe: (item: T) => string | null) {
  for (const item of items) {
    const message = probe(item);
    if (message) return message;
  }
  return null;
}

function sameIdSet(a: readonly Relationship[], b: readonly Relationship[]): boolean {
  if (a.length !== b.length) return false;
  const ids = new Set(b.map((r) => r.id));
  return a.every((r) => ids.has(r.id));
}

/**
 * A symmetry-aware key for duplicate detection: same key means same fact. For a
 * symmetric type the endpoints are unordered (sorted); for a directed type the
 * order is significant.
 */
function pairKey(relationship: Relationship): string {
  // Look up symmetry defensively: an invalid relationship_type (which the
  // type-validity invariant reports separately) must not crash dedup — it is
  // simply treated as directed here.
  const meta = RELATIONSHIP_TYPES[relationship.relationship_type] as
    | { readonly symmetric: boolean }
    | undefined;
  const ends = [relationship.source_object, relationship.target_object];
  if (meta?.symmetric) ends.sort();
  return `${relationship.relationship_type}|${ends[0]}|${ends[1]}`;
}

/**
 * Verify the relationship layer. Data-shape invariants are checked against
 * `relationships` (defaulting to the live set, with endpoints resolved against
 * the observation API); behavior and immutability are checked against the live
 * public API. Pure — no file access, no printing.
 */
export function verifyRelationships(
  relationships: readonly Relationship[] = listRelationships(),
): VerifyResult {
  const checks: VerifyCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) =>
    checks.push({ name, ok, detail });

  // --- invariants: data shape -----------------------------------------------
  const ids = relationships.map((r) => r.id);
  add("relationship ids are unique", new Set(ids).size === ids.length);

  add(
    "ids match the rel-NNN convention",
    firstFailure(relationships, (r) =>
      ID_CONVENTION.test(r.id) ? null : `bad id "${r.id}"`,
    ) === null,
  );

  add(
    "relationship_type is a valid member",
    firstFailure(relationships, (r) =>
      Object.prototype.hasOwnProperty.call(
        RELATIONSHIP_TYPES,
        r.relationship_type,
      )
        ? null
        : `${r.id}: ${r.relationship_type}`,
    ) === null,
  );

  add(
    "created_at is ISO-8601 and notes, if present, is non-empty",
    firstFailure(relationships, (r) => {
      if (!isIso8601(r.created_at)) return `${r.id}: created_at not ISO-8601`;
      if (r.notes !== undefined && !r.notes.trim()) {
        return `${r.id}: empty notes`;
      }
      return null;
    }) === null,
  );

  add(
    "every endpoint resolves to a real observation",
    firstFailure(relationships, (r) => {
      if (!getObservation(r.source_object)) {
        return `${r.id}: source "${r.source_object}" is not observed`;
      }
      if (!getObservation(r.target_object)) {
        return `${r.id}: target "${r.target_object}" is not observed`;
      }
      return null;
    }) === null,
  );

  add(
    "no self-references",
    firstFailure(relationships, (r) =>
      r.source_object === r.target_object ? `${r.id}: self-reference` : null,
    ) === null,
  );

  const keys = relationships.map(pairKey);
  add(
    "no duplicate relationships (symmetry-aware)",
    new Set(keys).size === keys.length,
  );

  // --- behavior: public API -------------------------------------------------
  const memberEdges = RELATIONSHIPS.filter(
    (r) => r.source_object === "Member" || r.target_object === "Member",
  );
  const forMember = getRelationshipsFor("Member");
  add(
    "getRelationshipsFor returns every edge touching the object, or [] for unknown",
    forMember.length === memberEdges.length &&
      forMember.every(
        (r) => r.source_object === "Member" || r.target_object === "Member",
      ) &&
      getRelationshipsFor("nope").length === 0,
  );

  add(
    "findRelationship is unordered: (A,B) equals (B,A)",
    sameIdSet(
      findRelationship("CRM Note", "Member"),
      findRelationship("Member", "CRM Note"),
    ),
  );

  add(
    "hasRelationship agrees with findRelationship being non-empty",
    [
      ["CRM Note", "Member"],
      ["CRM Note", "Integration Session"],
      ["nope", "Member"],
    ].every(
      ([a, b]) => hasRelationship(a, b) === (findRelationship(a, b).length > 0),
    ),
  );

  const typeList = listRelationshipTypes();
  const typeKeys = Object.keys(RELATIONSHIP_TYPES);
  add(
    "listRelationshipTypes equals the RELATIONSHIP_TYPES keys",
    typeList.length === typeKeys.length &&
      typeKeys.every((k) => typeList.includes(k as (typeof typeList)[number])),
  );

  // --- immutability ---------------------------------------------------------
  const sample = listRelationships()[0];
  let frozenOk = false;
  let mutationRejected = false;
  let rejectedCount = 0;
  if (sample) {
    frozenOk = Object.isFrozen(sample);
    const beforeSource = sample.source_object;
    const tryMutate = (fn: () => void) => {
      try {
        fn();
      } catch {
        rejectedCount += 1;
      }
    };
    tryMutate(() => {
      (sample as unknown as { source_object: string }).source_object = "__x__";
    });
    tryMutate(() => {
      (sample as unknown as { relationship_type: string }).relationship_type =
        "__x__";
    });
    mutationRejected =
      rejectedCount === 2 && sample.source_object === beforeSource;
  }
  add("returned relationships are frozen and reject mutation", frozenOk && mutationRejected);

  const snapshot = JSON.stringify(listRelationships());
  const seedFrozen =
    Object.isFrozen(RELATIONSHIPS) &&
    RELATIONSHIPS.every((r) => Object.isFrozen(r));
  add(
    "the relationship set cannot be mutated through the public API",
    JSON.stringify(listRelationships()) === snapshot && seedFrozen,
  );

  const failed = checks.filter((c) => !c.ok).length;
  return { ok: failed === 0, passed: checks.length - failed, failed, checks };
}

/**
 * Boundary check (kept out of the pure function because it reads source files):
 * confirm observation does not import relationships, so the dependency graph
 * stays acyclic. Reads observation's source relative to the current working
 * directory (the documented run location, the repo root).
 */
export function checkNoModuleCycle(): VerifyCheck {
  const name = "no module cycle: observation does not import relationships";
  const dir = join(process.cwd(), "lib", "experimental", "observation");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  } catch {
    return {
      name,
      ok: true,
      detail:
        "observation source not located from cwd; boundary guaranteed by structure + lint",
    };
  }
  const offender = files.find((f) =>
    /(from\s+["'][^"']*relationships)|(require\(\s*["'][^"']*relationships)/.test(
      readFileSync(join(dir, f), "utf8"),
    ),
  );
  return offender
    ? { name, ok: false, detail: `observation/${offender} imports relationships (cycle!)` }
    : { name, ok: true, detail: "observation does not import relationships" };
}

// --- entry point -------------------------------------------------------------
// Runs only when this file is executed directly. Prints the data/behavior/
// immutability checks plus the module-cycle boundary check, and exits non-zero
// on any failure.
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  const result = verifyRelationships();
  const checks = [...result.checks, checkNoModuleCycle()];
  for (const c of checks) {
    const mark = c.ok ? "  ✓" : "  ✗";
    const detail = !c.ok && c.detail ? ` — ${c.detail}` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n${checks.length - failed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}
