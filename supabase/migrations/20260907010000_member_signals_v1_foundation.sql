-- Member Signals — Build 1 of 3 (foundation). No UI, no cron, no inference;
-- this migration only creates the persistence layer and the rules that make
-- a generated signal trustworthy.
--
-- What a signal is: one reading, at one moment, of how a member's integration
-- is going — trajectory direction, what changed this week, the evidence for
-- saying so, and an explicit flag when a human should reach out. Build 2 adds
-- the generator behind the existing cron pattern; Build 3 adds the founder UI.
--
-- Shape and conventions follow the check-ins foundation
-- (20260901010000_checkins_v1_foundation.sql):
--   * member_id references public.member_profiles(id), which IS auth.uid()
--   * founders read, service_role writes, members have no access at all
--   * week_number is the same 1-13 journey week the check-ins use
--
-- Three deliberate properties, all enforced here rather than in React:
--
--   1. SIGNALS ARE IMMUTABLE. A reading is a historical fact about what the
--      system believed on a given day. A later reading is a new row, never an
--      edit of the old one, so a flag can never be quietly rewritten away.
--
--   2. A FAILED READ IS NEVER A ZERO. status separates 'ok' from
--      'insufficient_data' and 'failed', and any status other than 'ok' is
--      constrained to trajectory 'unknown'. A run that could not read the
--      member's data cannot present itself as "steady".
--
--   3. ESCALATION IS EVIDENCED. escalate = true requires a stated reason and
--      at least one piece of quoted evidence. The system may raise a concern
--      to a human; it may never lower one, because acknowledgment is a
--      separate append-only record and never touches the signal itself.

-- ── journal consent, as a database rule ─────────────────────────────────────
-- Mirrors canCareTeamViewJournal() in lib/journal-sharing.ts: the care team
-- may read a member's journal only when the member personally opted in, or
-- when legacy compatibility access applies. Build 2's generator calls this
-- before a single journal entry enters a prompt, so consent is decided by
-- Postgres and not by whichever code path happens to assemble the inputs.
--
-- member_profiles.id is the auth user. The canonical members row is matched
-- on profile_id where it is set, and falls back to email — members.profile_id
-- is nullable and older rows carry only the address. Matching both ways means
-- a member whose profile link was never backfilled still has their privacy
-- choice honoured; an unmatched member reads as no consent.

create or replace function public.member_signal_journal_consent(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(bool_or(
    m.journal_sharing_enabled or m.legacy_journal_access_enabled
  ), false)
  from public.member_profiles mp
  join public.members m
    on m.profile_id = mp.id
    or (m.profile_id is null and lower(m.email) = lower(mp.email))
  where mp.id = p_member_id;
$$;

comment on function public.member_signal_journal_consent(uuid) is
  'True when the care team may read this member''s journal — personal opt-in or legacy compatibility access. The signal generator must call this before including any journal text.';

-- ── signals: one immutable reading per run ──────────────────────────────────

create table if not exists public.member_signals (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.member_profiles(id) on delete cascade,
  journey_id  uuid not null references public.journeys(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 13),

  -- Why this reading is or is not usable. 'insufficient_data' is an honest
  -- outcome, not a failure: a member who has submitted nothing yet has no
  -- trajectory to report.
  status text not null default 'ok'
    check (status in ('ok', 'insufficient_data', 'failed')),

  trajectory text not null default 'unknown'
    check (trajectory in ('improving', 'steady', 'declining', 'unknown')),

  -- One line naming what changed this week, and the fuller reading beneath it.
  headline text,
  summary  text,

  -- [{ source, ref, quote }] — the member's own words behind the reading, so
  -- a founder can judge the claim instead of trusting it. Validated in
  -- application code; the array shape is guaranteed here.
  evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence) = 'array'),

  escalate         boolean not null default false,
  escalation_reason text,

  -- What was actually read: {checkins, journal_entries, journal_consent, ...}.
  -- Makes an 'insufficient_data' verdict auditable after the fact.
  inputs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(inputs) = 'object'),

  -- Provenance. A reading is only reproducible if you know what produced it.
  model          text,
  prompt_version text,

  generated_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  -- Property 2: a run that did not read cleanly cannot claim a direction.
  constraint member_signals_failed_read_is_not_a_zero
    check (status = 'ok' or trajectory = 'unknown'),

  -- A usable reading says something. An empty 'ok' signal is a bug, not data.
  constraint member_signals_ok_is_substantive
    check (status <> 'ok' or (summary is not null and btrim(summary) <> '')),

  -- Property 3: raising a concern costs a reason and a quote.
  constraint member_signals_escalation_is_evidenced
    check (
      not escalate
      or (
        escalation_reason is not null
        and btrim(escalation_reason) <> ''
        and jsonb_array_length(evidence) > 0
      )
    )
);

-- The founder-facing sweep: newest reading per journey.
create index if not exists member_signals_journey_generated_idx
  on public.member_signals (journey_id, generated_at desc);

create index if not exists member_signals_member_generated_idx
  on public.member_signals (member_id, generated_at desc);

-- "Who needs a human right now?" — the only query the Build 3 UI runs hot.
create index if not exists member_signals_open_escalation_idx
  on public.member_signals (generated_at desc)
  where escalate;

-- Readings accumulate per journey week rather than being unique on it: a
-- re-run after a failure, and a correction of a bad reading, are both new
-- rows. Build 2 decides whether a fresh reading is warranted; the view below
-- decides which one is current.
create index if not exists member_signals_journey_week_idx
  on public.member_signals (journey_id, week_number, generated_at desc);

comment on table public.member_signals is
  'Immutable per-member integration readings. Never UPDATE or DELETE: a corrected reading is a new row.';

-- ── acknowledgments: what the human did about it ────────────────────────────
-- Separate table precisely so acknowledging a flag cannot mutate the flag.
-- The signal records what the system saw; this records what a founder did.

create table if not exists public.member_signal_acknowledgments (
  id        uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.member_signals(id) on delete cascade,

  -- The founder acting. Not FK'd to member_profiles: founders are auth users
  -- and need not carry a member profile row.
  acknowledged_by uuid not null default auth.uid(),

  disposition text not null
    check (disposition in ('reviewed', 'reaching_out', 'contacted', 'no_action_needed')),

  note text,

  created_at timestamptz not null default now(),

  -- Closing a flag as needing nothing is a judgement, and a judgement is
  -- written down.
  constraint member_signal_acks_no_action_needs_note
    check (
      disposition <> 'no_action_needed'
      or (note is not null and btrim(note) <> '')
    )
);

create index if not exists member_signal_acks_signal_idx
  on public.member_signal_acknowledgments (signal_id, created_at desc);

comment on table public.member_signal_acknowledgments is
  'Append-only record of founder disposition on a signal. Acknowledging never alters the signal it refers to.';

-- ── immutability, enforced ──────────────────────────────────────────────────
-- UPDATE is refused for every role, service_role included: the generator has
-- no legitimate reason to rewrite a past reading. DELETE is withheld by grant
-- and by the absence of a delete policy rather than by this trigger, so that
-- deleting a member still cascades their signals away — a member's right to
-- erasure outranks the audit trail.

create or replace function public.signals_refuse_update() returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception
    '% rows are immutable; insert a new row instead of updating %',
    tg_table_name, old.id
    using errcode = 'restrict_violation';
end;
$$;

drop trigger if exists member_signals_no_update on public.member_signals;
create trigger member_signals_no_update
  before update on public.member_signals
  for each row execute function public.signals_refuse_update();

drop trigger if exists member_signal_acks_no_update on public.member_signal_acknowledgments;
create trigger member_signal_acks_no_update
  before update on public.member_signal_acknowledgments
  for each row execute function public.signals_refuse_update();

-- ── the one definition of "current state" ───────────────────────────────────
-- Every surface reads this view. Nothing re-derives "needs attention" in a
-- route or a component, the same way no financial screen re-implements a
-- balance.

create or replace view public.v_member_signal_current
with (security_invoker = true)
as
select distinct on (s.journey_id)
  s.id           as signal_id,
  s.member_id,
  s.journey_id,
  s.week_number,
  s.status,
  s.trajectory,
  s.headline,
  s.summary,
  s.evidence,
  s.escalate,
  s.escalation_reason,
  s.inputs,
  s.model,
  s.prompt_version,
  s.generated_at,
  a.id          is not null as acknowledged,
  a.created_at   as acknowledged_at,
  a.acknowledged_by,
  a.disposition  as acknowledged_disposition,
  -- An open escalation is one no founder has picked up yet. This expression
  -- exists exactly once, here.
  (s.escalate and a.id is null) as needs_attention
from public.member_signals s
left join lateral (
  select ak.id, ak.created_at, ak.acknowledged_by, ak.disposition
  from public.member_signal_acknowledgments ak
  where ak.signal_id = s.id
  order by ak.created_at desc, ak.id desc
  limit 1
) a on true
-- One row per journey, and never two on a generated_at tie: id breaks it.
order by s.journey_id, s.generated_at desc, s.id desc;

comment on view public.v_member_signal_current is
  'Latest reading per journey, with its most recent founder disposition. needs_attention is defined here and nowhere else.';

-- ── grants ──────────────────────────────────────────────────────────────────
-- No UPDATE, no DELETE, for anyone. RLS below is the real gate.

grant select, insert on public.member_signals to authenticated;
grant select, insert on public.member_signal_acknowledgments to authenticated;
grant select on public.v_member_signal_current to authenticated;

grant select, insert on public.member_signals to service_role;
grant select, insert on public.member_signal_acknowledgments to service_role;
grant select on public.v_member_signal_current to service_role;

-- ── row level security ──────────────────────────────────────────────────────
-- Founders read signals; the generator (service_role) writes them. Members
-- have no policy at all: a signal is a care-team reading about a member, not
-- a message to them, and showing someone a machine's verdict on their own
-- integration without a human in between is not a thing we are going to do.

alter table public.member_signals enable row level security;
alter table public.member_signal_acknowledgments enable row level security;

drop policy if exists member_signals_founder_read on public.member_signals;
create policy member_signals_founder_read on public.member_signals
  for select to authenticated
  using (public.is_founder());

drop policy if exists member_signals_service_read on public.member_signals;
create policy member_signals_service_read on public.member_signals
  for select to service_role
  using (true);

drop policy if exists member_signals_service_insert on public.member_signals;
create policy member_signals_service_insert on public.member_signals
  for insert to service_role
  with check (true);

-- Founders acknowledge, and only ever as themselves.
drop policy if exists member_signal_acks_founder_read on public.member_signal_acknowledgments;
create policy member_signal_acks_founder_read on public.member_signal_acknowledgments
  for select to authenticated
  using (public.is_founder());

drop policy if exists member_signal_acks_founder_insert on public.member_signal_acknowledgments;
create policy member_signal_acks_founder_insert on public.member_signal_acknowledgments
  for insert to authenticated
  with check (public.is_founder() and acknowledged_by = auth.uid());

drop policy if exists member_signal_acks_service_read on public.member_signal_acknowledgments;
create policy member_signal_acks_service_read on public.member_signal_acknowledgments
  for select to service_role
  using (true);
