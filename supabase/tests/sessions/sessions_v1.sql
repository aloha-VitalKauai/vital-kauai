-- Sessions V1 (Build 1) — structure, balance math, and RLS proof.
-- Runs against a FRESH local database: _local_bootstrap.sql + the sessions
-- migration only (see run_sessions.sh). Never against production.
--
-- pg_temp.remaining() below is EXACTLY the derivation lib/sessions/balance.ts
-- performs: sum of allowance ledger rows minus counting bookings. These tests
-- prove the database can answer "how many sessions does this member have
-- left?" from history-preserving records, and that RLS confines each member
-- to their own rows.

begin;
create extension if not exists pgtap;
select plan(27);

-- ── structure ───────────────────────────────────────────────────────────────

select has_table('public', 'member_session_allowances', 'member_session_allowances exists');
select has_table('public', 'session_bookings', 'session_bookings exists');
select has_table('public', 'calendly_event_mappings', 'calendly_event_mappings exists');

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where relname in ('member_session_allowances', 'session_bookings', 'calendly_event_mappings')),
  'RLS is enabled on all three sessions tables');

select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public'
      and indexname = 'session_bookings_invitee_uri_key'
      and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'),
  1,
  'partial unique index on calendly_invitee_uri exists (webhook replay backstop)');

select throws_ok(
  $$insert into public.member_session_allowances (member_id, session_type, quantity)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 0)$$,
  '23514', null,
  'a zero-quantity allowance row is rejected');

select throws_ok(
  $$insert into public.session_bookings (member_id, session_type, needs_review)
    values (null, 'coaching', false)$$,
  '23514', null,
  'a memberless booking must be flagged needs_review');

-- ── seeds: two members and a founder ────────────────────────────────────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local'),
  ('ffffffff-0000-4000-8000-000000000003', 'founder@test.local');
insert into public.member_profiles (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local');
insert into public.user_roles (user_id, role) values
  ('ffffffff-0000-4000-8000-000000000003', 'founder');

-- The same derivation lib/sessions/balance.ts performs.
create function pg_temp.remaining(p_member uuid, p_type text) returns int
language sql as $$
  select coalesce((select sum(quantity)::int from public.member_session_allowances
                    where member_id = p_member and session_type = p_type), 0)
       - (select count(*)::int from public.session_bookings
           where member_id = p_member and session_type = p_type
             and counts_against_allowance)
$$;

-- ── balance math (program grants: A gets 10 coaching + 6 pne; B gets 10) ────

insert into public.member_session_allowances (member_id, session_type, quantity, reason) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 10, 'program'),
  ('aaaaaaaa-0000-4000-8000-000000000001', 'pne',       6, 'program'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'coaching', 10, 'program');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 10,
  'fresh member with 10 coaching granted → 10 remaining');
select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'pne'), 6,
  'fresh member with 6 pne granted → 6 remaining');

insert into public.session_bookings (member_id, session_type) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 9,
  'one counting coaching booking → 9 remaining');

insert into public.session_bookings (member_id, session_type, calendly_event_uri, calendly_invitee_uri) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching',
   'https://api.calendly.com/scheduled_events/EV1',
   'https://api.calendly.com/scheduled_events/EV1/invitees/INV1');
insert into public.session_bookings (member_id, session_type) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 7,
  'three counting coaching bookings → 7 remaining');

-- A canceled booking stays as history but stops counting: the session returns.
insert into public.session_bookings (member_id, session_type, status, counts_against_allowance, canceled_at) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 'canceled', false, now());

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 7,
  'a canceled (non-counting) booking does not reduce the balance');
select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'pne'), 6,
  'coaching activity leaves the pne balance untouched');

insert into public.session_bookings (member_id, session_type) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'pne');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'pne'), 5,
  'one counting pne booking → 5 pne remaining');
select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 7,
  'pne activity leaves the coaching balance untouched');

select throws_ok(
  $$insert into public.session_bookings (member_id, session_type, calendly_invitee_uri)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching',
            'https://api.calendly.com/scheduled_events/EV1/invitees/INV1')$$,
  '23505', null,
  'a replayed Calendly invitee URI cannot create a second deduction');

-- ── founder adjustment (as the founder, through RLS) ────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);

select lives_ok(
  $$insert into public.member_session_allowances (member_id, session_type, quantity, reason, created_by)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 1, 'founder adjustment',
            'ffffffff-0000-4000-8000-000000000003')$$,
  'a founder can add a +1 adjustment through RLS');

reset role;

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 8,
  '+1 founder adjustment → 11 granted − 3 counting = 8 remaining');

-- ── RLS: member A sees and computes only their own data ─────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

select is((select count(*)::int from public.member_session_allowances), 3,
  'member A sees exactly their own 3 allowance rows');

select is(
  coalesce((select sum(quantity)::int from public.member_session_allowances
             where member_id = auth.uid() and session_type = 'coaching'), 0)
  - (select count(*)::int from public.session_bookings
      where member_id = auth.uid() and session_type = 'coaching'
        and counts_against_allowance),
  8,
  'member A computes their own coaching balance under RLS: 8');

reset role;

-- ── RLS: member B cannot see or touch member A's data ───────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);

select is((select count(*)::int from public.member_session_allowances), 1,
  'member B sees only their own single allowance row');
select is(
  (select count(*)::int from public.member_session_allowances
    where member_id <> 'bbbbbbbb-0000-4000-8000-000000000002'), 0,
  'none of member A''s allowance rows are visible to member B');
select is((select count(*)::int from public.session_bookings), 0,
  'none of member A''s bookings are visible to member B');

select throws_ok(
  $$insert into public.member_session_allowances (member_id, session_type, quantity)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'coaching', 99)$$,
  '42501', null,
  'a member cannot self-grant sessions (no insert policy)');

-- No UPDATE policy for members: this statement matches zero rows under RLS.
update public.session_bookings set status = 'no_show'
  where member_id = 'aaaaaaaa-0000-4000-8000-000000000001';

reset role;

select is((select count(*)::int from public.session_bookings where status = 'no_show'), 0,
  'member B''s attempted update of A''s bookings changed nothing');

-- ── RLS: founder and service role see everything ────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);

select is((select count(*)::int from public.member_session_allowances), 4,
  'the founder sees all allowance rows across members');

reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role service_role;

select is((select count(*)::int from public.member_session_allowances), 4,
  'service_role sees all allowance rows');

reset role;

select * from finish();
rollback;
