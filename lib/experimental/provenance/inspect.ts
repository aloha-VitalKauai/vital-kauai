// lib/experimental/provenance/inspect.ts
//
// Optional developer-facing inspection helpers.
//
// These turn a provenance bundle into a human-readable label for internal
// debugging and developer tooling only. They are NOT wired into any production
// UI and do not change the member or staff experience. See ./README.md.

import type { Provenance, RecordKind, SourceType } from "./types";

const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  member_submitted: "Member Submitted",
  staff_entered: "Staff Entered",
  system_generated: "System Generated",
  imported: "Imported",
  external_document: "External Document",
  unknown: "Unknown",
};

const RECORD_KIND_LABELS: Record<RecordKind, string> = {
  evidence: "Evidence",
  interpretation: "Interpretation",
  operational: "Operational",
  system_event: "System Event",
};

/** Friendly label for a source type, e.g. `staff_entered` → "Staff Entered". */
export function sourceTypeLabel(source: SourceType): string {
  return SOURCE_TYPE_LABELS[source];
}

/** Friendly label for a record kind, e.g. `operational` → "Operational". */
export function recordKindLabel(kind: RecordKind): string {
  return RECORD_KIND_LABELS[kind];
}

/**
 * A short, multi-line description suited to a developer inspection panel:
 *
 *   Created by: Rachel
 *   Source: Staff Entered
 *   Kind: Operational
 *
 * The "Created by" line prefers the most human-readable identifier available
 * (an explicit source label, then the role, then the user id) and falls back to
 * "Unknown" rather than inventing a name.
 */
export function describeProvenance(provenance: Provenance): string {
  const author =
    provenance.source_label ??
    provenance.created_by_role ??
    provenance.created_by_user_id ??
    "Unknown";

  return [
    `Created by: ${author}`,
    `Source: ${sourceTypeLabel(provenance.source_type)}`,
    `Kind: ${recordKindLabel(provenance.record_kind)}`,
  ].join("\n");
}
