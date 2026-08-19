-- Member draft storage: a single row per member per form, holding the
-- in-progress answers as JSONB. Used by the intake form's cross-device
-- autosave so a member can start on their laptop, pick up on their phone,
-- and find the same answers waiting for them.
--
-- Additive only. RLS restricts each member to their own row. No sensitive
-- keys live here — drafts are just JSON payloads the member typed into
-- their own form.

create table if not exists public.member_drafts (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references auth.users(id) on delete cascade,
  form_key    text not null,
  payload     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  unique (member_id, form_key)
);

create index if not exists member_drafts_member_form_idx
  on public.member_drafts (member_id, form_key);

alter table public.member_drafts enable row level security;

-- Members can read, insert, update, and delete their own drafts.
-- Founders/guides don't need dashboard access here; once a form is
-- submitted its data lives on the final table (e.g. intake_forms).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_drafts'
      and policyname = 'member_drafts_select_own'
  ) then
    create policy member_drafts_select_own on public.member_drafts
      for select using (auth.uid() = member_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_drafts'
      and policyname = 'member_drafts_insert_own'
  ) then
    create policy member_drafts_insert_own on public.member_drafts
      for insert with check (auth.uid() = member_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_drafts'
      and policyname = 'member_drafts_update_own'
  ) then
    create policy member_drafts_update_own on public.member_drafts
      for update using (auth.uid() = member_id) with check (auth.uid() = member_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'member_drafts'
      and policyname = 'member_drafts_delete_own'
  ) then
    create policy member_drafts_delete_own on public.member_drafts
      for delete using (auth.uid() = member_id);
  end if;
end $$;
