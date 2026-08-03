-- Checkpoint B batch 6: exception identity, quarantine lifecycle, the approved
-- freeze matrix, and resolution behaviour. Closed sets are enumerated FROM THE
-- CATALOG so that adding or removing a member fails the test.
begin;
create extension if not exists pgtap;
\i supabase/tests/_test_helpers.sql
select plan(63);

insert into auth.users values ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.members(id,profile_id,email) values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','f@t');
do $$ begin perform set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', true); end $$;

-- ===== R108/R116: exception-kind identity matrix, catalog-enumerated =====
create temp table kind_probe as
  with kinds as (select enumlabel::text as k from pg_enum e join pg_type t on t.oid=e.enumtypid
                 where t.typname='exception_kind' and t.typnamespace='finance'::regnamespace)
  select k from kinds;
do $$
declare r record;
begin
  for r in select k from kind_probe loop
    if r.k = 'provider_object_processing_failed' then
      insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail)
        values (r.k::finance.exception_kind, true, 'obj_'||r.k, jsonb_build_object('object_type','charge','error_class','malformed_object'));
    else
      insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id)
        values (r.k::finance.exception_kind, true, 'obj_'||r.k);
    end if;
  end loop;
end $$;
select is((select count(distinct kind)::int from finance.reconciliation_exceptions where provider_object_id like 'obj\_%'),
  (select count(*)::int from kind_probe),
  'req 108/116: one row inserted per LIVE enum label -- the set is catalog-derived, not hard-coded [A15-001]');
select is((select count(*)::int from finance.reconciliation_exceptions where provider_object_id like 'obj\_%' and dedup_key is null), 0,
  'req 108/116: every live kind generates a non-NULL dedup_key [A15-002]');
select is((select count(*)::int from kind_probe), 12, 'req 108: the spec count of twelve still matches the catalog (changing the enum must be a conscious act) [A15-003]');
select is((select count(*)::int from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='exception_kind' and t.typnamespace='finance'::regnamespace),
  (select (length(x)-length(replace(x,'WHEN','')))/4 from (select pg_get_expr(d.adbin,d.adrelid) as x from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum join pg_class c on c.oid=d.adrelid where c.relname='reconciliation_exceptions' and a.attname='dedup_key') q),
  'req 108: the generated CASE has exactly one WHEN branch per catalog label [A15-004]');
select ok((select substring(x from 1 for position('END' in x)) ilike '%ELSE NULL::text%'
           from (select pg_get_expr(d.adbin,d.adrelid) as x from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum join pg_class c on c.oid=d.adrelid where c.relname='reconciliation_exceptions' and a.attname='dedup_key') t),
  'req 108: the kind CASE falls to ELSE NULL, so an unmapped future label nulls the key and dies on NOT NULL [A15-005]');
select is((select a.attnotnull from pg_attribute a join pg_class c on c.oid=a.attrelid where c.relname='reconciliation_exceptions' and a.attname='dedup_key'), true,
  'req 116: dedup_key is structurally NOT NULL [A15-006]');
-- identity semantics
select finance.resolve_exception((select id from finance.reconciliation_exceptions where provider_object_id='obj_amount_mismatch'), 'resolved', 'clear for identity test');
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',true,'obj_amount_mismatch');
select is((select count(distinct dedup_key)::int from finance.reconciliation_exceptions where provider_object_id='obj_amount_mismatch'), 1,
  'req 108: two logically identical exceptions share one identity [A15-007]');
select isnt((select dedup_key from finance.reconciliation_exceptions where provider_object_id='obj_amount_mismatch' limit 1),
  (select dedup_key from finance.reconciliation_exceptions where provider_object_id='obj_currency_violation'),
  'req 108: differing load-bearing identity fields produce different identities [A15-008]');
select ok((select indexdef ilike '%(dedup_key, livemode)%' from pg_indexes where indexname='reconciliation_exceptions_open_uq'),
  'req 108: livemode participates in identity through the open-row unique index (dedup_key, livemode) [A15-009]');
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('amount_mismatch',false,'obj_amount_mismatch');
select is((select count(distinct livemode)::int from finance.reconciliation_exceptions where provider_object_id='obj_amount_mismatch' and dedup_key=(select dedup_key from finance.reconciliation_exceptions where provider_object_id='obj_amount_mismatch' limit 1)), 2,
  'req 108: one canonical key, two livemodes, two independent open rows -- mode isolation lives in the index [A15-010]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,dedup_key) values ('amount_mismatch',true,'obj_supplied','forged') $$,
  '428C9', 'dedup_key', 'req 102: a writer cannot supply the generated column [A15-011]');

-- ===== R110/R112: quarantine lifecycle on one row =====
-- only processing_failed rows are quarantinable (derived-reason model)
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values
 ('provider_object_processing_failed',true,'obj_q1','{"object_type":"charge","error_class":"malformed_object"}'::jsonb),
 ('provider_object_processing_failed',true,'obj_q2','{"object_type":"charge","error_class":"object_not_found"}'::jsonb),
 ('provider_object_processing_failed',true,'obj_q3','{"object_type":"refund","error_class":"malformed_object"}'::jsonb);
create temp table q as select id from finance.reconciliation_exceptions where provider_object_id='obj_q1';
grant select on q to service_role;
set local role service_role;
select denied($$ select finance.quarantine_object((select id from q)) $$, 'P0001', 'consecutive failures', 'req 110: streak 0 cannot quarantine [A15-012]');
reset role;
update finance.reconciliation_exceptions set consecutive_failure_runs=1 where id=(select id from q);
set local role service_role;
select denied($$ select finance.quarantine_object((select id from q)) $$, 'P0001', 'consecutive failures', 'req 110: a FIRST failure cannot quarantine [A15-013]');
reset role;
update finance.reconciliation_exceptions set consecutive_failure_runs=2 where id=(select id from q);
set local role service_role;
select denied($$ select finance.quarantine_object((select id from q)) $$, 'P0001', 'consecutive failures', 'req 110: a SECOND failure cannot quarantine [A15-014]');
reset role;
update finance.reconciliation_exceptions set consecutive_failure_runs=3 where id=(select id from q);
set local role service_role;
select lives_ok($$ select finance.quarantine_object((select id from q)) $$, 'req 110: the threshold (3) quarantines [A15-015]');
select denied($$ select finance.quarantine_object((select id from q)) $$, 'P0001', 'actively quarantined', 'req 110: an active quarantine cannot be entered again [A15-016]');
reset role;
select lives_ok($$ select finance.release_quarantine((select id from q), 'first release') $$, 'req 92: founder release succeeds [A15-017]');
select is((select consecutive_failure_runs from finance.reconciliation_exceptions where id=(select id from q)), 0, 'req 112: release resets the streak [A15-018]');
select ok((select released_at > quarantined_at from finance.reconciliation_exceptions where id=(select id from q)), 'req 92: released_at strictly after quarantined_at [A15-019]');
update finance.reconciliation_exceptions set consecutive_failure_runs=3 where id=(select id from q);
set local role service_role;
select lives_ok($$ select finance.quarantine_object((select id from q)) $$, 'req 112: re-quarantine after three fresh failures succeeds [A15-020]');
reset role;
select ok((select quarantined_at > released_at from finance.reconciliation_exceptions where id=(select id from q)), 'req 92: re-quarantine timestamp strictly after release [A15-021]');
select lives_ok($$ select finance.release_quarantine((select id from q), 'second release') $$, 'req 92: a second release completes the double cycle [A15-022]');
-- resolved/dismissed rows cannot be quarantined
update finance.reconciliation_exceptions set consecutive_failure_runs=3 where provider_object_id='obj_q2';
select finance.resolve_exception((select id from finance.reconciliation_exceptions where provider_object_id='obj_q2'), 'dismissed', 'dismissing for the quarantine probe');
set local role service_role;
select denied($$ select finance.quarantine_object((select id from finance.reconciliation_exceptions where provider_object_id='obj_q2')) $$, 'P0001', 'not open', 'req 110: a dismissed row cannot be quarantined [A15-023]');
reset role;

-- ===== R115: the freeze matrix, field by field, list compared to the trigger =====
insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,status,window_exhausted,finished_at,report_completed_at,would_create_count,would_reopen_count,prospective_by_kind,report_version)
  values (true,'v1',now()-interval '3 day',now()-interval '2 day',true,'completed',true,now(),now(),0,0,'{}'::jsonb,1);
create temp table fr as select id from finance.reconciliation_runs where livemode and approved_at is null and status='completed';
select finance.approve_dry_run((select id from fr), 'freeze matrix');
select is((select (length(p.prosrc)-length(replace(p.prosrc,'is distinct from','')))/16 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and p.proname='tg_run_freeze_approved'), 18,
  'req 115: the trigger freezes exactly 18 fields -- adding one must consciously extend this matrix [A15-024]');
select denied($$ update finance.reconciliation_runs set status='failed' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: status frozen [A15-025]');
select denied($$ update finance.reconciliation_runs set error='x' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: error frozen [A15-026]');
select denied($$ update finance.reconciliation_runs set finished_at=now()+interval '1 hour' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: finished_at frozen [A15-027]');
select denied($$ update finance.reconciliation_runs set window_exhausted=false where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: window_exhausted frozen [A15-028]');
select denied($$ update finance.reconciliation_runs set window_start=window_start-interval '1 day' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: window_start frozen [A15-029]');
select denied($$ update finance.reconciliation_runs set window_end=window_end+interval '1 day' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: window_end frozen [A15-030]');
select denied($$ update finance.reconciliation_runs set livemode=false where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: livemode frozen [A15-031]');
select denied($$ update finance.reconciliation_runs set implementation_version='v2' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: implementation_version frozen [A15-032]');
select denied($$ update finance.reconciliation_runs set dry_run=false where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: dry_run frozen [A15-033]');
select denied($$ update finance.reconciliation_runs set would_create_count=9 where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: would_create_count frozen [A15-034]');
select denied($$ update finance.reconciliation_runs set would_reopen_count=9 where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: would_reopen_count frozen [A15-035]');
select denied($$ update finance.reconciliation_runs set prospective_by_kind='{"x":1}'::jsonb where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: prospective_by_kind frozen [A15-036]');
select denied($$ update finance.reconciliation_runs set report_samples='{"x":1}'::jsonb where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: report_samples frozen [A15-037]');
select denied($$ update finance.reconciliation_runs set report_version=9 where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: report_version frozen [A15-038]');
select denied($$ update finance.reconciliation_runs set report_completed_at=now()+interval '1 hour' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: report_completed_at frozen [A15-039]');
select denied($$ update finance.reconciliation_runs set approved_by='11111111-1111-1111-1111-111111111111' , approved_at=now(), approval_note='n2' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: approval identity, timestamp and note frozen [A15-040]');
grant update (status) on finance.reconciliation_runs to service_role;
grant select on fr to service_role;
set local role service_role;
select denied($$ update finance.reconciliation_runs set status='failed' where id=(select id from fr) $$, 'P0001', 'approved evidence is frozen', 'req 115: service_role with a widened grant still dies in the freeze trigger [A15-041]');
reset role;
revoke update (status) on finance.reconciliation_runs from service_role;
select lives_ok($$ update finance.reconciliation_runs set heartbeat_at=now() where id=(select id from fr) $$, 'req 115: a non-frozen operational field stays mutable -- the trigger does not simply block everything [A15-042]');

-- ===== R119/R120: resolution behaviour =====
select denied($$ select finance.resolve_exception((select id from finance.reconciliation_exceptions where provider_object_id='obj_q2'), 'resolved', 'again') $$, 'P0001', 'already', 'req 119: re-resolving a DISMISSED row raises [A15-043]');
-- resolution wins over quarantine, preserving quarantine history
update finance.reconciliation_exceptions set consecutive_failure_runs=3 where provider_object_id='obj_q3';
set local role service_role;
select finance.quarantine_object((select id from finance.reconciliation_exceptions where provider_object_id='obj_q3'));
reset role;
select lives_ok($$ select finance.resolve_exception((select id from finance.reconciliation_exceptions where provider_object_id='obj_q3'), 'resolved', 'resolved while quarantined') $$, 'req 120: an actively quarantined row resolves through the function [A15-044]');
select ok((select quarantined_at is not null and released_at is null and resolution_status='resolved' from finance.reconciliation_exceptions where provider_object_id='obj_q3'),
  'req 120: resolution does not erase quarantine history and release does not masquerade as resolution [A15-045]');
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail) values ('provider_object_processing_failed',true,'obj_q3','{"object_type":"refund","error_class":"malformed_object"}'::jsonb) $$,
  'req 120: the resolved row leaves the open-slot free for recurrence [A15-046]');
-- ===== Batch 7: creation-time guards, upsert, claim-guard posture =====
-- R124: all NINE protected columns individually, WITH the grant widened, so the
-- BEFORE INSERT trigger -- not the grant -- is proven load-bearing.
grant insert (kind,livemode,provider_object_id,detail,resolution_status,resolved_at,resolved_by,resolution_note,quarantined_at,quarantine_reason,released_at,released_by,release_note)
  on finance.reconciliation_exceptions to service_role;
set local role service_role;
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolution_status) values ('amount_mismatch',true,'r124a','resolved') $$, 'P0001', 'must be created open', 'req 124: resolution_status<>open rejected by the trigger despite the widened grant [A15-047]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolved_at) values ('amount_mismatch',true,'r124b',now()) $$, 'P0001', 'may not be created', 'req 124: resolved_at rejected individually [A15-048]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolved_by) values ('amount_mismatch',true,'r124c','11111111-1111-1111-1111-111111111111') $$, 'P0001', 'may not be created', 'req 124: resolved_by rejected individually [A15-049]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,resolution_note) values ('amount_mismatch',true,'r124d','n') $$, 'P0001', 'may not be created', 'req 124: resolution_note rejected individually [A15-050]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,quarantined_at) values ('amount_mismatch',true,'r124e',now()) $$, 'P0001', 'may not be created', 'req 124: quarantined_at rejected individually [A15-051]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,quarantine_reason) values ('amount_mismatch',true,'r124f','q') $$, 'P0001', 'may not be created', 'req 124: quarantine_reason rejected individually [A15-052]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,released_at) values ('amount_mismatch',true,'r124g',now()) $$, 'P0001', 'may not be created', 'req 124: released_at rejected individually [A15-053]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,released_by) values ('amount_mismatch',true,'r124h','11111111-1111-1111-1111-111111111111') $$, 'P0001', 'may not be created', 'req 124: released_by rejected individually [A15-054]');
select denied($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,release_note) values ('amount_mismatch',true,'r124i','n') $$, 'P0001', 'may not be created', 'req 124: release_note rejected individually [A15-055]');
-- R125: the deduplicating upsert executes with the streak path intact
select lives_ok($$ insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id) values ('ledger_without_provider',true,'obj_ledger_without_provider')
  on conflict (dedup_key, livemode) where resolution_status='open'
  do update set occurrence_count = finance.reconciliation_exceptions.occurrence_count + 1,
                last_detected_at = clock_timestamp(),
                detail = excluded.detail,
                consecutive_failure_runs = finance.reconciliation_exceptions.consecutive_failure_runs + 1 $$,
  'req 125: the ON CONFLICT dedup upsert executes as service_role [A15-056]');
select is((select occurrence_count from finance.reconciliation_exceptions where provider_object_id='obj_ledger_without_provider' and livemode), 2,
  'req 125: the upsert updated the existing row, not a duplicate [A15-057]');
reset role;
revoke insert (resolution_status,resolved_at,resolved_by,resolution_note,quarantined_at,quarantine_reason,released_at,released_by,release_note)
  on finance.reconciliation_exceptions from service_role;
select is((select count(*)::int from information_schema.column_privileges where table_schema='finance' and table_name='reconciliation_exceptions' and grantee='service_role' and privilege_type='INSERT' and column_name in ('resolution_status','resolved_at','resolved_by','resolution_note','quarantined_at','quarantine_reason','released_at','released_by','release_note')), 0,
  'req 124: the temporary widening is fully revoked [A15-058]');
-- R129: approved_at individually + trigger under a widened grant
grant insert (livemode,implementation_version,window_start,window_end,dry_run,approved_at) on finance.reconciliation_runs to service_role;
set local role service_role;
select denied($$ insert into finance.reconciliation_runs(livemode,implementation_version,window_start,window_end,dry_run,approved_at) values (false,'v1',now()-interval '2 day',now()-interval '1 day',true,now()) $$, 'P0001', 'may not be created already approved', 'req 129: approved_at at INSERT dies in the trigger despite a widened grant [A15-059]');
reset role;
revoke insert (livemode,implementation_version,window_start,window_end,dry_run,approved_at) on finance.reconciliation_runs from service_role;
-- R121 extras: no application role can create a competing overload
select is((select count(*)::int from (values ('anon'),('authenticated'),('service_role')) r(n) where has_schema_privilege(r.n, 'finance', 'CREATE')), 0,
  'req 121: no application role holds CREATE in finance -- a caller-made overload cannot change the trusted identity [A15-060]');
-- claim guard: expiry compared against clock_timestamp, not transaction start
select ok((select p.prosrc ilike '%clock_timestamp%' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='finance' and p.proname='tg_link_claim_guard'),
  'req 38/121-family: the claim guard compares expiry to clock_timestamp, so a long transaction cannot admit an expired claim [A15-061]');
-- R133: parent-then-child in ONE transaction satisfies the deferred check
select lives_ok($$ do $x$ declare aid uuid; begin
  insert into finance.agreements(member_id,purpose,created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a','other','11111111-1111-1111-1111-111111111111') returning id into aid;
  insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) values (aid,null,'draft','direct import','11111111-1111-1111-1111-111111111111');
  set constraints all immediate;
end $x$ $$, 'req 133: parent first, then its initial draft event, satisfies the deferred check in one transaction [A15-062]');
select denied($$ do $x$ begin
  insert into finance.agreements(member_id,purpose,created_by) values ('aaaaaaaa-0000-0000-0000-00000000000a','journey_contribution','11111111-1111-1111-1111-111111111111');
  set constraints all immediate;
end $x$ $$, 'P0001', 'must have exactly one initial lifecycle event', 'req 133: a direct-import parent without its event fails at the constraint boundary [A15-063]');
select * from finish();
rollback;
