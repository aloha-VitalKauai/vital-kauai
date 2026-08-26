-- Sessions default program grant — activation, idempotency, safety.
-- Fresh local database with all three sessions migrations (see run_sessions.sh).
--
-- Note on ordering: members.profile_id has a foreign key to member_profiles(id),
-- and in production the profile row is created automatically by
-- auth.on_auth_user_created → handle_new_user. The local bootstrap has no such
-- trigger, so these tests create the profile explicitly — which is exactly the
-- order production is constrained to anyway.

begin;
create extension if not exists pgtap;
select plan(16);

-- ── structure ───────────────────────────────────────────────────────────────

select has_function('public', 'grant_default_session_allowances',
  'grant_default_session_allowances exists');
select is(
  (select count(*)::int from pg_indexes
    where schemaname='public'
      and indexname='member_session_allowances_program_grant_key'
      and indexdef like '%UNIQUE%' and indexdef like '%program%'),
  1, 'partial unique index enforces one program grant per member per type');
select is(
  (select count(*)::int from pg_trigger
    where not tgisinternal and tgname = 'trg_members_grant_default_sessions'),
  1, 'the activation trigger is installed on members');

-- Same derivation the app uses.
create function pg_temp.remaining(p_member uuid, p_type text) returns int
language sql as $$
  select coalesce((select sum(quantity)::int from public.member_session_allowances
                    where member_id = p_member and session_type = p_type), 0)
       - (select count(*)::int from public.session_bookings
           where member_id = p_member and session_type = p_type
             and counts_against_allowance)
$$;

-- ── a profile alone is not a member ─────────────────────────────────────────

insert into auth.users (id, email)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local');
insert into public.member_profiles (id, email)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local');

select is((select count(*)::int from public.member_session_allowances
            where member_id='aaaaaaaa-0000-4000-8000-000000000001'), 0,
  'an auth profile with no members row receives nothing');

-- ── activation: the members row lands (the production path) ─────────────────

select lives_ok(
  $$insert into public.members (id, profile_id, email)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            'aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local')$$,
  'activating a member succeeds, and the grant runs inside that insert');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 10,
  'activated member automatically has 10 coaching');
select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'pne'), 6,
  'activated member automatically has 6 pne');
select is((select count(*)::int from public.member_session_allowances
            where member_id='aaaaaaaa-0000-4000-8000-000000000001'
              and reason='program'), 2,
  'exactly two program rows: one per session type');

-- ── activation: profile_id attached later (UPDATE path) ─────────────────────

insert into auth.users (id, email)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local');
insert into public.member_profiles (id, email)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local');
insert into public.members (id, email)
  values ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local');

select is((select count(*)::int from public.member_session_allowances
            where member_id='bbbbbbbb-0000-4000-8000-000000000002'), 0,
  'a members row without profile_id is not yet activated — no grant');

update public.members set profile_id = 'bbbbbbbb-0000-4000-8000-000000000002'
 where id = 'bbbbbbbb-0000-4000-8000-000000000002';

select is(pg_temp.remaining('bbbbbbbb-0000-4000-8000-000000000002', 'coaching'), 10,
  'attaching profile_id later triggers the same grant');
select is(pg_temp.remaining('bbbbbbbb-0000-4000-8000-000000000002', 'pne'), 6,
  'attaching profile_id later grants pne too');

-- ── idempotency ─────────────────────────────────────────────────────────────

select lives_ok(
  $$update public.members set profile_id = 'aaaaaaaa-0000-4000-8000-000000000001'
     where id = 'aaaaaaaa-0000-4000-8000-000000000001'$$,
  're-activating an already-granted member is a safe no-op');

select lives_ok(
  $$select public.grant_default_session_allowances('aaaaaaaa-0000-4000-8000-000000000001')$$,
  'calling the grant function again does not error (backfill is replayable)');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 10,
  'still exactly 10 after repeated activation — never double-granted');

select throws_ok(
  $$insert into public.member_session_allowances (member_id, session_type, quantity, reason)
    values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 10, 'program')$$,
  '23505', null,
  'a second program grant is refused by the database, not merely by convention');

-- Founder adjustments must stay unlimited — the constraint targets 'program'.
insert into public.member_session_allowances (member_id, session_type, quantity, reason)
  values ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 1, 'founder adjustment'),
         ('aaaaaaaa-0000-4000-8000-000000000001', 'coaching', 1, 'founder adjustment');

select is(pg_temp.remaining('aaaaaaaa-0000-4000-8000-000000000001', 'coaching'), 12,
  'founder adjustments still stack on top of the program grant');

select * from finish();
rollback;
