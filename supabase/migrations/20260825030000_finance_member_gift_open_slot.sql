-- Financials V2 — D-089b: the member gift checkout honors the open-slot rule.
--
-- Sibling of D-089, found by the founder immediately after it: the portal's
-- "Continue with gift" resolves the member's additional-gift agreement WITHOUT
-- a lifecycle filter, so a member whose old gift agreement is canceled gets
-- "gift agreement unavailable" (VK409) forever — the canceled row shadowed the
-- create path that D-089's partial index now permits.
--
-- Fix: both the primary lookup and the race-path reselect consider OPEN
-- agreements only (closed_at is null). A member with only closed gift history
-- gets a fresh agreement, exactly like a first-time giver. Everything else —
-- bounds, replay binding, one-live-attempt, lifecycle state machine — is
-- unchanged.

begin;

create or replace function finance.begin_member_gift_checkout(p_amount_cents bigint, p_request_id uuid)
returns table(attempt_id uuid, agreement_id uuid, amount_cents bigint, status text)
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_member uuid; v_key text; v_agreement uuid; v_lc finance.agreement_lifecycle;
  v_attempt finance.checkout_sessions%rowtype;
begin
  v_member := finance.current_member_id();
  if v_member is null then
    raise exception 'member_gift: not a member' using errcode = 'VK404';
  end if;
  if p_request_id is null then
    raise exception 'member_gift: request is required' using errcode = 'VK400';
  end if;
  -- Organizational gift bounds: whole USD dollars, $5–$5,000,000.
  if p_amount_cents is null or p_amount_cents < 500 or p_amount_cents > 500000000
     or p_amount_cents % 100 <> 0 then
    raise exception 'member_gift: gift amount out of bounds' using errcode = 'VK400';
  end if;
  v_key := 'vk2_member_gift_' || v_member || '_' || p_request_id;

  select * into v_attempt from finance.checkout_sessions s where s.idempotency_key = v_key;
  if found then
    if v_attempt.amount_cents <> p_amount_cents then
      raise exception 'member_gift: request id was used for a different amount' using errcode = 'VK409';
    end if;
    return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents, v_attempt.status::text;
    return;
  end if;

  -- OPEN agreements only: closed gift history never shadows a new gift.
  select a.id into v_agreement from finance.agreements a
   where a.member_id = v_member and a.journey_id is null and a.purpose = 'additional_gift'
     and a.closed_at is null;
  if v_agreement is null then
    begin
      insert into finance.agreements (member_id, journey_id, purpose, created_by)
      values (v_member, null, 'additional_gift', auth.uid()) returning id into v_agreement;
      insert into finance.agreement_lifecycle_events (agreement_id, from_status, to_status, reason, actor_id)
      values (v_agreement, null, 'draft', 'Member additional gift', auth.uid());
      insert into finance.agreement_amounts (agreement_id, amount_cents, effective_at, reason, actor_id)
      values (v_agreement, p_amount_cents, now(), 'Member additional gift', auth.uid());
      insert into finance.agreement_lifecycle_events (agreement_id, from_status, to_status, reason, actor_id)
      values (v_agreement, 'draft', 'active', 'Member additional gift', auth.uid());
    exception when unique_violation then
      -- A concurrent begin won the insert; adopt ITS open agreement.
      select a.id into v_agreement from finance.agreements a
       where a.member_id = v_member and a.journey_id is null and a.purpose = 'additional_gift'
         and a.closed_at is null;
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
      raise exception 'member_gift: gift agreement unavailable' using errcode = 'VK409';
    end if;
  end if;

  begin
    insert into finance.checkout_sessions
      (agreement_id, amount_cents, livemode, idempotency_key, expires_at, payment_link_id)
    values (v_agreement, p_amount_cents, true, v_key, now() + interval '2 hours', null)
    returning * into v_attempt;
  exception when unique_violation then
    select * into v_attempt from finance.checkout_sessions s where s.idempotency_key = v_key;
    if not found then
      raise exception 'member_gift: another gift checkout is in progress' using errcode = 'VK409';
    end if;
  end;

  return query select v_attempt.id, v_attempt.agreement_id, v_attempt.amount_cents, v_attempt.status::text;
end $fn$;

do $assert$
begin
  -- The open-slot filter is present in BOTH lookups (primary and race path).
  if (select length(p.prosrc) - length(replace(p.prosrc, 'closed_at is null', ''))
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'finance' and p.proname = 'begin_member_gift_checkout')
     < 2 * length('closed_at is null') then
    raise exception 'D-089b assert: an agreement lookup is missing the open-slot filter';
  end if;
  raise notice 'D-089b ASSERTIONS PASSED';
end $assert$;

commit;
