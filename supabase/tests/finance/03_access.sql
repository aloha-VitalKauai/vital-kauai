begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(40);

insert into auth.users (id,email) values
  ('11111111-1111-1111-1111-111111111111','founder@test'),
  ('22222222-2222-2222-2222-222222222222','memberA@test'),
  ('33333333-3333-3333-3333-333333333333','memberB@test');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values
  ('22222222-2222-2222-2222-222222222222','a@t'),('33333333-3333-3333-3333-333333333333','b@t');
insert into public.members (id,profile_id,email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','a@t'),
  ('bbbbbbbb-0000-0000-0000-00000000000b','33333333-3333-3333-3333-333333333333','b@t');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','A');
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b',null,'membership','B');

-- current_member_id resolves through profile_id, never id = auth.uid()
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true);
select is(finance.current_member_id(), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid,
          'current_member_id resolves via members.profile_id (D-015) [A3-001]');
-- R15 second clause: a member row whose profile_id is NULL is unreachable.
insert into auth.users values ('44444444-4444-4444-4444-444444444444','nullprof@t');
insert into public.members(id,profile_id,email) values ('dddddddd-0000-0000-0000-00000000000d',null,'nullprof@t');
do $$ begin perform set_config('request.jwt.claim.sub','44444444-4444-4444-4444-444444444444', true); end $$;
select is(finance.current_member_id(), null,
          'req 15: a NULL profile_id member is not resolved -- current_member_id returns NULL [A3-040]');
do $$ begin perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true); end $$;

-- ===== member isolation (test 8) =====
set local role authenticated;
select is((select count(*)::int from finance.agreements), 1,
          'test 8: Member A sees only their own agreement [A3-002]');
select is((select count(*)::int from finance.agreements where member_id='bbbbbbbb-0000-0000-0000-00000000000b'), 0,
          'test 8: Member A cannot see Member B [A3-003]');
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select is((select count(*)::int from finance.agreements), 1, 'test 8: Member B sees only their own [A3-004]');
-- lifecycle, links, events, exceptions and runs are founder-only (test 75)
select is((select count(*)::int from finance.agreement_lifecycle_events), 0,
          'test 75: members see no lifecycle events [A3-034]');
select is((select count(*)::int from finance.payment_links), 0, 'test 75: members see no payment links [A3-005]');
select is((select count(*)::int from finance.stripe_events), 0, 'test 75: members see no stripe events [A3-006]');
select is((select count(*)::int from finance.reconciliation_exceptions), 0, 'test 75: members see no exceptions [A3-007]');
select is((select count(*)::int from finance.reconciliation_runs), 0, 'test 75: members see no runs [A3-008]');

-- test 9: a member cannot insert a financial fact
select denied($$ insert into finance.agreements (member_id,purpose,created_by)
  values ('bbbbbbbb-0000-0000-0000-00000000000b','other','33333333-3333-3333-3333-333333333333') $$, '42501', 'permission denied for table agreements', 'test 9: a member cannot insert an agreement [A3-035]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','pi_z',now(),true from finance.agreements limit 1 $$, '42501', 'permission denied for table ledger_entries', 'test 9: a member cannot insert a ledger entry [A3-009]');
reset role;

-- founder sees everything (test 10)
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select is((select count(*)::int from finance.agreements), 2, 'test 10: founder sees all agreements [A3-010]');
select is((select count(*)::int from finance.agreement_lifecycle_events), 2, 'test 10: founder sees lifecycle events [A3-011]');
reset role;

-- ===== grants, both directions =====
-- forbidden
select ok(not has_table_privilege('anon','finance.agreements','SELECT'), 'test 42: anon has no SELECT on agreements [A3-036]');
select ok(not has_table_privilege('anon','finance.ledger_entries','SELECT'), 'test 42: anon has no SELECT on ledger_entries [A3-012]');
select ok(not has_table_privilege('authenticated','finance.agreements','INSERT'), 'authenticated has no INSERT [A3-013]');
select ok(not has_table_privilege('authenticated','finance.ledger_entries','UPDATE'), 'authenticated has no UPDATE [A3-014]');
select ok(not has_table_privilege('service_role','finance.ledger_entries','UPDATE'), 'test 41: service_role has no UPDATE on ledger_entries [A3-015]');
select ok(not has_table_privilege('service_role','finance.ledger_entries','DELETE'), 'test 41: service_role has no DELETE on ledger_entries [A3-016]');
select ok(not has_table_privilege('service_role','finance.agreement_amounts','UPDATE'), 'test 41: service_role has no UPDATE on agreement_amounts [A3-017]');
select ok(not has_table_privilege('service_role','finance.agreement_lifecycle_events','UPDATE'), 'test 41: service_role has no UPDATE on lifecycle events [A3-018]');
-- protected columns are excluded from the INSERT grant (D-068)
select ok(not has_column_privilege('service_role','finance.reconciliation_exceptions','resolution_status','INSERT'),
          'test 124: service_role cannot INSERT resolution_status [A3-037]');
select ok(not has_column_privilege('service_role','finance.reconciliation_exceptions','quarantined_at','INSERT'),
          'test 124: service_role cannot INSERT quarantined_at [A3-019]');
select ok(not has_column_privilege('service_role','finance.reconciliation_exceptions','released_by','INSERT'),
          'test 124: service_role cannot INSERT released_by [A3-020]');
select ok(not has_column_privilege('service_role','finance.reconciliation_runs','approved_by','INSERT'),
          'test 129: service_role cannot INSERT approved_by [A3-021]');
select ok(not has_column_privilege('service_role','finance.reconciliation_runs','approval_note','INSERT'),
          'test 129: service_role cannot INSERT approval_note [A3-022]');
select ok(not has_column_privilege('service_role','finance.reconciliation_runs','approved_at','UPDATE'),
          'test 106: service_role cannot UPDATE approved_at [A3-023]');

-- permitted (the other direction — a merely restrictive grant is not proven correct)
select ok(has_table_privilege('service_role','finance.ledger_entries','INSERT'), 'test 40: service_role may INSERT ledger entries [A3-038]');
select ok(has_table_privilege('service_role','finance.ledger_entries','SELECT'), 'test 40: service_role may SELECT ledger entries [A3-024]');
select ok(has_column_privilege('service_role','finance.reconciliation_exceptions','kind','INSERT'),
          'test 123: service_role may INSERT kind [A3-025]');
select ok(has_column_privilege('service_role','finance.reconciliation_exceptions','occurrence_count','UPDATE'),
          'test 125: service_role may UPDATE occurrence_count [A3-026]');
select ok(has_column_privilege('service_role','finance.reconciliation_runs','cursor','UPDATE'),
          'test 76: service_role may UPDATE cursor [A3-027]');
select ok(has_column_privilege('service_role','finance.reconciliation_runs','implementation_version','INSERT'),
          'test 128: service_role may INSERT implementation_version [A3-028]');
select ok(has_table_privilege('authenticated','finance.v_agreement_balances','SELECT'), 'authenticated may read the balance view [A3-029]');

-- EXECUTE grants
select ok(has_function_privilege('authenticated','finance.approve_dry_run(uuid,text)','EXECUTE'), 'authenticated may execute approve_dry_run [A3-039]');
select ok(not has_function_privilege('service_role','finance.approve_dry_run(uuid,text)','EXECUTE'), 'test 88: service_role cannot execute approve_dry_run [A3-030]');
select ok(not has_function_privilege('service_role','finance.release_quarantine(uuid,text)','EXECUTE'), 'test 88: service_role cannot execute release_quarantine [A3-031]');
select ok(has_function_privilege('service_role','finance.quarantine_object(uuid)','EXECUTE'), 'test 93: service_role may execute quarantine_object [A3-032]');
select ok(not has_function_privilege('authenticated','finance.quarantine_object(uuid)','EXECUTE'), 'test 93: a founder cannot execute quarantine_object [A3-033]');

select * from finish();
rollback;
