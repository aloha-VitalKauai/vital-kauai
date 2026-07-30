begin;
create extension if not exists pgtap;
select plan(39);

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
          'current_member_id resolves via members.profile_id (D-015)');

-- ===== member isolation (test 8) =====
set local role authenticated;
select is((select count(*)::int from finance.agreements), 1,
          'test 8: Member A sees only their own agreement');
select is((select count(*)::int from finance.agreements where member_id='bbbbbbbb-0000-0000-0000-00000000000b'), 0,
          'test 8: Member A cannot see Member B');
reset role;
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select is((select count(*)::int from finance.agreements), 1, 'test 8: Member B sees only their own');
-- lifecycle, links, events, exceptions and runs are founder-only (test 75)
select is((select count(*)::int from finance.agreement_lifecycle_events), 0,
          'test 75: members see no lifecycle events');
select is((select count(*)::int from finance.payment_links), 0, 'test 75: members see no payment links');
select is((select count(*)::int from finance.stripe_events), 0, 'test 75: members see no stripe events');
select is((select count(*)::int from finance.reconciliation_exceptions), 0, 'test 75: members see no exceptions');
select is((select count(*)::int from finance.reconciliation_runs), 0, 'test 75: members see no runs');

-- test 9: a member cannot insert a financial fact
select throws_ok($$ insert into finance.agreements (member_id,purpose,created_by)
  values ('bbbbbbbb-0000-0000-0000-00000000000b','other','33333333-3333-3333-3333-333333333333') $$,
  null,null,'test 9: a member cannot insert an agreement');
select throws_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','pi_z',now(),true from finance.agreements limit 1 $$,
  null,null,'test 9: a member cannot insert a ledger entry');
reset role;

-- founder sees everything (test 10)
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select is((select count(*)::int from finance.agreements), 2, 'test 10: founder sees all agreements');
select is((select count(*)::int from finance.agreement_lifecycle_events), 2, 'test 10: founder sees lifecycle events');
reset role;

-- ===== grants, both directions =====
-- forbidden
select ok(not has_table_privilege('anon','finance.agreements','SELECT'), 'test 42: anon has no SELECT on agreements');
select ok(not has_table_privilege('anon','finance.ledger_entries','SELECT'), 'test 42: anon has no SELECT on ledger_entries');
select ok(not has_table_privilege('authenticated','finance.agreements','INSERT'), 'authenticated has no INSERT');
select ok(not has_table_privilege('authenticated','finance.ledger_entries','UPDATE'), 'authenticated has no UPDATE');
select ok(not has_table_privilege('service_role','finance.ledger_entries','UPDATE'), 'test 41: service_role has no UPDATE on ledger_entries');
select ok(not has_table_privilege('service_role','finance.ledger_entries','DELETE'), 'test 41: service_role has no DELETE on ledger_entries');
select ok(not has_table_privilege('service_role','finance.agreement_amounts','UPDATE'), 'test 41: service_role has no UPDATE on agreement_amounts');
select ok(not has_table_privilege('service_role','finance.agreement_lifecycle_events','UPDATE'), 'test 41: service_role has no UPDATE on lifecycle events');
-- protected columns are excluded from the INSERT grant (D-068)
select ok(not has_column_privilege('service_role','finance.reconciliation_exceptions','resolution_status','INSERT'),
          'test 124: service_role cannot INSERT resolution_status');
select ok(not has_column_privilege('service_role','finance.reconciliation_exceptions','quarantined_at','INSERT'),
          'test 124: service_role cannot INSERT quarantined_at');
select ok(not has_column_privilege('service_role','finance.reconciliation_exceptions','released_by','INSERT'),
          'test 124: service_role cannot INSERT released_by');
select ok(not has_column_privilege('service_role','finance.reconciliation_runs','approved_by','INSERT'),
          'test 129: service_role cannot INSERT approved_by');
select ok(not has_column_privilege('service_role','finance.reconciliation_runs','approval_note','INSERT'),
          'test 129: service_role cannot INSERT approval_note');
select ok(not has_column_privilege('service_role','finance.reconciliation_runs','approved_at','UPDATE'),
          'test 106: service_role cannot UPDATE approved_at');

-- permitted (the other direction — a merely restrictive grant is not proven correct)
select ok(has_table_privilege('service_role','finance.ledger_entries','INSERT'), 'test 40: service_role may INSERT ledger entries');
select ok(has_table_privilege('service_role','finance.ledger_entries','SELECT'), 'test 40: service_role may SELECT ledger entries');
select ok(has_column_privilege('service_role','finance.reconciliation_exceptions','kind','INSERT'),
          'test 123: service_role may INSERT kind');
select ok(has_column_privilege('service_role','finance.reconciliation_exceptions','occurrence_count','UPDATE'),
          'test 125: service_role may UPDATE occurrence_count');
select ok(has_column_privilege('service_role','finance.reconciliation_runs','cursor','UPDATE'),
          'test 76: service_role may UPDATE cursor');
select ok(has_column_privilege('service_role','finance.reconciliation_runs','implementation_version','INSERT'),
          'test 128: service_role may INSERT implementation_version');
select ok(has_table_privilege('authenticated','finance.v_agreement_balances','SELECT'), 'authenticated may read the balance view');

-- EXECUTE grants
select ok(has_function_privilege('authenticated','finance.approve_dry_run(uuid,text)','EXECUTE'), 'authenticated may execute approve_dry_run');
select ok(not has_function_privilege('service_role','finance.approve_dry_run(uuid,text)','EXECUTE'), 'test 88: service_role cannot execute approve_dry_run');
select ok(not has_function_privilege('service_role','finance.release_quarantine(uuid,text)','EXECUTE'), 'test 88: service_role cannot execute release_quarantine');
select ok(has_function_privilege('service_role','finance.quarantine_object(uuid)','EXECUTE'), 'test 93: service_role may execute quarantine_object');
select ok(not has_function_privilege('authenticated','finance.quarantine_object(uuid)','EXECUTE'), 'test 93: a founder cannot execute quarantine_object');

select * from finish();
rollback;
