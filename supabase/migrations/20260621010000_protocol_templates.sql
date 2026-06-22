-- Protocol Template Engine — reusable day-by-day itinerary templates.
--
-- Builds on the operations calendar (20260621000000_internal_calendar.sql).
-- A protocol template is a named, day-indexed set of itinerary blocks (e.g.
-- "Sample 7-Day Private Protocol"). Applying a template to a client journey
-- materializes one calendar_events row per block, dated relative to the
-- journey's start_date. Generated events are ordinary calendar_events — fully
-- editable in the calendar — tagged with source_template_id so a protocol can
-- be cleanly re-applied (replace) or removed.
--
-- Two new tables:
--
--   protocol_templates       — the template header (name, kind, duration).
--   protocol_template_items  — the blocks, each at a 0-based day_offset
--                              (Day 1 = offset 0) with a time window and the
--                              same category vocabulary as calendar_events.
--
-- Plus one additive column on calendar_events:
--
--   source_template_id       — nullable provenance. NULL for hand-made events;
--                              set to the template id for generated ones. ON
--                              DELETE SET NULL so deleting a template leaves
--                              the already-scheduled events in place (they just
--                              lose the provenance tag).
--
-- Additive and idempotent. No existing table or policy is modified beyond the
-- one new nullable column, which is invisible to existing reads/writes. Safe to
-- apply on production without coordination.
--
-- RLS: founder-only for every operation on both new tables, via the existing
-- public.is_founder() (a user_roles lookup). calendar_events already enforces
-- founder-only RLS, so the new column inherits that protection.
--
-- Reversibility (forward-only migrations; documented for manual rollback):
--   alter table public.calendar_events drop column if exists source_template_id;
--   drop table if exists public.protocol_template_items;
--   drop table if exists public.protocol_templates;

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.protocol_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  kind          text not null default 'protocol',
  duration_days integer not null default 1,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint protocol_templates_duration_positive check (duration_days >= 1)
);

create table if not exists public.protocol_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates(id) on delete cascade,
  day_offset  integer not null default 0,
  title       text not null,
  category    text not null,
  start_time  time not null,
  end_time    time not null,
  location    text,
  assigned_to text,
  notes       text,
  is_private  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint protocol_template_items_day_offset_nonneg check (day_offset >= 0),
  constraint protocol_template_items_time_order check (end_time >= start_time)
);

-- Provenance tag on generated calendar events.
alter table public.calendar_events
  add column if not exists source_template_id uuid
    references public.protocol_templates(id) on delete set null;

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists protocol_template_items_template_idx
  on public.protocol_template_items (template_id, day_offset, sort_order);
create index if not exists protocol_templates_active_idx
  on public.protocol_templates (is_active, name);
create index if not exists calendar_events_source_template_idx
  on public.calendar_events (source_template_id);

-- ── updated_at triggers (reuse the calendar touch function) ─────────────────

drop trigger if exists protocol_templates_touch_updated_at on public.protocol_templates;
create trigger protocol_templates_touch_updated_at
  before update on public.protocol_templates
  for each row execute function public.calendar_touch_updated_at();

drop trigger if exists protocol_template_items_touch_updated_at on public.protocol_template_items;
create trigger protocol_template_items_touch_updated_at
  before update on public.protocol_template_items
  for each row execute function public.calendar_touch_updated_at();

-- ── RLS: founder-only ───────────────────────────────────────────────────────

alter table public.protocol_templates enable row level security;
alter table public.protocol_template_items enable row level security;

drop policy if exists protocol_templates_founder_all on public.protocol_templates;
create policy protocol_templates_founder_all on public.protocol_templates
  for all
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists protocol_template_items_founder_all on public.protocol_template_items;
create policy protocol_template_items_founder_all on public.protocol_template_items
  for all
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

-- ── Seed: flexible PLACEHOLDER samples only ─────────────────────────────────
--
-- These are deliberately generic starting points, not Vital Kauaʻi's operating
-- protocol. Each is named "Sample · …" and described as a placeholder. Founders
-- edit or replace them with the real protocol. Seeds are idempotent (keyed by
-- name) so re-running the migration never duplicates them.

do $$
declare
  tid uuid;
begin
  -- Sample · 7-Day Private Protocol --------------------------------------------
  if not exists (select 1 from public.protocol_templates where name = 'Sample · 7-Day Private Protocol') then
    insert into public.protocol_templates (name, description, kind, duration_days)
    values (
      'Sample · 7-Day Private Protocol',
      'Placeholder starting point — replace the blocks with your protocol. Day offsets are relative to the journey arrival date.',
      'private', 7
    )
    returning id into tid;

    insert into public.protocol_template_items (template_id, day_offset, title, category, start_time, end_time, sort_order) values
      (tid, 0, 'Arrival & settle in',     'transport',   '14:00', '16:00', 0),
      (tid, 0, 'Welcome dinner',          'meal',        '18:00', '19:30', 1),
      (tid, 1, 'Morning yoga',            'yoga',        '08:00', '09:00', 0),
      (tid, 1, 'Breakfast',               'meal',        '09:00', '10:00', 1),
      (tid, 1, 'Intention setting',       'integration', '11:00', '12:30', 2),
      (tid, 2, 'Rest & preparation',      'rest',        '10:00', '12:00', 0),
      (tid, 2, 'Ceremony',                'ceremony',    '18:00', '23:00', 1),
      (tid, 3, 'Integration circle',      'integration', '10:00', '12:00', 0),
      (tid, 3, 'Bodywork',                'bodywork',    '14:00', '15:00', 1),
      (tid, 4, 'Guided hike',             'hike',        '09:00', '12:00', 0),
      (tid, 4, 'Integration circle',      'integration', '16:00', '17:30', 1),
      (tid, 5, 'Rest & preparation',      'rest',        '10:00', '12:00', 0),
      (tid, 5, 'Ceremony',                'ceremony',    '18:00', '23:00', 1),
      (tid, 6, 'Closing integration',     'integration', '10:00', '12:00', 0),
      (tid, 6, 'Departure preparation',   'admin',       '13:00', '14:00', 1);
  end if;

  -- Sample · 8-Day Cohort Protocol ---------------------------------------------
  if not exists (select 1 from public.protocol_templates where name = 'Sample · 8-Day Cohort Protocol') then
    insert into public.protocol_templates (name, description, kind, duration_days)
    values (
      'Sample · 8-Day Cohort Protocol',
      'Placeholder starting point for group journeys — replace the blocks with your protocol.',
      'cohort', 8
    )
    returning id into tid;

    insert into public.protocol_template_items (template_id, day_offset, title, category, start_time, end_time, sort_order) values
      (tid, 0, 'Arrivals & orientation',  'admin',       '15:00', '17:00', 0),
      (tid, 0, 'Group welcome dinner',    'meal',        '18:30', '20:00', 1),
      (tid, 1, 'Morning movement',        'yoga',        '08:00', '09:00', 0),
      (tid, 1, 'Group intention circle',  'integration', '10:30', '12:00', 1),
      (tid, 2, 'Sound journey',           'sound',       '10:00', '11:00', 0),
      (tid, 3, 'Rest & preparation',      'rest',        '10:00', '12:00', 0),
      (tid, 3, 'Group ceremony',          'ceremony',    '18:00', '23:00', 1),
      (tid, 4, 'Integration circle',      'integration', '10:00', '12:00', 0),
      (tid, 5, 'Guided hike',             'hike',        '09:00', '12:00', 0),
      (tid, 6, 'Group ceremony',          'ceremony',    '18:00', '23:00', 0),
      (tid, 7, 'Closing circle',          'integration', '10:00', '12:00', 0),
      (tid, 7, 'Departures',              'transport',   '13:00', '15:00', 1);
  end if;

  -- Sample · Ceremony Day ------------------------------------------------------
  if not exists (select 1 from public.protocol_templates where name = 'Sample · Ceremony Day') then
    insert into public.protocol_templates (name, description, kind, duration_days)
    values (
      'Sample · Ceremony Day',
      'Placeholder single-day template — apply onto any day of a journey and adjust.',
      'day', 1
    )
    returning id into tid;

    insert into public.protocol_template_items (template_id, day_offset, title, category, start_time, end_time, is_private, sort_order) values
      (tid, 0, 'Light breakfast',     'meal',     '08:00', '08:45', false, 0),
      (tid, 0, 'Rest & preparation',  'rest',     '12:00', '16:00', false, 1),
      (tid, 0, 'Nurse check-in',      'medical',  '16:30', '17:00', true,  2),
      (tid, 0, 'Ceremony',            'ceremony', '18:00', '23:00', false, 3),
      (tid, 0, 'Overnight sitter',    'sitter',   '23:00', '23:59', true,  4);
  end if;

  -- Sample · Integration Day ---------------------------------------------------
  if not exists (select 1 from public.protocol_templates where name = 'Sample · Integration Day') then
    insert into public.protocol_templates (name, description, kind, duration_days)
    values (
      'Sample · Integration Day',
      'Placeholder single-day template for the day(s) after ceremony.',
      'day', 1
    )
    returning id into tid;

    insert into public.protocol_template_items (template_id, day_offset, title, category, start_time, end_time, sort_order) values
      (tid, 0, 'Gentle yoga',         'yoga',        '08:30', '09:15', 0),
      (tid, 0, 'Breakfast',           'meal',        '09:30', '10:30', 1),
      (tid, 0, 'Integration circle',  'integration', '11:00', '12:30', 2),
      (tid, 0, 'Rest',                'rest',        '13:00', '15:00', 3),
      (tid, 0, 'Bodywork',            'bodywork',    '15:30', '16:30', 4);
  end if;
end $$;
