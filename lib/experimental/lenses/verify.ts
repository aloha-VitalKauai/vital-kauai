// lib/experimental/lenses/verify.ts
//
// Dependency-free invariant, shape, behavior, and immutability checks for the
// Experimental Lens Framework. Pulls in zero third-party dependencies.
//
// The shape check is the boundary enforcer: every lens must carry EXACTLY the
// allowed keys, so a future truth / score / authority / diagnosis field cannot
// slip in unnoticed.
//
// Two ways to use it:
//   1. Import `verifyLenses()` — a pure function returning structured results
//      with no side effects, so it is unit-testable.
//   2. Run it as the entry point — it prints results and exits non-zero on any
//      failure. The module uses the repo's idiomatic extensionless imports, so
//      it runs via a throwaway transpile (mirroring the other lab modules):
//
//        npx tsc lib/experimental/lenses/*.ts \
//          --outDir node_modules/.cache/lenses-verify \
//          --module commonjs --moduleResolution node --target es2019 \
//          --esModuleInterop --skipLibCheck \
//          && node node_modules/.cache/lenses-verify/verify.js
//
//      (If `tsx` is installed, `tsx lib/experimental/lenses/verify.ts` works too.)

import {
  LENS_CATEGORIES,
  LENS_KEYS,
  LENS_STATUSES,
  LENSES,
} from "./data";
import {
  getLens,
  getLensByName,
  listLenses,
  listLensCategories,
} from "./index";
import type { Lens } from "./types";

export type VerifyCheck = { name: string; ok: boolean; detail?: string };
export type VerifyResult = {
  ok: boolean;
  passed: number;
  failed: number;
  checks: VerifyCheck[];
};

const ID_CONVENTION = /^lens-\d{3,}$/;

function firstFailure<T>(items: readonly T[], probe: (item: T) => string | null) {
  for (const item of items) {
    const message = probe(item);
    if (message) return message;
  }
  return null;
}

// Coerce defensively: verifyLenses must return a clean result (never throw) when
// fed arbitrary data — e.g. a lens missing `name`/`description`, which the
// exact-keys shape check is meant to report rather than crash on.
const str = (value: unknown): string => (typeof value === "string" ? value : "");

const EXPECTED_KEYS = [...LENS_KEYS].sort();

/**
 * Verify the lens framework. Data-shape invariants are checked against `lenses`
 * (defaulting to the live set); behavior and immutability are checked against
 * the live public API. Pure — returns results and prints nothing.
 */
export function verifyLenses(
  lenses: readonly Lens[] = listLenses(),
): VerifyResult {
  const checks: VerifyCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) =>
    checks.push({ name, ok, detail });

  // --- invariants: data shape -----------------------------------------------
  const ids = lenses.map((l) => l.id);
  add("lens ids are unique", new Set(ids).size === ids.length);

  add(
    "ids match the lens-NNN convention",
    firstFailure(lenses, (l) =>
      ID_CONVENTION.test(l.id) ? null : `bad id "${l.id}"`,
    ) === null,
  );

  const lowerNames = lenses.map((l) => str(l.name).toLowerCase());
  add(
    "names are unique (case-insensitive)",
    new Set(lowerNames).size === lowerNames.length,
  );

  add(
    "name and description are non-empty",
    firstFailure(lenses, (l) =>
      str(l.name).trim() && str(l.description).trim()
        ? null
        : `${l.id} has an empty field`,
    ) === null,
  );

  add(
    "category and status are valid union members",
    firstFailure(lenses, (l) => {
      if (!LENS_CATEGORIES.includes(l.category)) {
        return `${l.id}: category ${l.category}`;
      }
      if (!LENS_STATUSES.includes(l.status)) {
        return `${l.id}: status ${l.status}`;
      }
      return null;
    }) === null,
  );

  add(
    "version is an integer >= 1",
    firstFailure(lenses, (l) =>
      Number.isInteger(l.version) && l.version >= 1
        ? null
        : `${l.id}: version ${l.version}`,
    ) === null,
  );

  // --- shape: the boundary enforcer -----------------------------------------
  add(
    "every lens has exactly the allowed keys (no truth/rank/score field)",
    firstFailure(lenses, (l) => {
      const keys = Object.keys(l).sort();
      const exact =
        keys.length === EXPECTED_KEYS.length &&
        keys.every((k, i) => k === EXPECTED_KEYS[i]);
      return exact ? null : `${l.id}: keys [${keys.join(", ")}]`;
    }) === null,
  );

  // --- behavior: public API -------------------------------------------------
  const all = listLenses();
  add(
    "listLenses returns all seeded lenses",
    all.length === LENSES.length &&
      LENSES.every((seed) => all.some((l) => l.id === seed.id)),
    `${all.length} of ${LENSES.length}`,
  );

  add(
    "getLens returns the seed for a known id, undefined for unknown",
    getLens("lens-001")?.name === "Western Astrology" &&
      getLens("nope") === undefined,
  );

  add(
    "getLensByName resolves case-insensitively, undefined for unknown",
    getLensByName("western astrology")?.id === "lens-001" &&
      getLensByName("WESTERN ASTROLOGY")?.id === "lens-001" &&
      getLensByName("nope") === undefined,
  );

  const cats = listLensCategories();
  add(
    "listLensCategories equals the LENS_CATEGORIES vocabulary",
    cats.length === LENS_CATEGORIES.length &&
      cats.every((c, i) => c === LENS_CATEGORIES[i]),
  );

  // --- immutability ---------------------------------------------------------
  const sample = getLens("lens-001");
  let frozenOk = false;
  let mutationRejected = false;
  let rejectedCount = 0;
  if (sample) {
    frozenOk = Object.isFrozen(sample);
    const beforeName = sample.name;
    const beforeVersion = sample.version;
    const tryMutate = (fn: () => void) => {
      try {
        fn();
      } catch {
        rejectedCount += 1;
      }
    };
    tryMutate(() => {
      (sample as unknown as { name: string }).name = "__x__";
    });
    tryMutate(() => {
      (sample as unknown as { version: number }).version = 999;
    });
    mutationRejected =
      rejectedCount === 2 &&
      sample.name === beforeName &&
      sample.version === beforeVersion;
  }
  add("returned lenses are frozen and reject mutation", frozenOk && mutationRejected);

  const snapshot = JSON.stringify(listLenses());
  const seedFrozen =
    Object.isFrozen(LENSES) && LENSES.every((l) => Object.isFrozen(l));
  add(
    "the lens set cannot be mutated through the public API",
    JSON.stringify(listLenses()) === snapshot && seedFrozen,
  );

  const failed = checks.filter((c) => !c.ok).length;
  return { ok: failed === 0, passed: checks.length - failed, failed, checks };
}

// --- entry point -------------------------------------------------------------
// Runs only when this file is executed directly, never on import. Prints a
// report and exits non-zero on any failure.
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  const result = verifyLenses();
  for (const c of result.checks) {
    const mark = c.ok ? "  ✓" : "  ✗";
    const detail = !c.ok && c.detail ? ` — ${c.detail}` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  console.log(`\n${result.passed} passed, ${result.failed} failed.`);
  if (!result.ok) process.exit(1);
}
