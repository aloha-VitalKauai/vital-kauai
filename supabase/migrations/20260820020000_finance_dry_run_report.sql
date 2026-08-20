-- Financials V2 — PR 3B: the dry-run report writer.
--
-- WHY THIS EXISTS
--
-- Found while wiring the §10a orchestration, not by reading the schema. A dry run
-- must populate `would_create_count`, `would_reopen_count`, `prospective_by_kind`,
-- `report_samples`, `report_version` and `report_completed_at` (acceptance 17,
-- 18i). D-079 shipped nine mutation functions and none of them writes those
-- columns: `advance_reconciliation_run` moves counters and the cursor,
-- `finish_reconciliation_run` moves terminal state. `service_role` holds no UPDATE
-- on `finance.reconciliation_runs`, so without this the dry-run report could not
-- be written at all — and `tg_run_authorization` refuses to authorise a writing
-- run whose predecessor has `report_completed_at IS NULL`, so the entire
-- dry-run → approval → canary sequence was unreachable.
--
-- Same model as D-079: SECURITY DEFINER, pinned search_path, EXECUTE granted only
-- to `service_role`, and no relaxation of the append-only table grants.

create or replace function finance.record_dry_run_report(
  p_run_id              uuid,
  p_would_create_count  integer,
  p_would_reopen_count  integer,
  p_prospective_by_kind jsonb,
  p_report_samples      jsonb,
  p_report_version      text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  r finance.reconciliation_runs%rowtype;
begin
  if p_run_id is null then
    raise exception 'record_dry_run_report: p_run_id is required' using errcode = 'VK400';
  end if;
  if p_would_create_count is null or p_would_create_count < 0
     or p_would_reopen_count is null or p_would_reopen_count < 0 then
    raise exception 'record_dry_run_report: prospective counts must be non-negative'
      using errcode = 'VK400';
  end if;
  if p_prospective_by_kind is null or jsonb_typeof(p_prospective_by_kind) <> 'object' then
    raise exception 'record_dry_run_report: p_prospective_by_kind must be a JSON object'
      using errcode = 'VK400';
  end if;
  if p_report_version is null or length(trim(p_report_version)) = 0 then
    raise exception 'record_dry_run_report: p_report_version is required'
      using errcode = 'VK400';
  end if;

  select * into r from finance.reconciliation_runs where id = p_run_id for update;
  if not found then
    raise exception 'record_dry_run_report: run % does not exist', p_run_id
      using errcode = 'VK404';
  end if;

  -- A report describes what a run WOULD have done. A writing run did it, so a
  -- report on one would be a fabrication — and tg_run_authorization treats a
  -- reported run as approvable evidence for a later writing run.
  if not r.dry_run then
    raise exception 'record_dry_run_report: run % is not a dry run', p_run_id
      using errcode = 'VK409';
  end if;

  -- Acceptance 18i: a dry run creates no exceptions and no ledger entries. If
  -- those counters moved, the run wrote something, and its report cannot be
  -- trusted as the basis for authorising a writing run.
  if r.exceptions_created <> 0 or r.exceptions_reopened <> 0 then
    raise exception
      'record_dry_run_report: run % recorded real writes (created=%, reopened=%); a dry run must write nothing',
      p_run_id, r.exceptions_created, r.exceptions_reopened
      using errcode = 'VK409';
  end if;

  -- D-059: approved evidence is frozen. Re-reporting afterwards would change what
  -- a founder already signed. tg_run_freeze_approved also blocks this at the
  -- table; failing here names the reason instead of surfacing a trigger message.
  if r.approved_at is not null then
    raise exception 'record_dry_run_report: run % is approved; its evidence is frozen', p_run_id
      using errcode = 'VK409';
  end if;

  update finance.reconciliation_runs
     set would_create_count   = p_would_create_count,
         would_reopen_count   = p_would_reopen_count,
         prospective_by_kind  = p_prospective_by_kind,
         report_samples       = p_report_samples,
         report_version       = p_report_version,
         report_completed_at  = clock_timestamp(),
         heartbeat_at         = clock_timestamp()
   where id = p_run_id;
end $fn$;

revoke all on function finance.record_dry_run_report(uuid, integer, integer, jsonb, jsonb, text) from public;
grant execute on function finance.record_dry_run_report(uuid, integer, integer, jsonb, jsonb, text) to service_role;

-- Prove the append-only model is unchanged, in the same transaction.
do $chk$
declare n integer;
begin
  select count(*) into n
    from information_schema.role_table_grants
   where table_schema = 'finance'
     and grantee in ('anon', 'authenticated', 'service_role')
     and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE');
  if n <> 0 then
    raise exception 'append-only model violated: % UPDATE/DELETE/TRUNCATE grant(s) in finance', n;
  end if;
end $chk$;
