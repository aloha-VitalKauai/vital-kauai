-- followup_tasks.member_id was created with an FK to auth.users(id), but the
-- trg_seed_baseline_followup / trg_schedule_followups triggers on
-- ceremony_records insert NEW.member_id from ceremony_records, whose FK
-- already targets public.members(id). The mismatch only happened to work
-- for members whose members.id equals their auth.uid() — for Rachel's
-- manual admin seed (members.id != auth.users.id), updating her ceremony
-- date hit "violates foreign key constraint followup_tasks_member_id_fkey".
--
-- Repoint at public.members(id), preserving ON DELETE CASCADE.
-- All existing followup_tasks rows satisfy members(id) (verified pre-apply).

alter table public.followup_tasks
  drop constraint if exists followup_tasks_member_id_fkey;

alter table public.followup_tasks
  add constraint followup_tasks_member_id_fkey
  foreign key (member_id) references public.members(id) on delete cascade;
