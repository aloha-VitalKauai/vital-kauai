// lib/experimental/observation/verify.ts
//
// Dependency-free invariant, behavior, and immutability checks for the
// Experimental Observation Layer. Pulls in zero third-party dependencies.
//
// Two ways to use it:
//   1. Import `verifyObservations()` — a pure function returning structured
//      results with no side effects, so it is unit-testable.
//   2. Run it as the entry point — it prints results and exits non-zero on any
//      failure. The module uses the repo's idiomatic extensionless imports, so
//      it runs via a throwaway transpile (mirroring the other lab modules):
//
//        npx tsc lib/experimental/observation/*.ts \
//          --outDir node_modules/.cache/observation-verify \
//          --module commonjs --moduleResolution node --target es2019 \
//          --esModuleInterop --skipLibCheck \
//          && node node_modules/.cache/observation-verify/verify.js
//
//      (If `tsx` is installed, `tsx lib/experimental/observation/verify.ts` works too.)

import {
  ALL_CAPABILITIES,
  EXPERIMENTAL_SCOPES,
  OBJECT_CATEGORIES,
  OBSERVATIONS,
  PRODUCTION_SCOPES,
} from "./data";
import {
  getObservation,
  hasCapability,
  listCapabilities,
  listObservations,
} from "./index";
import type { Capability, ObservationReport } from "./types";

export type VerifyCheck = { name: string; ok: boolean; detail?: string };
export type VerifyResult = {
  ok: boolean;
  passed: number;
  failed: number;
  checks: VerifyCheck[];
};

/** Return the first non-null message produced by `probe`, or null. */
function firstFailure<T>(items: readonly T[], probe: (item: T) => string | null) {
  for (const item of items) {
    const message = probe(item);
    if (message) return message;
  }
  return null;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((value) => setB.has(value));
}

/**
 * Verify the observation layer. Data-shape invariants are checked against
 * `reports` (defaulting to the live set); behavior and immutability are checked
 * against the live public API. Pure — returns results and prints nothing.
 */
export function verifyObservations(
  reports: ObservationReport[] = listObservations(),
): VerifyResult {
  const checks: VerifyCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) =>
    checks.push({ name, ok, detail });

  // --- invariants: data shape -----------------------------------------------
  const names = reports.map((r) => r.object_name);
  add("object_name values are unique", new Set(names).size === names.length);

  add(
    "object_name, object_location, notes are non-empty",
    firstFailure(reports, (r) =>
      r.object_name.trim() && r.object_location.trim() && r.notes.trim()
        ? null
        : `${r.object_name || "(unnamed)"} has an empty field`,
    ) === null,
  );

  add(
    "object_category, production_scope, experimental_scope are valid",
    firstFailure(reports, (r) => {
      if (!OBJECT_CATEGORIES.includes(r.object_category)) {
        return `${r.object_name}: object_category ${r.object_category}`;
      }
      if (!PRODUCTION_SCOPES.includes(r.production_scope)) {
        return `${r.object_name}: production_scope ${r.production_scope}`;
      }
      if (!EXPERIMENTAL_SCOPES.includes(r.experimental_scope)) {
        return `${r.object_name}: experimental_scope ${r.experimental_scope}`;
      }
      return null;
    }) === null,
  );

  add(
    "current_capabilities is a subset of ALL_CAPABILITIES with no duplicates",
    firstFailure(reports, (r) => {
      const current = r.current_capabilities;
      if (new Set(current).size !== current.length) {
        return `${r.object_name}: duplicate capability`;
      }
      const stray = current.find((c) => !ALL_CAPABILITIES.includes(c));
      return stray ? `${r.object_name}: unknown capability ${stray}` : null;
    }) === null,
  );

  add(
    "absent_capabilities is exactly the complement of current_capabilities",
    firstFailure(reports, (r) => {
      const currentSet = new Set<Capability>(r.current_capabilities);
      const expected = ALL_CAPABILITIES.filter((c) => !currentSet.has(c));
      const absent = r.absent_capabilities;
      if (new Set(absent).size !== absent.length) {
        return `${r.object_name}: duplicate in absent_capabilities`;
      }
      if (absent.some((c) => currentSet.has(c))) {
        return `${r.object_name}: absent overlaps current`;
      }
      if (!sameSet(absent, expected)) {
        return `${r.object_name}: absent is not the exact complement`;
      }
      return null;
    }) === null,
  );

  add(
    "attributes contains all four booleans",
    firstFailure(reports, (r) => {
      const a = r.attributes;
      return typeof a.mutable === "boolean" &&
        typeof a.member_visible === "boolean" &&
        typeof a.operational === "boolean" &&
        typeof a.experimental === "boolean"
        ? null
        : `${r.object_name}: attributes incomplete`;
    }) === null,
  );

  // --- behavior: public API -------------------------------------------------
  const all = listObservations();
  add(
    "listObservations returns all seeded observations",
    all.length === OBSERVATIONS.length &&
      OBSERVATIONS.every((seed) =>
        all.some((o) => o.object_name === seed.object_name),
      ),
    `${all.length} of ${OBSERVATIONS.length}`,
  );

  add(
    "getObservation returns the seed for a known name",
    getObservation("CRM Note")?.object_name === "CRM Note",
  );
  add(
    "getObservation returns undefined for an unknown name",
    getObservation("nope") === undefined,
  );

  add(
    "hasCapability reflects present, absent, and unknown",
    hasCapability("CRM Note", "content") === true &&
      hasCapability("CRM Note", "provenance") === false &&
      hasCapability("nope", "content") === false,
  );

  const crmCaps = listCapabilities("CRM Note");
  const seedCaps =
    OBSERVATIONS.find((o) => o.object_name === "CRM Note")
      ?.current_capabilities ?? [];
  add(
    "listCapabilities returns current_capabilities, or [] for unknown",
    sameSet(crmCaps, seedCaps) &&
      crmCaps.length === seedCaps.length &&
      listCapabilities("nope").length === 0,
  );

  // --- immutability ---------------------------------------------------------
  const sample = getObservation("CRM Note");
  let frozenOk = false;
  let mutationRejected = false;
  let rejectedCount = 0;
  if (sample) {
    frozenOk =
      Object.isFrozen(sample) &&
      Object.isFrozen(sample.attributes) &&
      Object.isFrozen(sample.current_capabilities) &&
      Object.isFrozen(sample.absent_capabilities);
    const beforeName = sample.object_name;
    const beforeLen = sample.current_capabilities.length;
    const tryMutate = (fn: () => void) => {
      try {
        fn();
      } catch {
        rejectedCount += 1;
      }
    };
    tryMutate(() => {
      (sample as unknown as { object_name: string }).object_name = "__x__";
    });
    tryMutate(() => {
      (sample.current_capabilities as Capability[]).push("identity");
    });
    tryMutate(() => {
      (sample.attributes as unknown as { mutable: boolean }).mutable = false;
    });
    mutationRejected =
      rejectedCount === 3 &&
      sample.object_name === beforeName &&
      sample.current_capabilities.length === beforeLen &&
      sample.attributes.mutable === true;
  }
  add("returned reports are deeply frozen and reject mutation", frozenOk && mutationRejected);

  const snapshot = JSON.stringify(listObservations());
  const seedDeepFrozen =
    Object.isFrozen(OBSERVATIONS) &&
    OBSERVATIONS.every(
      (o) =>
        Object.isFrozen(o) &&
        Object.isFrozen(o.attributes) &&
        Object.isFrozen(o.current_capabilities) &&
        Object.isFrozen(o.absent_capabilities),
    );
  add(
    "the observation set cannot be mutated through the public API",
    JSON.stringify(listObservations()) === snapshot && seedDeepFrozen,
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
  const result = verifyObservations();
  for (const c of result.checks) {
    const mark = c.ok ? "  ✓" : "  ✗";
    const detail = !c.ok && c.detail ? ` — ${c.detail}` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  console.log(`\n${result.passed} passed, ${result.failed} failed.`);
  if (!result.ok) process.exit(1);
}
