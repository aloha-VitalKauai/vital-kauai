// lib/experimental/observation/data.ts
//
// The canonical capability vocabulary (as runtime values), the union value sets
// for validation, and the seed observations — the single source of truth.
//
// Observation-as-code: adding or changing an observation means editing this file
// and opening a PR. There is no persistence, no production read at runtime, and
// no mutation path through the public API. Every report is deep-frozen, and its
// `absent_capabilities` is DERIVED here as the exact complement of what was
// observed present — never hand-authored.

import type {
  Capability,
  ExperimentalScope,
  ObjectCategory,
  ObservationReport,
  ProductionScope,
} from "./types";

/**
 * The full capability vocabulary in canonical order. The single source for the
 * complement that produces `absent_capabilities`. Reconciled with the
 * {@link Capability} union by ./verify.ts (current ⊆ this set; absent = this set
 * minus current).
 */
export const ALL_CAPABILITIES: readonly Capability[] = [
  "identity",
  "timestamp",
  "content",
  "provenance",
  "versioning",
  "relationships",
  "timeline_participation",
] as const;

/** Every legal {@link ObjectCategory}, as runtime values for validation. */
export const OBJECT_CATEGORIES: readonly ObjectCategory[] = Object.freeze([
  "record",
  "task",
  "event",
  "document",
  "message",
  "entity",
]);

/** Every legal {@link ProductionScope}, as runtime values for validation. */
export const PRODUCTION_SCOPES: readonly ProductionScope[] = Object.freeze([
  "operational",
  "read_only",
  "none",
]);

/** Every legal {@link ExperimentalScope}, as runtime values for validation. */
export const EXPERIMENTAL_SCOPES: readonly ExperimentalScope[] = Object.freeze([
  "observed",
  "wrapped",
  "none",
]);

/**
 * Recursively freeze a value and everything it transitively owns, so a report,
 * its `attributes`, and its capability arrays cannot be mutated in place.
 */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/**
 * Build an immutable observation, DERIVING `absent_capabilities` as the exact
 * complement of `current_capabilities` over {@link ALL_CAPABILITIES}. The caller
 * authors only what was observed present; absence falls out mechanically.
 */
function observe(
  input: Omit<ObservationReport, "absent_capabilities">,
): ObservationReport {
  const present = new Set<Capability>(input.current_capabilities);
  const report: ObservationReport = {
    ...input,
    absent_capabilities: ALL_CAPABILITIES.filter((c) => !present.has(c)),
  };
  return deepFreeze(report);
}

/**
 * The seed observations. A small cast of production objects, each fully
 * specified. Observation only — nothing here reads or modifies the real objects.
 * CRM Note came first; Member, Operational Task, Journey Milestone, and
 * Integration Session were added so the lab has a small connected cast to
 * describe.
 */
export const OBSERVATIONS: readonly ObservationReport[] = deepFreeze([
  observe({
    object_name: "CRM Note",
    object_location: "production CRM — note records",
    object_category: "record",
    current_capabilities: ["identity", "timestamp", "content"],
    attributes: {
      mutable: true,
      member_visible: false,
      operational: true,
      experimental: false,
    },
    production_scope: "operational",
    experimental_scope: "observed",
    notes:
      "Observation only. Provenance is a candidate future integration; not " +
      "present today.",
  }),
  observe({
    object_name: "Member",
    object_location: "production — member records",
    object_category: "entity",
    current_capabilities: ["identity", "timestamp", "content"],
    attributes: {
      mutable: true,
      member_visible: true,
      operational: true,
      experimental: false,
    },
    production_scope: "operational",
    experimental_scope: "observed",
    notes: "Observation only. The member entity as it exists in production.",
  }),
  observe({
    object_name: "Operational Task",
    object_location: "production ops — task records",
    object_category: "task",
    current_capabilities: ["identity", "timestamp", "content"],
    attributes: {
      mutable: true,
      member_visible: false,
      operational: true,
      experimental: false,
    },
    production_scope: "operational",
    experimental_scope: "observed",
    notes: "Observation only. An operational task record.",
  }),
  observe({
    object_name: "Journey Milestone",
    object_location: "production — journey milestone events",
    object_category: "event",
    current_capabilities: ["identity", "timestamp"],
    attributes: {
      mutable: false,
      member_visible: true,
      operational: true,
      experimental: false,
    },
    production_scope: "operational",
    experimental_scope: "observed",
    notes: "Observation only. A milestone event in a member journey.",
  }),
  observe({
    object_name: "Integration Session",
    object_location: "production — integration session events",
    object_category: "event",
    current_capabilities: ["identity", "timestamp", "content"],
    attributes: {
      mutable: true,
      member_visible: true,
      operational: true,
      experimental: false,
    },
    production_scope: "operational",
    experimental_scope: "observed",
    notes: "Observation only. An integration session event.",
  }),
]);
