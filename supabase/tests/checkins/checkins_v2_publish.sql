-- Weekly Member Check-Ins Build 4 — atomic template publish.
-- Runs against a FRESH local database: _local_bootstrap.sql + the Build 1
-- migration + the publish migration (see run_checkins.sh). Never production.
--
-- Claims under test:
--   * publishing creates a NEW version carrying the new questions
--   * the previous version is retired, exactly one active remains
--   * repeated publishes keep incrementing and keep one active
--   * bad input (week out of range, empty/non-array questions) is rejected
--   * a non-founder member cannot publish (RLS), a founder can
--   * existing member_checkins snapshots are byte-identical after a publish

begin;
create extension if not exists pgtap;
select plan(20);

-- ── seeds: a founder, a member, a journey, one submitted check-in ───────────

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local'),
  ('ffffffff-0000-4000-8000-000000000003', 'founder@test.local');
insert into public.member_profiles (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local');
insert into public.user_roles (user_id, role) values
  ('ffffffff-0000-4000-8000-000000000003', 'founder');
insert into public.journeys (id, name) values
  ('11111111-0000-4000-8000-000000000001', 'journey A');

insert into public.member_checkins
  (member_id, journey_id, week_number, template_id, questions_snapshot, scheduled_at,
   responses, status, submitted_at)
select
  'aaaaaaaa-0000-4000-8000-000000000001',
  '11111111-0000-4000-8000-000000000001',
  5, t.id, t.questions, now(),
  '{"overall": 4}'::jsonb, 'submitted', now()
from public.checkin_templates t where t.week_number = 5 and t.active;

-- Freeze the snapshot for later comparison.
create temp table snap_before as
  select id, questions_snapshot from public.member_checkins;

-- ── publish (as table owner: structural claims) ─────────────────────────────

select is(
  (select version from public.checkin_templates where week_number = 5 and active), 1,
  'week 5 starts on seeded version 1');

select lives_ok(
  $$select public.publish_checkin_template(5,
      '[{"key":"overall","type":"scale","label":"A brand new week 5 question","min":1,"max":5,"required":true}]'::jsonb)$$,
  'publishing week 5 succeeds');

select is(
  (select version from public.checkin_templates where week_number = 5 and active), 2,
  'the new version is active');
select is(
  (select active from public.checkin_templates where week_number = 5 and version = 1), false,
  'the previous version is retired');
select is(
  (select count(*)::int from public.checkin_templates where week_number = 5 and active), 1,
  'exactly one active template for week 5');
select is(
  (select questions -> 0 ->> 'label' from public.checkin_templates
    where week_number = 5 and active),
  'A brand new week 5 question',
  'the active version carries the new questions');

select lives_ok(
  $$select public.publish_checkin_template(5,
      '[{"key":"overall","type":"text","label":"Third revision"}]'::jsonb)$$,
  'publishing again succeeds');
select is(
  (select version from public.checkin_templates where week_number = 5 and active), 3,
  'versions keep incrementing');
select is(
  (select count(*)::int from public.checkin_templates where week_number = 5 and active), 1,
  'still exactly one active after a second publish');
select is(
  (select count(*)::int from public.checkin_templates where week_number = 5), 3,
  'history is retained: all three versions exist');

-- Other weeks are untouched.
select is(
  (select count(*)::int from public.checkin_templates where week_number <> 5 and active), 12,
  'the other twelve weeks keep their single active template');

-- ── validation ──────────────────────────────────────────────────────────────

select throws_ok(
  $$select public.publish_checkin_template(14, '[{"key":"x"}]'::jsonb)$$,
  '22023', null, 'week 14 is rejected');
select throws_ok(
  $$select public.publish_checkin_template(0, '[{"key":"x"}]'::jsonb)$$,
  '22023', null, 'week 0 is rejected');
select throws_ok(
  $$select public.publish_checkin_template(5, '[]'::jsonb)$$,
  '22023', null, 'an empty question set is rejected');
select throws_ok(
  $$select public.publish_checkin_template(5, '{"not":"an array"}'::jsonb)$$,
  '22023', null, 'a non-array question set is rejected');

-- ── the member's submitted snapshot is byte-identical ───────────────────────

select is(
  (select count(*)::int from public.member_checkins mc
    join snap_before sb on sb.id = mc.id
   where mc.questions_snapshot::text <> sb.questions_snapshot::text), 0,
  'no member_checkins.questions_snapshot changed across publishes');
select is(
  (select responses ->> 'overall' from public.member_checkins limit 1), '4',
  'the submitted answers are untouched');

-- ── RLS: a member cannot publish, a founder can ─────────────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-4000-8000-000000000001', true);

select throws_ok(
  $$select public.publish_checkin_template(5,
      '[{"key":"evil","type":"text","label":"member-authored question"}]'::jsonb)$$,
  '42501', null,
  'a member''s publish dies on RLS');

reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);

select lives_ok(
  $$select public.publish_checkin_template(5,
      '[{"key":"overall","type":"scale","label":"Founder-published","min":1,"max":5,"required":true}]'::jsonb)$$,
  'a founder''s publish succeeds through RLS');
select is(
  (select count(*)::int from public.checkin_templates where week_number = 5 and active), 1,
  'one active template for week 5 after the founder publish');

reset role;

select * from finish();
rollback;
