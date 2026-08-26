-- Sessions V1 — Build 1 of 3 (foundation). No UI, no Calendly wiring yet.
--
-- Members are granted session allowances (Vital Coaching / PNE) by their
-- program or by a founder adjustment. The remaining balance is NEVER stored;
-- it is derived on every read as
--
--     remaining = sum(member_session_allowances.quantity)
--               - count(session_bookings where counts_against_allowance)
--
-- so cancellations, reschedules and adjustments can never drift a counter.
-- Allowance rows are an append-only ledger: corrections are compensating rows
-- (e.g. a +1 founder adjustment), never edits of history.
--
-- Calendly is the scheduling surface (Build 2 wires the webhook). Webhook
-- dedup + audit reuses the existing public.webhook_receipts table (unique
-- idempotency_key) — deliberately NO new integration-events table here.
--
-- member_id references public.member_profiles(id), which IS auth.uid() —
-- the same convention as journeys and scheduling_requests. journey_id is
-- optional context only: the session system belongs to the member, not to
-- one specific enrollment.

-- ── allowances: append-only ledger of session grants ────────────────────────

create table if not exists public.member_session_allowances (
  id           uuid primary key default gen_random_uuid(),
  member_id    uuid not null references public.member_profiles(id) on delete cascade,
  journey_id   uuid references public.journeys(id) on delete set null,
  session_type text not null check (session_type in ('coaching', 'pne')),
  quantity     integer not null check (quantity <> 0),
  reason       text not null default 'program',
  note         text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz not null default now()
);

create index if not exists member_session_allowances_member_type_idx
  on public.member_session_allowances (member_id, session_type);

-- ── bookings: one row per Calendly appointment ──────────────────────────────
-- member_id is nullable: a webhook booking whose invitee email matches no
-- member is parked with needs_review = true and never touches any balance.

create table if not exists public.session_bookings (
  id                       uuid primary key default gen_random_uuid(),
  member_id                uuid references public.member_profiles(id) on delete cascade,
  journey_id               uuid references public.journeys(id) on delete set null,
  session_type             text not null check (session_type in ('coaching', 'pne')),
  calendly_event_uri       text,
  calendly_invitee_uri     text,
  invitee_email            text,
  invitee_name             text,
  scheduled_at             timestamptz,
  status                   text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'canceled', 'no_show')),
  counts_against_allowance boolean not null default true,
  needs_review             boolean not null default false,
  canceled_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint session_bookings_member_or_review
    check (member_id is not null or needs_review)
);

-- One Calendly invitee = one booking row, enforced at the database so a
-- replayed webhook can never create a second deduction.
create unique index if not exists session_bookings_invitee_uri_key
  on public.session_bookings (calendly_invitee_uri)
  where calendly_invitee_uri is not null;

create index if not exists session_bookings_member_counting_idx
  on public.session_bookings (member_id, session_type)
  where counts_against_allowance;

create index if not exists session_bookings_needs_review_idx
  on public.session_bookings (created_at desc)
  where needs_review;

create or replace function public.session_bookings_set_updated_at() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists session_bookings_set_updated_at on public.session_bookings;
create trigger session_bookings_set_updated_at
  before update on public.session_bookings
  for each row execute function public.session_bookings_set_updated_at();

-- ── calendly event mappings: which event type means coaching vs pne ─────────
-- Seeded in Build 2 when the webhook is wired; empty in Build 1.

create table if not exists public.calendly_event_mappings (
  id                      uuid primary key default gen_random_uuid(),
  calendly_event_type_uri text not null unique,
  session_type            text not null check (session_type in ('coaching', 'pne')),
  label                   text,
  active                  boolean not null default true,
  created_at              timestamptz not null default now()
);

-- ── grants ──────────────────────────────────────────────────────────────────
-- Supabase default privileges would grant these anyway; explicit so the local
-- test harness matches production exactly. RLS below is the real gate.

grant select, insert, update, delete
  on public.member_session_allowances, public.session_bookings, public.calendly_event_mappings
  to authenticated;
grant all
  on public.member_session_allowances, public.session_bookings, public.calendly_event_mappings
  to service_role;

-- ── row level security ──────────────────────────────────────────────────────
-- Members read their own rows only (the portal balance). All writes arrive
-- via founders or the service role (webhook processor) — members never write.

alter table public.member_session_allowances enable row level security;
alter table public.session_bookings enable row level security;
alter table public.calendly_event_mappings enable row level security;

drop policy if exists member_session_allowances_founder_all on public.member_session_allowances;
create policy member_session_allowances_founder_all on public.member_session_allowances
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists member_session_allowances_member_read_own on public.member_session_allowances;
create policy member_session_allowances_member_read_own on public.member_session_allowances
  for select to authenticated
  using (member_id = auth.uid());

drop policy if exists member_session_allowances_service_all on public.member_session_allowances;
create policy member_session_allowances_service_all on public.member_session_allowances
  for all to service_role
  using (true)
  with check (true);

drop policy if exists session_bookings_founder_all on public.session_bookings;
create policy session_bookings_founder_all on public.session_bookings
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists session_bookings_member_read_own on public.session_bookings;
create policy session_bookings_member_read_own on public.session_bookings
  for select to authenticated
  using (member_id = auth.uid());

drop policy if exists session_bookings_service_all on public.session_bookings;
create policy session_bookings_service_all on public.session_bookings
  for all to service_role
  using (true)
  with check (true);

-- Mappings are integration config: founders + service role only.
drop policy if exists calendly_event_mappings_founder_all on public.calendly_event_mappings;
create policy calendly_event_mappings_founder_all on public.calendly_event_mappings
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists calendly_event_mappings_service_all on public.calendly_event_mappings;
create policy calendly_event_mappings_service_all on public.calendly_event_mappings
  for all to service_role
  using (true)
  with check (true);
