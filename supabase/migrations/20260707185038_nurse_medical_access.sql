-- Nurse medical access.
-- A member can be assigned one nurse (a practitioners-roster entry with a
-- linked login). The nurse signs in to /nurse and sees ONLY their assigned
-- members, and ONLY medical data: a limited member view, the intake form,
-- lab documents, and an append-only medical notes log shared with founders.
-- Nurses never gain access to the members table itself (financial columns
-- stay founder-only) — they read through the nurse_member_medical view.

-- 1. Link a roster entry to an auth login; link a member to a nurse.
alter table public.practitioners
  add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

alter table public.members
  add column if not exists assigned_nurse_id uuid references public.practitioners(id) on delete set null;

-- 2. Role helpers, mirroring is_founder().
create or replace function public.is_nurse()
returns boolean
language sql stable security definer
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'nurse'
  );
$$;

create or replace function public.current_practitioner_id()
returns uuid
language sql stable security definer
as $$
  select id from public.practitioners
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_assigned_nurse(member_uuid uuid)
returns boolean
language sql stable security definer
as $$
  select public.is_nurse() and exists (
    select 1 from public.members m
    where m.id = member_uuid
      and m.assigned_nurse_id = public.current_practitioner_id()
  );
$$;

-- 3. Append-only medical notes log, shared by founders and nurses.
create table if not exists public.medical_note_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name text not null,
  author_role text not null default 'nurse' check (author_role in ('nurse', 'founder')),
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists medical_note_entries_member_idx
  on public.medical_note_entries (member_id, created_at desc);

alter table public.medical_note_entries enable row level security;

create policy medical_notes_founder_all on public.medical_note_entries
  for all using (is_founder()) with check (is_founder());

create policy medical_notes_nurse_read on public.medical_note_entries
  for select using (is_assigned_nurse(member_id));

-- Nurses append; they never edit or delete (it's a medical record).
create policy medical_notes_nurse_insert on public.medical_note_entries
  for insert with check (
    is_assigned_nurse(member_id)
    and author_user_id = auth.uid()
    and author_role = 'nurse'
  );

-- 4. Limited medical view of members for nurses. SECURITY DEFINER on purpose:
-- nurses get NO policy on the members table, so financial and agreement
-- columns are unreachable; the view exposes only medical-relevant columns and
-- only for members assigned to the calling nurse.
create or replace view public.nurse_member_medical
with (security_barrier) as
select
  m.id,
  m.full_name,
  m.email,
  m.phone,
  m.status,
  m.ceremony_date,
  m.arrival_date,
  m.departure_date,
  m.journey_focus,
  m.medical_cleared,
  m.cardiac_cleared,
  m.bp_systolic,
  m.bp_diastolic,
  m.heart_rate,
  m.medical_notes,
  m.medication_interactions
from public.members m
where m.assigned_nurse_id = public.current_practitioner_id()
  and public.is_nurse();

revoke all on public.nurse_member_medical from anon;
grant select on public.nurse_member_medical to authenticated;

-- 5. Nurses read assigned members' intake forms (the medical questionnaire).
create policy "Nurses can read assigned member intakes" on public.intake_forms
  for select using (is_assigned_nurse(member_id));

-- 6. Nurses read assigned members' lab documents (rows + files).
create policy lab_docs_select_nurse on public.lab_documents
  for select using (is_assigned_nurse(member_id));

create policy nurse_read_assigned_labs_storage on storage.objects
  for select using (
    bucket_id = 'lab-documents'
    and public.is_nurse()
    and exists (
      select 1 from public.members m
      where m.id::text = (storage.foldername(name))[1]
        and m.assigned_nurse_id = public.current_practitioner_id()
    )
  );
