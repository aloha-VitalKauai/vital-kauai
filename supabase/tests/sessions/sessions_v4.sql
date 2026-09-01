-- Sessions V4 (recurring post-integration series) — pgTAP suite.
--
-- Claims under test:
--   * session_series exists with RLS enabled and the series columns landed
--     on session_bookings and session_booking_holds;
--   * at most one ACTIVE series per member per session type — the webhook
--     replay backstop — while ended series never block a new one;
--   * the widened checks admit exactly the new values and nothing else;
--   * a needs_scheduling occurrence never touches the allowance balance;
--   * deleting a series releases its occurrences (series_id nulls out)
--     instead of destroying booking history;
--   * members read their own series and write nothing; founders and the
--     service role see everything.

begin;
create extension if not exists pgtap;
select plan(26);

-- ── structure ───────────────────────────────────────────────────────────────

select has_table('public', 'session_series', 'session_series exists');
select has_column('public', 'session_bookings', 'series_id',
  'session_bookings.series_id exists');
select has_column('public', 'session_bookings', 'meeting_url',
  'session_bookings.meeting_url exists');
select has_column('public', 'session_bookings', 'reminder_sent_at',
  'session_bookings.reminder_sent_at exists');
select has_column('public', 'session_booking_holds', 'purpose',
  'session_booking_holds.purpose exists');

select ok(
  (select relrowsecurity from pg_class where relname = 'session_series'),
  'RLS is enabled on session_series');

select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public'
      and indexname = 'session_series_active_member_type_key'
      and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'),
  1,
  'partial unique index on active (member, type) exists (anchor replay backstop)');

select is(
  (select count(*)::int from pg_indexes
    where schemaname = 'public'
      and indexname = 'session_bookings_reminder_due_idx'
      and indexdef like '%WHERE%'),
  1,
  'partial reminder-due index exists (Build 4 sweep)');

select is(
  (select count(*)::int from pg_trigger
    where tgname = 'session_series_set_updated_at'
      and tgrelid = 'public.session_series'::regclass),
  1,
  'updated_at trigger is installed on session_series');

-- ── seeds: two members and a founder ────────────────────────────────────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local'),
  ('ffffffff-0000-4000-8000-000000000003', 'founder@test.local');
insert into public.member_profiles (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local'),
  ('ffffffff-0000-4000-8000-000000000003', 'founder@test.local');
insert into public.user_roles (user_id, role) values
  ('ffffffff-0000-4000-8000-000000000003', 'founder');

insert into public.member_session_allowances (member_id, session_type, quantity, reason)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 6, 'program');

-- The same derivation lib/sessions/balance.ts performs.
create function pg_temp.remaining(p_member uuid, p_type text) returns int
language sql as $$
  select coalesce((select sum(quantity)::int from public.member_session_allowances
                    where member_id = p_member and session_type = p_type), 0)
       - (select count(*)::int from public.session_bookings
           where member_id = p_member and session_type = p_type
             and counts_against_allowance)
$$;

-- ── constraints ─────────────────────────────────────────────────────────────

select throws_ok(
  $$insert into public.session_series (member_id, session_type, first_session_at, planned_sessions)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', now(), 0)$$,
  '23514', null,
  'a zero-session series is rejected');

select throws_ok(
  $$insert into public.session_series (member_id, session_type, first_session_at, planned_sessions, status)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', now(), 6, 'paused')$$,
  '23514', null,
  'an unknown series status is rejected');

select throws_ok(
  $$insert into public.session_booking_holds (member_id, session_type, expires_at, purpose)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', now() + interval '15 minutes', 'weird')$$,
  '23514', null,
  'an unknown hold purpose is rejected');

select lives_ok(
  $$insert into public.session_booking_holds (member_id, session_type, expires_at, purpose)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', now() + interval '15 minutes', 'series_anchor')$$,
  'a series_anchor hold is accepted');

-- ── series behaviour ────────────────────────────────────────────────────────

insert into public.session_series
    (id, member_id, session_type, first_session_at, timezone, planned_sessions)
  values
    ('11111111-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-4000-8000-000000000001', 'coaching',
     '2026-09-15T20:00:00Z', 'Pacific/Honolulu', 6);

select is(
  (select count(*)::int from public.session_series
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000001' and status = 'active'),
  1,
  'the conversion creates one active coaching series');

select throws_ok(
  $$insert into public.session_series (member_id, session_type, first_session_at, planned_sessions)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', now(), 6)$$,
  '23505', null,
  'a second ACTIVE series for the same member and type is rejected (replayed anchor webhook)');

update public.session_series
   set status = 'canceled'
 where id = '11111111-0000-4000-8000-000000000001';

select lives_ok(
  $$insert into public.session_series (id, member_id, session_type, first_session_at, planned_sessions)
    values ('11111111-0000-4000-8000-000000000002',
            'aaaaaaaa-0000-4000-8000-000000000001', 'coaching', '2026-09-15T20:00:00Z', 6)$$,
  'an ended series never blocks a new active one');

-- Occurrences are ordinary bookings pointing at the series.
insert into public.session_bookings
    (id, member_id, session_type, scheduled_at, status, series_id, meeting_url)
  values
    ('22222222-0000-4000-8000-000000000001',
     'aaaaaaaa-0000-4000-8000-000000000001', 'coaching',
     '2026-09-22T20:00:00Z', 'scheduled',
     '11111111-0000-4000-8000-000000000002', 'https://zoom.example/j/1');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 5,
  'a booked series occurrence counts against the allowance like any booking');

select lives_ok(
  $$insert into public.session_bookings
      (member_id, session_type, scheduled_at, status, series_id, counts_against_allowance)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching',
            '2026-09-29T20:00:00Z', 'needs_scheduling',
            '11111111-0000-4000-8000-000000000002', false)$$,
  'a needs_scheduling occurrence is accepted');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 5,
  'a needs_scheduling occurrence never touches the balance');

-- Deleting a series releases its occurrences; booking history survives.
insert into public.session_series
    (id, member_id, session_type, first_session_at, planned_sessions)
  values
    ('11111111-0000-4000-8000-000000000003',
     'aaaaaaaa-0000-4000-8000-000000000001', 'pne', '2026-09-16T20:00:00Z', 1);
insert into public.session_bookings
    (id, member_id, session_type, scheduled_at, series_id, counts_against_allowance)
  values
    ('22222222-0000-4000-8000-000000000002',
     'aaaaaaaa-0000-4000-8000-000000000001', 'pne',
     '2026-09-16T20:00:00Z', '11111111-0000-4000-8000-000000000003', false);
delete from public.session_series
 where id = '11111111-0000-4000-8000-000000000003';

select is(
  (select count(*)::int from public.session_bookings
    where id = '22222222-0000-4000-8000-000000000002' and series_id is null),
  1,
  'deleting a series nulls series_id and keeps the booking row');

-- ── row level security ──────────────────────────────────────────────────────
-- Member A now owns two series rows (one canceled, one active).

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);
select is((select count(*)::int from public.session_series), 2,
  'member A reads exactly their own series rows');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);
select is((select count(*)::int from public.session_series), 0,
  'member B sees none of member A''s series');

select throws_ok(
  $$insert into public.session_series (member_id, session_type, first_session_at, planned_sessions)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'coaching', now(), 6)$$,
  '42501', null,
  'members cannot create series — the webhook processor does');

-- No UPDATE policy for members: this statement matches zero rows under RLS.
update public.session_series set status = 'canceled'
 where id = '11111111-0000-4000-8000-000000000002';
reset role;
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select status from public.session_series
    where id = '11111111-0000-4000-8000-000000000002'),
  'active',
  'a member''s attempted series update changed nothing');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);
select is((select count(*)::int from public.session_series), 2,
  'the founder sees all series rows across members');
reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role service_role;
select is((select count(*)::int from public.session_series), 2,
  'service_role sees all series rows');
reset role;

select * from finish();
rollback;
