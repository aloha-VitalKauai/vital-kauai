-- Internal Operations Calendar — scheduled client journeys + hourly events.
--
-- Powers the founder-only ops calendar at /dashboard/calendar. Two tables:
--
--   client_journeys  — one row per scheduled client stay. Spans
--                      start_date..end_date; every day in that span renders on
--                      the calendar as "Day N" for that client. A journey may
--                      link to a member (client_id -> public.members.id) or
--                      stand alone (client_id null) for someone not yet a
--                      member; display_name always carries a human label.
--
--   calendar_events  — hourly itinerary blocks within a journey (yoga, meals,
--                      ceremony, bodywork, nurse check-ins, sitter coverage,
--                      integration, rest, transport, …). event_date + start/
--                      end time place each block on the day timeline.
--
-- Additive and idempotent. No existing table, policy, or function is
-- modified. Nothing else in the app reads these tables yet, so applying on
-- production is safe without coordination.
--
-- Why members(id), not "clients": this repo's client roster lives in
-- public.members (the dashboard "Members" tab). There is no "clients" table.
-- client_id is nullable with ON DELETE SET NULL so removing a member never
-- erases ops/audit history — the journey survives with its display_name and
-- notes intact.
--
-- Category is intentionally free text (not a CHECK/enum) so the operating
-- vocabulary can grow without a schema migration; the app validates writes
-- against the recommended set (lib/calendar/types.ts). Recommended categories:
--   meal, yoga, ceremony, bodywork, acupuncture, hike, integration, medical,
--   sitter, rest, sound, transport, admin, other
--
-- RLS: founder-only for every operation, enforced at the DB layer via the
-- existing public.is_founder() (a user_roles lookup, role = 'founder').
-- Members and the anon key cannot read or write this internal calendar. The
-- API routes additionally gate on the founder allow-list at the app layer
-- (defense in depth).
--
-- Reversibility (migrations are forward-only; documented for manual rollback):
--   drop table if exists public.calendar_events;
--   drop table if exists public.client_journeys;
--   drop function if exists public.calendar_touch_updated_at();

-- ── Tables ──────────────────────────────────────────────────────────────────

create table if not exists public.client_journeys (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.members(id) on delete set null,
  display_name text not null,
  start_date   date not null,
  end_date     date not null,
  status       text not null default 'scheduled',
  color        text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint client_journeys_date_order check (end_date >= start_date)
);

create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  journey_id  uuid not null references public.client_journeys(id) on delete cascade,
  title       text not null,
  category    text not null,
  event_date  date not null,
  start_time  time not null,
  end_time    time not null,
  location    text,
  assigned_to text,
  notes       text,
  is_private  boolean not null default false,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint calendar_events_time_order check (end_time >= start_time)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists client_journeys_date_range_idx
  on public.client_journeys (start_date, end_date);
create index if not exists calendar_events_event_date_idx
  on public.calendar_events (event_date);
create index if not exists calendar_events_journey_idx
  on public.calendar_events (journey_id);
create index if not exists calendar_events_category_idx
  on public.calendar_events (category);

-- ── updated_at trigger (shared by both tables) ──────────────────────────────

create or replace function public.calendar_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists client_journeys_touch_updated_at on public.client_journeys;
create trigger client_journeys_touch_updated_at
  before update on public.client_journeys
  for each row execute function public.calendar_touch_updated_at();

drop trigger if exists calendar_events_touch_updated_at on public.calendar_events;
create trigger calendar_events_touch_updated_at
  before update on public.calendar_events
  for each row execute function public.calendar_touch_updated_at();

-- ── RLS: founder-only (select / insert / update / delete) ───────────────────

alter table public.client_journeys enable row level security;
alter table public.calendar_events enable row level security;

drop policy if exists client_journeys_founder_all on public.client_journeys;
create policy client_journeys_founder_all on public.client_journeys
  for all
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists calendar_events_founder_all on public.calendar_events;
create policy calendar_events_founder_all on public.calendar_events
  for all
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());
