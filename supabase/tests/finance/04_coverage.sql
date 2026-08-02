begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(54);

insert into auth.users (id,email) values
  ('11111111-1111-1111-1111-111111111111','f@t'),('22222222-2222-2222-2222-222222222222','m@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('22222222-2222-2222-2222-222222222222','m@t');
insert into public.members (id,profile_id,email) values ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','m@t');
insert into public.journeys (id,name) values ('cccccccc-0000-0000-0000-00000000000c','J');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','i');
create temp table ag as select id from finance.agreements limit 1;

-- req 5: ledger entries cannot be updated
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',100000,'stripe','ch_a','pi_a',now(),true from ag;
select denied($$ update finance.ledger_entries set amount_cents=1 $$, 'P0001', 'UPDATE on ledger_entries is forbidden: ledger_entries is an', 'req 5: ledger entries cannot be UPDATEd');
select denied($$ delete from finance.ledger_entries $$, 'P0001', 'DELETE on ledger_entries is forbidden: ledger_entries is an', 'req 5: ledger entries cannot be DELETEd');

-- req 43/44: payment counts once; duplicate object rejected
select is((select gross_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),100000::bigint,'req 43: a payment increases net Received exactly once');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','ch_a','pi_zz',now(),true from ag $$, '23505', 'ledger_entries_provider_object_uq', 'req 44: duplicate provider object rejected');

-- req 57: self-parent and cross-agreement parent
-- req 57: a parent in a DIFFERENT agreement is rejected by L6
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'other','x2');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select o.id,'refund',-100,'stripe','re_cross',p.id,now(),true
  from (select id from finance.agreements where purpose='other') o,
       (select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, 'P0001', 'L6: parent belongs to agreement 672c2e29-196b-49b1-b614-45c3afc2139e,', 'req 57: a parent in a different agreement is rejected');
select ok((select count(*)=1 from pg_constraint where conname='ledger_l5_not_self_parent'),'req 57: L5 self-parent CHECK exists');

-- req 30: refund shape
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,occurred_at,livemode)
  select id,'refund',-100,'stripe','re_x',now(),true from ag $$, '23514', 'ledger_entries', 'req 30: refund without parent rejected');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',100,'stripe','re_p',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 30: refund with a positive amount rejected');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-100,'stripe',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 30: stripe refund without provider_object_id rejected');

-- req 48/49: two partial refunds accumulate; excess rejected
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_1',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$,'req 48: first partial refund');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_2',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$,'req 48: second partial refund accumulates');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),20000::bigint,'req 48: two partial refunds accumulate correctly');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_3',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, 'P0001', 'L7: cumulative refunds 120000 exceed settled amount 100000 on entry', 'req 49: a refund exceeding the settled amount is rejected');

-- req 51: refund may not target a refund
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-100,'stripe','re_4',r.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='refund' limit 1) r $$, 'P0001', 'L6: a refund may only target a payment, parent is refund', 'req 51: a refund may not target a refund');

-- req 52: reversal must exactly negate
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',999,'stripe',r.id,now(),true,'x','11111111-1111-1111-1111-111111111111' from ag a,(select id from finance.ledger_entries where entry_type='refund' limit 1) r $$, 'P0001', 'L4: reversal amount 999 does not negate parent amount -40000', 'req 52: a reversal that does not negate its parent is rejected');

-- req 56: reversing a refund restores headroom
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',40000,'stripe',r.id,now(),true,'undo','11111111-1111-1111-1111-111111111111'
  from ag a,(select id from finance.ledger_entries where provider_object_id='re_1') r $$,'req 56: reversal of a refund succeeds');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_5',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$,
  'req 56: reversing a refund restores the parent payment headroom');

-- req 59: legacy import idempotency
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by_system,legacy_donation_id)
  select id,'external_payment',500,'external','cash',now(),true,'import','legacy_import','dddddddd-0000-0000-0000-00000000000d' from ag $$,'req 59: legacy import row accepted');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by_system,legacy_donation_id)
  select id,'external_payment',500,'external','cash',now(),true,'import','legacy_import','dddddddd-0000-0000-0000-00000000000d' from ag $$, '23505', 'ledger_entries_legacy_donation_uq', 'req 59: re-running the import cannot duplicate');

-- req 32b: system attribution needs no auth.users row
select ok((select recorded_by is null and recorded_by_system='legacy_import' from finance.ledger_entries where legacy_donation_id='dddddddd-0000-0000-0000-00000000000d'),
  'req 32b: recorded_by_system requires no auth.users row');
-- req 32e: legacy_donation_id allowed on both sources
select ok((select count(*)>0 from finance.ledger_entries where legacy_donation_id is not null and source='external'),
  'req 32e: legacy_donation_id accepted on an external entry');

-- req 25/27: contribution defaults and blank/negative rejection
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','m');
select is((select contribution_cents from finance.v_agreement_balances b join finance.agreements a on a.id=b.agreement_id where a.purpose='membership'),0::bigint,
  'req 25: an agreement with no amendment yields Contribution 0');
select denied($$ insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id)
  select id,-5,now(),'neg','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'agreement_amounts', 'req 27: a negative amount is rejected');
select denied($$ insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id)
  select id,5,now(),'   ','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'agreement_amounts', 'req 27: a blank reason is rejected');

-- req 19/20: one initial event; terminal states
select denied($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,null,'draft','again','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'agreement 672c2e29-196b-49b1-b614-45c3afc2139e already has an initial', 'req 19: only one initial event per agreement');
select denied($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','fulfilled','skip','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'illegal lifecycle transition draft -> fulfilled', 'req 20: draft->fulfilled is rejected');

-- req 22: lifecycle does not affect balances
insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','canceled','stop','11111111-1111-1111-1111-111111111111' from ag;
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),20500::bigint,
  'req 22: cancelling an agreement does not change any balance column');

-- req 33/34: checkout session constraints
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at,status)
  select id,'k9',5000,true,now()+interval '1 hour','open' from ag $$, '23514', 'checkout_sessions', 'req 34: non-creating status without stripe_session_id rejected');
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at)
  select id,'k10',0,true,now()+interval '1 hour' from ag $$, '23514', 'checkout_sessions', 'req 33: amount_cents must be > 0');

-- req 73: payment_links status CHECKs
select denied($$ insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by,status)
  select id,'t1',now()+interval '1 day','11111111-1111-1111-1111-111111111111','creating' from ag $$, 'P0001', 'a new payment link must be created active, got creating', 'req 73: creating without claimed_at rejected');
select denied($$ insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by,status,consumed_at)
  select id,'t2',now()+interval '1 day','11111111-1111-1111-1111-111111111111','consumed',now() from ag $$, 'P0001', 'a new payment link must be created active, got consumed', 'req 73: consumed without session rejected');

-- req 77/78/85/86: run constraints
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now(),now()-interval '1 hour',true) $$, '23514', 'reconciliation_runs', 'req 77: window_end <= window_start rejected');
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now()-interval '1 day',now(),true);
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now()-interval '1 day',now(),true) $$, '23505', 'reconciliation_runs_single_flight_uq', 'req 78: a second running run for the same livemode is rejected');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (false,'v1',now()-interval '1 day',now(),true) $$,'req 78: a test-mode running run coexists with a live-mode one');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (true,'v1',now()-interval '1 day',now(),true,(select id from finance.reconciliation_runs limit 1)) $$, '23514', 'reconciliation_runs', 'req 86: a dry run may not cite an authorization');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now()-interval '1 day',now(),false) $$, 'P0001', 'authorization run <NULL> does not exist', 'req 86: a writing run without authorization is rejected');

-- req 94/95: dry-run write and report constraints
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,exceptions_created)
  values (false,'v2',now()-interval '1 day',now(),true,5) $$, '23514', 'reconciliation_runs', 'req 94: a dry run with non-zero real writes is rejected');
select denied($$ update finance.reconciliation_runs set report_completed_at=now() where dry_run and livemode $$, '23514', 'reconciliation_runs', 'req 95: report_completed_at without the report columns is rejected');

-- req 82/87/109/117/127: exception constraints
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,first_detected_at,last_detected_at)
  values ('amount_mismatch',true,'ch_z',now(),now()-interval '1 hour') $$, '23514', 'reconciliation_exceptions', 'req 82: last_detected_at < first_detected_at rejected');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_ok') $$,'req 109: a fresh exception with both timestamps NULL inserts cleanly');
select is((select count(*)::int from finance.reconciliation_exceptions where provider_object_id='ch_ok' and quarantined_at is null and released_at is null),1,
  'req 109: untouched quarantine state is permitted');

-- req 81: same dedup_key in different livemode
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id)
  values ('amount_mismatch',false,'ch_ok') $$,'req 81: the same identity in test mode is an independent row');

-- req 110/111/112: quarantine preconditions and derived reason
create temp table q as select id from finance.reconciliation_exceptions where provider_object_id='ch_ok' and livemode limit 1;
select denied($$ select finance.quarantine_object((select id from q)) $$, 'P0001', 'quarantine_object: only provider_object_processing_failed may be', 'req 110: wrong kind cannot be quarantined');
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail,consecutive_failure_runs)
  values ('provider_object_processing_failed',true,'ch_pf','{"object_type":"charge","error_class":"malformed_object"}'::jsonb,1);
create temp table q2 as select id from finance.reconciliation_exceptions where provider_object_id='ch_pf' limit 1;
select denied($$ select finance.quarantine_object((select id from q2)) $$, 'P0001', 'quarantine_object: exception 75fae0ff-f0f8-44fa-9214-f31a138fd978 has', 'req 110: a first failure cannot quarantine');
update finance.reconciliation_exceptions set consecutive_failure_runs=3 where id=(select id from q2);
select lives_ok($$ select finance.quarantine_object((select id from q2)) $$,'req 110: three consecutive failures may quarantine');
select is((select quarantine_reason from finance.reconciliation_exceptions where id=(select id from q2)),'malformed_object',
  'req 111: quarantine_reason is derived from the row detail.error_class');
select denied($$ select finance.quarantine_object((select id from q2)) $$, 'P0001', 'quarantine_object: exception 75fae0ff-f0f8-44fa-9214-f31a138fd978 is', 'req 110: an already-quarantined row cannot be re-quarantined');
select lives_ok($$ select finance.release_quarantine((select id from q2),'ok') $$,'req 92: release succeeds');
select is((select consecutive_failure_runs from finance.reconciliation_exceptions where id=(select id from q2)),0,
  'req 112: release resets the streak to 0');
select denied($$ select finance.quarantine_object((select id from q2)) $$, 'P0001', 'quarantine_object: exception 75fae0ff-f0f8-44fa-9214-f31a138fd978 has', 'req 112: re-quarantine requires three fresh failures');
select is((select release_note from finance.reconciliation_exceptions where id=(select id from q2)),'ok',
  'req 122: release writes release_note');
select is((select resolution_note from finance.reconciliation_exceptions where id=(select id from q2)),null,
  'req 122: release leaves resolution_note untouched');

-- kills the "relax check (amount_cents <> 0)" mutant
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',0,'stripe','ch_zero','pi_zero',now(),true from ag $$, '23514', 'ledger_entries', 'a zero-amount ledger entry is rejected (amount_cents <> 0)');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace
           where n.nspname='finance' and r.relname='ledger_entries'
             and pg_get_constraintdef(c.oid) ilike '%amount_cents <> 0%'), 1,
  'the amount_cents <> 0 CHECK exists on ledger_entries');

select * from finish();
rollback;
