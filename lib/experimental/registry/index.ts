// lib/experimental/registry/index.ts
//
// The public, read-only API of the Experimental Pilot Registry.
//
// Consumers (all experimental — production never imports this) reach for these
// five functions. The registry is the single source of truth and is not
// mutable through this surface: the seed is frozen, and every getter returns a
// deep copy, so a caller can freely mutate what it receives without ever
// touching registry state.

import { PRODUCTION_SAFE_IMPACTS, REGISTRY } from "./data";
import type { ExperimentalPilot } from "./types";

export type {
  ExperimentalPilot,
  ExperimentStatus,
  ProductionImpact,
  ExperimentDecision,
} from "./types";

/** A disconnected, mutable deep copy of a frozen experiment record. */
function copy(experiment: ExperimentalPilot): ExperimentalPilot {
  return structuredClone(experiment);
}

/** All experiments, as fresh copies. */
export function getExperiments(): ExperimentalPilot[] {
  return REGISTRY.map(copy);
}

/** The experiment with the given id, or `undefined` if none matches. */
export function getExperimentById(id: string): ExperimentalPilot | undefined {
  const found = REGISTRY.find((experiment) => experiment.id === id);
  return found ? copy(found) : undefined;
}

/** Experiments currently in the `active` lifecycle state. */
export function listActiveExperiments(): ExperimentalPilot[] {
  return getExperiments().filter((experiment) => experiment.status === "active");
}

/** Experiments in the `completed` terminal state. */
export function listCompletedExperiments(): ExperimentalPilot[] {
  return getExperiments().filter(
    (experiment) => experiment.status === "completed",
  );
}

/**
 * Whether an experiment's *declared* impact cannot change production behavior.
 * True only for `none`, `read_only`, and `internal_only`; the
 * `production_candidate` and `production` impacts require extra review and
 * return false.
 */
export function isProductionSafeExperiment(
  experiment: ExperimentalPilot,
): boolean {
  return PRODUCTION_SAFE_IMPACTS.includes(experiment.production_impact);
}
