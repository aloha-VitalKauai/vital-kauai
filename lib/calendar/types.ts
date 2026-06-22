// Internal Operations Calendar — shared contract.
//
// One source of truth for the founder-only ops calendar (/dashboard/calendar):
// the journey/event row shapes, the create/update input shapes, the composed
// per-day view models, the category vocabulary (+ display metadata), and the
// pure validators shared by the API routes and the UI.
//
// Backed by supabase/migrations/20260621000000_internal_calendar.sql. There
// are no generated Supabase types in this repo, so query results are cast to
// the row types below.

// ── Categories ──────────────────────────────────────────────────────────────

// Recommended operating categories. Stored as free text in Postgres (the
// `category` column is not a CHECK/enum, so the vocabulary can grow without a
// migration), but the API validates writes against this set and the UI styles
// known categories. `other` is the catch-all.
export const CALENDAR_CATEGORIES = [
  "meal",
  "yoga",
  "ceremony",
  "bodywork",
  "acupuncture",
  "hike",
  "integration",
  "medical",
  "sitter",
  "rest",
  "sound",
  "transport",
  "admin",
  "other",
] as const;

export type CalendarCategory = (typeof CALENDAR_CATEGORIES)[number];

export function isCalendarCategory(value: unknown): value is CalendarCategory {
  return (
    typeof value === "string" &&
    (CALENDAR_CATEGORIES as readonly string[]).includes(value)
  );
}

export type CategoryMeta = {
  label: string;
  accent: string; // text / border / dot color
  soft: string; // chip background
};

// Earthy, muted palette tuned to the Vital Kauaʻi tokens (forest / teal /
// gold / sage). Ceremony carries the heaviest weight (forest) so ceremony
// days read at a glance; medical (red) and sitter (gold) stand out as the
// coverage signals the ops team scans for.
export const CATEGORY_META: Record<CalendarCategory, CategoryMeta> = {
  meal: { label: "Meal", accent: "#B07A2A", soft: "#F7EEDD" },
  yoga: { label: "Yoga", accent: "#5C7E5E", soft: "#E9F0E7" },
  ceremony: { label: "Ceremony", accent: "#1c2b1e", soft: "#E4ECE2" },
  bodywork: { label: "Bodywork", accent: "#7A6BB0", soft: "#ECE9F6" },
  acupuncture: { label: "Acupuncture", accent: "#3E7E8C", soft: "#E1F0F2" },
  hike: { label: "Hike", accent: "#6E8B3D", soft: "#EEF3E1" },
  integration: { label: "Integration", accent: "#085041", soft: "#E1F5EE" },
  medical: { label: "Medical", accent: "#A32D2D", soft: "#F8E6E4" },
  sitter: { label: "Sitter", accent: "#C8842A", soft: "#FBEFDC" },
  rest: { label: "Rest", accent: "#8A8A86", soft: "#F0EFEA" },
  sound: { label: "Sound", accent: "#9A5BA0", soft: "#F3E8F4" },
  transport: { label: "Transport", accent: "#5B6B7A", soft: "#E8ECEF" },
  admin: { label: "Admin", accent: "#6B6B67", soft: "#EFEEE9" },
  other: { label: "Other", accent: "#6B6B67", soft: "#EFEEE9" },
};

export function categoryMeta(category: string): CategoryMeta {
  return isCalendarCategory(category)
    ? CATEGORY_META[category]
    : CATEGORY_META.other;
}

// ── Journey status ──────────────────────────────────────────────────────────

// Free text in the DB (default 'scheduled'); these are the values the UI
// offers.
export const JOURNEY_STATUSES = [
  "scheduled",
  "active",
  "completed",
  "canceled",
] as const;

export type JourneyStatus = (typeof JOURNEY_STATUSES)[number];

// ── Row shapes (mirror the Postgres tables) ─────────────────────────────────

export type ClientJourney = {
  id: string;
  client_id: string | null;
  display_name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: string;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarEvent = {
  id: string;
  journey_id: string;
  title: string;
  category: string;
  event_date: string; // YYYY-MM-DD
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

// ── Input shapes (API request bodies) ───────────────────────────────────────

export type JourneyInput = {
  display_name: string;
  start_date: string;
  end_date: string;
  client_id?: string | null;
  status?: string;
  color?: string | null;
  notes?: string | null;
};

export type CalendarEventInput = {
  journey_id: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location?: string | null;
  assigned_to?: string | null;
  notes?: string | null;
  is_private?: boolean;
  sort_order?: number;
};

// ── Composed view models ────────────────────────────────────────────────────

// One journey as it appears on a specific calendar day: the journey plus which
// day of the stay this is (1-based) and the total length. Drives the
// "Day 2 of 7" labels and lets the UI flag the first/last day.
export type JourneyDay = {
  journey: ClientJourney;
  dayNumber: number;
  totalDays: number;
};

// A single calendar day: the date, the journeys active that day (with day
// numbers), and the events scheduled that day (time-sorted).
export type CalendarDay = {
  date: string; // YYYY-MM-DD
  journeys: JourneyDay[];
  events: CalendarEvent[];
};

// The range payload returned by GET /api/admin/calendar/range.
export type CalendarRange = {
  start: string;
  end: string;
  journeys: ClientJourney[];
  events: CalendarEvent[];
};

// ── Validators (pure; shared by API routes + UI) ────────────────────────────

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}(:\d{2})?$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function isIsoTime(value: unknown): value is string {
  return typeof value === "string" && ISO_TIME.test(value);
}

// Full-shape validation for a create (POST). Returns a list of human-readable
// errors; an empty array means the input is shape-valid.
export function validateJourneyInput(input: Partial<JourneyInput>): string[] {
  const errors: string[] = [];
  if (!input.display_name || !input.display_name.trim()) {
    errors.push("display_name is required");
  }
  if (!isIsoDate(input.start_date)) errors.push("start_date must be YYYY-MM-DD");
  if (!isIsoDate(input.end_date)) errors.push("end_date must be YYYY-MM-DD");
  if (
    isIsoDate(input.start_date) &&
    isIsoDate(input.end_date) &&
    input.end_date < input.start_date
  ) {
    errors.push("end_date must be on or after start_date");
  }
  if (
    input.client_id != null &&
    typeof input.client_id !== "string"
  ) {
    errors.push("client_id must be a UUID string or null");
  }
  if (input.status != null && typeof input.status !== "string") {
    errors.push("status must be a string");
  }
  return errors;
}

// Partial validation for an update (PATCH): only the provided keys are checked.
export function validateJourneyPatch(patch: Partial<JourneyInput>): string[] {
  const errors: string[] = [];
  if ("display_name" in patch && (!patch.display_name || !patch.display_name.trim())) {
    errors.push("display_name cannot be empty");
  }
  if ("start_date" in patch && !isIsoDate(patch.start_date)) {
    errors.push("start_date must be YYYY-MM-DD");
  }
  if ("end_date" in patch && !isIsoDate(patch.end_date)) {
    errors.push("end_date must be YYYY-MM-DD");
  }
  if (
    isIsoDate(patch.start_date) &&
    isIsoDate(patch.end_date) &&
    patch.end_date < patch.start_date
  ) {
    errors.push("end_date must be on or after start_date");
  }
  return errors;
}

export function validateCalendarEventInput(
  input: Partial<CalendarEventInput>,
): string[] {
  const errors: string[] = [];
  if (!input.journey_id || typeof input.journey_id !== "string") {
    errors.push("journey_id is required");
  }
  if (!input.title || !input.title.trim()) errors.push("title is required");
  if (!isCalendarCategory(input.category)) {
    errors.push(`category must be one of: ${CALENDAR_CATEGORIES.join(", ")}`);
  }
  if (!isIsoDate(input.event_date)) errors.push("event_date must be YYYY-MM-DD");
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

export function validateCalendarEventPatch(
  patch: Partial<CalendarEventInput>,
): string[] {
  const errors: string[] = [];
  if ("title" in patch && (!patch.title || !patch.title.trim())) {
    errors.push("title cannot be empty");
  }
  if ("category" in patch && !isCalendarCategory(patch.category)) {
    errors.push(`category must be one of: ${CALENDAR_CATEGORIES.join(", ")}`);
  }
  if ("event_date" in patch && !isIsoDate(patch.event_date)) {
    errors.push("event_date must be YYYY-MM-DD");
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
