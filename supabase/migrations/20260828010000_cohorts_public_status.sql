-- Founder-editable public status for a ceremony.
--
-- The label on the public ceremony cards ("Open", "Filling Now", "Full") was
-- derived in lib/cohorts.ts from capacity vs. assigned members, with two
-- hardcoded date lists layered on top. That put the words on the website in a
-- deploy while the ceremony they describe lived here, so every status change
-- was an engineering task and the two could drift.
--
-- This moves the decision to the ceremony. 'auto' keeps today's behaviour —
-- derive from capacity — and is the right default for a ceremony nobody has
-- thought about yet. The other three are deliberate founder overrides.
--
-- Selling out still wins over 'open' and 'filling' in lib/cohorts.ts: a
-- ceremony at capacity reads Full whatever this column says, so a forgotten
-- override cannot advertise spots that do not exist.
--
-- Reversal: drop the column, then restore get_public_cohorts() to its previous
-- definition (the version without public_status, preserved in git history).

-- ── 1. The column ────────────────────────────────────────────────────────
-- CHECK rather than free text: a typo must not be able to reach the site.
alter table public.cohorts
  add column if not exists public_status text not null default 'auto';

alter table public.cohorts
  drop constraint if exists cohorts_public_status_check;

alter table public.cohorts
  add constraint cohorts_public_status_check
  check (public_status in ('auto', 'open', 'filling', 'full'));

comment on column public.cohorts.public_status is
  'Public ceremony-card label. auto = derive from capacity (default); open, '
  'filling, full = founder override. A cohort at capacity displays as Full '
  'regardless, so an override can never advertise unavailable spots.';

-- ── 2. Backfill the two cohorts that carried hardcoded overrides ─────────
-- These were the FORCED_FULL_START_DATES / FILLING_START_DATES entries the
-- code is dropping in the same PR, so the public site is unchanged by this
-- migration: the mechanism moves, the labels do not.
update public.cohorts
set public_status = 'full', updated_at = now()
where start_at = '2026-10-02 22:00:00+00'::timestamptz
  and public_status = 'auto';

update public.cohorts
set public_status = 'filling', updated_at = now()
where start_at = '2026-11-03 22:00:00+00'::timestamptz
  and public_status = 'auto';

-- ── 3. Publish it through the existing public RPC ────────────────────────
-- Same SECURITY DEFINER, same search_path, same filters (public, scheduled,
-- not yet past) and same ordering. The only change is the added column.
--
-- Dropped and recreated rather than replaced: CREATE OR REPLACE cannot change
-- a function's OUT columns. The grants are restored explicitly below, since
-- the drop takes them with it — anon and authenticated must keep EXECUTE or
-- the public ceremony cards go blank.
drop function if exists public.get_public_cohorts();

create function public.get_public_cohorts()
returns table (
  id uuid,
  title text,
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  capacity integer,
  assigned_count bigint,
  public_status text
)
language sql
security definer
set search_path to 'public'
as $function$
  select
    c.id,
    c.title,
    c.start_at,
    c.end_at,
    c.capacity,
    coalesce((
      select count(*)
      from journeys j
      where j.cohort_id = c.id
        and j.status not in ('canceled', 'completed')
    ), 0) as assigned_count,
    c.public_status
  from cohorts c
  where c.is_public = true
    and c.status = 'scheduled'
    and coalesce(c.end_at, c.start_at) >= now()
  order by c.start_at;
$function$;

grant execute on function public.get_public_cohorts() to anon, authenticated, service_role;
