-- Financials V2 — PR 6 closeout: the two missing recovery drivers.
--
-- PR 6 shipped the checkout protocol with two deliberate holes: an attempt
-- stranded in `creating` (crash between the durable row and Stripe's response)
-- and a session left `open` past its expiry both hold the one-live-per-agreement
-- slot forever. The database surfaces existed; nothing drove them.
--
-- Recovery must be single-flight across concurrent cron invocations, and a row
-- lock cannot do it: the recovery decision requires a Stripe round trip, so the
-- transaction that selected the row is long closed before the outcome is known.
-- The claim is therefore persisted (`recovery_claimed_at`), exactly as
-- `claim_stripe_events` does for the event queue, and expires by TTL so a
-- crashed worker's claim is retried rather than stranded a second time.
--
-- `recovery_attempts` is the circuit breaker: an attempt that cannot be resolved
-- after MAX tries stops consuming Stripe calls and becomes a founder-visible
-- exception instead of an infinite retry loop.

begin;

alter table finance.checkout_sessions
  add column if not exists recovery_claimed_at timestamptz null,
  add column if not exists recovery_attempts integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'finance.checkout_sessions'::regclass
      and conname = 'checkout_recovery_attempts_nonneg'
  ) then
    alter table finance.checkout_sessions
      add constraint checkout_recovery_attempts_nonneg check (recovery_attempts >= 0);
  end if;
end $$;

-- Partial index: only in-flight rows are ever swept.
create index if not exists checkout_sessions_recovery_idx
  on finance.checkout_sessions (status, created_at)
  where status in ('creating', 'open');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Claim stranded `creating` attempts
--
-- `p_older_than` keeps fresh attempts untouched: a checkout in progress right
-- now is not stranded, and recovering it would race the request that owns it.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.claim_stranded_attempts(
  p_older_than interval default interval '15 minutes',
  p_claim_ttl  interval default interval '10 minutes',
  p_limit      integer  default 20
)
returns table(
  attempt_id uuid, agreement_id uuid, payment_link_id uuid, amount_cents bigint,
  idempotency_key text, livemode boolean, created_at timestamptz, recovery_attempts integer
)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
begin
  return query
  with candidates as (
    select s.id
      from finance.checkout_sessions s
     where s.status = 'creating'
       and s.created_at < clock_timestamp() - p_older_than
       and (s.recovery_claimed_at is null
            or s.recovery_claimed_at < clock_timestamp() - p_claim_ttl)
     order by s.created_at
     for update skip locked
     limit p_limit
  )
  update finance.checkout_sessions t
     set recovery_claimed_at = clock_timestamp(),
         recovery_attempts   = t.recovery_attempts + 1
    from candidates c
   where t.id = c.id
  returning t.id, t.agreement_id, t.payment_link_id, t.amount_cents,
            t.idempotency_key, t.livemode, t.created_at, t.recovery_attempts;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Claim `open` sessions past their expiry
--
-- `expires_at` on an open row is Stripe's own expiry, written at finalize. It
-- is a hint, not proof: only Stripe may confirm the session is dead, so this
-- function claims candidates and decides nothing.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.claim_stale_sessions(
  p_claim_ttl interval default interval '10 minutes',
  p_limit     integer  default 20
)
returns table(
  attempt_id uuid, agreement_id uuid, stripe_session_id text,
  livemode boolean, expires_at timestamptz, recovery_attempts integer
)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
begin
  return query
  with candidates as (
    select s.id
      from finance.checkout_sessions s
     where s.status = 'open'
       and s.expires_at < clock_timestamp()
       and s.stripe_session_id is not null
       and (s.recovery_claimed_at is null
            or s.recovery_claimed_at < clock_timestamp() - p_claim_ttl)
     order by s.expires_at
     for update skip locked
     limit p_limit
  )
  update finance.checkout_sessions t
     set recovery_claimed_at = clock_timestamp(),
         recovery_attempts   = t.recovery_attempts + 1
    from candidates c
   where t.id = c.id
  returning t.id, t.agreement_id, t.stripe_session_id,
            t.livemode, t.expires_at, t.recovery_attempts;
end $fn$;

-- Release a claim without changing status: the sweeper made no decision and the
-- next cycle should look again. Never called on an ambiguous attempt — those
-- keep their claim until the TTL so a raised exception is not re-raised at
-- cron speed.
create or replace function finance.release_recovery_claim(p_attempt_id uuid)
returns void
language sql security definer set search_path = pg_catalog, public, finance
as $fn$
  update finance.checkout_sessions
     set recovery_claimed_at = null
   where id = p_attempt_id;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Grants — machine surface only. No member or founder path calls these.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance_api.claim_stranded_attempts(
  p_older_than interval default interval '15 minutes',
  p_claim_ttl  interval default interval '10 minutes',
  p_limit      integer  default 20
)
returns table(
  attempt_id uuid, agreement_id uuid, payment_link_id uuid, amount_cents bigint,
  idempotency_key text, livemode boolean, created_at timestamptz, recovery_attempts integer
)
language sql
as $$ select * from finance.claim_stranded_attempts(p_older_than, p_claim_ttl, p_limit); $$;

create or replace function finance_api.claim_stale_sessions(
  p_claim_ttl interval default interval '10 minutes',
  p_limit     integer  default 20
)
returns table(
  attempt_id uuid, agreement_id uuid, stripe_session_id text,
  livemode boolean, expires_at timestamptz, recovery_attempts integer
)
language sql
as $$ select * from finance.claim_stale_sessions(p_claim_ttl, p_limit); $$;

create or replace function finance_api.release_recovery_claim(p_attempt_id uuid)
returns void
language sql
as $$ select finance.release_recovery_claim(p_attempt_id); $$;

revoke all on function finance.claim_stranded_attempts(interval, interval, integer) from public;
revoke all on function finance.claim_stale_sessions(interval, integer) from public;
revoke all on function finance.release_recovery_claim(uuid) from public;
revoke all on function finance_api.claim_stranded_attempts(interval, interval, integer) from public;
revoke all on function finance_api.claim_stale_sessions(interval, integer) from public;
revoke all on function finance_api.release_recovery_claim(uuid) from public;

grant execute on function finance_api.claim_stranded_attempts(interval, interval, integer) to service_role;
grant execute on function finance_api.claim_stale_sessions(interval, integer) to service_role;
grant execute on function finance_api.release_recovery_claim(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare bad int;
begin
  -- Recovery is machine-only: no API role but service_role may execute it.
  select count(*) into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral (values ('authenticated'), ('anon')) r(role)
  where n.nspname in ('finance', 'finance_api')
    and p.proname in ('claim_stranded_attempts', 'claim_stale_sessions', 'release_recovery_claim')
    and has_function_privilege(r.role, p.oid, 'EXECUTE');
  if bad > 0 then
    raise exception 'PR6R assert: a recovery function is executable by a non-machine role';
  end if;

  if not has_function_privilege('service_role',
       'finance_api.claim_stranded_attempts(interval, interval, integer)', 'EXECUTE') then
    raise exception 'PR6R assert: service_role cannot claim stranded attempts';
  end if;

  -- The claim columns must never reach a member surface.
  select count(*) into bad
  from information_schema.columns
  where table_schema = 'finance_api'
    and table_name like 'member_%'
    and column_name in ('recovery_claimed_at', 'recovery_attempts', 'idempotency_key', 'stripe_session_id');
  if bad > 0 then
    raise exception 'PR6R assert: a member view exposes recovery/provider internals';
  end if;

  -- Still append-only: no write grant was introduced anywhere in finance_api.
  select count(*) into bad
  from information_schema.role_table_grants
  where table_schema = 'finance_api'
    and grantee in ('authenticated', 'anon', 'service_role')
    and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  if bad > 0 then
    raise exception 'PR6R assert: a write grant exists in finance_api';
  end if;

  raise notice 'PR6 RECOVERY MIGRATION ASSERTIONS PASSED';
end $assert$;

commit;
