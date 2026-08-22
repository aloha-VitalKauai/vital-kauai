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
-- MODE IS A CLAIM PREDICATE, NOT A LABEL. One deployment holds one Stripe key.
-- A worker running a live key that claimed a test-mode attempt would enumerate
-- the wrong account, "prove" the Session absent, and then either mint a real
-- payable Session for a test attempt or cancel an attempt whose Session is
-- live. Both claim functions therefore filter on `livemode`, exactly as
-- `claim_stripe_events` does.

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

create index if not exists checkout_sessions_recovery_idx
  on finance.checkout_sessions (livemode, status, created_at)
  where status in ('creating', 'open');

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Claim stranded `creating` attempts
--
-- `p_older_than` keeps fresh attempts untouched: a checkout in progress right
-- now is not stranded, and recovering it would race the request that owns it.
-- `p_max_attempts` stops re-claiming a row the breaker has already given up on
-- — without it an exhausted attempt is re-claimed every tick and re-raises its
-- exception forever, which the founder cannot clear.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.claim_stranded_attempts(
  p_livemode   boolean,
  p_older_than interval default interval '15 minutes',
  p_claim_ttl  interval default interval '10 minutes',
  p_limit      integer  default 20,
  p_max_attempts integer default 5
)
returns table(
  attempt_id uuid, agreement_id uuid, payment_link_id uuid, amount_cents bigint,
  idempotency_key text, livemode boolean, created_at timestamptz,
  recovery_attempts integer, purpose text
)
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
begin
  return query
  with candidates as (
    select s.id
      from finance.checkout_sessions s
     where s.status = 'creating'
       and s.livemode = p_livemode
       and s.created_at < clock_timestamp() - p_older_than
       and s.recovery_attempts <= p_max_attempts
       and (s.recovery_claimed_at is null
            or s.recovery_claimed_at < clock_timestamp() - p_claim_ttl)
     order by s.created_at
     for update skip locked
     limit p_limit
  ), claimed as (
    update finance.checkout_sessions t
       set recovery_claimed_at = clock_timestamp(),
           recovery_attempts   = t.recovery_attempts + 1
      from candidates c
     where t.id = c.id
    returning t.id, t.agreement_id, t.payment_link_id, t.amount_cents,
              t.idempotency_key, t.livemode, t.created_at, t.recovery_attempts
  )
  select cl.id, cl.agreement_id, cl.payment_link_id, cl.amount_cents,
         cl.idempotency_key, cl.livemode, cl.created_at, cl.recovery_attempts,
         a.purpose::text
    from claimed cl
    join finance.agreements a on a.id = cl.agreement_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Claim `open` sessions past their expiry
--
-- `expires_at` on an open row is Stripe's own expiry, written at finalize. It
-- is a hint, not proof: only Stripe may confirm the session is actually dead,
-- so this function claims candidates and decides nothing.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance.claim_stale_sessions(
  p_livemode  boolean,
  p_claim_ttl interval default interval '10 minutes',
  p_limit     integer  default 20,
  p_max_attempts integer default 5
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
       and s.livemode = p_livemode
       and s.expires_at < clock_timestamp()
       and s.stripe_session_id is not null
       and s.recovery_attempts <= p_max_attempts
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

-- Release a claim without changing status. `p_undo_attempt` also rolls back the
-- counter, because a pass that reached NO decision — a provider read failure,
-- or a deferral while checkout is paused — must not spend one of the attempt's
-- five lives. Without this, pausing checkout for an hour permanently exhausts
-- every in-flight attempt and holds its slot forever.
create or replace function finance.release_recovery_claim(
  p_attempt_id uuid,
  p_undo_attempt boolean default false
)
returns void
language sql security definer set search_path = pg_catalog, public, finance
as $fn$
  update finance.checkout_sessions
     set recovery_claimed_at = null,
         recovery_attempts = case
           when p_undo_attempt then greatest(0, recovery_attempts - 1)
           else recovery_attempts
         end
   where id = p_attempt_id;
$fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Transitions must name the Session they are acting on
--
-- A Stripe event carries `metadata.attempt_id`, which is OUR id — but any
-- Session in the account can carry it, including a duplicate we refuse to
-- auto-resolve. Freeing the slot on metadata alone lets an unrelated Session's
-- expiry release an attempt whose own Session is still open and payable, after
-- which a second checkout on that agreement produces two payable Sessions.
-- When the caller knows which Session it saw, it must say so.
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists finance_api.transition_checkout_session(uuid, text);
drop function if exists finance.transition_checkout_session(uuid, text);

create or replace function finance.transition_checkout_session(
  p_attempt_id uuid,
  p_to_status text,
  p_stripe_session_id text default null
) returns void
language plpgsql security definer set search_path = pg_catalog, public, finance
as $fn$
declare cs finance.checkout_sessions%rowtype;
begin
  if p_to_status not in ('completed','expired','canceled') then
    raise exception 'transition_checkout_session: illegal target %', p_to_status using errcode='VK400';
  end if;
  select * into cs from finance.checkout_sessions where id = p_attempt_id for update;
  if not found then raise exception 'transition: attempt % not found', p_attempt_id using errcode='VK404'; end if;

  -- Provider-driven callers pin the Session; a mismatch means the event belongs
  -- to some other object and must not move this attempt.
  if p_stripe_session_id is not null
     and cs.stripe_session_id is distinct from p_stripe_session_id then
    raise exception 'transition: session % does not own attempt %', p_stripe_session_id, p_attempt_id
      using errcode='VK409';
  end if;

  if cs.status = p_to_status::finance.checkout_status then return; end if;
  -- `creating` may only be canceled: nothing exists at Stripe to complete or
  -- expire, and the id-present CHECK exempts exactly these two states.
  if cs.status = 'creating' then
    if p_to_status <> 'canceled' then
      raise exception 'transition: creating may only be canceled' using errcode='VK409';
    end if;
  elsif cs.status <> 'open' then
    raise exception 'transition: session is %, only open transitions', cs.status using errcode='VK409';
  end if;
  update finance.checkout_sessions
     set status = p_to_status::finance.checkout_status,
         completed_at = case when p_to_status='completed' then clock_timestamp() else completed_at end
   where id = p_attempt_id;
end $fn$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. finance_api wrappers — machine surface only
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function finance_api.transition_checkout_session(
  p_attempt_id uuid, p_to_status text, p_stripe_session_id text default null
) returns void language sql
as $$ select finance.transition_checkout_session(p_attempt_id, p_to_status, p_stripe_session_id); $$;

create or replace function finance_api.claim_stranded_attempts(
  p_livemode boolean,
  p_older_than interval default interval '15 minutes',
  p_claim_ttl  interval default interval '10 minutes',
  p_limit      integer  default 20,
  p_max_attempts integer default 5
)
returns table(
  attempt_id uuid, agreement_id uuid, payment_link_id uuid, amount_cents bigint,
  idempotency_key text, livemode boolean, created_at timestamptz,
  recovery_attempts integer, purpose text
)
language sql
as $$ select * from finance.claim_stranded_attempts(p_livemode, p_older_than, p_claim_ttl, p_limit, p_max_attempts); $$;

create or replace function finance_api.claim_stale_sessions(
  p_livemode boolean,
  p_claim_ttl interval default interval '10 minutes',
  p_limit     integer  default 20,
  p_max_attempts integer default 5
)
returns table(
  attempt_id uuid, agreement_id uuid, stripe_session_id text,
  livemode boolean, expires_at timestamptz, recovery_attempts integer
)
language sql
as $$ select * from finance.claim_stale_sessions(p_livemode, p_claim_ttl, p_limit, p_max_attempts); $$;

create or replace function finance_api.release_recovery_claim(
  p_attempt_id uuid, p_undo_attempt boolean default false
)
returns void language sql
as $$ select finance.release_recovery_claim(p_attempt_id, p_undo_attempt); $$;

revoke all on function finance.claim_stranded_attempts(boolean, interval, interval, integer, integer) from public;
revoke all on function finance.claim_stale_sessions(boolean, interval, integer, integer) from public;
revoke all on function finance.release_recovery_claim(uuid, boolean) from public;
revoke all on function finance.transition_checkout_session(uuid, text, text) from public;
revoke all on function finance_api.claim_stranded_attempts(boolean, interval, interval, integer, integer) from public;
revoke all on function finance_api.claim_stale_sessions(boolean, interval, integer, integer) from public;
revoke all on function finance_api.release_recovery_claim(uuid, boolean) from public;
revoke all on function finance_api.transition_checkout_session(uuid, text, text) from public;

grant execute on function finance_api.claim_stranded_attempts(boolean, interval, interval, integer, integer) to service_role;
grant execute on function finance_api.claim_stale_sessions(boolean, interval, integer, integer) to service_role;
grant execute on function finance_api.release_recovery_claim(uuid, boolean) to service_role;
grant execute on function finance_api.transition_checkout_session(uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Assertions
-- ─────────────────────────────────────────────────────────────────────────────

do $assert$
declare bad int;
begin
  select count(*) into bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral (values ('authenticated'), ('anon')) r(role)
  where n.nspname in ('finance', 'finance_api')
    and p.proname in ('claim_stranded_attempts', 'claim_stale_sessions',
                      'release_recovery_claim', 'transition_checkout_session')
    and has_function_privilege(r.role, p.oid, 'EXECUTE');
  if bad > 0 then
    raise exception 'PR6R assert: a recovery function is executable by a non-machine role';
  end if;

  if not has_function_privilege('service_role',
       'finance_api.claim_stranded_attempts(boolean, interval, interval, integer, integer)', 'EXECUTE') then
    raise exception 'PR6R assert: service_role cannot claim stranded attempts';
  end if;

  -- Exactly one transition function: an leftover 2-arg overload would let a
  -- caller skip the Session-ownership check by omitting the argument.
  select count(*) into bad from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'finance' and p.proname = 'transition_checkout_session';
  if bad <> 1 then
    raise exception 'PR6R assert: % transition_checkout_session overloads exist', bad;
  end if;

  select count(*) into bad
  from information_schema.columns
  where table_schema = 'finance_api'
    and table_name like 'member_%'
    and column_name in ('recovery_claimed_at', 'recovery_attempts', 'idempotency_key', 'stripe_session_id');
  if bad > 0 then
    raise exception 'PR6R assert: a member view exposes recovery/provider internals';
  end if;

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
