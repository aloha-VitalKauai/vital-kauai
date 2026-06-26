// lib/experimental/registry/verify.ts
//
// Dependency-free invariant + behavior checks for the Experimental Pilot
// Registry. Pulls in zero third-party dependencies.
//
// Two ways to use it:
//   1. Import `verifyRegistry()` — a pure function returning structured results
//      with no side effects, so it is unit-testable.
//   2. Run it as the entry point — it prints results and exits non-zero on any
//      failure. The module uses the repo's idiomatic extensionless imports, so
//      it runs via a throwaway transpile (mirroring lib/experimental/provenance):
//
//        npx tsc lib/experimental/registry/*.ts \
//          --outDir node_modules/.cache/registry-verify \
//          --module commonjs --moduleResolution node --target es2019 \
//          --esModuleInterop --skipLibCheck \
//          && node node_modules/.cache/registry-verify/verify.js
//
//      (If `tsx` is installed, `tsx lib/experimental/registry/verify.ts` also works.)

import {
  EXPERIMENT_DECISIONS,
  EXPERIMENT_STATUSES,
  PRODUCTION_IMPACTS,
  REGISTRY,
  TERMINAL_STATUSES,
} from "./data";
import {
  getExperimentById,
  getExperiments,
  isProductionSafeExperiment,
  listActiveExperiments,
  listCompletedExperiments,
} from "./index";
import type {
  ExperimentDecision,
  ExperimentalPilot,
  ExperimentStatus,
  ProductionImpact,
} from "./types";

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

const ID_CONVENTION = /^experiment-\d{3,}$/;

/**
 * The legal-pairing rules between status (lifecycle) and decision (verdict).
 * Returns a reason string when the pairing is illegal, otherwise null.
 */
function pairingViolation(
  status: ExperimentStatus,
  decision: ExperimentDecision,
): string | null {
  if (TERMINAL_STATUSES.includes(status) && decision === "undecided") {
    return `terminal status '${status}' may not be 'undecided'`;
  }
  if (status === "promoted" && decision !== "promote") {
    return `status 'promoted' requires decision 'promote', got '${decision}'`;
  }
  if (status === "rejected" && decision !== "delete" && decision !== "revise") {
    return `status 'rejected' requires decision 'delete' or 'revise', got '${decision}'`;
  }
  return null;
}

/** Return the first non-null message produced by `probe`, or null. */
function firstFailure<T>(items: readonly T[], probe: (item: T) => string | null) {
  for (const item of items) {
    const message = probe(item);
    if (message) return message;
  }
  return null;
}

/** A minimal, valid pilot used to exercise impact classification. */
function sampleWithImpact(impact: ProductionImpact): ExperimentalPilot {
  return {
    id: "experiment-000",
    name: "impact sample",
    status: "draft",
    production_impact: impact,
    hypothesis: "sample",
    safety_boundary: "sample",
    removability: "sample",
    success_criteria: [],
    future_unlocks: [],
    decision: "undecided",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Verify the registry. Data-shape invariants are checked against `records`
 * (defaulting to the live registry); public-API behavior is checked against the
 * live module surface. Pure — returns results and prints nothing.
 */
export function verifyRegistry(
  records: ExperimentalPilot[] = getExperiments(),
): VerifyResult {
  const checks: VerifyCheck[] = [];
  const add = (name: string, ok: boolean, detail?: string) =>
    checks.push({ name, ok, detail });

  // --- invariants: data shape -----------------------------------------------
  const ids = records.map((r) => r.id);
  add("all experiment ids are unique", new Set(ids).size === ids.length);

  add(
    "ids match the experiment-NNN convention",
    firstFailure(records, (r) =>
      ID_CONVENTION.test(r.id) ? null : `bad id "${r.id}"`,
    ) === null,
  );

  add(
    "hypothesis, safety_boundary, removability are non-empty",
    firstFailure(records, (r) =>
      r.hypothesis.trim() && r.safety_boundary.trim() && r.removability.trim()
        ? null
        : `${r.id} has an empty narrative field`,
    ) === null,
  );

  add(
    "status is a declared value",
    firstFailure(records, (r) =>
      EXPERIMENT_STATUSES.includes(r.status) ? null : `${r.id}: ${r.status}`,
    ) === null,
  );

  add(
    "production_impact is a declared value (never blank)",
    firstFailure(records, (r) =>
      PRODUCTION_IMPACTS.includes(r.production_impact)
        ? null
        : `${r.id}: ${String(r.production_impact)}`,
    ) === null,
  );

  add(
    "decision is a declared value",
    firstFailure(records, (r) =>
      EXPERIMENT_DECISIONS.includes(r.decision) ? null : `${r.id}: ${r.decision}`,
    ) === null,
  );

  const timestampFail = firstFailure(records, (r) => {
    if (!isIso8601(r.created_at)) return `${r.id}: created_at not ISO-8601`;
    if (!isIso8601(r.updated_at)) return `${r.id}: updated_at not ISO-8601`;
    if (Date.parse(r.updated_at) < Date.parse(r.created_at)) {
      return `${r.id}: updated_at precedes created_at`;
    }
    return null;
  });
  add(
    "timestamps are ISO-8601 and updated_at >= created_at",
    timestampFail === null,
    timestampFail ?? undefined,
  );

  const pairingFail = firstFailure(records, (r) => {
    const reason = pairingViolation(r.status, r.decision);
    return reason ? `${r.id}: ${reason}` : null;
  });
  add(
    "status/decision pairings are legal",
    pairingFail === null,
    pairingFail ?? undefined,
  );

  // --- behavior: public API -------------------------------------------------
  const all = getExperiments();
  add(
    "getExperiments returns all seeded records",
    all.length === REGISTRY.length &&
      REGISTRY.every((seed) => all.some((e) => e.id === seed.id)),
    `${all.length} of ${REGISTRY.length}`,
  );

  // Mutating the returned value must not change registry state.
  const snapshot = JSON.stringify(getExperiments());
  for (const p of getExperiments()) {
    p.name = "__caller_mutation__";
    p.status = "rejected";
    p.success_criteria.push("__injected__");
  }
  const seedDeepFrozen =
    Object.isFrozen(REGISTRY) &&
    REGISTRY.every(
      (r) =>
        Object.isFrozen(r) &&
        Object.isFrozen(r.success_criteria) &&
        Object.isFrozen(r.future_unlocks),
    );
  add(
    "registry state cannot be mutated through the public API",
    JSON.stringify(getExperiments()) === snapshot && seedDeepFrozen,
  );

  add(
    "getExperimentById returns the provenance record",
    getExperimentById("experiment-001")?.id === "experiment-001",
  );
  add(
    "getExperimentById returns undefined for an unknown id",
    getExperimentById("experiment-404") === undefined,
  );

  const active = listActiveExperiments();
  add(
    "listActiveExperiments filters to active",
    active.every((e) => e.status === "active") &&
      active.length === REGISTRY.filter((r) => r.status === "active").length,
  );

  const completed = listCompletedExperiments();
  add(
    "listCompletedExperiments filters to completed",
    completed.every((e) => e.status === "completed") &&
      completed.length ===
        REGISTRY.filter((r) => r.status === "completed").length,
  );

  const expectedSafe: Record<ProductionImpact, boolean> = {
    none: true,
    read_only: true,
    internal_only: true,
    production_candidate: false,
    production: false,
  };
  const safeFail = firstFailure([...PRODUCTION_IMPACTS], (impact) => {
    const got = isProductionSafeExperiment(sampleWithImpact(impact));
    return got === expectedSafe[impact]
      ? null
      : `impact "${impact}" → ${got}, expected ${expectedSafe[impact]}`;
  });
  add(
    "isProductionSafeExperiment classifies all five impacts correctly",
    safeFail === null,
    safeFail ?? undefined,
  );

  const failed = checks.filter((c) => !c.ok).length;
  return { ok: failed === 0, passed: checks.length - failed, failed, checks };
}

// --- entry point -------------------------------------------------------------
// Runs only when this file is executed directly (e.g. via the transpile above),
// never on import. Prints a report and exits non-zero on any failure.
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  const result = verifyRegistry();
  for (const c of result.checks) {
    const mark = c.ok ? "  ✓" : "  ✗";
    const detail = !c.ok && c.detail ? ` — ${c.detail}` : "";
    console.log(`${mark} ${c.name}${detail}`);
  }
  console.log(`\n${result.passed} passed, ${result.failed} failed.`);
  if (!result.ok) process.exit(1);
}
