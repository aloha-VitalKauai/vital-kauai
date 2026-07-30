-- Financials V2 PR 1 — the six functions (ARCHITECTURE §15).
-- Every SECURITY DEFINER function pins search_path (§9).

-- 1 ------------------------------------------------- finance.current_member_id()
-- members.profile_id = auth.uid() is the true link. Never member_id = auth.uid()
-- on a members(id) column, and never an email join (D-015).
create function finance.current_member_id() returns uuid
  language sql stable security definer set search_path = pg_catalog, public, finance as $$
  select m.id from public.members m where m.profile_id = auth.uid();
$$;

revoke all on function finance.current_member_id() from public;
grant execute on function finance.current_member_id() to authenticated, service_role;

-- 2 ------------------------------------------------- finance.create_agreement()
create function finance.create_agreement(
  p_member_id uuid, p_journey_id uuid,
  p_purpose finance.agreement_purpose, p_reason text
) returns uuid
  language plpgsql volatile security definer set search_path = pg_catalog, public, finance as $$
declare v_id uuid;
begin
  if not public.is_founder() then
    raise exception 'create_agreement: founder role required';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'create_agreement: a non-blank reason is required';
  end if;

  -- Parent first, in one transaction (§4). The order is fixed, not free.
  insert into finance.agreements (member_id, journey_id, purpose, created_by)
  values (p_member_id, p_journey_id, p_purpose, auth.uid())
  returning id into v_id;

  insert into finance.agreement_lifecycle_events
    (agreement_id, from_status, to_status, reason, actor_id)
  values (v_id, null, 'draft', p_reason, auth.uid());

  return v_id;
end $$;

revoke all on function finance.create_agreement(uuid, uuid, finance.agreement_purpose, text) from public;
grant execute on function finance.create_agreement(uuid, uuid, finance.agreement_purpose, text) to authenticated;

-- 3 ------------------------------------------------- finance.approve_dry_run()
-- Actor and timestamp are computed internally and are not parameters, so
-- attribution cannot be spoofed. Re-approval raises.
create function finance.approve_dry_run(p_run_id uuid, p_note text) returns void
  language plpgsql volatile security definer set search_path = pg_catalog, public, finance as $$
declare r finance.reconciliation_runs%rowtype;
begin
  if not public.is_founder() then
    raise exception 'approve_dry_run: founder role required';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'approve_dry_run: a non-blank note is required';
  end if;

  select * into r from finance.reconciliation_runs where id = p_run_id for update;
  if not found then raise exception 'approve_dry_run: run % not found', p_run_id; end if;

  if r.approved_at is not null then
    raise exception 'approve_dry_run: run % is already approved; a superseding approval requires a new dry run', p_run_id;
  end if;
  if not r.dry_run then
    raise exception 'approve_dry_run: run % is not a dry run', p_run_id;
  end if;
  if r.status <> 'completed' then
    raise exception 'approve_dry_run: run % is %, not completed', p_run_id, r.status;
  end if;
  if not r.window_exhausted then
    raise exception 'approve_dry_run: run % did not exhaust its window', p_run_id;
  end if;
  if r.finished_at is null then
    raise exception 'approve_dry_run: run % has not finished', p_run_id;
  end if;
  if r.error is not null then
    raise exception 'approve_dry_run: run % ended with an error', p_run_id;
  end if;
  if r.report_completed_at is null then
    raise exception 'approve_dry_run: run % has no completed report to approve', p_run_id;
  end if;

  update finance.reconciliation_runs
     set approved_by = auth.uid(), approved_at = clock_timestamp(), approval_note = p_note
   where id = p_run_id;
end $$;

revoke all on function finance.approve_dry_run(uuid, text) from public;
grant execute on function finance.approve_dry_run(uuid, text) to authenticated;

-- 4 ------------------------------------------------ finance.resolve_exception()
create function finance.resolve_exception(
  p_exception_id uuid, p_resolution finance.exception_resolution, p_note text
) returns void
  language plpgsql volatile security definer set search_path = pg_catalog, public, finance as $$
declare e finance.reconciliation_exceptions%rowtype;
begin
  if not public.is_founder() then
    raise exception 'resolve_exception: founder role required';
  end if;
  if p_resolution not in ('resolved','dismissed') then
    raise exception 'resolve_exception: target must be resolved or dismissed, got %', p_resolution;
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'resolve_exception: a non-blank note is required';
  end if;

  select * into e from finance.reconciliation_exceptions where id = p_exception_id for update;
  if not found then raise exception 'resolve_exception: exception % not found', p_exception_id; end if;
  if e.resolution_status <> 'open' then
    raise exception 'resolve_exception: exception % is already %', p_exception_id, e.resolution_status;
  end if;

  -- Resolution wins over quarantine: an actively quarantined row may be resolved.
  update finance.reconciliation_exceptions
     set resolution_status = p_resolution,
         resolved_by = auth.uid(), resolved_at = clock_timestamp(),
         resolution_note = p_note
   where id = p_exception_id;
end $$;

revoke all on function finance.resolve_exception(uuid, finance.exception_resolution, text) from public;
grant execute on function finance.resolve_exception(uuid, finance.exception_resolution, text) to authenticated;

-- 5 ----------------------------------------------- finance.quarantine_object()
-- service_role only. Takes no reason parameter: quarantine_reason is derived
-- from the row's own validated detail.error_class, because a supplied reason
-- can contradict the row it describes.
create function finance.quarantine_object(p_exception_id uuid) returns void
  language plpgsql volatile security definer set search_path = pg_catalog, public, finance as $$
declare e finance.reconciliation_exceptions%rowtype; v_at timestamptz;
begin
  select * into e from finance.reconciliation_exceptions where id = p_exception_id for update;
  if not found then raise exception 'quarantine_object: exception % not found', p_exception_id; end if;

  if e.resolution_status <> 'open' then
    raise exception 'quarantine_object: exception % is %, not open', p_exception_id, e.resolution_status;
  end if;
  if e.kind <> 'provider_object_processing_failed' then
    raise exception 'quarantine_object: only provider_object_processing_failed may be quarantined, got %', e.kind;
  end if;
  if e.quarantined_at is not null
     and (e.released_at is null or e.released_at < e.quarantined_at) then
    raise exception 'quarantine_object: exception % is already actively quarantined', p_exception_id;
  end if;
  if e.consecutive_failure_runs < 3 then
    raise exception 'quarantine_object: exception % has % consecutive failures, threshold is 3',
      p_exception_id, e.consecutive_failure_runs;
  end if;
  if e.provider_object_id is null or (e.detail ->> 'error_class') is null then
    raise exception 'quarantine_object: exception % lacks provider_object_id or detail.error_class',
      p_exception_id;
  end if;

  -- Strictly monotonic: clock_timestamp() is statement-time, not transaction
  -- start, and GREATEST guarantees ordering across overlapping transactions
  -- and backward clock adjustment (D-057).
  v_at := greatest(clock_timestamp(),
                   coalesce(e.released_at, '-infinity'::timestamptz) + interval '1 microsecond');

  update finance.reconciliation_exceptions
     set quarantined_at = v_at,
         quarantine_reason = e.detail ->> 'error_class'
   where id = p_exception_id;
end $$;

revoke all on function finance.quarantine_object(uuid) from public;
grant execute on function finance.quarantine_object(uuid) to service_role;

-- 6 --------------------------------------------- finance.release_quarantine()
create function finance.release_quarantine(p_exception_id uuid, p_note text) returns void
  language plpgsql volatile security definer set search_path = pg_catalog, public, finance as $$
declare e finance.reconciliation_exceptions%rowtype; v_at timestamptz;
begin
  if not public.is_founder() then
    raise exception 'release_quarantine: founder role required';
  end if;
  if p_note is null or length(btrim(p_note)) = 0 then
    raise exception 'release_quarantine: a non-blank note is required';
  end if;

  select * into e from finance.reconciliation_exceptions where id = p_exception_id for update;
  if not found then raise exception 'release_quarantine: exception % not found', p_exception_id; end if;

  if e.quarantined_at is null
     or (e.released_at is not null and e.released_at >= e.quarantined_at) then
    raise exception 'release_quarantine: exception % is not actively quarantined', p_exception_id;
  end if;

  v_at := greatest(clock_timestamp(), e.quarantined_at + interval '1 microsecond');

  update finance.reconciliation_exceptions
     set released_at = v_at, released_by = auth.uid(),
         release_note = p_note, consecutive_failure_runs = 0
   where id = p_exception_id;
end $$;

revoke all on function finance.release_quarantine(uuid, text) from public;
grant execute on function finance.release_quarantine(uuid, text) to authenticated;
