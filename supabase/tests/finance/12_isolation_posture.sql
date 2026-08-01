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
  'FOUNDER sees the test-mode balance view');
select is((select gross_received_cents::bigint from finance.v_agreement_balances_test), 99::bigint,
  'FOUNDER sees the correct test-mode figure');
select is((select count(*)::int from finance.ledger_entries where livemode=false), 1,
  'FOUNDER can read test-mode ledger entries directly');
reset role;

-- ===== NON-FOUNDER-NEGATIVE =====
do $$ begin perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true); end $$;
set local role authenticated;
select is((select count(*)::int from finance.v_agreement_balances_test), 0,
  'NON-FOUNDER member is denied the test-mode balance view');
select is((select count(*)::int from finance.ledger_entries where livemode=false), 0,
  'NON-FOUNDER cannot read a test-mode ledger entry directly');
select is((select count(*)::int from finance.checkout_sessions where livemode=false), 0,
  'NON-FOUNDER cannot read a test-mode checkout session directly');
select is((select gross_received_cents::bigint from finance.v_agreement_balances), 5000::bigint,
  'NON-FOUNDER canonical balance excludes test-mode money');
select is((select gross_received_cents::bigint from finance.v_member_financials), 5000::bigint,
  'test-mode money does not leak into the member aggregate');
-- LIVE-MODE MEMBER ACCESS MUST STILL WORK
select is((select count(*)::int from finance.ledger_entries), 1,
  'LIVE: member still reads their own live ledger entry');
select is((select amount_cents::bigint from finance.ledger_entries), 5000::bigint,
  'LIVE: the amount is correct');
select is((select count(*)::int from finance.agreements), 1,
  'LIVE: member still reads their own agreement');
select is((select net_received_cents::bigint from finance.v_agreement_balances), 5000::bigint,
  'LIVE: canonical balance still reports live money');
reset role;

-- cross-member
do $$ begin perform set_config('request.jwt.claim.sub','33333333-3333-3333-3333-333333333333', true); end $$;
set local role authenticated;
select is((select count(*)::int from finance.ledger_entries), 0,
  'an unrelated member reads no ledger entries');
select is((select count(*)::int from finance.v_agreement_balances_test), 0,
  'an unrelated non-founder is denied the test-mode view');
reset role;

-- ===== ANON-NEGATIVE =====
select ok(not has_schema_privilege('anon','finance','USAGE'), 'anon cannot reach the finance schema');
select ok(not has_table_privilege('anon','finance.v_agreement_balances_test','SELECT'), 'anon holds no SELECT on the test view');
select ok(not has_table_privilege('anon','finance.ledger_entries','SELECT'), 'anon holds no SELECT on ledger_entries');

-- ===== the guard is structural, not merely a grant =====
select ok((select pg_get_viewdef('finance.v_agreement_balances_test'::regclass) ilike '%is_founder%'),
  'the founder predicate is inside the view body');
select ok((select pg_get_viewdef('finance.v_agreement_balances_test'::regclass) ilike '%false%'),
  'the test view pins livemode = false as a literal, not a caller parameter');
select is((select count(*)::int from pg_policies where schemaname='finance'
           and policyname like 'member_reads%'
           and tablename in ('ledger_entries','checkout_sessions')
           and qual not ilike '%livemode%'), 0,
  'every member policy on a livemode-bearing table filters livemode');

-- ===== finance.current_member_id() exact posture =====
select is((select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), 'uuid', 'current_member_id returns uuid');
select is((select pg_get_function_identity_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), '', 'current_member_id takes no arguments');
select is((select p.prosecdef::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), 'true',
  'current_member_id is SECURITY DEFINER (kills the INVOKER mutant)');
select is((select p.provolatile::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'), 's', 'current_member_id is STABLE');
select is((select array_to_string(p.proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='current_member_id'),
  'search_path=pg_catalog, public, finance', 'current_member_id pins the exact search_path');
select ok(has_function_privilege('authenticated','finance.current_member_id()','EXECUTE'),
  'authenticated may execute current_member_id');
select ok(not has_function_privilege('anon','finance.current_member_id()','EXECUTE'),
  'anon may not execute current_member_id');
do $$ begin perform set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true); end $$;
select is(finance.current_member_id(), 'aaaaaaaa-0000-0000-0000-00000000000a'::uuid,
  'current_member_id resolves via members.profile_id, not members.id');

-- ===== foreign-key matrix, validated from the catalogs =====
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace where n.nspname='finance' and c.contype='f'
             and c.confdeltype <> 'r'), 0, 'FK matrix: every finance FK is ON DELETE RESTRICT');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace join pg_class t on t.oid=c.confrelid
           join pg_namespace tn on tn.oid=t.relnamespace where n.nspname='finance' and c.contype='f'
             and tn.nspname='public' and t.relname='members'), 1,
  'FK matrix: exactly one FK targets public.members (kills the dropped-FK mutant)');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace join pg_class t on t.oid=c.confrelid
           join pg_namespace tn on tn.oid=t.relnamespace where n.nspname='finance' and c.contype='f'
             and tn.nspname='public' and t.relname='journeys'), 1,
  'FK matrix: exactly one FK targets public.journeys');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace where n.nspname='finance' and c.contype='f'
             and r.relname='agreements'), 3, 'FK matrix: agreements carries 3 foreign keys');
select is((select count(*)::int from pg_constraint c join pg_class r on r.oid=c.conrelid
           join pg_namespace n on n.oid=r.relnamespace where n.nspname='finance' and c.contype='f'
             and r.relname='ledger_entries'), 4, 'FK matrix: ledger_entries carries 4 foreign keys');

select * from finish();
rollback;
