-- Financials V2 PR 1 — the five canonical views (ARCHITECTURE §8, §15).
-- The ONLY place financial formulas exist. Every aggregate is COALESCEd:
-- SUM over zero rows returns NULL, and without coalescing a new agreement
-- would fall through every CASE branch to 'partial' and feed NULL to checkout.

-- 1 ------------------------------------------------ v_agreement_lifecycle

-- Explicitly transactional: a failure anywhere below leaves the database
-- exactly as it was. Migration 0001 in particular MUST be atomic -- its
-- verification block is worthless if the ALTER has already autocommitted.
begin;

create view finance.v_agreement_lifecycle
  with (security_invoker = true, security_barrier = true) as
select distinct on (e.agreement_id)
  e.agreement_id,
  e.to_status  as current_status,
  e.occurred_at as since,
  e.actor_id,
  e.reason
from finance.agreement_lifecycle_events e
order by e.agreement_id, e.occurred_at desc, e.seq desc;

-- shared balance body ------------------------------------------------------
-- `is_reversed` cannot sit inside a FILTER clause (a correlated subquery is not
-- permitted there), so it is pre-computed in a LATERAL-free CTE and filtered on
-- the resulting boolean.
create function finance.f_balances(p_livemode boolean)
  returns table (
    agreement_id uuid, member_id uuid, journey_id uuid,
    purpose finance.agreement_purpose, currency text,
    contribution_applies boolean,
    contribution_cents bigint, gross_received_cents bigint,
    refunded_cents bigint, reversed_cents bigint, net_received_cents bigint,
    remaining_cents bigint, payable_remaining_cents bigint,
    payment_state finance.payment_state)
  language sql stable security invoker set search_path = pg_catalog, public, finance as $$
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
         (a.purpose in ('journey_contribution','membership')) as contribution_applies,
         c.contribution_cents,
         coalesce(g.gross_received_cents, 0),
         coalesce(g.refunded_cents, 0),
         coalesce(g.reversed_cents, 0),
         coalesce(g.net_received_cents, 0),
         case when a.purpose in ('journey_contribution','membership')
              then c.contribution_cents - coalesce(g.net_received_cents, 0) end,
         case when a.purpose in ('journey_contribution','membership')
              then greatest(c.contribution_cents - coalesce(g.net_received_cents, 0), 0) end,
         (case
            when a.purpose not in ('journey_contribution','membership') then 'not_applicable'
            when coalesce(g.gross_received_cents, 0) = 0                then 'unpaid'
            when coalesce(g.net_received_cents, 0) <= 0
                 and coalesce(g.refunded_cents, 0) > 0                  then 'refunded'
            when coalesce(g.net_received_cents, 0) <= 0                 then 'unpaid'
            when coalesce(g.net_received_cents, 0) > c.contribution_cents then 'overpaid'
            when coalesce(g.net_received_cents, 0) = c.contribution_cents then 'paid'
            else 'partial'
          end)::finance.payment_state
  from finance.agreements a
  join contrib c on c.agreement_id = a.id
  left join agg g on g.agreement_id = a.id;
$$;

revoke all on function finance.f_balances(boolean) from public;
grant execute on function finance.f_balances(boolean) to authenticated, service_role;

-- 2 ------------------------------------------------- v_agreement_balances
create view finance.v_agreement_balances
  with (security_invoker = true, security_barrier = true) as
  select * from finance.f_balances(true);

-- 3 -------------------------------------------- v_agreement_balances_test
-- FOUNDER-ONLY, enforced in the view body (ARCHITECTURE §8: test-mode money
-- "never appears in a member or founder figure ... founder-only"). Granting
-- SELECT to `authenticated` and leaning on base-table RLS did NOT deliver that:
-- no member policy was conditioned on livemode, so a non-founder member saw
-- their own test-mode rows here. The predicate lives in the body so a direct
-- read cannot bypass it.
create view finance.v_agreement_balances_test
  with (security_invoker = true, security_barrier = true) as
  select * from finance.f_balances(false) where public.is_founder();

-- 4 -------------------------------------------------- v_member_financials
-- Aggregates FROM v_agreement_balances and never recomputes a formula.
create view finance.v_member_financials
  with (security_invoker = true, security_barrier = true) as
select b.member_id,
       count(*)::bigint                                            as agreement_count,
       coalesce(sum(b.contribution_cents)   filter (where b.contribution_applies), 0) as contribution_cents,
       coalesce(sum(b.gross_received_cents), 0)                    as gross_received_cents,
       coalesce(sum(b.refunded_cents), 0)                          as refunded_cents,
       coalesce(sum(b.net_received_cents), 0)                      as net_received_cents,
       coalesce(sum(b.remaining_cents)      filter (where b.contribution_applies), 0) as remaining_cents,
       coalesce(sum(b.payable_remaining_cents) filter (where b.contribution_applies), 0) as payable_remaining_cents
from finance.v_agreement_balances b
group by b.member_id;

-- 5 ------------------------------------------------- v_journey_financials
create view finance.v_journey_financials
  with (security_invoker = true, security_barrier = true) as
select b.journey_id,
       count(*)::bigint                                            as agreement_count,
       coalesce(sum(b.contribution_cents)   filter (where b.contribution_applies), 0) as contribution_cents,
       coalesce(sum(b.gross_received_cents), 0)                    as gross_received_cents,
       coalesce(sum(b.refunded_cents), 0)                          as refunded_cents,
       coalesce(sum(b.net_received_cents), 0)                      as net_received_cents,
       coalesce(sum(b.remaining_cents)      filter (where b.contribution_applies), 0) as remaining_cents,
       coalesce(sum(b.payable_remaining_cents) filter (where b.contribution_applies), 0) as payable_remaining_cents
from finance.v_agreement_balances b
where b.journey_id is not null
group by b.journey_id;

commit;
