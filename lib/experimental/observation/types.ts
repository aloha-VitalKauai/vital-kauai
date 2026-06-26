// lib/experimental/observation/types.ts
//
// The Experimental Observation Layer (experiment-003) — model.
//
// Observation describes existing production objects through a consistent, typed
// lens, without touching them. This file is types only: no runtime values, no
// imports of other experiments. The canonical capability vocabulary as runtime
// values, and the seed observations, live in ./data.ts; the read-only public
// API lives in ./index.ts.
//
// Everything here is purely descriptive. An observation is never a judgment, a
// recommendation, or a plan. See ./README.md for what observation is and is not.

/**
 * A feature an object can have. A CLOSED set — extend it deliberately, never ad
 * hoc. Keeping capabilities a union (not free strings) makes a report
 * checkable, the API type-safe, and "absent" a mechanical fact rather than an
 * opinion.
 */
export type Capability =
  | "identity"
  | "timestamp"
  | "content"
  | "provenance"
  | "versioning"
  | "relationships"
  | "timeline_participation";

/** What kind of thing is being observed. A small, growable union. */
export type ObjectCategory =
  | "record"
  | "task"
  | "event"
  | "document"
  | "message"
  | "entity";

/** Where the object sits in production. */
export type ProductionScope = "operational" | "read_only" | "none";

/** How the lab currently relates to the object. */
export type ExperimentalScope = "observed" | "wrapped" | "none";

/**
 * Observed boolean state — distinct from capabilities.
 *
 * Capabilities are features the object *has*; attributes are its current
 * *condition*. Keeping them separate keeps each concern honest.
 */
export type ObservedAttributes = {
  readonly mutable: boolean;
  readonly member_visible: boolean;
  readonly operational: boolean;
  readonly experimental: boolean;
};

/**
 * A purely descriptive, immutable observation of one production object.
 *
 * `absent_capabilities` is the mechanical complement of `current_capabilities`
 * (ALL_CAPABILITIES minus what was observed present). It is derived, never
 * authored — no human decides what is "missing"; it falls out of what was
 * observed. See ./data.ts for the deriving builder and ./verify.ts for the
 * check that it is the exact complement.
 */
export type ObservationReport = {
  readonly object_name: string;
  readonly object_location: string;
  readonly object_category: ObjectCategory;
  readonly current_capabilities: readonly Capability[];
  readonly absent_capabilities: readonly Capability[];
  readonly attributes: ObservedAttributes;
  readonly production_scope: ProductionScope;
  readonly experimental_scope: ExperimentalScope;
  readonly notes: string;
};
