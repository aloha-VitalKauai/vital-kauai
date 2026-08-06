begin;
create extension if not exists pgtap;
select plan(36);

-- Schema and reproducibility (tests 1, 3, 4)
select has_schema('finance', 'finance schema exists [A1-026]');
select is((select count(*)::int from pg_type t join pg_namespace n on n.oid=t.typnamespace
           where n.nspname='finance' and t.typtype='e'), 13, 'exactly 13 enum types [A1-001]');
select is((select count(*)::int from pg_tables where schemaname='finance'), 9, 'exactly 9 tables [A1-002]');
select is((select count(*)::int from pg_views where schemaname='finance'), 5, 'exactly 5 views [A1-003]');

-- All 9 tables by name
select has_table('finance','agreements','table agreements exists [A1-027]');
select has_table('finance','agreement_amounts','table agreement_amounts exists [A1-004]');
select has_table('finance','agreement_lifecycle_events','table agreement_lifecycle_events exists [A1-005]');
select has_table('finance','ledger_entries','table ledger_entries exists [A1-006]');
select has_table('finance','stripe_events','table stripe_events exists [A1-007]');
select has_table('finance','checkout_sessions','table checkout_sessions exists [A1-008]');
select has_table('finance','payment_links','table payment_links exists [A1-009]');
select has_table('finance','reconciliation_exceptions','table reconciliation_exceptions exists [A1-010]');
select has_table('finance','reconciliation_runs','table reconciliation_runs exists [A1-011]');

-- All 5 views by name
select has_view('finance','v_agreement_lifecycle','view v_agreement_lifecycle exists [A1-028]');
select has_view('finance','v_agreement_balances','view v_agreement_balances exists [A1-012]');
select has_view('finance','v_agreement_balances_test','view v_agreement_balances_test exists [A1-013]');
select has_view('finance','v_member_financials','view v_member_financials exists [A1-014]');
select has_view('finance','v_journey_financials','view v_journey_financials exists [A1-015]');

-- All 6 functions
select has_function('finance','current_member_id','function current_member_id exists [A1-029]');
select has_function('finance','create_agreement','function create_agreement exists [A1-016]');
select has_function('finance','approve_dry_run','function approve_dry_run exists [A1-017]');
select has_function('finance','resolve_exception','function resolve_exception exists [A1-018]');
select has_function('finance','release_quarantine','function release_quarantine exists [A1-019]');
select has_function('finance','quarantine_object','function quarantine_object exists [A1-020]');

-- run_status has five values (D-045/D-072)
select is((select count(*)::int from pg_enum e join pg_type t on t.oid=e.enumtypid
           join pg_namespace n on n.oid=t.typnamespace
           where n.nspname='finance' and t.typname='run_status'), 5, 'run_status has 5 values [A1-030]');
select ok((select bool_and(l = any(array['running','partial','completed','failed','abandoned']))
           from (select enumlabel l from pg_enum e join pg_type t on t.oid=e.enumtypid
                 join pg_namespace n on n.oid=t.typnamespace
                 where n.nspname='finance' and t.typname='run_status') s),
          'run_status values are exactly the five specified [A1-021]');

-- 8 partial unique indexes
select is((select count(*)::int from pg_indexes where schemaname='finance'
           and indexdef like '%UNIQUE%' and indexdef like '%WHERE%'), 9,
          'exactly 9 partial unique indexes (8 of section-15 + the section-10 stripe_events at-most-once index, D-076) [A1-031]');

-- RLS enabled AND forced on all nine
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relkind='r' and c.relrowsecurity), 9, 'RLS enabled on 9 tables [A1-032]');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relkind='r' and c.relforcerowsecurity), 9, 'RLS forced on 9 tables [A1-022]');

-- Every SECURITY DEFINER function pins search_path (§9)
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.prosecdef and p.proconfig is null), 0,
          'no finance SECURITY DEFINER function lacks search_path [A1-033]');

-- req 90: public.is_founder() is hardened by this PR, and still has the shape
-- V2 depends on. Asserted against the live catalog, not the migration source.
select isnt((select proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
             where n.nspname='public' and p.proname='is_founder'), null,
            'req 90: public.is_founder() proconfig includes a pinned search_path [A1-034]');
select ok((select prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='is_founder'),
          'req 90: public.is_founder() is still SECURITY DEFINER [A1-023]');
select is((select pg_get_function_result(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='is_founder'), 'boolean',
          'req 90: public.is_founder() still returns boolean [A1-024]');
select is((select array_to_string(p.proconfig,',') from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='public' and p.proname='is_founder'), 'search_path=pg_catalog, public',
          'req 90: the pinned search_path is exactly pg_catalog, public [A1-025]');

-- anon holds nothing
select is((select count(*)::int from information_schema.role_table_grants
           where table_schema='finance' and grantee='anon'), 0, 'anon has no table privilege in finance [A1-035]');

-- No legacy financial dependency anywhere in the finance schema
select is((select count(*)::int from pg_constraint c
           join pg_class ch on ch.oid=c.conrelid join pg_namespace nh on nh.oid=ch.relnamespace
           join pg_class pt on pt.oid=c.confrelid join pg_namespace np on np.oid=pt.relnamespace
           where nh.nspname='finance' and c.contype='f'
             and pt.relname in ('donations','financial_commitments','payment_allocations','bookings')), 0,
          'no finance FK references a legacy financial table [A1-036]');

select * from finish();
rollback;
