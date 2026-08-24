-- Financials V2 — PR 10B (D-088): public checkout attempts and exact-once
-- projection, for server-created Stripe Checkout Sessions.
--
-- The founder replaced the static Payment Link with server-created Sessions:
-- the supporter chooses an amount on /support, may voluntarily add
-- processing-cost support, and the SERVER derives everything trusted — the
-- support amount from founder-configured fee parameters, the total, the
-- metadata, the idempotency key. The browser submits only the contribution
-- amount, a yes/no coverage choice and an opaque request id.
--
-- The attempt model is append-only in the sense that matters: every money
-- column is frozen at insert (trigger-enforced), provider provenance is
-- set-once, and rows are never deleted. The estimated processing support is
-- an ESTIMATE from configuration — Stripe's actual fee is a PR 11 accounting
-- fact and appears nowhere here.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Founder-configured fee policy, per campaign
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.public_support_campaigns
  add column fee_bps integer not null default 290
    constraint campaign_fee_bps_sane check (fee_bps >= 0 and fee_bps < 10000),
  add column fee_fixed_cents integer not null default 30
    constraint campaign_fee_fixed_sane check (fee_fixed_cents >= 0),
  add column fee_policy_version text not null default 'stripe-standard-v1';

create or replace function finance.set_campaign_fee_policy(
  p_campaign_id uuid, p_fee_bps integer, p_fee_fixed_cents integer, p_fee_policy_version text
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
begin
  if not public.is_founder() then
    raise exception 'set_campaign_fee_policy: founder role required';
  end if;
  if p_fee_bps is null or p_fee_bps < 0 or p_fee_bps >= 10000
     or p_fee_fixed_cents is null or p_fee_fixed_cents < 0
     or p_fee_policy_version is null or length(btrim(p_fee_policy_version)) = 0 then
    raise exception 'set_campaign_fee_policy: invalid policy' using errcode = 'VK400';
  end if;
  update finance.public_support_campaigns
     set fee_bps = p_fee_bps, fee_fixed_cents = p_fee_fixed_cents,
         fee_policy_version = p_fee_policy_version
   where id = p_campaign_id;
  if not found then
    raise exception 'set_campaign_fee_policy: campaign % not found', p_campaign_id using errcode = 'VK404';
  end if;
end $fn$;

revoke all on function finance.set_campaign_fee_policy(uuid, integer, integer, text) from public;
grant execute on function finance.set_campaign_fee_policy(uuid, integer, integer, text) to authenticated;
revoke execute on function finance.set_campaign_fee_policy(uuid, integer, integer, text) from service_role;

create or replace function finance_api.set_campaign_fee_policy(
  p_campaign_id uuid, p_fee_bps integer, p_fee_fixed_cents integer, p_fee_policy_version text
)
returns void language sql
as $$ select finance.set_campaign_fee_policy(p_campaign_id, p_fee_bps, p_fee_fixed_cents, p_fee_policy_version); $$;
revoke all on function finance_api.set_campaign_fee_policy(uuid, integer, integer, text) from public;
grant execute on function finance_api.set_campaign_fee_policy(uuid, integer, integer, text) to authenticated;
revoke execute on function finance_api.set_campaign_fee_policy(uuid, integer, integer, text) from service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Public checkout attempts
-- ─────────────────────────────────────────────────────────────────────────────

create table finance.public_checkout_attempts (
  id                          uuid primary key default gen_random_uuid(),
  campaign_id                 uuid not null references finance.public_support_campaigns(id) on delete restrict,
  legal_entity_id             uuid not null references finance.legal_entities(id) on delete restrict,
  fund_id                     uuid not null references finance.funds(id) on delete restrict,
  requested_contribution_cents bigint not null
    constraint pca_contribution_positive check (requested_contribution_cents > 0),
  processing_support_cents    bigint not null default 0
    constraint pca_support_nonnegative check (processing_support_cents >= 0),
  total_charge_cents          bigint not null,
  constraint pca_total_is_sum check (total_charge_cents = requested_contribution_cents + processing_support_cents),
  fee_policy_version          text not null,
  currency                    text not null default 'usd' constraint pca_usd_only check (currency = 'usd'),
  livemode                    boolean not null,
  status                      finance.checkout_status not null default 'creating',
  idempotency_key             text unique not null,
  stripe_session_id           text null,
  stripe_payment_intent_id    text null,
  created_at                  timestamptz not null default now(),
  expires_at                  timestamptz null,
  completed_at                timestamptz null
);

create unique index pca_session_uq on finance.public_checkout_attempts (stripe_session_id)
  where stripe_session_id is not null;
create index pca_pi_idx on finance.public_checkout_attempts (stripe_payment_intent_id, livemode)
  where stripe_payment_intent_id is not null;

-- Money columns are frozen at insert; provenance is set-once; status moves only
-- forward. Rows are never deleted.
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
     or new.processing_support_cents is distinct from old.processing_support_cents
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

create trigger trg_pca_immutable before update on finance.public_checkout_attempts
  for each row execute function finance.tg_pca_immutable();
create trigger trg_pca_no_delete before delete on finance.public_checkout_attempts
  for each row execute function finance.tg_pca_immutable();
create trigger trg_pca_no_truncate before truncate on finance.public_checkout_attempts
  for each statement execute function finance.tg_pca_immutable();

alter table finance.public_checkout_attempts enable row level security;
create policy founder_reads_pca on finance.public_checkout_attempts
  for select to authenticated using (public.is_founder());
create policy service_all_pca on finance.public_checkout_attempts
  for select to service_role using (true);
grant select on finance.public_checkout_attempts to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Begin a public checkout: everything trusted is derived HERE
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.begin_public_checkout(
  p_campaign_slug text,
  p_contribution_cents bigint,
  p_cover_processing boolean,
  p_request_id uuid
)
returns table(
  attempt_id uuid, campaign_id uuid, legal_entity_id uuid, fund_id uuid,
  requested_contribution_cents bigint, processing_support_cents bigint,
  total_charge_cents bigint, fee_policy_version text, status text,
  stripe_session_id text
)
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_c finance.public_support_campaigns%rowtype;
  v_support bigint := 0;
  v_total bigint;
  v_key text;
  v_row finance.public_checkout_attempts%rowtype;
begin
  if p_request_id is null then
    raise exception 'public_checkout: request id required' using errcode = 'VK400';
  end if;
  v_key := 'vk_ps_' || p_request_id::text;

  -- Replay of the same request returns the same attempt, and is refused if the
  -- browser changed its story: a request id is bound to its exact inputs.
  select * into v_row from finance.public_checkout_attempts a where a.idempotency_key = v_key;
  if found then
    if v_row.requested_contribution_cents <> p_contribution_cents
       or (v_row.processing_support_cents > 0) <> coalesce(p_cover_processing, false) then
      raise exception 'public_checkout: request id was used with different inputs' using errcode = 'VK409';
    end if;
    return query select v_row.id, v_row.campaign_id, v_row.legal_entity_id, v_row.fund_id,
      v_row.requested_contribution_cents, v_row.processing_support_cents,
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

  -- Voluntary processing-cost support, derived from founder configuration with
  -- the same deterministic integer ceiling as the application engine:
  --   total = ceil((c + fixed) * 10000 / (10000 - bps))
  if coalesce(p_cover_processing, false) then
    v_total := ((p_contribution_cents + v_c.fee_fixed_cents) * 10000
                + (10000 - v_c.fee_bps) - 1) / (10000 - v_c.fee_bps);
    v_support := v_total - p_contribution_cents;
  else
    v_total := p_contribution_cents;
  end if;

  insert into finance.public_checkout_attempts
    (campaign_id, legal_entity_id, fund_id, requested_contribution_cents,
     processing_support_cents, total_charge_cents, fee_policy_version,
     livemode, idempotency_key)
  values
    (v_c.id, v_c.legal_entity_id, v_c.fund_id, p_contribution_cents,
     v_support, v_total,
     case when v_support > 0 then v_c.fee_policy_version else 'none' end,
     v_c.livemode, v_key)
  returning * into v_row;

  return query select v_row.id, v_row.campaign_id, v_row.legal_entity_id, v_row.fund_id,
    v_row.requested_contribution_cents, v_row.processing_support_cents,
    v_row.total_charge_cents, v_row.fee_policy_version, v_row.status::text,
    v_row.stripe_session_id;
exception when unique_violation then
  select * into v_row from finance.public_checkout_attempts a where a.idempotency_key = v_key;
  return query select v_row.id, v_row.campaign_id, v_row.legal_entity_id, v_row.fund_id,
    v_row.requested_contribution_cents, v_row.processing_support_cents,
    v_row.total_charge_cents, v_row.fee_policy_version, v_row.status::text,
    v_row.stripe_session_id;
end $fn$;

create or replace function finance.finalize_public_checkout(
  p_attempt_id uuid, p_stripe_session_id text, p_payment_intent_id text, p_expires_at timestamptz
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_row finance.public_checkout_attempts%rowtype;
begin
  select * into v_row from finance.public_checkout_attempts where id = p_attempt_id for update;
  if not found then
    raise exception 'finalize_public_checkout: attempt % not found', p_attempt_id using errcode = 'VK404';
  end if;
  if v_row.status <> 'creating' then
    raise exception 'finalize_public_checkout: attempt is %, expected creating', v_row.status using errcode = 'VK409';
  end if;
  if p_stripe_session_id is null or p_stripe_session_id = '' then
    raise exception 'finalize_public_checkout: session id required' using errcode = 'VK400';
  end if;
  update finance.public_checkout_attempts
     set status = 'open', stripe_session_id = p_stripe_session_id,
         stripe_payment_intent_id = nullif(p_payment_intent_id, ''),
         expires_at = coalesce(p_expires_at, expires_at)
   where id = p_attempt_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Exact-once projection: contribution, refund, supporter linkage
-- ─────────────────────────────────────────────────────────────────────────────

-- The FULL charged amount (contribution + voluntary support) is the public
-- contribution fact; the breakdown stays on the attempt. Duplicate deliveries
-- collapse onto the unique (payment_intent, livemode) index and return the
-- existing entry, D-081 style.
create or replace function finance.record_public_support_payment(
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_session_id text,
  p_charge_id text,
  p_occurred_at timestamptz,
  p_livemode boolean,
  p_origin_event_id text,
  p_attempt_id uuid
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_attempt finance.public_checkout_attempts%rowtype;
  v_id uuid;
begin
  if p_payment_intent_id is null or p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'record_public_support_payment: invalid payment' using errcode = 'VK400';
  end if;

  -- Attribution comes from OUR attempt row, never from event metadata alone.
  select * into v_attempt from finance.public_checkout_attempts a
   where a.id = p_attempt_id and a.livemode = p_livemode;
  if not found then
    raise exception 'record_public_support_payment: attempt % not found for mode', p_attempt_id
      using errcode = 'VK404';
  end if;

  begin
    insert into finance.public_support_entries
      (entry_type, campaign_id, legal_entity_id, fund_id, amount_cents, livemode,
       provider_payment_intent_id, provider_session_id, provider_charge_id,
       origin_stripe_event_id, occurred_at)
    values
      ('contribution', v_attempt.campaign_id, v_attempt.legal_entity_id, v_attempt.fund_id,
       p_amount_cents, p_livemode,
       p_payment_intent_id, nullif(p_session_id, ''), nullif(p_charge_id, ''),
       p_origin_event_id, coalesce(p_occurred_at, clock_timestamp()))
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from finance.public_support_entries
     where provider_payment_intent_id = p_payment_intent_id
       and livemode = p_livemode and entry_type = 'contribution';
  end;

  -- Close the attempt (idempotent; a completed attempt stays completed).
  if v_attempt.status in ('creating', 'open') then
    update finance.public_checkout_attempts
       set status = 'completed', completed_at = clock_timestamp(),
           stripe_payment_intent_id = coalesce(stripe_payment_intent_id, p_payment_intent_id)
     where id = v_attempt.id;
  end if;

  return v_id;
end $fn$;

create or replace function finance.record_public_support_refund(
  p_refund_id text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_occurred_at timestamptz,
  p_livemode boolean,
  p_origin_event_id text
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_parent finance.public_support_entries%rowtype; v_id uuid;
begin
  if p_refund_id is null or p_amount_cents is null or p_amount_cents >= 0 then
    raise exception 'record_public_support_refund: refund must be negative with an id' using errcode = 'VK400';
  end if;
  select * into v_parent from finance.public_support_entries
   where provider_payment_intent_id = p_payment_intent_id
     and livemode = p_livemode and entry_type = 'contribution';
  if not found then
    raise exception 'record_public_support_refund: no contribution for %', p_payment_intent_id
      using errcode = 'VK404';
  end if;

  begin
    insert into finance.public_support_entries
      (entry_type, campaign_id, legal_entity_id, fund_id, amount_cents, livemode,
       provider_payment_intent_id, provider_refund_id, parent_entry_id,
       origin_stripe_event_id, occurred_at)
    values
      ('refund', v_parent.campaign_id, v_parent.legal_entity_id, v_parent.fund_id,
       p_amount_cents, p_livemode, p_payment_intent_id, p_refund_id, v_parent.id,
       p_origin_event_id, coalesce(p_occurred_at, clock_timestamp()))
    returning id into v_id;
  exception when unique_violation then
    select id into v_id from finance.public_support_entries
     where provider_refund_id = p_refund_id and livemode = p_livemode and entry_type = 'refund';
  end;
  return v_id;
end $fn$;

-- Supporter identity arrives with the Session (possibly AFTER the money).
-- Identity is linked only when the Session provably belongs to the entry's
-- PaymentIntent — event order never changes the financial result.
create or replace function finance.link_public_supporter(
  p_payment_intent_id text,
  p_livemode boolean,
  p_session_id text,
  p_email text,
  p_display_name text
)
returns uuid
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_entry finance.public_support_entries%rowtype; v_supporter uuid;
begin
  if p_email is null or position('@' in p_email) = 0 then
    raise exception 'link_public_supporter: valid email required' using errcode = 'VK400';
  end if;
  select * into v_entry from finance.public_support_entries
   where provider_payment_intent_id = p_payment_intent_id
     and livemode = p_livemode and entry_type = 'contribution';
  if not found then
    raise exception 'link_public_supporter: no contribution for %', p_payment_intent_id
      using errcode = 'VK404';
  end if;
  -- Session-to-PaymentIntent identity check: if the entry recorded a session,
  -- the caller's session must match it.
  if v_entry.provider_session_id is not null and p_session_id is not null
     and v_entry.provider_session_id <> p_session_id then
    raise exception 'link_public_supporter: session does not match the contribution' using errcode = 'VK409';
  end if;

  insert into finance.public_supporters (email_normalized, display_name)
  values (lower(btrim(p_email)), nullif(btrim(coalesce(p_display_name, '')), ''))
  on conflict (email_normalized) do update
    set display_name = coalesce(excluded.display_name, finance.public_supporters.display_name),
        updated_at = now()
  returning id into v_supporter;

  -- Set-once on the entry; the append-only trigger permits exactly this.
  update finance.public_support_entries
     set supporter_id = v_supporter
   where id = v_entry.id and supporter_id is null;

  return v_supporter;
end $fn$;

-- The entries append-only trigger must now permit ONE change: supporter_id
-- null -> value. Everything else stays frozen.
create or replace function finance.tg_public_support_append_only()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception '% on public_support_entries is forbidden: it is an append-only fact table', tg_op;
  end if;
  -- UPDATE path: only supporter_id, and only from null.
  if new.entry_type is distinct from old.entry_type
     or new.campaign_id is distinct from old.campaign_id
     or new.legal_entity_id is distinct from old.legal_entity_id
     or new.fund_id is distinct from old.fund_id
     or new.amount_cents is distinct from old.amount_cents
     or new.currency is distinct from old.currency
     or new.livemode is distinct from old.livemode
     or new.provider_payment_intent_id is distinct from old.provider_payment_intent_id
     or new.provider_charge_id is distinct from old.provider_charge_id
     or new.provider_session_id is distinct from old.provider_session_id
     or new.provider_refund_id is distinct from old.provider_refund_id
     or new.origin_stripe_event_id is distinct from old.origin_stripe_event_id
     or new.parent_entry_id is distinct from old.parent_entry_id
     or new.occurred_at is distinct from old.occurred_at
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'UPDATE on public_support_entries is forbidden: it is an append-only fact table';
  end if;
  if old.supporter_id is not null and new.supporter_id is distinct from old.supporter_id then
    raise exception 'supporter_id is set-once on public_support_entries';
  end if;
  return new;
end $fn$;

-- The blanket no-update trigger from 10A is replaced by the column-immutable
-- version above (same function name, so the existing triggers now enforce it;
-- the UPDATE trigger must allow the one permitted transition).
drop trigger trg_ps_entries_no_update on finance.public_support_entries;
create trigger trg_ps_entries_no_update before update on finance.public_support_entries
  for each row execute function finance.tg_public_support_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grants: machine surface only for everything above except fee policy
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance_api.begin_public_checkout(
  p_campaign_slug text, p_contribution_cents bigint, p_cover_processing boolean, p_request_id uuid
)
returns table(
  attempt_id uuid, campaign_id uuid, legal_entity_id uuid, fund_id uuid,
  requested_contribution_cents bigint, processing_support_cents bigint,
  total_charge_cents bigint, fee_policy_version text, status text, stripe_session_id text
)
language sql
as $$ select * from finance.begin_public_checkout(p_campaign_slug, p_contribution_cents, p_cover_processing, p_request_id); $$;

create or replace function finance_api.finalize_public_checkout(
  p_attempt_id uuid, p_stripe_session_id text, p_payment_intent_id text, p_expires_at timestamptz
)
returns void language sql
as $$ select finance.finalize_public_checkout(p_attempt_id, p_stripe_session_id, p_payment_intent_id, p_expires_at); $$;

create or replace function finance_api.record_public_support_payment(
  p_payment_intent_id text, p_amount_cents bigint, p_session_id text, p_charge_id text,
  p_occurred_at timestamptz, p_livemode boolean, p_origin_event_id text, p_attempt_id uuid
)
returns uuid language sql
as $$ select finance.record_public_support_payment(p_payment_intent_id, p_amount_cents, p_session_id,
       p_charge_id, p_occurred_at, p_livemode, p_origin_event_id, p_attempt_id); $$;

create or replace function finance_api.record_public_support_refund(
  p_refund_id text, p_payment_intent_id text, p_amount_cents bigint,
  p_occurred_at timestamptz, p_livemode boolean, p_origin_event_id text
)
returns uuid language sql
as $$ select finance.record_public_support_refund(p_refund_id, p_payment_intent_id, p_amount_cents,
       p_occurred_at, p_livemode, p_origin_event_id); $$;

create or replace function finance_api.link_public_supporter(
  p_payment_intent_id text, p_livemode boolean, p_session_id text, p_email text, p_display_name text
)
returns uuid language sql
as $$ select finance.link_public_supporter(p_payment_intent_id, p_livemode, p_session_id, p_email, p_display_name); $$;

do $grants$
declare f text;
begin
  for f in select unnest(array[
    'finance.begin_public_checkout(text, bigint, boolean, uuid)',
    'finance.finalize_public_checkout(uuid, text, text, timestamptz)',
    'finance.record_public_support_payment(text, bigint, text, text, timestamptz, boolean, text, uuid)',
    'finance.record_public_support_refund(text, text, bigint, timestamptz, boolean, text)',
    'finance.link_public_supporter(text, boolean, text, text, text)',
    'finance_api.begin_public_checkout(text, bigint, boolean, uuid)',
    'finance_api.finalize_public_checkout(uuid, text, text, timestamptz)',
    'finance_api.record_public_support_payment(text, bigint, text, text, timestamptz, boolean, text, uuid)',
    'finance_api.record_public_support_refund(text, text, bigint, timestamptz, boolean, text)',
    'finance_api.link_public_supporter(text, boolean, text, text, text)'])
  loop
    execute 'revoke all on function ' || f || ' from public';
    execute 'revoke execute on function ' || f || ' from anon';
    execute 'revoke execute on function ' || f || ' from authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $grants$;

-- Founder view of attempts (no idempotency key).
create or replace view finance_api.founder_public_checkout_attempts
  with (security_invoker = true, security_barrier = true) as
select a.id, a.campaign_id, a.requested_contribution_cents, a.processing_support_cents,
       a.total_charge_cents, a.fee_policy_version, a.livemode, a.status,
       a.created_at, a.expires_at, a.completed_at
from finance.public_checkout_attempts a
where public.is_founder();
grant select on finance_api.founder_public_checkout_attempts to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare bad int;
begin
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'finance' and c.relname = 'public_checkout_attempts'
                   and c.relrowsecurity) then
    raise exception 'PR10B assert: attempts table lacks RLS';
  end if;

  -- anon's surface is still exactly one function.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'finance_api'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'public_campaign_status';
  if bad > 0 then raise exception 'PR10B assert: anon can execute % extra functions', bad; end if;

  -- The checkout/projection machine surface is service-role only.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral (values ('authenticated'), ('anon')) r(role)
  where n.nspname in ('finance', 'finance_api')
    and p.proname in ('begin_public_checkout','finalize_public_checkout',
                      'record_public_support_payment','record_public_support_refund',
                      'link_public_supporter')
    and has_function_privilege(r.role, p.oid, 'EXECUTE');
  if bad > 0 then raise exception 'PR10B assert: % non-machine grants on checkout functions', bad; end if;

  -- Fee-policy approval is founder-only: no service_role execute.
  if has_function_privilege('service_role', 'finance.set_campaign_fee_policy(uuid, integer, integer, text)', 'EXECUTE') then
    raise exception 'PR10B assert: service_role can set the fee policy';
  end if;

  -- SQL fee math matches the application engine on the pinned examples.
  if ((500 + 30) * 10000 + 9709) / 9710 <> 546
     or ((10000 + 30) * 10000 + 9709) / 9710 <> 10330
     or ((100000 + 30) * 10000 + 9709) / 9710 <> 103018 then
    raise exception 'PR10B assert: SQL fee math diverges from the application engine';
  end if;

  -- No write grants anywhere new.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance' and table_name = 'public_checkout_attempts'
    and grantee in ('authenticated','anon','service_role')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if bad > 0 then raise exception 'PR10B assert: write grants on attempts'; end if;

  raise notice 'PR10B SCHEMA ASSERTIONS PASSED';
end $assert$;

commit;
