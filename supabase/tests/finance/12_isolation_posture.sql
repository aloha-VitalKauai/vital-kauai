begin;
create extension if not exists pgtap;
select plan(33);

insert into auth.users values
 ('11111111-1111-1111-1111-111111111111','f@t'),
 ('22222222-2222-2222-2222-222222222222','m@t'),
 ('33333333-3333-3333-3333-333333333333','o@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values
 ('22222222-2222-2222-2222-222222222222','m@t'),('33333333-3333-3333-3333-333333333333','o@t');
insert into public.members(id,profile_id,email) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','m@t'),
 ('bbbbbbbb-0000-0000-0000-00000000000b','33333333-3333-3333-3333-333333333333','o@t');
do $$ begin perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true); end $$;
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','i');
create temp table ag as select id from finance.agreements limit 1;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',99,'stripe','ch_t','pi_t',now(),false from ag;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',5000,'stripe','ch_l','pi_l',now(),true from ag;
insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at)
  select id,'k_t',100,false,now()+interval '1 hour' from ag;

-- ===== FOUNDER-POSITIVE: the test-mode view must work for a founder =====
set local role authenticated;
select is((select count(*)::int from finance.v_agreement_balances_test), 1,
  'FOUNDER sees the test-mode balance view [A12-001]');
select is((select gross_received_cents::bigint from finance.v_agreement_balances_test), 99::bigint,
  'FOUNDER sees the correct test-mode figure [A12-002]');
select is((select count(*)::int from finance.ledger_entries where livemode=false), 1,
  'FOUNDER can read test-mode ledger entries directly [A12-003]');
reset role;

-- ===== NON-FOUNDER-NEGATIVE =====
do $$ begin perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true); end $$;
set local role authenticated;
select is((select count(*)::int from finance.v_agreement_balances_test), 0,
  'NON-FOUNDER member is denied the test-mode balance view [A12-004]');
select is((select count(*)::int from finance.ledger_entries where livemode=false), 0,
  'NON-FOUNDER cannot read a test-mode ledger entry directly [A12-005]');
select is((select count(*)::int from finance.checkout_sessions where livemode=false), 0,
  'NON-FOUNDER cannot read a test-mode checkout session directly [A12-006]');
select is((select gross_received_cents::bigint from finance.v_agreement_balances), 5000::bigint,
  'NON-FOUNDER canonical balance excludes test-mode money [A12-007]');
select is((select gross_received_cents::bigint from finance.v_member_financials), 5000::bigint,
  'test-mode money does not leak into the member aggregate [A12-008]');
-- LIVE-MODE MEMBER ACCESS MUST STILL WORK
select is((select count(*)::int from finance.ledger_entries), 1,
  'LIVE: member still reads their own live ledger entry [A12-029]');
select is((select amount_cents::bigint from finance.ledger_entries), 5000::bigint,
  'LIVE: the amount is correct [A12-009]');
select is((select count(*)::int from finance.agreements), 1,
  'LIVE: member still reads their own agreement [A12-010]');
select is((select net_received_cents::bigint from finance.v_agreement_balances), 5000::bigint,
  'LIVE: canonical balance still reports live money [A12-011]');
reset role;

-- cross-member
do $$ begin perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', true); end $$;
set local role authenticated;
select is((select count(*)::int from finance.ledger_entries), 0,
  'an unrelated member reads no ledger entries [A12-012]');
select is((select count(*)::int from finance.v_agreement_balances_test), 0,
  'an unrelated non-founder is denied the test-mode view [A12-013]');
reset role;

-- ===== ANON-NEGATIVE =====
select ok(not has_schema_privilege('anon','finance','USAGE'), 'anon cannot reach the finance schema [A12-030]');
select ok(not has_table_privilege('anon','finance.v_agreement_balances_test','SELECT'), 'anon holds no SELECT on the test view [A12-014]');
select ok(not has_table_privilege('anon','finance.ledger_entries','SELECT'), 'anon holds no SELECT on ledger_entries [A12-015]');

-- ===== the guard is structural, not merely a grant =====
select ok((select pg_get_viewdef('finance.v_agreement_balances_test'::regclass) ilike '%is_founder%'),
  'the founder predicate is inside the view body [A12-031]');
select ok((select pg_get_viewdef('finance.v_agreement_balances_test'::regclass) ilike '%false%'),
  'the test view pins livemode = false as a literal, not a caller parameter [A12-016]');
select is((select count(*)::int from pg_policies where schemaname='finance'
           and policyname like 'member_reads%'
           and tablename in ('ledger_entries','checkout_sessions')
           and qual not ilike '%livemode%'), 0,
  'every member policy on a livemode-bearing table filters livemode [A12-017]');

-- ===== finance.current_member_id() exact posture =====
select is((select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), 'uuid', 'current_member_id returns uuid [A12-032]');
select is((select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), '', 'current_member_id takes no arguments [A12-018]');
select is((select p.prosecdef::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), 'true',
  'current_member_id is SECURITY DEFINER (kills the INVOKER mutant) [A12-019]');
select is((select p.provolatile::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), 's', 'current_member_id is STABLE [A12-020]');
select is((select array_to_string(p.proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'),
  'search_path=pg_catalog, public, finance', 'current_member_id pins the exact search_path [A12-021]');
select ok(has_function_privilege('authenticated','finance.current_member_id()','EXECUTE'),
  'authenticated may execute current_member_id [A12-022]');
select ok(not has_function_privilege('anon','finance.current_member_id()','EXECUTE'),
  'anon may not execute current_member_id [A12-023]');
do $$ begin perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true); end $$;
select is(finance.current_member_id(), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid,
  'current_member_id resolves via members.profile_id, not members.id [A12-024]');

-- ===== foreign-key matrix, validated from the catalogs =====
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace where n.nspname='finance' and c.contype='f'
             and c.confdeltype <> 'r'), 0, 'FK matrix: every finance FK is ON DELETE RESTRICT [A12-033]');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace join pg_class t on t.oid=c.confrelid
           join pg_namespace tn on tn.oid=t.relnamespace where n.nspname='finance' and c.contype='f'
             and tn.nspname='public' and t.relname='members'), 1,
  'FK matrix: exactly one FK targets public.members (kills the dropped-FK mutant) [A12-025]');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace join pg_class t on t.oid=c.confrelid
           join pg_namespace tn on tn.oid=t.relnamespace where n.nspname='finance' and c.contype='f'
             and tn.nspname='public' and t.relname='journeys'), 1,
  'FK matrix: exactly one FK targets public.journeys [A12-026]');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace where n.nspname='finance' and c.contype='f'
             and r.relname='agreements'), 3, 'FK matrix: agreements carries 3 foreign keys [A12-027]');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace where n.nspname='finance' and c.contype='f'
             and r.relname='ledger_entries'), 4, 'FK matrix: ledger_entries carries 4 foreign keys [A12-028]');

select * from finish();
rollback;
