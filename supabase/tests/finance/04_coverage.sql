begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(98);

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
select denied($$ update finance.ledger_entries set amount_cents=1 $$, 'P0001', 'UPDATE on ledger_entries is forbidden: ledger_entries is an', 'req 5: ledger entries cannot be UPDATEd [A4-001]');
select denied($$ delete from finance.ledger_entries $$, 'P0001', 'DELETE on ledger_entries is forbidden: ledger_entries is an', 'req 5: ledger entries cannot be DELETEd [A4-002]');

-- req 43/44: payment counts once; duplicate object rejected
select is((select gross_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),100000::bigint,'req 43: a payment increases net Received exactly once [A4-038]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','ch_a','pi_zz',now(),true from ag $$, '23505', 'ledger_entries_provider_object_uq', 'req 44: duplicate provider object rejected [A4-003]');

-- req 57: self-parent and cross-agreement parent
-- req 57: a parent in a DIFFERENT agreement is rejected by L6
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'other','x2');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select o.id,'refund',-100,'stripe','re_cross',p.id,now(),true
  from (select id from finance.agreements where purpose='other') o,
       (select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, 'P0001', 'L6: parent belongs to agreement 672c2e29-196b-49b1-b614-45c3afc2139e,', 'req 57: a parent in a different agreement is rejected [A4-004]');
select ok((select count(*)=1 from pg_constraint where conname='ledger_l5_not_self_parent'),'req 57: L5 self-parent CHECK exists [A4-005]');

-- req 30: refund shape
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,occurred_at,livemode)
  select id,'refund',-100,'stripe','re_x',now(),true from ag $$, '23514', 'ledger_entries', 'req 30: refund without parent rejected [A4-039]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',100,'stripe','re_p',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 30: refund with a positive amount rejected [A4-006]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-100,'stripe',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 30: stripe refund without provider_object_id rejected [A4-007]');

-- req 48/49: two partial refunds accumulate; excess rejected
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_1',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$,'req 48: first partial refund [A4-040]');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_2',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$,'req 48: second partial refund accumulates [A4-008]');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),20000::bigint,'req 48: two partial refunds accumulate correctly [A4-009]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_3',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, 'P0001', 'L7: cumulative refunds 120000 exceed settled amount 100000 on entry', 'req 49: a refund exceeding the settled amount is rejected [A4-010]');

-- req 51: refund may not target a refund
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-100,'stripe','re_4',r.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='refund' limit 1) r $$, 'P0001', 'L6: a refund may only target a payment, parent is refund', 'req 51: a refund may not target a refund [A4-041]');

-- req 52: reversal must exactly negate
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',999,'stripe',r.id,now(),true,'x','11111111-1111-1111-1111-111111111111' from ag a,(select id from finance.ledger_entries where entry_type='refund' limit 1) r $$, 'P0001', 'L4: reversal amount 999 does not negate parent amount -40000', 'req 52: a reversal that does not negate its parent is rejected [A4-042]');

-- req 56: reversing a refund restores headroom
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',40000,'stripe',r.id,now(),true,'undo','11111111-1111-1111-1111-111111111111'
  from ag a,(select id from finance.ledger_entries where provider_object_id='re_1') r $$,'req 56: reversal of a refund succeeds [A4-043]');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_5',p.id,now(),true from ag a,(select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$,
  'req 56: reversing a refund restores the parent payment headroom [A4-011]');

-- req 59: legacy import idempotency
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by_system,legacy_donation_id)
  select id,'external_payment',500,'external','cash',now(),true,'import','legacy_import','dddddddd-0000-0000-0000-00000000000d' from ag $$,'req 59: legacy import row accepted [A4-044]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by_system,legacy_donation_id)
  select id,'external_payment',500,'external','cash',now(),true,'import','legacy_import','dddddddd-0000-0000-0000-00000000000d' from ag $$, '23505', 'ledger_entries_legacy_donation_uq', 'req 59: re-running the import cannot duplicate [A4-012]');

-- req 32b: system attribution needs no auth.users row
select ok((select recorded_by is null and recorded_by_system='legacy_import' from finance.ledger_entries where legacy_donation_id='dddddddd-0000-0000-0000-00000000000d'),
  'req 32b: recorded_by_system requires no auth.users row [A4-045]');
-- req 32e: legacy_donation_id allowed on both sources
select ok((select count(*)>0 from finance.ledger_entries where legacy_donation_id is not null and source='external'),
  'req 32e: legacy_donation_id accepted on an external entry [A4-046]');

-- req 25/27: contribution defaults and blank/negative rejection
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','m');
select is((select contribution_cents from finance.v_agreement_balances b join finance.agreements a on a.id=b.agreement_id where a.purpose='membership'),0::bigint,
  'req 25: an agreement with no amendment yields Contribution 0 [A4-013]');
select denied($$ insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id)
  select id,-5,now(),'neg','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'agreement_amounts', 'req 27: a negative amount is rejected [A4-014]');
select denied($$ insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id)
  select id,5,now(),'   ','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'agreement_amounts', 'req 27: a blank reason is rejected [A4-015]');

-- req 19/20: one initial event; terminal states
select denied($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,null,'draft','again','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'agreement 672c2e29-196b-49b1-b614-45c3afc2139e already has an initial', 'req 19: only one initial event per agreement [A4-047]');
select denied($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','fulfilled','skip','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'illegal lifecycle transition draft -> fulfilled', 'req 20: draft->fulfilled is rejected [A4-016]');

-- req 22: lifecycle does not affect balances
insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','canceled','stop','11111111-1111-1111-1111-111111111111' from ag;
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),20500::bigint,
  'req 22: cancelling an agreement does not change any balance column [A4-017]');

-- req 33/34: checkout session constraints
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at,status)
  select id,'k9',5000,true,now()+interval '1 hour','open' from ag $$, '23514', 'checkout_sessions', 'req 34: non-creating status without stripe_session_id rejected [A4-048]');
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at)
  select id,'k10',0,true,now()+interval '1 hour' from ag $$, '23514', 'checkout_sessions', 'req 33: amount_cents must be > 0 [A4-018]');

-- req 73: payment_links status CHECKs
select denied($$ insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by,status)
  select id,'t1',now()+interval '1 day','11111111-1111-1111-1111-111111111111','creating' from ag $$, 'P0001', 'a new payment link must be created active, got creating', 'req 73: creating without claimed_at rejected [A4-049]');
select denied($$ insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by,status,consumed_at)
  select id,'t2',now()+interval '1 day','11111111-1111-1111-1111-111111111111','consumed',now() from ag $$, 'P0001', 'a new payment link must be created active, got consumed', 'req 73: consumed without session rejected [A4-019]');

-- req 77/78/85/86: run constraints
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now(),now()-interval '1 hour',true) $$, '23514', 'reconciliation_runs', 'req 77: window_end <= window_start rejected [A4-050]');
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now()-interval '1 day',now(),true);
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now()-interval '1 day',now(),true) $$, '23505', 'reconciliation_runs_single_flight_uq', 'req 78: a second running run for the same livemode is rejected [A4-020]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (false,'v1',now()-interval '1 day',now(),true) $$,'req 78: a test-mode running run coexists with a live-mode one [A4-021]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (true,'v1',now()-interval '1 day',now(),true,(select id from finance.reconciliation_runs limit 1)) $$, '23514', 'reconciliation_runs', 'req 86: a dry run may not cite an authorization [A4-022]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run)
  values (true,'v1',now()-interval '1 day',now(),false) $$, 'P0001', 'authorization run <NULL> does not exist', 'req 86: a writing run without authorization is rejected [A4-023]');

-- req 94/95: dry-run write and report constraints
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,exceptions_created)
  values (false,'v2',now()-interval '1 day',now(),true,5) $$, '23514', 'reconciliation_runs', 'req 94: a dry run with non-zero real writes is rejected [A4-051]');
select denied($$ update finance.reconciliation_runs set report_completed_at=now() where dry_run and livemode $$, '23514', 'reconciliation_runs', 'req 95: report_completed_at without the report columns is rejected [A4-024]');

-- req 82/87/109/117/127: exception constraints
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,first_detected_at,last_detected_at)
  values ('amount_mismatch',true,'ch_z',now(),now()-interval '1 hour') $$, '23514', 'reconciliation_exceptions', 'req 82: last_detected_at < first_detected_at rejected [A4-052]');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_ok') $$,'req 109: a fresh exception with both timestamps NULL inserts cleanly [A4-025]');
select is((select count(*)::int from finance.reconciliation_exceptions where provider_object_id='ch_ok' and quarantined_at is null and released_at is null),1,
  'req 109: untouched quarantine state is permitted [A4-026]');

-- req 81: same dedup_key in different livemode
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id)
  values ('amount_mismatch',false,'ch_ok') $$,'req 81: the same identity in test mode is an independent row [A4-053]');

-- req 110/111/112: quarantine preconditions and derived reason
create temp table q as select id from finance.reconciliation_exceptions where provider_object_id='ch_ok' and livemode limit 1;
select denied($$ select finance.quarantine_object((select id from q)) $$, 'P0001', 'quarantine_object: only provider_object_processing_failed may be', 'req 110: wrong kind cannot be quarantined [A4-027]');
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail,consecutive_failure_runs)
  values ('provider_object_processing_failed',true,'ch_pf','{"object_type":"charge","error_class":"malformed_object"}'::jsonb,1);
create temp table q2 as select id from finance.reconciliation_exceptions where provider_object_id='ch_pf' limit 1;
select denied($$ select finance.quarantine_object((select id from q2)) $$, 'P0001', 'quarantine_object: exception 75fae0ff-f0f8-44fa-9214-f31a138fd978 has', 'req 110: a first failure cannot quarantine [A4-028]');
update finance.reconciliation_exceptions set consecutive_failure_runs=3 where id=(select id from q2);
select lives_ok($$ select finance.quarantine_object((select id from q2)) $$,'req 110: three consecutive failures may quarantine [A4-029]');
select is((select quarantine_reason from finance.reconciliation_exceptions where id=(select id from q2)),'malformed_object',
  'req 111: quarantine_reason is derived from the row detail.error_class [A4-030]');
select denied($$ select finance.quarantine_object((select id from q2)) $$, 'P0001', 'quarantine_object: exception 75fae0ff-f0f8-44fa-9214-f31a138fd978 is', 'req 110: an already-quarantined row cannot be re-quarantined [A4-031]');
select lives_ok($$ select finance.release_quarantine((select id from q2),'ok') $$,'req 92: release succeeds [A4-032]');
select is((select consecutive_failure_runs from finance.reconciliation_exceptions where id=(select id from q2)),0,
  'req 112: release resets the streak to 0 [A4-033]');
select denied($$ select finance.quarantine_object((select id from q2)) $$, 'P0001', 'quarantine_object: exception 75fae0ff-f0f8-44fa-9214-f31a138fd978 has', 'req 112: re-quarantine requires three fresh failures [A4-034]');
select is((select release_note from finance.reconciliation_exceptions where id=(select id from q2)),'ok',
  'req 122: release writes release_note [A4-035]');
select is((select resolution_note from finance.reconciliation_exceptions where id=(select id from q2)),null,
  'req 122: release leaves resolution_note untouched [A4-036]');

-- kills the "relax check (amount_cents <> 0)" mutant
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',0,'stripe','ch_zero','pi_zero',now(),true from ag $$, '23514', 'ledger_entries', 'a zero-amount ledger entry is rejected (amount_cents <> 0) [A4-054]');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace
           where n.nspname='finance' and r.relname='ledger_entries'
             and pg_get_constraintdef(c.oid) ilike '%amount_cents <> 0%'), 1,
  'the amount_cents <> 0 CHECK exists on ledger_entries [A4-037]');

-- ===== Checkpoint B batch 2: clause-completion probes =====
-- End-of-file block: the file's final rollback is the cleanup; a savepoint here
-- would roll back pgTAP's counter and break the plan.
-- R28 L1 remaining clauses
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by) select id,'stripe_payment',100,'external','cash',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_entries', 'req 28 (L1): a stripe_payment with source external is rejected [A4-055]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',-100,'stripe','ch_n','pi_n',now(),true from ag $$, '23514', 'ledger_entries', 'req 28 (L1): a non-positive stripe_payment is rejected [A4-056]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,parent_entry_id,occurred_at,livemode) select a.id,'stripe_payment',100,'stripe','ch_p','pi_p',p.id,now(),true from ag a, (select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 28 (L1): a stripe_payment carrying a parent is rejected [A4-057]');
-- R29 L2 remaining clauses
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,reason,recorded_by) select id,'external_payment',100,'stripe','ch_e','pi_e',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_entries', 'req 29 (L2): an external_payment with source stripe is rejected [A4-058]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by) select id,'external_payment',-100,'external','cash',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_entries', 'req 29 (L2): a non-positive external_payment is rejected [A4-059]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'external_payment',100,'external','cash',p.id,now(),true,'r','11111111-1111-1111-1111-111111111111' from ag a, (select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 29 (L2): an external_payment carrying a parent is rejected [A4-060]');
-- R30 L3 remaining clause
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'refund',-50,'external',p.id,now(),true,'r','11111111-1111-1111-1111-111111111111' from ag a, (select id from finance.ledger_entries where entry_type='stripe_payment' limit 1) p $$, '23514', 'ledger_entries', 'req 30 (L3): an external refund without external_method is rejected [A4-061]');
-- R31: NULL origin_stripe_event_id is accepted
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,origin_stripe_event_id) select id,'stripe_payment',77,'stripe','ch_no','pi_no',now(),true,null from ag $$, 'req 31 (L11): a NULL origin_stripe_event_id is accepted [A4-062]');
-- R31 fix: external and imported money must be livemode=true (ledger_l11_offline_livemode)
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by) select id,'external_payment',5000,'external','cash',now(),false,'test-mode external?','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_l11_offline_livemode', 'req 31: an external payment cannot be livemode=false -- real money would drop from canonical balances [A4-096]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,legacy_donation_id) select id,'stripe_payment',5000,'stripe','ch_imp','pi_imp',now(),false,'aaaaaaaa-bbbb-4ccc-8ddd-000000000009'::uuid from ag $$, '23514', 'ledger_l11_offline_livemode', 'req 31: imported historic money (legacy_donation_id) cannot be livemode=false [A4-097]');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',12,'stripe','ch_tm','pi_tm',now(),false from ag $$, 'req 31: a genuine Stripe test-mode entry is still allowed at livemode=false [A4-098]');
-- R33 uniqueness
insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at,status,stripe_session_id) select id,'k_b2',100,true,now()+interval '1 hour','open','cs_b2' from ag;
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at,status,stripe_session_id) select id,'k_b2x',100,true,now()+interval '1 hour','open','cs_b2' from ag $$, '23505', 'checkout_sessions_stripe_session_id_key', 'req 33: duplicate stripe_session_id is rejected [A4-063]');
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) select id,'k_b2',100,true,now()+interval '1 hour' from ag $$, '23505', 'checkout_sessions_idempotency_key_key', 'req 33: duplicate idempotency_key is rejected [A4-064]');
-- R35 one live session per (agreement, mode); modes coexist
select denied($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) select id,'k_b2y',100,true,now()+interval '1 hour' from ag $$, '23505', 'checkout_sessions_live_uq', 'req 35: a second live session for the same agreement+mode is rejected [A4-065]');
select lives_ok($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) select id,'k_b2t',100,false,now()+interval '1 hour' from ag $$, 'req 35: a test-mode session coexists with the live one [A4-066]');
-- R36 completing frees the slot
update finance.checkout_sessions set status='completed' where idempotency_key='k_b2';
select lives_ok($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) select id,'k_b2z',100,true,now()+interval '1 hour' from ag $$, 'req 36: completing the live session frees the slot for a new one [A4-067]');
-- R32e stripe side: legacy_donation_id is import traceability, not provenance
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,legacy_donation_id) select id,'stripe_payment',88,'stripe','ch_ld','pi_ld',now(),true,'aaaaaaaa-bbbb-4ccc-8ddd-000000000001'::uuid from ag $$, 'req 32e: legacy_donation_id accepted on a stripe entry [A4-074]');
-- R36 expiring frees the slot too
update finance.checkout_sessions set status='expired', stripe_session_id='cs_b2z' where idempotency_key='k_b2z';
select lives_ok($$ insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) select id,'k_b2w',100,true,now()+interval '1 hour' from ag $$, 'req 36: expiring the live session frees the slot as well [A4-075]');
-- R38 claim guard (mechanism added in this commit)
insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by) select id,'tok_exp',now() - interval '1 hour','11111111-1111-1111-1111-111111111111' from ag;
select denied($$ update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok_exp' $$, 'P0001', 'link claim rejected: link expired at', 'req 38: claiming an EXPIRED link is rejected [A4-068]');
insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by) select id,'tok_live',now() + interval '1 day','11111111-1111-1111-1111-111111111111' from ag;
update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok_live' and status='active';
select denied($$ update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok_exp' $$, 'P0001', 'link claim rejected', 'req 38: a non-active link cannot be claimed [A4-069]');
update finance.payment_links set status='consumed', consumed_at=now(), consumed_by_session_id=(select id from finance.checkout_sessions where idempotency_key='k_b2z') where token_hash='tok_live';
select denied($$ update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok_live' $$, 'P0001', 'only an active link can be claimed, status is consumed', 'req 38: claiming a CONSUMED link is rejected [A4-070]');
-- R39 exception shape
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolution_status) values ('amount_mismatch',true,'ch_b2','resolved') $$, 'P0001', 'a new exception must be created open', 'req 39: a non-open exception row is rejected at INSERT by the guard above the exc_open_iff_unresolved CHECK [A4-071]');
-- R40 service_role INSERT on stripe_events
set local role service_role;
select lives_ok($$ insert into finance.stripe_events(event_id,event_type,object_id,livemode,payload) values ('evt_b2','charge.succeeded','ch_b2evt',true,'{}'::jsonb) $$, 'req 40: service_role can INSERT a stripe event [A4-072]');
select is((select count(*)::int from finance.stripe_events where event_id='evt_b2'), 1, 'req 40: service_role can SELECT what it wrote [A4-073]');
reset role;

-- ===== Checkpoint B batch 3: clause-completion probes =====
-- R41: the append-only TRIGGER raises for service_role even when the grant
-- layer is widened -- the same simulate-the-drifted-ACL pattern as req 121.
grant update, delete on finance.ledger_entries to service_role;
grant select on ag to service_role;
set local role service_role;
select denied($$ update finance.ledger_entries set amount_cents=1 where agreement_id=(select id from ag) $$, 'P0001', 'append-only', 'req 41: with the grant widened, service_role UPDATE still dies in the append-only trigger [A4-076]');
select denied($$ delete from finance.ledger_entries where agreement_id=(select id from ag) $$, 'P0001', 'append-only', 'req 41: with the grant widened, service_role DELETE still dies in the append-only trigger [A4-077]');
reset role;
revoke update, delete on finance.ledger_entries from service_role;
-- R51: a refund may not target a REVERSAL either
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-10,'stripe','re_rv',r.id,now(),true from ag a, (select id from finance.ledger_entries where entry_type='reversal' limit 1) r $$, 'P0001', 'a refund may only target a payment', 'req 51: a refund may not target a reversal [A4-078]');
-- R52: a reversal REQUIRES a parent
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,occurred_at,livemode,reason,recorded_by) select id,'reversal',-10,'stripe',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_l4_reversal', 'req 52: a reversal without a parent is rejected by the L4 shape CHECK [A4-079]');
-- R57: self-parent rejected BEHAVIOURALLY (the CHECK exists structurally at A4-005)
select denied($$ update finance.ledger_entries set parent_entry_id=id where id=(select id from finance.ledger_entries limit 1) $$, 'P0001', 'append-only', 'req 57: no path can even attempt self-parenting -- the fact table is append-only [A4-080]');
select is((select count(*)::int from pg_constraint where conrelid='finance.ledger_entries'::regclass and pg_get_constraintdef(oid) ilike '%parent_entry_id IS DISTINCT FROM id%'), 1, 'req 57: the L5 self-parent CHECK is present for the INSERT path [A4-081]');
-- R58: a ledger entry cannot exist without an agreement
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) values ('00000000-0000-0000-0000-000000000000','stripe_payment',10,'stripe','ch_na','pi_na',now(),true) $$, '23503', 'ledger_entries_agreement_id_fkey', 'req 58: a ledger entry with no agreement violates the FK [A4-082]');

-- ===== Checkpoint B batch 4: clause-completion probes =====
-- Fresh fixtures: the file's main agreement is canceled and refund-saturated
-- by this point. EOF block; file rollback cleans up.
insert into auth.users values ('55555555-5555-5555-5555-555555555555','r64@t');
insert into public.member_profiles values ('55555555-5555-5555-5555-555555555555','r64@t');
insert into public.members(id,profile_id,email) values ('eeeeeeee-0000-0000-0000-00000000000e','55555555-5555-5555-5555-555555555555','r64@t');
select finance.create_agreement('eeeeeeee-0000-0000-0000-00000000000e','cccccccc-0000-0000-0000-00000000000c','journey_contribution','b4 fixture');
create temp table ag4 as select id from finance.agreements where member_id='eeeeeeee-0000-0000-0000-00000000000e' and purpose='journey_contribution';
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,100000,now(),'b4','11111111-1111-1111-1111-111111111111' from ag4;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',40000,'stripe','ch_b4','pi_b4',now(),true from ag4;
-- R61: remaining under a partial payment (mid-range state)
select is((select remaining_cents::bigint from finance.v_agreement_balances where agreement_id=(select id from ag4)), 60000::bigint,
  'req 61: remaining_cents = contribution - net received in a mid-range state [A4-083]');
select is((select payable_remaining_cents::bigint from finance.v_agreement_balances where agreement_id=(select id from ag4)), 60000::bigint,
  'req 61: payable_remaining_cents matches in the mid-range state [A4-093]');
-- R63: refunded-to-zero reports refunded, distinct from unpaid
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-40000,'stripe','re_b4',(select id from finance.ledger_entries where agreement_id=a.id and entry_type='stripe_payment'),now(),true from ag4 a;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag4)), 'refunded',
  'req 63: refunded-to-zero reports refunded, distinct from unpaid [A4-084]');
-- R64: payment recorded in error then REVERSED returns unpaid, not refunded
insert into public.journeys(id,name) values ('dddddddd-1111-0000-0000-00000000000d','J2');
select finance.create_agreement('eeeeeeee-0000-0000-0000-00000000000e','dddddddd-1111-0000-0000-00000000000d','journey_contribution','b4r64');
create temp table ag5 as select id from finance.agreements where journey_id='dddddddd-1111-0000-0000-00000000000d';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',5000,'stripe','ch_b5','pi_b5',now(),true from ag5;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-5000,'stripe',(select id from finance.ledger_entries where agreement_id=a.id),now(),true,'error','11111111-1111-1111-1111-111111111111' from ag5 a;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag5)), 'unpaid',
  'req 64: a reversed-in-error payment returns unpaid, not refunded [A4-094]');
-- R66: gift money counts toward JOURNEY Received
select finance.create_agreement('eeeeeeee-0000-0000-0000-00000000000e','cccccccc-0000-0000-0000-00000000000c','additional_gift','b4gift');
create temp table ag6 as select id from finance.agreements where member_id='eeeeeeee-0000-0000-0000-00000000000e' and purpose='additional_gift';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',700,'stripe','ch_b6','pi_b6',now(),true from ag6;
select ok((select gross_received_cents >= 700 from finance.v_journey_financials where journey_id='cccccccc-0000-0000-0000-00000000000c'),
  'req 66: gift money counts toward journey Received [A4-085]');
-- R72: remaining graph directions on the fresh agreement (ag4 is draft)
select lives_ok($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) select id,'draft','active','a','11111111-1111-1111-1111-111111111111' from ag4 $$, 'req 72: draft->active on a fresh agreement [A4-095]');
select lives_ok($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) select id,'active','waived','w','11111111-1111-1111-1111-111111111111' from ag4 $$, 'req 72: active->waived permitted [A4-086]');
select denied($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) select id,'waived','active','back','11111111-1111-1111-1111-111111111111' from ag4 $$, 'P0001', 'illegal lifecycle transition waived', 'req 72: waived is terminal [A4-087]');
-- R73: a link cannot be born revoked (INSERT guard above the CHECK)
select denied($$ insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by,status,revoked_at) select id,'tok_r73',now()+interval '1 day','11111111-1111-1111-1111-111111111111','revoked',now() from ag4 $$, 'P0001', 'a new payment link must be created active', 'req 73: a link cannot be born revoked; the link_revoked_complete CHECK backstops UPDATE paths [A4-088]');
-- R75: column-scoped service_role UPDATE
set local role service_role;
select denied($$ update finance.reconciliation_exceptions set kind='amount_mismatch' where provider_object_id='no-such-object' $$, '42501', 'permission denied', 'req 75: service_role UPDATE outside the granted column list is rejected [A4-089]');
reset role;
-- R76: USD constraints at INSERT (agreements are append-only, so UPDATE cannot even reach the CHECK)
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,currency,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',10,'EUR','stripe','ch_eur','pi_eur',now(),true from ag4 $$, '23514', 'ledger_entries_currency_check', 'req 76: a non-USD ledger entry is rejected [A4-090]');
select denied($$ insert into finance.agreements(member_id,purpose,currency,created_by) values ('eeeeeeee-0000-0000-0000-00000000000e','journey_contribution','EUR','11111111-1111-1111-1111-111111111111') $$, '23514', 'agreements_currency_check', 'req 76: a non-USD agreement is rejected at INSERT; UPDATE cannot reach the CHECK (append-only) [A4-091]');
-- R77: a running run carrying finished_at is rejected
select denied($$ insert into finance.reconciliation_runs(livemode,window_start,window_end,status,finished_at,implementation_version) values (true,now()-interval '2 hour',now()-interval '1 hour','running',now(),'v1') $$, 'P0001', 'run', 'req 77: a running run carrying finished_at is rejected [A4-092]');
select * from finish();
rollback;
