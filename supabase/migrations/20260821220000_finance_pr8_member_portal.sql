-- Financials V2 — PR 8 (D-085): member-safe portal surface + member checkout.
--
-- Two jobs, one migration:
--   1. Give the member portal bounded, presentation-safe reads: four views that
--      expose only the current member's canonical V2 position and never a
--      founder reason, actor UUID, provider id, link id or idempotency key.
--   2. Close the broad-history exposure: the PR 3C façades (agreement_amounts,
--      ledger_entries, checkout_sessions) were built for founder controls
--      before a member portal existed. Member RLS lets a member read their OWN
--      rows through them — including internal columns. Founder reads move to
--      explicit founder-only views and the broad authenticated grants are
--      revoked. "The UI hides it" is not privacy; the grant is.
--
-- The member checkout functions derive the Contribution amount in Postgres
-- under lock — the browser never supplies it — and bind idempotency to
-- (member, request) through the existing unique checkout_sessions.idempotency_key.
-- They return NO Stripe/idempotency material: the service role fetches that by
-- attempt id through a machine-only view.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Lifecycle status helper
--
-- Member views need an agreement's current lifecycle state (active/draft/…)
-- but members must not read agreement_lifecycle_events rows — those carry
-- founder reasons and actor ids. A DEFINER helper returns only the status,
-- and only for the caller's own agreement (or a founder's any).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.member_agreement_lifecycle(p_agreement_id uuid)
returns finance.agreement_lifecycle
language sql
stable
security definer
set search_path = pg_catalog, public, finance
as $fn$
  select e.to_status
    from finance.agreement_lifecycle_events e
    join finance.agreements a on a.id = e.agreement_id
   where e.agreement_id = p_agreement_id
     and (a.member_id = finance.current_member_id() or public.is_founder())
   order by e.occurred_at desc, e.seq desc
   limit 1;
$fn$;
revoke all on function finance.member_agreement_lifecycle(uuid) from public;
grant execute on function finance.member_agreement_lifecycle(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Member-safe views (invoker + barrier, explicit current_member_id boundary,
--    SELECT to authenticated only)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view finance_api.member_contribution_overview
  with (security_invoker = true, security_barrier = true) as
select
  finance.current_member_id()                                                            as member_id,
  coalesce(sum(b.contribution_cents)      filter (where b.contribution_applies), 0)::bigint as contribution_cents,
  coalesce(sum(b.net_received_cents)      filter (where b.contribution_applies), 0)::bigint as contribution_received_cents,
  coalesce(sum(b.net_received_cents)      filter (where not b.contribution_applies), 0)::bigint as additional_gifts_received_cents,
  coalesce(sum(b.net_received_cents), 0)::bigint                                            as net_received_cents,
  coalesce(sum(b.refunded_cents), 0)::bigint                                                as refunded_cents,
  coalesce(sum(b.remaining_cents)         filter (where b.contribution_applies), 0)::bigint as remaining_cents,
  coalesce(sum(b.payable_remaining_cents) filter (where b.contribution_applies), 0)::bigint as payable_remaining_cents,
  coalesce(count(*) filter (where b.contribution_applies
    and finance.member_agreement_lifecycle(b.agreement_id) = 'active'), 0)::int             as active_agreement_count
from finance.v_agreement_balances b
where b.member_id = finance.current_member_id();

create or replace view finance_api.member_contribution_agreements
  with (security_invoker = true, security_barrier = true) as
select
  b.agreement_id, b.journey_id, b.purpose,
  b.contribution_cents,
  b.net_received_cents as received_cents,
  b.refunded_cents, b.remaining_cents, b.payable_remaining_cents,
  b.payment_state,
  finance.member_agreement_lifecycle(b.agreement_id) as lifecycle_status
from finance.v_agreement_balances b
where b.member_id = finance.current_member_id();

create or replace view finance_api.member_payment_activity
  with (security_invoker = true, security_barrier = true) as
select
  l.id as entry_id, l.agreement_id, a.journey_id, a.purpose,
  l.entry_type, l.amount_cents, l.occurred_at
from finance.ledger_entries l
join finance.agreements a on a.id = l.agreement_id
where a.member_id = finance.current_member_id()
  and l.livemode = true;

create or replace view finance_api.member_checkout_status
  with (security_invoker = true, security_barrier = true) as
select
  s.id as attempt_id, s.agreement_id, s.amount_cents,
  s.status, s.expires_at, s.created_at, s.completed_at
from finance.checkout_sessions s
join finance.agreements a on a.id = s.agreement_id
where a.member_id = finance.current_member_id()
  and s.livemode = true;

grant select on finance_api.member_contribution_overview,
                finance_api.member_contribution_agreements,
                finance_api.member_payment_activity,
                finance_api.member_checkout_status
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Founder-only replacement views for the internal history the PR 5/6/7
--    surfaces actually need
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view finance_api.founder_agreement_amount_history
  with (security_invoker = true, security_barrier = true) as
select id, seq, agreement_id, amount_cents, effective_at, reason, actor_id, created_at
from finance.agreement_amounts
where public.is_founder();

create or replace view finance_api.founder_ledger_history
  with (security_invoker = true, security_barrier = true) as
select id, agreement_id, entry_type, amount_cents, currency, source, external_method,
       provider_object_id, provider_payment_intent_id, parent_entry_id,
       occurred_at, recorded_at, recorded_by, recorded_by_system, reason, livemode
from finance.ledger_entries
where public.is_founder();

create or replace view finance_api.founder_checkout_sessions
  with (security_invoker = true, security_barrier = true) as
select id, agreement_id, stripe_session_id, payment_link_id, amount_cents,
       livemode, status, expires_at, created_at, completed_at
from finance.checkout_sessions
where public.is_founder();

create or replace view finance_api.founder_lifecycle_history
  with (security_invoker = true, security_barrier = true) as
select id, seq, agreement_id, from_status, to_status, reason, actor_id, occurred_at
from finance.agreement_lifecycle_events
where public.is_founder();

grant select on finance_api.founder_agreement_amount_history,
                finance_api.founder_ledger_history,
                finance_api.founder_checkout_sessions,
                finance_api.founder_lifecycle_history
  to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Machine-only attempt view: the checkout service (service_role) needs the
--    Stripe session id and idempotency key by attempt id. Members never do.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view finance_api.machine_checkout_attempts
  with (security_invoker = true, security_barrier = true) as
select id, agreement_id, stripe_session_id, payment_link_id, idempotency_key,
       amount_cents, currency, livemode, status, expires_at, created_at, completed_at
from finance.checkout_sessions;

grant select on finance_api.machine_checkout_attempts to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Grant closure: revoke broad authenticated access to internal façades.
--    Founder surfaces move to the views above; the machine path keeps
--    service_role. agreement_balances stays member-readable: it exposes only
--    canonical money facts and RLS scopes it to own rows.
-- ─────────────────────────────────────────────────────────────────────────────

revoke select on finance_api.agreement_amounts   from authenticated;
revoke select on finance_api.ledger_entries      from authenticated;
revoke select on finance_api.checkout_sessions   from authenticated;
revoke select on finance_api.agreement_lifecycle_events from authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Member contribution checkout: derive the FULL payable remaining under
--    lock; never accept an amount. Idempotent on (member, request). Returns
--    no Stripe/idempotency material — a member may call this rpc directly.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.begin_member_contribution_checkout(
  p_agreement_id uuid,
  p_request_id uuid
)
returns table(attempt_id uuid, agreement_id uuid, amount_cents bigint, status text, current_payable_cents bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_member uuid;
  v_key text;
  v_payable bigint;
  v_attempt finance.checkout_sessions%rowtype;
begin
  v_member := finance.current_member_id();
  if v_member is null then
    raise exception 'member_checkout: not a member' using errcode = 'VK404';
  end if;
  if p_agreement_id is null or p_request_id is null then
    raise exception 'member_checkout: agreement and request are required' using errcode = 'VK400';
  end if;
  v_key := 'vk2_member_contribution_' || v_member || '_' || p_request_id;

  -- Replay of the same intent returns the same attempt, whatever its state.
  -- current_payable_cents is ALWAYS the live figure (bounded review #1): the
  -- attempt's own amount here would compare equal to itself and blind the
  -- service's drift check on every replay.
  select * into v_attempt from finance.checkout_sessions s where s.idempotency_key = v_key;
  if found then
    if v_attempt.agreement_id <> p_agreement_id then
      raise exception 'member_checkout: request id was used for a different agreement' using errcode = 'VK409';
    end if;
    return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents,
                        v_attempt.status::text,
                        (select b.payable_remaining_cents from finance.v_agreement_balances b
                          where b.agreement_id = v_attempt.agreement_id);
    return;
  end if;

  -- Ownership + existence in one locked read. A miss is VK404 — indistinguishable
  -- from a nonexistent agreement, so ids cannot be enumerated.
  perform 1 from finance.agreements a
   where a.id = p_agreement_id and a.member_id = v_member
   for update;
  if not found then
    raise exception 'member_checkout: agreement not found' using errcode = 'VK404';
  end if;

  if finance.member_agreement_lifecycle(p_agreement_id) is distinct from 'active' then
    raise exception 'member_checkout: agreement is not active' using errcode = 'VK409';
  end if;

  select b.payable_remaining_cents into v_payable
    from finance.v_agreement_balances b where b.agreement_id = p_agreement_id;
  if v_payable is null or v_payable <= 0 then
    raise exception 'member_checkout: nothing payable remains' using errcode = 'VK409';
  end if;

  -- One live Session per (agreement, livemode) is a database constraint; an
  -- existing live attempt is resumed, not raced.
  select * into v_attempt from finance.checkout_sessions s
   where s.agreement_id = p_agreement_id and s.livemode = true
     and s.status in ('creating', 'open')
   limit 1;
  if found then
    return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents,
                        v_attempt.status::text, v_payable;
    return;
  end if;

  begin
    insert into finance.checkout_sessions
      (agreement_id, amount_cents, livemode, idempotency_key, expires_at, payment_link_id)
    values
      (p_agreement_id, v_payable, true, v_key, now() + interval '2 hours', null)
    returning * into v_attempt;
  exception when unique_violation then
    -- Lost a race: either the same request replayed concurrently (idempotency
    -- key) or another path opened a live Session (one-live index). Return the
    -- surviving row either way.
    select * into v_attempt from finance.checkout_sessions s
     where s.idempotency_key = v_key
        or (s.agreement_id = p_agreement_id and s.livemode = true
            and s.status in ('creating', 'open'))
     order by (s.idempotency_key = v_key) desc
     limit 1;
    if not found then
      raise exception 'member_checkout: attempt creation failed' using errcode = 'VK409';
    end if;
  end;

  return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents,
                      v_attempt.status::text, v_payable;
end $fn$;

revoke all on function finance.begin_member_contribution_checkout(uuid, uuid) from public;
grant execute on function finance.begin_member_contribution_checkout(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Member gift checkout: a gift is its own additional_gift agreement,
--    created atomically with its attempt. It never touches a Contribution.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.begin_member_gift_checkout(
  p_amount_cents bigint,
  p_request_id uuid
)
returns table(attempt_id uuid, agreement_id uuid, amount_cents bigint, status text)
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_member uuid;
  v_key text;
  v_agreement uuid;
  v_lc finance.agreement_lifecycle;
  v_attempt finance.checkout_sessions%rowtype;
begin
  v_member := finance.current_member_id();
  if v_member is null then
    raise exception 'member_gift: not a member' using errcode = 'VK404';
  end if;
  if p_request_id is null then
    raise exception 'member_gift: request is required' using errcode = 'VK400';
  end if;
  -- Organizational gift bounds (whole USD dollars, $5–$25,000). The route
  -- enforces the same named constants; the database is the backstop.
  if p_amount_cents is null or p_amount_cents < 500 or p_amount_cents > 2500000
     or p_amount_cents % 100 <> 0 then
    raise exception 'member_gift: gift amount out of bounds' using errcode = 'VK400';
  end if;
  v_key := 'vk2_member_gift_' || v_member || '_' || p_request_id;

  -- Same request → same agreement and attempt. Identity is the key, never an
  -- amount-and-time coincidence.
  select * into v_attempt from finance.checkout_sessions s where s.idempotency_key = v_key;
  if found then
    -- A request is bound to ITS amount (bounded review #2): replaying the id
    -- with a different figure is a distinct intent, never a silent substitute.
    if v_attempt.amount_cents <> p_amount_cents then
      raise exception 'member_gift: request id was used for a different amount' using errcode = 'VK409';
    end if;
    return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents,
                        v_attempt.status::text;
    return;
  end if;

  -- One additional_gift agreement per member is a database invariant
  -- (agreements_member_journey_purpose_key, NULLS NOT DISTINCT). Create it
  -- once, reuse it for every later gift; distinct gifts are distinct attempts
  -- and distinct ledger facts on that one agreement.
  select a.id into v_agreement from finance.agreements a
   where a.member_id = v_member and a.journey_id is null and a.purpose = 'additional_gift';
  if v_agreement is null then
    begin
      insert into finance.agreements (member_id, journey_id, purpose, created_by)
      values (v_member, null, 'additional_gift', auth.uid())
      returning id into v_agreement;
      insert into finance.agreement_lifecycle_events (agreement_id, from_status, to_status, reason, actor_id)
      values (v_agreement, null, 'draft', 'Member additional gift', auth.uid());
      insert into finance.agreement_amounts (agreement_id, amount_cents, effective_at, reason, actor_id)
      values (v_agreement, p_amount_cents, now(), 'Member additional gift', auth.uid());
      insert into finance.agreement_lifecycle_events (agreement_id, from_status, to_status, reason, actor_id)
      values (v_agreement, 'draft', 'active', 'Member additional gift', auth.uid());
    exception when unique_violation then
      -- Concurrent first gift: the other creator won; reuse its agreement.
      select a.id into v_agreement from finance.agreements a
       where a.member_id = v_member and a.journey_id is null and a.purpose = 'additional_gift';
      if v_agreement is null then
        raise exception 'member_gift: gift agreement unavailable' using errcode = 'VK409';
      end if;
    end;
  else
    v_lc := finance.member_agreement_lifecycle(v_agreement);
    if v_lc = 'fulfilled' or v_lc = 'draft' then
      insert into finance.agreement_lifecycle_events (agreement_id, from_status, to_status, reason, actor_id)
      values (v_agreement, v_lc, 'active', 'Member additional gift', auth.uid());
    elsif v_lc is distinct from 'active' then
      -- canceled/waived: a founder decision this function must not overrule.
      raise exception 'member_gift: gift agreement unavailable' using errcode = 'VK409';
    end if;
  end if;

  begin
    insert into finance.checkout_sessions
      (agreement_id, amount_cents, livemode, idempotency_key, expires_at, payment_link_id)
    values
      (v_agreement, p_amount_cents, true, v_key, now() + interval '2 hours', null)
    returning * into v_attempt;
  exception when unique_violation then
    -- Replay race on the key, or the one-live-per-agreement constraint: a
    -- DIFFERENT gift attempt is still open. Same request returns it; a new
    -- request is refused until the open one settles.
    select * into v_attempt from finance.checkout_sessions s where s.idempotency_key = v_key;
    if not found then
      raise exception 'member_gift: another gift checkout is in progress' using errcode = 'VK409';
    end if;
  end;

  return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents,
                      v_attempt.status::text;
end $fn$;

revoke all on function finance.begin_member_gift_checkout(bigint, uuid) from public;
grant execute on function finance.begin_member_gift_checkout(bigint, uuid) to authenticated;

-- finance_api wrappers so PostgREST rpc reaches them (finance stays unexposed).
create or replace function finance_api.begin_member_contribution_checkout(p_agreement_id uuid, p_request_id uuid)
returns table(attempt_id uuid, agreement_id uuid, amount_cents bigint, status text, current_payable_cents bigint)
language sql
as $$ select * from finance.begin_member_contribution_checkout(p_agreement_id, p_request_id); $$;
revoke all on function finance_api.begin_member_contribution_checkout(uuid, uuid) from public;
grant execute on function finance_api.begin_member_contribution_checkout(uuid, uuid) to authenticated;

create or replace function finance_api.begin_member_gift_checkout(p_amount_cents bigint, p_request_id uuid)
returns table(attempt_id uuid, agreement_id uuid, amount_cents bigint, status text)
language sql
as $$ select * from finance.begin_member_gift_checkout(p_amount_cents, p_request_id); $$;
revoke all on function finance_api.begin_member_gift_checkout(bigint, uuid) from public;
grant execute on function finance_api.begin_member_gift_checkout(bigint, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7b. Bounded review #5: a `creating` attempt whose amount drifted could never
--     be cleared — transitions were open-only and the id-present CHECK forbade
--     any other status with a NULL session id. `creating → canceled` is the
--     truthful terminal state for an attempt that never reached Stripe.
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.checkout_sessions drop constraint checkout_session_id_present;
alter table finance.checkout_sessions add constraint checkout_session_id_present
  check (status in ('creating', 'canceled') or stripe_session_id is not null);

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
  -- creating may only be canceled (nothing exists at Stripe to complete or
  -- expire); every other transition still requires an open session.
  if cs.status = 'creating' then
    if p_to_status <> 'canceled' then
      raise exception 'transition: creating may only be canceled' using errcode='VK409';
    end if;
  elsif cs.status <> 'open' then
    raise exception 'transition: session is %, only open transitions', cs.status using errcode='VK409';
  end if;
  update finance.checkout_sessions
     set status = p_to_status::finance.checkout_status,
         completed_at = case when p_to_status='completed' then clock_timestamp() else completed_at end
   where id = p_attempt_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. In-transaction assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare
  v text;
  bad int;
begin
  -- Every new view is invoker + barrier.
  for v in select unnest(array[
    'member_contribution_overview','member_contribution_agreements',
    'member_payment_activity','member_checkout_status',
    'founder_agreement_amount_history','founder_ledger_history',
    'founder_checkout_sessions','founder_lifecycle_history','machine_checkout_attempts'])
  loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'finance_api' and c.relname = v
        and c.reloptions @> array['security_invoker=true']
        and c.reloptions @> array['security_barrier=true']
    ) then
      raise exception 'PR8 assert: % is not invoker+barrier', v;
    end if;
  end loop;

  -- Grant closure: internal façades no longer readable by authenticated;
  -- machine view not readable by authenticated; anon holds nothing.
  for v in select unnest(array['agreement_amounts','ledger_entries','checkout_sessions',
                               'agreement_lifecycle_events','machine_checkout_attempts'])
  loop
    if has_table_privilege('authenticated', 'finance_api.' || v, 'SELECT') then
      raise exception 'PR8 assert: authenticated can still read finance_api.%', v;
    end if;
  end loop;
  for v in select unnest(array[
    'member_contribution_overview','member_contribution_agreements',
    'member_payment_activity','member_checkout_status',
    'founder_agreement_amount_history','founder_ledger_history',
    'founder_checkout_sessions','machine_checkout_attempts',
    'agreement_amounts','ledger_entries','checkout_sessions','payment_links'])
  loop
    if has_table_privilege('anon', 'finance_api.' || v, 'SELECT') then
      raise exception 'PR8 assert: anon can read finance_api.%', v;
    end if;
  end loop;
  if not has_table_privilege('service_role', 'finance_api.machine_checkout_attempts', 'SELECT') then
    raise exception 'PR8 assert: service_role lost the machine attempt view';
  end if;

  -- Member-safe views expose no internal column, by name, ever.
  select count(*) into bad
  from information_schema.columns
  where table_schema = 'finance_api'
    and table_name in ('member_contribution_overview','member_contribution_agreements',
                       'member_payment_activity','member_checkout_status')
    and column_name in ('reason','actor_id','recorded_by','provider_object_id',
                        'provider_payment_intent_id','parent_entry_id',
                        'stripe_session_id','payment_link_id','idempotency_key');
  if bad > 0 then
    raise exception 'PR8 assert: a member-safe view exposes an internal column';
  end if;

  -- No write grant exists anywhere in finance_api for API roles.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance_api'
    and grantee in ('authenticated','anon','service_role')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if bad > 0 then
    raise exception 'PR8 assert: a write grant exists in finance_api';
  end if;

  -- The member checkout functions are definer, search_path-pinned, and the
  -- member-callable ones return no Stripe/idempotency column.
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'finance'
      and p.proname in ('begin_member_contribution_checkout','begin_member_gift_checkout',
                        'member_agreement_lifecycle')
      and (not p.prosecdef or p.proconfig is null)
  ) then
    raise exception 'PR8 assert: a member function is not definer/search_path-pinned';
  end if;
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('finance','finance_api')
      and p.proname in ('begin_member_contribution_checkout','begin_member_gift_checkout')
      and (pg_get_function_result(p.oid) ilike '%stripe%'
        or pg_get_function_result(p.oid) ilike '%idempotency%')
  ) then
    raise exception 'PR8 assert: member checkout returns Stripe/idempotency material';
  end if;
end $assert$;
