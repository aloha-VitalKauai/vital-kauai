-- Weekly Member Check-Ins — Build 1 of 3 (foundation). No UI, no SMS, no
-- scheduler; this migration only creates the persistence layer.
--
-- Shape and conventions follow the sessions foundation
-- (20260825235000_sessions_v1_foundation.sql):
--   * member_id references public.member_profiles(id), which IS auth.uid()
--   * founders write, members read their own rows, service_role bypasses
--   * updated_at maintained by a table-local trigger
--
-- Two tables, deliberately:
--
--   checkin_templates  — the question set for one week, versioned. Editing a
--                        live question set means inserting a NEW version row,
--                        never rewriting history.
--   member_checkins    — one row per (journey, week). Carries scheduling
--                        state, the member's answers as jsonb, AND a frozen
--                        copy of the questions that were actually presented.
--
-- Answers live on member_checkins.responses rather than in a third table:
-- a check-in is a handful of answers read as one unit, and member_journals
-- already establishes `responses jsonb` as this repo's shape for that.
--
-- questions_snapshot is what makes the answers durable. template_id records
-- WHICH set was used; the snapshot records what it SAID at the moment it was
-- presented, so a later template version can never silently re-label an
-- answer a member already gave.

-- ── templates: one active question set per week, versioned ──────────────────

create table if not exists public.checkin_templates (
  id          uuid primary key default gen_random_uuid(),
  week_number integer not null check (week_number between 1 and 13),
  version     integer not null default 1 check (version >= 1),
  -- [{ key, label, type, ...}] — validated in application code, not here, so
  -- the question format can change without a migration.
  questions   jsonb not null default '[]'::jsonb
    check (jsonb_typeof(questions) = 'array'),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint checkin_templates_week_version_key unique (week_number, version)
);

-- At most one active template per week: the scheduler (Build 3) must never
-- have to choose between two.
create unique index if not exists checkin_templates_active_week_key
  on public.checkin_templates (week_number)
  where active;

-- ── member check-ins: one row per journey week ──────────────────────────────

create table if not exists public.member_checkins (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.member_profiles(id) on delete cascade,
  journey_id         uuid not null references public.journeys(id) on delete cascade,
  week_number        integer not null check (week_number between 1 and 13),
  template_id        uuid not null references public.checkin_templates(id) on delete restrict,
  -- Frozen copy of checkin_templates.questions as presented to this member.
  questions_snapshot jsonb not null
    check (jsonb_typeof(questions_snapshot) = 'array'),
  responses          jsonb not null default '{}'::jsonb
    check (jsonb_typeof(responses) = 'object'),
  scheduled_at       timestamptz not null,
  sent_at            timestamptz,
  submitted_at       timestamptz,
  status             text not null default 'scheduled'
    check (status in ('scheduled', 'sent', 'submitted', 'skipped')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint member_checkins_journey_week_key unique (journey_id, week_number),
  -- Status and timestamps cannot disagree: "submitted" always has a
  -- submitted_at, and a submitted_at always reads as submitted.
  constraint member_checkins_submitted_consistent
    check ((status = 'submitted') = (submitted_at is not null))
);

create index if not exists member_checkins_member_week_idx
  on public.member_checkins (member_id, week_number);

create index if not exists member_checkins_journey_idx
  on public.member_checkins (journey_id, week_number);

-- Build 3's scheduler sweep: "which check-ins are due and not yet sent?"
create index if not exists member_checkins_due_idx
  on public.member_checkins (scheduled_at)
  where status = 'scheduled';

create or replace function public.checkins_set_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists checkin_templates_set_updated_at on public.checkin_templates;
create trigger checkin_templates_set_updated_at
  before update on public.checkin_templates
  for each row execute function public.checkins_set_updated_at();

drop trigger if exists member_checkins_set_updated_at on public.member_checkins;
create trigger member_checkins_set_updated_at
  before update on public.member_checkins
  for each row execute function public.checkins_set_updated_at();

-- ── grants ──────────────────────────────────────────────────────────────────
-- Supabase default privileges would grant these anyway; explicit so the local
-- test harness matches production exactly. RLS below is the real gate.

grant select, insert, update, delete
  on public.checkin_templates, public.member_checkins
  to authenticated;
grant all
  on public.checkin_templates, public.member_checkins
  to service_role;

-- ── row level security ──────────────────────────────────────────────────────
-- Members read their own check-ins. Every write in Builds 1-3 arrives from a
-- founder or from the service role (the scheduler, and the tokened submit
-- route in Build 2) — members never write through an authenticated session.

alter table public.checkin_templates enable row level security;
alter table public.member_checkins enable row level security;

drop policy if exists checkin_templates_founder_all on public.checkin_templates;
create policy checkin_templates_founder_all on public.checkin_templates
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists checkin_templates_service_all on public.checkin_templates;
create policy checkin_templates_service_all on public.checkin_templates
  for all to service_role
  using (true)
  with check (true);

drop policy if exists member_checkins_founder_all on public.member_checkins;
create policy member_checkins_founder_all on public.member_checkins
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists member_checkins_member_read_own on public.member_checkins;
create policy member_checkins_member_read_own on public.member_checkins
  for select to authenticated
  using (member_id = auth.uid());

drop policy if exists member_checkins_service_all on public.member_checkins;
create policy member_checkins_service_all on public.member_checkins
  for all to service_role
  using (true)
  with check (true);

-- ── seed: weeks 1-13, version 1 ─────────────────────────────────────────────
-- Placeholder questions. The real wording is designed later; a new version
-- row per week replaces these, leaving already-submitted answers intact.

insert into public.checkin_templates (week_number, version, questions, active)
select
  w,
  1,
  jsonb_build_array(
    jsonb_build_object(
      'key', 'overall',
      'type', 'scale',
      'label', 'How has this week been overall?',
      'min', 1,
      'max', 5,
      'required', true),
    jsonb_build_object(
      'key', 'body',
      'type', 'scale',
      'label', 'How is your body feeling?',
      'min', 1,
      'max', 5,
      'required', true),
    jsonb_build_object(
      'key', 'notes',
      'type', 'text',
      'label', 'Anything you would like your care team to know?',
      'required', false)
  ),
  true
from generate_series(1, 13) as w
on conflict on constraint checkin_templates_week_version_key do nothing;
