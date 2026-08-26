-- Sessions V1 — Build 2 of 3: atomic booking holds.
--
-- The double-booking problem: a member with 1 session left opens two tabs and
-- clicks Book twice. Both requests read "1 remaining" and both would issue a
-- Calendly link. The fix is the smallest atomic reservation possible:
--
--     1 remaining → reserve 1 (hold) → available becomes 0 → link issued
--     second attempt → 0 available → no second link
--
-- available = sum(allowance ledger) − counting bookings − ACTIVE holds,
-- where an active hold is unconsumed and unexpired. Expiry is a timestamp
-- predicate — an abandoned hold simply stops mattering after its window; no
-- scheduler, no cron. When the Calendly webhook records the real booking, the
-- member's oldest active hold is marked consumed.
--
-- acquire_session_hold() is the ONLY way holds are created. It serializes
-- concurrent attempts per (member, type) with a transaction-scoped advisory
-- lock, so two simultaneous requests cannot both see the last session free.
-- It is callable by service_role only (the booking endpoint) — never by
-- members directly.

create table if not exists public.session_booking_holds (
  id                     uuid primary key default gen_random_uuid(),
  member_id              uuid not null references public.member_profiles(id) on delete cascade,
  session_type           text not null check (session_type in ('coaching', 'pne')),
  expires_at             timestamptz not null,
  consumed_at            timestamptz,
  consumed_by_booking_id uuid references public.session_bookings(id) on delete set null,
  created_at             timestamptz not null default now()
);

create index if not exists session_booking_holds_active_idx
  on public.session_booking_holds (member_id, session_type)
  where consumed_at is null;

create or replace function public.acquire_session_hold(
  p_member uuid,
  p_session_type text,
  p_ttl_minutes integer default 15
) returns table (hold_id uuid, hold_expires_at timestamptz)
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_available integer;
begin
  if p_session_type not in ('coaching', 'pne') then
    raise exception 'acquire_session_hold: unknown session_type %', p_session_type;
  end if;

  -- Serialize concurrent attempts for this member + type. The lock releases
  -- automatically at transaction end; a second caller waits here, then sees
  -- the first caller's hold in the availability math below.
  perform pg_advisory_xact_lock(
    hashtextextended(p_member::text || ':' || p_session_type, 0)
  );

  -- Opportunistic hygiene: holds a full day past expiry are dead weight.
  -- (Expired holds are already excluded from the math; this just keeps the
  -- table tidy without needing a scheduled job.)
  delete from public.session_booking_holds
   where consumed_at is null
     and expires_at < now() - interval '1 day';

  select coalesce((select sum(a.quantity)::int
                     from public.member_session_allowances a
                    where a.member_id = p_member
                      and a.session_type = p_session_type), 0)
       - (select count(*)::int
            from public.session_bookings b
           where b.member_id = p_member
             and b.session_type = p_session_type
             and b.counts_against_allowance)
       - (select count(*)::int
            from public.session_booking_holds h
           where h.member_id = p_member
             and h.session_type = p_session_type
             and h.consumed_at is null
             and h.expires_at > now())
    into v_available;

  if v_available <= 0 then
    return;  -- empty set: nothing available to reserve
  end if;

  return query
    insert into public.session_booking_holds (member_id, session_type, expires_at)
    values (p_member, p_session_type, now() + make_interval(mins => p_ttl_minutes))
    returning id, expires_at;
end;
$$;

-- Members must not be able to mint holds client-side; the booking endpoint
-- (service role) is the only caller.
revoke all on function public.acquire_session_hold(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.acquire_session_hold(uuid, text, integer)
  to service_role;

-- ── grants + row level security (same posture as the Build 1 tables) ────────

grant select, insert, update, delete
  on public.session_booking_holds to authenticated;
grant all on public.session_booking_holds to service_role;

alter table public.session_booking_holds enable row level security;

drop policy if exists session_booking_holds_founder_all on public.session_booking_holds;
create policy session_booking_holds_founder_all on public.session_booking_holds
  for all to authenticated
  using (public.is_founder())
  with check (public.is_founder());

drop policy if exists session_booking_holds_member_read_own on public.session_booking_holds;
create policy session_booking_holds_member_read_own on public.session_booking_holds
  for select to authenticated
  using (member_id = auth.uid());

drop policy if exists session_booking_holds_service_all on public.session_booking_holds;
create policy session_booking_holds_service_all on public.session_booking_holds
  for all to service_role
  using (true)
  with check (true);
