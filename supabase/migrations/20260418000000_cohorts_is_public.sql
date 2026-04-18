-- Add is_public flag to cohorts so founders can stage cohorts privately
-- before exposing them on the marketing site and the member portal form.

alter table public.cohorts
  add column if not exists is_public boolean not null default false;

create index if not exists cohorts_public_upcoming_idx
  on public.cohorts (is_public, status, start_at);

-- Capture the cohort a member selects on the Share-Your-Availability form
-- (null when the member requests a private / custom-date ceremony).
alter table public.scheduling_requests
  add column if not exists preferred_cohort_id uuid references public.cohorts(id) on delete set null;

-- Allow anonymous + authenticated reads of cohorts marked public + scheduled.
-- (RLS is presumed enabled on public.cohorts; if not, the policy is harmless.)
do $$
begin
  if exists (select 1 from pg_class c
             join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relname = 'cohorts' and c.relrowsecurity) then
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'cohorts' and policyname = 'cohorts_public_read'
    ) then
      create policy cohorts_public_read on public.cohorts
        for select
        to anon, authenticated
        using (is_public = true and status = 'scheduled');
    end if;
  end if;
end $$;

