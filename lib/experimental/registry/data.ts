// lib/experimental/registry/data.ts
//
// The seed registry — the single source of truth for tracked experiments —
// plus the canonical runtime value sets the model declares.
//
// Registry-as-code by design: adding or changing an experiment means editing
// this file and opening a PR. There is no persistence, no database, and no
// mutation path through the public API. The seed is deeply frozen.

import type {
  ExperimentDecision,
  ExperimentalPilot,
  ExperimentStatus,
  ProductionImpact,
} from "./types";

/** Every legal {@link ExperimentStatus}, as runtime values for validation. */
export const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = Object.freeze([
  "draft",
  "active",
  "completed",
  "paused",
  "rejected",
  "promoted",
]);

/** Statuses that are terminal — the experiment has reached an end state. */
export const TERMINAL_STATUSES: readonly ExperimentStatus[] = Object.freeze([
  "completed",
  "promoted",
  "rejected",
]);

/** Every legal {@link ProductionImpact}, as runtime values for validation. */
export const PRODUCTION_IMPACTS: readonly ProductionImpact[] = Object.freeze([
  "none",
  "read_only",
  "internal_only",
  "production_candidate",
  "production",
]);

/**
 * The production-safe subset of {@link ProductionImpact}: impacts that, by
 * declaration, cannot change production behavior.
 */
export const PRODUCTION_SAFE_IMPACTS: readonly ProductionImpact[] = Object.freeze(
  ["none", "read_only", "internal_only"],
);

/** Every legal {@link ExperimentDecision}, as runtime values for validation. */
export const EXPERIMENT_DECISIONS: readonly ExperimentDecision[] = Object.freeze([
  "keep",
  "revise",
  "delete",
  "promote",
  "undecided",
]);

/**
 * Recursively freeze a value and everything it transitively owns, so neither
 * the registry array, the experiment objects, nor their nested arrays can be
 * mutated in place.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * The registry. The registry itself is infrastructure for tracking
 * experiments, not an experiment — so it is not registered as a pilot. Only
 * capabilities under test appear here.
 */
export const REGISTRY: readonly ExperimentalPilot[] = deepFreeze<ExperimentalPilot[]>([
  {
    id: "experiment-001",
    name: "Provenance Metadata Foundation",
    status: "active",
    production_impact: "internal_only",
    hypothesis:
      "Can we introduce provenance metadata as an isolated, pure TypeScript " +
      "capability without affecting production?",
    safety_boundary:
      "No production imports, no database migrations, no UI, no AI, no PHI, " +
      "no Level-4 data, no existing workflow changes.",
    removability:
      "Deleting lib/experimental/ leaves production behavior unchanged.",
    success_criteria: [
      "Provenance can be created.",
      "Provenance can be updated.",
      "Existing records can be wrapped without mutation.",
      "Production behavior remains unchanged.",
      "TypeScript passes.",
      "ESLint passes.",
      "Verification passes.",
    ],
    future_unlocks: [
      "Provenance-aware timeline",
      "Canonical record model",
      "Human Record architecture",
      "Evidence engine",
    ],
    decision: "keep",
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
  },
]);
