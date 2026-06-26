// lib/experimental/relationships/index.ts
//
// The public, read-only API of the Experimental Relationship Layer.
//
// Five pure functions over static, in-memory data. Returned relationships are
// frozen deep copies, so a caller can neither mutate one nor reach the seed set
// through it. There are no mutation functions. Unknown names resolve to empty
// answers, never throw.
//
// This file intentionally does not import the observation module: the relationship
// API operates only on the relationship set. Endpoint resolution against the
// observation API is a verification-time concern (see ./verify.ts).

import { deepFreeze, RELATIONSHIP_TYPES, RELATIONSHIPS } from "./data";
import type { Relationship, RelationshipType } from "./types";

export type { Relationship, RelationshipType } from "./types";
export { RELATIONSHIP_TYPES } from "./data";

/** A disconnected, deep-frozen copy of a seed relationship. */
function frozenCopy(relationship: Relationship): Relationship {
  return deepFreeze(structuredClone(relationship));
}

/** Whether `relationship` connects the unordered pair {a, b}, in either direction. */
function connectsPair(relationship: Relationship, a: string, b: string): boolean {
  const { source_object: s, target_object: t } = relationship;
  return (s === a && t === b) || (s === b && t === a);
}

/** Every relationship, as frozen copies. */
export function listRelationships(): readonly Relationship[] {
  return RELATIONSHIPS.map(frozenCopy);
}

/**
 * Every relationship where `objectName` is the source or the target. Returns an
 * empty array for a name that appears in no relationship.
 */
export function getRelationshipsFor(objectName: string): readonly Relationship[] {
  return RELATIONSHIPS.filter(
    (r) => r.source_object === objectName || r.target_object === objectName,
  ).map(frozenCopy);
}

/**
 * Every relationship connecting the unordered pair {source, target}, regardless
 * of direction — the question is "how are these two connected". Plural, because
 * two objects may have several relationships. Returns an empty array when the
 * pair shares no relationship (including when either name is unknown).
 */
export function findRelationship(
  source: string,
  target: string,
): readonly Relationship[] {
  return RELATIONSHIPS.filter((r) => connectsPair(r, source, target)).map(
    frozenCopy,
  );
}

/** Whether the unordered pair {source, target} shares any relationship. */
export function hasRelationship(source: string, target: string): boolean {
  return RELATIONSHIPS.some((r) => connectsPair(r, source, target));
}

/** The closed relationship vocabulary — the keys of {@link RELATIONSHIP_TYPES}. */
export function listRelationshipTypes(): readonly RelationshipType[] {
  return Object.freeze(Object.keys(RELATIONSHIP_TYPES) as RelationshipType[]);
}
