-- Checkpoint B semantic-review remediation: the DISPUTED miscitations and TEST
-- GAPS the reviewer flagged, each with its own isolated fixtures.
begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(20);

insert into auth.users values ('11111111-1111-1111-1111-111111111111','f@t'),('77777777-7777-7777-7777-777777777777','m@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('11111111-1111-1111-1111-111111111111','f@t'),('77777777-7777-7777-7777-777777777777','m@t');
insert into public.members(id,profile_id,email) values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','f@t');
insert into public.journeys(id,name) values ('cccccccc-0000-0000-0000-00000000000c','J');
do $$ begin perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true); end $$;

-- R133b: the child->agreement FK is NON-DEFERRABLE (the deferred completeness
-- trigger is not a licence to reorder). The behavioural rejection [A2-052] is a
-- trigger P0001; this pins the actual FK mechanism the requirement names.
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid join pg_namespace n on n.oid=r.relnamespace
           where n.nspname='finance' and r.relname='agreement_lifecycle_events' and c.contype='f' and c.conname like '%agreement_id%' and not c.condeferrable), 1,
  'req 133b: the lifecycle->agreement FK is non-deferrable [A16-001]');

-- R108: an UPDATE attempting to override the generated dedup_key is rejected by the server (428C9).
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'r108');
select denied($$ update finance.reconciliation_exceptions set dedup_key='forged' where provider_object_id='r108' $$, '428C9', 'can only be updated to DEFAULT', 'req 108: a direct UPDATE cannot override the generated dedup_key [A16-002]');

-- R109: equal non-null quarantine/release timestamps are rejected (exc_monotonic_backstop).
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail,consecutive_failure_runs)
  values ('provider_object_processing_failed',true,'r109',jsonb_build_object('object_type','charge','error_class','malformed_object'),3);
select denied($$ do $x$ declare t timestamptz := clock_timestamp(); begin
    perform set_config('finance.qtest','on',true);
    update finance.reconciliation_exceptions set quarantined_at=t, quarantine_reason='malformed_object', released_at=t, released_by='11111111-1111-1111-1111-111111111111' where provider_object_id='r109';
  end $x$ $$, '23514', 'exc_monotonic_backstop', 'req 109: equal non-null quarantine and release timestamps are rejected [A16-003]');

-- R114: the stored approval_note equals the supplied note.
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at,would_create_count,would_reopen_count,prospective_by_kind,report_version)
  values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'completed',true,now(),now(),0,0,'{}'::jsonb,1);
select finance.approve_dry_run((select id from finance.reconciliation_runs where livemode and approved_at is null and status='completed'), 'the exact note text');
select is((select approval_note from finance.reconciliation_runs where approval_note is not null), 'the exact note text',
  'req 114: the stored approval_note equals the supplied text [A16-004]');

-- R128: a normal unapproved run inserts AS service_role using only granted columns.
set local role service_role;
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run) values (false,'v1',now()-interval '5 day',now()-interval '4 day',true) $$,
  'req 128: service_role inserts a normal unapproved run using only its granted columns (status/window_exhausted default) [A16-005]');
reset role;

-- R38: "rejected when creating" -- the claim PATH (WHERE status='active') matches
-- zero rows once a link is already creating, which is the real one-shot control.
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at) values (true,'v9',now()-interval '9 day',now()-interval '8 day',true,'partial',false,now());
create temp table lag as select id from finance.agreements limit 1;
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','r38');
insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by) select id,'tok38',now()+interval '1 day','11111111-1111-1111-1111-111111111111' from finance.agreements where purpose='membership';
update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok38' and status='active';
do $r38$ declare n int; begin
  update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok38' and status='active';
  get diagnostics n = row_count;
  create temp table r38res(hit int); insert into r38res values (n);
end $r38$;
select is((select hit from r38res), 0, 'req 38: the claim path (WHERE status=active) matches zero rows for an already-creating link [A16-006]');

-- R67: paid and partial are each produced as concrete payment_state values.
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','r67paid');
create temp table apaid as select id from finance.agreements where purpose='journey_contribution' order by created_at desc limit 1;
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,10000,now(),'a','11111111-1111-1111-1111-111111111111' from apaid;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',10000,'stripe','ch_paid','pi_paid',now(),true from apaid;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from apaid)), 'paid', 'req 67: the paid state is produced [A16-007]');
insert into public.members(id,profile_id,email) values ('bbbbbbbb-0000-0000-0000-00000000000b','77777777-7777-7777-7777-777777777777','m@t');
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c','journey_contribution','r67partial');
create temp table apart as select id from finance.agreements where member_id='bbbbbbbb-0000-0000-0000-00000000000b';
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,10000,now(),'a','11111111-1111-1111-1111-111111111111' from apart;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',3000,'stripe','ch_part','pi_part',now(),true from apart;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from apart)), 'partial', 'req 67: the partial state is produced [A16-008]');

-- R22: lifecycle state does not touch payment_state.
insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) select id,'draft','active','a','11111111-1111-1111-1111-111111111111' from apart;
insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) select id,'active','canceled','c','11111111-1111-1111-1111-111111111111' from apart;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from apart)), 'partial', 'req 22: cancelling the agreement leaves payment_state unchanged [A16-009]');

-- R61: payable_remaining_cents is NULL when contribution does not apply (gift).
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','additional_gift','r61');
create temp table agift as select id from finance.agreements where purpose='additional_gift' order by created_at desc limit 1;
select is((select payable_remaining_cents from finance.v_agreement_balances where agreement_id=(select id from agift)), null,
  'req 61: payable_remaining_cents is NULL when contribution_applies is false [A16-010]');

-- R79: on the dedup upsert, first_detected_at is unchanged while occurrence_count rises.
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('ledger_without_provider',true,'r79');
create temp table fd as select first_detected_at from finance.reconciliation_exceptions where provider_object_id='r79';
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('ledger_without_provider',true,'r79')
  on conflict (dedup_key, livemode) where resolution_status='open'
  do update set occurrence_count = finance.reconciliation_exceptions.occurrence_count + 1, last_detected_at = clock_timestamp();
select is((select first_detected_at from finance.reconciliation_exceptions where provider_object_id='r79'), (select first_detected_at from fd),
  'req 79: the dedup upsert leaves first_detected_at unchanged [A16-011]');
select is((select occurrence_count from finance.reconciliation_exceptions where provider_object_id='r79'), 2, 'req 79: the upsert raises occurrence_count [A16-012]');

-- R94: a dry_run=false row carrying exceptions_reopened>0 is fine; a report column is not (the other direction from A4-051).
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,exceptions_reopened) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,5) $$, '23514', 'run_dry_writes_nothing', 'req 94: a dry run with non-zero exceptions_reopened is rejected [A16-013]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'completed',true,now(),now()) $$, '23514', 'run_report_complete', 'req 95: report_completed_at without the four report columns is rejected [A16-014]');

-- R95: each of the four report columns individually required when report_completed_at set.
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at,would_reopen_count,prospective_by_kind,report_version) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'completed',true,now(),now(),0,'{}'::jsonb,1) $$, '23514', 'run_report_complete', 'req 95: missing would_create_count alone is rejected [A16-015]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at,would_create_count,prospective_by_kind,report_version) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'completed',true,now(),now(),0,'{}'::jsonb,1) $$, '23514', 'run_report_complete', 'req 95: missing would_reopen_count alone is rejected [A16-016]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at,would_create_count,would_reopen_count,report_version) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'completed',true,now(),now(),0,0,1) $$, '23514', 'run_report_complete', 'req 95: missing prospective_by_kind alone is rejected [A16-017]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at,would_create_count,would_reopen_count,prospective_by_kind) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'completed',true,now(),now(),0,0,'{}'::jsonb) $$, '23514', 'run_report_complete', 'req 95: missing report_version alone is rejected [A16-018]');

-- R110: a RESOLVED (not just dismissed) processing-failure row cannot be quarantined.
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail,consecutive_failure_runs) values ('provider_object_processing_failed',true,'r110',jsonb_build_object('object_type','charge','error_class','malformed_object'),3);
select finance.resolve_exception((select id from finance.reconciliation_exceptions where provider_object_id='r110'), 'resolved', 'resolving before quarantine probe');
set local role service_role;
select denied($$ select finance.quarantine_object((select id from finance.reconciliation_exceptions where provider_object_id='r110')) $$, 'P0001', 'not open', 'req 110: a RESOLVED row cannot be quarantined [A16-019]');
reset role;

-- R129: approved_by and approval_note each individually rejected at INSERT (the reviewer noted only approved_at was individually shown).
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,approved_by) values (true,'v1',now()-interval '2 day',now()-interval '1 day',true,'11111111-1111-1111-1111-111111111111') $$, 'P0001', 'may not be created already approved', 'req 129: approved_by alone at INSERT is rejected [A16-020]');
select * from finish();
rollback;
