-- Financials V2 — PR 10C (D-088): acknowledgment issuance and founder-gated
-- campaign activation/retirement.
--
-- The acknowledgment is an IMMUTABLE snapshot generated only from verified
-- payment data: the FULL charged amount with its Contribution / card
-- processing fee breakdown (amendment #12), plus the founder-configured legal
-- name, tax language, no-goods statement, footer and template version — legal
-- identity is configuration, never source code.
--
-- Activation and retirement are DATABASE-authorized founder actions: the
-- functions require public.is_founder() under the caller's own JWT, the VK428
-- configuration guard still fires on the status transition, and service_role
-- holds no EXECUTE on either — the machine cannot approve, activate or retire.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Acknowledgment breakdown snapshot (amendment #12)
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.donor_acknowledgments
  add column contribution_cents        bigint null,
  add column processing_fee_cents      bigint null,
  add column template_version_snapshot text not null default 'v1',
  add constraint ack_breakdown_both_or_neither
    check ((contribution_cents is null) = (processing_fee_cents is null)),
  add constraint ack_breakdown_sums
    check (contribution_cents is null
           or amount_cents = contribution_cents + processing_fee_cents);

-- The snapshot-immutability trigger must freeze the new columns too.
create or replace function finance.tg_ack_snapshot_immutable()
returns trigger
language plpgsql
as $fn$
begin
  if new.receipt_number        is distinct from old.receipt_number
     or new.entry_id           is distinct from old.entry_id
     or new.legal_entity_id    is distinct from old.legal_entity_id
     or new.supporter_id       is distinct from old.supporter_id
     or new.amount_cents       is distinct from old.amount_cents
     or new.currency           is distinct from old.currency
     or new.contribution_date  is distinct from old.contribution_date
     or new.legal_name_snapshot   is distinct from old.legal_name_snapshot
     or new.footer_snapshot       is distinct from old.footer_snapshot
     or new.tax_language_snapshot is distinct from old.tax_language_snapshot
     or new.no_goods_statement    is distinct from old.no_goods_statement
     or new.contribution_cents    is distinct from old.contribution_cents
     or new.processing_fee_cents  is distinct from old.processing_fee_cents
     or new.template_version_snapshot is distinct from old.template_version_snapshot
     or new.document_version   is distinct from old.document_version
     or new.issued_at          is distinct from old.issued_at then
    raise exception 'acknowledgment snapshots are immutable: issue a superseding acknowledgment instead';
  end if;
  return new;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Issue an acknowledgment from VERIFIED payment data only
-- ─────────────────────────────────────────────────────────────────────────────

-- The caller identifies the payment the way the worker knows it: by provider
-- PaymentIntent and mode. The full snapshot is RETURNED so the machine can
-- render the acknowledgment without any read grant on the snapshot table.
create or replace function finance.issue_donor_acknowledgment(
  p_payment_intent_id text, p_livemode boolean
)
returns table(
  ack_id uuid, receipt_number text, amount_cents bigint,
  contribution_cents bigint, processing_fee_cents bigint,
  contribution_date date, legal_name text, receipt_footer text,
  tax_language text, no_goods_statement text, template_version text,
  fund_display_name text, delivery_status text
)
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare
  v_entry   finance.public_support_entries%rowtype;
  v_entity  finance.legal_entities%rowtype;
  v_attempt finance.public_checkout_attempts%rowtype;
  v_id uuid;
begin
  select * into v_entry from finance.public_support_entries e
   where e.provider_payment_intent_id = p_payment_intent_id
     and e.livemode = p_livemode and e.entry_type = 'contribution';
  if not found then
    raise exception 'issue_donor_acknowledgment: no contribution for %', p_payment_intent_id
      using errcode = 'VK404';
  end if;
  if v_entry.supporter_id is null then
    raise exception 'issue_donor_acknowledgment: entry has no linked supporter yet'
      using errcode = 'VK409';
  end if;

  select * into v_entity from finance.legal_entities where id = v_entry.legal_entity_id;
  if not v_entity.tax_deductible_ack_enabled
     or v_entity.legal_name is null or length(btrim(v_entity.legal_name)) = 0
     or v_entity.ack_tax_language is null or length(btrim(v_entity.ack_tax_language)) = 0
     or v_entity.ack_no_goods_statement is null or length(btrim(v_entity.ack_no_goods_statement)) = 0 then
    raise exception 'issue_donor_acknowledgment: acknowledgment wording is not founder-approved'
      using errcode = 'VK428';
  end if;

  -- The breakdown comes from OUR attempt row — the same provenance the money
  -- fact itself was attributed through. A Stripe PaymentIntent belongs to
  -- exactly one Checkout Session, so at most one attempt carries it.
  select * into v_attempt from finance.public_checkout_attempts a
   where a.stripe_payment_intent_id = v_entry.provider_payment_intent_id
     and a.livemode = v_entry.livemode
   order by a.created_at desc limit 1;
  if not found then
    raise exception 'issue_donor_acknowledgment: no attempt carries %', v_entry.provider_payment_intent_id
      using errcode = 'VK409';
  end if;
  if v_entry.amount_cents <> v_attempt.total_charge_cents then
    raise exception 'issue_donor_acknowledgment: entry amount % does not match attempt total %',
      v_entry.amount_cents, v_attempt.total_charge_cents using errcode = 'VK409';
  end if;

  begin
    insert into finance.donor_acknowledgments
      (receipt_number, entry_id, legal_entity_id, supporter_id,
       amount_cents, currency, contribution_date,
       legal_name_snapshot, footer_snapshot, tax_language_snapshot, no_goods_statement,
       contribution_cents, processing_fee_cents, template_version_snapshot,
       document_version)
    values
      ('VK-' || to_char(v_entry.occurred_at, 'YYYY') || '-'
              || lpad(nextval('finance.receipt_number_seq')::text, 5, '0'),
       v_entry.id, v_entry.legal_entity_id, v_entry.supporter_id,
       v_entry.amount_cents, v_entry.currency, v_entry.occurred_at::date,
       v_entity.legal_name, v_entity.receipt_footer,
       v_entity.ack_tax_language, v_entity.ack_no_goods_statement,
       v_attempt.requested_contribution_cents, v_attempt.processing_fee_cents,
       v_entity.ack_template_version, 1)
    returning id into v_id;
  exception when unique_violation then
    -- Exactly one version-1 acknowledgment per entry; duplicates return it.
    select id into v_id from finance.donor_acknowledgments
     where entry_id = v_entry.id and document_version = 1;
  end;

  return query
  select a.id, a.receipt_number, a.amount_cents,
         a.contribution_cents, a.processing_fee_cents,
         a.contribution_date, a.legal_name_snapshot, a.footer_snapshot,
         a.tax_language_snapshot, a.no_goods_statement, a.template_version_snapshot,
         f.display_name, a.delivery_status::text
  from finance.donor_acknowledgments a
  join finance.public_support_entries e on e.id = a.entry_id
  join finance.funds f on f.id = e.fund_id
  where a.id = v_id;
end $fn$;

-- Delivery is bookkeeping; the snapshot never changes.
create or replace function finance.mark_acknowledgment_delivery(
  p_ack_id uuid, p_delivered boolean, p_error text
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
begin
  update finance.donor_acknowledgments
     set delivery_status = case when p_delivered then 'sent'::finance.ack_delivery_status
                                else 'failed'::finance.ack_delivery_status end,
         delivery_attempts = delivery_attempts + 1,
         last_delivery_error = case when p_delivered then null else left(p_error, 500) end,
         delivered_at = case when p_delivered then clock_timestamp() else delivered_at end
   where id = p_ack_id;
  if not found then
    raise exception 'mark_acknowledgment_delivery: acknowledgment % not found', p_ack_id
      using errcode = 'VK404';
  end if;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Founder-gated activation and retirement
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.activate_public_campaign(p_campaign_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_c finance.public_support_campaigns%rowtype;
begin
  if not public.is_founder() then
    raise exception 'activate_public_campaign: founder role required';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'activate_public_campaign: a reason is required' using errcode = 'VK400';
  end if;
  select * into v_c from finance.public_support_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'activate_public_campaign: campaign % not found', p_campaign_id using errcode = 'VK404';
  end if;
  if v_c.status = 'active' then
    raise exception 'activate_public_campaign: campaign is already active' using errcode = 'VK409';
  end if;
  -- The VK428 configuration guard fires on this transition; it, not this
  -- function, owns the completeness checks.
  update finance.public_support_campaigns
     set status = 'active', activation_reason = btrim(p_reason), activation_error = null,
         activated_at = clock_timestamp(), activated_by = auth.uid()
   where id = p_campaign_id;
end $fn$;

create or replace function finance.retire_public_campaign(p_campaign_id uuid, p_reason text)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, finance
as $fn$
declare v_c finance.public_support_campaigns%rowtype;
begin
  if not public.is_founder() then
    raise exception 'retire_public_campaign: founder role required';
  end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'retire_public_campaign: a reason is required' using errcode = 'VK400';
  end if;
  select * into v_c from finance.public_support_campaigns where id = p_campaign_id for update;
  if not found then
    raise exception 'retire_public_campaign: campaign % not found', p_campaign_id using errcode = 'VK404';
  end if;
  if v_c.status <> 'active' then
    raise exception 'retire_public_campaign: campaign is %, not active', v_c.status using errcode = 'VK409';
  end if;
  update finance.public_support_campaigns
     set status = 'retired', retirement_reason = btrim(p_reason),
         retired_at = clock_timestamp(), retired_by = auth.uid()
   where id = p_campaign_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. finance_api surface and grants
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance_api.issue_donor_acknowledgment(
  p_payment_intent_id text, p_livemode boolean
)
returns table(
  ack_id uuid, receipt_number text, amount_cents bigint,
  contribution_cents bigint, processing_fee_cents bigint,
  contribution_date date, legal_name text, receipt_footer text,
  tax_language text, no_goods_statement text, template_version text,
  fund_display_name text, delivery_status text
)
language sql
as $$ select * from finance.issue_donor_acknowledgment(p_payment_intent_id, p_livemode); $$;

create or replace function finance_api.mark_acknowledgment_delivery(
  p_ack_id uuid, p_delivered boolean, p_error text
)
returns void language sql
as $$ select finance.mark_acknowledgment_delivery(p_ack_id, p_delivered, p_error); $$;

create or replace function finance_api.activate_public_campaign(p_campaign_id uuid, p_reason text)
returns void language sql
as $$ select finance.activate_public_campaign(p_campaign_id, p_reason); $$;

create or replace function finance_api.retire_public_campaign(p_campaign_id uuid, p_reason text)
returns void language sql
as $$ select finance.retire_public_campaign(p_campaign_id, p_reason); $$;

-- Machine surface: acknowledgment issuance/delivery (service only).
do $grants$
declare f text;
begin
  for f in select unnest(array[
    'finance.issue_donor_acknowledgment(text, boolean)',
    'finance.mark_acknowledgment_delivery(uuid, boolean, text)',
    'finance_api.issue_donor_acknowledgment(text, boolean)',
    'finance_api.mark_acknowledgment_delivery(uuid, boolean, text)'])
  loop
    execute 'revoke all on function ' || f || ' from public';
    execute 'revoke execute on function ' || f || ' from anon';
    execute 'revoke execute on function ' || f || ' from authenticated';
    execute 'grant execute on function ' || f || ' to service_role';
  end loop;
end $grants$;

-- Founder surface: activation/retirement (authenticated only; the founder
-- check runs inside under the caller's JWT; service_role explicitly revoked).
do $grants$
declare f text;
begin
  for f in select unnest(array[
    'finance.activate_public_campaign(uuid, text)',
    'finance.retire_public_campaign(uuid, text)',
    'finance_api.activate_public_campaign(uuid, text)',
    'finance_api.retire_public_campaign(uuid, text)'])
  loop
    execute 'revoke all on function ' || f || ' from public';
    execute 'revoke execute on function ' || f || ' from anon';
    execute 'grant execute on function ' || f || ' to authenticated';
    execute 'revoke execute on function ' || f || ' from service_role';
  end loop;
end $grants$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Founder views: receipt configuration and acknowledgment breakdown
-- ─────────────────────────────────────────────────────────────────────────────

-- Additions go at the END so create-or-replace is legal.
create or replace view finance_api.founder_public_campaigns
  with (security_invoker = true, security_barrier = true) as
select c.id, c.slug, c.status, c.copy_version, c.currency,
       c.min_amount_cents, c.max_amount_cents, c.livemode,
       c.provider_payment_link_id, c.provider_payment_link_url,
       c.activation_reason, c.activation_error, c.activated_at, c.activated_by,
       c.retirement_reason, c.retired_at, c.retired_by, c.created_at,
       e.slug as entity_slug, e.display_name as entity_display_name,
       e.legal_name, e.ein_last4, e.tax_exempt_basis, e.tax_deductible_ack_enabled,
       f.slug as fund_slug, f.display_name as fund_display_name,
       c.fee_bps, c.fee_fixed_cents, c.fee_policy_version, c.bounds_approved_at,
       e.receipt_footer, e.receipt_contact, e.ack_tax_language,
       e.ack_no_goods_statement, e.ack_template_version,
       e.id as legal_entity_id
from finance.public_support_campaigns c
join finance.legal_entities e on e.id = c.legal_entity_id
join finance.funds f on f.id = c.fund_id
where public.is_founder();

create or replace view finance_api.founder_donor_acknowledgments
  with (security_invoker = true, security_barrier = true) as
select a.id, a.receipt_number, a.entry_id, a.supporter_id, a.amount_cents,
       a.currency, a.contribution_date, a.document_version, a.superseded_by,
       a.issued_at, a.delivery_status, a.delivery_attempts,
       a.last_delivery_error, a.delivered_at,
       a.contribution_cents, a.processing_fee_cents, a.template_version_snapshot,
       a.legal_name_snapshot, a.footer_snapshot, a.tax_language_snapshot,
       a.no_goods_statement
from finance.donor_acknowledgments a
where public.is_founder();

-- Machine view of attempts: the thank-you page confirms a supporter's own
-- session server-side and shows the breakdown from OUR row, never Stripe's
-- arithmetic. Service only; the idempotency key stays private.
create or replace view finance_api.machine_public_checkout_attempts
  with (security_invoker = true, security_barrier = true) as
select a.id, a.status, a.requested_contribution_cents, a.processing_fee_cents,
       a.total_charge_cents, a.fee_policy_version, a.livemode,
       a.stripe_session_id, a.stripe_payment_intent_id, a.completed_at
from finance.public_checkout_attempts a;
grant select on finance_api.machine_public_checkout_attempts to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare bad int;
begin
  -- The machine cannot approve: no service_role EXECUTE on activate/retire.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('finance', 'finance_api')
    and p.proname in ('activate_public_campaign', 'retire_public_campaign')
    and has_function_privilege('service_role', p.oid, 'EXECUTE');
  if bad > 0 then raise exception 'PR10C assert: service_role can activate/retire (%)', bad; end if;

  -- Nobody but the machine issues acknowledgments.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join lateral (values ('authenticated'), ('anon')) r(role)
  where n.nspname in ('finance', 'finance_api')
    and p.proname in ('issue_donor_acknowledgment', 'mark_acknowledgment_delivery')
    and has_function_privilege(r.role, p.oid, 'EXECUTE');
  if bad > 0 then raise exception 'PR10C assert: % non-machine grants on acknowledgment functions', bad; end if;

  -- anon's surface is still exactly one function.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'finance_api'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'public_campaign_status';
  if bad > 0 then raise exception 'PR10C assert: anon can execute % extra functions', bad; end if;

  -- No write grants on the acknowledgment table.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance' and table_name = 'donor_acknowledgments'
    and grantee in ('authenticated','anon','service_role')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if bad > 0 then raise exception 'PR10C assert: write grants on donor_acknowledgments'; end if;

  -- The attempts machine view is the machine's alone.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance_api' and table_name = 'machine_public_checkout_attempts'
    and grantee in ('authenticated','anon');
  if bad > 0 then raise exception 'PR10C assert: attempts machine view leaked'; end if;

  -- The immutability trigger freezes the breakdown snapshot.
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'finance' and p.proname = 'tg_ack_snapshot_immutable'
                   and p.prosrc ilike '%processing_fee_cents%') then
    raise exception 'PR10C assert: acknowledgment breakdown is not frozen';
  end if;

  raise notice 'PR10C SCHEMA ASSERTIONS PASSED';
end $assert$;

commit;
