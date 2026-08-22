-- Financials V2 — PR 3B: the 24-month event payload retention job.
--
-- WHY A FUNCTION
--
-- `service_role` holds no UPDATE on `finance.stripe_events` (the schema is
-- append-only to the application role), so retention cannot be done from the
-- application. Same model as D-079: SECURITY DEFINER, pinned search_path, EXECUTE
-- to `service_role` only, append-only grants untouched.
--
-- WHY THE ROW SURVIVES
--
-- Only the PAYLOAD is dropped, never the row. `stripe_events.event_id` is the
-- foreign-key target of `ledger_entries.origin_stripe_event_id`, so deleting the
-- row would either orphan the provenance of a ledger entry or be refused by the
-- FK. The payload is the part carrying cardholder-adjacent data and is what the
-- retention commitment is actually about; the identity of the event is evidence
-- and is kept.

create or replace function finance.purge_expired_event_payloads(
  p_before timestamptz,
  p_limit  integer default 5000
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_purged integer;
begin
  if p_before is null then
    raise exception 'purge_expired_event_payloads: p_before is required'
      using errcode = 'VK400';
  end if;
  -- A future cutoff would purge everything, including payloads still needed for
  -- reconciliation. Refuse rather than accept an obviously wrong horizon.
  if p_before > clock_timestamp() then
    raise exception 'purge_expired_event_payloads: p_before % is in the future', p_before
      using errcode = 'VK400';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 50000 then
    raise exception 'purge_expired_event_payloads: p_limit must be 1..50000'
      using errcode = 'VK400';
  end if;

  -- Bounded and resumable: a single statement over years of events would hold
  -- locks far too long, so each call takes a capped batch and the caller repeats.
  -- SKIP LOCKED keeps it clear of rows a worker currently holds.
  with expired as (
    select event_id
      from finance.stripe_events
     where received_at < p_before
       and payload is not null
     order by received_at
     limit p_limit
     for update skip locked
  )
  update finance.stripe_events e
     set payload = null
    from expired x
   where e.event_id = x.event_id;

  get diagnostics v_purged = row_count;
  return v_purged;
end $fn$;

comment on function finance.purge_expired_event_payloads(timestamptz, integer) is
  'PR 3 retention: nulls stripe_events.payload past the 24-month horizon. The ROW is kept - event_id is a foreign key target for ledger_entries.origin_stripe_event_id and deleting it would orphan provenance. Only the payload, which is the part carrying cardholder-adjacent data, is dropped.';

revoke all on function finance.purge_expired_event_payloads(timestamptz, integer) from public;
grant execute on function finance.purge_expired_event_payloads(timestamptz, integer) to service_role;

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
