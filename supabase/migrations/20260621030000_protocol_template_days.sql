-- Protocol day identity — titles, themes, and meaning for each day of a
-- protocol. Additive layer on the protocol engine (PR #2). A protocol is a
-- journey with distinct phases ("Arrival — Weaving the Container", "Ceremony —
-- The Medicine", …), not just a list of calendar blocks; this table stores
-- that identity.
--
-- Backward compatible: no existing table is modified. day identity is optional
-- — protocols without rows here simply fall back to "Day N". calendar_events is
-- untouched (day identity lives in the protocol layer only).
--
-- RLS: founder-only, via the existing public.is_founder(), consistent with
-- protocol_templates / protocol_template_items.
--
-- Reversible: drop table if exists public.protocol_template_days;

create table if not exists public.protocol_template_days (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.protocol_templates(id) on delete cascade,
  day_number  integer not null,
  title       text not null,
  theme       text,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint protocol_template_days_day_number_positive check (day_number >= 1),
  unique (template_id, day_number)
);

create index if not exists protocol_template_days_template_idx
  on public.protocol_template_days (template_id, day_number);

-- updated_at trigger (reuse the shared calendar touch function)
drop trigger if exists protocol_template_days_touch_updated_at on public.protocol_template_days;
create trigger protocol_template_days_touch_updated_at
  before update on public.protocol_template_days
  for each row execute function public.calendar_touch_updated_at();

-- RLS: founder-only
alter table public.protocol_template_days enable row level security;

drop policy if exists protocol_template_days_founder_all on public.protocol_template_days;
create policy protocol_template_days_founder_all on public.protocol_template_days
  for all
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());

-- ── Seed: day identity for "The Seven-Day Ceremony Arc" ─────────────────────
-- Idempotent (ON CONFLICT on the (template_id, day_number) unique key).

do $$
declare
  tid uuid;
begin
  select id into tid from public.protocol_templates
    where name = 'The Seven-Day Ceremony Arc';
  if tid is null then
    return;
  end if;

  insert into public.protocol_template_days (template_id, day_number, title, theme, description) values
    (tid, 1, 'Arrival', 'Weaving the Container',
      'The opening of the ceremonial container. Members arrive, settle into the land, meet the team, and begin the journey together.'),
    (tid, 2, 'Release', 'Laying Down the Old',
      'A day devoted to releasing what is complete and calling forward what is emerging.'),
    (tid, 3, 'Ceremony', 'The Medicine',
      'The threshold day where members enter the central ceremonial experience of the week.'),
    (tid, 4, 'Long Day', 'The Emergence',
      'The period of deep rest, protection, and gentle support as members begin integrating their experience.'),
    (tid, 5, 'Integration', 'Making Right',
      'A day of reconciliation, reflection, and bringing insight into relationship with life.'),
    (tid, 6, 'Embodiment', 'Back Into the World',
      'A day of movement, connection with the land, and returning to the body.'),
    (tid, 7, 'Closing', 'Carrying It Home',
      'A transition from the held ceremonial space into the continuation of life and integration beyond the journey.')
  on conflict (template_id, day_number) do nothing;
end $$;
