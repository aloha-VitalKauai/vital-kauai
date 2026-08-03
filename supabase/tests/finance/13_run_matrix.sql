-- Checkpoint B batch 5: the reconciliation-run state machine, enumerated.
-- Requirements 83-85, 92-93, 96, 98, 99, 100. One assertion per combination:
-- "several required combinations represented by one example" is not coverage.
begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(36);

insert into auth.users values ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
do $$ begin perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true); end $$;

-- ===== R84: all 10 status x window_exhausted combinations =====
-- valid five (distinct windows; non-running rows carry finished_at per R83)
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted) values (true,'v1',now()-interval '10 day',now()-interval '9 day',true,'running',false) $$, 'req 84: running+false accepted [A13-001]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (true,'v1',now()-interval '9 day',now()-interval '8 day',true,'partial',false,now()) $$, 'req 84: partial+false accepted [A13-002]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (true,'v1',now()-interval '8 day',now()-interval '7 day',true,'failed',false,now()) $$, 'req 84: failed+false accepted [A13-003]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (true,'v1',now()-interval '7 day',now()-interval '6 day',true,'abandoned',false,now()) $$, 'req 84: abandoned+false accepted [A13-004]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (true,'v1',now()-interval '6 day',now()-interval '5 day',true,'completed',true,now()) $$, 'req 84: completed+true accepted [A13-005]');
-- rejected five
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'completed',false,now()) $$, '23514', 'run_completed_iff_exhausted', 'req 84: completed+false rejected [A13-006]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'running',true) $$, '23514', 'run_completed_iff_exhausted', 'req 84: running+true rejected [A13-007]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'partial',true,now()) $$, '23514', 'run_completed_iff_exhausted', 'req 84: partial+true rejected [A13-008]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'failed',true,now()) $$, '23514', 'run_completed_iff_exhausted', 'req 84: failed+true rejected [A13-009]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'abandoned',true,now()) $$, '23514', 'run_completed_iff_exhausted', 'req 84: abandoned+true rejected [A13-010]');
-- ===== R83 second clause: every non-running status without finished_at =====
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'completed',true) $$, '23514', 'run_finished_at_consistent', 'req 83: completed without finished_at rejected [A13-011]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'partial',false) $$, '23514', 'run_finished_at_consistent', 'req 83: partial without finished_at rejected [A13-012]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'failed',false) $$, '23514', 'run_finished_at_consistent', 'req 83: failed without finished_at rejected [A13-013]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true,'abandoned',false) $$, '23514', 'run_finished_at_consistent', 'req 83: abandoned without finished_at rejected [A13-014]');
-- ===== R85: resume lineage =====
create temp table rp as select id, status from finance.reconciliation_runs where status in ('partial','failed','abandoned');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,resumed_from_run_id) values (true,'v1',now()-interval '4 day',now()-interval '3 day',true,'partial',false,now(),(select id from rp where status='partial')) $$, 'req 85: resuming a partial run accepted [A13-015]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,resumed_from_run_id) values (true,'v1',now()-interval '3 day',now()-interval '2 day',true,'partial',false,now(),(select id from rp where status='failed')) $$, 'req 85: resuming a failed run accepted [A13-016]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,resumed_from_run_id) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'partial',false,now(),(select id from rp where status='abandoned')) $$, 'req 85: resuming an abandoned run accepted [A13-017]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,resumed_from_run_id) values (true,'v1',now()-interval '20 day',now()-interval '19 day',true,'partial',false,now(),(select id from finance.reconciliation_runs where status='running' limit 1)) $$, 'P0001', 'cannot resume', 'req 85: resuming a RUNNING run rejected [A13-018]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,resumed_from_run_id) values (true,'v1',now()-interval '19 day',now()-interval '18 day',true,'partial',false,now(),(select id from finance.reconciliation_runs where status='completed' limit 1)) $$, 'P0001', 'cannot resume', 'req 85: resuming a COMPLETED run rejected [A13-019]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,resumed_from_run_id) values (true,'v1',now()-interval '18 day',now()-interval '17 day',true,'partial',false,now(),(select id from rp where status='partial')) $$, '23505', 'reconciliation_runs_resume_uq', 'req 85: a SECOND run resuming the same predecessor rejected [A13-020]');
-- ===== R98: approval preconditions, every ineligible status + error =====
select denied($$ select finance.approve_dry_run((select id from finance.reconciliation_runs where status='running' and livemode limit 1), 'n') $$, 'P0001', 'approve_dry_run', 'req 98: approving a running run rejected [A13-021]');
select denied($$ select finance.approve_dry_run((select id from rp where status='partial'), 'n') $$, 'P0001', 'approve_dry_run', 'req 98: approving a partial run rejected [A13-022]');
select denied($$ select finance.approve_dry_run((select id from rp where status='failed'), 'n') $$, 'P0001', 'approve_dry_run', 'req 98: approving a failed run rejected [A13-023]');
select denied($$ select finance.approve_dry_run((select id from rp where status='abandoned'), 'n') $$, 'P0001', 'approve_dry_run', 'req 98: approving an abandoned run rejected [A13-024]');
select denied($$ do $x$ declare rid uuid; begin
  insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,error,report_completed_at,would_create_count,would_reopen_count,prospective_by_kind,report_version)
    values (true,'v1',now()-interval '17 day',now()-interval '16 day',true,'completed',true,now(),'boom',now(),0,0,'{}'::jsonb,1) returning id into rid;
  perform finance.approve_dry_run(rid, 'n');
end $x$ $$, 'P0001', 'approve_dry_run', 'req 98: approving an error-bearing run rejected [A13-025]');
-- ===== R93: release_quarantine posture =====
select is((select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and p.proname='quarantine_object'), 'p_exception_id uuid', 'req 93: quarantine_object takes no reason parameter [A13-026]');
select denied($$ select finance.release_quarantine('00000000-0000-0000-0000-000000000001'::uuid, 'note') $$, 'P0001', 'release_quarantine', 'req 93: releasing a non-quarantined row raises [A13-027]');
do $$ begin perform set_config('request.jwt.claim.sub','99999999-9999-9999-9999-999999999999', true); end $$;
select denied($$ select finance.release_quarantine('00000000-0000-0000-0000-000000000001'::uuid, 'note') $$, 'P0001', 'founder', 'req 93: a non-founder cannot release [A13-028]');
do $$ begin perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true); end $$;
-- ===== R99: processing-failure shape, every direction =====
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,detail) values ('provider_object_processing_failed',true,'{"object_type":"charge","error_class":"malformed_object"}'::jsonb) $$, '23514', 'exc_processing_failure_shape', 'req 99: NULL provider_object_id rejected [A13-029]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',true,'ch_99','{"error_class":"malformed_object"}'::jsonb) $$, '23514', 'exc_processing_failure_shape', 'req 99: absent object_type rejected [A13-030]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',true,'ch_99','{"object_type":"subscription","error_class":"malformed_object"}'::jsonb) $$, '23514', 'exc_processing_failure_shape', 'req 99: out-of-set object_type rejected [A13-031]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',true,'ch_99','{"object_type":"charge"}'::jsonb) $$, '23514', 'exc_processing_failure_shape', 'req 99: absent error_class rejected [A13-032]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',true,'ch_99','{"object_type":"charge","error_class":"timeout"}'::jsonb) $$, '23514', 'exc_processing_failure_shape', 'req 99: out-of-set error_class rejected [A13-033]');
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',true,'ch_99','{"object_type":"charge","error_class":"malformed_object"}'::jsonb);
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',false,'ch_99','{"object_type":"charge","error_class":"malformed_object"}'::jsonb) $$, 'req 99: same object in the other livemode coexists [A13-034]');
-- ===== R100: index scope derived from the catalog, not prose =====
select is((select indexdef from pg_indexes where schemaname='finance' and indexname='ledger_entries_provider_object_uq'),
  'CREATE UNIQUE INDEX ledger_entries_provider_object_uq ON finance.ledger_entries USING btree (provider_object_id, livemode) WHERE (provider_object_id IS NOT NULL)',
  'req 100: the at-most-once ledger index has exactly its documented scope [A13-035]');
insert into finance.stripe_events(event_id,event_type,object_id,livemode,payload) values
  ('evt_pf1','payment_intent.payment_failed','pi_pf',true,'{}'::jsonb),
  ('evt_pf2','payment_intent.payment_failed','pi_pf',true,'{}'::jsonb);
select is((select count(*)::int from finance.ledger_entries where provider_object_id='pi_pf' or provider_payment_intent_id='pi_pf'), 0,
  'req 100: repeated payment_failed events for one object create no ledger entries [A13-036]');
select * from finish();
rollback;
