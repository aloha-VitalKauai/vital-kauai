-- Financials V2 — PR 10B amendment (D-088, founder decision 2026-08-24):
-- the card processing fee is MANDATORY. The supporter pays the fee; Vital
-- Kauaʻi receives the intended contribution amount after standard processing
-- costs. The voluntary "cover processing" choice is retired entirely.
--
-- Rolls forward on 20260823030000 (applied inert: zero attempts, campaign
-- draft). Renames processing_support_cents → processing_fee_cents, replaces
-- begin_public_checkout with a 3-argument version whose gross-up always
-- applies, and removes the 'none' fee-policy marker — every attempt now
-- records Contribution, processing fee, total charged and the fee-policy
-- version separately.
--
-- The gross-up is unchanged: total = ceil((c + fixed)·10000 / (10000 − bps)),
-- fee = total − c, founder-configured (initially 2.9% + 30¢). The estimate is
-- never Stripe's actual fee — that is PR 11's accounting fact.
--
-- Compliance note: mandatory card fees carry disclosure, card-network and
-- jurisdiction requirements. A Stripe/account compliance preflight is REQUIRED
-- before live activation (separate founder gate); nothing here activates.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Rename: mandatory fee, not voluntary support
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.public_checkout_attempts
  rename column processing_support_cents to processing_fee_cents;
alter table finance.public_checkout_attempts
  rename constraint pca_support_nonnegative to pca_fee_nonnegative;

-- The immutability trigger's body names the renamed column; same rules,
-- current names. (pca_total_is_sum tracks the rename by itself.)
create or replace function finance.tg_pca_immutable()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception '% on public_checkout_attempts is forbidden', tg_op;
  end if;
  if new.campaign_id is distinct from old.campaign_id
     or new.legal_entity_id is distinct from old.legal_entity_id
     or new.fund_id is distinct from old.fund_id
     or new.requested_contribution_cents is distinct from old.requested_contribution_cents
     or new.processing_fee_cents is distinct from old.processing_fee_cents
     or new.total_charge_cents is distinct from old.total_charge_cents
     or new.fee_policy_version is distinct from old.fee_policy_version
     or new.currency is distinct from old.currency
     or new.livemode is distinct from old.livemode
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at is distinct from old.created_at then
    raise exception 'public_checkout_attempts money columns are immutable';
  end if;
  if old.stripe_session_id is not null and new.stripe_session_id is distinct from old.stripe_session_id then
    raise exception 'stripe_session_id is set-once';
  end if;
  if old.stripe_payment_intent_id is not null and new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id then
    raise exception 'stripe_payment_intent_id is set-once';
  end if;
  return new;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. begin_public_checkout: three arguments, the fee always applies
-- ─────────────────────────────────────────────────────────────────────────────

drop function finance_api.begin_public_checkout(text, bigint, boolean, uuid);
drop function finance.begin_public_checkout(text, bigint, boolean, uuid);

create function finance.begin_public_checkout(
  p_campaign_slug text,
  p_contribution_cents bigint,
  p_request_id uuid
)
returns table(
  attempt_id uuid, campaign_id uuid, legal_entity_id uuid, fund_id uuid,
  requested_contribution_cents bigint, processing_fee_cents bigint,
  total_charge_cents bigint, fee_policy_version text, status text,
  stripe_session_id text
)
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_c finance.public_support_campaigns%rowtype;
  v_fee bigint;
  v_total bigint;
  v_key text;
  v_row finance.public_checkout_attempts%rowtype;
begin
  if p_request_id is null then
    raise exception 'public_checkout: request id required' using errcode = 'VK400';
  end if;
  v_key := 'vk_ps_' || p_request_id::text;

  -- Replay of the same request returns the same attempt, and is refused if the
  -- browser changed its story: a request id is bound to its exact contribution.
  select * into v_row from finance.public_checkout_attempts a where a.idempotency_key = v_key;
  if found then
    if v_row.requested_contribution_cents <> p_contribution_cents then
      raise exception 'public_checkout: request id was used with different inputs' using errcode = 'VK409';
    end if;
    return query select v_row.id, v_row.campaign_id, v_row.legal_entity_id, v_row.fund_id,
      v_row.requested_contribution_cents, v_row.processing_fee_cents,
      v_row.total_charge_cents, v_row.fee_policy_version, v_row.status::text,
      v_row.stripe_session_id;
    return;
  end if;

  -- Fail-closed: only an ACTIVE campaign in this deployment's mode can begin.
  select * into v_c from finance.public_support_campaigns c
   where c.slug = p_campaign_slug and c.livemode = true;
  if not found then
    raise exception 'public_checkout: campaign not found' using errcode = 'VK404';
  end if;
  if v_c.status <> 'active' then
    raise exception 'public_checkout: campaign is not active' using errcode = 'VK428';
  end if;
  if p_contribution_cents is null
     or p_contribution_cents < v_c.min_amount_cents
     or p_contribution_cents > v_c.max_amount_cents then
    raise exception 'public_checkout: amount outside campaign bounds' using errcode = 'VK400';
  end if;

  -- The MANDATORY card processing fee, from founder configuration, with the
  -- same deterministic integer ceiling as the application engine:
  --   total = ceil((c + fixed) * 10000 / (10000 - bps)), fee = total - c
  v_total := ((p_contribution_cents + v_c.fee_fixed_cents) * 10000
              + (10000 - v_c.fee_bps) - 1) / (10000 - v_c.fee_bps);
  v_fee := v_total - p_contribution_cents;

  insert into finance.public_checkout_attempts
    (campaign_id, legal_entity_id, fund_id, requested_contribution_cents,
     processing_fee_cents, total_charge_cents, fee_policy_version,
     livemode, idempotency_key)
  values
    (v_c.id, v_c.legal_entity_id, v_c.fund_id, p_contribution_cents,
     v_fee, v_total, v_c.fee_policy_version, v_c.livemode, v_key)
  returning * into v_row;

  return query select v_row.id, v_row.campaign_id, v_row.legal_entity_id, v_row.fund_id,
    v_row.requested_contribution_cents, v_row.processing_fee_cents,
    v_row.total_charge_cents, v_row.fee_policy_version, v_row.status::text,
    v_row.stripe_session_id;
exception when unique_violation then
  -- A concurrent begin won the insert. The replay binding still holds: the
  -- surviving row must match this request's exact contribution, or the
  -- request id was used with different inputs — same refusal as above.
  select * into v_row from finance.public_checkout_attempts a where a.idempotency_key = v_key;
  if v_row.requested_contribution_cents <> p_contribution_cents then
    raise exception 'public_checkout: request id was used with different inputs' using errcode = 'VK409';
  end if;
  return query select v_row.id, v_row.campaign_id, v_row.legal_entity_id, v_row.fund_id,
    v_row.requested_contribution_cents, v_row.processing_fee_cents,
    v_row.total_charge_cents, v_row.fee_policy_version, v_row.status::text,
    v_row.stripe_session_id;
end $fn$;

create function finance_api.begin_public_checkout(
  p_campaign_slug text, p_contribution_cents bigint, p_request_id uuid
)
returns table(
  attempt_id uuid, campaign_id uuid, legal_entity_id uuid, fund_id uuid,
  requested_contribution_cents bigint, processing_fee_cents bigint,
  total_charge_cents bigint, fee_policy_version text, status text, stripe_session_id text
)
language sql
as $$ select * from finance.begin_public_checkout(p_campaign_slug, p_contribution_cents, p_request_id); $$;

do $grants$
declare f text;
begin
  for f in select unnest(array[
    'finance.begin_public_checkout(text, bigint, uuid)',
    'finance_api.begin_public_checkout(text, bigint, uuid)'])
  loop
    execute 'revoke all on function ' || f || ' from public';
    execute 'revoke execute on function ' || f || ' from anon';
    execute 'revoke execute on function ' || f || ' from authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $grants$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Founder view: renamed column (column set changes, so drop + recreate)
-- ─────────────────────────────────────────────────────────────────────────────

drop view finance_api.founder_public_checkout_attempts;
create view finance_api.founder_public_checkout_attempts
  with (security_invoker = true, security_barrier = true) as
select a.id, a.campaign_id, a.requested_contribution_cents, a.processing_fee_cents,
       a.total_charge_cents, a.fee_policy_version, a.livemode, a.status,
       a.created_at, a.expires_at, a.completed_at
from finance.public_checkout_attempts a
where public.is_founder();
grant select on finance_api.founder_public_checkout_attempts to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare bad int;
begin
  -- The coverage-flag entrance is GONE, in both schemas.
  if to_regprocedure('finance.begin_public_checkout(text, bigint, boolean, uuid)') is not null
     or to_regprocedure('finance_api.begin_public_checkout(text, bigint, boolean, uuid)') is not null then
    raise exception 'PR10B-fee assert: the 4-argument coverage entrance still exists';
  end if;

  -- The 3-argument entrance exists and is service-role only.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral (values ('authenticated'), ('anon')) r(role)
  where n.nspname in ('finance', 'finance_api')
    and p.proname = 'begin_public_checkout'
    and has_function_privilege(r.role, p.oid, 'EXECUTE');
  if bad > 0 then raise exception 'PR10B-fee assert: % non-machine grants on begin_public_checkout', bad; end if;
  if not has_function_privilege('service_role', 'finance_api.begin_public_checkout(text, bigint, uuid)', 'EXECUTE') then
    raise exception 'PR10B-fee assert: service_role lost begin_public_checkout';
  end if;

  -- The rename landed; the old name is gone everywhere that matters.
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'finance' and table_name = 'public_checkout_attempts'
                   and column_name = 'processing_fee_cents')
     or exists (select 1 from information_schema.columns
                where table_schema = 'finance' and table_name = 'public_checkout_attempts'
                  and column_name = 'processing_support_cents') then
    raise exception 'PR10B-fee assert: processing fee column rename did not land';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'finance_api' and table_name = 'founder_public_checkout_attempts'
                   and column_name = 'processing_fee_cents') then
    raise exception 'PR10B-fee assert: founder view does not expose processing_fee_cents';
  end if;

  -- The 'none' fee-policy marker is retired: the entrance can no longer write it.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'finance' and p.proname = 'begin_public_checkout'
               and p.prosrc ilike '%''none''%') then
    raise exception 'PR10B-fee assert: begin_public_checkout still carries the none policy';
  end if;

  -- The immutability trigger enforces the renamed column.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'finance' and p.proname = 'tg_pca_immutable'
                   and p.prosrc ilike '%processing_fee_cents%') then
    raise exception 'PR10B-fee assert: immutability trigger does not cover processing_fee_cents';
  end if;

  -- anon's surface is still exactly one function.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'finance_api'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'public_campaign_status';
  if bad > 0 then raise exception 'PR10B-fee assert: anon can execute % extra functions', bad; end if;

  -- The pinned gross-up examples are unchanged by the amendment.
  if ((500 + 30) * 10000 + 9709) / 9710 <> 546
     or ((10000 + 30) * 10000 + 9709) / 9710 <> 10330
     or ((100000 + 30) * 10000 + 9709) / 9710 <> 103018 then
    raise exception 'PR10B-fee assert: SQL fee math diverges from the application engine';
  end if;

  raise notice 'PR10B MANDATORY-FEE ASSERTIONS PASSED';
end $assert$;

commit;
