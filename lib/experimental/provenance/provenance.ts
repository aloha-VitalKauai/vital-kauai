// lib/experimental/provenance/provenance.ts
//
// Pure helpers for constructing, updating, and attaching provenance metadata.
//
// Everything here is a pure function over plain objects. There is no I/O, no
// Supabase client, and no mutation of the inputs — every helper returns a fresh
// value. That keeps provenance trivially testable and guarantees the helpers
// can never disturb a record they describe.

import {
  isRecordKind,
  isSourceType,
  type Provenance,
  type RecordKind,
  type SourceType,
} from "./types";

/**
 * The single key under which provenance attaches to a record.
 *
 * Provenance is namespaced under one key rather than spread as loose fields so
 * that attaching it can never collide with or overwrite an existing column on
 * the record it describes. It sits *alongside* the data — never on top of it.
 */
export const PROVENANCE_KEY = "provenance" as const;

/** The minimal information a caller must supply to mint provenance. */
export type ProvenanceInput = {
  created_by_user_id?: string | null;
  created_by_role?: string | null;
  source_type: SourceType;
  source_label?: string | null;
  record_kind: RecordKind;
};

/**
 * Options shared by the time-stamping helpers.
 *
 * `now` lets a caller (or a test) pin the timestamp deterministically. Left
 * unset, it defaults to the current time, matching the rest of the app.
 */
export type ProvenanceOptions = {
  now?: string;
};

function nowIso(opts?: ProvenanceOptions): string {
  return opts?.now ?? new Date().toISOString();
}

/**
 * Build a fresh provenance bundle. `created_at` and `updated_at` start equal.
 */
export function createProvenance(
  input: ProvenanceInput,
  opts?: ProvenanceOptions,
): Provenance {
  const timestamp = nowIso(opts);
  return {
    created_by_user_id: input.created_by_user_id ?? null,
    created_by_role: input.created_by_role ?? null,
    created_at: timestamp,
    updated_at: timestamp,
    source_type: input.source_type,
    source_label: input.source_label ?? null,
    record_kind: input.record_kind,
  };
}

/**
 * Advance `updated_at` while preserving everything else (including the original
 * `created_at`). Returns a new bundle; the input is left untouched.
 */
export function touchProvenance(
  previous: Provenance,
  opts?: ProvenanceOptions,
): Provenance {
  return { ...previous, updated_at: nowIso(opts) };
}

/** A record with provenance attached under {@link PROVENANCE_KEY}. */
export type WithProvenance<T> = T & { [PROVENANCE_KEY]: Provenance };

/**
 * Attach provenance to a record additively.
 *
 * Returns a shallow copy of `record` with the provenance bundle added. The
 * original record is never mutated and none of its existing fields are removed
 * or changed — this is purely additive by construction.
 */
export function withProvenance<T extends object>(
  record: T,
  provenance: Provenance,
): WithProvenance<T> {
  return { ...record, [PROVENANCE_KEY]: provenance } as WithProvenance<T>;
}

/** Read provenance back off a record, or `null` if none is attached / valid. */
export function getProvenance<T extends object>(record: T): Provenance | null {
  const value = (record as Record<string, unknown>)[PROVENANCE_KEY];
  return isProvenance(value) ? value : null;
}

/**
 * Structural guard: does `value` look like a complete, well-formed Provenance?
 *
 * Useful for validating data that crosses a boundary (an import, a future
 * persisted row) before trusting it.
 */
export function isProvenance(value: unknown): value is Provenance {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    (v.created_by_user_id === null ||
      typeof v.created_by_user_id === "string") &&
    (v.created_by_role === null || typeof v.created_by_role === "string") &&
    typeof v.created_at === "string" &&
    typeof v.updated_at === "string" &&
    isSourceType(v.source_type) &&
    (v.source_label === null || typeof v.source_label === "string") &&
    isRecordKind(v.record_kind)
  );
}
