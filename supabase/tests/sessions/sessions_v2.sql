-- Sessions V1 Build 2 — booking holds: availability math, expiry, RLS.
-- Runs against a fresh local database with BOTH sessions migrations applied
-- (see run_sessions.sh). True two-session concurrency is proven separately by
-- concurrency_holds.sh; this file proves the availability arithmetic the lock
-- serializes, plus the privilege boundaries.

begin;
create extension if not exists pgtap;
select plan(15);

-- ── structure ───────────────────────────────────────────────────────────────

select has_table('public', 'session_booking_holds', 'session_booking_holds exists');
select has_column('public', 'session_booking_holds', 'booking_url',
  'a hold carries its issued single-use link (the authorization IS the link)');
select ok(
  (select relrowsecurity from pg_class where relname = 'session_booking_holds'),
  'RLS is enabled on session_booking_holds');

-- ── seeds ───────────────────────────────────────────────────────────────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local'),
  ('ffffffff-0000-4000-8000-000000000003', 'founder@test.local');
insert into public.member_profiles (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local');
insert into public.user_roles (user_id, role) values
  ('ffffffff-0000-4000-8000-000000000003', 'founder');

-- ── availability math through the acquire function ──────────────────────────

select is(
  (select count(*)::int from public.acquire_session_hold(
    'aaaaaaaa-0000-4000-8000-000000000001', 'coaching')),
  0,
  'no allowance → nothing to reserve');

insert into public.member_session_allowances (member_id, session_type, quantity, reason)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 1, 'program');

select is(
  (select count(*)::int from public.acquire_session_hold(
    'aaaaaaaa-0000-4000-8000-000000000001', 'coaching')),
  1,
  '1 remaining → the hold is granted');

select is(
  (select count(*)::int from public.session_booking_holds
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000001'
      and consumed_at is null and expires_at > now()),
  1,
  'exactly one active hold exists');

select is(
  (select count(*)::int from public.acquire_session_hold(
    'aaaaaaaa-0000-4000-8000-000000000001', 'coaching')),
  0,
  'the active hold makes available 0 → a second attempt gets no hold');

-- An abandoned hold expires on its own: nothing to clean up, it simply stops
-- counting toward availability.
update public.session_booking_holds
   set expires_at = now() - interval '1 hour'
 where member_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and consumed_at is null;

select is(
  (select count(*)::int from public.acquire_session_hold(
    'aaaaaaaa-0000-4000-8000-000000000001', 'coaching')),
  1,
  'an expired unused hold frees the session again');

-- Simulate the webhook completing the flow: the hold is consumed and the real
-- booking counts. available = 1 granted − 1 counting − 0 active = 0.
update public.session_booking_holds
   set consumed_at = now()
 where member_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and consumed_at is null;
insert into public.session_bookings (member_id, session_type)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching');

select is(
  (select count(*)::int from public.acquire_session_hold(
    'aaaaaaaa-0000-4000-8000-000000000001', 'coaching')),
  0,
  'consumed hold + recorded booking = session spent, nothing to reserve');

-- An ISSUED authorization (link attached, expiry extended to the link's
-- ~90-day horizon) blocks re-acquisition long after the 15-minute pending
-- window has passed — the old link can never become a second entitlement.
insert into public.member_session_allowances (member_id, session_type, quantity, reason)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'coaching', 1, 'program');
insert into public.session_booking_holds
  (member_id, session_type, expires_at, booking_url, created_at)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'coaching',
          now() + interval '90 days',
          'https://calendly.com/d/issued-link?email=member-b%40test.local',
          now() - interval '1 hour');

select is(
  (select count(*)::int from public.acquire_session_hold(
    'bbbbbbbb-0000-4000-8000-000000000002', 'coaching')),
  0,
  'an issued-link authorization outlives the pending window and still blocks acquisition');

-- ── privilege boundaries ────────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);

select throws_ok(
  $$select * from public.acquire_session_hold(
      'bbbbbbbb-0000-4000-8000-000000000002', 'coaching')$$,
  '42501', null,
  'members cannot call acquire_session_hold directly (service role only)');

select is(
  (select count(*)::int from public.session_booking_holds
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000001'), 0,
  'none of member A''s holds are visible to member B');

select throws_ok(
  $$insert into public.session_booking_holds (member_id, session_type, expires_at)
    values ('bbbbbbbb-0000-4000-8000-000000000002', 'coaching', now() + interval '1 hour')$$,
  '42501', null,
  'members cannot mint holds by hand');

select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

select is((select count(*)::int from public.session_booking_holds), 2,
  'member A sees exactly their own holds (one expired, one consumed)');

select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);

select is((select count(*)::int from public.session_booking_holds), 3,
  'the founder sees all holds across members');

reset role;

select * from finish();
rollback;
