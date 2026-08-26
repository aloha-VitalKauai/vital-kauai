-- Sessions default program grant — rollback. NOT a migration; run manually.
-- Removes the automation only. Allowance rows already granted are deliberately
-- left in place: they are member entitlements, not scaffolding. To also undo
-- the grants themselves, run the (destructive, separate) statement at the end.

drop trigger if exists trg_members_grant_default_sessions on public.members;
drop function if exists public.members_grant_default_sessions();
drop function if exists public.grant_default_session_allowances(uuid);
drop index if exists public.member_session_allowances_program_grant_key;

-- DESTRUCTIVE, opt-in only — revokes every automatic program grant:
-- delete from public.member_session_allowances where reason = 'program';
