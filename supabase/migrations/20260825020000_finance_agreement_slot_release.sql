-- Financials V2 — D-089: a CLOSED agreement frees its purpose slot.
--
-- Found by the founder in production: UNIQUE NULLS NOT DISTINCT
-- (member_id, journey_id, purpose) on finance.agreements enforces one
-- agreement EVER per slot, but the intent was one OPEN agreement per slot —
-- lifecycle lives in the append-only events table, so a canceled agreement
-- kept its slot forever and "New agreement" was refused with a duplicate-key
-- error for any purpose the member had ever used.
--
-- Fix: agreements carry a derived closed_at stamp, maintained by
-- transition_agreement on every transition (canceled/waived/fulfilled set it),
-- and uniqueness becomes a partial unique index over OPEN agreements only.
-- The lifecycle state machine (tg_lifecycle_transition) already makes closed
-- states terminal, so the stamp can never legitimately clear — the recompute
-- in the function is belt-and-braces, not a reopening path. History is
-- untouched; the one-open-per-slot invariant stays declarative in the
-- database, race-safe under concurrent creates.

begin;

alter table finance.agreements add column closed_at timestamptz null;

-- The blanket append-only trigger (shared by other fact tables, untouched)
-- forbids ALL updates. Agreements now carry exactly one derived column, so
-- the UPDATE path gets a column-frozen trigger permitting closed_at alone —
-- the same pattern public_support_entries uses for its set-once supporter_id.
-- DELETE stays blanket-refused.
create or replace function finance.tg_agreements_closed_stamp_only()
returns trigger
language plpgsql
as $fn$
begin
  if new.id is distinct from old.id
     or new.member_id is distinct from old.member_id
     or new.journey_id is distinct from old.journey_id
     or new.purpose is distinct from old.purpose
     or new.currency is distinct from old.currency
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by then
    raise exception 'UPDATE on agreements is forbidden: only the derived closed_at stamp may change';
  end if;
  return new;
end $fn$;

drop trigger agreements_insert_only on finance.agreements;
create trigger agreements_no_delete before delete on finance.agreements
  for each row execute function finance.tg_append_only();
create trigger agreements_closed_stamp_only before update on finance.agreements
  for each row execute function finance.tg_agreements_closed_stamp_only();

-- Backfill from the lifecycle log's latest state.
update finance.agreements a
   set closed_at = x.occurred_at
  from (select distinct on (e.agreement_id) e.agreement_id, e.to_status, e.occurred_at
          from finance.agreement_lifecycle_events e
         order by e.agreement_id, e.occurred_at desc, e.seq desc) x
 where x.agreement_id = a.id
   and x.to_status in ('canceled', 'waived', 'fulfilled');

-- transition_agreement now maintains the stamp alongside the event it writes.
-- Same signature, same founder-only authorisation, same append-only log.
create or replace function finance.transition_agreement(
  p_agreement_id uuid, p_to_status finance.agreement_lifecycle, p_reason text
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_current finance.agreement_lifecycle;
begin
  if not public.is_founder() then
    raise exception 'transition_agreement: founder role required';
  end if;
  if p_to_status is null then
    raise exception 'transition_agreement: target status is required' using errcode = 'VK400';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'transition_agreement: a non-blank reason is required' using errcode = 'VK400';
  end if;
  perform 1 from finance.agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'transition_agreement: agreement % does not exist', p_agreement_id using errcode = 'VK404';
  end if;
  select e.to_status into v_current
    from finance.agreement_lifecycle_events e
   where e.agreement_id = p_agreement_id
   order by e.occurred_at desc, e.seq desc
   limit 1;
  if v_current is null then
    raise exception 'transition_agreement: agreement % has no lifecycle', p_agreement_id using errcode = 'VK409';
  end if;
  insert into finance.agreement_lifecycle_events (agreement_id, from_status, to_status, reason, actor_id)
  values (p_agreement_id, v_current, p_to_status, p_reason, auth.uid());

  -- The stamp is recomputed on EVERY transition so it always mirrors the
  -- latest lifecycle event, including a founder reopening a closed agreement.
  update finance.agreements
     set closed_at = case when p_to_status in ('canceled', 'waived', 'fulfilled')
                          then clock_timestamp() else null end
   where id = p_agreement_id;
end $fn$;

-- One OPEN agreement per (member, journey, purpose); closed history is free.
alter table finance.agreements drop constraint agreements_member_journey_purpose_key;
create unique index agreements_one_open_per_slot
  on finance.agreements (member_id, journey_id, purpose) nulls not distinct
  where closed_at is null;

do $assert$
declare bad int;
begin
  -- The old one-EVER constraint is gone; the one-OPEN index exists, partial
  -- and unique.
  if to_regclass('finance.agreements_one_open_per_slot') is null then
    raise exception 'D-089 assert: the one-open-per-slot index is missing';
  end if;
  if exists (select 1 from pg_constraint where conname = 'agreements_member_journey_purpose_key') then
    raise exception 'D-089 assert: the one-ever constraint survived';
  end if;
  if not exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
                 where c.relname = 'agreements_one_open_per_slot'
                   and i.indisunique and i.indpred is not null) then
    raise exception 'D-089 assert: the index is not a partial unique index';
  end if;

  -- The stamp agrees with the lifecycle log, both directions.
  select count(*) into bad
  from finance.agreements a
  join (select distinct on (e.agreement_id) e.agreement_id, e.to_status
          from finance.agreement_lifecycle_events e
         order by e.agreement_id, e.occurred_at desc, e.seq desc) x on x.agreement_id = a.id
  where (x.to_status in ('canceled','waived','fulfilled')) <> (a.closed_at is not null);
  if bad > 0 then raise exception 'D-089 assert: % agreements disagree with their lifecycle', bad; end if;

  -- DELETE is still blanket-refused and UPDATE is column-frozen.
  if not exists (select 1 from pg_trigger t join pg_proc p on p.oid = t.tgfoid
                 where t.tgrelid = 'finance.agreements'::regclass
                   and p.proname = 'tg_append_only' and not t.tgisinternal) then
    raise exception 'D-089 assert: agreements lost their no-delete guard';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'finance' and p.proname = 'tg_agreements_closed_stamp_only'
                   and p.prosrc ilike '%member_id%') then
    raise exception 'D-089 assert: the column-frozen update guard is missing';
  end if;

  raise notice 'D-089 ASSERTIONS PASSED';
end $assert$;

commit;
