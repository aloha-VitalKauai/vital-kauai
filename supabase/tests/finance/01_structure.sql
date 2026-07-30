begin;
create extension if not exists pgtap;
select plan(36);

-- Schema and reproducibility (tests 1, 3, 4)
select has_schema('finance', 'finance schema exists');
select is((select count(*)::int from pg_type t join pg_namespace n on n.oid=t.typnamespace
           where n.nspname='finance' and t.typtype='e'), 13, 'exactly 13 enum types');
select is((select count(*)::int from pg_tables where schemaname='finance'), 9, 'exactly 9 tables');
select is((select count(*)::int from pg_views where schemaname='finance'), 5, 'exactly 5 views');

-- All 9 tables by name
select has_table('finance','agreements','agreements'),
       has_table('finance','agreement_amounts','agreement_amounts'),
       has_table('finance','agreement_lifecycle_events','agreement_lifecycle_events'),
       has_table('finance','ledger_entries','ledger_entries'),
       has_table('finance','stripe_events','stripe_events'),
       has_table('finance','checkout_sessions','checkout_sessions'),
       has_table('finance','payment_links','payment_links'),
       has_table('finance','reconciliation_exceptions','reconciliation_exceptions'),
       has_table('finance','reconciliation_runs','reconciliation_runs');

-- All 5 views by name
select has_view('finance','v_agreement_lifecycle','v_agreement_lifecycle'),
       has_view('finance','v_agreement_balances','v_agreement_balances'),
       has_view('finance','v_agreement_balances_test','v_agreement_balances_test'),
       has_view('finance','v_member_financials','v_member_financials'),
       has_view('finance','v_journey_financials','v_journey_financials');

-- All 6 functions
select has_function('finance','current_member_id','current_member_id()'),
       has_function('finance','create_agreement','create_agreement()'),
       has_function('finance','approve_dry_run','approve_dry_run()'),
       has_function('finance','resolve_exception','resolve_exception()'),
       has_function('finance','release_quarantine','release_quarantine()'),
       has_function('finance','quarantine_object','quarantine_object()');

-- run_status has five values (D-045/D-072)
select is((select count(*)::int from pg_enum e join pg_type t on t.oid=e.enumtypid
           join pg_namespace n on n.oid=t.typnamespace
           where n.nspname='finance' and t.typname='run_status'), 5, 'run_status has 5 values');
select ok((select bool_and(l = any(array['running','partial','completed','failed','abandoned']))
           from (select enumlabel l from pg_enum e join pg_type t on t.oid=e.enumtypid
                 join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='finance' and t.typname='run_status') s),
          'run_status values are exactly the five specified');

-- 8 partial unique indexes
select is((select count(*)::int from pg_indexes where schemaname='finance'
           and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'), 8,
          'exactly 8 partial unique indexes');

-- RLS enabled AND forced on all nine
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relkind='r' and c.relrowsecurity), 9, 'RLS enabled on 9 tables');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relkind='r' and c.relforcerowsecurity), 9, 'RLS forced on 9 tables');

-- Every SECURITY DEFINER function pins search_path (§9)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.prosecdef and p.proconfig is null), 0,
          'no finance SECURITY DEFINER function lacks search_path');

-- req 90: public.is_founder() is hardened by this PR, and still has the shape
-- V2 depends on. Asserted against the live catalog, not the migration source.
select isnt((select proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='is_founder'), null,
            'req 90: public.is_founder() proconfig includes a pinned search_path');
select ok((select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='is_founder'),
          'req 90: public.is_founder() is still SECURITY DEFINER');
select is((select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='is_founder'), 'boolean',
          'req 90: public.is_founder() still returns boolean');
select is((select array_to_string(p.proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='is_founder'), 'search_path=pg_catalog, public',
          'req 90: the pinned search_path is exactly pg_catalog, public');

-- anon holds nothing
select is((select count(*)::int from information_schema.role_table_grants
           where table_schema='finance' and grantee='anon'), 0, 'anon has no table privilege in finance');

-- No legacy financial dependency anywhere in the finance schema
select is((select count(*)::int from pg_constraint c
           join pg_class ch on ch.oid=c.conrelid join pg_namespace nh on nh.oid=ch.relnamespace
           join pg_class pt on pt.oid=c.confrelid join pg_namespace np on np.oid=pt.relnamespace
           where nh.nspname='finance' and c.contype='f'
             and pt.relname in ('donations','financial_commitments','payment_allocations','bookings')), 0,
          'no finance FK references a legacy financial table');

select * from finish();
rollback;
