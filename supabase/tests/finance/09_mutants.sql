begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(13);
-- Each assertion here exists to KILL a mutant that survived mutation.sh.
-- They are written so the safeguard, not a CHECK constraint or a grant, is the
-- thing that rejects -- otherwise dropping the safeguard leaves them green.

insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.members (id,profile_id,email) values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','f@t');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true);
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a',null,'membership','i');
create temp table ag as select id from finance.agreements limit 1;

-- ===== mutant: payment_links insert guard =====
-- Every CHECK is satisfied here, so ONLY the trigger can reject it.
select denied($$ insert into finance.payment_links(agreement_id,token_hash,status,expires_at,created_by,revoked_at,revoked_by)
  select id,'tok_forge','revoked',now()+interval '1 day','11111111-1111-1111-1111-111111111111',now(),'11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'a new payment link must be created active, got revoked', 'mutant kill: a link cannot be INSERTed already revoked with forged attribution');
select denied($$ insert into finance.payment_links(agreement_id,token_hash,status,expires_at,created_by,claimed_at)
  select id,'tok_claim','creating',now()+interval '1 day','11111111-1111-1111-1111-111111111111',now() from ag $$, 'P0001', 'a new payment link must be created active, got creating', 'mutant kill: a link cannot be INSERTed already claimed');
select denied($$ insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by,attempt_count)
  select id,'tok_att',now()+interval '1 day','11111111-1111-1111-1111-111111111111',5 from ag $$, 'P0001', 'a new payment link must start with attempt_count = 0', 'mutant kill: a link cannot be INSERTed with a non-zero attempt_count');

-- ===== mutant: payment_links revocation terminality =====
insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by)
  select id,'tok_ok',now()+interval '1 day','11111111-1111-1111-1111-111111111111' from ag;
create temp table lk as select id from finance.payment_links limit 1;
select lives_ok($$ select finance.revoke_payment_link((select id from lk)) $$,'a founder revokes the link');
select denied($$ update finance.payment_links set status='active' where id=(select id from lk) $$, 'P0001', 'payment link af750372-6886-44c0-8804-d62b69f035c9 is revoked;', 'mutant kill: a revoked link cannot be reactivated');
select denied($$ update finance.payment_links set revoked_by='11111111-1111-1111-1111-111111111111', revoked_at=now()-interval '1 day' where id=(select id from lk) $$, 'P0001', 'revocation attribution on link af750372-6886-44c0-8804-d62b69f035c9', 'mutant kill: revocation attribution is frozen');

-- ===== mutant: run insert guard =====
-- Report columns are supplied so run_no_approval_without_report is satisfied
-- and every CHECK passes; only the trigger can reject this.
select denied($$ insert into finance.reconciliation_runs
  (livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,
   would_create_count,would_reopen_count,prospective_by_kind,report_version,report_completed_at,
   approved_by,approved_at,approval_note)
  values (true,'v1',now()-interval '1 day',now(),true,'completed',true,now(),
          0,0,'{}'::jsonb,'r',now(),
          '11111111-1111-1111-1111-111111111111',now(),'forged') $$, 'P0001', 'a new run may not be created already approved: approval is', 'mutant kill: a run cannot be INSERTed already approved even with a complete report');

-- ===== mutant: agreement completeness (deferred constraint) =====
-- Exercised at statement level, not inside a DO block, so the deferred
-- constraint is genuinely forced.
-- The constraint must EXIST. Without this, dropping it makes the behavioural
-- assertion below pass for the wrong reason: SET CONSTRAINTS on a nonexistent
-- constraint raises too, so throws_ok() would be satisfied by the absence of
-- the very safeguard it is meant to prove.
select is((select count(*)::int from pg_trigger t join pg_class c on c.oid=t.tgrelid
           join pg_namespace n on n.oid=c.relnamespace
           where n.nspname='finance' and c.relname='agreements'
             and t.tgname='agreement_has_lifecycle' and t.tgdeferrable), 1,
          'mutant kill: the deferred agreement-completeness constraint exists and is DEFERRABLE');
savepoint sp_defer;
insert into finance.agreements(member_id,journey_id,purpose,created_by)
  values ('aaaaaaaa-0000-0000-0000-00000000000a',null,'other','11111111-1111-1111-1111-111111111111');
select denied($$ set constraints finance.agreement_has_lifecycle immediate $$, 'P0001', 'agreement 2d9accad-e42f-4e0b-a667-90b06df89328 must have exactly one', 'an agreement with no initial lifecycle event fails the deferred check');
rollback to savepoint sp_defer;

-- ===== mutant: lifecycle view ordering drift =====
-- Two events whose occurred_at ordering DIFFERS from insertion order, so an
-- ASC/DESC flip in either the view or the trigger selects a different row.
insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id,occurred_at)
  select id,'draft','active','later','11111111-1111-1111-1111-111111111111', now() + interval '1 second' from ag;
select is((select current_status::text from finance.v_agreement_lifecycle where agreement_id=(select id from ag)),
  'active','mutant kill: the view reports the LATEST event, not the earliest');
select is((select since from finance.v_agreement_lifecycle where agreement_id=(select id from ag)),
  (select max(occurred_at) from finance.agreement_lifecycle_events where agreement_id=(select id from ag)),
  'mutant kill: the view''s `since` is the latest occurred_at');
-- enforcement must agree with the projection: a transition whose from_status
-- matches the view''s reported status is accepted...
select lives_ok($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,'active','fulfilled','agrees','11111111-1111-1111-1111-111111111111' from ag $$,
  'D-074: enforcement accepts a transition from the state the view reports');
-- ...and one matching the EARLIER state is rejected, proving both derivations
-- resolve to the same event.
select denied($$ insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id)
  select id,'draft','canceled','stale','11111111-1111-1111-1111-111111111111' from ag $$, 'P0001', 'stale transition: from_status draft but current status is active', 'D-074: enforcement rejects a transition from the superseded state');

select * from finish();
rollback;
