-- Financials V2 — PR 5: the founder financial-controls mutation surface.
--
-- Five SECURITY DEFINER functions, one schema decision (D-083), and the
-- SECURITY INVOKER finance_api wrappers. Same contract as D-079/PR 3C:
-- founder authorisation via is_founder() inside the functions, identity and
-- timestamps derived in Postgres (auth.uid(), clock_timestamp()/now()), pinned
-- search_path, EXECUTE to `authenticated` only for founder actions, no direct
-- table writes from the application, and no UPDATE/DELETE anywhere — every
-- history is append-only, which is what makes it a permanent audit trail.
--
-- D-083 — DATABASE-ENFORCED IDEMPOTENCY FOR EXTERNAL PAYMENTS.
-- A founder recording a cheque must not be able to record it twice by
-- double-click or network retry. Client-side debouncing is not enforcement, so:
-- `ledger_entries` gains a nullable `idempotency_key uuid` with a partial unique
-- index. `record_external_payment` REQUIRES the key; a second submission with
-- the same key returns the EXISTING entry id instead of inserting. The column is
-- nullable because reconciliation-written rows have their own natural identity
-- (provider_object_id) and gain nothing from a synthetic key. Append-only is
-- untouched: the column is set at INSERT and tg_append_only still forbids
-- UPDATE/DELETE.

alter table finance.ledger_entries
  add column if not exists idempotency_key uuid;

create unique index if not exists ledger_entries_idempotency_uq
  on finance.ledger_entries (idempotency_key)
  where idempotency_key is not null;

comment on column finance.ledger_entries.idempotency_key is
  'D-083: client-generated key making founder-recorded entries idempotent. A retry with the same key returns the existing entry rather than duplicating money. Null for reconciliation-written rows, whose identity is the provider object.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create an agreement with its initial Contribution
-- ─────────────────────────────────────────────────────────────────────────────

-- Composes the existing finance.create_agreement (agreement + initial draft
-- lifecycle event, founder-checked, reason required) with the initial amount
-- row, in one transaction — so an agreement cannot exist half-configured.
create or replace function finance.create_agreement_with_contribution(
  p_member_id uuid,
  p_journey_id uuid,
  p_purpose finance.agreement_purpose,
  p_contribution_cents bigint,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_id uuid;
begin
  -- Founder check and reason validation live in create_agreement; re-checking
  -- here would duplicate a rule that must stay authoritative in one place.
  if p_contribution_cents is null or p_contribution_cents < 0 then
    raise exception 'create_agreement_with_contribution: contribution must be >= 0'
      using errcode = 'VK400';
  end if;

  v_id := finance.create_agreement(p_member_id, p_journey_id, p_purpose, p_reason);

  insert into finance.agreement_amounts (agreement_id, amount_cents, effective_at, reason, actor_id)
  values (v_id, p_contribution_cents, now(), p_reason, auth.uid());

  return v_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Amend the Contribution
-- ─────────────────────────────────────────────────────────────────────────────

-- Append-only: an amendment is a new row in agreement_amounts, never an update.
-- The full history remains readable, which is the audit trail.
create or replace function finance.amend_contribution(
  p_agreement_id uuid,
  p_amount_cents bigint,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
begin
  if not public.is_founder() then
    raise exception 'amend_contribution: founder role required';
  end if;
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'amend_contribution: amount must be >= 0' using errcode = 'VK400';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'amend_contribution: a non-blank reason is required' using errcode = 'VK400';
  end if;
  -- Lock the agreement so a concurrent amendment serialises rather than
  -- interleaving two histories.
  perform 1 from finance.agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'amend_contribution: agreement % does not exist', p_agreement_id
      using errcode = 'VK404';
  end if;

  insert into finance.agreement_amounts (agreement_id, amount_cents, effective_at, reason, actor_id)
  values (p_agreement_id, p_amount_cents, now(), p_reason, auth.uid());
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Record an external payment (cheque, cash, wire, Zelle, Venmo, other)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.record_external_payment(
  p_agreement_id uuid,
  p_amount_cents bigint,
  p_method finance.external_method,
  p_occurred_at timestamptz,
  p_reason text,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_id uuid;
begin
  if not public.is_founder() then
    raise exception 'record_external_payment: founder role required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'record_external_payment: amount must be positive' using errcode = 'VK400';
  end if;
  if p_method is null then
    raise exception 'record_external_payment: method is required' using errcode = 'VK400';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'record_external_payment: a non-blank reason is required' using errcode = 'VK400';
  end if;
  -- Money received in the future is not a fact yet; money from the past is
  -- normal (a cheque recorded days after it arrived).
  if p_occurred_at is null or p_occurred_at > now() then
    raise exception 'record_external_payment: occurred_at must be now or in the past'
      using errcode = 'VK400';
  end if;
  -- D-083: the key is what makes retries safe, so its absence is an error, not
  -- a permitted variant.
  if p_idempotency_key is null then
    raise exception 'record_external_payment: an idempotency key is required' using errcode = 'VK400';
  end if;
  perform 1 from finance.agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'record_external_payment: agreement % does not exist', p_agreement_id
      using errcode = 'VK404';
  end if;

  begin
    insert into finance.ledger_entries (
      agreement_id, entry_type, amount_cents, currency, source, external_method,
      occurred_at, recorded_by, reason, livemode, idempotency_key
    ) values (
      -- L2: positive, source external, method required, no parent.
      -- L11: an external payment is real money, so livemode is TRUE by
      -- definition — test-mode has no cheques.
      -- L12: founder attribution via recorded_by = auth.uid(), reason required.
      p_agreement_id, 'external_payment', p_amount_cents, 'usd', 'external', p_method,
      p_occurred_at, auth.uid(), p_reason, true, p_idempotency_key
    )
    returning id into v_id;
  exception when unique_violation then
    -- The same submission arriving twice. The money is already recorded; return
    -- the existing entry so the caller sees success, not an error to retry.
    select id into v_id from finance.ledger_entries
     where idempotency_key = p_idempotency_key;
    if v_id is null then
      raise; -- some other unique violation: surface it
    end if;
  end;

  return v_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Reverse an incorrect ledger entry
-- ─────────────────────────────────────────────────────────────────────────────

-- A reversal is the founder's correction instrument: append-only negation, never
-- an update or delete. tg_ledger_invariants enforces the hard rules (exact
-- negation, parent is a payment or refund, parent not already effectively
-- reversed, same agreement); this function adds founder authorisation,
-- attribution, and inheritance of the parent's source and mode.
create or replace function finance.reverse_ledger_entry(
  p_entry_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  p finance.ledger_entries%rowtype;
  v_id uuid;
begin
  if not public.is_founder() then
    raise exception 'reverse_ledger_entry: founder role required';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'reverse_ledger_entry: a non-blank reason is required' using errcode = 'VK400';
  end if;

  select * into p from finance.ledger_entries where id = p_entry_id for update;
  if not found then
    raise exception 'reverse_ledger_entry: entry % does not exist', p_entry_id
      using errcode = 'VK404';
  end if;
  if p.entry_type = 'reversal' then
    raise exception 'reverse_ledger_entry: a reversal cannot be reversed; correct with a new entry'
      using errcode = 'VK409';
  end if;

  insert into finance.ledger_entries (
    agreement_id, entry_type, amount_cents, currency, source,
    parent_entry_id, occurred_at, recorded_by, reason, livemode
  ) values (
    -- L4/tg_ledger_invariants: exact negation, parent required.
    -- Source and livemode inherit from the parent so mode isolation holds.
    -- The reversal happens NOW regardless of when the mistake happened.
    p.agreement_id, 'reversal', -p.amount_cents, 'usd', p.source,
    p.id, now(), auth.uid(), p_reason, p.livemode
  )
  returning id into v_id;

  return v_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Lifecycle transition
-- ─────────────────────────────────────────────────────────────────────────────

-- The current status is read INSIDE the same transaction and passed as
-- from_status, so tg_lifecycle_transition's staleness check still bites if two
-- founders act at once: the second insert sees a changed current status and is
-- refused rather than silently re-ordered.
create or replace function finance.transition_agreement(
  p_agreement_id uuid,
  p_to_status finance.agreement_lifecycle,
  p_reason text
)
returns void
language plpgsql
security definer
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
    raise exception 'transition_agreement: agreement % does not exist', p_agreement_id
      using errcode = 'VK404';
  end if;

  select e.to_status into v_current
    from finance.agreement_lifecycle_events e
   where e.agreement_id = p_agreement_id
   order by e.occurred_at desc, e.seq desc
   limit 1;
  if v_current is null then
    raise exception 'transition_agreement: agreement % has no lifecycle', p_agreement_id
      using errcode = 'VK409';
  end if;

  insert into finance.agreement_lifecycle_events
    (agreement_id, from_status, to_status, reason, actor_id)
  values (p_agreement_id, v_current, p_to_status, p_reason, auth.uid());
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants on the inner functions: authenticated only (founder-checked inside)
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function finance.create_agreement_with_contribution(uuid, uuid, finance.agreement_purpose, bigint, text) from public;
revoke all on function finance.amend_contribution(uuid, bigint, text) from public;
revoke all on function finance.record_external_payment(uuid, bigint, finance.external_method, timestamptz, text, uuid) from public;
revoke all on function finance.reverse_ledger_entry(uuid, text) from public;
revoke all on function finance.transition_agreement(uuid, finance.agreement_lifecycle, text) from public;

grant execute on function finance.create_agreement_with_contribution(uuid, uuid, finance.agreement_purpose, bigint, text) to authenticated;
grant execute on function finance.amend_contribution(uuid, bigint, text) to authenticated;
grant execute on function finance.record_external_payment(uuid, bigint, finance.external_method, timestamptz, text, uuid) to authenticated;
grant execute on function finance.reverse_ledger_entry(uuid, text) to authenticated;
grant execute on function finance.transition_agreement(uuid, finance.agreement_lifecycle, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. finance_api: SECURITY INVOKER wrappers and the read views the UI needs
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance_api.create_agreement_with_contribution(
  p_member_id uuid, p_journey_id uuid, p_purpose text,
  p_contribution_cents bigint, p_reason text
) returns uuid language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.create_agreement_with_contribution(
       p_member_id, p_journey_id, p_purpose::finance.agreement_purpose,
       p_contribution_cents, p_reason); $$;

create or replace function finance_api.amend_contribution(
  p_agreement_id uuid, p_amount_cents bigint, p_reason text
) returns void language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.amend_contribution(p_agreement_id, p_amount_cents, p_reason); $$;

create or replace function finance_api.record_external_payment(
  p_agreement_id uuid, p_amount_cents bigint, p_method text,
  p_occurred_at timestamptz, p_reason text, p_idempotency_key uuid
) returns uuid language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.record_external_payment(
       p_agreement_id, p_amount_cents, p_method::finance.external_method,
       p_occurred_at, p_reason, p_idempotency_key); $$;

create or replace function finance_api.reverse_ledger_entry(
  p_entry_id uuid, p_reason text
) returns uuid language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.reverse_ledger_entry(p_entry_id, p_reason); $$;

create or replace function finance_api.transition_agreement(
  p_agreement_id uuid, p_to_status text, p_reason text
) returns void language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.transition_agreement(
       p_agreement_id, p_to_status::finance.agreement_lifecycle, p_reason); $$;

-- Per-agreement balances, including the canonical Payment state.
create or replace view finance_api.agreement_balances
with (security_invoker = true) as
  select agreement_id, member_id, journey_id, purpose, currency,
         contribution_applies, contribution_cents, gross_received_cents,
         refunded_cents, reversed_cents, net_received_cents, remaining_cents,
         payable_remaining_cents, payment_state
    from finance.v_agreement_balances;

-- Contribution history (append-only amendments).
create or replace view finance_api.agreement_amounts
with (security_invoker = true) as
  select id, seq, agreement_id, amount_cents, effective_at, reason, actor_id, created_at
    from finance.agreement_amounts;

-- Lifecycle history.
create or replace view finance_api.agreement_lifecycle_events
with (security_invoker = true) as
  select id, seq, agreement_id, from_status, to_status, reason, actor_id,
         occurred_at, created_at
    from finance.agreement_lifecycle_events;

grant select on finance_api.agreement_balances         to authenticated, service_role;
grant select on finance_api.agreement_amounts          to authenticated, service_role;
grant select on finance_api.agreement_lifecycle_events to authenticated, service_role;
-- Payment activity: the ledger view already exists; the founder UI now needs it.
grant select on finance_api.ledger_entries             to authenticated;

revoke all on function finance_api.create_agreement_with_contribution(uuid, uuid, text, bigint, text) from public;
revoke all on function finance_api.amend_contribution(uuid, bigint, text) from public;
revoke all on function finance_api.record_external_payment(uuid, bigint, text, timestamptz, text, uuid) from public;
revoke all on function finance_api.reverse_ledger_entry(uuid, text) from public;
revoke all on function finance_api.transition_agreement(uuid, text, text) from public;

grant execute on function finance_api.create_agreement_with_contribution(uuid, uuid, text, bigint, text) to authenticated;
grant execute on function finance_api.amend_contribution(uuid, bigint, text) to authenticated;
grant execute on function finance_api.record_external_payment(uuid, bigint, text, timestamptz, text, uuid) to authenticated;
grant execute on function finance_api.reverse_ledger_entry(uuid, text) to authenticated;
grant execute on function finance_api.transition_agreement(uuid, text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Prove it, in the same transaction
-- ─────────────────────────────────────────────────────────────────────────────

do $chk$
declare
  n integer;
begin
  -- The idempotency index exists and is partial.
  select count(*) into n from pg_indexes
   where schemaname = 'finance' and indexname = 'ledger_entries_idempotency_uq'
     and indexdef like '%WHERE%';
  if n <> 1 then raise exception 'idempotency index missing or not partial'; end if;

  -- finance_api invariants unchanged: all INVOKER, all pinned, anon nothing.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance_api' and p.prosecdef;
  if n <> 0 then raise exception '% finance_api function(s) are SECURITY DEFINER', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance_api'
     and not exists (select 1 from unnest(coalesce(p.proconfig,'{}')) c
                      where c like 'search\_path=%');
  if n <> 0 then raise exception '% finance_api function(s) have no pinned search_path', n; end if;

  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname = 'finance_api' and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if n <> 0 then raise exception 'anon or PUBLIC holds EXECUTE on % finance_api fn(s)', n; end if;

  -- The five founder actions must NOT be executable by service_role: founder
  -- actions run on the founder's session, and a machine path to them would make
  -- the attribution a fiction.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance_api'
     and p.proname in ('create_agreement_with_contribution','amend_contribution',
                       'record_external_payment','reverse_ledger_entry','transition_agreement')
     and has_function_privilege('service_role', p.oid, 'EXECUTE');
  if n <> 0 then raise exception 'service_role holds EXECUTE on % founder action(s)', n; end if;

  -- Append-only model unchanged: still no UPDATE/DELETE grants in finance.
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'finance'
     and grantee in ('anon','authenticated','service_role')
     and privilege_type in ('UPDATE','DELETE','TRUNCATE');
  if n <> 0 then raise exception 'append-only violated: % write grant(s)', n; end if;
end $chk$;
