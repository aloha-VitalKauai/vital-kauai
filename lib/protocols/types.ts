// Protocol Template Engine — shared contract.
//
// A protocol template is a named, day-indexed set of itinerary blocks. Applying
// it to a client journey materializes one calendar_events row per block (dated
// relative to the journey's start_date), tagged with source_template_id so the
// protocol can be re-applied (replace) or removed. Generated events are plain,
// editable calendar_events.
//
// Reuses the calendar's category vocabulary and ISO/time validators so a
// template block and the calendar event it becomes are validated identically.

import {
  isCalendarCategory,
  isIsoTime,
  CALENDAR_CATEGORIES,
} from "@/lib/calendar/types";

// Free-text kind (UI offers these; DB doesn't enforce an enum).
export const PROTOCOL_KINDS = [
  "private",
  "cohort",
  "day",
  "protocol",
  "custom",
] as const;
export type ProtocolKind = (typeof PROTOCOL_KINDS)[number];

// How an apply interacts with events a prior apply of the SAME template left on
// the journey.
export type ApplyMode = "append" | "replace";
export const APPLY_MODES: ApplyMode[] = ["append", "replace"];

// ── Row shapes (mirror the Postgres tables) ─────────────────────────────────

export type ProtocolTemplate = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  duration_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProtocolTemplateItem = {
  id: string;
  template_id: string;
  day_offset: number; // 0-based: Day 1 = offset 0
  title: string;
  category: string;
  start_time: string; // HH:MM[:SS]
  end_time: string; // HH:MM[:SS]
  location: string | null;
  assigned_to: string | null;
  notes: string | null;
  is_private: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

// Day identity — the title, theme, and meaning of each day in a protocol
// (e.g. Day 3 = "Ceremony — The Medicine"). Optional layer: a protocol with no
// day rows simply falls back to "Day N". day_number is 1-based.
export type ProtocolTemplateDay = {
  id: string;
  template_id: string;
  day_number: number; // 1-based
  title: string;
  theme: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type ProtocolTemplateDayInput = {
  day_number: number;
  title: string;
  theme?: string | null;
  description?: string | null;
};

export type ProtocolTemplateWithItems = ProtocolTemplate & {
  items: ProtocolTemplateItem[];
  // Day identity records (may be empty for protocols without identity).
  days: ProtocolTemplateDay[];
};

// ── Input shapes (API request bodies) ───────────────────────────────────────

export type ProtocolTemplateInput = {
  name: string;
  description?: string | null;
  kind?: string;
  duration_days?: number;
  is_active?: boolean;
};

export type ProtocolTemplateItemInput = {
  day_offset: number;
  title: string;
  category: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  is_private?: boolean;
  sort_order?: number;
};

// ── Apply result ────────────────────────────────────────────────────────────

export type ApplyResult = {
  templateId: string;
  journeyId: string;
  mode: ApplyMode;
  created: number; // events written
  skipped: number; // items whose day fell past the journey's end_date
  removed: number; // pre-existing events cleared (replace mode)
};

// ── Validators (pure; shared by API + UI) ───────────────────────────────────

export function isApplyMode(value: unknown): value is ApplyMode {
  return value === "append" || value === "replace";
}

export function validateTemplateInput(
  input: Partial<ProtocolTemplateInput>,
): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push("name is required");
  if (
    input.duration_days != null &&
    (!Number.isInteger(input.duration_days) || input.duration_days < 1)
  ) {
    errors.push("duration_days must be an integer >= 1");
  }
  return errors;
}

export function validateTemplatePatch(
  patch: Partial<ProtocolTemplateInput>,
): string[] {
  const errors: string[] = [];
  if ("name" in patch && (!patch.name || !patch.name.trim())) {
    errors.push("name cannot be empty");
  }
  if (
    "duration_days" in patch &&
    (!Number.isInteger(patch.duration_days) || (patch.duration_days ?? 0) < 1)
  ) {
    errors.push("duration_days must be an integer >= 1");
  }
  return errors;
}

export function validateTemplateItemInput(
  input: Partial<ProtocolTemplateItemInput>,
): string[] {
  const errors: string[] = [];
  if (!input.title || !input.title.trim()) errors.push("title is required");
  if (!isCalendarCategory(input.category)) {
    errors.push(`category must be one of: ${CALENDAR_CATEGORIES.join(", ")}`);
  }
  if (
    input.day_offset == null ||
    !Number.isInteger(input.day_offset) ||
    input.day_offset < 0
  ) {
    errors.push("day_offset must be an integer >= 0");
  }
  if (!isIsoTime(input.start_time)) errors.push("start_time must be HH:MM");
  if (!isIsoTime(input.end_time)) errors.push("end_time must be HH:MM");
  if (
    isIsoTime(input.start_time) &&
    isIsoTime(input.end_time) &&
    input.end_time < input.start_time
  ) {
    errors.push("end_time must be on or after start_time");
  }
  return errors;
}

export function validateTemplateItemPatch(
  patch: Partial<ProtocolTemplateItemInput>,
): string[] {
  const errors: string[] = [];
  if ("title" in patch && (!patch.title || !patch.title.trim())) {
    errors.push("title cannot be empty");
  }
  if ("category" in patch && !isCalendarCategory(patch.category)) {
    errors.push(`category must be one of: ${CALENDAR_CATEGORIES.join(", ")}`);
  }
  if (
    "day_offset" in patch &&
    (!Number.isInteger(patch.day_offset) || (patch.day_offset ?? -1) < 0)
  ) {
    errors.push("day_offset must be an integer >= 0");
  }
  if ("start_time" in patch && !isIsoTime(patch.start_time)) {
    errors.push("start_time must be HH:MM");
  }
  if ("end_time" in patch && !isIsoTime(patch.end_time)) {
    errors.push("end_time must be HH:MM");
  }
  if (
    isIsoTime(patch.start_time) &&
    isIsoTime(patch.end_time) &&
    patch.end_time < patch.start_time
  ) {
    errors.push("end_time must be on or after start_time");
  }
  return errors;
}
