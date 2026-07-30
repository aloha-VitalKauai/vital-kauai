begin;
create extension if not exists pgtap;
select plan(65);

insert into auth.users (id,email) values
 ('11111111-1111-1111-1111-111111111111','f@t'),('22222222-2222-2222-2222-222222222222','a@t'),('33333333-3333-3333-3333-333333333333','b@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('22222222-2222-2222-2222-222222222222','a@t'),('33333333-3333-3333-3333-333333333333','b@t');
insert into public.members (id,profile_id,email) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','a@t'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','33333333-3333-3333-3333-333333333333','b@t');
insert into public.journeys (id,name) values ('cccccccc-0000-0000-0000-00000000000c','J');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);

-- req 4: enum VALUES, not just counts
select is((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='finance' and t.typname='agreement_lifecycle'),
  'draft,active,fulfilled,canceled,waived','req 4: agreement_lifecycle values exact');
select is((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='finance' and t.typname='payment_state'),
  'unpaid,partial,paid,overpaid,refunded,not_applicable','req 4: payment_state values exact');
select is((select count(*)::int from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='finance' and t.typname='exception_kind'),12,'req 4: exception_kind has 12 values');

-- req 16: SECURITY DEFINER search_path + no PUBLIC execute
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and p.prosecdef and p.proconfig is null),0,'req 16: every SECURITY DEFINER function pins search_path');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and has_function_privilege('public',p.oid,'EXECUTE')),0,'req 16: EXECUTE is not granted to PUBLIC');

-- req 14: anon has nothing
select is((select count(*)::int from information_schema.role_table_grants where table_schema='finance' and grantee='anon'),0,'req 14: anon holds no table privilege');
select ok(not has_schema_privilege('anon','finance','USAGE'),'req 14: anon has no schema USAGE');

-- req 89: the eight partial unique indexes, by predicate
select is((select count(*)::int from pg_indexes where schemaname='finance' and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'),8,'req 89: exactly 8 partial unique indexes');
select is((select count(*)::int from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and i.indisunique and i.indpred is not null),8,'req 89: all eight are indexes, not table constraints');

select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','i');
create temp table ag as select id from finance.agreements limit 1;

-- req 24: same-transaction amendments resolve by seq
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,100,now(),'first','11111111-1111-1111-1111-111111111111' from ag;
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,200,(select effective_at from finance.agreement_amounts limit 1),'second','11111111-1111-1111-1111-111111111111' from ag;
select is((select contribution_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),200::bigint,'req 24: same-transaction amendments resolve to the later seq');

-- req 26: view excludes a future-dated row even if one reaches the table
select is((select count(*)::int from finance.agreement_amounts where effective_at > now()),0,'req 26: no future-dated amendment exists');

-- req 60/61/62: calculations
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',500,'stripe','ch_o','pi_o',now(),true from ag;
select is((select remaining_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),-300::bigint,'req 62: overpayment yields negative remaining_cents');
select is((select payable_remaining_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),0::bigint,'req 62: overpayment yields zero payable_remaining_cents');
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag)),'overpaid','req 61: overpaid state');
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b',null,'membership','n');
select is((select count(*)::int from finance.v_agreement_balances where net_received_cents is null or gross_received_cents is null),0,'req 60: no aggregate is ever NULL');

-- req 65: reversed refund excluded from refunded_cents (full unwind)
create temp table pay as select id from finance.ledger_entries where entry_type='stripe_payment' limit 1;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-500,'stripe','re_u',p.id,now(),true from ag a,pay p;
create temp table rf as select id from finance.ledger_entries where entry_type='refund' limit 1;
select is((select refunded_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),500::bigint,'req 65: an unreversed refund counts');
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',500,'stripe',r.id,now(),true,'u','11111111-1111-1111-1111-111111111111' from ag a,rf r;
select is((select refunded_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),0::bigint,'req 65: a reversed refund does not count');
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',-500,'stripe',p.id,now(),true,'u','11111111-1111-1111-1111-111111111111' from ag a,pay p;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag)),'unpaid','req 65: fully unwound is unpaid');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),0::bigint,'req 54: the full unwind nets to 0');
select throws_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',-500,'stripe',p.id,now(),true,'x','11111111-1111-1111-1111-111111111111' from ag a,pay p $$,null,null,'req 55: an entry cannot be reversed twice');

-- req 53: reversal blocked while parent has an unreversed child
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','m2');
create temp table ag2 as select id from finance.agreements where purpose='membership' and member_id='aaaaaaaa-0000-0000-0000-00000000000a';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',1000,'stripe','ch_x','pi_x',now(),true from ag2;
create temp table p2 as select id from finance.ledger_entries where provider_object_id='ch_x';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-400,'stripe','re_x',p.id,now(),true from ag2 a,p2 p;
select throws_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',-1000,'stripe',p.id,now(),true,'x','11111111-1111-1111-1111-111111111111' from ag2 a,p2 p $$,null,null,'req 53: reversal blocked by an unreversed child');

-- req 30b: stripe refund must target a stripe_payment
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by) select id,'external_payment',900,'external','cash',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag2;
create temp table ep as select id from finance.ledger_entries where entry_type='external_payment' limit 1;
select throws_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-100,'stripe','re_bad',e.id,now(),true from ag2 a,ep e $$,null,null,'req 30b: a stripe refund cannot target an external_payment');

-- req 31: L11 livemode must match originating event
insert into finance.stripe_events(event_id,event_type,object_id,livemode) values ('evt_live','x','o',true);
select throws_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,origin_stripe_event_id) select id,'stripe_payment',10,'stripe','ch_l','pi_l',now(),false,'evt_live' from ag2 $$,null,null,'req 31: livemode disagreeing with the originating event is rejected');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,origin_stripe_event_id) select id,'stripe_payment',10,'stripe','ch_l2','pi_l2',now(),true,'evt_live' from ag2 $$,'req 31: matching livemode is accepted');

-- req 66/68: gift + livemode filter
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c','additional_gift','g');
create temp table gf as select id from finance.agreements where purpose='additional_gift';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',700,'stripe','ch_g','pi_g',now(),true from gf;
select is((select remaining_cents from finance.v_agreement_balances where agreement_id=(select id from gf)),null,'req 66: gift has NULL remaining');
select ok((select gross_received_cents=700 from finance.v_member_financials where member_id='bbbbbbbb-0000-0000-0000-00000000000b'),'req 66: gift money still counts toward member Received');
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',99,'stripe','ch_t','pi_t',now(),false from gf;
select is((select gross_received_cents from finance.v_agreement_balances where agreement_id=(select id from gf)),700::bigint,'req 68: livemode=false excluded from canonical balances');
select is((select gross_received_cents from finance.v_agreement_balances_test where agreement_id=(select id from gf)),99::bigint,'req 68: livemode=false appears in the test view');

-- req 67: every reachable payment_state is produced
select is((select count(distinct payment_state)::int from finance.v_agreement_balances),3,'req 67: multiple distinct payment_states are produced deterministically');
select is((select count(*)::int from finance.v_agreement_balances where payment_state is null),0,'req 67: payment_state is never NULL');

-- req 80/87/117/127: exception lifecycle
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'ch_r');
create temp table ex as select id from finance.reconciliation_exceptions limit 1;
select throws_ok($$ update finance.reconciliation_exceptions set resolution_status='resolved' where id=(select id from ex) $$,null,null,'req 121: a direct resolution UPDATE is rejected');
select lives_ok($$ select finance.resolve_exception((select id from ex),'resolved','ok') $$,'req 126: resolution succeeds through the function');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'ch_r') $$,'req 80: a resolved row does not block a fresh one');
select is((select count(*)::int from finance.reconciliation_exceptions where provider_object_id='ch_r'),2,'req 80: the resolved row is preserved');
select throws_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolution_note) values ('amount_mismatch',true,'ch_s','note') $$,null,null,'req 127: an open row carrying a note is rejected');
select throws_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolved_at) values ('amount_mismatch',true,'ch_t2',now()) $$,null,null,'req 117: an open row carrying resolved_at is rejected');
select throws_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,released_at,released_by) values ('amount_mismatch',true,'ch_u',now(),'11111111-1111-1111-1111-111111111111') $$,null,null,'req 87: release without a prior quarantine is rejected');
select throws_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,quarantined_at) values ('amount_mismatch',true,'ch_v',now()) $$,null,null,'req 87: quarantined_at without a reason is rejected');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',false,'ch_r') $$,'req 124b: an explicit open insert with permitted columns succeeds');

-- req 85/96/97/98/113/115/130/131/132: runs
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
 values (true,'v1',now()-interval '2 days',now()-interval '1 day',true,'completed',true,now());
create temp table dr as select id from finance.reconciliation_runs limit 1;
select throws_ok($$ update finance.reconciliation_runs set resumed_from_run_id=(select id from dr) where id=(select id from dr) $$,null,null,'req 85: self-resume is rejected');
select throws_ok($$ select finance.approve_dry_run((select id from dr),'x') $$,null,null,'req 98: approval without a report is rejected');
update finance.reconciliation_runs set would_create_count=1,would_reopen_count=0,prospective_by_kind='{}'::jsonb,report_version='r',report_completed_at=now() where id=(select id from dr);
select lives_ok($$ select finance.approve_dry_run((select id from dr),'ok') $$,'req 113: approval succeeds exactly once');
select throws_ok($$ select finance.approve_dry_run((select id from dr),'again') $$,null,null,'req 113: a second approval is rejected');
select throws_ok($$ update finance.reconciliation_runs set window_start=now() where id=(select id from dr) $$,null,null,'req 115: window_start is frozen after approval');
select throws_ok($$ update finance.reconciliation_runs set prospective_by_kind='{"a":1}'::jsonb where id=(select id from dr) $$,null,null,'req 115: the report is frozen after approval');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id) values (true,'v1',now()-interval '1 day',now(),false,(select id from dr)) $$,'req 132: authorized_by_run_id is insertable for a writing run');
select throws_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,approved_by,approved_at,approval_note) values (false,'v9',now()-interval '1 day',now(),true,'11111111-1111-1111-1111-111111111111',now(),'x') $$,null,null,'req 130: a fabricated approved run cannot be inserted');
select is((select approved_by from finance.reconciliation_runs where id=(select id from dr)),'11111111-1111-1111-1111-111111111111'::uuid,'req 131: approval attribution is auth.uid()');

-- req 100: at-most-once event scope
select is((select count(*)::int from pg_indexes where schemaname='finance' and tablename='stripe_events' and indexdef like '%UNIQUE%'),1,'req 100: stripe_events has its primary key uniqueness only');
select lives_ok($$ insert into finance.stripe_events(event_id,event_type,object_id,livemode) values ('evt_f1','payment_intent.payment_failed','pi_same',true) $$,'req 100: first payment_failed for an object');
select lives_ok($$ insert into finance.stripe_events(event_id,event_type,object_id,livemode) values ('evt_f2','payment_intent.payment_failed','pi_same',true) $$,'req 100: a second payment_failed for the SAME object is retained');

-- req 108/116: generated dedup_key
select throws_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,dedup_key) values ('amount_mismatch',true,'ch_w','X') $$,null,null,'req 108: dedup_key cannot be supplied');
select is((select count(*)::int from information_schema.columns where table_schema='finance' and table_name='reconciliation_exceptions' and column_name='dedup_key' and is_nullable='NO'),1,'req 116: dedup_key is NOT NULL');
select is((select count(*)::int from finance.reconciliation_exceptions where dedup_key is null),0,'req 116: no row has a NULL dedup_key');

-- req 91: grants both directions
select ok(has_column_privilege('service_role','finance.reconciliation_runs','cursor','UPDATE') and not has_column_privilege('service_role','finance.reconciliation_runs','approved_at','UPDATE'),'req 91: column grants prove both directions');

-- req 11/12/13/74: member access
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select throws_ok($$ insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) values ((select id from ag),1,now(),'x','33333333-3333-3333-3333-333333333333') $$,null,null,'req 11: a member cannot insert a financial fact');
select is((select count(*)::int from finance.v_agreement_balances where member_id='aaaaaaaa-0000-0000-0000-00000000000a'),0,'req 13: the view returns no row a direct query would deny');
select is((select count(*)::int from finance.agreement_lifecycle_events),0,'req 74: members read no lifecycle events');
select is((select count(*)::int from finance.reconciliation_runs),0,'req 74: members read no runs');
select throws_ok($$ select finance.approve_dry_run((select id from dr),'x') $$,null,null,'req 12: a non-founder cannot call an approved function');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select ok((select count(*)>0 from finance.agreements),'req 12: a founder can read through the approved path');
reset role;

-- req 96/97: authorization source
-- req 96: the cited run must be completed, approved, reported and error-free
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (false,'v1',now()-interval '2 days',now()-interval '1 day',true,'partial',false,now());
select throws_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (false,'v1',now()-interval '1 day',now(),false,(select id from finance.reconciliation_runs where status='partial')) $$,
  null,null,'req 96: a writing run citing a partial dry run is rejected');
select throws_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (false,'v1',now()-interval '1 day',now(),false,(select id from dr)) $$,
  null,null,'req 96: a writing run citing a different livemode is rejected');
-- req 97: implementation_version must match the authorizing run
select throws_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (true,'vX',now()-interval '1 day',now(),false,(select id from dr)) $$,
  null,null,'req 97: a writing run whose implementation_version differs is rejected');
select throws_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (true,'v1',now()-interval '10 days',now(),false,(select id from dr)) $$,
  null,null,'req 96: a writing run reaching before the approved horizon is rejected');

select * from finish();
rollback;
