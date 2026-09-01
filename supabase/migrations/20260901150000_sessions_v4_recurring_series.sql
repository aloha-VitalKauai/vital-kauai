-- Sessions V4 — recurring post-integration series (Build 1 of 4, foundation).
-- No UI, no Calendly wiring, no SMS yet; this migration only creates the
-- persistence layer for weekly recurring coaching sessions.
--
-- The lifecycle this supports: a member is granted 10 coaching sessions
-- (unchanged — see sessions_default_program_grant). The first sessions are
-- used through preparation and ceremony. Once the member enters
-- post-integration, the booking card converts to "Set My Weekly Time": the
-- member books ONE Calendly session (the anchor), and Build 2 creates the
-- remaining weekly occurrences from it. The series covers exactly the
-- member's remaining coaching allowance at that moment — expected 6, but
-- taken from the ledger, never assumed.
--
-- Shape and conventions follow the sessions foundation
-- (20260825235000_sessions_v1_foundation.sql):
--   * member_id references public.member_profiles(id), which IS auth.uid()
--   * founders write, members read their own rows, service_role bypasses
--   * updated_at maintained by a table-local trigger
--   * derived values are never stored: "sessions remaining", the weekly
--     rhythm (weekday + time), and "next session" are all computed on read
--     from first_session_at + timezone + the occurrence rows.
--
-- One new table, deliberately:
--
--   session_series — the recurring-series parent. One row per conversion:
--                    who, which journey, the anchor booking, the first
--                    occurrence instant, the timezone the member booked in,
--                    and how many sessions the series covers.
--
-- Individual occurrences stay ordinary session_bookings rows — the series
-- adds a nullable series_id to them rather than a parallel appointments
-- table, so every existing surface (balance math, webhook dedup, founder
-- tracker) keeps working unchanged.
--
-- session_bookings also gains:
--   meeting_url      — the canonical join link for that occurrence, captured
--                      from Calendly in Build 2. One session, one URL.
--   reminder_sent_at — day-of SMS dedup stamp (Build 4), the same
--                      null-until-sent convention as member_checkins.sent_at.
--
-- And two small widenings:
--   session_bookings.status gains 'needs_scheduling' — an occurrence whose
--     week could not be booked (slot unavailable, or the member canceled just
--     that week). It preserves the rest of the series and marks only that
--     occurrence; it never counts against the allowance.
--   session_booking_holds.purpose distinguishes an ordinary single booking
--     from a "Set My Weekly Time" anchor, so the webhook (Build 2) knows
--     which bookings convert into a series.

-- ── the series parent ───────────────────────────────────────────────────────

create table if not exists public.session_series (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.member_profiles(id) on delete cascade,
  journey_id        uuid references public.journeys(id) on delete set null,
  session_type      text not null check (session_type in ('coaching', 'pne')),
  anchor_booking_id uuid references public.session_bookings(id) on delete set null,
  first_session_at  timestamptz not null,
  -- IANA zone the member booked in (from the Calendly payload). Weekly
  -- recurrence is wall-clock time in THIS zone — never naive +7-day
  -- timestamp arithmetic, which drifts across DST for mainland members.
  timezone          text not null default 'Pacific/Honolulu',
  -- Snapshot of the member's remaining allowance at conversion, anchor
  -- included. A decision record (how many sessions this series covers),
  -- not a derived value; Build 2 caps creation at the live ledger balance.
  planned_sessions  integer not null check (planned_sessions > 0),
  status            text not null default 'active'
    check (status in ('active', 'completed', 'canceled')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One active weekly rhythm per member per session type. Doubles as the
-- idempotency backstop: a replayed anchor webhook cannot create two series.
create unique index if not exists session_series_active_member_type_key
  on public.session_series (member_id, session_type)
  where status = 'active';

create index if not exists session_series_journey_idx
  on public.session_series (journey_id)
  where journey_id is not null;

create or replace function public.session_series_set_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists session_series_set_updated_at on public.session_series;
create trigger session_series_set_updated_at
  before update on public.session_series
  for each row execute function public.session_series_set_updated_at();

-- ── occurrences: existing session_bookings become series-aware ──────────────

alter table public.session_bookings
  add column if not exists series_id uuid references public.session_series(id) on delete set null;
alter table public.session_bookings
  add column if not exists meeting_url text;
alter table public.session_bookings
  add column if not exists reminder_sent_at timestamptz;

-- 'needs_scheduling': the one-occurrence failure state. The row keeps its
-- place in the series without counting against the allowance and without
-- pretending to be booked.
alter table public.session_bookings
  drop constraint if exists session_bookings_status_check;
alter table public.session_bookings
  add constraint session_bookings_status_check
  check (status in ('scheduled', 'completed', 'canceled', 'no_show', 'needs_scheduling'));

-- Series reads: "occurrences of this series, in order".
create index if not exists session_bookings_series_idx
  on public.session_bookings (series_id, scheduled_at)
  where series_id is not null;

-- Build 4's reminder sweep: "which scheduled sessions have not been texted?"
-- Same shape as member_checkins_due_idx.
create index if not exists session_bookings_reminder_due_idx
  on public.session_bookings (scheduled_at)
  where status = 'scheduled' and reminder_sent_at is null;

-- ── holds: record the member's intent at link-minting time ──────────────────

alter table public.session_booking_holds
  add column if not exists purpose text not null default 'single';
alter table public.session_booking_holds
  drop constraint if exists session_booking_holds_purpose_check;
alter table public.session_booking_holds
  add constraint session_booking_holds_purpose_check
  check (purpose in ('single', 'series_anchor'));

-- ── grants ──────────────────────────────────────────────────────────────────
-- Supabase default privileges would grant these anyway; explicit so the local
-- test harness matches production exactly. RLS below is the real gate.

grant select, insert, update, delete
  on public.session_series
  to authenticated;
grant all
  on public.session_series
  to service_role;

-- ── row level security ──────────────────────────────────────────────────────
-- Members read their own series (the portal card). All writes arrive via
-- founders or the service role (webhook processor, Build 2 fan-out) —
-- members never write.

alter table public.session_series enable row level security;

drop policy if exists session_series_founder_all on public.session_series;
create policy session_series_founder_all on public.session_series
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists session_series_member_read_own on public.session_series;
create policy session_series_member_read_own on public.session_series
  for select to authenticated
  using (member_id = auth.uid());

drop policy if exists session_series_service_all on public.session_series;
create policy session_series_service_all on public.session_series
  for all to service_role
  using (true)
  with check (true);
