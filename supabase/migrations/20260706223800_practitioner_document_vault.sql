-- Team document vault, Phase 1.
-- Roster of practitioners/contractors/staff plus a founder-only vault for
-- their signed paperwork (agreements, waivers, W-9s, insurance, licenses).
-- Mirrors the lab-documents architecture: metadata rows in Postgres, files in
-- a private storage bucket, access via is_founder() RLS on both.

create table if not exists public.practitioners (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  role text not null default 'Contractor',
  engagement_type text not null default 'contractor'
    check (engagement_type in ('contractor', 'employee', 'volunteer')),
  integration_specialist_id uuid references public.integration_specialists(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.practitioners enable row level security;

create policy practitioners_founder_all on public.practitioners
  for all using (is_founder()) with check (is_founder());

create table if not exists public.practitioner_documents (
  id uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references public.practitioners(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'membership_agreement', 'liability_waiver', 'contractor_agreement', 'nda',
    'w9', 'ge_tax', 'insurance_coi', 'license', 'certification', 'cpr', 'other'
  )),
  title text,
  file_name text not null,
  file_path text not null,
  file_size_bytes integer,
  version text,
  signed_at date,
  expires_at date,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists practitioner_documents_practitioner_idx
  on public.practitioner_documents (practitioner_id);

alter table public.practitioner_documents enable row level security;

create policy practitioner_documents_founder_all on public.practitioner_documents
  for all using (is_founder()) with check (is_founder());

-- Private bucket; files live under <practitioner_id>/<timestamp>-<name>.
insert into storage.buckets (id, name, public)
values ('practitioner-documents', 'practitioner-documents', false)
on conflict (id) do nothing;

create policy founders_read_practitioner_docs_storage on storage.objects
  for select using (bucket_id = 'practitioner-documents' and is_founder());

create policy founders_upload_practitioner_docs_storage on storage.objects
  for insert with check (bucket_id = 'practitioner-documents' and is_founder());

create policy founders_delete_practitioner_docs_storage on storage.objects
  for delete using (bucket_id = 'practitioner-documents' and is_founder());
