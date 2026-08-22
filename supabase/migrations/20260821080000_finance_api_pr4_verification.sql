-- Financials V2 — PR 4: the four façade members the verification workspace needs.
--
-- Same contract as the rest of `finance_api` (D-082, and PR 3C's model):
-- SECURITY INVOKER throughout, so nothing here adds privilege. `finance` stays
-- private; these are the only new surface. The two wrappers are founder-facing —
-- EXECUTE goes to `authenticated`, NOT `service_role` — and the underlying
-- functions authorise via `is_founder()` and set actor and timestamp internally.
-- A UI can supply only the target status and a non-blank note, exactly as
-- PR_PLAN specifies.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Read views: canonical V2 positions (no legacy columns — D-082)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view finance_api.member_financials
with (security_invoker = true) as
  select member_id, agreement_count, contribution_cents, gross_received_cents,
         refunded_cents, net_received_cents, remaining_cents,
         payable_remaining_cents
    from finance.v_member_financials;

create or replace view finance_api.journey_financials
with (security_invoker = true) as
  select journey_id, agreement_count, contribution_cents, gross_received_cents,
         refunded_cents, net_received_cents, remaining_cents,
         payable_remaining_cents
    from finance.v_journey_financials;

-- The founder dashboard reads these under its own session; the underlying
-- views are security_invoker over RLS-forced tables, so a non-founder sees
-- nothing rather than a filtered subset.
grant select on finance_api.member_financials  to authenticated, service_role;
grant select on finance_api.journey_financials to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Founder-authorised calls
-- ─────────────────────────────────────────────────────────────────────────────

-- `p_resolution` is text at the boundary and cast inward: the enum lives in the
-- private schema, and the cast fails loudly on an unknown value.
create or replace function finance_api.resolve_exception(
  p_exception_id uuid, p_resolution text, p_note text
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, finance
as $$ select finance.resolve_exception(
       p_exception_id, p_resolution::finance.exception_resolution, p_note); $$;

create or replace function finance_api.release_quarantine(
  p_exception_id uuid, p_note text
)
returns void
language sql
security invoker
set search_path = pg_catalog, public, finance
as $$ select finance.release_quarantine(p_exception_id, p_note); $$;

revoke all on function finance_api.resolve_exception(uuid, text, text) from public;
revoke all on function finance_api.release_quarantine(uuid, text) from public;
-- Founder-facing: authenticated only. service_role holds no EXECUTE on the
-- underlying functions, so granting it here would only produce a runtime
-- refusal; it is omitted so the boundary is visible in the grant itself.
grant execute on function finance_api.resolve_exception(uuid, text, text) to authenticated;
grant execute on function finance_api.release_quarantine(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Prove the façade's properties still hold, in the same transaction
-- ─────────────────────────────────────────────────────────────────────────────

do $chk$
declare
  n_definer integer; n_unpinned integer; n_anon integer;
  n_writable integer; n_invoker_v integer; n_service_wrapped integer;
begin
  select count(*) into n_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance_api' and p.prosecdef;
  if n_definer <> 0 then
    raise exception '% finance_api function(s) are SECURITY DEFINER; all must be INVOKER', n_definer;
  end if;

  select count(*) into n_unpinned
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance_api'
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                      where c like 'search\_path=%');
  if n_unpinned <> 0 then
    raise exception '% finance_api function(s) have no pinned search_path', n_unpinned;
  end if;

  if has_schema_privilege('anon', 'finance_api', 'USAGE') then
    raise exception 'anon holds USAGE on finance_api';
  end if;

  select count(*) into n_anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where n.nspname = 'finance_api' and a.privilege_type = 'EXECUTE'
     and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  if n_anon <> 0 then
    raise exception 'anon or PUBLIC holds EXECUTE on % finance_api function(s)', n_anon;
  end if;

  select count(*) into n_writable
    from information_schema.role_table_grants
   where table_schema = 'finance_api'
     and grantee in ('anon', 'authenticated', 'service_role', 'PUBLIC')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if n_writable <> 0 then
    raise exception 'finance_api exposes % table-write grant(s) to an API role', n_writable;
  end if;

  select count(*) into n_invoker_v
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'finance_api' and c.relkind = 'v'
     and not coalesce((select split_part(o, '=', 2)::boolean from unnest(c.reloptions) o
                        where split_part(o, '=', 1) = 'security_invoker'), false);
  if n_invoker_v <> 0 then
    raise exception '% finance_api view(s) are not security_invoker', n_invoker_v;
  end if;

  -- The founder-only boundary: service_role must hold EXECUTE on NEITHER wrapper.
  select count(*) into n_service_wrapped
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'finance_api'
     and p.proname in ('resolve_exception', 'release_quarantine')
     and has_function_privilege('service_role', p.oid, 'EXECUTE');
  if n_service_wrapped <> 0 then
    raise exception 'service_role holds EXECUTE on % founder-only wrapper(s)', n_service_wrapped;
  end if;
end $chk$;
