-- pre_ceremony_progress.member_id and post_ceremony_progress.member_id were
-- created with FKs to public.members(id), but every code path (portal writers,
-- founders dashboard reader) uses auth.uid() / member_profiles.id. The
-- mismatch only happened to work for members whose members.id equals their
-- auth.uid() — for everyone else, the journal upserts hit
-- "violates foreign key constraint *_member_id_fkey".
--
-- Repoint both FKs at member_profiles(id), which is what the application
-- already treats as the source of truth for these tables. ON DELETE CASCADE
-- is preserved on both, mirroring the prior behavior.
--
-- All existing rows satisfy member_profiles(id) (verified before applying).

alter table public.pre_ceremony_progress
  drop constraint if exists pre_ceremony_progress_member_id_fkey;

alter table public.pre_ceremony_progress
  add constraint pre_ceremony_progress_member_id_fkey
  foreign key (member_id) references public.member_profiles(id) on delete cascade;

alter table public.post_ceremony_progress
  drop constraint if exists post_ceremony_progress_member_id_fkey;

alter table public.post_ceremony_progress
  add constraint post_ceremony_progress_member_id_fkey
  foreign key (member_id) references public.member_profiles(id) on delete cascade;
