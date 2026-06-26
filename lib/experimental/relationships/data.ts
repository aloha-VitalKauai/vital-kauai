// lib/experimental/relationships/data.ts
//
// The per-type symmetry map and the seed relationships — the single source of
// truth.
//
// Relationships-as-code: adding or changing one means editing this file and
// opening a PR. No persistence, no production read, no mutation path through the
// public API. Every relationship is deep-frozen.

import type { Relationship, RelationshipType } from "./types";

/**
 * Recursively freeze a value and everything it transitively owns.
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
 * Per-type directionality. `symmetric: true` means the pair is unordered
 * (A associated_with B is the same fact as B associated_with A). This drives
 * duplicate detection — without it, "is this a duplicate?" is undefined.
 *
 * The `Record<RelationshipType, …>` annotation makes TypeScript require exactly
 * the union's members as keys, so the type and this map cannot drift apart.
 */
export const RELATIONSHIP_TYPES: Readonly<
  Record<RelationshipType, { readonly symmetric: boolean }>
> = deepFreeze({
  references: { symmetric: false },
  belongs_to: { symmetric: false },
  associated_with: { symmetric: true },
  created_by: { symmetric: false },
  precedes: { symmetric: false },
});

/**
 * The seed relationships. A small cast connecting the observed objects — enough
 * to validate the model, not to cover the domain. Every endpoint resolves to a
 * real `ObservationReport` (checked by ./verify.ts against the observation API).
 * Observational descriptions only; production objects remain untouched.
 */
export const RELATIONSHIPS: readonly Relationship[] = deepFreeze<Relationship[]>([
  {
    id: "rel-001",
    source_object: "CRM Note",
    target_object: "Member",
    relationship_type: "belongs_to",
    created_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "rel-002",
    source_object: "Operational Task",
    target_object: "Member",
    relationship_type: "associated_with",
    created_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "rel-003",
    source_object: "Journey Milestone",
    target_object: "Integration Session",
    relationship_type: "precedes",
    created_at: "2026-06-25T00:00:00.000Z",
    notes: "Observed ordering of two production events; descriptive only.",
  },
  {
    id: "rel-004",
    source_object: "CRM Note",
    target_object: "Operational Task",
    relationship_type: "references",
    created_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "rel-005",
    source_object: "Integration Session",
    target_object: "Member",
    relationship_type: "created_by",
    created_at: "2026-06-25T00:00:00.000Z",
  },
  {
    id: "rel-006",
    source_object: "Journey Milestone",
    target_object: "Member",
    relationship_type: "associated_with",
    created_at: "2026-06-25T00:00:00.000Z",
  },
]);
