// lib/experimental/observation/index.ts
//
// The public, read-only API of the Experimental Observation Layer.
//
// Four pure functions over static, in-memory data. Returned reports are frozen
// deep copies, so a caller can neither mutate a report nor reach the registry of
// observations through one. Unknown names resolve to empty answers, never throw.

import { deepFreeze, OBSERVATIONS } from "./data";
import type { Capability, ObservationReport } from "./types";

export type {
  Capability,
  ObjectCategory,
  ProductionScope,
  ExperimentalScope,
  ObservedAttributes,
  ObservationReport,
} from "./types";
export { ALL_CAPABILITIES } from "./data";

/** A disconnected, deep-frozen copy of a seed report. */
function frozenCopy(report: ObservationReport): ObservationReport {
  return deepFreeze(structuredClone(report));
}

function findReport(name: string): ObservationReport | undefined {
  return OBSERVATIONS.find((report) => report.object_name === name);
}

/** Every observation, as frozen copies. */
export function listObservations(): ObservationReport[] {
  return OBSERVATIONS.map(frozenCopy);
}

/** The observation for the named object, or `undefined` if none is observed. */
export function getObservation(name: string): ObservationReport | undefined {
  const found = findReport(name);
  return found ? frozenCopy(found) : undefined;
}

/**
 * Whether the named object was observed to have `capability`. Returns false for
 * an unknown name. The `capability` parameter is typed as {@link Capability}, so
 * an unknown capability string is a compile-time error, not a runtime miss.
 */
export function hasCapability(name: string, capability: Capability): boolean {
  const found = findReport(name);
  return found ? found.current_capabilities.includes(capability) : false;
}

/**
 * The capabilities the named object was observed to have, as a frozen copy.
 * Returns an empty array for an unknown name.
 */
export function listCapabilities(name: string): readonly Capability[] {
  const found = findReport(name);
  return found ? Object.freeze(found.current_capabilities.slice()) : [];
}
