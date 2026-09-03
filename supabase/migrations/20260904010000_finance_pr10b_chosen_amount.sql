-- Financials V2 — PR 10B (D-090): a founder-chosen collection amount.
--
-- The Contribution is the agreement and does not change because of how it is
-- paid. The founder may issue a payment link for a chosen amount — integer
-- cents, strictly positive, no greater than the agreement's current
-- payable_remaining_cents — validated here at issuance and again by
-- begin_checkout_attempt at Session creation, both against the live view under
-- the agreement lock. NULL keeps today's meaning exactly: the full payable
-- remaining, read at Session time. The figure is an instruction the founder
-- gave, in the same class as `reason`; it is never summed into any balance.
--
-- One overload, not two: CREATE OR REPLACE with a new parameter list would
-- leave f(uuid,text,text) beside f(uuid,text,text,bigint DEFAULT NULL) and make
-- a three-argument call ambiguous, so the three-argument signatures are dropped
-- here in both schemas and the defaulted fourth parameter covers the old call.
-- A newly created function defaults to PUBLIC EXECUTE, so every new signature
-- is REVOKEd from public before it is granted. Additive only; rows affected 0.
-- Apply before the code deploys: the old route omits the argument and keeps
-- working against the defaulted function.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. The chosen amount lives on the link. NULL = the full payable remaining.
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.payment_links
  add column amount_cents bigint null
  constraint payment_links_amount_cents_positive check (amount_cents is null or amount_cents > 0);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. issue_payment_link: one signature, defaulted fourth parameter
-- ─────────────────────────────────────────────────────────────────────────────

drop function finance_api.issue_payment_link(uuid, text, text);
drop function finance.issue_payment_link(uuid, text, text);

create function finance.issue_payment_link(
  p_agreement_id uuid, p_token_hash text, p_reason text, p_amount_cents bigint default null
) returns table (link_id uuid, amount_cents bigint, expires_at timestamptz)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare
  v_bal finance.v_agreement_balances%rowtype;
  v_status finance.agreement_lifecycle;
  v_id uuid; v_exp timestamptz;
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
  v_exp := clock_timestamp() + interval '7 days';
  insert into finance.payment_links (agreement_id, token_hash, status, expires_at, created_by, reason, amount_cents)
  values (p_agreement_id, p_token_hash, 'active', v_exp, auth.uid(), p_reason, p_amount_cents)
  returning id into v_id;
  return query select v_id, coalesce(p_amount_cents, v_bal.payable_remaining_cents), v_exp;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. begin_checkout_attempt: the cap moves into the database (signature unchanged)
-- ─────────────────────────────────────────────────────────────────────────────

-- Until now this validated only > 0 and the "amount recalculated server-side"
-- guarantee rested on startCheckout alone. It is now the authoritative backstop:
-- lock the agreement, read the live view, and refuse — never clamp — an amount
-- that exceeds what is owed or differs from the figure the link was issued for.
-- The member-portal functions insert their attempt rows directly and never call
-- this, so they are untouched.
create or replace function finance.begin_checkout_attempt(
  p_link_id uuid, p_agreement_id uuid, p_amount_cents bigint, p_livemode boolean
) returns table (attempt_id uuid, idempotency_key text)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare
  v_id uuid := gen_random_uuid();
  v_bal finance.v_agreement_balances%rowtype;
  v_link_amount bigint;
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
    select l.amount_cents into v_link_amount from finance.payment_links l
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
  insert into finance.checkout_sessions
    (id, agreement_id, payment_link_id, amount_cents, currency, livemode, status,
     idempotency_key, expires_at)
  values (v_id, p_agreement_id, p_link_id, p_amount_cents, 'usd', p_livemode, 'creating',
          'vk2_checkout_' || v_id::text, clock_timestamp() + interval '7 days');
  return query select v_id, 'vk2_checkout_' || v_id::text;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. peek_payment_link: one trailing column, the link's own figure
-- ─────────────────────────────────────────────────────────────────────────────

-- A return-type change requires drop-and-create. Both are service_role-only and
-- read-only; resolveTokenState reads link_amount_cents beside the live
-- payable_remaining_cents and refuses (review) when the link's figure exceeds it.
drop function finance_api.peek_payment_link(text);
drop function finance.peek_payment_link(text);

create function finance.peek_payment_link(p_token_hash text)
returns table (
  link_id uuid, agreement_id uuid, link_status text, link_expires_at timestamptz,
  session_id uuid, session_status text, stripe_session_id text,
  session_amount_cents bigint, payable_remaining_cents bigint, payment_state text,
  link_amount_cents bigint
)
language sql stable security definer set search_path = pg_catalog, public, finance
as $$
  select l.id, l.agreement_id, l.status::text, l.expires_at,
         cs.id, cs.status::text, cs.stripe_session_id, cs.amount_cents,
         b.payable_remaining_cents, b.payment_state::text,
         l.amount_cents
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
  link_amount_cents bigint
) language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.peek_payment_link(p_token_hash); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. The founder view and the façade wrapper
-- ─────────────────────────────────────────────────────────────────────────────

-- Same column list plus amount_cents appended: the link strip must show what a
-- live link is for before the founder revokes it.
create or replace view finance_api.payment_links with (security_invoker = true) as
  select id, agreement_id, status, expires_at, claimed_at, consumed_at,
         consumed_by_session_id, revoked_at, attempt_count, created_at, reason,
         amount_cents
    from finance.payment_links;
grant select on finance_api.payment_links to authenticated, service_role;

create function finance_api.issue_payment_link(
  p_agreement_id uuid, p_token_hash text, p_reason text, p_amount_cents bigint default null
) returns table (link_id uuid, amount_cents bigint, expires_at timestamptz)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.issue_payment_link(p_agreement_id, p_token_hash, p_reason, p_amount_cents); $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Grants on every new signature. begin_checkout_attempt kept its signature
--    and therefore its grants.
-- ─────────────────────────────────────────────────────────────────────────────

revoke all on function finance.issue_payment_link(uuid, text, text, bigint) from public;
grant execute on function finance.issue_payment_link(uuid, text, text, bigint) to authenticated;
revoke all on function finance.peek_payment_link(text) from public;
grant execute on function finance.peek_payment_link(text) to service_role;

revoke all on function finance_api.issue_payment_link(uuid, text, text, bigint) from public;
grant execute on function finance_api.issue_payment_link(uuid, text, text, bigint) to authenticated;
revoke all on function finance_api.peek_payment_link(text) from public;
grant execute on function finance_api.peek_payment_link(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Assertions: the PR 6 block, then the 10B-specific facts
-- ─────────────────────────────────────────────────────────────────────────────

-- The PR 6 block, with one settled exception: D-088 (20260823020000) made
-- finance_api.public_campaign_status the ONE SECURITY DEFINER function anon may
-- execute — the public /support status probe — and carved it out of its own
-- assertions by name. The verbatim PR 6 counts would fail on that function
-- alone, so the same carve-out applies here; every other count is unchanged.
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

do $chk10b$
declare n integer; v_def text;
begin
  -- The column exists, nullable, with the named CHECK.
  select count(*) into n from pg_attribute
   where attrelid = 'finance.payment_links'::regclass and attname = 'amount_cents'
     and not attisdropped and not attnotnull;
  if n <> 1 then raise exception 'payment_links.amount_cents missing or NOT NULL'; end if;
  select count(*) into n from pg_constraint
   where conrelid = 'finance.payment_links'::regclass
     and conname = 'payment_links_amount_cents_positive' and contype = 'c';
  if n <> 1 then raise exception 'payment_links_amount_cents_positive CHECK missing'; end if;

  -- Exactly one issue_payment_link per schema, with the one defaulted parameter.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname in ('finance','finance_api') and p.proname = 'issue_payment_link';
  if n <> 2 then raise exception '% issue_payment_link overloads across both schemas, expected 2', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname in ('finance','finance_api') and p.proname = 'issue_payment_link'
     and p.pronargdefaults = 1;
  if n <> 2 then raise exception 'issue_payment_link without pronargdefaults = 1'; end if;

  -- The single-flight index is untouched: its definition is the PR 1 text.
  select pg_get_indexdef('finance.checkout_sessions_live_uq'::regclass) into v_def;
  if v_def <> 'CREATE UNIQUE INDEX checkout_sessions_live_uq ON finance.checkout_sessions USING btree (agreement_id, livemode) WHERE (status = ANY (ARRAY[''creating''::finance.checkout_status, ''open''::finance.checkout_status]))' then
    raise exception 'checkout_sessions_live_uq changed: %', v_def;
  end if;

  -- No PUBLIC or anon EXECUTE on any signature created here, in either schema.
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname in ('finance','finance_api')
     and p.proname in ('issue_payment_link','peek_payment_link')
     and a.privilege_type='EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if n <> 0 then raise exception 'anon/PUBLIC EXECUTE on % new 10B fn(s)', n; end if;
  if has_function_privilege('service_role', 'finance_api.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE') then
    raise exception 'service_role EXECUTE on finance_api.issue_payment_link';
  end if;
  if has_function_privilege('authenticated', 'finance_api.peek_payment_link(text)', 'EXECUTE') then
    raise exception 'authenticated EXECUTE on finance_api.peek_payment_link';
  end if;
end $chk10b$;

commit;
