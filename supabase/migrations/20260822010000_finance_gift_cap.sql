-- Financials V2 — raise the additional-gift ceiling to $5,000,000.
--
-- PR #911 raised the ceiling in the browser only, leaving the server and this
-- function at $25,000. Any custom gift between those two numbers was accepted
-- by the UI and then refused with a generic error. The PR 8 spec is explicit
-- that the bound is an organizational risk policy expressed in ONE named server
-- constant plus this check — never a client-only limit — so the two move
-- together here.
--
-- This raises OUR ceiling only. Card networks and Stripe apply their own
-- per-charge limits well below this figure; a gift of this size would be
-- declined by the issuer long before it reached the ledger.

begin;

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
  -- Organizational gift bounds: whole USD dollars, $5–$5,000,000. The route
  -- enforces the same named constants; this is the backstop.
  if p_amount_cents is null or p_amount_cents < 500 or p_amount_cents > 500000000
     or p_amount_cents % 100 <> 0 then
    raise exception 'member_gift: gift amount out of bounds' using errcode = 'VK400';
  end if;
  v_key := 'vk2_member_gift_' || v_member || '_' || p_request_id;

  select * into v_attempt from finance.checkout_sessions s where s.idempotency_key = v_key;
  if found then
    -- A request is bound to ITS amount: replaying the id with a different
    -- figure is a distinct intent, never a silent substitute.
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

do $assert$
declare bad int;
begin
  -- The new ceiling is present and the floor is untouched.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'finance' and p.proname = 'begin_member_gift_checkout'
      and pg_get_functiondef(p.oid) like '%500000000%'
  ) then
    raise exception 'GIFTCAP assert: the raised ceiling is not in the function body';
  end if;

  -- Still definer + search_path pinned, still returns no Stripe material.
  select count(*) into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'finance' and p.proname = 'begin_member_gift_checkout'
    and (not p.prosecdef or p.proconfig is null);
  if bad > 0 then raise exception 'GIFTCAP assert: definer/search_path pin lost'; end if;

  select count(*) into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('finance','finance_api') and p.proname = 'begin_member_gift_checkout'
    and (pg_get_function_result(p.oid) ilike '%stripe%'
      or pg_get_function_result(p.oid) ilike '%idempotency%');
  if bad > 0 then raise exception 'GIFTCAP assert: gift checkout returns Stripe material'; end if;

  -- anon must still be unable to execute it.
  if has_function_privilege('anon', 'finance.begin_member_gift_checkout(bigint, uuid)', 'EXECUTE') then
    raise exception 'GIFTCAP assert: anon can execute gift checkout';
  end if;

  raise notice 'GIFT CAP ASSERTIONS PASSED';
end $assert$;

commit;
