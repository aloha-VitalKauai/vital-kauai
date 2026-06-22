// Protocol Template Engine — data access + apply engine.
//
// Every function takes the caller's Supabase client so reads/writes run under
// the founder's session and the founder-only RLS applies (matches lib/calendar
// and lib/api/vital-profile). No generated Supabase types in this repo, so
// results are cast to the row types from ./types.

import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/calendar/dates";
import type { ClientJourney } from "@/lib/calendar/types";
import type {
  ApplyMode,
  ApplyResult,
  ProtocolTemplate,
  ProtocolTemplateDay,
  ProtocolTemplateInput,
  ProtocolTemplateItem,
  ProtocolTemplateItemInput,
  ProtocolTemplateWithItems,
} from "./types";

const TEMPLATE_COLUMNS =
  "id, name, description, kind, duration_days, is_active, created_at, updated_at";

const ITEM_COLUMNS =
  "id, template_id, day_offset, title, category, start_time, end_time, location, assigned_to, notes, is_private, sort_order, created_at, updated_at";

const DAY_COLUMNS =
  "id, template_id, day_number, title, theme, description, created_at, updated_at";

function pruneUndefined<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<T>;
}

// ── Template reads ──────────────────────────────────────────────────────────

// All templates, each with its items attached (items ordered by day then sort).
export async function getProtocolTemplates(
  supabase: SupabaseClient,
): Promise<ProtocolTemplateWithItems[]> {
  const [templatesRes, itemsRes, daysRes] = await Promise.all([
    supabase
      .from("protocol_templates")
      .select(TEMPLATE_COLUMNS)
      .order("name", { ascending: true }),
    supabase
      .from("protocol_template_items")
      .select(ITEM_COLUMNS)
      .order("day_offset", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("protocol_template_days")
      .select(DAY_COLUMNS)
      .order("day_number", { ascending: true }),
  ]);

  if (templatesRes.error) throw templatesRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (daysRes.error) throw daysRes.error;

  const templates = (templatesRes.data ?? []) as unknown as ProtocolTemplate[];
  const items = (itemsRes.data ?? []) as unknown as ProtocolTemplateItem[];
  const days = (daysRes.data ?? []) as unknown as ProtocolTemplateDay[];

  const itemsByTemplate = new Map<string, ProtocolTemplateItem[]>();
  for (const item of items) {
    const list = itemsByTemplate.get(item.template_id) ?? [];
    list.push(item);
    itemsByTemplate.set(item.template_id, list);
  }

  const daysByTemplate = new Map<string, ProtocolTemplateDay[]>();
  for (const day of days) {
    const list = daysByTemplate.get(day.template_id) ?? [];
    list.push(day);
    daysByTemplate.set(day.template_id, list);
  }

  return templates.map((t) => ({
    ...t,
    items: itemsByTemplate.get(t.id) ?? [],
    days: daysByTemplate.get(t.id) ?? [],
  }));
}

export async function getProtocolTemplate(
  supabase: SupabaseClient,
  id: string,
): Promise<ProtocolTemplateWithItems | null> {
  const { data: template, error } = await supabase
    .from("protocol_templates")
    .select(TEMPLATE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!template) return null;

  const [itemsRes, daysRes] = await Promise.all([
    supabase
      .from("protocol_template_items")
      .select(ITEM_COLUMNS)
      .eq("template_id", id)
      .order("day_offset", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("protocol_template_days")
      .select(DAY_COLUMNS)
      .eq("template_id", id)
      .order("day_number", { ascending: true }),
  ]);

  if (itemsRes.error) throw itemsRes.error;
  if (daysRes.error) throw daysRes.error;

  return {
    ...(template as unknown as ProtocolTemplate),
    items: (itemsRes.data ?? []) as unknown as ProtocolTemplateItem[],
    days: (daysRes.data ?? []) as unknown as ProtocolTemplateDay[],
  };
}

// ── Template writes ─────────────────────────────────────────────────────────

export async function createProtocolTemplate(
  supabase: SupabaseClient,
  input: ProtocolTemplateInput,
): Promise<ProtocolTemplate> {
  const row = {
    name: input.name.trim(),
    description: input.description ?? null,
    kind: input.kind?.trim() || "protocol",
    duration_days: input.duration_days ?? 1,
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabase
    .from("protocol_templates")
    .insert(row)
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ProtocolTemplate;
}

export async function updateProtocolTemplate(
  supabase: SupabaseClient,
  id: string,
  patch: Partial<ProtocolTemplateInput>,
): Promise<ProtocolTemplate> {
  const pruned = pruneUndefined({
    name: patch.name?.trim(),
    description: patch.description,
    kind: patch.kind?.trim(),
    duration_days: patch.duration_days,
    is_active: patch.is_active,
  });

  const { data, error } = await supabase
    .from("protocol_templates")
    .update(pruned)
    .eq("id", id)
    .select(TEMPLATE_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ProtocolTemplate;
}

export async function deleteProtocolTemplate(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("protocol_templates")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

// ── Item writes ─────────────────────────────────────────────────────────────

export async function createTemplateItem(
  supabase: SupabaseClient,
  templateId: string,
  input: ProtocolTemplateItemInput,
): Promise<ProtocolTemplateItem> {
  const row = {
    template_id: templateId,
    day_offset: input.day_offset,
    title: input.title.trim(),
    category: input.category,
    start_time: input.start_time,
    end_time: input.end_time,
    location: input.location ?? null,
    assigned_to: input.assigned_to ?? null,
    notes: input.notes ?? null,
    is_private: input.is_private ?? false,
    sort_order: input.sort_order ?? 0,
  };

  const { data, error } = await supabase
    .from("protocol_template_items")
    .insert(row)
    .select(ITEM_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ProtocolTemplateItem;
}

export async function updateTemplateItem(
  supabase: SupabaseClient,
  itemId: string,
  patch: Partial<ProtocolTemplateItemInput>,
): Promise<ProtocolTemplateItem> {
  const pruned = pruneUndefined({
    day_offset: patch.day_offset,
    title: patch.title?.trim(),
    category: patch.category,
    start_time: patch.start_time,
    end_time: patch.end_time,
    location: patch.location,
    assigned_to: patch.assigned_to,
    notes: patch.notes,
    is_private: patch.is_private,
    sort_order: patch.sort_order,
  });

  const { data, error } = await supabase
    .from("protocol_template_items")
    .update(pruned)
    .eq("id", itemId)
    .select(ITEM_COLUMNS)
    .single();

  if (error) throw error;
  return data as unknown as ProtocolTemplateItem;
}

export async function deleteTemplateItem(
  supabase: SupabaseClient,
  itemId: string,
): Promise<void> {
  const { error } = await supabase
    .from("protocol_template_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// ── Apply engine ────────────────────────────────────────────────────────────

// Materialize a template onto a journey's calendar.
//
// For each item: event_date = journey.start_date + day_offset. Items whose day
// falls past the journey's end_date are skipped (counted, not an error). In
// "replace" mode, events previously generated from THIS template on THIS
// journey are deleted first (matched by source_template_id) so re-applying is
// idempotent; hand-made events and events from other templates are untouched.
//
// Generated rows are ordinary calendar_events (editable in the calendar),
// tagged with source_template_id for provenance.
export async function applyTemplateToJourney(
  supabase: SupabaseClient,
  {
    templateId,
    journeyId,
    mode,
  }: { templateId: string; journeyId: string; mode: ApplyMode },
): Promise<ApplyResult> {
  const { data: journeyRow, error: journeyErr } = await supabase
    .from("client_journeys")
    .select("id, start_date, end_date")
    .eq("id", journeyId)
    .maybeSingle();
  if (journeyErr) throw journeyErr;
  if (!journeyRow) throw new Error("journey_not_found");
  const journey = journeyRow as Pick<
    ClientJourney,
    "id" | "start_date" | "end_date"
  >;

  const { data: itemsData, error: itemsErr } = await supabase
    .from("protocol_template_items")
    .select(ITEM_COLUMNS)
    .eq("template_id", templateId)
    .order("day_offset", { ascending: true })
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;
  const items = (itemsData ?? []) as unknown as ProtocolTemplateItem[];

  let removed = 0;
  if (mode === "replace") {
    const { data: del, error: delErr } = await supabase
      .from("calendar_events")
      .delete()
      .eq("journey_id", journeyId)
      .eq("source_template_id", templateId)
      .select("id");
    if (delErr) throw delErr;
    removed = del?.length ?? 0;
  }

  let skipped = 0;
  const rows = [];
  for (const item of items) {
    const eventDate = addDays(journey.start_date, item.day_offset);
    if (eventDate > journey.end_date) {
      skipped++;
      continue;
    }
    rows.push({
      journey_id: journeyId,
      title: item.title,
      category: item.category,
      event_date: eventDate,
      start_time: item.start_time,
      end_time: item.end_time,
      location: item.location,
      assigned_to: item.assigned_to,
      notes: item.notes,
      is_private: item.is_private,
      sort_order: item.sort_order,
      source_template_id: templateId,
    });
  }

  let created = 0;
  if (rows.length > 0) {
    const { data: ins, error: insErr } = await supabase
      .from("calendar_events")
      .insert(rows)
      .select("id");
    if (insErr) throw insErr;
    created = ins?.length ?? 0;
  }

  return { templateId, journeyId, mode, created, skipped, removed };
}
