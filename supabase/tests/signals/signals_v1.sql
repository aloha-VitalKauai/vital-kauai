-- Member Signals Build 1 — structure, the three integrity properties, and RLS.
-- Runs against a FRESH local database: _local_bootstrap.sql + the signals
-- migration only (see run_signals.sh). Never against production.
--
-- The claims under test:
--   * a reading is immutable — no role can update one, corrections are inserts
--   * a failed or data-starved read can never present a direction
--   * an escalation without a reason and a quote is rejected
--   * journal consent is answered by Postgres, and defaults to "no"
--   * needs_attention is defined once, in the view, and clears on acknowledgment
--   * founders read signals; members read nothing at all

begin;
create extension if not exists pgtap;
select plan(37);

-- ── structure ───────────────────────────────────────────────────────────────

select has_table('public', 'member_signals', 'member_signals exists');
select has_table('public', 'member_signal_acknowledgments', 'acknowledgments table exists');
select has_view('public', 'v_member_signal_current', 'the current-state view exists');
select has_function('public', 'member_signal_journal_consent', array['uuid'],
  'the journal consent function exists');

select ok(
  (select bool_and(relrowsecurity) from pg_class
    where relname in ('member_signals', 'member_signal_acknowledgments')),
  'RLS is enabled on both signal tables');

-- Nobody is granted UPDATE or DELETE on a reading, in any role.
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name in ('member_signals', 'member_signal_acknowledgments')
      and privilege_type in ('UPDATE', 'DELETE')
      and grantee in ('authenticated', 'service_role')),
  0,
  'no role is granted UPDATE or DELETE on a signal or an acknowledgment');

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
insert into public.journeys (id, name) values
  ('11111111-0000-4000-8000-000000000001', 'journey A'),
  ('22222222-0000-4000-8000-000000000002', 'journey B');

-- Member A is linked by profile_id and has opted in. Member B is linked by
-- email only and has never decided.
insert into public.members (profile_id, email, journal_sharing_enabled) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'member-a@test.local', true);
insert into public.members (profile_id, email) values
  (null, 'member-b@test.local');

-- ── journal consent is a database answer, and defaults to no ────────────────

select ok(
  public.member_signal_journal_consent('aaaaaaaa-0000-4000-8000-000000000001'),
  'a member who opted in reads as consenting');
select ok(
  not public.member_signal_journal_consent('bbbbbbbb-0000-4000-8000-000000000002'),
  'a member who never decided reads as NOT consenting');
select ok(
  not public.member_signal_journal_consent('99999999-0000-4000-8000-000000000009'),
  'an unmatched member reads as not consenting rather than null');

-- Legacy compatibility access counts, and email-only linkage is honoured.
update public.members set legacy_journal_access_enabled = true
  where email = 'member-b@test.local';
select ok(
  public.member_signal_journal_consent('bbbbbbbb-0000-4000-8000-000000000002'),
  'legacy compatibility access is recognised through an email-only link');
update public.members set legacy_journal_access_enabled = false
  where email = 'member-b@test.local';

-- ── property 2: a failed read is never a zero ───────────────────────────────

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, status, trajectory, summary)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3,
            'failed', 'steady', 'looked fine')$$,
  '23514', null,
  'a failed run cannot report a direction');

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, status, trajectory)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3,
            'insufficient_data', 'improving')$$,
  '23514', null,
  'a data-starved run cannot report a direction either');

select lives_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, status, inputs, generated_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 1,
            'failed', '{"checkins": 0, "error": "upstream timeout"}'::jsonb,
            now() - interval '3 days')$$,
  'a failed run is recorded, as unknown, rather than dropped');

select is(
  (select trajectory from public.member_signals where week_number = 1),
  'unknown',
  'the recorded failure reads as unknown, not as steady');

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, status, trajectory)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3, 'ok', 'steady')$$,
  '23514', null,
  'an ok reading with nothing to say is rejected');

-- ── property 3: escalation is evidenced ─────────────────────────────────────

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, summary, escalate)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3, 'a summary', true)$$,
  '23514', null,
  'an escalation without a reason is rejected');

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, summary, escalate, escalation_reason)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3,
            'a summary', true, '   ')$$,
  '23514', null,
  'a blank reason does not count as a reason');

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, summary, escalate, escalation_reason)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3,
            'a summary', true, 'sleep has collapsed')$$,
  '23514', null,
  'an escalation with no quoted evidence is rejected');

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, summary, evidence)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 3, 'a summary',
            '{"quote": "not an array"}'::jsonb)$$,
  '23514', null,
  'evidence must be an array, not an object');

select lives_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, status, trajectory, headline, summary,
       evidence, escalate, escalation_reason, model, prompt_version, generated_at)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 2,
            'ok', 'declining', 'Sleep and appetite both dropped this week.',
            'Week 2 scales fell across the board and the note names it directly.',
            '[{"source": "checkin", "ref": "week-2", "quote": "I have not slept properly since Tuesday"}]'::jsonb,
            true, 'sleep disruption named directly, third week declining',
            'test-model', 'v1', now() - interval '1 day')$$,
  'a fully evidenced escalation is accepted');

-- ── property 1: a reading is immutable ──────────────────────────────────────

select throws_ok(
  $$update public.member_signals set trajectory = 'improving' where week_number = 2$$,
  '23001', null,
  'a reading cannot be updated, even by the table owner');

select throws_ok(
  $$update public.member_signals set escalate = false where week_number = 2$$,
  '23001', null,
  'an escalation cannot be switched off by an update');

select is(
  (select escalate from public.member_signals where week_number = 2),
  true,
  'the escalation is still standing after the attempted rewrite');

-- A correction is a new row, and the newer row becomes current.
select lives_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, status, trajectory, headline, summary,
       evidence, model, prompt_version)
    values ('aaaaaaaa-0000-4000-8000-000000000001',
            '11111111-0000-4000-8000-000000000001', 2,
            'ok', 'steady', 'Re-read after the week 2 check-in was resubmitted.',
            'The earlier reading was drawn from a partial submission.',
            '[{"source": "checkin", "ref": "week-2", "quote": "sleeping better since the weekend"}]'::jsonb,
            'test-model', 'v1')$$,
  'a corrected reading is inserted alongside the one it supersedes');

select is(
  (select count(*)::int from public.member_signals
    where journey_id = '11111111-0000-4000-8000-000000000001' and week_number = 2),
  2,
  'both readings for the week are kept — the history is intact');

-- ── the view: one current reading per journey, one definition of attention ──

select is(
  (select count(*)::int from public.v_member_signal_current
    where journey_id = '11111111-0000-4000-8000-000000000001'),
  1,
  'the view shows exactly one current reading per journey');

select is(
  (select headline from public.v_member_signal_current
    where journey_id = '11111111-0000-4000-8000-000000000001'),
  'Re-read after the week 2 check-in was resubmitted.',
  'the newest reading is the current one');

select ok(
  not (select needs_attention from public.v_member_signal_current
        where journey_id = '11111111-0000-4000-8000-000000000001'),
  'a current reading that does not escalate needs no attention');

-- Member B gets an open escalation, so acknowledgment can be exercised.
insert into public.member_signals
  (member_id, journey_id, week_number, status, trajectory, headline, summary,
   evidence, escalate, escalation_reason)
values ('bbbbbbbb-0000-4000-8000-000000000002',
        '22222222-0000-4000-8000-000000000002', 4,
        'ok', 'declining', 'Withdrawal language for a second week.',
        'Scales flat, note describes pulling away from support.',
        '[{"source": "checkin", "ref": "week-4", "quote": "I have stopped answering people"}]'::jsonb,
        true, 'withdrawal language two weeks running');

select ok(
  (select needs_attention from public.v_member_signal_current
    where journey_id = '22222222-0000-4000-8000-000000000002'),
  'an unacknowledged escalation needs attention');

insert into public.member_signal_acknowledgments (signal_id, acknowledged_by, disposition, note)
select id, 'ffffffff-0000-4000-8000-000000000003', 'reaching_out', 'calling this afternoon'
  from public.member_signals where journey_id = '22222222-0000-4000-8000-000000000002';

select ok(
  not (select needs_attention from public.v_member_signal_current
        where journey_id = '22222222-0000-4000-8000-000000000002'),
  'acknowledging clears the attention flag');

select ok(
  (select escalate from public.v_member_signal_current
    where journey_id = '22222222-0000-4000-8000-000000000002'),
  'the escalation itself survives acknowledgment — only the human step is recorded');

select is(
  (select acknowledged_disposition from public.v_member_signal_current
    where journey_id = '22222222-0000-4000-8000-000000000002'),
  'reaching_out',
  'the view carries the founder''s latest disposition');

-- Closing something as needing nothing requires saying why.
select throws_ok(
  $$insert into public.member_signal_acknowledgments (signal_id, acknowledged_by, disposition)
    select id, 'ffffffff-0000-4000-8000-000000000003', 'no_action_needed'
      from public.member_signals where journey_id = '22222222-0000-4000-8000-000000000002'$$,
  '23514', null,
  'closing a flag as needing no action requires a written reason');

-- ── RLS: members see nothing; founders see everything ───────────────────────

set local role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-4000-8000-000000000002', true);

select is((select count(*)::int from public.member_signals), 0,
  'a member cannot read signals about themselves — a reading is a care-team note');
select is((select count(*)::int from public.v_member_signal_current), 0,
  'the view is closed to members too');

select throws_ok(
  $$insert into public.member_signals
      (member_id, journey_id, week_number, summary)
    values ('bbbbbbbb-0000-4000-8000-000000000002',
            '22222222-0000-4000-8000-000000000002', 5, 'self-authored')$$,
  '42501', null,
  'a member cannot write a signal about themselves');

reset role;
select set_config('request.jwt.claim.sub', '', true);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ffffffff-0000-4000-8000-000000000003', true);

select is((select count(*)::int from public.v_member_signal_current), 2,
  'the founder sees the current reading for every journey');

reset role;
select set_config('request.jwt.claim.sub', '', true);

select * from finish();
rollback;
