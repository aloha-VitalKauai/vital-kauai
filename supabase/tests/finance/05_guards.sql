begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(17);

insert into auth.users (id,email) values
  ('11111111-1111-1111-1111-111111111111','f@t'),('22222222-2222-2222-2222-222222222222','m@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('22222222-2222-2222-2222-222222222222','m@t');
insert into public.members (id,profile_id,email) values ('aaaaaaaa-0000-0000-0000-00000000000a','22222222-2222-2222-2222-222222222222','m@t');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','i');
create temp table ag as select id from finance.agreements limit 1;

-- ===== finding 5: no finance function is PUBLIC-executable, now or later =====
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and has_function_privilege('public', p.oid, 'EXECUTE')), 0,
          'finding 5: no finance function is executable by PUBLIC');
-- guard against a future migration reintroducing it
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proacl is not null
             and array_to_string(p.proacl,',') like '=X/%'), 0,
          'finding 5: no finance function ACL grants EXECUTE to PUBLIC');

-- ===== finding 11: version assertion exists in migration 0001 =====
-- finding 11 is asserted by 06_static.sh against the migration source; there is
-- no pgTAP placeholder standing in for it here.

-- ===== finding 4: link_status='revoked' is reachable, and only by a founder =====
insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by)
  select id,'tok_r',now()+interval '7 days','11111111-1111-1111-1111-111111111111' from ag;
create temp table lk as select id from finance.payment_links limit 1;
select ok(has_function_privilege('authenticated','finance.revoke_payment_link(uuid)','EXECUTE'),
          'finding 4: revoke_payment_link is executable by authenticated (founder-gated inside)');
select ok(not has_function_privilege('service_role','finance.revoke_payment_link(uuid)','EXECUTE'),
          'finding 4: service_role cannot revoke a link');
select lives_ok($$ select finance.revoke_payment_link((select id from lk)) $$,
                'finding 4: a founder can revoke a link');
select is((select status::text from finance.payment_links where id=(select id from lk)),'revoked',
          'finding 4: link_status=revoked is now reachable');
select ok((select revoked_at is not null and revoked_by='11111111-1111-1111-1111-111111111111'::uuid
           from finance.payment_links where id=(select id from lk)),
          'finding 4: revocation carries actor attribution computed internally');
select throws_real($$ select finance.revoke_payment_link((select id from lk)) $$, 'finding 4: a second revoke raises');
-- Scoped to the application roles. The table owner implicitly holds every
-- privilege; that is inherent to ownership, not a grant this PR made.
select is((select count(*)::int from information_schema.column_privileges
           where table_schema='finance' and table_name='payment_links'
             and column_name in ('revoked_at','revoked_by') and privilege_type='UPDATE'
             and grantee in ('authenticated','service_role','anon','PUBLIC')), 0,
          'finding 4: no application role holds a direct UPDATE on revoked_at/revoked_by');

-- ===== nit 9: release_quarantine requires an open row, like quarantine_object =====
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail,consecutive_failure_runs)
  values ('provider_object_processing_failed',true,'ch_n9','{"object_type":"charge","error_class":"malformed_object"}'::jsonb,3);
create temp table e9 as select id from finance.reconciliation_exceptions limit 1;
select lives_ok($$ select finance.quarantine_object((select id from e9)) $$,'nit 9: quarantine succeeds');
select lives_ok($$ select finance.resolve_exception((select id from e9),'resolved','done') $$,'nit 9: resolution wins over quarantine');
select throws_real($$ select finance.release_quarantine((select id from e9),'late') $$, 'nit 9: release_quarantine rejects a non-open row, matching quarantine_object');

-- ===== finding 10: f_balances must stay security invoker =====
select is((select p.prosecdef::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
           where n.nspname='finance' and p.proname='f_balances'), 'false',
          'finding 10: f_balances is SECURITY INVOKER; a DEFINER here would leak every balance');
select is((select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relkind='v'
             and (c.reloptions is null or not ('security_invoker=true' = any(c.reloptions)))), 0,
          'finding 10: every finance view sets security_invoker=true');

-- ===== finding 3: auth.users deletion is RESTRICTed to preserve audit history =====
select is((select count(*)::int from pg_constraint c
           join pg_class ch on ch.oid=c.conrelid join pg_namespace nh on nh.oid=ch.relnamespace
           join pg_class pt on pt.oid=c.confrelid join pg_namespace np on np.oid=pt.relnamespace
           where nh.nspname='finance' and np.nspname='auth' and pt.relname='users'
             and c.confdeltype <> 'r'), 0,
          'finding 3: every finance -> auth.users FK is ON DELETE RESTRICT');
select throws_real($$ delete from auth.users where id='11111111-1111-1111-1111-111111111111' $$, 'finding 3: deleting an actor with financial history is REFUSED, not cascaded (D-073)');
select lives_ok($$ delete from auth.users where id='22222222-2222-2222-2222-222222222222' $$,
  'finding 3: an auth user with no financial attribution still deletes normally');

select * from finish();
rollback;
