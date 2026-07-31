begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(70);

-- fixtures
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111','founder@test'),
  ('22222222-2222-2222-2222-222222222222','memberA@test'),
  ('33333333-3333-3333-3333-333333333333','memberB@test');
insert into public.user_roles (user_id, role) values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles (id,email) values
  ('22222222-2222-2222-2222-222222222222','memberA@test'),
  ('33333333-3333-3333-3333-333333333333','memberB@test');
-- deliberately id <> profile_id, the production shape D-015 exists for
insert into public.members (id, profile_id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','memberA@test'),
  ('bbbbbbbb-0000-0000-0000-00000000000b','33333333-3333-3333-3333-333333333333','memberB@test');
insert into public.journeys (id,name) values ('cccccccc-0000-0000-0000-00000000000c','J1');

select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);

-- ============ create_agreement / lifecycle ============
select lives_ok($$ select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','initial') $$,
  'test 71: create_agreement succeeds for a founder');
select throws_real($$ select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','  ') $$, 'test 71: blank reason raises');
select throws_real($$ select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','dup') $$, 'test 17: duplicate (member,journey,purpose) raises');

create temp table ag as select id from finance.agreements limit 1;

select is((select current_status::text from finance.v_agreement_lifecycle
           where agreement_id=(select id from ag)), 'draft',
          'test 18: initial lifecycle event is draft');

-- test 133: agreement without an initial event fails AT COMMIT
-- The completeness trigger is DEFERRABLE INITIALLY DEFERRED, so it fires at
-- COMMIT. Inside a test transaction we force it with SET CONSTRAINTS IMMEDIATE,
-- which is the same check at the same moment the commit would run it.
select throws_real($$
  do $b$ begin
    insert into finance.agreements (member_id,journey_id,purpose,created_by)
    values ('bbbbbbbb-0000-0000-0000-00000000000b',null,'other','11111111-1111-1111-1111-111111111111');
    set constraints finance.agreement_has_lifecycle immediate;
  end $b$; $$, 'test 133: agreement with no initial event fails the deferred completeness check');

-- test 133b: child-first is rejected (FK is non-deferrable)
select throws_real($$ insert into finance.agreement_lifecycle_events
    (agreement_id,from_status,to_status,reason,actor_id)
    values ('dddddddd-0000-0000-0000-00000000000d',null,'draft','x','11111111-1111-1111-1111-111111111111') $$, 'test 133b: child-first insert is rejected');

-- test 72: transition graph
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','active','go','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: draft->active permitted');
select throws_real($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','draft','back','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: active->draft rejected');
select throws_real($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','active','stale','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: stale from_status rejected');
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','fulfilled','done','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: active->fulfilled permitted');
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'fulfilled','active','reopen','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: fulfilled->active permitted');
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','canceled','stop','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: active->canceled permitted');
select throws_real($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'canceled','active','undo','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: canceled is terminal');

-- ============ append-only (tests 4-7) ============
insert into finance.agreement_amounts (agreement_id,amount_cents,effective_at,reason,actor_id)
  select id, 100000, now(), 'set', '11111111-1111-1111-1111-111111111111' from ag;
select throws_real($$ update finance.agreement_amounts set amount_cents=1 $$, 'test 6: amounts cannot be UPDATEd');
select throws_real($$ delete from finance.agreement_amounts $$, 'test 6: amounts cannot be DELETEd');
select throws_real($$ update finance.agreement_lifecycle_events set reason='x' $$, 'test 7: lifecycle events cannot be UPDATEd');
select throws_real($$ delete from finance.agreement_lifecycle_events $$, 'test 7: lifecycle events cannot be DELETEd');

-- test 15: future-dated amendment rejected
select throws_real($$ insert into finance.agreement_amounts (agreement_id,amount_cents,effective_at,reason,actor_id)
  select id, 1, now()+interval '1 day','future','11111111-1111-1111-1111-111111111111' from ag $$, 'test 15: future-dated amendment rejected');

-- test 23/24: contribution resolves by seq when effective_at ties
insert into finance.agreement_amounts (agreement_id,amount_cents,effective_at,reason,actor_id)
  select id, 250000, (select effective_at from finance.agreement_amounts limit 1),'amend','11111111-1111-1111-1111-111111111111' from ag;
select is((select contribution_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          250000::bigint, 'test 23/24: last-recorded amendment wins on an effective_at tie');

-- ============ ledger invariants ============
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',5000,'stripe',null,now(),true from ag $$, 'test 28 (L1): stripe_payment without payment-intent id rejected');
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by)
  select id,'external_payment',5000,'external',null,now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, 'test 29 (L2): external_payment without method rejected');
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode)
  select id,'external_payment',5000,'external','cash',now(),true from ag $$, 'test 29 (L12): external_payment with no attribution rejected');
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_payment_intent_id,external_method,occurred_at,livemode)
  select id,'stripe_payment',5000,'stripe','pi_x','cash',now(),true from ag $$, 'test 32c (L13): stripe entry carrying external_method rejected');
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,provider_payment_intent_id,occurred_at,livemode,reason,recorded_by)
  select id,'external_payment',5000,'external','cash','pi_x',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, 'test 32d (L13): external entry carrying a payment-intent id rejected');
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by,recorded_by_system)
  select id,'external_payment',5000,'external','cash',now(),true,'r','11111111-1111-1111-1111-111111111111','legacy_import' from ag $$, 'test 32 (L12): both human and system attribution rejected');

-- a good payment
insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',100000,'stripe','ch_1','pi_1',now(),true from ag;
create temp table pay as select id from finance.ledger_entries where entry_type='stripe_payment' limit 1;

select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','ch_1','pi_2',now(),true from ag $$, 'test 36 (L8): duplicate provider object rejected');
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','ch_2','pi_1',now(),true from ag $$, 'test 37 (L8b): duplicate payment intent rejected');

-- refunds
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-200000,'stripe','re_big',p.id,now(),true from ag a, pay p $$, 'test 41 (L7): refund exceeding settled amount rejected');
select lives_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-30000,'stripe','re_1',p.id,now(),true from ag a, pay p $$,
  'test 39: partial refund succeeds');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          70000::bigint, 'test 38: refund reduces net Received');

create temp table ref as select id from finance.ledger_entries where entry_type='refund' limit 1;

-- test 45: reversal rejected while parent has an unreversed child
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-100000,'stripe',p.id,now(),true,'undo','11111111-1111-1111-1111-111111111111' from ag a, pay p $$, 'test 45 (L6): reversal rejected while parent has an unreversed child');

-- test 46: the full unwind executes
select lives_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',30000,'stripe',r.id,now(),true,'undo refund','11111111-1111-1111-1111-111111111111' from ag a, ref r $$,
  'test 46: reversal of the refund succeeds');
select lives_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-100000,'stripe',p.id,now(),true,'undo payment','11111111-1111-1111-1111-111111111111' from ag a, pay p $$,
  'test 46: reversal of the payment now succeeds');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          0::bigint, 'test 46: full unwind returns net Received to 0');

-- test 63/62: fully unwound is unpaid, not refunded
select is((select refunded_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          0::bigint, 'test 63: a reversed refund does not count toward refunded_cents');
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag)),
          'unpaid', 'test 63: fully unwound agreement is unpaid, not refunded');

-- test 47: double reversal impossible
select throws_real($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-100000,'stripe',p.id,now(),true,'again','11111111-1111-1111-1111-111111111111' from ag a, pay p $$, 'test 47: an entry cannot be reversed twice');

-- test 58: zero-row aggregates coalesce
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b',null,'membership','new');
select is((select net_received_cents from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='membership'),
          0::bigint, 'test 58: agreement with no entries returns 0, not NULL');
select is((select payment_state::text from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='membership'),
          'unpaid', 'test 58: agreement with no entries is unpaid, not partial');

-- test 64: gift agreement is not_applicable
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c','additional_gift','gift');
select is((select payment_state::text from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='additional_gift'),
          'not_applicable', 'test 64: gift agreement is not_applicable');
select is((select remaining_cents from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='additional_gift'),
          null, 'test 64: gift agreement has NULL remaining');

-- ============ run state machine ============
select throws_real($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'completed',false,now()) $$, 'test 84: completed with window_exhausted=false rejected');
select throws_real($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'partial',true,now()) $$, 'test 84: partial with window_exhausted=true rejected');
select throws_real($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted)
  values (true,'v1',now()-interval '1 day',now(),true,'running',true) $$, 'test 84: running with window_exhausted=true rejected');
select lives_ok($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'completed',true,now()) $$,
  'test 84: completed with window_exhausted=true accepted');
select throws_real($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'running',false,now()) $$, 'test 83: running carrying finished_at rejected');

-- test 107: implementation_version required
select throws_real($$ insert into finance.reconciliation_runs (livemode,window_start,window_end,dry_run)
  values (true,now()-interval '1 day',now(),true) $$, 'test 107: implementation_version is required');

-- test 129: approval fields cannot be inserted
select throws_real($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,approved_by,approved_at,approval_note)
  values (true,'v1',now()-interval '1 day',now(),true,'11111111-1111-1111-1111-111111111111',now(),'sneak') $$, 'test 129: a run cannot be created already approved');

create temp table dry as select id from finance.reconciliation_runs where dry_run limit 1;

-- test 104: approval preconditions (no report yet)
select throws_real($$ select finance.approve_dry_run((select id from dry),'ok') $$, 'test 104: approval without a completed report raises');

update finance.reconciliation_runs
   set would_create_count=10, would_reopen_count=0, prospective_by_kind='{}'::jsonb,
       report_version='r1', report_completed_at=now()
 where id=(select id from dry);

select lives_ok($$ select finance.approve_dry_run((select id from dry),'reviewed') $$,
  'test 103: approve_dry_run succeeds once');
select is((select approved_by from finance.reconciliation_runs where id=(select id from dry)),
          '11111111-1111-1111-1111-111111111111'::uuid, 'test 103: approved_by is auth.uid(), not supplied');
select throws_real($$ select finance.approve_dry_run((select id from dry),'again') $$, 'test 103: a second approval raises');
select throws_real($$ select finance.approve_dry_run((select id from dry),'  ') $$, 'test 114: blank approval note raises');

-- test 105/115: approved evidence is frozen
select throws_real($$ update finance.reconciliation_runs set window_end=now()+interval '1 day' where id=(select id from dry) $$, 'test 105: window_end frozen after approval');
select throws_real($$ update finance.reconciliation_runs set report_version='r2' where id=(select id from dry) $$, 'test 105: report frozen after approval');
select throws_real($$ update finance.reconciliation_runs set implementation_version='v2' where id=(select id from dry) $$, 'test 105: implementation_version frozen after approval');

-- ============ exceptions ============
-- test 123/124: insert guard
select lives_ok($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_9') $$, 'test 123: ordinary exception creation succeeds');
select throws_real($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,resolution_status,resolved_at,resolved_by,resolution_note)
  values ('amount_mismatch',true,'ch_10','resolved',now(),'11111111-1111-1111-1111-111111111111','pre') $$, 'test 124: cannot create an exception already resolved');
select throws_real($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,quarantined_at,quarantine_reason)
  values ('amount_mismatch',true,'ch_11',now(),'x') $$, 'test 124: cannot create an exception already quarantined');

-- test 102: dedup_key is generated and cannot be supplied
select throws_real($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,dedup_key)
  values ('amount_mismatch',true,'ch_12','ATTACK') $$, 'test 102: dedup_key cannot be supplied by the writer');
select is((select dedup_key from finance.reconciliation_exceptions where provider_object_id='ch_9'),
          'amount_mismatch:ch_9:::', 'test 102: dedup_key is the canonical construction');

-- test 79: open-row uniqueness
select throws_real($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_9') $$, 'test 79: a second open exception with the same identity is rejected');

-- test 99: provider_object_processing_failed shape
select throws_real($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('provider_object_processing_failed',true,'ch_20') $$, 'test 99: processing-failure without detail rejected');
select lives_ok($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,detail)
  values ('provider_object_processing_failed',true,'ch_20','{"object_type":"charge","error_class":"object_not_found"}'::jsonb) $$,
  'test 99: well-formed processing failure accepted');

-- test 118/119: resolution attribution
create temp table exc as select id from finance.reconciliation_exceptions where provider_object_id='ch_9' limit 1;
select throws_real($$ select finance.resolve_exception((select id from exc),'open','x') $$, 'test 119: resolving to open raises');
select throws_real($$ select finance.resolve_exception((select id from exc),'resolved','  ') $$, 'test 119: blank resolution note raises');
select lives_ok($$ select finance.resolve_exception((select id from exc),'resolved','checked') $$,
  'test 118: resolve_exception succeeds for a founder');
select is((select resolved_by from finance.reconciliation_exceptions where id=(select id from exc)),
          '11111111-1111-1111-1111-111111111111'::uuid, 'test 118: resolved_by is auth.uid(), not supplied');
select throws_real($$ select finance.resolve_exception((select id from exc),'dismissed','again') $$, 'test 119: repeat resolution raises');

-- test 120: resolution frees the open-row index
select lives_ok($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_9') $$,
  'test 120: a resolved exception does not block a fresh row for the same identity');

select * from finish();
rollback;
