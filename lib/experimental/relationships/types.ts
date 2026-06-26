// lib/experimental/relationships/types.ts
//
// The Experimental Relationship Layer (experiment-004) — model.
//
// A relationship states, descriptively, that two observed objects are connected.
// This file is types only: no runtime values. The runtime vocabulary (the
// per-type symmetry map) and the seed relationships live in ./data.ts; the
// read-only public API lives in ./index.ts.
//
// A relationship never changes either object and never infers meaning. It
// describes context; it does not create it. See ./README.md.

/**
 * The closed relationship vocabulary. Discovery, not completion — keep it small.
 *
 * `follows` is intentionally omitted: it is the inverse of `precedes`, and a
 * `precedes` edge with swapped source/target states the same fact.
 */
export type RelationshipType =
  | "references"
  | "belongs_to"
  | "associated_with"
  | "created_by"
  | "precedes";

/**
 * A descriptive, immutable connection between two observed objects.
 *
 * `source_object` and `target_object` are observation *names* (each must equal
 * an `ObservationReport.object_name`), not production objects. They are resolved
 * against the observation API at verification time.
 */
export type Relationship = {
  readonly id: string;
  readonly source_object: string;
  readonly target_object: string;
  readonly relationship_type: RelationshipType;
  readonly created_at: string;
  readonly notes?: string;
};
