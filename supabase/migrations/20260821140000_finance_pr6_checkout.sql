-- Financials V2 — PR 6: the checkout protocol mutation surface.
-- Applied to production 2026-08-21 and stamped; this file records it.
--
-- Design: PR6_BUILD_SPEC §8. Founder functions authorize via is_founder() and
-- derive auth.uid() internally; machine functions are EXECUTE-only for
-- service_role; every finance_api member is SECURITY INVOKER; both protocol
-- tables remain SELECT-only for API roles, so these functions are the ONLY
-- write path. The single-flight index (agreement_id, livemode) WHERE
-- creating/open and the unique idempotency_key are what make a second payable
-- Session unrepresentable.

alter table finance.payment_links add column if not exists reason text;

create or replace function finance.issue_payment_link(
  p_agreement_id uuid, p_token_hash text, p_reason text
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
  -- The CANONICAL amount, computed here from the live view at creation time.
  -- Never accepted as input (behavioral proof #1).
  select * into v_bal from finance.v_agreement_balances b where b.agreement_id = p_agreement_id;
  if v_bal.payable_remaining_cents is null or v_bal.payable_remaining_cents <= 0 then
    raise exception 'issue_payment_link: nothing remains to collect' using errcode='VK409';
  end if;
  if exists (select 1 from finance.payment_links l
              where l.agreement_id = p_agreement_id and l.status in ('active','creating')
                and l.expires_at > clock_timestamp()) then
    raise exception 'issue_payment_link: a live link already exists; revoke it first' using errcode='VK409';
  end if;
  v_exp := clock_timestamp() + interval '7 days';
  insert into finance.payment_links (agreement_id, token_hash, status, expires_at, created_by, reason)
  values (p_agreement_id, p_token_hash, 'active', v_exp, auth.uid(), p_reason)
  returning id into v_id;
  return query select v_id, v_bal.payable_remaining_cents, v_exp;
end $fn$;

create or replace function finance.claim_payment_link(p_token_hash text)
returns table (link_id uuid, agreement_id uuid)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare l finance.payment_links%rowtype;
begin
  select * into l from finance.payment_links pl where pl.token_hash = p_token_hash for update;
  if not found then raise exception 'claim_payment_link: unknown token' using errcode='VK404'; end if;
  if l.status <> 'active' then
    raise exception 'claim_payment_link: link is %', l.status using errcode='VK409';
  end if;
  if l.expires_at <= clock_timestamp() then
    raise exception 'claim_payment_link: link expired' using errcode='VK410';
  end if;
  update finance.payment_links
     set status='creating', claimed_at=clock_timestamp(), attempt_count=attempt_count+1
   where id = l.id;
  return query select l.id, l.agreement_id;
end $fn$;

-- The idempotency key derives from the row's own id, so it exists before any
-- Stripe call and a sweeper can replay phase 3 with the identical key from the
-- row alone (no chicken-and-egg between attempt id and key).
create or replace function finance.begin_checkout_attempt(
  p_link_id uuid, p_agreement_id uuid, p_amount_cents bigint, p_livemode boolean
) returns table (attempt_id uuid, idempotency_key text)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare v_id uuid := gen_random_uuid();
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'begin_checkout_attempt: amount must be positive' using errcode='VK400';
  end if;
  insert into finance.checkout_sessions
    (id, agreement_id, payment_link_id, amount_cents, currency, livemode, status,
     idempotency_key, expires_at)
  values (v_id, p_agreement_id, p_link_id, p_amount_cents, 'usd', p_livemode, 'creating',
          'vk2_checkout_' || v_id::text, clock_timestamp() + interval '7 days');
  return query select v_id, 'vk2_checkout_' || v_id::text;
end $fn$;

create or replace function finance.finalize_checkout_session(
  p_attempt_id uuid, p_stripe_session_id text, p_expires_at timestamptz
) returns void
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare cs finance.checkout_sessions%rowtype;
begin
  select * into cs from finance.checkout_sessions where id = p_attempt_id for update;
  if not found then raise exception 'finalize: attempt % not found', p_attempt_id using errcode='VK404'; end if;
  if cs.status <> 'creating' then
    raise exception 'finalize: attempt is %, expected creating', cs.status using errcode='VK409';
  end if;
  if p_stripe_session_id is null or p_stripe_session_id = '' then
    raise exception 'finalize: stripe session id required' using errcode='VK400';
  end if;
  update finance.checkout_sessions
     set status='open', stripe_session_id=p_stripe_session_id,
         expires_at = coalesce(p_expires_at, expires_at)
   where id = p_attempt_id;
  if cs.payment_link_id is not null then
    update finance.payment_links
       set status='consumed', consumed_at=clock_timestamp(), consumed_by_session_id=p_attempt_id
     where id = cs.payment_link_id and status = 'creating';
  end if;
end $fn$;

create or replace function finance.transition_checkout_session(
  p_attempt_id uuid, p_to_status text
) returns void
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare cs finance.checkout_sessions%rowtype;
begin
  if p_to_status not in ('completed','expired','canceled') then
    raise exception 'transition_checkout_session: illegal target %', p_to_status using errcode='VK400';
  end if;
  select * into cs from finance.checkout_sessions where id = p_attempt_id for update;
  if not found then raise exception 'transition: attempt % not found', p_attempt_id using errcode='VK404'; end if;
  if cs.status = p_to_status::finance.checkout_status then return; end if;
  if cs.status <> 'open' then
    raise exception 'transition: session is %, only open transitions', cs.status using errcode='VK409';
  end if;
  update finance.checkout_sessions
     set status = p_to_status::finance.checkout_status,
         completed_at = case when p_to_status='completed' then clock_timestamp() else completed_at end
   where id = p_attempt_id;
end $fn$;

-- A claimed link with NO attempt row returns to active after the TTL — safe
-- precisely because no Stripe call was made (D-035). A link WITH an attempt is
-- never restored here; that is the stranded-attempt path.
create or replace function finance.restore_orphaned_link_claims(
  p_stale_after interval default interval '15 minutes'
) returns integer
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare v_n integer;
begin
  if p_stale_after is null or p_stale_after < interval '1 minute' then
    raise exception 'restore_orphaned_link_claims: stale_after too small' using errcode='VK400';
  end if;
  with orphans as (
    select l.id from finance.payment_links l
     where l.status = 'creating'
       and l.claimed_at < clock_timestamp() - p_stale_after
       and not exists (select 1 from finance.checkout_sessions cs where cs.payment_link_id = l.id)
     for update skip locked
  )
  update finance.payment_links pl
     set status='active', claimed_at=null
    from orphans o where pl.id = o.id;
  get diagnostics v_n = row_count;
  return v_n;
end $fn$;

-- Exactly-once V2 payment: idempotent on (payment_intent, livemode) for
-- stripe_payment rows, so duplicate deliveries return the same entry.
create or replace function finance.record_v2_stripe_payment(
  p_agreement_id uuid, p_amount_cents bigint, p_provider_object_id text,
  p_payment_intent_id text, p_occurred_at timestamptz, p_livemode boolean,
  p_origin_event_id text
) returns uuid
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare v_id uuid;
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
  begin
    insert into finance.ledger_entries (
      agreement_id, entry_type, amount_cents, currency, source,
      provider_object_id, provider_payment_intent_id, occurred_at,
      recorded_by_system, livemode, origin_stripe_event_id
    ) values (
      p_agreement_id, 'stripe_payment', p_amount_cents, 'usd', 'stripe',
      p_provider_object_id, p_payment_intent_id, coalesce(p_occurred_at, clock_timestamp()),
      'reconciliation', p_livemode, p_origin_event_id
    ) returning id into v_id;
  exception when unique_violation then
    select id into v_id from finance.ledger_entries
     where entry_type='stripe_payment' and provider_payment_intent_id = p_payment_intent_id
       and livemode = p_livemode limit 1;
    if v_id is null then raise; end if;
  end;
  return v_id;
end $fn$;

revoke all on function finance.issue_payment_link(uuid, text, text) from public;
grant execute on function finance.issue_payment_link(uuid, text, text) to authenticated;
revoke all on function finance.claim_payment_link(text) from public;
grant execute on function finance.claim_payment_link(text) to service_role;
revoke all on function finance.begin_checkout_attempt(uuid, uuid, bigint, boolean) from public;
grant execute on function finance.begin_checkout_attempt(uuid, uuid, bigint, boolean) to service_role;
revoke all on function finance.finalize_checkout_session(uuid, text, timestamptz) from public;
grant execute on function finance.finalize_checkout_session(uuid, text, timestamptz) to service_role;
revoke all on function finance.transition_checkout_session(uuid, text) from public;
grant execute on function finance.transition_checkout_session(uuid, text) to service_role;
revoke all on function finance.restore_orphaned_link_claims(interval) from public;
grant execute on function finance.restore_orphaned_link_claims(interval) to service_role;
revoke all on function finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text) from public;
grant execute on function finance.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text) to service_role;

create or replace function finance_api.issue_payment_link(
  p_agreement_id uuid, p_token_hash text, p_reason text
) returns table (link_id uuid, amount_cents bigint, expires_at timestamptz)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.issue_payment_link(p_agreement_id, p_token_hash, p_reason); $$;

create or replace function finance_api.revoke_payment_link(p_link_id uuid)
returns void language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.revoke_payment_link(p_link_id); $$;

create or replace function finance_api.claim_payment_link(p_token_hash text)
returns table (link_id uuid, agreement_id uuid)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.claim_payment_link(p_token_hash); $$;

create or replace function finance_api.begin_checkout_attempt(
  p_link_id uuid, p_agreement_id uuid, p_amount_cents bigint, p_livemode boolean
) returns table (attempt_id uuid, idempotency_key text)
language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.begin_checkout_attempt(p_link_id, p_agreement_id, p_amount_cents, p_livemode); $$;

create or replace function finance_api.finalize_checkout_session(
  p_attempt_id uuid, p_stripe_session_id text, p_expires_at timestamptz
) returns void language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.finalize_checkout_session(p_attempt_id, p_stripe_session_id, p_expires_at); $$;

create or replace function finance_api.transition_checkout_session(
  p_attempt_id uuid, p_to_status text
) returns void language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.transition_checkout_session(p_attempt_id, p_to_status); $$;

create or replace function finance_api.restore_orphaned_link_claims(
  p_stale_after interval default interval '15 minutes'
) returns integer language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.restore_orphaned_link_claims(p_stale_after); $$;

create or replace function finance_api.record_v2_stripe_payment(
  p_agreement_id uuid, p_amount_cents bigint, p_provider_object_id text,
  p_payment_intent_id text, p_occurred_at timestamptz, p_livemode boolean,
  p_origin_event_id text
) returns uuid language sql security invoker set search_path = pg_catalog, public, finance
as $$ select finance.record_v2_stripe_payment(p_agreement_id, p_amount_cents, p_provider_object_id, p_payment_intent_id, p_occurred_at, p_livemode, p_origin_event_id); $$;

create or replace view finance_api.payment_links with (security_invoker = true) as
  select id, agreement_id, status, expires_at, claimed_at, consumed_at,
         consumed_by_session_id, revoked_at, attempt_count, created_at, reason
    from finance.payment_links;
create or replace view finance_api.checkout_sessions with (security_invoker = true) as
  select id, agreement_id, stripe_session_id, payment_link_id, amount_cents,
         livemode, status, expires_at, created_at, completed_at
    from finance.checkout_sessions;
grant select on finance_api.payment_links     to authenticated, service_role;
grant select on finance_api.checkout_sessions to authenticated, service_role;

revoke all on function finance_api.issue_payment_link(uuid, text, text) from public;
grant execute on function finance_api.issue_payment_link(uuid, text, text) to authenticated;
revoke all on function finance_api.revoke_payment_link(uuid) from public;
grant execute on function finance_api.revoke_payment_link(uuid) to authenticated;
revoke all on function finance_api.claim_payment_link(text) from public;
grant execute on function finance_api.claim_payment_link(text) to service_role;
revoke all on function finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean) from public;
grant execute on function finance_api.begin_checkout_attempt(uuid, uuid, bigint, boolean) to service_role;
revoke all on function finance_api.finalize_checkout_session(uuid, text, timestamptz) from public;
grant execute on function finance_api.finalize_checkout_session(uuid, text, timestamptz) to service_role;
revoke all on function finance_api.transition_checkout_session(uuid, text) from public;
grant execute on function finance_api.transition_checkout_session(uuid, text) to service_role;
revoke all on function finance_api.restore_orphaned_link_claims(interval) from public;
grant execute on function finance_api.restore_orphaned_link_claims(interval) to service_role;
revoke all on function finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text) from public;
grant execute on function finance_api.record_v2_stripe_payment(uuid, bigint, text, text, timestamptz, boolean, text) to service_role;

do $chk$
declare n integer;
begin
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
   where ns.nspname='finance_api' and p.prosecdef;
  if n <> 0 then raise exception '% finance_api SECURITY DEFINER', n; end if;
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname='finance_api' and a.privilege_type='EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
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

-- Read-only token resolution for the /contribute bridge: the founder view
-- deliberately omits token_hash, so the bridge resolves through this fn with no
-- state change and no Stripe call (behavioral proof #21). service_role only.
create or replace function finance.peek_payment_link(p_token_hash text)
returns table (
  link_id uuid, agreement_id uuid, link_status text, link_expires_at timestamptz,
  session_id uuid, session_status text, stripe_session_id text,
  session_amount_cents bigint, payable_remaining_cents bigint, payment_state text
)
language sql stable security definer set search_path = pg_catalog, public, finance
as $$
  select l.id, l.agreement_id, l.status::text, l.expires_at,
         cs.id, cs.status::text, cs.stripe_session_id, cs.amount_cents,
         b.payable_remaining_cents, b.payment_state::text
    from finance.payment_links l
    left join finance.checkout_sessions cs on cs.id = l.consumed_by_session_id
    left join finance.v_agreement_balances b on b.agreement_id = l.agreement_id
   where l.token_hash = p_token_hash;
$$;
revoke all on function finance.peek_payment_link(text) from public;
grant execute on function finance.peek_payment_link(text) to service_role;

create or replace function finance_api.peek_payment_link(p_token_hash text)
returns table (
  link_id uuid, agreement_id uuid, link_status text, link_expires_at timestamptz,
  session_id uuid, session_status text, stripe_session_id text,
  session_amount_cents bigint, payable_remaining_cents bigint, payment_state text
) language sql security invoker set search_path = pg_catalog, public, finance
as $$ select * from finance.peek_payment_link(p_token_hash); $$;
revoke all on function finance_api.peek_payment_link(text) from public;
grant execute on function finance_api.peek_payment_link(text) to service_role;
