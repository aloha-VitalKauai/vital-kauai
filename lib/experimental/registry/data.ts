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
  {
    id: "experiment-003",
    name: "Experimental Observation Layer",
    status: "active",
    production_impact: "internal_only",
    hypothesis:
      "Can we describe existing production objects with a typed, immutable " +
      "observation model without modifying them?",
    safety_boundary:
      "No production imports, no runtime production reads, no DB/UI/API, no AI, " +
      "no PHI, no Level-4 data, no workflow changes. Observation is read-only " +
      "and static.",
    removability:
      "Deleting lib/experimental/observation/ (and its registry entry) leaves " +
      "production and the other experiments unchanged.",
    success_criteria: [
      "Observations are immutable.",
      "Absent set equals the exact complement.",
      "The four API functions behave per spec.",
      "No production imports.",
      "TypeScript passes.",
      "ESLint passes.",
      "Verification passes.",
    ],
    future_unlocks: [
      "Observation-driven object model",
      "Provenance gap analysis",
      "Timeline-participation mapping",
    ],
    decision: "keep",
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "experiment-004",
    name: "Experimental Relationship Layer",
    status: "active",
    production_impact: "internal_only",
    hypothesis:
      "Can observed objects be connected through a small typed immutable " +
      "relationship model without assumptions, production changes, or business " +
      "logic?",
    safety_boundary:
      "No production imports, no runtime production reads, no DB/UI/API, no " +
      "PHI, no Level-4 data, no inference. Depends only on the observation " +
      "module's read-only API.",
    removability:
      "Deleting lib/experimental/relationships/ (and its registry entry) leaves " +
      "production and the other experiments unchanged. Must be deleted before, " +
      "or together with, observation.",
    success_criteria: [
      "Types are closed unions.",
      "Symmetry is modeled.",
      "Every endpoint resolves to an observation.",
      "Duplicates and self-references are rejected.",
      "Outputs are immutable.",
      "The five API functions behave per spec.",
      "TypeScript passes.",
      "ESLint passes.",
      "Verification passes.",
    ],
    future_unlocks: [
      "Relationship-aware navigation",
      "Timeline ordering",
      "Contextual search",
      "Graph description",
    ],
    decision: "undecided",
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "experiment-005",
    name: "Experimental Lens Framework",
    status: "active",
    production_impact: "internal_only",
    hypothesis:
      "Can multiple interpretive frameworks be catalogued through one " +
      "interface while staying completely separate from observed reality?",
    safety_boundary:
      "Metadata only. No production imports, no calculations, no " +
      "interpretation, no diagnosis, no framework-specific logic, no DB/UI/API, " +
      "no AI, no PHI, no Level-4 data. No field may assert truth, rank, " +
      "confidence, or diagnosis.",
    removability:
      "Deleting lib/experimental/lenses/ (and its registry entry) leaves " +
      "production and every other experiment unchanged; lenses is a standalone " +
      "leaf.",
    success_criteria: [
      "Categories and status are closed unions.",
      "Lens objects carry only the allowed keys.",
      "Ids and names are unique.",
      "Outputs are immutable.",
      "The four API functions behave per spec.",
      "TypeScript passes.",
      "ESLint passes.",
      "Verification passes.",
    ],
    future_unlocks: [
      "An optional interpretation layer mapping observations to lenses without making any lens authoritative.",
      "Multi-perspective views that keep evidence and interpretation separate.",
    ],
    decision: "undecided",
    created_at: "2026-06-25T00:00:00.000Z",
    updated_at: "2026-06-25T00:00:00.000Z",
  },
]);
