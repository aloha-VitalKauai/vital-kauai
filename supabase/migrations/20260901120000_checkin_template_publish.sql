-- Weekly Member Check-Ins — Build 4 (question editor): atomic template publish.
--
-- The editor never edits a live question set in place. Publishing a week's
-- questions means: retire the current active version, insert the next version
-- as active. Done as two client statements that pair could crash or race into
-- a week with zero active templates; inside one plpgsql function it is a
-- single transaction, and Build 1's partial unique index
-- (checkin_templates_active_week_key) stays the one-active-per-week
-- invariant's enforcement.
--
-- SECURITY INVOKER on purpose: the function runs under the caller's RLS, so
-- the existing founder-only policies on checkin_templates are the gate — a
-- non-founder's publish dies on the insert's RLS check. No new role system.
--
-- Concurrency: two founders publishing the same week at once serialize on the
-- active row's lock; the second re-evaluates, retires the first's new version
-- and becomes the single active (last writer wins). A same-version collision
-- surfaces as 23505 on checkin_templates_week_version_key — never two actives.
--
-- member_checkins is untouched: every existing check-in keeps its own
-- questions_snapshot, and only rows the scheduler creates AFTER a publish
-- pick up the new version.

create or replace function public.publish_checkin_template(
  p_week_number integer,
  p_questions   jsonb
) returns uuid
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_next integer;
  v_id   uuid;
begin
  if p_week_number is null or p_week_number < 1 or p_week_number > 13 then
    raise exception 'publish_checkin_template: week_number must be between 1 and 13'
      using errcode = '22023';
  end if;
  if p_questions is null
     or jsonb_typeof(p_questions) <> 'array'
     or jsonb_array_length(p_questions) = 0 then
    raise exception 'publish_checkin_template: questions must be a non-empty array'
      using errcode = '22023';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.checkin_templates
   where week_number = p_week_number;

  update public.checkin_templates
     set active = false
   where week_number = p_week_number
     and active;

  insert into public.checkin_templates (week_number, version, questions, active)
  values (p_week_number, v_next, p_questions, true)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.publish_checkin_template(integer, jsonb) from public;
grant execute on function public.publish_checkin_template(integer, jsonb)
  to authenticated, service_role;
