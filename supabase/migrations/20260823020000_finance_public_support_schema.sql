-- Financials V2 — PR 10A (D-088): public support schema, fail-closed.
--
-- A supporter is not a member. Public contributions get their own append-only
-- fact table with explicit legal-entity and fund attribution, a restricted
-- supporter identity record, and an immutable acknowledgment snapshot — none of
-- which touch member agreements or the member ledger.
--
-- Everything ships INERT. The seeded campaign is draft, the seeded legal entity
-- has no legal name and acknowledgments disabled, and a database trigger — not
-- application code — refuses activation until the founder has configured the
-- receipt identity. No provider object exists yet; 10B adds ingestion and the
-- Payment Link, 10C adds the public surface.
--
-- The founder's stated tax basis is CONFIGURATION, recorded from founder input.
-- Nothing in this schema asserts or verifies tax status; the receipt language
-- lives in founder-configured snapshots, never in source.

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Enums
-- ─────────────────────────────────────────────────────────────────────────────

create type finance.campaign_status as enum
  ('draft', 'activating', 'active', 'retired', 'activation_failed');
create type finance.public_support_entry_type as enum
  ('contribution', 'refund');
create type finance.ack_delivery_status as enum
  ('pending', 'sent', 'failed');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Legal entities and funds
-- ─────────────────────────────────────────────────────────────────────────────

create table finance.legal_entities (
  id                          uuid primary key default gen_random_uuid(),
  slug                        text unique not null,
  display_name                text not null,
  -- Founder-configured before activation; never hard-coded, never public.
  legal_name                  text null,
  ein_last4                   text null
    constraint entity_ein_last4_shape check (ein_last4 is null or ein_last4 ~ '^[0-9]{4}$'),
  -- Founder-configured receipt content. May include the EIN display the
  -- founder chooses to publish on receipts; the application never composes it.
  receipt_footer              text null,
  receipt_contact             text null,
  -- The founder's stated basis (e.g. a church under 508(c)(1)(A)). Recorded,
  -- not verified — engineering does not assert tax status.
  tax_exempt_basis            text null,
  -- Founder-approved acknowledgment wording, versioned configuration. The
  -- receipt template is assembled from these snapshots, never ad hoc in React.
  ack_tax_language            text null,
  ack_no_goods_statement      text null,
  ack_template_version        text not null default 'v1',
  tax_deductible_ack_enabled  boolean not null default false,
  created_at                  timestamptz not null default now(),
  created_by                  uuid null references auth.users(id) on delete restrict
);

create table finance.funds (
  id               uuid primary key default gen_random_uuid(),
  legal_entity_id  uuid not null references finance.legal_entities(id) on delete restrict,
  slug             text not null,
  display_name     text not null,
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (legal_entity_id, slug)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Campaigns
-- ─────────────────────────────────────────────────────────────────────────────

create table finance.public_support_campaigns (
  id                        uuid primary key default gen_random_uuid(),
  slug                      text unique not null,
  legal_entity_id           uuid not null references finance.legal_entities(id) on delete restrict,
  fund_id                   uuid not null references finance.funds(id) on delete restrict,
  status                    finance.campaign_status not null default 'draft',
  copy_version              text not null default 'v1',
  currency                  text not null default 'usd'
    constraint campaign_usd_only check (currency = 'usd'),
  min_amount_cents          bigint not null default 500,
  max_amount_cents          bigint not null default 500000000,
  constraint campaign_bounds_sane check (min_amount_cents > 0 and max_amount_cents >= min_amount_cents),
  -- Bounds are founder-APPROVED, not merely defaulted; activation requires it.
  bounds_approved_at        timestamptz null,
  bounds_approved_by        uuid null references auth.users(id) on delete restrict,
  livemode                  boolean not null,
  -- Provider identity: service/founder surfaces only, never public.
  provider_payment_link_id  text null,
  provider_payment_link_url text null,
  -- Deterministic key so provider creation is recoverable and exact-once.
  activation_operation_key  text unique null,
  activation_reason         text null,
  activation_error          text null,
  activated_at              timestamptz null,
  activated_by              uuid null references auth.users(id) on delete restrict,
  retirement_reason         text null,
  retired_at                timestamptz null,
  retired_by                uuid null references auth.users(id) on delete restrict,
  created_at                timestamptz not null default now(),
  created_by                uuid null references auth.users(id) on delete restrict
);

-- One reusable campaign per (entity, fund, mode) may be live at a time.
create unique index public_support_campaign_live_uq
  on finance.public_support_campaigns (legal_entity_id, fund_id, livemode)
  where status in ('activating', 'active');

-- Fail-closed at the DATABASE: a campaign cannot move toward active until the
-- founder has configured the legal receipt identity and enabled acknowledgments.
-- Application code cannot forget this check because it does not own it.
create or replace function finance.tg_campaign_activation_guard()
returns trigger
language plpgsql
as $fn$
declare v_entity finance.legal_entities%rowtype;
begin
  if new.status in ('activating', 'active')
     and (old.status is distinct from new.status) then
    select * into v_entity from finance.legal_entities where id = new.legal_entity_id;
    if v_entity.legal_name is null or length(btrim(v_entity.legal_name)) = 0 then
      raise exception 'campaign activation refused: legal entity has no configured legal name'
        using errcode = 'VK428';
    end if;
    if not v_entity.tax_deductible_ack_enabled then
      raise exception 'campaign activation refused: acknowledgment wording is not founder-approved'
        using errcode = 'VK428';
    end if;
    if v_entity.receipt_footer is null or length(btrim(v_entity.receipt_footer)) = 0 then
      raise exception 'campaign activation refused: receipt identity/footer is not configured'
        using errcode = 'VK428';
    end if;
    if v_entity.ack_tax_language is null or length(btrim(v_entity.ack_tax_language)) = 0
       or v_entity.ack_no_goods_statement is null or length(btrim(v_entity.ack_no_goods_statement)) = 0 then
      raise exception 'campaign activation refused: tax-deductible or no-goods language is not configured'
        using errcode = 'VK428';
    end if;
    if new.bounds_approved_at is null then
      raise exception 'campaign activation refused: contribution bounds are not founder-approved'
        using errcode = 'VK428';
    end if;
  end if;
  return new;
end $fn$;

create trigger trg_campaign_activation_guard
  before update on finance.public_support_campaigns
  for each row execute function finance.tg_campaign_activation_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Supporters (restricted) and money facts (append-only)
-- ─────────────────────────────────────────────────────────────────────────────

create table finance.public_supporters (
  id                 uuid primary key default gen_random_uuid(),
  email_normalized   text not null unique,
  display_name       text null,
  stripe_customer_id text null,
  anonymous_display  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table finance.public_support_entries (
  id                          uuid primary key default gen_random_uuid(),
  entry_type                  finance.public_support_entry_type not null,
  campaign_id                 uuid not null references finance.public_support_campaigns(id) on delete restrict,
  legal_entity_id             uuid not null references finance.legal_entities(id) on delete restrict,
  fund_id                     uuid not null references finance.funds(id) on delete restrict,
  amount_cents                bigint not null,
  currency                    text not null default 'usd'
    constraint ps_usd_only check (currency = 'usd'),
  livemode                    boolean not null,
  provider_payment_intent_id  text null,
  provider_charge_id          text null,
  provider_session_id         text null,
  provider_refund_id          text null,
  origin_stripe_event_id      text null references finance.stripe_events(event_id) on delete restrict,
  parent_entry_id             uuid null references finance.public_support_entries(id) on delete restrict,
  supporter_id                uuid null references finance.public_supporters(id) on delete restrict,
  occurred_at                 timestamptz not null,
  recorded_at                 timestamptz not null default now(),

  -- Sign discipline mirrors the member ledger: a contribution is money in,
  -- a refund is negative and always parented to what it refunds.
  constraint ps_contribution_shape check (
    entry_type <> 'contribution'
    or (amount_cents > 0 and parent_entry_id is null
        and provider_payment_intent_id is not null and provider_refund_id is null)),
  constraint ps_refund_shape check (
    entry_type <> 'refund'
    or (amount_cents < 0 and parent_entry_id is not null and provider_refund_id is not null))
);

-- Exact-once by provider identity and mode.
create unique index ps_entries_payment_intent_uq
  on finance.public_support_entries (provider_payment_intent_id, livemode)
  where entry_type = 'contribution';
create unique index ps_entries_refund_uq
  on finance.public_support_entries (provider_refund_id, livemode)
  where entry_type = 'refund';

-- Append-only, same discipline as finance.ledger_entries. Self-contained
-- trigger function so this migration depends on nothing it did not create.
create or replace function finance.tg_public_support_append_only()
returns trigger
language plpgsql
as $fn$
begin
  raise exception '% on public_support_entries is forbidden: it is an append-only fact table', tg_op;
end $fn$;

create trigger trg_ps_entries_no_update before update on finance.public_support_entries
  for each row execute function finance.tg_public_support_append_only();
create trigger trg_ps_entries_no_delete before delete on finance.public_support_entries
  for each row execute function finance.tg_public_support_append_only();
create trigger trg_ps_entries_no_truncate before truncate on finance.public_support_entries
  for each statement execute function finance.tg_public_support_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Acknowledgments — immutable snapshot, mutable delivery bookkeeping
-- ─────────────────────────────────────────────────────────────────────────────

create sequence finance.receipt_number_seq;

create table finance.donor_acknowledgments (
  id                     uuid primary key default gen_random_uuid(),
  receipt_number         text unique not null,
  entry_id               uuid not null references finance.public_support_entries(id) on delete restrict,
  legal_entity_id        uuid not null references finance.legal_entities(id) on delete restrict,
  supporter_id           uuid not null references finance.public_supporters(id) on delete restrict,
  amount_cents           bigint not null,
  currency               text not null default 'usd',
  contribution_date      date not null,
  -- Snapshots: what the donor was actually told, frozen at issue time.
  legal_name_snapshot    text not null,
  footer_snapshot        text null,
  tax_language_snapshot  text not null,
  no_goods_statement     text not null,
  document_version       integer not null default 1,
  superseded_by          uuid null references finance.donor_acknowledgments(id) on delete restrict,
  issued_at              timestamptz not null default now(),
  -- Delivery is bookkeeping and may change; the snapshot above may not.
  delivery_status        finance.ack_delivery_status not null default 'pending',
  delivery_attempts      integer not null default 0,
  last_delivery_error    text null,
  delivered_at           timestamptz null,
  unique (entry_id, document_version)
);

-- The snapshot is immutable: a correction issues a NEW acknowledgment that
-- supersedes this one. Only delivery bookkeeping (and the superseding pointer)
-- may ever change on an existing row.
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
     or new.document_version   is distinct from old.document_version
     or new.issued_at          is distinct from old.issued_at then
    raise exception 'acknowledgment snapshots are immutable: issue a superseding acknowledgment instead';
  end if;
  return new;
end $fn$;

create trigger trg_ack_snapshot_immutable
  before update on finance.donor_acknowledgments
  for each row execute function finance.tg_ack_snapshot_immutable();

create trigger trg_ack_no_delete before delete on finance.donor_acknowledgments
  for each row execute function finance.tg_public_support_append_only();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. RLS: founder reads, service does machine work, public reads NOTHING here
-- ─────────────────────────────────────────────────────────────────────────────

alter table finance.legal_entities            enable row level security;
alter table finance.funds                     enable row level security;
alter table finance.public_support_campaigns  enable row level security;
alter table finance.public_supporters         enable row level security;
alter table finance.public_support_entries    enable row level security;
alter table finance.donor_acknowledgments     enable row level security;

create policy founder_reads_legal_entities on finance.legal_entities
  for select to authenticated using (public.is_founder());
create policy service_all_legal_entities on finance.legal_entities
  for select to service_role using (true);

create policy founder_reads_funds on finance.funds
  for select to authenticated using (public.is_founder());
create policy service_all_funds on finance.funds
  for select to service_role using (true);

create policy founder_reads_ps_campaigns on finance.public_support_campaigns
  for select to authenticated using (public.is_founder());
create policy service_all_ps_campaigns on finance.public_support_campaigns
  for select to service_role using (true);

create policy founder_reads_ps_supporters on finance.public_supporters
  for select to authenticated using (public.is_founder());
create policy service_all_ps_supporters on finance.public_supporters
  for select to service_role using (true);

create policy founder_reads_ps_entries on finance.public_support_entries
  for select to authenticated using (public.is_founder());
create policy service_all_ps_entries on finance.public_support_entries
  for select to service_role using (true);

create policy founder_reads_acks on finance.donor_acknowledgments
  for select to authenticated using (public.is_founder());
create policy service_all_acks on finance.donor_acknowledgments
  for select to service_role using (true);

grant select on finance.legal_entities, finance.funds,
                finance.public_support_campaigns, finance.public_supporters,
                finance.public_support_entries, finance.donor_acknowledgments
  to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Founder configuration function
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.configure_legal_entity(
  p_entity_id uuid,
  p_legal_name text,
  p_ein_last4 text,
  p_receipt_footer text,
  p_receipt_contact text,
  p_tax_exempt_basis text,
  p_ack_tax_language text,
  p_ack_no_goods_statement text,
  p_enable_acknowledgments boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
begin
  if not public.is_founder() then
    raise exception 'configure_legal_entity: founder role required';
  end if;
  if p_enable_acknowledgments and (
       p_legal_name is null or length(btrim(p_legal_name)) = 0
       or p_ack_tax_language is null or length(btrim(p_ack_tax_language)) = 0
       or p_ack_no_goods_statement is null or length(btrim(p_ack_no_goods_statement)) = 0) then
    raise exception 'configure_legal_entity: acknowledgments require legal name, tax language and no-goods statement'
      using errcode = 'VK400';
  end if;
  update finance.legal_entities
     set legal_name                 = p_legal_name,
         ein_last4                  = p_ein_last4,
         receipt_footer             = p_receipt_footer,
         receipt_contact            = p_receipt_contact,
         tax_exempt_basis           = p_tax_exempt_basis,
         ack_tax_language           = p_ack_tax_language,
         ack_no_goods_statement     = p_ack_no_goods_statement,
         tax_deductible_ack_enabled = p_enable_acknowledgments
   where id = p_entity_id;
  if not found then
    raise exception 'configure_legal_entity: entity % not found', p_entity_id
      using errcode = 'VK404';
  end if;
end $fn$;

revoke all on function finance.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean) from public;
grant execute on function finance.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean) to authenticated;
revoke execute on function finance.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean) from service_role;

create or replace function finance.set_campaign_bounds(
  p_campaign_id uuid, p_min_amount_cents bigint, p_max_amount_cents bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, finance
as $fn$
begin
  if not public.is_founder() then
    raise exception 'set_campaign_bounds: founder role required';
  end if;
  if p_min_amount_cents is null or p_min_amount_cents <= 0
     or p_max_amount_cents is null or p_max_amount_cents < p_min_amount_cents then
    raise exception 'set_campaign_bounds: invalid bounds' using errcode = 'VK400';
  end if;
  update finance.public_support_campaigns
     set min_amount_cents = p_min_amount_cents,
         max_amount_cents = p_max_amount_cents,
         bounds_approved_at = now(),
         bounds_approved_by = auth.uid()
   where id = p_campaign_id;
  if not found then
    raise exception 'set_campaign_bounds: campaign % not found', p_campaign_id using errcode = 'VK404';
  end if;
end $fn$;

revoke all on function finance.set_campaign_bounds(uuid, bigint, bigint) from public;
grant execute on function finance.set_campaign_bounds(uuid, bigint, bigint) to authenticated;
revoke execute on function finance.set_campaign_bounds(uuid, bigint, bigint) from service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. finance_api façades
-- ─────────────────────────────────────────────────────────────────────────────

-- PUBLIC-SAFE status probe: campaign-safe copy fields only. DEFINER because
-- anon holds no table privilege; the function IS the boundary, so its select
-- list is the entire public exposure. No provider id, url or operation key.
create or replace function finance_api.public_campaign_status(p_slug text)
returns table(
  slug text, status text, entity_display_name text, fund_display_name text,
  min_amount_cents bigint, max_amount_cents bigint, copy_version text
)
language sql
stable
security definer
set search_path = pg_catalog, public, finance
as $fn$
  select c.slug, c.status::text, e.display_name, f.display_name,
         c.min_amount_cents, c.max_amount_cents, c.copy_version
  from finance.public_support_campaigns c
  join finance.legal_entities e on e.id = c.legal_entity_id
  join finance.funds f on f.id = c.fund_id
  where c.slug = p_slug and c.livemode = true;
$fn$;
revoke all on function finance_api.public_campaign_status(text) from public;
grant execute on function finance_api.public_campaign_status(text) to anon, authenticated;

-- anon needs USAGE on the schema to reach that one function through PostgREST.
-- USAGE alone confers nothing else: every other object's grants exclude anon,
-- and the assertion below proves anon's entire finance_api surface is exactly
-- this one function.
grant usage on schema finance_api to anon;

-- Founder views: invoker + barrier, is_founder() boundary, authenticated-only.
create or replace view finance_api.founder_public_campaigns
  with (security_invoker = true, security_barrier = true) as
select c.id, c.slug, c.status, c.copy_version, c.currency,
       c.min_amount_cents, c.max_amount_cents, c.livemode,
       c.provider_payment_link_id, c.provider_payment_link_url,
       c.activation_reason, c.activation_error, c.activated_at, c.activated_by,
       c.retirement_reason, c.retired_at, c.retired_by, c.created_at,
       e.slug as entity_slug, e.display_name as entity_display_name,
       e.legal_name, e.ein_last4, e.tax_exempt_basis, e.tax_deductible_ack_enabled,
       f.slug as fund_slug, f.display_name as fund_display_name
from finance.public_support_campaigns c
join finance.legal_entities e on e.id = c.legal_entity_id
join finance.funds f on f.id = c.fund_id
where public.is_founder();

create or replace view finance_api.founder_public_support_entries
  with (security_invoker = true, security_barrier = true) as
select p.id, p.entry_type, p.campaign_id, p.legal_entity_id, p.fund_id,
       p.amount_cents, p.currency, p.livemode,
       p.provider_payment_intent_id, p.provider_refund_id,
       p.parent_entry_id, p.supporter_id, p.occurred_at, p.recorded_at
from finance.public_support_entries p
where public.is_founder();

create or replace view finance_api.founder_public_supporters
  with (security_invoker = true, security_barrier = true) as
select s.id, s.email_normalized, s.display_name, s.anonymous_display,
       s.created_at, s.updated_at
from finance.public_supporters s
where public.is_founder();

create or replace view finance_api.founder_donor_acknowledgments
  with (security_invoker = true, security_barrier = true) as
select a.id, a.receipt_number, a.entry_id, a.supporter_id, a.amount_cents,
       a.currency, a.contribution_date, a.document_version, a.superseded_by,
       a.issued_at, a.delivery_status, a.delivery_attempts,
       a.last_delivery_error, a.delivered_at
from finance.donor_acknowledgments a
where public.is_founder();

grant select on finance_api.founder_public_campaigns,
                finance_api.founder_public_support_entries,
                finance_api.founder_public_supporters,
                finance_api.founder_donor_acknowledgments
  to authenticated;

-- Machine view for 10B's provider/webhook work: service_role only.
create or replace view finance_api.machine_public_campaigns
  with (security_invoker = true, security_barrier = true) as
select c.id, c.slug, c.status, c.legal_entity_id, c.fund_id, c.livemode,
       c.min_amount_cents, c.max_amount_cents,
       c.provider_payment_link_id, c.provider_payment_link_url,
       c.activation_operation_key
from finance.public_support_campaigns c;
grant select on finance_api.machine_public_campaigns to service_role;

-- finance_api wrapper for the founder configuration rpc.
create or replace function finance_api.configure_legal_entity(
  p_entity_id uuid, p_legal_name text, p_ein_last4 text, p_receipt_footer text,
  p_receipt_contact text, p_tax_exempt_basis text, p_ack_tax_language text,
  p_ack_no_goods_statement text, p_enable_acknowledgments boolean
)
returns void
language sql
as $$ select finance.configure_legal_entity(p_entity_id, p_legal_name, p_ein_last4,
       p_receipt_footer, p_receipt_contact, p_tax_exempt_basis, p_ack_tax_language,
       p_ack_no_goods_statement, p_enable_acknowledgments); $$;
revoke all on function finance_api.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean) from public;
grant execute on function finance_api.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean) to authenticated;
revoke execute on function finance_api.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean) from service_role;

create or replace function finance_api.set_campaign_bounds(
  p_campaign_id uuid, p_min_amount_cents bigint, p_max_amount_cents bigint
)
returns void
language sql
as $$ select finance.set_campaign_bounds(p_campaign_id, p_min_amount_cents, p_max_amount_cents); $$;
revoke all on function finance_api.set_campaign_bounds(uuid, bigint, bigint) from public;
grant execute on function finance_api.set_campaign_bounds(uuid, bigint, bigint) to authenticated;
revoke execute on function finance_api.set_campaign_bounds(uuid, bigint, bigint) from service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Seeds: one INACTIVE entity, one fund, one DRAFT campaign
-- ─────────────────────────────────────────────────────────────────────────────

insert into finance.legal_entities (slug, display_name)
values ('vital-kauai-church', 'Vital Kauaʻi Church');

insert into finance.funds (legal_entity_id, slug, display_name)
select e.id, 'general-support', 'General Support'
from finance.legal_entities e where e.slug = 'vital-kauai-church';

insert into finance.public_support_campaigns
  (slug, legal_entity_id, fund_id, status, livemode)
select 'general-support', e.id, f.id, 'draft', true
from finance.legal_entities e
join finance.funds f on f.legal_entity_id = e.id and f.slug = 'general-support'
where e.slug = 'vital-kauai-church';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare bad int; v text;
begin
  -- RLS is on everywhere.
  select count(*) into bad
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'finance' and c.relkind = 'r' and not c.relrowsecurity
    and c.relname in ('legal_entities','funds','public_support_campaigns',
                      'public_supporters','public_support_entries','donor_acknowledgments');
  if bad > 0 then raise exception 'PR10A assert: % tables without RLS', bad; end if;

  -- anon holds nothing on any new object.
  for v in select unnest(array['legal_entities','funds','public_support_campaigns',
                               'public_supporters','public_support_entries','donor_acknowledgments'])
  loop
    if has_table_privilege('anon', 'finance.' || v, 'SELECT') then
      raise exception 'PR10A assert: anon can read finance.%', v;
    end if;
  end loop;

  -- No write grants for any API role.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance'
    and table_name in ('legal_entities','funds','public_support_campaigns',
                       'public_supporters','public_support_entries','donor_acknowledgments')
    and grantee in ('authenticated','anon','service_role')
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE');
  if bad > 0 then raise exception 'PR10A assert: % write grants exist', bad; end if;

  -- Founder views are invoker + barrier.
  for v in select unnest(array['founder_public_campaigns','founder_public_support_entries',
                               'founder_public_supporters','founder_donor_acknowledgments',
                               'machine_public_campaigns'])
  loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'finance_api' and c.relname = v
        and c.reloptions @> array['security_invoker=true']
        and c.reloptions @> array['security_barrier=true']
    ) then raise exception 'PR10A assert: % is not invoker+barrier', v; end if;
  end loop;

  -- anon's ENTIRE finance_api surface is one function: zero table/view SELECT
  -- grants, and EXECUTE on public_campaign_status alone.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance_api' and grantee = 'anon';
  if bad > 0 then raise exception 'PR10A assert: anon holds % finance_api table grants', bad; end if;

  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'finance_api'
    and has_function_privilege('anon', p.oid, 'EXECUTE')
    and p.proname <> 'public_campaign_status';
  if bad > 0 then raise exception 'PR10A assert: anon can execute % other finance_api functions', bad; end if;

  -- Every DEFINER function is search_path-pinned.
  select count(*) into bad
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('finance','finance_api')
    and p.proname in ('configure_legal_entity','set_campaign_bounds','public_campaign_status')
    and p.prosecdef and p.proconfig is null;
  if bad > 0 then raise exception 'PR10A assert: % DEFINER functions lack a search_path pin', bad; end if;

  -- service_role performs machine work but can NEVER grant founder approval.
  if has_function_privilege('service_role', 'finance.configure_legal_entity(uuid, text, text, text, text, text, text, text, boolean)', 'EXECUTE')
     or has_function_privilege('service_role', 'finance.set_campaign_bounds(uuid, bigint, bigint)', 'EXECUTE') then
    raise exception 'PR10A assert: service_role can execute a founder approval function';
  end if;

  -- The public status function exposes no provider material.
  if (select pg_get_function_result(p.oid) from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'finance_api' and p.proname = 'public_campaign_status')
     ilike any (array['%provider%', '%link%', '%operation%', '%stripe%']) then
    raise exception 'PR10A assert: public status function leaks provider material';
  end if;

  -- Seeds are inert: entity unconfigured, ack disabled, campaign draft.
  if exists (select 1 from finance.legal_entities
             where slug = 'vital-kauai-church'
               and (legal_name is not null or tax_deductible_ack_enabled)) then
    raise exception 'PR10A assert: seeded entity is not inert';
  end if;
  if (select status from finance.public_support_campaigns where slug = 'general-support')
     is distinct from 'draft'::finance.campaign_status then
    raise exception 'PR10A assert: seeded campaign is not draft';
  end if;

  -- The activation guard actually refuses an unconfigured activation.
  begin
    update finance.public_support_campaigns set status = 'active'
     where slug = 'general-support';
    raise exception 'PR10A assert: activation guard did not fire';
  exception when others then
    if sqlstate <> 'VK428' then raise; end if;
  end;

  raise notice 'PR10A SCHEMA ASSERTIONS PASSED';
end $assert$;

commit;
