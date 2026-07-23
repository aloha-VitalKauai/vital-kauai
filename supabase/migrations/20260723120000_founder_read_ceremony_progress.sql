-- Founder Portal journal viewer: let founders — and a member's assigned
-- integration guide — read that member's pre/post ceremony journal progress.
--
-- Both progress tables only carried member self-read policies
-- (auth.uid() = member_id), so the founder dashboard, which queries under the
-- founder's own Supabase session, could only ever see a row whose member_id
-- equalled the founder's own uid. Every other member's journal came back
-- empty, and the read-only Member Journal Viewer showed 0/6 with "No response
-- submitted for this prompt." for real, populated journals.
--
-- This adds a SELECT policy mirroring intake_forms
-- (is_assigned_guide(member_id) OR is_founder()). RLS SELECT policies are
-- OR'd (permissive), so members keep their existing self-read and nothing is
-- exposed to members or the public. Read-only: no insert/update/delete policy
-- is added, so founders/guides still cannot write member journals. Idempotent.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'pre_ceremony_progress'
      and policyname = 'Founders and guides can read pre progress'
  ) then
    create policy "Founders and guides can read pre progress"
      on public.pre_ceremony_progress
      for select
      using (public.is_assigned_guide(member_id) or public.is_founder());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_ceremony_progress'
      and policyname = 'Founders and guides can read post progress'
  ) then
    create policy "Founders and guides can read post progress"
      on public.post_ceremony_progress
      for select
      using (public.is_assigned_guide(member_id) or public.is_founder());
  end if;
end $$;
