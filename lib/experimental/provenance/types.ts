// lib/experimental/provenance/types.ts
//
// Provenance metadata — the first building block of the Human Record Pilot.
//
// This module defines the *shape* of provenance: a small, additive bundle of
// fields describing where a record came from, who created it, and what kind of
// information it represents. It deliberately holds types and runtime guards
// only — no database access, no Supabase client, no production wiring.
//
// Nothing in production imports this file. It exists so we can begin practicing
// the discipline of recording provenance before any of it touches the live
// platform. See ./README.md and ../README.md for the pilot charter.

/**
 * Where a piece of information originated.
 *
 * `unknown` is a first-class value, not an error state: a great deal of the
 * data we will eventually describe predates this discipline, and saying so
 * honestly is more useful than guessing.
 */
export const SOURCE_TYPES = [
  "member_submitted",
  "staff_entered",
  "system_generated",
  "imported",
  "external_document",
  "unknown",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * What kind of thing a record is, epistemically.
 *
 * - `evidence`       — a primary observation or artifact (something happened).
 * - `interpretation` — a reading, summary, or judgment layered on evidence.
 * - `operational`    — coordination data: tasks, notes, scheduling housekeeping.
 * - `system_event`   — something the platform itself recorded automatically.
 *
 * Keeping evidence separate from interpretation is the single most valuable
 * distinction the Human Record can make, so it earns a place from day one.
 */
export const RECORD_KINDS = [
  "evidence",
  "interpretation",
  "operational",
  "system_event",
] as const;

export type RecordKind = (typeof RECORD_KINDS)[number];

/**
 * The provenance bundle itself.
 *
 * Fields use snake_case to match the existing record/column conventions in this
 * codebase (e.g. member_profiles), so that if and when provenance graduates to
 * persistence, the shape already aligns.
 *
 * Timestamps are ISO 8601 strings, matching how the rest of the app stores
 * `*_at` values (`new Date().toISOString()`).
 */
export type Provenance = {
  created_by_user_id: string | null;
  created_by_role: string | null;
  created_at: string;
  updated_at: string;
  source_type: SourceType;
  source_label: string | null;
  record_kind: RecordKind;
};

/** Runtime guard: is `value` one of the known source types? */
export function isSourceType(value: unknown): value is SourceType {
  return (
    typeof value === "string" &&
    (SOURCE_TYPES as readonly string[]).includes(value)
  );
}

/** Runtime guard: is `value` one of the known record kinds? */
export function isRecordKind(value: unknown): value is RecordKind {
  return (
    typeof value === "string" &&
    (RECORD_KINDS as readonly string[]).includes(value)
  );
}
