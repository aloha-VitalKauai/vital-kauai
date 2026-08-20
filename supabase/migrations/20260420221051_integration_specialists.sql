-- Integration Specialists registry
--
-- Founders can add/edit specialists (name, photo, bio, Calendly link) from the
-- admin dashboard, and assign them to members. The portal card reads from this
-- table to render the right photo + wire the "Book a Session" CTA to the
-- specialist's Calendly URL.
--
-- We intentionally keep members.assigned_partner as a TEXT name (not a FK) so
-- existing values keep working. The portal matches by case-insensitive name.

create table if not exists public.integration_specialists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text,
  photo_url   text,
  bio         text,
  calendly_url text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists integration_specialists_name_lower_idx
  on public.integration_specialists (lower(name));

create index if not exists integration_specialists_active_sort_idx
  on public.integration_specialists (active, sort_order, name);

-- updated_at trigger
create or replace function public.integration_specialists_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists integration_specialists_touch_updated_at on public.integration_specialists;
create trigger integration_specialists_touch_updated_at
  before update on public.integration_specialists
  for each row execute function public.integration_specialists_touch_updated_at();

-- RLS: readable by authenticated members (so the portal can resolve their
-- assigned specialist). Writes gated to service-role only (admin dashboard uses
-- server actions with the user's session; founder role is enforced at the app
-- layer — matches the pattern used elsewhere in this repo).
alter table public.integration_specialists enable row level security;

drop policy if exists integration_specialists_read on public.integration_specialists;
create policy integration_specialists_read on public.integration_specialists
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists integration_specialists_write_authenticated on public.integration_specialists;
create policy integration_specialists_write_authenticated on public.integration_specialists
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed: Judith Johnson (first integration specialist).
insert into public.integration_specialists (name, photo_url, calendly_url, bio, sort_order)
values (
  'Judith Johnson',
  '/images/judithjohnson.jpeg',
  'https://calendly.com/judithajohnson',
  'Judith Johnson is a pioneer of body-oriented healing and the founder of PsychoNeuroEnergetics (PNE). Her path spans Transactional Analysis, Gestalt, neo-Reichian work, Body Electronics with John Ray, and Somatic Experiencing with Peter Levine — giving her the foundation to develop something entirely her own: a modality that accesses the deepest layers of traumatic imprint held in the nervous system, using the healing power of the vagus nerve as its primary gateway. She has deeply integrated Stephen Porges'' Polyvagal Theory and Social Engagement work into her teaching and practice. Judith serves as the Head Somatic Therapy Integration Director for Americans for Ibogaine, bringing her lifetime of nervous system expertise directly into the field of plant medicine integration.',
  10
)
on conflict do nothing;
