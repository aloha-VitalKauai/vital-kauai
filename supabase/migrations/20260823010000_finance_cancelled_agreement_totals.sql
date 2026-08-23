-- Financials V2 — cancelled and waived agreements stop being owed (D-087).
--
-- `f_balances` never consulted agreement lifecycle, so a CANCELLED or WAIVED
-- agreement kept contributing its full amount to Contribution and Remaining.
-- The member portal hides such cards (PR 7 review fix), which made it worse
-- than a wrong number: the overview showed a Remaining balance with no card
-- explaining where it came from.
--
-- The fix is deliberately NARROW. Cancelling means nothing further is owed; it
-- does not mean the money never arrived. So:
--
--   • contribution_cents      → 0 for cancelled/waived
--   • remaining_cents         → 0
--   • payable_remaining_cents → 0   (no checkout can be started)
--   • contribution_applies    → false
--   • payment_state           → 'not_applicable'
--   • gross/refunded/reversed/net RECEIVED are UNCHANGED
--
-- Removing the row outright would have deleted real cash from Received: a $50
-- payment on a later-cancelled $100 Contribution would vanish from the founder
-- totals while still sitting in the ledger, in Stripe and in the bank. Received
-- must continue to mean net money received.

begin;

create or replace function finance.f_balances(p_livemode boolean)
returns table(
  agreement_id uuid, member_id uuid, journey_id uuid, purpose finance.agreement_purpose,
  currency text, contribution_applies boolean, contribution_cents bigint,
  gross_received_cents bigint, refunded_cents bigint, reversed_cents bigint,
  net_received_cents bigint, remaining_cents bigint, payable_remaining_cents bigint,
  payment_state finance.payment_state
)
language sql
stable
set search_path to 'pg_catalog', 'public', 'finance'
as $function$
  with entries as (
    select l.agreement_id, l.entry_type, l.amount_cents,
           exists (select 1 from finance.ledger_entries v
                   where v.parent_entry_id = l.id and v.entry_type = 'reversal') as is_reversed
    from finance.ledger_entries l
    where l.livemode = p_livemode
  ),
  agg as (
    select e.agreement_id,
           coalesce(sum(e.amount_cents) filter (
             where e.entry_type in ('stripe_payment','external_payment')), 0) as gross_received_cents,
           coalesce(abs(sum(e.amount_cents) filter (
             where e.entry_type = 'refund' and not e.is_reversed)), 0)        as refunded_cents,
           coalesce(sum(e.amount_cents) filter (where e.entry_type = 'reversal'), 0) as reversed_cents,
           coalesce(sum(e.amount_cents), 0)                                   as net_received_cents
    from entries e group by e.agreement_id
  ),
  -- The agreement's own lifecycle, read once. `closed` means the founder has
  -- ended the obligation: nothing further is owed and no checkout may start.
  lifecycle as (
    select a.id as agreement_id,
           (select e.to_status
              from finance.agreement_lifecycle_events e
             where e.agreement_id = a.id
             order by e.occurred_at desc, e.seq desc
             limit 1) as status
    from finance.agreements a
  ),
  contrib as (
    select a.id as agreement_id,
           coalesce((select am.amount_cents
                     from finance.agreement_amounts am
                     where am.agreement_id = a.id and am.effective_at <= now()
                     order by am.effective_at desc, am.seq desc
                     limit 1), 0) as contribution_cents
    from finance.agreements a
  )
  select a.id, a.member_id, a.journey_id, a.purpose, a.currency,
         -- A closed agreement is not contribution-applicable: it owes nothing.
         (a.purpose in ('journey_contribution','membership')
          and coalesce(lc.status, 'draft') not in ('canceled','waived')) as contribution_applies,
         case when coalesce(lc.status, 'draft') in ('canceled','waived') then 0::bigint
              else c.contribution_cents end,
         -- RECEIVED IS NEVER SUPPRESSED. Cancelling does not un-receive money.
         coalesce(g.gross_received_cents, 0),
         coalesce(g.refunded_cents, 0),
         coalesce(g.reversed_cents, 0),
         coalesce(g.net_received_cents, 0),
         case when coalesce(lc.status, 'draft') in ('canceled','waived') then 0::bigint
              when a.purpose in ('journey_contribution','membership')
              then c.contribution_cents - coalesce(g.net_received_cents, 0) end,
         case when coalesce(lc.status, 'draft') in ('canceled','waived') then 0::bigint
              when a.purpose in ('journey_contribution','membership')
              then greatest(c.contribution_cents - coalesce(g.net_received_cents, 0), 0) end,
         (case
            when coalesce(lc.status, 'draft') in ('canceled','waived')      then 'not_applicable'
            when a.purpose not in ('journey_contribution','membership')     then 'not_applicable'
            when coalesce(g.gross_received_cents, 0) = 0                    then 'unpaid'
            when coalesce(g.net_received_cents, 0) <= 0
                 and coalesce(g.refunded_cents, 0) > 0                      then 'refunded'
            when coalesce(g.net_received_cents, 0) <= 0                     then 'unpaid'
            when coalesce(g.net_received_cents, 0) > c.contribution_cents   then 'overpaid'
            when coalesce(g.net_received_cents, 0) = c.contribution_cents   then 'paid'
            else 'partial'
          end)::finance.payment_state
  from finance.agreements a
  join contrib c on c.agreement_id = a.id
  join lifecycle lc on lc.agreement_id = a.id
  left join agg g on g.agreement_id = a.id;
$function$;

do $assert$
declare
  v_cancelled_contrib bigint;
  v_cancelled_remaining bigint;
  v_paid_received bigint;
  v_ledger_total bigint;
  v_view_received bigint;
begin
  -- The known cancelled drill agreement must owe nothing.
  select contribution_cents, remaining_cents
    into v_cancelled_contrib, v_cancelled_remaining
  from finance.v_agreement_balances
  where agreement_id = '72aa064a-b595-41e6-9117-29a0d7aa6878';
  if v_cancelled_contrib is distinct from 0 or v_cancelled_remaining is distinct from 0 then
    raise exception 'D-087 assert: cancelled agreement still owes % / %',
      v_cancelled_contrib, v_cancelled_remaining;
  end if;

  -- The paid Contribution is untouched.
  select net_received_cents into v_paid_received
  from finance.v_agreement_balances where payment_state = 'paid';
  if v_paid_received is distinct from 10000 then
    raise exception 'D-087 assert: paid agreement received changed to %', v_paid_received;
  end if;

  -- THE INVARIANT: total Received across the view still equals the live ledger.
  -- If suppressing a cancelled agreement ever hides real cash, this fails.
  select coalesce(sum(amount_cents), 0) into v_ledger_total
  from finance.ledger_entries where livemode = true;
  select coalesce(sum(net_received_cents), 0) into v_view_received
  from finance.v_agreement_balances;
  if v_ledger_total is distinct from v_view_received then
    raise exception 'D-087 assert: view Received % <> ledger %', v_view_received, v_ledger_total;
  end if;

  raise notice 'D-087 CANCELLED-AGREEMENT ASSERTIONS PASSED';
end $assert$;

commit;
