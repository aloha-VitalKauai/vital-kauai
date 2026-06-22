// Internal Operations Calendar — data access layer.
//
// Every function takes the caller's Supabase client (the cookie-based server
// client) so reads/writes run under the founder's session and the calendar
// tables' RLS (public.is_founder()) applies. No function creates its own
// client — that keeps RLS honest and matches the repo's lib/api convention
// (e.g. lib/api/vital-profile.ts).
//
// There are no generated Supabase types in this repo, so query results are
// cast to the row types from ./types.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, diffDays } from "./dates";
import type {
  CalendarDay,
  CalendarEvent,
  CalendarEventInput,
  CalendarRange,
  ClientJourney,
  JourneyDay,
  JourneyInput,
} from "./types";

const JOURNEY_COLUMNS =
  "id, client_id, display_name, start_date, end_date, status, color, notes, created_at, updated_at";

const EVENT_COLUMNS =
  "id, journey_id, title, category, event_date, start_time, end_time, location, assigned_to, notes, is_private, sort_order, created_at, updated_at";

// Drops keys whose value is `undefined` so a partial patch never overwrites a
// stored value with null. Pass null explicitly to clear a column.
function pruneUndefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

// ── Reads ───────────────────────────────────────────────────────────────────

// Journeys overlapping [startDate, endDate] plus every event whose date falls
// inside the range. A journey overlaps when it starts on/before the range end
// and ends on/after the range start.
export async function getCalendarRange(
  supabase: SupabaseClient,
  { startDate, endDate }: { startDate: string; endDate: string },
): Promise<CalendarRange> {
  const [journeysRes, eventsRes] = await Promise.all([
    supabase
      .from("client_journeys")
      .select(JOURNEY_COLUMNS)
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .order("start_date", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("calendar_events")
      .select(EVENT_COLUMNS)
      .gte("event_date", startDate)
      .lte("event_date", endDate)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (journeysRes.error) throw journeysRes.error;
  if (eventsRes.error) throw eventsRes.error;

  return {
    start: startDate,
    end: endDate,
    journeys: (journeysRes.data ?? []) as unknown as ClientJourney[],
    events: (eventsRes.data ?? []) as unknown as CalendarEvent[],
  };
}

// One day: the journeys active that day (each tagged with its 1-based day
// number and total length) and that day's events, time-sorted for the hourly
// timeline.
export async function getCalendarDay(
  supabase: SupabaseClient,
  date: string,
): Promise<CalendarDay> {
  const [journeysRes, eventsRes] = await Promise.all([
    supabase
      .from("client_journeys")
      .select(JOURNEY_COLUMNS)
      .lte("start_date", date)
      .gte("end_date", date)
      .order("start_date", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("calendar_events")
      .select(EVENT_COLUMNS)
      .eq("event_date", date)
      .order("start_time", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (journeysRes.error) throw journeysRes.error;
  if (eventsRes.error) throw eventsRes.error;

  const journeys = (journeysRes.data ?? []) as unknown as ClientJourney[];
  const journeyDays: JourneyDay[] = journeys.map((journey) => ({
    journey,
    dayNumber: diffDays(journey.start_date, date) + 1,
    totalDays: diffDays(journey.start_date, journey.end_date) + 1,
  }));

  return {
    date,
    journeys: journeyDays,
    events: (eventsRes.data ?? []) as unknown as CalendarEvent[],
  };
}

// The day scaffold for a journey: one entry per calendar day in the stay, with
// a 1-based day number. No DB writes and no placeholder events — the journey's
// date span *is* the source of truth, so a journey is visible on every day
// without materializing fake rows. A future template feature can use this list
// to seed real events; this PR does not.
export async function generateJourneyDays(
  supabase: SupabaseClient,
  journeyId: string,
): Promise<{ date: string; dayNumber: number; journey: ClientJourney }[]> {
  const { data, error } = await supabase
    .from("client_journeys")
    .select(JOURNEY_COLUMNS)
    .eq("id", journeyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return [];

  const journey = data as unknown as ClientJourney;
  const total = diffDays(journey.start_date, journey.end_date) + 1;
  const days: { date: string; dayNumber: number; journey: ClientJourney }[] = [];
  for (let i = 0; i < total; i++) {
    days.push({ date: addDays(journey.start_date, i), dayNumber: i + 1, journey });
  }
  return days;
}

// ── Journey writes ──────────────────────────────────────────────────────────

export async function createJourney(
  supabase: SupabaseClient,
  input: JourneyInput,
): Promise<ClientJourney> {
  const row = {
    client_id: input.client_id ?? null,
    display_name: input.display_name.trim(),
    start_date: input.start_date,
    end_date: input.end_date,
    status: input.status?.trim() || "scheduled",
    color: input.color ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from("client_journeys")
    .insert(row)
    .select(JOURNEY_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ClientJourney;
}

export async function updateJourney(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<JourneyInput>,
): Promise<ClientJourney> {
  const pruned = pruneUndefined({
    client_id: patch.client_id,
    display_name: patch.display_name?.trim(),
    start_date: patch.start_date,
    end_date: patch.end_date,
    status: patch.status?.trim(),
    color: patch.color,
    notes: patch.notes,
  });

  const { data, error } = await supabase
    .from("client_journeys")
    .update(pruned)
    .eq("id", id)
    .select(JOURNEY_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ClientJourney;
}

export async function deleteJourney(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("client_journeys").delete().eq("id", id);
  if (error) throw error;
}

// ── Event writes ────────────────────────────────────────────────────────────

export async function createCalendarEvent(
  supabase: SupabaseClient,
  input: CalendarEventInput,
): Promise<CalendarEvent> {
  const row = {
    journey_id: input.journey_id,
    title: input.title.trim(),
    category: input.category,
    event_date: input.event_date,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location ?? null,
    assigned_to: input.assigned_to ?? null,
    notes: input.notes ?? null,
    is_private: input.is_private ?? false,
    sort_order: input.sort_order ?? 0,
  };

  const { data, error } = await supabase
    .from("calendar_events")
    .insert(row)
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as CalendarEvent;
}

export async function updateCalendarEvent(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<CalendarEventInput>,
): Promise<CalendarEvent> {
  const pruned = pruneUndefined({
    journey_id: patch.journey_id,
    title: patch.title?.trim(),
    category: patch.category,
    event_date: patch.event_date,
    start_time: patch.start_time,
    end_time: patch.end_time,
    location: patch.location,
    assigned_to: patch.assigned_to,
    notes: patch.notes,
    is_private: patch.is_private,
    sort_order: patch.sort_order,
  });

  const { data, error } = await supabase
    .from("calendar_events")
    .update(pruned)
    .eq("id", id)
    .select(EVENT_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as CalendarEvent;
}

export async function deleteCalendarEvent(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase.from("calendar_events").delete().eq("id", id);
  if (error) throw error;
}
