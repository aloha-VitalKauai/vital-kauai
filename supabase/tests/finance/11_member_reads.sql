begin;
create extension if not exists pgtap;
select plan(14);
-- POSITIVE member-read tests. Their absence was a real gap: dropping
-- member_reads_own_ledger silently blinded every member to their own payment
-- history and the whole suite stayed green.

insert into auth.users (id,email) values
 ('11111111-1111-1111-1111-111111111111','f@t'),('22222222-2222-2222-2222-222222222222','a@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('22222222-2222-2222-2222-222222222222','a@t');
insert into public.members (id,profile_id,email) values
 ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','a@t');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','i');
create temp table ag as select id from finance.agreements limit 1;
insert into finance.agreement_amounts(agreement_id,amount_cents,effective_at,reason,actor_id)
  select id,50000,now(),'set','11111111-1111-1111-1111-111111111111' from ag;
insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode)
  select id,'stripe_payment',20000,'stripe','ch_m','pi_m',now(),true from ag;

select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', true);
set local role authenticated;

select is((select count(*)::int from finance.agreements), 1,
  'a member can read their OWN agreement');
select is((select count(*)::int from finance.ledger_entries), 1,
  'a member can read their OWN ledger entries (kills the member_reads_own_ledger mutant)');
select is((select amount_cents from finance.ledger_entries), 20000::bigint,
  'a member sees the correct amount on their own ledger entry');
select is((select count(*)::int from finance.agreement_amounts), 1,
  'a member can read their OWN contribution amendments');
select is((select count(*)::int from finance.v_agreement_balances), 1,
  'a member can read their OWN balance row');
select is((select net_received_cents from finance.v_agreement_balances), 20000::bigint,
  'a member sees the correct Received figure');
select is((select contribution_cents from finance.v_agreement_balances), 50000::bigint,
  'a member sees the correct Contribution');
select is((select count(*)::int from finance.checkout_sessions), 0,
  'a member reads no checkout session they do not own');
select is((select count(*)::int from finance.payment_links), 0,
  'a member reads no payment_links row (RLS, not grant, is the control)');
reset role;

-- ===== grant-surface assertions (kills the "widen a grant" mutant) =====
select ok(not has_table_privilege('authenticated','finance.agreements','UPDATE'),
  'authenticated holds no UPDATE on agreements');
select ok(not has_table_privilege('authenticated','finance.agreements','INSERT'),
  'authenticated holds no INSERT on agreements');
select ok(not has_table_privilege('authenticated','finance.agreements','DELETE'),
  'authenticated holds no DELETE on agreements');
select is((select count(*)::int from pg_policies
           where schemaname='finance' and tablename='payment_links'
             and roles::text like '%authenticated%'
             and qual ilike '%is_founder%'), 1,
  'payment_links is founder-only for authenticated, enforced by RLS not by grant');
select is((select count(*)::int from information_schema.role_table_grants
           where table_schema='finance' and grantee='authenticated'
             and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')), 0,
  'authenticated holds NO write privilege on any finance table');

select * from finish();
rollback;
