-- Financials V2 — PR 10E (D-092) behavioural proof: the processing fee on
-- founder-issued contribution links.
--
-- ONE transaction that applies the migration AND proves it, then ENDS BY
-- RAISING an exception that carries the results — so it can only roll back.
-- No COMMIT exists anywhere in this file. Every row it creates (agreements,
-- links, attempts, ledger entries, public checkout attempts, the temporary
-- campaign activation) is discarded with the transaction, and the migration's
-- DDL is discarded with it too. Run against a database where the series up to
-- 20260905200000 has been applied and 20260908010000 has NOT:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/proofs/pr10e_link_processing_fee.sql
--
-- The migration body between the >>> and <<< markers is the committed file
-- supabase/migrations/20260908010000_finance_pr10e_link_processing_fee.sql
-- with its own `begin;` / `commit;` removed — byte-identical otherwise, pinned
-- by lib/finance/fee-parity.test.ts. The fee vectors embedded below are
-- supabase/tests/fixtures/fee_vectors.json, pinned by the same test.
--
-- Self-contained: it picks the first founder in public.user_roles (what
-- is_founder() reads) and members with no agreement of the purposes it uses,
-- then creates its own agreements through create_agreement_with_contribution
-- + transition_agreement. Nothing is passed in.
--
-- Each check prints PASS/FAIL. A setup failure stops psql (ON_ERROR_STOP) with
-- the transaction aborted. The closing block ALWAYS raises, carrying the
-- summary, so the exit code is nonzero by design and the database is left
-- exactly as it was.
--
-- Criteria covered here: 1, 2, 3 (database half), 4, 5, 7 (SQL half), 8, 9,
-- 10, 13 (database half), 14, 15, 16, 17, 18. The TypeScript halves are in
-- lib/finance/fee-parity.test.ts and lib/finance/checkout.test.ts.

\set ON_ERROR_STOP on

begin;
set local client_min_messages = notice;

create temp table pr10e_proof (seq serial, criterion text, ok boolean, detail text) on commit drop;
create temp table pr10e_ctx (
  founder_id uuid, m_off uuid, m_pre uuid, m_fee uuid,
  agreement_off uuid, agreement_pre uuid, agreement_fee uuid,
  link_pre uuid, link_off uuid, link_fee uuid,
  attempt_off uuid, attempt_pre uuid, attempt_fee uuid,
  ledger_off uuid, ledger_fee uuid,
  view_md5_before text, fn_md5_before text
) on commit drop;
insert into pr10e_ctx default values;

create function pg_temp.check(c text, ok boolean, d text) returns void language plpgsql as $$
begin
  d := coalesce(d, '<null detail>'); ok := coalesce(ok, false);
  insert into pr10e_proof (criterion, ok, detail) values (c, ok, d);
  if ok then raise notice 'PASS  criterion %: %', c, d;
  else       raise notice 'FAIL  criterion %: %', c, d; end if;
end $$;

-- Run a statement that MUST raise; the savepoint the exception block opens
-- means a refused call leaves nothing behind.
create function pg_temp.expect(c text, stmt text, want_code text, want_msg text, d text)
returns void language plpgsql as $$
declare got_code text; got_msg text;
begin
  begin
    execute stmt;
  exception when others then
    got_code := sqlstate; got_msg := sqlerrm;
    perform pg_temp.check(c, (want_code is null or got_code = want_code) and got_msg like want_msg,
      d || ' [' || got_code || ': ' || got_msg || ']');
    return;
  end;
  perform pg_temp.check(c, false, d || ' [expected ' || coalesce(want_code, 'an error') || ' but the call succeeded]');
end $$;

create function pg_temp.hash(n text) returns text language sql as $$
  select encode(sha256(('pr10e-proof-' || n)::bytea), 'base64');
$$;

create function pg_temp.ledger_rows(a uuid) returns bigint language sql as $$
  select count(*) from finance.ledger_entries where agreement_id = a;
$$;

-- The fee vectors: supabase/tests/fixtures/fee_vectors.json, verbatim.
create temp table pr10e_vectors (name text, c bigint, bps integer, fixed integer, fee bigint, total bigint) on commit drop;
insert into pr10e_vectors
select x->>'name', (x->>'contribution_cents')::bigint, (x->>'fee_bps')::integer,
       (x->>'fee_fixed_cents')::integer, (x->>'processing_fee_cents')::bigint, (x->>'total_cents')::bigint
  from jsonb_array_elements($vectors$
{
  "$comment": "Financials V2 PR 10E (D-092) fee parity fixture. Generated from quoteProcessingFee in lib/finance/public-support-fees.ts and verified against exact integer arithmetic; finance.quote_processing_fee must yield total_cents for every vector (supabase/tests/proofs/pr10e_link_processing_fee.sql). Regenerate only by re-running the generator against quoteProcessingFee; never edit a figure by hand.",
  "formula": "total_cents = ceil((contribution_cents + fee_fixed_cents) * 10000 / (10000 - fee_bps)); processing_fee_cents = total_cents - contribution_cents",
  "vectors": [
    {
      "name": "one_cent_default_policy",
      "note": "contribution = 1 (rounds up: fee 31)",
      "contribution_cents": 1,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 31,
      "total_cents": 32
    },
    {
      "name": "founder_drill_one_dollar",
      "note": "criterion 20: $1.00 + $0.34 = $1.34",
      "contribution_cents": 100,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 34,
      "total_cents": 134
    },
    {
      "name": "d088_example_five_dollars",
      "note": "public support minimum",
      "contribution_cents": 500,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 46,
      "total_cents": 546
    },
    {
      "name": "d088_example_twenty_five_dollars",
      "note": "public support preset",
      "contribution_cents": 2500,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 106,
      "total_cents": 2606
    },
    {
      "name": "d088_example_one_hundred_dollars",
      "note": "the founder's $100 -> $103.30 example",
      "contribution_cents": 10000,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 330,
      "total_cents": 10330
    },
    {
      "name": "d088_example_one_thousand_dollars",
      "note": "$1,000 -> $1,030.18",
      "contribution_cents": 100000,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 3018,
      "total_cents": 103018
    },
    {
      "name": "criterion_3_ten_thousand_dollars",
      "note": "rounds up: 1029897.01 -> 1029898",
      "contribution_cents": 1000000,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 29898,
      "total_cents": 1029898
    },
    {
      "name": "divides_exactly_default_policy",
      "note": "(941 + 30) * 10000 / 9710 = 1000 exactly",
      "contribution_cents": 941,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 59,
      "total_cents": 1000
    },
    {
      "name": "zero_bps",
      "note": "bps = 0: only the fixed fee",
      "contribution_cents": 10000,
      "fee_bps": 0,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 30,
      "total_cents": 10030
    },
    {
      "name": "zero_fixed",
      "note": "fixed = 0: only the percentage",
      "contribution_cents": 10000,
      "fee_bps": 290,
      "fee_fixed_cents": 0,
      "processing_fee_cents": 299,
      "total_cents": 10299
    },
    {
      "name": "zero_policy_divides_exactly",
      "note": "bps = 0 and fixed = 0: total = contribution, fee 0",
      "contribution_cents": 10000,
      "fee_bps": 0,
      "fee_fixed_cents": 0,
      "processing_fee_cents": 0,
      "total_cents": 10000
    },
    {
      "name": "max_bps",
      "note": "the largest permitted bps: denominator 1",
      "contribution_cents": 1,
      "fee_bps": 9999,
      "fee_fixed_cents": 0,
      "processing_fee_cents": 9999,
      "total_cents": 10000
    },
    {
      "name": "divides_exactly_alt_policy",
      "note": "8 * 10000 / 8000 = 10 exactly",
      "contribution_cents": 8,
      "fee_bps": 2000,
      "fee_fixed_cents": 0,
      "processing_fee_cents": 2,
      "total_cents": 10
    },
    {
      "name": "two_to_the_forty",
      "note": "contribution = 2^40: bigint on both sides",
      "contribution_cents": 1099511627776,
      "fee_bps": 290,
      "fee_fixed_cents": 30,
      "processing_fee_cents": 32838143394,
      "total_cents": 1132349771170
    }
  ]
}
$vectors$::jsonb -> 'vectors') x;

-- ── Setup: founder identity, members, agreements ─────────────────────────────

do $$
declare v_founder uuid; v_off uuid; v_pre uuid; v_fee uuid; a_off uuid; a_pre uuid; a_fee uuid;
begin
  select user_id into v_founder from public.user_roles where role = 'founder' order by user_id limit 1;
  if v_founder is null then raise exception 'setup: no founder in public.user_roles'; end if;
  perform set_config('request.jwt.claim.sub', v_founder::text, true);
  if not public.is_founder() then raise exception 'setup: is_founder() is false for %', v_founder; end if;

  select m.id into v_off from public.members m
   where not exists (select 1 from finance.agreements a
                      where a.member_id = m.id and a.purpose = 'membership' and a.journey_id is null)
   order by m.id limit 1;
  select m.id into v_pre from public.members m
   where m.id <> v_off
     and not exists (select 1 from finance.agreements a
                      where a.member_id = m.id and a.purpose = 'journey_contribution' and a.journey_id is null)
   order by m.id limit 1;
  select m.id into v_fee from public.members m
   where m.id not in (v_off, v_pre)
     and not exists (select 1 from finance.agreements a
                      where a.member_id = m.id and a.purpose = 'membership' and a.journey_id is null)
   order by m.id limit 1;
  if v_off is null or v_pre is null or v_fee is null then raise exception 'setup: fewer than three members available'; end if;

  a_off := finance.create_agreement_with_contribution(v_off, null, 'membership', 1000000, 'PR 10E proof: fee off');
  perform finance.transition_agreement(a_off, 'active', 'PR 10E proof: fee off');
  a_pre := finance.create_agreement_with_contribution(v_pre, null, 'journey_contribution', 1000000, 'PR 10E proof: pre-existing link');
  perform finance.transition_agreement(a_pre, 'active', 'PR 10E proof: pre-existing link');
  a_fee := finance.create_agreement_with_contribution(v_fee, null, 'membership', 1000000, 'PR 10E proof: fee on');
  perform finance.transition_agreement(a_fee, 'active', 'PR 10E proof: fee on');
  update pr10e_ctx set founder_id = v_founder, m_off = v_off, m_pre = v_pre, m_fee = v_fee,
         agreement_off = a_off, agreement_pre = a_pre, agreement_fee = a_fee;
  raise notice 'setup: founder %, agreements off % / pre % / fee %', v_founder, a_off, a_pre, a_fee;
end $$;

-- ── BEFORE the migration: baselines the after-state is measured against ──────

-- 4: the two definitions that must not move.
update pr10e_ctx set
  view_md5_before = md5(pg_get_viewdef('finance.v_agreement_balances'::regclass)),
  fn_md5_before   = md5(pg_get_functiondef('finance.f_balances(boolean)'::regprocedure));

-- 14 / 18: every pre-existing ledger row's physical identity. DDL with a
-- non-volatile default rewrites nothing, so xmin and ctid must be unchanged.
create temp table pr10e_ledger_before on commit drop as
  select id, xmin::text as xmin_before, ctid::text as ctid_before from finance.ledger_entries;

-- 18: the columns this migration adds do not exist yet — the ALTERs are additive.
do $$
declare n int;
begin
  select count(*) into n from information_schema.columns
   where (table_schema, table_name, column_name) in (
     ('finance','payment_links','fee_bps'), ('finance','payment_links','fee_fixed_cents'),
     ('finance','payment_links','fee_policy_version'),
     ('finance','checkout_sessions','contribution_cents'), ('finance','checkout_sessions','processing_fee_cents'),
     ('finance','checkout_sessions','fee_policy_version'),
     ('finance','ledger_entries','processing_fee_cents'));
  perform pg_temp.check('18', n = 0, 'before apply: none of the seven new columns exists (' || n || ')');
  perform pg_temp.check('18', to_regclass('finance.fee_settings') is null
                          and to_regprocedure('finance.quote_processing_fee(bigint,integer,integer)') is null,
    'before apply: fee_settings and quote_processing_fee do not exist');
  select count(*) into n from finance.ledger_entries;
  raise notice 'baseline: % pre-existing ledger row(s) sampled for xmin/ctid', n;
end $$;

-- 2: a link issued BEFORE the migration, through the D-090 signature.
do $$
declare c pr10e_ctx%rowtype; r record;
begin
  select * into c from pr10e_ctx;
  select * into r from finance_api.issue_payment_link(
    p_agreement_id => c.agreement_pre, p_token_hash => pg_temp.hash('pre'), p_reason => 'PR 10E proof: issued before the migration');
  update pr10e_ctx set link_pre = r.link_id;
  perform pg_temp.check('2', r.amount_cents = 1000000, 'pre-migration link issued for ' || r.amount_cents || ' (D-090 three-argument call)');
end $$;

-- 8: public support BEFORE — every vector through the current begin_public_checkout.
-- The campaign is made active and its policy/bounds set per vector inside this
-- rolled-back transaction; nothing of it survives.
create temp table pr10e_pc_before (name text, contribution bigint, fee bigint, total bigint, policy text) on commit drop;
create temp table pr10e_pc_after  (name text, contribution bigint, fee bigint, total bigint, policy text) on commit drop;
do $$
declare v_status text;
begin
  select status::text into v_status from finance.public_support_campaigns where slug = 'general-support' and livemode;
  if v_status is null then raise exception 'setup: no live general-support campaign'; end if;
  raise notice 'setup: general-support campaign is % (activated for this transaction only if needed)', v_status;
  if v_status <> 'active' then
    update finance.legal_entities set
      legal_name = coalesce(nullif(btrim(legal_name), ''), 'PR 10E proof'),
      tax_deductible_ack_enabled = true,
      receipt_footer = coalesce(nullif(btrim(receipt_footer), ''), 'PR 10E proof'),
      ack_tax_language = coalesce(nullif(btrim(ack_tax_language), ''), 'PR 10E proof'),
      ack_no_goods_statement = coalesce(nullif(btrim(ack_no_goods_statement), ''), 'PR 10E proof');
    update finance.public_support_campaigns set bounds_approved_at = coalesce(bounds_approved_at, clock_timestamp())
     where slug = 'general-support' and livemode;
    update finance.public_support_campaigns set status = 'active' where slug = 'general-support' and livemode;
  end if;
  update finance.public_support_campaigns set min_amount_cents = 1, max_amount_cents = 2000000000000
   where slug = 'general-support' and livemode;
end $$;
do $$
declare r record; o record;
begin
  for r in select * from pr10e_vectors order by name loop
    update finance.public_support_campaigns set fee_bps = r.bps, fee_fixed_cents = r.fixed
     where slug = 'general-support' and livemode;
    select * into o from finance.begin_public_checkout('general-support', r.c, gen_random_uuid());
    insert into pr10e_pc_before values (r.name, o.requested_contribution_cents, o.processing_fee_cents, o.total_charge_cents, o.fee_policy_version);
  end loop;
end $$;

-- ── THE MIGRATION ─────────────────────────────────────────────────────────────
-- >>> migration body (verbatim from supabase/migrations/20260908010000_finance_pr10e_link_processing_fee.sql) >>>
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
-- <<< end migration body <<<

-- ── AFTER: 18 (apply), 4 (definitions), 14 / 18 (no row touched) ────────────

do $$
declare c pr10e_ctx%rowtype; n int; m int; v_view text; v_fn text;
begin
  select * into c from pr10e_ctx;
  perform pg_temp.check('18', true, 'the migration applied inside this transaction; both assertion blocks were silent');
  v_view := md5(pg_get_viewdef('finance.v_agreement_balances'::regclass));
  v_fn   := md5(pg_get_functiondef('finance.f_balances(boolean)'::regprocedure));
  perform pg_temp.check('4', v_view = c.view_md5_before, 'v_agreement_balances definition md5 before ' || c.view_md5_before || ' / after ' || v_view);
  perform pg_temp.check('4', v_fn = c.fn_md5_before, 'f_balances(boolean) md5 before ' || c.fn_md5_before || ' / after ' || v_fn);
  select count(*) into n from pr10e_ledger_before b
    join finance.ledger_entries l on l.id = b.id
   where l.xmin::text <> b.xmin_before or l.ctid::text <> b.ctid_before;
  select count(*) into m from pr10e_ledger_before;
  perform pg_temp.check('14', n = 0, 'ALTER TABLE ledger_entries touched 0 of ' || m || ' pre-existing row(s): xmin and ctid unchanged on every one');
  select count(*) into n from finance.ledger_entries where processing_fee_cents <> 0;
  perform pg_temp.check('14', n = 0, 'pre-existing ledger rows with processing_fee_cents <> 0: ' || n || ' (no backfill)');
  select count(*) into n from information_schema.columns
   where table_schema = 'finance' and table_name = 'ledger_entries' and column_name = 'processing_fee_cents'
     and is_nullable = 'NO' and column_default = '0';
  perform pg_temp.check('14', n = 1, 'ledger_entries.processing_fee_cents is NOT NULL DEFAULT 0');
  select count(*) into n from finance.payment_links where fee_policy_version is not null;
  perform pg_temp.check('18', n = 0, 'payment_links rows carrying a snapshot on apply: ' || n);
  select count(*) into n from finance.checkout_sessions where contribution_cents is not null or processing_fee_cents <> 0;
  perform pg_temp.check('18', n = 0, 'checkout_sessions rows carrying a composition on apply: ' || n);
end $$;

-- ── 7 (SQL half): every vector through finance.quote_processing_fee ─────────

do $$
declare r record; got bigint; n_ok int := 0; n_bad int := 0; bad text := '';
begin
  for r in select * from pr10e_vectors order by name loop
    got := finance.quote_processing_fee(r.c, r.bps, r.fixed);
    if got = r.total and got - r.c = r.fee then n_ok := n_ok + 1;
    else n_bad := n_bad + 1; bad := bad || format(' %s(sql %s, fixture %s)', r.name, got, r.total); end if;
  end loop;
  perform pg_temp.check('7', n_bad = 0, n_ok || ' of ' || (n_ok + n_bad) || ' fixture vectors identical in SQL' || bad);
  perform pg_temp.expect('7', 'select finance.quote_processing_fee(0, 290, 30)', 'VK400', '%contribution must be positive%', 'contribution 0 refused');
  perform pg_temp.expect('7', 'select finance.quote_processing_fee(100, 10000, 30)', 'VK400', '%fee bps%out of range%', 'bps 10000 refused');
  perform pg_temp.expect('7', 'select finance.quote_processing_fee(100, -1, 30)', 'VK400', '%fee bps%out of range%', 'bps -1 refused');
  perform pg_temp.expect('7', 'select finance.quote_processing_fee(100, 290, -1)', 'VK400', '%fixed fee%out of range%', 'fixed -1 refused');
  perform pg_temp.check('7', (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                where n.nspname = 'finance' and p.proname = 'quote_processing_fee') = 'i',
    'quote_processing_fee is IMMUTABLE');
end $$;

-- ── 8: public support AFTER — same vectors, same answers ─────────────────────

do $$
declare r record; o record; n_same int; n_total int; diffs text;
begin
  for r in select * from pr10e_vectors order by name loop
    update finance.public_support_campaigns set fee_bps = r.bps, fee_fixed_cents = r.fixed
     where slug = 'general-support' and livemode;
    select * into o from finance.begin_public_checkout('general-support', r.c, gen_random_uuid());
    insert into pr10e_pc_after values (r.name, o.requested_contribution_cents, o.processing_fee_cents, o.total_charge_cents, o.fee_policy_version);
  end loop;
  select count(*) into n_total from pr10e_pc_before;
  select count(*) into n_same from pr10e_pc_before b join pr10e_pc_after a on a.name = b.name
   where a.contribution = b.contribution and a.fee = b.fee and a.total = b.total and a.policy = b.policy;
  select coalesce(string_agg(format('%s before(%s,%s,%s,%s) after(%s,%s,%s,%s)', b.name, b.contribution, b.fee, b.total, b.policy,
                                    a.contribution, a.fee, a.total, a.policy), '; '), '') into diffs
    from pr10e_pc_before b join pr10e_pc_after a on a.name = b.name
   where not (a.contribution = b.contribution and a.fee = b.fee and a.total = b.total and a.policy = b.policy);
  perform pg_temp.check('8', n_same = n_total and n_total = (select count(*) from pr10e_vectors),
    'begin_public_checkout: ' || n_same || ' of ' || n_total || ' vectors identical before and after the rewire' ||
    case when diffs = '' then '' else ' DIFF: ' || diffs end);
  select count(*) into n_same from pr10e_pc_after a join pr10e_vectors v on v.name = a.name
   where a.total = v.total and a.fee = v.fee;
  perform pg_temp.check('8', n_same = n_total, n_same || ' of ' || n_total || ' post-rewire public totals equal the fixture');
  for r in select b.name, b.contribution, b.fee, b.total from pr10e_pc_before b order by b.name loop
    raise notice '      vector % contribution % fee % total % (before = after = fixture)', rpad(r.name, 34), r.contribution, r.fee, r.total;
  end loop;
end $$;

-- ── 17: catalog facts the assertion block also enforces ──────────────────────

do $$
declare n int; f text; bad text := '';
begin
  foreach f in array array['issue_payment_link','begin_checkout_attempt','peek_payment_link','record_v2_stripe_payment','set_fee_settings'] loop
    select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'finance' and p.proname = f;
    if n <> 1 then bad := bad || ' finance.' || f || '=' || n; end if;
    select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
     where ns.nspname = 'finance_api' and p.proname = f;
    if n <> 1 then bad := bad || ' finance_api.' || f || '=' || n; end if;
  end loop;
  perform pg_temp.check('17', bad = '', 'exactly one pg_proc row per schema for each recreated function' || bad);
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname in ('finance', 'finance_api')
     and p.proname in ('quote_processing_fee','set_fee_settings','issue_payment_link','begin_checkout_attempt',
                       'peek_payment_link','record_v2_stripe_payment','begin_public_checkout')
     and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  perform pg_temp.check('17', n = 0, 'anon/PUBLIC EXECUTE grants on the migration''s functions: ' || n);
  select count(*), coalesce(string_agg(p.proname, ','), '') into n, f
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance_api' and p.prosecdef and p.proname <> 'public_campaign_status';
  perform pg_temp.check('17', n = 0, 'finance_api SECURITY DEFINER functions beyond the D-088 carve-out: ' || n || ' ' || f);
  perform pg_temp.check('17', not has_schema_privilege('anon', 'finance', 'USAGE'), 'anon holds no USAGE on schema finance');
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('finance','finance_api') and p.proname in ('issue_payment_link','record_v2_stripe_payment') and p.pronargdefaults = 1;
  perform pg_temp.check('17', n = 4, 'issue_payment_link and record_v2_stripe_payment carry one defaulted parameter in both schemas (' || n || ' of 4)');
  perform pg_temp.check('17', to_regprocedure('finance.record_v2_stripe_payment(uuid,bigint,text,text,timestamptz,boolean,text)') is null,
    'the seven-argument record_v2_stripe_payment is gone');
  perform pg_temp.check('17', pg_get_indexdef('finance.checkout_sessions_live_uq'::regclass) =
    'CREATE UNIQUE INDEX checkout_sessions_live_uq ON finance.checkout_sessions USING btree (agreement_id, livemode) WHERE (status = ANY (ARRAY[''creating''::finance.checkout_status, ''open''::finance.checkout_status]))',
    'checkout_sessions_live_uq is the PR 1 definition');
end $$;

-- ── 16: configuration is founder-only ────────────────────────────────────────

do $$
declare c pr10e_ctx%rowtype; n int; got text; r record;
begin
  select * into c from pr10e_ctx;
  select count(*) into n from finance.fee_settings;
  perform pg_temp.check('16', n = 1 and (select fee_enabled from finance.fee_settings) = false,
    'fee_settings holds exactly ' || n || ' row, fee_enabled = false');
  perform pg_temp.expect('16', 'insert into finance.fee_settings (id) values (true)', '23505', '%', 'a second row with id = true is rejected');
  perform pg_temp.expect('16', 'insert into finance.fee_settings (id) values (false)', '23514', '%fee_settings_singleton%', 'a second row with id = false is rejected');
  select count(*) into n from pg_class cl cross join lateral aclexplode(coalesce(cl.relacl, acldefault('r', cl.relowner))) a
   where cl.oid = 'finance.fee_settings'::regclass and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  perform pg_temp.check('16', n = 0, 'anon/PUBLIC privileges on finance.fee_settings: ' || n);
  perform pg_temp.check('16', not has_table_privilege('anon', 'finance_api.fee_settings', 'SELECT'), 'anon cannot read finance_api.fee_settings');
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname in ('finance','finance_api') and p.proname = 'set_fee_settings'
     and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  perform pg_temp.check('16', n = 0, 'anon/PUBLIC EXECUTE on set_fee_settings: ' || n);
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'finance' and table_name = 'fee_settings'
     and grantee in ('anon','authenticated','service_role') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  perform pg_temp.check('16', n = 0, 'write grants on finance.fee_settings to application roles: ' || n);

  -- A non-founder authenticated caller.
  begin
    perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
    execute 'set local role authenticated';
    execute 'select * from finance_api.set_fee_settings(true, 290, 30, ''stripe-standard-v1'')';
    got := 'succeeded';
  exception when others then
    got := sqlstate || ': ' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', c.founder_id::text, true);
  perform pg_temp.check('16', got like '%founder role required%', 'non-founder authenticated caller: ' || got);
  -- service_role: no EXECUTE at all — the grant boundary refuses before the founder gate can.
  begin
    execute 'set local role service_role';
    execute 'select * from finance_api.set_fee_settings(true, 290, 30, ''stripe-standard-v1'')';
    got := 'succeeded';
  exception when others then
    got := sqlstate || ': ' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', c.founder_id::text, true);
  perform pg_temp.check('16', got not like 'succeeded' and got like '%permission denied%'
      and not has_function_privilege('service_role', 'finance_api.set_fee_settings(boolean,integer,integer,text)', 'EXECUTE')
      and not has_function_privilege('service_role', 'finance.set_fee_settings(boolean,integer,integer,text)', 'EXECUTE'),
    'service_role caller refused at the grant boundary, no EXECUTE in either schema: ' || got);
  perform pg_temp.check('16', (select fee_enabled from finance.fee_settings) = false, 'fee_enabled still false after both refusals');
  perform pg_temp.expect('16', 'select * from finance_api.set_fee_settings(true, 10000, 30, ''v'')', 'VK400', '%fee bps%out of range%', 'founder: bps 10000 refused');
  perform pg_temp.expect('16', 'select * from finance_api.set_fee_settings(true, 290, -1, ''v'')', 'VK400', '%fixed fee%out of range%', 'founder: fixed -1 refused');
  perform pg_temp.expect('16', 'select * from finance_api.set_fee_settings(true, 290, 30, ''  '')', 'VK400', '%policy version%', 'founder: blank policy version refused');
end $$;

-- ── 1: fee OFF is byte-for-byte today ────────────────────────────────────────

do $$
declare c pr10e_ctx%rowtype; r record; l record; a record; s record; e record; v_id uuid;
begin
  select * into c from pr10e_ctx;
  select * into r from finance_api.issue_payment_link(c.agreement_off, pg_temp.hash('off'), 'PR 10E proof: fee off', 1000000);
  update pr10e_ctx set link_off = r.link_id;
  select * into l from finance.payment_links where id = r.link_id;
  perform pg_temp.check('1', l.fee_bps is null and l.fee_fixed_cents is null and l.fee_policy_version is null,
    'issue_payment_link with fee_enabled = false writes fee_bps, fee_fixed_cents, fee_policy_version all NULL');
  perform pg_temp.check('1', r.amount_cents = 1000000 and r.processing_fee_cents = 0 and r.total_cents = 1000000,
    'returned amount ' || r.amount_cents || ', processing_fee_cents ' || r.processing_fee_cents || ', total_cents ' || r.total_cents);
  perform finance.claim_payment_link(pg_temp.hash('off'));   -- phase 1, as startCheckout does
  select * into a from finance.begin_checkout_attempt(r.link_id, c.agreement_off, 1000000, true);
  update pr10e_ctx set attempt_off = a.attempt_id;
  select * into s from finance.checkout_sessions where id = a.attempt_id;
  perform pg_temp.check('1', s.amount_cents = 1000000 and s.processing_fee_cents = 0 and s.contribution_cents = 1000000 and s.fee_policy_version is null,
    'Session amount_cents ' || s.amount_cents || ', processing_fee_cents ' || s.processing_fee_cents || ', contribution_cents ' || s.contribution_cents);
  perform pg_temp.check('1', a.charge_amount_cents = 1000000 and a.contribution_cents = 1000000 and a.processing_fee_cents = 0,
    'begin_checkout_attempt returned charge ' || a.charge_amount_cents || ' = contribution (Stripe unit_amount = charge_amount_cents is pinned in checkout.test.ts)');
  v_id := finance.record_v2_stripe_payment(c.agreement_off, 1000000, 'ch_pr10e_off', 'pi_pr10e_off', clock_timestamp(), true, null, a.attempt_id);
  update pr10e_ctx set ledger_off = v_id;
  select * into e from finance.ledger_entries where id = v_id;
  perform pg_temp.check('1', e.amount_cents = 1000000 and e.processing_fee_cents = 0,
    'ledger stripe_payment amount_cents ' || e.amount_cents || ', processing_fee_cents ' || e.processing_fee_cents);
end $$;

-- ── 14: ledger column integrity (uses the fee-off payment as a parent) ───────

do $$
declare c pr10e_ctx%rowtype; before bigint; got text;
begin
  select * into c from pr10e_ctx;
  before := pg_temp.ledger_rows(c.agreement_off);
  perform pg_temp.expect('14',
    format($q$insert into finance.ledger_entries (agreement_id, entry_type, amount_cents, currency, source, external_method,
              occurred_at, recorded_by, reason, livemode, processing_fee_cents)
            values (%L, 'external_payment', 100, 'usd', 'external', 'check', clock_timestamp(), %L, 'PR 10E proof', true, 1)$q$,
           c.agreement_off, c.founder_id),
    '23514', '%ledger_fee_only_on_stripe_payment%', 'external_payment (source external) with a fee is rejected');
  perform pg_temp.expect('14',
    format($q$insert into finance.ledger_entries (agreement_id, entry_type, amount_cents, currency, source, provider_object_id,
              provider_payment_intent_id, parent_entry_id, occurred_at, recorded_by_system, livemode, processing_fee_cents)
            values (%L, 'refund', -100, 'usd', 'stripe', 're_pr10e_bad', 'pi_pr10e_off', %L, clock_timestamp(), 'reconciliation', true, 1)$q$,
           c.agreement_off, c.ledger_off),
    '23514', '%ledger_fee_only_on_stripe_payment%', 'refund with a fee is rejected');
  perform pg_temp.expect('14',
    format($q$insert into finance.ledger_entries (agreement_id, entry_type, amount_cents, currency, source,
              parent_entry_id, occurred_at, recorded_by, reason, livemode, processing_fee_cents)
            values (%L, 'reversal', -1000000, 'usd', 'stripe', %L, clock_timestamp(), %L, 'PR 10E proof', true, 1)$q$,
           c.agreement_off, c.ledger_off, c.founder_id),
    '23514', '%ledger_fee_only_on_stripe_payment%', 'reversal with a fee is rejected');
  perform pg_temp.expect('14',
    format($q$insert into finance.ledger_entries (agreement_id, entry_type, amount_cents, currency, source, provider_object_id,
              provider_payment_intent_id, occurred_at, recorded_by_system, livemode, processing_fee_cents)
            values (%L, 'stripe_payment', 100, 'usd', 'stripe', 'ch_pr10e_neg', 'pi_pr10e_neg', clock_timestamp(), 'reconciliation', true, -1)$q$,
           c.agreement_off),
    '23514', '%ledger_fee_nonnegative%', 'a negative processing_fee_cents is rejected');
  perform pg_temp.check('14', pg_temp.ledger_rows(c.agreement_off) = before, 'zero rows inserted by the four refusals');
  -- Append-only holds for both application roles, fee column or not.
  begin
    execute 'set local role service_role';
    execute format('update finance.ledger_entries set processing_fee_cents = 1 where id = %L', c.ledger_off);
    got := 'succeeded';
  exception when others then got := sqlstate || ': ' || sqlerrm; end;
  execute 'reset role';
  perform pg_temp.check('14', got <> 'succeeded', 'service_role UPDATE of processing_fee_cents refused: ' || got);
  begin
    execute 'set local role service_role';
    execute format('delete from finance.ledger_entries where id = %L', c.ledger_off);
    got := 'succeeded';
  exception when others then got := sqlstate || ': ' || sqlerrm; end;
  execute 'reset role';
  perform pg_temp.check('14', got <> 'succeeded', 'service_role DELETE refused: ' || got);
  begin
    execute 'set local role authenticated';
    execute format('update finance.ledger_entries set processing_fee_cents = 1 where id = %L', c.ledger_off);
    got := 'succeeded';
  exception when others then got := sqlstate || ': ' || sqlerrm; end;
  execute 'reset role';
  perform pg_temp.check('14', got <> 'succeeded', 'authenticated UPDATE refused: ' || got);
  begin
    execute 'set local role authenticated';
    execute format('delete from finance.ledger_entries where id = %L', c.ledger_off);
    got := 'succeeded';
  exception when others then got := sqlstate || ': ' || sqlerrm; end;
  execute 'reset role';
  perform pg_temp.check('14', got <> 'succeeded', 'authenticated DELETE refused: ' || got);
  perform set_config('request.jwt.claim.sub', c.founder_id::text, true);
end $$;

-- ── The founder turns the fee on (rollout step 3), then 2 ────────────────────

do $$
declare c pr10e_ctx%rowtype; r record; n int; p record; a record; s record; e record; v_id uuid;
begin
  select * into c from pr10e_ctx;
  select * into r from finance_api.set_fee_settings(true, 290, 30, 'stripe-standard-v1');
  perform pg_temp.check('16', r.fee_enabled and r.fee_bps = 290 and r.fee_fixed_cents = 30 and r.fee_policy_version = 'stripe-standard-v1'
      and (select updated_by from finance.fee_settings) = c.founder_id,
    'founder set_fee_settings(true, 290, 30, stripe-standard-v1): applied, updated_by = auth.uid()');
  select count(*) into n from finance.payment_links where fee_policy_version is not null;
  perform pg_temp.check('2', n = 0, 'links carrying a snapshot after the flip and before the first post-flip issuance: ' || n || ' (no repricing, no backfill)');
  select * into p from finance_api.peek_payment_link(pg_temp.hash('pre'));
  perform pg_temp.check('2', p.link_fee_policy_version is null and p.link_fee_bps is null and p.link_fee_fixed_cents is null
      and p.link_amount_cents is null and p.payable_remaining_cents = 1000000,
    'peek of the pre-migration link: snapshot NULL, link_amount_cents NULL (full remaining), payable ' || p.payable_remaining_cents
    || ' (bridge renders the single figure: checkout.test.ts)');
  perform finance.claim_payment_link(pg_temp.hash('pre'));   -- phase 1
  select * into a from finance.begin_checkout_attempt(c.link_pre, c.agreement_pre, 1000000, true);
  update pr10e_ctx set attempt_pre = a.attempt_id;
  select * into s from finance.checkout_sessions where id = a.attempt_id;
  perform pg_temp.check('2', a.charge_amount_cents = 1000000 and a.processing_fee_cents = 0 and a.contribution_cents = 1000000
      and s.amount_cents = 1000000 and s.processing_fee_cents = 0 and s.fee_policy_version is null,
    'pre-migration link redeemed with fee_enabled = true charges exactly ' || s.amount_cents || ', processing_fee_cents ' || s.processing_fee_cents);
  v_id := finance.record_v2_stripe_payment(c.agreement_pre, 1000000, 'ch_pr10e_pre', 'pi_pr10e_pre', clock_timestamp(), true, null, a.attempt_id);
  select * into e from finance.ledger_entries where id = v_id;
  perform pg_temp.check('2', e.amount_cents = 1000000 and e.processing_fee_cents = 0,
    'its ledger entry: amount_cents ' || e.amount_cents || ', processing_fee_cents ' || e.processing_fee_cents);
  select count(*) into n from finance.payment_links
   where id = c.link_pre and fee_policy_version is null and fee_bps is null and fee_fixed_cents is null and amount_cents is null;
  perform pg_temp.check('2', n = 1, 'the pre-migration link row''s figure and snapshot columns were never written (only its claim status moved, as in any checkout)');
end $$;

-- ── 5 then 3: the cap is on the contribution; fee on, end to end ─────────────

do $$
declare c pr10e_ctx%rowtype; r record; l record; a record; s record; before bigint;
begin
  select * into c from pr10e_ctx;
  before := (select count(*) from finance.payment_links where agreement_id = c.agreement_fee);
  perform pg_temp.expect('5',
    format('select * from finance_api.issue_payment_link(%L, %L, %L, 1000001)', c.agreement_fee, pg_temp.hash('cap'), 'PR 10E proof: over cap'),
    'VK409', '%amount 1000001 exceeds payable remaining 1000000%', 'p_amount_cents = 1000001 on payable 1000000');
  perform pg_temp.check('5', (select count(*) from finance.payment_links where agreement_id = c.agreement_fee) = before, 'zero rows inserted');
  select * into r from finance_api.issue_payment_link(c.agreement_fee, pg_temp.hash('fee'), 'PR 10E proof: fee on', 1000000);
  update pr10e_ctx set link_fee = r.link_id;
  select * into l from finance.payment_links where id = r.link_id;
  perform pg_temp.check('3', l.fee_bps = 290 and l.fee_fixed_cents = 30 and l.fee_policy_version = 'stripe-standard-v1',
    'link carries (' || l.fee_bps || ', ' || l.fee_fixed_cents || ', ' || l.fee_policy_version || ')');
  perform pg_temp.check('3', r.amount_cents = 1000000 and r.processing_fee_cents = 29898 and r.total_cents = 1029898,
    'issue_payment_link returned amount ' || r.amount_cents || ', processing_fee_cents ' || r.processing_fee_cents || ', total_cents ' || r.total_cents);
  perform finance.claim_payment_link(pg_temp.hash('fee'));   -- phase 1
  select * into a from finance.begin_checkout_attempt(r.link_id, c.agreement_fee, 1000000, true);
  update pr10e_ctx set attempt_fee = a.attempt_id;
  perform pg_temp.check('3', a.charge_amount_cents = 1029898 and a.contribution_cents = 1000000 and a.processing_fee_cents = 29898,
    'begin_checkout_attempt returned charge_amount_cents ' || a.charge_amount_cents || ', contribution_cents ' || a.contribution_cents
    || ', processing_fee_cents ' || a.processing_fee_cents);
  select * into s from finance.checkout_sessions where id = a.attempt_id;
  perform pg_temp.check('5', s.amount_cents = 1029898 and s.contribution_cents = 1000000 and s.processing_fee_cents = 29898
      and s.fee_policy_version = 'stripe-standard-v1',
    'p_amount_cents = 1000000 on payable 1000000 produced a Session of ' || s.amount_cents
    || ' (contribution ' || s.contribution_cents || ' + fee ' || s.processing_fee_cents || ')');
  perform pg_temp.expect('5',
    format('select * from finance.begin_checkout_attempt(%L, %L, 1029898, true)', r.link_id, c.agreement_fee),
    'VK409', '%exceeds payable remaining%', 'the TOTAL offered as the contribution is refused by the cap (the cap never sees a total)');
end $$;

-- ── 13 (database half): what the bridge compares ─────────────────────────────

do $$
declare c pr10e_ctx%rowtype; p record;
begin
  select * into c from pr10e_ctx;
  perform finance.finalize_checkout_session(c.attempt_fee, 'cs_pr10e_fee', null);
  select * into p from finance_api.peek_payment_link(pg_temp.hash('fee'));
  perform pg_temp.check('13', p.link_status = 'consumed' and p.session_status = 'open'
      and p.session_amount_cents = 1029898 and p.session_contribution_cents = 1000000 and p.session_processing_fee_cents = 29898
      and p.payable_remaining_cents = 1000000,
    'fee-bearing open Session: session_amount_cents ' || p.session_amount_cents || ' > payable ' || p.payable_remaining_cents
    || ' but session_contribution_cents ' || p.session_contribution_cents || ' = payable (resolveTokenState -> open_session, not review: checkout.test.ts)');
  perform pg_temp.check('12', p.link_fee_bps = 290 and p.link_fee_fixed_cents = 30 and p.link_fee_policy_version = 'stripe-standard-v1',
    'peek returns the link snapshot for the bridge''s three-line summary (markup pinned in checkout.test.ts)');
end $$;

-- ── 3 (ledger), 4 (balances), 9, 10 ──────────────────────────────────────────

do $$
declare c pr10e_ctx%rowtype; v_id uuid; v_again uuid; e record; b record; n int; before bigint; s record;
begin
  select * into c from pr10e_ctx;
  -- 9: refusals first, so "nothing written" is provable.
  before := pg_temp.ledger_rows(c.agreement_fee);
  perform pg_temp.expect('9',
    format('select finance.record_v2_stripe_payment(%L, 1029897, ''ch_pr10e_fee'', ''pi_pr10e_fee'', clock_timestamp(), true, null, %L)', c.agreement_fee, c.attempt_fee),
    'VK409', '%provider amount 1029897 does not equal the attempt charge 1029898%', 'session.amount_cents <> p_amount_cents');
  perform pg_temp.expect('9',
    format('select finance.record_v2_stripe_payment(%L, 1029898, ''ch_pr10e_fee'', ''pi_pr10e_fee'', clock_timestamp(), true, null, %L)', c.agreement_off, c.attempt_fee),
    'VK409', '%belongs to another agreement%', 'session of another agreement');
  perform pg_temp.expect('9',
    format('select finance.record_v2_stripe_payment(%L, 1029898, ''ch_pr10e_fee'', ''pi_pr10e_fee'', clock_timestamp(), true, null, %L)', c.agreement_fee, gen_random_uuid()),
    'VK404', '%does not exist%', 'unknown attempt id');
  perform pg_temp.check('9', pg_temp.ledger_rows(c.agreement_fee) = before and pg_temp.ledger_rows(c.agreement_off) = 1,
    'nothing written by the three refusals');
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname in ('finance','finance_api') and p.proname = 'record_v2_stripe_payment'
     and pg_get_function_arguments(p.oid) ilike '%fee%';
  perform pg_temp.check('9', n = 0, 'no record_v2_stripe_payment parameter names a fee: a forged processing_fee_cents cannot be supplied');

  -- 3: the payment, split from OUR attempt row.
  v_id := finance.record_v2_stripe_payment(c.agreement_fee, 1029898, 'ch_pr10e_fee', 'pi_pr10e_fee', clock_timestamp(), true, null, c.attempt_fee);
  update pr10e_ctx set ledger_fee = v_id;
  select * into e from finance.ledger_entries where id = v_id;
  select count(*) into n from finance.ledger_entries where agreement_id = c.agreement_fee and entry_type = 'stripe_payment';
  perform pg_temp.check('3', n = 1 and e.amount_cents = 1000000 and e.processing_fee_cents = 29898 and e.source = 'stripe',
    'exactly ' || n || ' stripe_payment: amount_cents ' || e.amount_cents || ', processing_fee_cents ' || e.processing_fee_cents);

  -- 4: balances untouched by the fee.
  select * into b from finance.v_agreement_balances where agreement_id = c.agreement_fee;
  perform pg_temp.check('4', b.contribution_cents = 1000000 and b.gross_received_cents = 1000000 and b.remaining_cents = 0
      and b.payable_remaining_cents = 0 and b.payment_state = 'paid',
    'contribution ' || b.contribution_cents || ', gross_received ' || b.gross_received_cents || ', remaining ' || b.remaining_cents
    || ', payable_remaining ' || b.payable_remaining_cents || ', payment_state ' || b.payment_state);

  -- 10: a duplicate delivery returns the same id and creates nothing.
  before := pg_temp.ledger_rows(c.agreement_fee);
  v_again := finance.record_v2_stripe_payment(c.agreement_fee, 1029898, 'ch_pr10e_fee', 'pi_pr10e_fee', clock_timestamp(), true, null, c.attempt_fee);
  select coalesce(sum(processing_fee_cents), 0) into n from finance.ledger_entries where agreement_id = c.agreement_fee;
  perform pg_temp.check('10', v_again = v_id and pg_temp.ledger_rows(c.agreement_fee) = before and n = 29898,
    'duplicate payment_intent.succeeded: same ledger id, ' || before || ' row(s), total fee recorded ' || n);
  -- 9 (NULL attempt): today's behaviour exactly.
  v_id := finance.record_v2_stripe_payment(c.agreement_fee, 555, 'ch_pr10e_null', 'pi_pr10e_null', clock_timestamp(), false, null);
  select * into e from finance.ledger_entries where id = v_id;
  perform pg_temp.check('9', e.amount_cents = 555 and e.processing_fee_cents = 0,
    'p_attempt_id omitted: whole amount is contribution (' || e.amount_cents || '), fee ' || e.processing_fee_cents || ' (test mode, outside the live balance)');
end $$;

-- ── 15: the known limitation fails closed ────────────────────────────────────

do $$
declare c pr10e_ctx%rowtype; before bigint; v_id uuid; b record;
begin
  select * into c from pr10e_ctx;
  before := pg_temp.ledger_rows(c.agreement_fee);
  perform pg_temp.expect('15',
    format('select finance_api.record_ledger_entry(%L, ''refund'', -1029898, ''re_pr10e_full'', ''pi_pr10e_fee'', %L, clock_timestamp(), true)', c.agreement_fee, c.ledger_fee),
    null, '%L7: cumulative refunds 1029898 exceed settled amount 1000000%',
    'refund of the full charged 1029898 raises the L7 headroom error');
  perform pg_temp.check('15', pg_temp.ledger_rows(c.agreement_fee) = before,
    'nothing written (the worker records the failure as a failed event; reconciliation raises the exception)');
  v_id := finance_api.record_ledger_entry(c.agreement_fee, 'refund', -1000000, 're_pr10e_contribution', 'pi_pr10e_fee', c.ledger_fee, clock_timestamp(), true);
  select * into b from finance.v_agreement_balances where agreement_id = c.agreement_fee;
  perform pg_temp.check('15', v_id is not null and b.net_received_cents = 0 and b.refunded_cents = 1000000 and b.payment_state = 'refunded'
      and b.gross_received_cents = 1000000,
    'refund of the contribution 1000000 succeeds: net_received ' || b.net_received_cents || ', refunded ' || b.refunded_cents
    || ', payment_state ' || b.payment_state || ' — no balance misstated');
end $$;

-- ── Summary — ALWAYS raises, so this transaction can only roll back ──────────

do $$
declare n_pass int; n_fail int; f record; failed text := '';
begin
  select count(*) filter (where ok), count(*) filter (where not ok) into n_pass, n_fail from pr10e_proof;
  raise notice '────────────────────────────────────────────────────────────';
  raise notice 'PR 10E proof: % checks passed, % failed', n_pass, n_fail;
  for f in select criterion, detail from pr10e_proof where not ok order by seq loop
    raise notice '  FAILED criterion %: %', f.criterion, f.detail;
    failed := failed || ' [' || f.criterion || '] ' || f.detail;
  end loop;
  raise notice 'Rolling back: the migration DDL and every row this script created are discarded.';
  raise exception 'PR 10E proof complete — summary: % passed, % failed%. This exception is deliberate: it rolls the migration and the proof back.',
    n_pass, n_fail, case when n_fail > 0 then '; FAILED:' || failed else '' end;
end $$;

-- Never reached (the block above always raises); kept so intent is explicit.
rollback;
