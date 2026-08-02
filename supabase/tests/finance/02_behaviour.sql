begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(71);

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
  'test 71: create_agreement succeeds for a founder [A2-050]');
select denied($$ select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','  ') $$, 'P0001', 'create_agreement: a non-blank reason is required', 'test 71: blank reason raises [A2-001]');
select denied($$ select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','dup') $$, '23505', 'agreements_member_journey_purpose_key', 'test 17: duplicate (member,journey,purpose) raises [A2-002]');
-- R17 second clause: the index is NULLS NOT DISTINCT, so two MEMBER-LEVEL
-- agreements (journey_id NULL) with the same purpose are duplicates too.
-- Savepoint-scoped: the rest of this file assumes exactly one agreement.
savepoint r17;
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','member-level fixture');
select denied($$ select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','dup member-level') $$, '23505', 'agreements_member_journey_purpose_key', 'req 17: NULLS NOT DISTINCT -- a duplicate member-level (NULL journey) agreement raises [A2-071]');
rollback to savepoint r17;

create temp table ag as select id from finance.agreements limit 1;

select is((select current_status::text from finance.v_agreement_lifecycle
           where agreement_id=(select id from ag)), 'draft',
          'test 18: initial lifecycle event is draft [A2-003]');

-- test 133: agreement without an initial event fails AT COMMIT
-- The completeness trigger is DEFERRABLE INITIALLY DEFERRED, so it fires at
-- COMMIT. Inside a test transaction we force it with SET CONSTRAINTS IMMEDIATE,
-- which is the same check at the same moment the commit would run it.
select denied($$
  do $b$ begin
    insert into finance.agreements (member_id,journey_id,purpose,created_by)
    values ('bbbbbbbb-0000-0000-0000-00000000000b',null,'other','11111111-1111-1111-1111-111111111111');
    set constraints finance.agreement_has_lifecycle immediate;
  end $b$; $$, 'P0001', 'agreement b3f43a33-f781-4866-b7ca-8b13a1491a73 must have exactly one', 'test 133: agreement with no initial event fails the deferred completeness check [A2-051]');

-- test 133b: child-first is rejected (FK is non-deferrable)
select denied($$ insert into finance.agreement_lifecycle_events
    (agreement_id,from_status,to_status,reason,actor_id)
    values ('dddddddd-0000-0000-0000-00000000000d',null,'draft','x','11111111-1111-1111-1111-111111111111') $$, 'P0001', 'agreement dddddddd-0000-0000-0000-00000000000d does not exist', 'test 133b: child-first insert is rejected [A2-052]');

-- test 72: transition graph
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','active','go','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: draft->active permitted [A2-053]');
select denied($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','draft','back','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'illegal lifecycle transition active -> draft', 'test 72: active->draft rejected [A2-004]');
select denied($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','active','stale','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'stale transition: from_status draft but current status is active', 'test 72: stale from_status rejected [A2-005]');
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','fulfilled','done','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: active->fulfilled permitted [A2-006]');
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'fulfilled','active','reopen','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: fulfilled->active permitted [A2-007]');
select lives_ok($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','canceled','stop','11111111-1111-1111-1111-111111111111' from ag $$, 'test 72: active->canceled permitted [A2-008]');
select denied($$ insert into finance.agreement_lifecycle_events (agreement_id,from_status,to_status,reason,actor_id)
  select id,'canceled','active','undo','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'illegal lifecycle transition canceled -> active', 'test 72: canceled is terminal [A2-009]');

-- ============ append-only (tests 4-7) ============
insert into finance.agreement_amounts (agreement_id,amount_cents,effective_at,reason,actor_id)
  select id, 100000, now(), 'set', '11111111-1111-1111-1111-111111111111' from ag;
select denied($$ update finance.agreement_amounts set amount_cents=1 $$, 'P0001', 'UPDATE on agreement_amounts is forbidden: agreement_amounts is an', 'test 6: amounts cannot be UPDATEd [A2-010]');
select denied($$ delete from finance.agreement_amounts $$, 'P0001', 'DELETE on agreement_amounts is forbidden: agreement_amounts is an', 'test 6: amounts cannot be DELETEd [A2-011]');
select denied($$ update finance.agreement_lifecycle_events set reason='x' $$, 'P0001', 'UPDATE on agreement_lifecycle_events is forbidden:', 'test 7: lifecycle events cannot be UPDATEd [A2-012]');
select denied($$ delete from finance.agreement_lifecycle_events $$, 'P0001', 'DELETE on agreement_lifecycle_events is forbidden:', 'test 7: lifecycle events cannot be DELETEd [A2-013]');

-- test 15: future-dated amendment rejected
select denied($$ insert into finance.agreement_amounts (agreement_id,amount_cents,effective_at,reason,actor_id)
  select id, 1, now()+interval '1 day','future','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'future-dated amendment rejected: effective_at 2026-08-02', 'test 15: future-dated amendment rejected [A2-054]');

-- test 23/24: contribution resolves by seq when effective_at ties
insert into finance.agreement_amounts (agreement_id,amount_cents,effective_at,reason,actor_id)
  select id, 250000, (select effective_at from finance.agreement_amounts limit 1),'amend','11111111-1111-1111-1111-111111111111' from ag;
select is((select contribution_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          250000::bigint, 'test 23/24: last-recorded amendment wins on an effective_at tie [A2-014]');

-- ============ ledger invariants ============
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',5000,'stripe',null,now(),true from ag $$, '23514', 'ledger_entries', 'test 28 (L1): stripe_payment without payment-intent id rejected [A2-055]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by)
  select id,'external_payment',5000,'external',null,now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_entries', 'test 29 (L2): external_payment without method rejected [A2-015]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode)
  select id,'external_payment',5000,'external','cash',now(),true from ag $$, '23514', 'ledger_entries', 'test 29 (L12): external_payment with no attribution rejected [A2-016]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_payment_intent_id,external_method,occurred_at,livemode)
  select id,'stripe_payment',5000,'stripe','pi_x','cash',now(),true from ag $$, '23514', 'ledger_entries', 'test 32c (L13): stripe entry carrying external_method rejected [A2-017]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,provider_payment_intent_id,occurred_at,livemode,reason,recorded_by)
  select id,'external_payment',5000,'external','cash','pi_x',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag $$, '23514', 'ledger_entries', 'test 32d (L13): external entry carrying a payment-intent id rejected [A2-018]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by,recorded_by_system)
  select id,'external_payment',5000,'external','cash',now(),true,'r','11111111-1111-1111-1111-111111111111','legacy_import' from ag $$, '23514', 'ledger_entries', 'test 32 (L12): both human and system attribution rejected [A2-019]');

-- a good payment
insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',100000,'stripe','ch_1','pi_1',now(),true from ag;
create temp table pay as select id from finance.ledger_entries where entry_type='stripe_payment' limit 1;

select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','ch_1','pi_2',now(),true from ag $$, '23505', 'ledger_entries_provider_object_uq', 'test 36 (L8): duplicate provider object rejected [A2-020]');
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',1,'stripe','ch_2','pi_1',now(),true from ag $$, '23505', 'ledger_entries_payment_intent_uq', 'test 37 (L8b): duplicate payment intent rejected [A2-021]');

-- refunds
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-200000,'stripe','re_big',p.id,now(),true from ag a, pay p $$, 'P0001', 'L7: cumulative refunds 200000 exceed settled amount 100000 on entry', 'test 41 (L7): refund exceeding settled amount rejected [A2-056]');
select lives_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode)
  select a.id,'refund',-30000,'stripe','re_1',p.id,now(),true from ag a, pay p $$,
  'test 39: partial refund succeeds [A2-022]');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          70000::bigint, 'test 38: refund reduces net Received [A2-023]');

create temp table ref as select id from finance.ledger_entries where entry_type='refund' limit 1;

-- test 45: reversal rejected while parent has an unreversed child
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-100000,'stripe',p.id,now(),true,'undo','11111111-1111-1111-1111-111111111111' from ag a, pay p $$, 'P0001', 'L6: parent 2635a3e4-3553-4238-accf-d06c6d5d24f2 has 1 unreversed', 'test 45 (L6): reversal rejected while parent has an unreversed child [A2-057]');

-- test 46: the full unwind executes
select lives_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',30000,'stripe',r.id,now(),true,'undo refund','11111111-1111-1111-1111-111111111111' from ag a, ref r $$,
  'test 46: reversal of the refund succeeds [A2-058]');
select lives_ok($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-100000,'stripe',p.id,now(),true,'undo payment','11111111-1111-1111-1111-111111111111' from ag a, pay p $$,
  'test 46: reversal of the payment now succeeds [A2-024]');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          0::bigint, 'test 46: full unwind returns net Received to 0 [A2-025]');

-- test 63/62: fully unwound is unpaid, not refunded
select is((select refunded_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),
          0::bigint, 'test 63: a reversed refund does not count toward refunded_cents [A2-059]');
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag)),
          'unpaid', 'test 63: fully unwound agreement is unpaid, not refunded [A2-026]');

-- test 47: double reversal impossible
select denied($$ insert into finance.ledger_entries (agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by)
  select a.id,'reversal',-100000,'stripe',p.id,now(),true,'again','11111111-1111-1111-1111-111111111111' from ag a, pay p $$, 'P0001', 'L6: parent 2635a3e4-3553-4238-accf-d06c6d5d24f2 has 1 unreversed', 'test 47: an entry cannot be reversed twice [A2-060]');

-- test 58: zero-row aggregates coalesce
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b',null,'membership','new');
select is((select net_received_cents from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='membership'),
          0::bigint, 'test 58: agreement with no entries returns 0, not NULL [A2-027]');
select is((select payment_state::text from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='membership'),
          'unpaid', 'test 58: agreement with no entries is unpaid, not partial [A2-028]');

-- test 64: gift agreement is not_applicable
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c','additional_gift','gift');
select is((select payment_state::text from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='additional_gift'),
          'not_applicable', 'test 64: gift agreement is not_applicable [A2-029]');
select is((select remaining_cents from finance.v_agreement_balances b
           join finance.agreements a on a.id=b.agreement_id where a.purpose='additional_gift'),
          null, 'test 64: gift agreement has NULL remaining [A2-030]');

-- ============ run state machine ============
select denied($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'completed',false,now()) $$, '23514', 'reconciliation_runs', 'test 84: completed with window_exhausted=false rejected [A2-061]');
select denied($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'partial',true,now()) $$, '23514', 'reconciliation_runs', 'test 84: partial with window_exhausted=true rejected [A2-031]');
select denied($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted)
  values (true,'v1',now()-interval '1 day',now(),true,'running',true) $$, '23514', 'reconciliation_runs', 'test 84: running with window_exhausted=true rejected [A2-032]');
select lives_ok($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'completed',true,now()) $$,
  'test 84: completed with window_exhausted=true accepted [A2-033]');
select denied($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (true,'v1',now()-interval '1 day',now(),true,'running',false,now()) $$, '23514', 'reconciliation_runs', 'test 83: running carrying finished_at rejected [A2-034]');

-- test 107: implementation_version required
select denied($$ insert into finance.reconciliation_runs (livemode,window_start,window_end,dry_run)
  values (true,now()-interval '1 day',now(),true) $$, '23502', 'implementation_version', 'test 107: implementation_version is required [A2-062]');

-- test 129: approval fields cannot be inserted
select denied($$ insert into finance.reconciliation_runs (livemode,implementation_version,window_start,window_end,dry_run,approved_by,approved_at,approval_note)
  values (true,'v1',now()-interval '1 day',now(),true,'11111111-1111-1111-1111-111111111111',now(),'sneak') $$, 'P0001', 'a new run may not be created already approved: approval is', 'test 129: a run cannot be created already approved [A2-063]');

create temp table dry as select id from finance.reconciliation_runs where dry_run limit 1;

-- test 104: approval preconditions (no report yet)
select denied($$ select finance.approve_dry_run((select id from dry),'ok') $$, 'P0001', 'approve_dry_run: run 08659f13-952f-4887-aeab-807efe01ed3a has no', 'test 104: approval without a completed report raises [A2-064]');

update finance.reconciliation_runs
   set would_create_count=10, would_reopen_count=0, prospective_by_kind='{}'::jsonb,
       report_version='r1', report_completed_at=now()
 where id=(select id from dry);

select lives_ok($$ select finance.approve_dry_run((select id from dry),'reviewed') $$,
  'test 103: approve_dry_run succeeds once [A2-035]');
select is((select approved_by from finance.reconciliation_runs where id=(select id from dry)),
          '11111111-1111-1111-1111-111111111111'::uuid, 'test 103: approved_by is auth.uid(), not supplied [A2-036]');
select denied($$ select finance.approve_dry_run((select id from dry),'again') $$, 'P0001', 'approve_dry_run: run 08659f13-952f-4887-aeab-807efe01ed3a is already', 'test 103: a second approval raises [A2-037]');
select denied($$ select finance.approve_dry_run((select id from dry),'  ') $$, 'P0001', 'approve_dry_run: a non-blank note is required', 'test 114: blank approval note raises [A2-038]');

-- test 105/115: approved evidence is frozen
select denied($$ update finance.reconciliation_runs set window_end=now()+interval '1 day' where id=(select id from dry) $$, 'P0001', 'approved evidence is frozen: run 08659f13-952f-4887-aeab-807efe01ed3a', 'test 105: window_end frozen after approval [A2-065]');
select denied($$ update finance.reconciliation_runs set report_version='r2' where id=(select id from dry) $$, 'P0001', 'approved evidence is frozen: run 08659f13-952f-4887-aeab-807efe01ed3a', 'test 105: report frozen after approval [A2-039]');
select denied($$ update finance.reconciliation_runs set implementation_version='v2' where id=(select id from dry) $$, 'P0001', 'approved evidence is frozen: run 08659f13-952f-4887-aeab-807efe01ed3a', 'test 105: implementation_version frozen after approval [A2-040]');

-- ============ exceptions ============
-- test 123/124: insert guard
select lives_ok($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_9') $$, 'test 123: ordinary exception creation succeeds [A2-066]');
select denied($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,resolution_status,resolved_at,resolved_by,resolution_note)
  values ('amount_mismatch',true,'ch_10','resolved',now(),'11111111-1111-1111-1111-111111111111','pre') $$, 'P0001', 'a new exception must be created open, got resolved', 'test 124: cannot create an exception already resolved [A2-041]');
select denied($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,quarantined_at,quarantine_reason)
  values ('amount_mismatch',true,'ch_11',now(),'x') $$, 'P0001', 'a new exception may not be created with resolution, quarantine or', 'test 124: cannot create an exception already quarantined [A2-042]');

-- test 102: dedup_key is generated and cannot be supplied
select denied($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,dedup_key)
  values ('amount_mismatch',true,'ch_12','ATTACK') $$, '428C9', 'dedup_key', 'test 102: dedup_key cannot be supplied by the writer [A2-067]');
select is((select dedup_key from finance.reconciliation_exceptions where provider_object_id='ch_9'),
          'amount_mismatch:ch_9:::', 'test 102: dedup_key is the canonical construction [A2-043]');

-- test 79: open-row uniqueness
select denied($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_9') $$, '23505', 'reconciliation_exceptions_open_uq', 'test 79: a second open exception with the same identity is rejected [A2-068]');

-- test 99: provider_object_processing_failed shape
select denied($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('provider_object_processing_failed',true,'ch_20') $$, '23514', 'reconciliation_exceptions', 'test 99: processing-failure without detail rejected [A2-069]');
select lives_ok($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id,detail)
  values ('provider_object_processing_failed',true,'ch_20','{"object_type":"charge","error_class":"object_not_found"}'::jsonb) $$,
  'test 99: well-formed processing failure accepted [A2-044]');

-- test 118/119: resolution attribution
create temp table exc as select id from finance.reconciliation_exceptions where provider_object_id='ch_9' limit 1;
select denied($$ select finance.resolve_exception((select id from exc),'open','x') $$, 'P0001', 'resolve_exception: target must be resolved or dismissed, got open', 'test 119: resolving to open raises [A2-045]');
select denied($$ select finance.resolve_exception((select id from exc),'resolved','  ') $$, 'P0001', 'resolve_exception: a non-blank note is required', 'test 119: blank resolution note raises [A2-046]');
select lives_ok($$ select finance.resolve_exception((select id from exc),'resolved','checked') $$,
  'test 118: resolve_exception succeeds for a founder [A2-047]');
select is((select resolved_by from finance.reconciliation_exceptions where id=(select id from exc)),
          '11111111-1111-1111-1111-111111111111'::uuid, 'test 118: resolved_by is auth.uid(), not supplied [A2-048]');
select denied($$ select finance.resolve_exception((select id from exc),'dismissed','again') $$, 'P0001', 'resolve_exception: exception 8f3c00ee-b736-4bbc-b61f-98c13e0ce60d is', 'test 119: repeat resolution raises [A2-049]');

-- test 120: resolution frees the open-row index
select lives_ok($$ insert into finance.reconciliation_exceptions (kind,livemode,provider_object_id)
  values ('amount_mismatch',true,'ch_9') $$,
  'test 120: a resolved exception does not block a fresh row for the same identity [A2-070]');

select * from finish();
rollback;
