-- Financials V2 — PR 7 (D-084): founder command-center read views.
-- Applied to production 2026-08-21 and stamped; this file records it.
-- security_invoker + security_barrier with an explicit is_founder() boundary:
-- a non-founder sees ZERO ROWS (not an error); anon/service_role hold no grant.
-- No reference to any retired financial table or view (asserted below).

create or replace view finance_api.founder_financial_overview
with (security_invoker = true, security_barrier = true) as
  select
    (select coalesce(sum(m.contribution_cents),0) from finance.v_member_financials m)  as contribution_cents,
    (select coalesce(sum(m.gross_received_cents),0) from finance.v_member_financials m) as gross_received_cents,
    (select coalesce(sum(m.refunded_cents),0) from finance.v_member_financials m)       as refunded_cents,
    (select coalesce(sum(m.net_received_cents),0) from finance.v_member_financials m)   as net_received_cents,
    (select coalesce(sum(m.remaining_cents),0) from finance.v_member_financials m)      as remaining_cents,
    (select coalesce(sum(m.payable_remaining_cents),0) from finance.v_member_financials m) as payable_remaining_cents,
    (select count(*) from (
        select distinct on (e.agreement_id) e.agreement_id, e.to_status
          from finance.agreement_lifecycle_events e
         order by e.agreement_id, e.occurred_at desc, e.seq desc
      ) s where s.to_status = 'active')                                                 as active_agreements,
    (select coalesce(sum(x.amount_cents),0) from public.expense_entries x)              as expenses_cents,
    (select coalesce(sum(p.amount_cents),0) from public.payout_commitments p
      where p.status <> 'canceled')                                                     as payouts_cents,
    (select coalesce(sum(p.amount_cents),0) from public.payout_commitments p
      where p.status in ('pending','scheduled'))                                        as pending_payouts_cents,
    (select coalesce(sum(m.net_received_cents),0) from finance.v_member_financials m)
      - (select coalesce(sum(x.amount_cents),0) from public.expense_entries x)
      - (select coalesce(sum(p.amount_cents),0) from public.payout_commitments p
          where p.status <> 'canceled')                                                 as operating_margin_cents
  where public.is_founder();

-- agreements.member_id keys to public.members (NOT member_profiles — the two
-- diverge on 2 of 17 rows), so the display name joins members.
create or replace view finance_api.founder_payment_activity
with (security_invoker = true, security_barrier = true) as
  select l.id, l.agreement_id, l.entry_type::text as entry_type,
         l.amount_cents, l.source::text as source,
         l.external_method::text as external_method,
         l.occurred_at, l.livemode,
         a.purpose::text as purpose, a.member_id, a.journey_id,
         m.full_name as member_name
    from finance.ledger_entries l
    join finance.agreements a on a.id = l.agreement_id
    left join public.members m on m.id = a.member_id
   where public.is_founder();

grant select on finance_api.founder_financial_overview to authenticated;
grant select on finance_api.founder_payment_activity  to authenticated;

do $chk$
declare n integer;
begin
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
   where ns.nspname='finance_api'
     and c.relname in ('founder_financial_overview','founder_payment_activity')
     and (not coalesce((select split_part(o,'=',2)::boolean from unnest(c.reloptions) o
                        where split_part(o,'=',1)='security_invoker'), false)
       or not coalesce((select split_part(o,'=',2)::boolean from unnest(c.reloptions) o
                        where split_part(o,'=',1)='security_barrier'), false));
  if n <> 0 then raise exception '% view(s) missing invoker/barrier', n; end if;
  if has_table_privilege('anon','finance_api.founder_financial_overview','SELECT')
     or has_table_privilege('service_role','finance_api.founder_financial_overview','SELECT')
     or has_table_privilege('anon','finance_api.founder_payment_activity','SELECT')
     or has_table_privilege('service_role','finance_api.founder_payment_activity','SELECT') then
    raise exception 'founder views granted beyond authenticated';
  end if;
  select count(*) into n from information_schema.role_table_grants
   where table_schema='finance_api'
     and grantee in ('anon','authenticated','service_role','PUBLIC')
     and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if n <> 0 then raise exception '% write grant(s) in finance_api', n; end if;
  select count(*) into n from pg_depend d
    join pg_rewrite r on r.oid = d.objid
    join pg_class v on v.oid = r.ev_class
    join pg_class t on t.oid = d.refobjid
    join pg_namespace vn on vn.oid = v.relnamespace
   where vn.nspname='finance_api'
     and v.relname in ('founder_financial_overview','founder_payment_activity')
     and t.relname in ('donations','financial_commitments','payment_tokens','payment_allocations',
                       'financials_overview','cohort_margin_summary','private_ceremony_summary');
  if n <> 0 then raise exception 'founder view references % retired object(s)', n; end if;
end $chk$;
