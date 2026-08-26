-- Sessions V1 follow-up: every activated member automatically receives the
-- default program allowance — 10 Coaching, 6 PNE — exactly once.
--
-- Uses the existing ledger unchanged: this writes ordinary allowance rows with
-- reason = 'program'. Nothing about how balances are computed changes, and
-- founder adjustments (any other reason) remain unlimited.
--
-- IDEMPOTENCY IS STRUCTURAL, not best-effort: a partial unique index allows at
-- most ONE program grant per (member, session_type). Re-running the trigger,
-- re-activating a member, or replaying a backfill can never double-grant —
-- the second insert is a no-op, not a duplicate row.
--
-- ACTIVATION. A member is activated when they have a portal account: a members
-- row whose profile_id points at a member_profiles row. The profile always
-- exists first — creating the auth user fires auth.on_auth_user_created →
-- handle_new_user, and members.profile_id has a foreign key to
-- member_profiles(id), so the database itself forbids the other order. That is
-- why a single trigger on members is sufficient: it covers both the insert
-- (approve-member, add-member-manually) and a later UPDATE that attaches
-- profile_id. A trigger on member_profiles would be unreachable — no members
-- row can reference a profile that does not exist yet.
--
-- SAFETY. The grant must never be able to break member approval. The function
-- swallows any error into a warning: a missing allowance is a founder-fixable
-- inconvenience, a failed approval is a broken onboarding.

-- At most one program grant per member per type. Founder adjustments are
-- deliberately excluded from the constraint — those are meant to repeat.
create unique index if not exists member_session_allowances_program_grant_key
  on public.member_session_allowances (member_id, session_type)
  where reason = 'program';

-- Default program allowance. To change what new members receive, change these
-- two numbers in a new migration; existing members keep what they were granted
-- (the ledger is history, not configuration).
create or replace function public.grant_default_session_allowances(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_profile is null then
    return;
  end if;

  -- Both halves of "activated" must exist. member_profiles is also the FK
  -- target, so this check is what keeps the insert from erroring.
  if not exists (select 1 from public.member_profiles p where p.id = p_profile) then
    return;
  end if;
  if not exists (select 1 from public.members m where m.profile_id = p_profile) then
    return;
  end if;

  insert into public.member_session_allowances
    (member_id, session_type, quantity, reason, note)
  values
    (p_profile, 'coaching', 10, 'program', 'default program allowance'),
    (p_profile, 'pne',       6, 'program', 'default program allowance')
  on conflict do nothing;

exception when others then
  -- Never let a missing allowance abort member creation.
  raise warning 'grant_default_session_allowances(%) skipped: % (%)',
    p_profile, sqlerrm, sqlstate;
end;
$$;

revoke all on function public.grant_default_session_allowances(uuid)
  from public, anon, authenticated;

create or replace function public.members_grant_default_sessions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.grant_default_session_allowances(new.profile_id);
  return null;
end;
$$;

-- AFTER trigger: the row is already visible, and returning null cannot alter
-- the write that fired it.
drop trigger if exists trg_members_grant_default_sessions on public.members;
create trigger trg_members_grant_default_sessions
  after insert or update of profile_id on public.members
  for each row
  when (new.profile_id is not null)
  execute function public.members_grant_default_sessions();
