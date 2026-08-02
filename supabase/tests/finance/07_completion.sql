begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(80);

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
  'draft,active,fulfilled,canceled,waived','req 4: agreement_lifecycle values exact [A7-068]');
select is((select string_agg(e.enumlabel,',' order by e.enumsortorder) from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='finance' and t.typname='payment_state'),
  'unpaid,partial,paid,overpaid,refunded,not_applicable','req 4: payment_state values exact [A7-001]');
select is((select count(*)::int from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname='finance' and t.typname='exception_kind'),12,'req 4: exception_kind has 12 values [A7-002]');

-- req 16: SECURITY DEFINER search_path + no PUBLIC execute
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and p.prosecdef and p.proconfig is null),0,'req 16: every SECURITY DEFINER function pins search_path [A7-069]');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and has_function_privilege('public',p.oid,'EXECUTE')),0,'req 16: EXECUTE is not granted to PUBLIC [A7-003]');

-- req 14: anon has nothing
select is((select count(*)::int from information_schema.role_table_grants where table_schema='finance' and grantee='anon'),0,'req 14: anon holds no table privilege [A7-070]');
select ok(not has_schema_privilege('anon','finance','USAGE'),'req 14: anon has no schema USAGE [A7-004]');

-- req 89: the eight partial unique indexes, by predicate
select is((select count(*)::int from pg_indexes where schemaname='finance' and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'),8,'req 89: exactly 8 partial unique indexes [A7-071]');
select is((select count(*)::int from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='finance' and i.indisunique and i.indpred is not null),8,'req 89: all eight are indexes, not table constraints [A7-005]');

select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','i');
create temp table ag as select id from finance.agreements limit 1;

-- req 24: same-transaction amendments resolve by seq
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,100,now(),'first','11111111-1111-1111-1111-111111111111' from ag;
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) select id,200,(select effective_at from finance.agreement_amounts limit 1),'second','11111111-1111-1111-1111-111111111111' from ag;
select is((select contribution_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),200::bigint,'req 24: same-transaction amendments resolve to the later seq [A7-006]');

-- req 26: view excludes a future-dated row even if one reaches the table
select is((select count(*)::int from finance.agreement_amounts where effective_at > now()),0,'req 26: no future-dated amendment exists [A7-072]');

-- req 60/61/62: calculations
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',500,'stripe','ch_o','pi_o',now(),true from ag;
select is((select remaining_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),-300::bigint,'req 62: overpayment yields negative remaining_cents [A7-007]');
select is((select payable_remaining_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),0::bigint,'req 62: overpayment yields zero payable_remaining_cents [A7-008]');
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag)),'overpaid','req 61: overpaid state [A7-009]');
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b',null,'membership','n');
select is((select count(*)::int from finance.v_agreement_balances where net_received_cents is null or gross_received_cents is null),0,'req 60: no aggregate is ever NULL [A7-010]');

-- req 65: reversed refund excluded from refunded_cents (full unwind)
create temp table pay as select id from finance.ledger_entries where entry_type='stripe_payment' limit 1;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-500,'stripe','re_u',p.id,now(),true from ag a,pay p;
create temp table rf as select id from finance.ledger_entries where entry_type='refund' limit 1;
select is((select refunded_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),500::bigint,'req 65: an unreversed refund counts [A7-011]');
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',500,'stripe',r.id,now(),true,'u','11111111-1111-1111-1111-111111111111' from ag a,rf r;
select is((select refunded_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),0::bigint,'req 65: a reversed refund does not count [A7-012]');
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',-500,'stripe',p.id,now(),true,'u','11111111-1111-1111-1111-111111111111' from ag a,pay p;
select is((select payment_state::text from finance.v_agreement_balances where agreement_id=(select id from ag)),'unpaid','req 65: fully unwound is unpaid [A7-013]');
select is((select net_received_cents from finance.v_agreement_balances where agreement_id=(select id from ag)),0::bigint,'req 54: the full unwind nets to 0 [A7-014]');
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',-500,'stripe',p.id,now(),true,'x','11111111-1111-1111-1111-111111111111' from ag a,pay p $$, 'P0001', 'L6: parent 1815e4d6-ed3d-455a-b45e-ec5669a7bcca has 1 unreversed', 'req 55: an entry cannot be reversed twice [A7-015]');

-- req 53: reversal blocked while parent has an unreversed child
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','m2');
create temp table ag2 as select id from finance.agreements where purpose='membership' and member_id='aaaaaaaa-0000-0000-0000-00000000000a';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',1000,'stripe','ch_x','pi_x',now(),true from ag2;
create temp table p2 as select id from finance.ledger_entries where provider_object_id='ch_x';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-400,'stripe','re_x',p.id,now(),true from ag2 a,p2 p;
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,parent_entry_id,occurred_at,livemode,reason,recorded_by) select a.id,'reversal',-1000,'stripe',p.id,now(),true,'x','11111111-1111-1111-1111-111111111111' from ag2 a,p2 p $$, 'P0001', 'L6: parent 15271575-1fe8-4c28-8699-33b031950523 has 1 unreversed', 'req 53: reversal blocked by an unreversed child [A7-016]');

-- req 30b: stripe refund must target a stripe_payment
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,external_method,occurred_at,livemode,reason,recorded_by) select id,'external_payment',900,'external','cash',now(),true,'r','11111111-1111-1111-1111-111111111111' from ag2;
create temp table ep as select id from finance.ledger_entries where entry_type='external_payment' limit 1;
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) select a.id,'refund',-100,'stripe','re_bad',e.id,now(),true from ag2 a,ep e $$, 'P0001', 'L3b: a stripe refund must target a stripe_payment, parent is', 'req 30b: a stripe refund cannot target an external_payment [A7-017]');

-- req 31: L11 livemode must match originating event
insert into finance.stripe_events(event_id,event_type,object_id,livemode) values ('evt_live','x','o',true);
select denied($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,origin_stripe_event_id) select id,'stripe_payment',10,'stripe','ch_l','pi_l',now(),false,'evt_live' from ag2 $$, 'P0001', 'L11: livemode f disagrees with originating event evt_live (livemode t)', 'req 31: livemode disagreeing with the originating event is rejected [A7-018]');
select lives_ok($$ insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode,origin_stripe_event_id) select id,'stripe_payment',10,'stripe','ch_l2','pi_l2',now(),true,'evt_live' from ag2 $$,'req 31: matching livemode is accepted [A7-019]');

-- req 66/68: gift + livemode filter
select finance.create_agreement('bbbbbbbb-0000-0000-0000-00000000000b','cccccccc-0000-0000-0000-00000000000c','additional_gift','g');
create temp table gf as select id from finance.agreements where purpose='additional_gift';
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',700,'stripe','ch_g','pi_g',now(),true from gf;
select is((select remaining_cents from finance.v_agreement_balances where agreement_id=(select id from gf)),null,'req 66: gift has NULL remaining [A7-020]');
select ok((select gross_received_cents=700 from finance.v_member_financials where member_id='bbbbbbbb-0000-0000-0000-00000000000b'),'req 66: gift money still counts toward member Received [A7-021]');
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) select id,'stripe_payment',99,'stripe','ch_t','pi_t',now(),false from gf;
select is((select gross_received_cents from finance.v_agreement_balances where agreement_id=(select id from gf)),700::bigint,'req 68: livemode=false excluded from canonical balances [A7-022]');
select is((select gross_received_cents from finance.v_agreement_balances_test where agreement_id=(select id from gf)),99::bigint,'req 68: livemode=false appears in the test view [A7-023]');

-- req 67: every reachable payment_state is produced
select is((select count(distinct payment_state)::int from finance.v_agreement_balances),3,'req 67: multiple distinct payment_states are produced deterministically [A7-073]');
select is((select count(*)::int from finance.v_agreement_balances where payment_state is null),0,'req 67: payment_state is never NULL [A7-024]');

-- req 80/87/117/127: exception lifecycle
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'ch_r');
create temp table ex as select id from finance.reconciliation_exceptions limit 1;
-- ===== req 121 / D-075: resolution columns are FUNCTION-ONLY =====
-- Every direct-write probe below is well-formed: all four columns are set
-- consistently, so no earlier CHECK (exc_open_iff_unresolved, exc_note_iff_closed,
-- exc_note_nonblank) can fire first and mask the boundary under test.

-- The boundary is execution identity. Prove the posture it depends on.
select is((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='resolve_exception'), true,
  'req 121: resolve_exception is SECURITY DEFINER [A7-074]');
select is((select p.proowner from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='resolve_exception'),
          (select c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relname='reconciliation_exceptions'),
  'req 121: resolve_exception is owned by the trusted migration owner, not a lesser role [A7-025]');
select is((select array_to_string(p.proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='resolve_exception'),
  'search_path=pg_catalog, public, finance',
  'req 121: resolve_exception pins an exact search_path [A7-026]');
select is((select count(*)::int from information_schema.column_privileges
           where table_schema='finance' and table_name='reconciliation_exceptions'
             and privilege_type='UPDATE' and grantee in ('anon','authenticated','service_role')
             and column_name in ('resolution_status','resolved_at','resolved_by','resolution_note')), 0,
  'req 121: no application role holds UPDATE on any resolution column [A7-027]');
select is((select p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='tg_exception_resolution_guard'), false,
  'req 121: the resolution guard is SECURITY INVOKER -- as DEFINER its identity check would admit every caller [A7-028]');

-- 1. FOUNDER SUCCEEDS through the function.
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'ch_r3');
create temp table ex3 as select id from finance.reconciliation_exceptions where provider_object_id='ch_r3';
select lives_ok($$ select finance.resolve_exception((select id from ex3), 'resolved'::finance.exception_resolution, 'resolved via the sanctioned path') $$,
  'req 121: founder resolves successfully through resolve_exception() [A7-029]');
select is((select resolution_status::text from finance.reconciliation_exceptions where id=(select id from ex3)),
  'resolved', 'req 121: the sanctioned path actually applied the resolution [A7-030]');

-- Reopen a second exception for the negative probes, so they run against open state.
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'ch_r2');
create temp table ex2 as select id from finance.reconciliation_exceptions where provider_object_id='ch_r2';

-- 2. NON-FOUNDER is denied THROUGH the function.
do $do$ begin perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true); end $do$;
select denied($$ select finance.resolve_exception((select id from ex2), 'resolved'::finance.exception_resolution, 'attempt by a non-founder') $$,
  'P0001', 'founder role required',
  'req 121: a non-founder is denied through resolve_exception() [A7-031]');
do $do$ begin perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true); end $do$;

-- 3. FOUNDER DIRECT UPDATE is denied by execution identity, not by privilege.
set local role authenticated;
select denied($$ update finance.reconciliation_exceptions
                   set resolution_status='resolved',
                       resolved_at=now(),
                       resolved_by='11111111-1111-1111-1111-111111111111'::uuid,
                       resolution_note='direct write attempt'
                 where id=(select id from ex2) $$,
  '42501', 'permission denied for table reconciliation_exceptions',
  'req 121: a founder acting as authenticated is denied a direct UPDATE [A7-032]');
reset role;

-- 4. service_role DIRECT UPDATE is denied.
set local role service_role;
select denied($$ update finance.reconciliation_exceptions
                   set resolution_status='resolved',
                       resolved_at=now(),
                       resolved_by='11111111-1111-1111-1111-111111111111'::uuid,
                       resolution_note='direct write attempt'
                 where id=(select id from ex2) $$,
  '42501', 'permission denied for table reconciliation_exceptions',
  'req 121: service_role is denied a direct UPDATE [A7-033]');
reset role;

-- 4b. THE GRANT IS NOT THE FENCE. Privileges are additive: a later table-wide
-- GRANT would re-confer these columns despite the REVOKE in migration 0008.
-- Simulate exactly that widening (rolled back with this transaction) and prove
-- the write then REACHES the trigger and is rejected by execution identity.
-- This is also the probe that catches a SECURITY DEFINER regression in the
-- guard: as DEFINER the trigger would admit this write and the test fails.
grant update (resolution_status, resolved_at, resolved_by, resolution_note)
  on finance.reconciliation_exceptions to service_role;
-- the fixture temp table is owned by the test session; without this the probe
-- dies reading ex2 (42501) and never reaches the finance table at all
grant select on ex2 to service_role;
set local role service_role;
select denied($$ update finance.reconciliation_exceptions
                   set resolution_status='resolved',
                       resolved_at=now(),
                       resolved_by='11111111-1111-1111-1111-111111111111'::uuid,
                       resolution_note='direct write attempt'
                 where id=(select id from ex2) $$,
  'P0001',
  'req 121: resolution columns are writable only through finance.resolve_exception()',
  'req 121: with the grant widened, the write reaches the trigger and is rejected by IDENTITY, not privilege [A7-034]');
reset role;
revoke update (resolution_status, resolved_at, resolved_by, resolution_note)
  on finance.reconciliation_exceptions from service_role;
select is((select count(*)::int from information_schema.column_privileges
           where table_schema='finance' and table_name='reconciliation_exceptions'
             and privilege_type='UPDATE' and grantee='service_role'
             and column_name in ('resolution_status','resolved_at','resolved_by','resolution_note')), 0,
  'req 121: the temporary widening is fully revoked before any later test runs [A7-035]');

-- 5. THE REMOVED GUC CONFERS NOTHING. The previous design gated the trigger on a
-- transaction-local setting, which any caller could set. Setting that exact name
-- must now be inert -- this test exists specifically to prove the bypass is gone.
do $do$ begin perform set_config('finance.resolution_write','on', true); end $do$;
set local role authenticated;
select denied($$ update finance.reconciliation_exceptions
                   set resolution_status='resolved',
                       resolved_at=now(),
                       resolved_by='11111111-1111-1111-1111-111111111111'::uuid,
                       resolution_note='direct write attempt'
                 where id=(select id from ex2) $$,
  '42501', 'permission denied for table reconciliation_exceptions',
  'req 121: setting the former GUC name confers no capability on an application role [A7-036]');
reset role;
-- The migration owner is the explicit trusted administrative boundary (D-075):
-- it is ALLOWED, and no application role can reach that identity. Assert the
-- boundary sits exactly where it is documented, rather than pretending the
-- owner is fenced out.
select is((select p.proowner::regrole::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='tg_exception_resolution_guard'),
          current_user::text,
  'req 121 / D-075: the trusted identity is the migration owner, and it is the only identity the trigger admits [A7-075]');
do $do$ begin perform set_config('finance.resolution_write','off', true); end $do$;

-- 6. STATE UNCHANGED. denied() digests every finance table before and after each
-- probe, so the assertions below are a second, explicit statement of the same fact.
select is((select resolution_status::text from finance.reconciliation_exceptions where id=(select id from ex2)),
  'open', 'req 121: the probed exception is still open after every denied write [A7-076]');
select is((select resolved_at is null and resolved_by is null and resolution_note is null
           from finance.reconciliation_exceptions where id=(select id from ex2)), true,
  'req 121: its other three resolution columns remain null after every denied write [A7-037]');
select lives_ok($$ select finance.resolve_exception((select id from ex),'resolved','ok') $$,'req 126: resolution succeeds through the function [A7-038]');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'ch_r') $$,'req 80: a resolved row does not block a fresh one [A7-039]');
select is((select count(*)::int from finance.reconciliation_exceptions where provider_object_id='ch_r'),2,'req 80: the resolved row is preserved [A7-040]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolution_note) values ('amount_mismatch',true,'ch_s','note') $$, 'P0001', 'a new exception may not be created with resolution, quarantine or', 'req 127: an open row carrying a note is rejected [A7-041]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolved_at) values ('amount_mismatch',true,'ch_t2',now()) $$, 'P0001', 'a new exception may not be created with resolution, quarantine or', 'req 117: an open row carrying resolved_at is rejected [A7-042]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,released_at,released_by) values ('amount_mismatch',true,'ch_u',now(),'11111111-1111-1111-1111-111111111111') $$, 'P0001', 'a new exception may not be created with resolution, quarantine or', 'req 87: release without a prior quarantine is rejected [A7-043]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,quarantined_at) values ('amount_mismatch',true,'ch_v',now()) $$, 'P0001', 'a new exception may not be created with resolution, quarantine or', 'req 87: quarantined_at without a reason is rejected [A7-044]');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',false,'ch_r') $$,'req 124b: an explicit open insert with permitted columns succeeds [A7-045]');

-- req 85/96/97/98/113/115/130/131/132: runs
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
 values (true,'v1',now()-interval '2 days',now()-interval '1 day',true,'completed',true,now());
create temp table dr as select id from finance.reconciliation_runs limit 1;
select denied($$ update finance.reconciliation_runs set resumed_from_run_id=(select id from dr) where id=(select id from dr) $$, '23514', 'reconciliation_runs', 'req 85: self-resume is rejected [A7-046]');
select denied($$ select finance.approve_dry_run((select id from dr),'x') $$, 'P0001', 'approve_dry_run: run 2445ac94-e727-4c88-9f73-5e5e87d374b1 has no', 'req 98: approval without a report is rejected [A7-047]');
update finance.reconciliation_runs set would_create_count=1,would_reopen_count=0,prospective_by_kind='{}'::jsonb,report_version='r',report_completed_at=now() where id=(select id from dr);
select lives_ok($$ select finance.approve_dry_run((select id from dr),'ok') $$,'req 113: approval succeeds exactly once [A7-048]');
select denied($$ select finance.approve_dry_run((select id from dr),'again') $$, 'P0001', 'approve_dry_run: run 2445ac94-e727-4c88-9f73-5e5e87d374b1 is already', 'req 113: a second approval is rejected [A7-049]');
select denied($$ update finance.reconciliation_runs set window_start=now() where id=(select id from dr) $$, 'P0001', 'approved evidence is frozen: run 2445ac94-e727-4c88-9f73-5e5e87d374b1', 'req 115: window_start is frozen after approval [A7-050]');
select denied($$ update finance.reconciliation_runs set prospective_by_kind='{"a":1}'::jsonb where id=(select id from dr) $$, 'P0001', 'approved evidence is frozen: run 2445ac94-e727-4c88-9f73-5e5e87d374b1', 'req 115: the report is frozen after approval [A7-051]');
select lives_ok($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id) values (true,'v1',now()-interval '1 day',now(),false,(select id from dr)) $$,'req 132: authorized_by_run_id is insertable for a writing run [A7-052]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,approved_by,approved_at,approval_note) values (false,'v9',now()-interval '1 day',now(),true,'11111111-1111-1111-1111-111111111111',now(),'x') $$, 'P0001', 'a new run may not be created already approved: approval is', 'req 130: a fabricated approved run cannot be inserted [A7-053]');
select is((select approved_by from finance.reconciliation_runs where id=(select id from dr)),'11111111-1111-1111-1111-111111111111'::uuid,'req 131: approval attribution is auth.uid() [A7-054]');

-- req 100: at-most-once event scope
select is((select count(*)::int from pg_indexes where schemaname='finance' and tablename='stripe_events' and indexdef like '%UNIQUE%'),1,'req 100: stripe_events has its primary key uniqueness only [A7-077]');
select lives_ok($$ insert into finance.stripe_events(event_id,event_type,object_id,livemode) values ('evt_f1','payment_intent.payment_failed','pi_same',true) $$,'req 100: first payment_failed for an object [A7-055]');
select lives_ok($$ insert into finance.stripe_events(event_id,event_type,object_id,livemode) values ('evt_f2','payment_intent.payment_failed','pi_same',true) $$,'req 100: a second payment_failed for the SAME object is retained [A7-056]');

-- req 108/116: generated dedup_key
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,dedup_key) values ('amount_mismatch',true,'ch_w','X') $$, '428C9', 'dedup_key', 'req 108: dedup_key cannot be supplied [A7-078]');
select is((select count(*)::int from information_schema.columns where table_schema='finance' and table_name='reconciliation_exceptions' and column_name='dedup_key' and is_nullable='NO'),1,'req 116: dedup_key is NOT NULL [A7-057]');
select is((select count(*)::int from finance.reconciliation_exceptions where dedup_key is null),0,'req 116: no row has a NULL dedup_key [A7-058]');

-- req 91: grants both directions
select ok(has_column_privilege('service_role','finance.reconciliation_runs','cursor','UPDATE') and not has_column_privilege('service_role','finance.reconciliation_runs','approved_at','UPDATE'),'req 91: column grants prove both directions [A7-079]');

-- req 11/12/13/74: member access
select set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', true);
set local role authenticated;
select denied($$ insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id) values ((select id from ag),1,now(),'x','33333333-3333-3333-3333-333333333333') $$, '42501', 'permission denied for table agreement_amounts', 'req 11: a member cannot insert a financial fact [A7-059]');
select is((select count(*)::int from finance.v_agreement_balances where member_id='aaaaaaaa-0000-0000-0000-00000000000a'),0,'req 13: the view returns no row a direct query would deny [A7-060]');
select is((select count(*)::int from finance.agreement_lifecycle_events),0,'req 74: members read no lifecycle events [A7-061]');
select is((select count(*)::int from finance.reconciliation_runs),0,'req 74: members read no runs [A7-062]');
select denied($$ select finance.approve_dry_run((select id from dr),'x') $$, '42501', 'permission denied for table dr', 'req 12: a non-founder cannot call an approved function [A7-063]');
reset role;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
set local role authenticated;
select ok((select count(*)>0 from finance.agreements),'req 12: a founder can read through the approved path [A7-064]');
reset role;

-- req 96/97: authorization source
-- req 96: the cited run must be completed, approved, reported and error-free
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at)
  values (false,'v1',now()-interval '2 days',now()-interval '1 day',true,'partial',false,now());
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (false,'v1',now()-interval '1 day',now(),false,(select id from finance.reconciliation_runs where status='partial')) $$, 'P0001', 'authorization run 649884fe-3309-4b5f-910d-790bfebb9c36 is partial,', 'req 96: a writing run citing a partial dry run is rejected [A7-065]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (false,'v1',now()-interval '1 day',now(),false,(select id from dr)) $$, 'P0001', 'authorization run 2445ac94-e727-4c88-9f73-5e5e87d374b1 is livemode=t,', 'req 96: a writing run citing a different livemode is rejected [A7-066]');
-- req 97: implementation_version must match the authorizing run
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (true,'vX',now()-interval '1 day',now(),false,(select id from dr)) $$, 'P0001', 'authorization run 2445ac94-e727-4c88-9f73-5e5e87d374b1 was version', 'req 97: a writing run whose implementation_version differs is rejected [A7-080]');
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,authorized_by_run_id)
  values (true,'v1',now()-interval '10 days',now(),false,(select id from dr)) $$, 'P0001', 'writing run window_start 2026-07-22 15:11:07.679126-10 precedes the', 'req 96: a writing run reaching before the approved horizon is rejected [A7-067]');

select * from finish();
rollback;
