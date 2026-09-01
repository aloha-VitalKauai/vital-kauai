-- Weekly Member Check-Ins Build 1 — structure, question durability, and RLS.
-- Runs against a FRESH local database: _local_bootstrap.sql + the check-ins
-- migration only (see run_checkins.sql's runner run_checkins.sh). Never
-- against production.
--
-- The claims under test:
--   * weeks 1-13 are seeded, one active template each
--   * a journey cannot hold two check-ins for the same week
--   * status and submitted_at can never disagree
--   * a member's submitted answers survive a later template version verbatim
--   * members read their own check-ins and nothing else, and never write

begin;
create extension if not exists pgtap;
select plan(27);

-- ── structure ───────────────────────────────────────────────────────────────

select has_table('public', 'checkin_templates', 'checkin_templates exists');
select has_table('public', 'member_checkins', 'member_checkins exists');

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where relname in ('checkin_templates', 'member_checkins')),
  'RLS is enabled on both check-in tables');

select is(
  (select count(*)::int from public.checkin_templates), 13,
  'weeks 1-13 are seeded');
select is(
  (select count(distinct week_number)::int from public.checkin_templates where active), 13,
  'every week has exactly one active template');
select is(
  (select count(*)::int from public.checkin_templates where jsonb_array_length(questions) = 0), 0,
  'every seeded template carries a question set');

select throws_ok(
  $$insert into public.checkin_templates (week_number, version) values (14, 1)$$,
  '23514', null,
  'a week outside 1-13 is rejected');

select throws_ok(
  $$insert into public.checkin_templates (week_number, version, active) values (3, 2, true)$$,
  '23505', null,
  'a second ACTIVE template for a week is rejected');

-- An inactive new version is fine: that is how a question set is revised.
insert into public.checkin_templates (week_number, version, questions, active)
values (3, 2, '[{"key":"overall","type":"text","label":"Rewritten week 3 question"}]'::jsonb, false);

select is(
  (select count(*)::int from public.checkin_templates where week_number = 3), 2,
  'a week can hold an older version alongside its active one');

-- ── seeds: two members, a founder, a journey each ───────────────────────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local'),
  ('ffffffff-0000-4000-8000-000000000003', 'founder@test.local');
insert into public.member_profiles (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'member-b@test.local');
insert into public.user_roles (user_id, role) values
  ('ffffffff-0000-4000-8000-000000000003', 'founder');
insert into public.journeys (id, name) values
  ('11111111-0000-4000-8000-000000000001', 'journey A'),
  ('22222222-0000-4000-8000-000000000002', 'journey B');

-- A week-1 check-in for member A, carrying the questions as presented.
insert into public.member_checkins
  (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at)
select
  'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000001',
  1, t.id, t.questions, now()
from public.checkin_templates t where t.week_number = 1 and t.active;

select is(
  (select status from public.member_checkins
    where journey_id = '11111111-0000-4000-8000-000000000001'),
  'scheduled',
  'a new check-in starts as scheduled');

select throws_ok(
  $$insert into public.member_checkins
      (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at)
    select 'aaaaaaaa-0000-4000-8000-000000000001',
           '11111111-0000-4000-8000-000000000001', 1, id, questions, now()
      from public.checkin_templates where week_number = 1 and active$$,
  '23505', null,
  'one journey cannot hold two check-ins for the same week');

select throws_ok(
  $$insert into public.member_checkins
      (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at, status)
    select 'aaaaaaaa-0000-4000-8000-000000000001',
           '11111111-0000-4000-8000-000000000001', 2, id, questions, now(), 'submitted'
      from public.checkin_templates where week_number = 2 and active$$,
  '23514', null,
  'a check-in cannot be submitted without a submitted_at');

select throws_ok(
  $$insert into public.member_checkins
      (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at, submitted_at)
    select 'aaaaaaaa-0000-4000-8000-000000000001',
           '11111111-0000-4000-8000-000000000001', 2, id, questions, now(), now()
      from public.checkin_templates where week_number = 2 and active$$,
  '23514', null,
  'a submitted_at cannot sit on a check-in that does not read as submitted');

select throws_ok(
  $$insert into public.member_checkins
      (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at, responses)
    select 'aaaaaaaa-0000-4000-8000-000000000001',
           '11111111-0000-4000-8000-000000000001', 2, id, questions, now(), '[]'::jsonb
      from public.checkin_templates where week_number = 2 and active$$,
  '23514', null,
  'responses must be a json object, not an array');

select throws_ok(
  $$insert into public.member_checkins
      (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 2,
            '99999999-0000-4000-8000-000000000009', '[]'::jsonb, now())$$,
  '23503', null,
  'a check-in must point at a real template');

-- ── the answers outlive the question set ────────────────────────────────────

update public.member_checkins
   set responses = '{"overall": 4, "body": 3, "notes": "steadier this week"}'::jsonb,
       status = 'submitted',
       submitted_at = now()
 where journey_id = '11111111-0000-4000-8000-000000000001' and week_number = 1;

-- Week 1 is redesigned after the fact: the old version is retired, a new one
-- takes over. This is the only supported way to change a live question set.
update public.checkin_templates set active = false where week_number = 1 and version = 1;
insert into public.checkin_templates (week_number, version, questions, active)
values (1, 2, '[{"key":"overall","type":"text","label":"A completely different week 1 question"}]'::jsonb, true);

select is(
  (select questions_snapshot -> 0 ->> 'label' from public.member_checkins
    where journey_id = '11111111-0000-4000-8000-000000000001' and week_number = 1),
  'How has this week been overall?',
  'the submitted check-in still shows the question the member was actually asked');
select is(
  (select responses ->> 'notes' from public.member_checkins
    where journey_id = '11111111-0000-4000-8000-000000000001' and week_number = 1),
  'steadier this week',
  'the submitted answers are untouched by the template rewrite');
select is(
  (select count(*)::int from public.checkin_templates where week_number = 1 and active), 1,
  'week 1 has exactly one active template after the rewrite');

-- The updated_at trigger is live: a caller-supplied value is overwritten.
update public.member_checkins set updated_at = timestamptz '2000-01-01'
 where journey_id = '11111111-0000-4000-8000-000000000001' and week_number = 1;

select ok(
  (select updated_at > timestamptz '2020-01-01' from public.member_checkins
    where journey_id = '11111111-0000-4000-8000-000000000001' and week_number = 1),
  'member_checkins.updated_at is set by the trigger, not by the caller');

-- A second member's check-in, for the RLS rounds below.
insert into public.member_checkins
  (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at)
select 'bbbbbbbb-0000-4000-8000-000000000002',
       '22222222-0000-4000-8000-000000000002', 1, id, questions, now()
  from public.checkin_templates where week_number = 1 and active;

-- ── RLS: a member sees their own check-ins only, and writes nothing ─────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);

select is((select count(*)::int from public.member_checkins), 1,
  'member B sees only their own check-in');
select is(
  (select count(*)::int from public.member_checkins
    where member_id <> 'bbbbbbbb-0000-4000-8000-000000000002'), 0,
  'member A''s check-ins are invisible to member B');
select is((select count(*)::int from public.checkin_templates), 0,
  'templates are founder configuration: a member reads none of them');

select throws_ok(
  $$insert into public.member_checkins
      (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at)
    values ('bbbbbbbb-0000-4000-8000-000000000002',
            '22222222-0000-4000-8000-000000000002', 5,
            '99999999-0000-4000-8000-000000000009', '[]'::jsonb, now())$$,
  '42501', null,
  'a member cannot create their own check-in (no insert policy)');

-- No UPDATE policy for members: this statement matches zero rows under RLS.
update public.member_checkins set responses = '{"overall": 1}'::jsonb
  where member_id = 'aaaaaaaa-0000-4000-8000-000000000001';

reset role;

select is(
  (select responses ->> 'overall' from public.member_checkins
    where member_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '4',
  'member B''s attempted overwrite of A''s answers changed nothing');

-- ── RLS: founder and service role see everything ────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);

select is((select count(*)::int from public.member_checkins), 2,
  'the founder sees check-ins across members');
select is((select count(*)::int from public.checkin_templates), 15,
  'the founder sees every template version');

reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role service_role;

select is((select count(*)::int from public.member_checkins), 2,
  'service_role sees all check-ins');

reset role;

select * from finish();
rollback;
