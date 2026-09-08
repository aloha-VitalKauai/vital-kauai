-- Financials V2 — PR 10E (D-092): the card processing fee on founder-issued
-- contribution links.
--
-- A founder-issued link charges the member the agreement figure PLUS a
-- server-derived card processing fee, so Vital Kauaʻi nets the intended
-- contribution. The fee is never contribution: ledger_entries.amount_cents
-- keeps its exact present meaning (the contribution portion, the only figure
-- any balance formula sums) and the fee rides beside it in a first-class
-- column. v_agreement_balances and f_balances are NOT touched — their
-- definitions must be byte-identical before and after this file.
--
-- One formula. The gross-up that public support already uses is extracted
-- into finance.quote_processing_fee (IMMUTABLE, integer arithmetic only) and
-- begin_public_checkout is rewired to call it — same output for every input.
-- Nothing else computes a fee: the link snapshots the policy inputs at
-- issuance (F), begin_checkout_attempt derives the total from that snapshot
-- under the agreement lock (H), and record_v2_stripe_payment splits the
-- provider gross from OUR attempt row, never from the event (J).
--
-- Rollout switch in the database: finance.fee_settings.fee_enabled, seeded
-- FALSE. With it off, every path is byte-for-byte today's behaviour — the
-- link's snapshot columns are NULL, NULL means no fee, and every existing
-- link keeps the figure it was issued with (G, founder decision 2026-09-08).
--
-- Additive only. Every ALTER TABLE adds nullable or defaulted columns with
-- non-volatile defaults: no table rewrite, no row touched, no backfill. Every
-- recreated function drops its old signature in the same file (the D-090
-- one-overload rule) and restates its grants after REVOKE ALL FROM public.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Configuration: one row, founder-written, never a financial fact
-- ─────────────────────────────────────────────────────────────────────────────

create table finance.fee_settings (
  id                 boolean primary key default true
                       constraint fee_settings_singleton check (id),
  fee_enabled        boolean not null default false,
  fee_bps            integer not null default 290
                       constraint fee_settings_bps_sane check (fee_bps >= 0 and fee_bps < 10000),
  fee_fixed_cents    integer not null default 30
                       constraint fee_settings_fixed_sane check (fee_fixed_cents >= 0),
  fee_policy_version text not null default 'stripe-standard-v1'
                       constraint fee_settings_policy_version_nonblank
                         check (length(btrim(fee_policy_version)) > 0),
  updated_at         timestamptz not null default now(),
  updated_by         uuid null references auth.users(id) on delete restrict
);

insert into finance.fee_settings (id, fee_enabled, fee_bps, fee_fixed_cents, fee_policy_version)
values (true, false, 290, 30, 'stripe-standard-v1');

alter table finance.fee_settings enable row level security;
alter table finance.fee_settings force  row level security;

-- Config, not truth: readable by the founder and the machine, written only
-- through finance.set_fee_settings below. No application role may write it.
revoke all on finance.fee_settings from public, anon, authenticated, service_role;
grant select on finance.fee_settings to authenticated, service_role;
create policy founder_reads_fee_settings on finance.fee_settings
  for select to authenticated using (public.is_founder());
create policy service_all_fee_settings on finance.fee_settings
  for select to service_role using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. The one fee formula, and the founder-only setter
-- ─────────────────────────────────────────────────────────────────────────────

-- total = ceil((c + fixed) * 10000 / (10000 - bps)), integer arithmetic only,
-- expressed here exactly once in SQL. The TypeScript twin in
-- lib/finance/public-support-fees.ts is display-only and is pinned equal to
-- this function by supabase/tests/fixtures/fee_vectors.json.
create function finance.quote_processing_fee(
  p_contribution_cents bigint, p_fee_bps integer, p_fee_fixed_cents integer
) returns bigint
language plpgsql immutable
as $fn$
begin
  if p_contribution_cents is null or p_contribution_cents <= 0 then
    raise exception 'quote_processing_fee: contribution must be positive' using errcode='VK400';
  end if;
  if p_fee_bps is null or p_fee_bps < 0 or p_fee_bps >= 10000 then
    raise exception 'quote_processing_fee: fee bps % out of range', p_fee_bps using errcode='VK400';
  end if;
  if p_fee_fixed_cents is null or p_fee_fixed_cents < 0 then
    raise exception 'quote_processing_fee: fixed fee % out of range', p_fee_fixed_cents using errcode='VK400';
  end if;
  return ((p_contribution_cents + p_fee_fixed_cents) * 10000
          + (10000 - p_fee_bps) - 1) / (10000 - p_fee_bps);
end $fn$;

create function finance.set_fee_settings(
  p_fee_enabled boolean, p_fee_bps integer, p_fee_fixed_cents integer, p_fee_policy_version text
) returns table (
  fee_enabled boolean, fee_bps integer, fee_fixed_cents integer,
  fee_policy_version text, updated_at timestamptz
)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare v_row finance.fee_settings%rowtype;
begin
  if not public.is_founder() then
    raise exception 'set_fee_settings: founder role required';
  end if;
  if p_fee_enabled is null then
    raise exception 'set_fee_settings: fee_enabled is required' using errcode='VK400';
  end if;
  if p_fee_bps is null or p_fee_bps < 0 or p_fee_bps >= 10000 then
    raise exception 'set_fee_settings: fee bps % out of range', p_fee_bps using errcode='VK400';
  end if;
  if p_fee_fixed_cents is null or p_fee_fixed_cents < 0 then
    raise exception 'set_fee_settings: fixed fee % out of range', p_fee_fixed_cents using errcode='VK400';
  end if;
  if p_fee_policy_version is null or length(btrim(p_fee_policy_version)) = 0 then
    raise exception 'set_fee_settings: a non-blank policy version is required' using errcode='VK400';
  end if;
  update finance.fee_settings s
     set fee_enabled = p_fee_enabled, fee_bps = p_fee_bps, fee_fixed_cents = p_fee_fixed_cents,
         fee_policy_version = btrim(p_fee_policy_version),
         updated_at = clock_timestamp(), updated_by = auth.uid()
   where s.id = true
  returning s.* into v_row;
  if not found then
    raise exception 'set_fee_settings: the fee_settings row is missing';
  end if;
  return query select v_row.fee_enabled, v_row.fee_bps, v_row.fee_fixed_cents,
                      v_row.fee_policy_version, v_row.updated_at;
end $fn$;

create function finance_api.set_fee_settings(
  p_fee_enabled boolean, p_fee_bps integer, p_fee_fixed_cents integer, p_fee_policy_version text
) returns table (
  fee_enabled boolean, fee_bps integer, fee_fixed_cents integer,
  fee_policy_version text, updated_at timestamptz
) language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.set_fee_settings(p_fee_enabled, p_fee_bps, p_fee_fixed_cents, p_fee_policy_version); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. begin_public_checkout: identical body, the two inline arithmetic lines
--    now call quote_processing_fee. No behaviour change (proven by vector).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.begin_public_checkout(
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

  -- The MANDATORY card processing fee, from founder configuration, through the
  -- one fee formula (D-092): total = ceil((c + fixed) * 10000 / (10000 - bps)),
  -- fee = total - c.
  v_total := finance.quote_processing_fee(p_contribution_cents, v_c.fee_bps, v_c.fee_fixed_cents);
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. The link carries the policy it was issued under (F). All three or none.
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.payment_links
  add column fee_bps integer null,
  add column fee_fixed_cents integer null,
  add column fee_policy_version text null,
  add constraint payment_links_fee_snapshot_all_or_none check (
    (fee_bps is null and fee_fixed_cents is null and fee_policy_version is null)
    or (fee_bps is not null and fee_fixed_cents is not null and fee_policy_version is not null)),
  add constraint payment_links_fee_bps_sane check (fee_bps is null or (fee_bps >= 0 and fee_bps < 10000)),
  add constraint payment_links_fee_fixed_sane check (fee_fixed_cents is null or fee_fixed_cents >= 0),
  add constraint payment_links_fee_policy_version_nonblank
    check (fee_policy_version is null or length(btrim(fee_policy_version)) > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. The Session states its composition (I). amount_cents stays what is sent
--    to Stripe and is now the total; contribution + fee = amount by CHECK.
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.checkout_sessions
  add column contribution_cents bigint null
    constraint checkout_sessions_contribution_positive
      check (contribution_cents is null or contribution_cents > 0),
  add column processing_fee_cents bigint not null default 0
    constraint checkout_sessions_fee_nonnegative check (processing_fee_cents >= 0),
  add column fee_policy_version text null,
  add constraint checkout_sessions_total_is_sum
    check (coalesce(contribution_cents, amount_cents) + processing_fee_cents = amount_cents),
  add constraint checkout_sessions_fee_requires_policy
    check (processing_fee_cents = 0 or fee_policy_version is not null);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. The ledger carries the fee beside the contribution (A). amount_cents keeps
--    its meaning; a fee may exist only on a Stripe-confirmed stripe_payment.
--    Non-volatile default: no rewrite, no row touched — DDL, not an UPDATE.
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.ledger_entries
  add column processing_fee_cents bigint not null default 0
    constraint ledger_fee_nonnegative check (processing_fee_cents >= 0),
  add constraint ledger_fee_only_on_stripe_payment
    check (processing_fee_cents = 0 or (entry_type = 'stripe_payment' and source = 'stripe'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. issue_payment_link: D-090 body verbatim, plus the policy snapshot (E, F).
--    Return type grows, so drop and create; one defaulted overload per schema.
-- ─────────────────────────────────────────────────────────────────────────────

drop function finance_api.issue_payment_link(uuid, text, text, bigint);
drop function finance.issue_payment_link(uuid, text, text, bigint);

create function finance.issue_payment_link(
  p_agreement_id uuid, p_token_hash text, p_reason text, p_amount_cents bigint default null
) returns table (
  link_id uuid, amount_cents bigint, expires_at timestamptz,
  processing_fee_cents bigint, total_cents bigint
)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare
  v_bal finance.v_agreement_balances%rowtype;
  v_status finance.agreement_lifecycle;
  v_fee finance.fee_settings%rowtype;
  v_id uuid; v_exp timestamptz;
  v_amount bigint; v_total bigint;
begin
  if not public.is_founder() then
    raise exception 'issue_payment_link: founder role required';
  end if;
  if p_token_hash is null or length(p_token_hash) < 43 then
    raise exception 'issue_payment_link: token hash malformed' using errcode='VK400';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'issue_payment_link: a non-blank reason is required' using errcode='VK400';
  end if;
  perform 1 from finance.agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'issue_payment_link: agreement % does not exist', p_agreement_id using errcode='VK404';
  end if;
  select e.to_status into v_status from finance.agreement_lifecycle_events e
   where e.agreement_id = p_agreement_id order by e.occurred_at desc, e.seq desc limit 1;
  if v_status <> 'active' then
    raise exception 'issue_payment_link: agreement is %, only an active agreement can collect', v_status
      using errcode='VK409';
  end if;
  -- The CANONICAL cap, computed here from the live view at creation time. A
  -- chosen amount is bounded by it (D-090); an omitted amount IS it.
  select * into v_bal from finance.v_agreement_balances b where b.agreement_id = p_agreement_id;
  if v_bal.payable_remaining_cents is null or v_bal.payable_remaining_cents <= 0 then
    raise exception 'issue_payment_link: nothing remains to collect' using errcode='VK409';
  end if;
  if p_amount_cents is not null and p_amount_cents <= 0 then
    raise exception 'issue_payment_link: amount must be a positive number of cents' using errcode='VK400';
  end if;
  if p_amount_cents > v_bal.payable_remaining_cents then
    raise exception 'issue_payment_link: amount % exceeds payable remaining %',
      p_amount_cents, v_bal.payable_remaining_cents using errcode='VK409';
  end if;
  if exists (select 1 from finance.payment_links l
              where l.agreement_id = p_agreement_id and l.status in ('active','creating')
                and l.expires_at > clock_timestamp()) then
    raise exception 'issue_payment_link: a live link already exists; revoke it first' using errcode='VK409';
  end if;
  -- D-092 (E, F): the policy in force is read now and snapshotted onto the
  -- link. fee_enabled = false writes NULLs, and NULL means no fee everywhere
  -- downstream — byte-for-byte today's behaviour. A missing settings row is a
  -- refusal, never a silent zero.
  select * into v_fee from finance.fee_settings s where s.id = true;
  if not found then
    raise exception 'issue_payment_link: fee settings are missing';
  end if;
  v_amount := coalesce(p_amount_cents, v_bal.payable_remaining_cents);
  if v_fee.fee_enabled then
    v_total := finance.quote_processing_fee(v_amount, v_fee.fee_bps, v_fee.fee_fixed_cents);
  else
    v_total := v_amount;
  end if;
  v_exp := clock_timestamp() + interval '7 days';
  insert into finance.payment_links
    (agreement_id, token_hash, status, expires_at, created_by, reason, amount_cents,
     fee_bps, fee_fixed_cents, fee_policy_version)
  values
    (p_agreement_id, p_token_hash, 'active', v_exp, auth.uid(), p_reason, p_amount_cents,
     case when v_fee.fee_enabled then v_fee.fee_bps end,
     case when v_fee.fee_enabled then v_fee.fee_fixed_cents end,
     case when v_fee.fee_enabled then v_fee.fee_policy_version end)
  returning id into v_id;
  return query select v_id, v_amount, v_exp, v_total - v_amount, v_total;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. begin_checkout_attempt: D-090 body verbatim (lock, live-view read, the
--    three VK409 rules on the CONTRIBUTION), then the fee derived under that
--    same lock from the link's own snapshot (H). Return type grows.
-- ─────────────────────────────────────────────────────────────────────────────

drop function finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean);
drop function finance.begin_checkout_attempt(uuid, uuid, bigint, boolean);

create function finance.begin_checkout_attempt(
  p_link_id uuid, p_agreement_id uuid, p_amount_cents bigint, p_livemode boolean
) returns table (
  attempt_id uuid, idempotency_key text, charge_amount_cents bigint,
  contribution_cents bigint, processing_fee_cents bigint
)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare
  v_id uuid := gen_random_uuid();
  v_bal finance.v_agreement_balances%rowtype;
  v_link_amount bigint;
  v_link_fee_bps integer; v_link_fee_fixed integer; v_link_policy text;
  v_total bigint;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'begin_checkout_attempt: amount must be positive' using errcode='VK400';
  end if;
  perform 1 from finance.agreements where id = p_agreement_id for update;
  if not found then
    raise exception 'begin_checkout_attempt: agreement % does not exist', p_agreement_id using errcode='VK404';
  end if;
  select * into v_bal from finance.v_agreement_balances b where b.agreement_id = p_agreement_id;
  if v_bal.payable_remaining_cents is null or v_bal.payable_remaining_cents <= 0 then
    raise exception 'begin_checkout_attempt: nothing remains to collect' using errcode='VK409';
  end if;
  if p_amount_cents > v_bal.payable_remaining_cents then
    raise exception 'begin_checkout_attempt: amount % exceeds payable remaining %',
      p_amount_cents, v_bal.payable_remaining_cents using errcode='VK409';
  end if;
  if p_link_id is not null then
    -- The link must belong to this agreement; a link of another agreement is
    -- indistinguishable from a missing one.
    select l.amount_cents, l.fee_bps, l.fee_fixed_cents, l.fee_policy_version
      into v_link_amount, v_link_fee_bps, v_link_fee_fixed, v_link_policy
      from finance.payment_links l
     where l.id = p_link_id and l.agreement_id = p_agreement_id;
    if not found then
      raise exception 'begin_checkout_attempt: link % does not exist', p_link_id using errcode='VK404';
    end if;
    -- A NULL link figure means "the full payable remaining", read now.
    if p_amount_cents <> coalesce(v_link_amount, v_bal.payable_remaining_cents) then
      raise exception 'begin_checkout_attempt: amount % does not match the link', p_amount_cents
        using errcode='VK409';
    end if;
  end if;
  -- D-092 (H): the charge is the capped CONTRIBUTION plus the fee the link was
  -- issued under. A NULL snapshot is no fee, so a link that predates the fee
  -- charges exactly its figure (G). Nothing compares the total to the cap.
  if v_link_policy is not null then
    v_total := finance.quote_processing_fee(p_amount_cents, v_link_fee_bps, v_link_fee_fixed);
  else
    v_total := p_amount_cents;
  end if;
  insert into finance.checkout_sessions
    (id, agreement_id, payment_link_id, amount_cents, currency, livemode, status,
     idempotency_key, expires_at, contribution_cents, processing_fee_cents, fee_policy_version)
  values (v_id, p_agreement_id, p_link_id, v_total, 'usd', p_livemode, 'creating',
          'vk2_checkout_' || v_id::text, clock_timestamp() + interval '7 days',
          p_amount_cents, v_total - p_amount_cents, v_link_policy);
  return query select v_id, 'vk2_checkout_' || v_id::text, v_total, p_amount_cents, v_total - p_amount_cents;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. peek_payment_link: the link's snapshot and the Session's composition, so
--    the bridge itemizes server figures and compares contributions (L, M).
-- ─────────────────────────────────────────────────────────────────────────────

drop function finance_api.peek_payment_link(text);
drop function finance.peek_payment_link(text);

create function finance.peek_payment_link(p_token_hash text)
returns table (
  link_id uuid, agreement_id uuid, link_status text, link_expires_at timestamptz,
  session_id uuid, session_status text, stripe_session_id text,
  session_amount_cents bigint, payable_remaining_cents bigint, payment_state text,
  link_amount_cents bigint,
  link_fee_bps integer, link_fee_fixed_cents integer, link_fee_policy_version text,
  session_contribution_cents bigint, session_processing_fee_cents bigint
)
language sql stable security definer set search_path = pg_catalog, public, finance
as $$
  select l.id, l.agreement_id, l.status::text, l.expires_at,
         cs.id, cs.status::text, cs.stripe_session_id, cs.amount_cents,
         b.payable_remaining_cents, b.payment_state::text,
         l.amount_cents,
         l.fee_bps, l.fee_fixed_cents, l.fee_policy_version,
         coalesce(cs.contribution_cents, cs.amount_cents), cs.processing_fee_cents
    from finance.payment_links l
    left join finance.checkout_sessions cs on cs.id = l.consumed_by_session_id
    left join finance.v_agreement_balances b on b.agreement_id = l.agreement_id
   where l.token_hash = p_token_hash;
$$;

create function finance_api.peek_payment_link(p_token_hash text)
returns table (
  link_id uuid, agreement_id uuid, link_status text, link_expires_at timestamptz,
  session_id uuid, session_status text, stripe_session_id text,
  session_amount_cents bigint, payable_remaining_cents bigint, payment_state text,
  link_amount_cents bigint,
  link_fee_bps integer, link_fee_fixed_cents integer, link_fee_policy_version text,
  session_contribution_cents bigint, session_processing_fee_cents bigint
) language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.peek_payment_link(p_token_hash); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. record_v2_stripe_payment: PR 6 body verbatim, plus the split from OUR
--     attempt row (J). p_attempt_id supplies identity, never arithmetic; no
--     caller can supply a fee. NULL keeps today's behaviour exactly.
-- ─────────────────────────────────────────────────────────────────────────────

drop function finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text);
drop function finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text);

create function finance.record_v2_stripe_payment(
  p_agreement_id uuid, p_amount_cents bigint, p_provider_object_id text,
  p_payment_intent_id text, p_occurred_at timestamptz, p_livemode boolean,
  p_origin_event_id text, p_attempt_id uuid default null
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare
  v_id uuid;
  v_session finance.checkout_sessions%rowtype;
  v_contribution bigint := p_amount_cents;
  v_fee bigint := 0;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'record_v2_stripe_payment: amount must be positive' using errcode='VK400';
  end if;
  if p_payment_intent_id is null or p_payment_intent_id = '' then
    raise exception 'record_v2_stripe_payment: payment intent id required' using errcode='VK400';
  end if;
  select id into v_id from finance.ledger_entries
   where entry_type='stripe_payment' and provider_payment_intent_id = p_payment_intent_id
     and livemode = p_livemode
   limit 1;
  if v_id is not null then return v_id; end if;
  -- D-092 (J): the provider gross must equal what we asked Stripe to charge for
  -- this attempt, and the attempt must be this agreement's, in this mode. Then
  -- the split is the attempt row's own composition. Any disagreement is a
  -- refusal with nothing written — reconciliation, not a guessed balance.
  if p_attempt_id is not null then
    select * into v_session from finance.checkout_sessions cs where cs.id = p_attempt_id for share;
    if not found then
      raise exception 'record_v2_stripe_payment: attempt % does not exist', p_attempt_id using errcode='VK404';
    end if;
    if v_session.agreement_id <> p_agreement_id then
      raise exception 'record_v2_stripe_payment: attempt % belongs to another agreement', p_attempt_id
        using errcode='VK409';
    end if;
    if v_session.livemode <> p_livemode then
      raise exception 'record_v2_stripe_payment: attempt % is in the other mode', p_attempt_id
        using errcode='VK409';
    end if;
    if v_session.amount_cents <> p_amount_cents then
      raise exception 'record_v2_stripe_payment: provider amount % does not equal the attempt charge %',
        p_amount_cents, v_session.amount_cents using errcode='VK409';
    end if;
    v_contribution := coalesce(v_session.contribution_cents, v_session.amount_cents);
    v_fee := v_session.processing_fee_cents;
  end if;
  begin
    insert into finance.ledger_entries (
      agreement_id, entry_type, amount_cents, currency, source,
      provider_object_id, provider_payment_intent_id, occurred_at,
      recorded_by_system, livemode, origin_stripe_event_id, processing_fee_cents
    ) values (
      p_agreement_id, 'stripe_payment', v_contribution, 'usd', 'stripe',
      p_provider_object_id, p_payment_intent_id, coalesce(p_occurred_at, clock_timestamp()),
      'reconciliation', p_livemode, p_origin_event_id, v_fee
    ) returning id into v_id;
  exception when unique_violation then
    select id into v_id from finance.ledger_entries
     where entry_type='stripe_payment' and provider_payment_intent_id = p_payment_intent_id
       and livemode = p_livemode limit 1;
    if v_id is null then raise; end if;
  end;
  return v_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. The façade: wrappers for the new signatures, and the views
-- ─────────────────────────────────────────────────────────────────────────────

create function finance_api.issue_payment_link(
  p_agreement_id uuid, p_token_hash text, p_reason text, p_amount_cents bigint default null
) returns table (
  link_id uuid, amount_cents bigint, expires_at timestamptz,
  processing_fee_cents bigint, total_cents bigint
)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.issue_payment_link(p_agreement_id, p_token_hash, p_reason, p_amount_cents); $$;

create function finance_api.begin_checkout_attempt(
  p_link_id uuid, p_agreement_id uuid, p_amount_cents bigint, p_livemode boolean
) returns table (
  attempt_id uuid, idempotency_key text, charge_amount_cents bigint,
  contribution_cents bigint, processing_fee_cents bigint
)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.begin_checkout_attempt(p_link_id, p_agreement_id, p_amount_cents, p_livemode); $$;

create function finance_api.record_v2_stripe_payment(
  p_agreement_id uuid, p_amount_cents bigint, p_provider_object_id text,
  p_payment_intent_id text, p_occurred_at timestamptz, p_livemode boolean,
  p_origin_event_id text, p_attempt_id uuid default null
) returns uuid language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.record_v2_stripe_payment(p_agreement_id, p_amount_cents, p_provider_object_id, p_payment_intent_id, p_occurred_at, p_livemode, p_origin_event_id, p_attempt_id); $$;

-- Same column list plus the snapshot appended: the link strip shows what a
-- live link will charge.
create or replace view finance_api.payment_links with (security_invoker = true) as
  select id, agreement_id, status, expires_at, claimed_at, consumed_at,
         consumed_by_session_id, revoked_at, attempt_count, created_at, reason,
         amount_cents, fee_bps, fee_fixed_cents, fee_policy_version
    from finance.payment_links;
grant select on finance_api.payment_links to authenticated, service_role;

-- Read-only view of the policy in force, for the founder's Collect preview.
-- security_invoker: the base table's founder policy still decides who sees it.
create view finance_api.fee_settings with (security_invoker = true) as
  select fee_enabled, fee_bps, fee_fixed_cents, fee_policy_version, updated_at
    from finance.fee_settings;
grant select on finance_api.fee_settings to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Grants on every new signature. A newly created function defaults to
--     PUBLIC EXECUTE, and finance's default privileges hand service_role
--     EXECUTE on creation — both are revoked before the right role is granted.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function finance.quote_processing_fee(bigint, integer, integer) from public;
revoke execute on function finance.quote_processing_fee(bigint, integer, integer) from service_role;

revoke all on function finance.set_fee_settings(boolean, integer, integer, text) from public;
revoke execute on function finance.set_fee_settings(boolean, integer, integer, text) from service_role;
grant execute on function finance.set_fee_settings(boolean, integer, integer, text) to authenticated;
revoke all on function finance_api.set_fee_settings(boolean, integer, integer, text) from public;
grant execute on function finance_api.set_fee_settings(boolean, integer, integer, text) to authenticated;

revoke all on function finance.issue_payment_link(uuid, text, text, bigint) from public;
revoke execute on function finance.issue_payment_link(uuid, text, text, bigint) from service_role;
grant execute on function finance.issue_payment_link(uuid, text, text, bigint) to authenticated;
revoke all on function finance_api.issue_payment_link(uuid, text, text, bigint) from public;
grant execute on function finance_api.issue_payment_link(uuid, text, text, bigint) to authenticated;

revoke all on function finance.begin_checkout_attempt(uuid, uuid, bigint, boolean) from public;
grant execute on function finance.begin_checkout_attempt(uuid, uuid, bigint, boolean) to service_role;
revoke all on function finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean) from public;
grant execute on function finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean) to service_role;

revoke all on function finance.peek_payment_link(text) from public;
grant execute on function finance.peek_payment_link(text) to service_role;
revoke all on function finance_api.peek_payment_link(text) from public;
grant execute on function finance_api.peek_payment_link(text) to service_role;

revoke all on function finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text, uuid) from public;
grant execute on function finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text, uuid) to service_role;
revoke all on function finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text, uuid) from public;
grant execute on function finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text, uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. Assertions: the PR 6 block (with the D-088 carve-out), then 10E's facts
-- ─────────────────────────────────────────────────────────────────────────────

-- The PR 6 block, with one settled exception: D-088 (20260823020000) made
-- finance_api.public_campaign_status the ONE SECURITY DEFINER function anon may
-- execute — the public /support status probe — and carved it out of its own
-- assertions by name. The same carve-out applies here; every other count is
-- unchanged.
do $chk$
declare n integer;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance_api' and p.prosecdef
     and p.proname <> 'public_campaign_status';
  if n <> 0 then raise exception '% finance_api SECURITY DEFINER', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname='finance_api' and a.privilege_type='EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid)
     and p.proname <> 'public_campaign_status';
  if n <> 0 then raise exception 'anon/PUBLIC EXECUTE on % fn(s)', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance_api'
     and p.proname in ('issue_payment_link','revoke_payment_link')
     and has_function_privilege('service_role', p.oid, 'EXECUTE');
  if n <> 0 then raise exception 'service_role EXECUTE on % founder link fn(s)', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance_api'
     and p.proname in ('claim_payment_link','begin_checkout_attempt','finalize_checkout_session',
                       'transition_checkout_session','record_v2_stripe_payment')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if n <> 0 then raise exception 'authenticated EXECUTE on % machine checkout fn(s)', n; end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema='finance' and grantee in ('anon','authenticated','service_role')
     and privilege_type in ('UPDATE','DELETE','TRUNCATE');
  if n <> 0 then raise exception 'append-only violated: %', n; end if;
end $chk$;

do $chk10e$
declare n integer; v_def text; v_enabled boolean; f text;
begin
  -- Configuration: exactly one row, fees OFF, founder-only write path.
  select count(*), bool_and(fee_enabled) into n, v_enabled from finance.fee_settings;
  if n <> 1 then raise exception 'fee_settings must hold exactly one row, has %', n; end if;
  if v_enabled then raise exception 'fee_settings.fee_enabled must be false on apply'; end if;
  select count(*) into n from pg_constraint
   where conrelid = 'finance.fee_settings'::regclass and contype = 'c'
     and conname in ('fee_settings_singleton','fee_settings_bps_sane','fee_settings_fixed_sane',
                     'fee_settings_policy_version_nonblank');
  if n <> 4 then raise exception 'fee_settings CHECKs missing (% of 4)', n; end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema='finance' and table_name='fee_settings'
     and grantee in ('anon','authenticated','service_role')
     and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if n <> 0 then raise exception 'fee_settings has % write grant(s) to an application role', n; end if;
  if has_table_privilege('anon', 'finance.fee_settings', 'SELECT')
     or has_table_privilege('anon', 'finance_api.fee_settings', 'SELECT') then
    raise exception 'anon can read fee settings';
  end if;
  select count(*) into n from pg_class c where c.oid = 'finance.fee_settings'::regclass
     and c.relrowsecurity and c.relforcerowsecurity;
  if n <> 1 then raise exception 'fee_settings RLS not enabled and forced'; end if;
  select count(*) into n from pg_policy where polrelid = 'finance.fee_settings'::regclass
     and 'anon'::regrole::oid = any(polroles);
  if n <> 0 then raise exception 'fee_settings has an anon policy'; end if;

  -- The one formula is IMMUTABLE and exists exactly once.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance' and p.proname='quote_processing_fee';
  if n <> 1 then raise exception '% quote_processing_fee overloads, expected 1', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance' and p.proname='quote_processing_fee' and p.provolatile = 'i';
  if n <> 1 then raise exception 'quote_processing_fee is not IMMUTABLE'; end if;
  if finance.quote_processing_fee(1000000, 290, 30) <> 1029898
     or finance.quote_processing_fee(100, 290, 30) <> 134
     or finance.quote_processing_fee(10000, 290, 30) <> 10330
     or finance.quote_processing_fee(941, 290, 30) <> 1000
     or finance.quote_processing_fee(10000, 0, 0) <> 10000 then
    raise exception 'quote_processing_fee diverges from the pinned vectors';
  end if;
  -- begin_public_checkout carries no inline gross-up any more; it calls the function.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance' and p.proname='begin_public_checkout'
     and p.prosrc like '%quote_processing_fee(%' and p.prosrc not like '%+ (10000 -%';
  if n <> 1 then raise exception 'begin_public_checkout is not rewired through quote_processing_fee'; end if;

  -- The columns and their CHECKs.
  select count(*) into n from information_schema.columns
   where table_schema='finance' and table_name='payment_links'
     and column_name in ('fee_bps','fee_fixed_cents','fee_policy_version') and is_nullable='YES';
  if n <> 3 then raise exception 'payment_links snapshot columns missing (% of 3)', n; end if;
  select count(*) into n from pg_constraint
   where conrelid='finance.payment_links'::regclass and contype='c'
     and conname in ('payment_links_fee_snapshot_all_or_none','payment_links_fee_bps_sane',
                     'payment_links_fee_fixed_sane','payment_links_fee_policy_version_nonblank');
  if n <> 4 then raise exception 'payment_links fee CHECKs missing (% of 4)', n; end if;
  select count(*) into n from information_schema.columns
   where table_schema='finance' and table_name='checkout_sessions'
     and ((column_name='contribution_cents' and is_nullable='YES')
       or (column_name='processing_fee_cents' and is_nullable='NO' and column_default='0')
       or (column_name='fee_policy_version' and is_nullable='YES'));
  if n <> 3 then raise exception 'checkout_sessions composition columns missing (% of 3)', n; end if;
  select count(*) into n from pg_constraint
   where conrelid='finance.checkout_sessions'::regclass and contype='c'
     and conname in ('checkout_sessions_contribution_positive','checkout_sessions_fee_nonnegative',
                     'checkout_sessions_total_is_sum','checkout_sessions_fee_requires_policy');
  if n <> 4 then raise exception 'checkout_sessions fee CHECKs missing (% of 4)', n; end if;
  select count(*) into n from information_schema.columns
   where table_schema='finance' and table_name='ledger_entries'
     and column_name='processing_fee_cents' and is_nullable='NO' and column_default='0';
  if n <> 1 then raise exception 'ledger_entries.processing_fee_cents missing or not NOT NULL DEFAULT 0'; end if;
  select count(*) into n from pg_constraint
   where conrelid='finance.ledger_entries'::regclass and contype='c'
     and conname in ('ledger_fee_nonnegative','ledger_fee_only_on_stripe_payment');
  if n <> 2 then raise exception 'ledger fee CHECKs missing (% of 2)', n; end if;
  -- No pre-existing row carries a fee or a snapshot: no backfill happened.
  select count(*) into n from finance.ledger_entries where processing_fee_cents <> 0;
  if n <> 0 then raise exception '% ledger row(s) carry a fee on apply', n; end if;
  select count(*) into n from finance.payment_links where fee_policy_version is not null;
  if n <> 0 then raise exception '% link(s) carry a snapshot on apply', n; end if;

  -- Exactly one pg_proc row per schema for every recreated function; the
  -- defaulted parameter on the two that have one.
  foreach f in array array['issue_payment_link','begin_checkout_attempt','peek_payment_link',
                           'record_v2_stripe_payment','set_fee_settings'] loop
    select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
     where ns.nspname='finance' and p.proname=f;
    if n <> 1 then raise exception 'finance.% has % overload(s), expected 1', f, n; end if;
    select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
     where ns.nspname='finance_api' and p.proname=f;
    if n <> 1 then raise exception 'finance_api.% has % overload(s), expected 1', f, n; end if;
  end loop;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname in ('finance','finance_api')
     and p.proname in ('issue_payment_link','record_v2_stripe_payment') and p.pronargdefaults = 1;
  if n <> 4 then raise exception 'defaulted parameters missing (% of 4)', n; end if;
  if to_regprocedure('finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text)') is not null
     or to_regprocedure('finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text)') is not null then
    raise exception 'the seven-argument record_v2_stripe_payment still exists';
  end if;

  -- No PUBLIC or anon EXECUTE on anything created here, in either schema.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname in ('finance','finance_api')
     and p.proname in ('quote_processing_fee','set_fee_settings','issue_payment_link',
                       'begin_checkout_attempt','peek_payment_link','record_v2_stripe_payment',
                       'begin_public_checkout')
     and a.privilege_type='EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if n <> 0 then raise exception 'anon/PUBLIC EXECUTE on % new 10E fn(s)', n; end if;
  -- Founder-only: authenticated may call, service_role may not.
  if has_function_privilege('service_role', 'finance_api.set_fee_settings(boolean,integer,integer,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'finance.set_fee_settings(boolean,integer,integer,text)', 'EXECUTE')
     or has_function_privilege('service_role', 'finance_api.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE')
     or has_function_privilege('service_role', 'finance.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE') then
    raise exception 'service_role EXECUTE on a founder-only 10E function';
  end if;
  if not has_function_privilege('authenticated', 'finance_api.set_fee_settings(boolean,integer,integer,text)', 'EXECUTE')
     or not has_function_privilege('authenticated', 'finance_api.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE') then
    raise exception 'authenticated lost EXECUTE on a founder 10E function';
  end if;
  -- Machine-only: service_role may call, authenticated may not.
  if has_function_privilege('authenticated', 'finance_api.begin_checkout_attempt(uuid,uuid,bigint,boolean)', 'EXECUTE')
     or has_function_privilege('authenticated', 'finance_api.peek_payment_link(text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'finance_api.record_v2_stripe_payment(uuid,bigint,text,text,timestamptz,boolean,text,uuid)', 'EXECUTE') then
    raise exception 'authenticated EXECUTE on a machine 10E function';
  end if;
  if not has_function_privilege('service_role', 'finance_api.begin_checkout_attempt(uuid,uuid,bigint,boolean)', 'EXECUTE')
     or not has_function_privilege('service_role', 'finance_api.peek_payment_link(text)', 'EXECUTE')
     or not has_function_privilege('service_role', 'finance_api.record_v2_stripe_payment(uuid,bigint,text,text,timestamptz,boolean,text,uuid)', 'EXECUTE') then
    raise exception 'service_role lost EXECUTE on a machine 10E function';
  end if;
  -- Nobody but the owner runs the formula directly; its callers are SECURITY DEFINER.
  if has_function_privilege('authenticated', 'finance.quote_processing_fee(bigint,integer,integer)', 'EXECUTE')
     or has_function_privilege('service_role', 'finance.quote_processing_fee(bigint,integer,integer)', 'EXECUTE') then
    raise exception 'quote_processing_fee is executable by an application role';
  end if;

  -- finance stays unexposed: anon holds no USAGE on it (PostgREST exposure itself
  -- is API configuration, confirmed at rollout by a failing .schema("finance") call).
  if has_schema_privilege('anon', 'finance', 'USAGE') then
    raise exception 'anon has USAGE on finance';
  end if;

  -- The single-flight index is untouched: its definition is the PR 1 text.
  select pg_get_indexdef('finance.checkout_sessions_live_uq'::regclass) into v_def;
  if v_def <> 'CREATE UNIQUE INDEX checkout_sessions_live_uq ON finance.checkout_sessions USING btree (agreement_id, livemode) WHERE (status = ANY (ARRAY[''creating''::finance.checkout_status, ''open''::finance.checkout_status]))' then
    raise exception 'checkout_sessions_live_uq changed: %', v_def;
  end if;
end $chk10e$;

commit;
