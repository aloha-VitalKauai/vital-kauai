-- Financials V2 PR 1 — triggers.
-- Append-only enforcement, lifecycle transitions, ledger invariants L3b/L4/L6/L7/L11,
-- amendment dating, INSERT-time protection of guarded transitions, and the
-- deferred agreement-completeness check.

-- ---------------------------------------------------------------- append-only
-- Fires regardless of role, so it holds for service_role and any future role.
create function finance.tg_append_only() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
begin
  raise exception '% on % is forbidden: % is an append-only fact table',
    tg_op, tg_table_name, tg_table_name;
end $$;

create trigger append_only before update or delete on finance.ledger_entries
  for each row execute function finance.tg_append_only();
create trigger append_only before update or delete on finance.agreement_amounts
  for each row execute function finance.tg_append_only();
create trigger append_only before update or delete on finance.agreement_lifecycle_events
  for each row execute function finance.tg_append_only();

-- Agreements are insert-only (§1).
create trigger agreements_insert_only before update or delete on finance.agreements
  for each row execute function finance.tg_append_only();

-- ------------------------------------------------- amendments are not future-dated
create function finance.tg_amount_not_future() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
begin
  if new.effective_at > now() then
    raise exception 'future-dated amendment rejected: effective_at % is after now()',
      new.effective_at;
  end if;
  return new;
end $$;

create trigger amount_not_future before insert on finance.agreement_amounts
  for each row execute function finance.tg_amount_not_future();

-- ------------------------------------------------------- lifecycle transitions
create function finance.tg_lifecycle_transition() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
declare
  v_current finance.agreement_lifecycle;
begin
  -- Lock the parent agreement so two concurrent transitions serialise.
  perform 1 from finance.agreements where id = new.agreement_id for update;
  if not found then
    raise exception 'agreement % does not exist', new.agreement_id;
  end if;

  select e.to_status into v_current
  from finance.agreement_lifecycle_events e
  where e.agreement_id = new.agreement_id
  order by e.occurred_at desc, e.seq desc
  limit 1;

  if new.from_status is null then
    if v_current is not null then
      raise exception 'agreement % already has an initial lifecycle event', new.agreement_id;
    end if;
    if new.to_status <> 'draft' then
      raise exception 'initial lifecycle event must be draft, got %', new.to_status;
    end if;
    return new;
  end if;

  if v_current is null then
    raise exception 'agreement % has no lifecycle: first event must be the initial draft event',
      new.agreement_id;
  end if;
  if new.from_status <> v_current then
    raise exception 'stale transition: from_status % but current status is %',
      new.from_status, v_current;
  end if;

  -- The complete legal set (ARCHITECTURE §6). Anything absent is rejected.
  if not (
       (new.from_status = 'draft'     and new.to_status in ('active','canceled','waived'))
    or (new.from_status = 'active'    and new.to_status in ('fulfilled','canceled','waived'))
    or (new.from_status = 'fulfilled' and new.to_status = 'active')
  ) then
    raise exception 'illegal lifecycle transition % -> %', new.from_status, new.to_status;
  end if;

  return new;
end $$;

create trigger lifecycle_transition before insert on finance.agreement_lifecycle_events
  for each row execute function finance.tg_lifecycle_transition();

-- ------------------------------- every agreement has exactly one initial event
-- DEFERRABLE INITIALLY DEFERRED: checked at COMMIT so the agreement row is not
-- rejected in the instant between its own insert and its event's insert.
-- Deferral does NOT permit child-first insertion: the child's FK is
-- non-deferrable and the transition trigger locks the parent (§4).
create function finance.tg_agreement_has_lifecycle() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
declare
  n integer;
begin
  select count(*) into n
  from finance.agreement_lifecycle_events
  where agreement_id = new.id and from_status is null;

  if n <> 1 then
    raise exception
      'agreement % must have exactly one initial lifecycle event at commit, found %',
      new.id, n;
  end if;
  return null;
end $$;

create constraint trigger agreement_has_lifecycle
  after insert on finance.agreements
  deferrable initially deferred
  for each row execute function finance.tg_agreement_has_lifecycle();

-- ------------------------------------------------- ledger invariants L3b/L4/L6/L7/L11
create function finance.tg_ledger_invariants() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
declare
  p              finance.ledger_entries%rowtype;
  unreversed_kids integer;
  refunded        bigint;
  ev_livemode     boolean;
begin
  -- L11: livemode must match the originating event, where one exists.
  if new.origin_stripe_event_id is not null then
    select livemode into ev_livemode
    from finance.stripe_events where event_id = new.origin_stripe_event_id;
    if ev_livemode is distinct from new.livemode then
      raise exception 'L11: livemode % disagrees with originating event % (livemode %)',
        new.livemode, new.origin_stripe_event_id, ev_livemode;
    end if;
  end if;

  if new.parent_entry_id is null then
    return new;
  end if;

  -- Lock the parent: L6 and L7 both read-then-write against it.
  select * into p from finance.ledger_entries
  where id = new.parent_entry_id for update;
  if not found then
    raise exception 'parent entry % does not exist', new.parent_entry_id;
  end if;

  -- L6: same agreement
  if p.agreement_id <> new.agreement_id then
    raise exception 'L6: parent belongs to agreement %, child to %',
      p.agreement_id, new.agreement_id;
  end if;

  -- L6 / legal parent matrix
  if new.entry_type = 'refund' then
    if p.entry_type not in ('stripe_payment','external_payment') then
      raise exception 'L6: a refund may only target a payment, parent is %', p.entry_type;
    end if;
    -- L3b: a Stripe refund's parent must be a stripe_payment
    if new.source = 'stripe' and p.entry_type <> 'stripe_payment' then
      raise exception 'L3b: a stripe refund must target a stripe_payment, parent is %',
        p.entry_type;
    end if;
    -- L7: cumulative UNREVERSED refunds may not exceed the parent's settled amount
    -- This is an AFTER INSERT trigger, so NEW is already visible to the sum.
    -- Adding abs(new.amount_cents) again would double-count it and reject
    -- legitimate refunds at half the real limit.
    select coalesce(abs(sum(r.amount_cents)), 0) into refunded
    from finance.ledger_entries r
    where r.parent_entry_id = p.id
      and r.entry_type = 'refund'
      and not exists (select 1 from finance.ledger_entries v
                      where v.parent_entry_id = r.id and v.entry_type = 'reversal');
    if refunded > p.amount_cents then
      raise exception 'L7: cumulative refunds % exceed settled amount % on entry %',
        refunded, p.amount_cents, p.id;
    end if;

  elsif new.entry_type = 'reversal' then
    if p.entry_type not in ('stripe_payment','external_payment','refund') then
      raise exception 'L6: a reversal may not target %', p.entry_type;
    end if;
    -- L4: a reversal exactly negates its parent
    if new.amount_cents <> -p.amount_cents then
      raise exception 'L4: reversal amount % does not negate parent amount %',
        new.amount_cents, p.amount_cents;
    end if;
    -- L6: the parent must have no UNREVERSED children. Not "no children at all":
    -- the ledger is append-only, so reversing a refund does not remove it, and a
    -- no-children rule would make the documented unwind impossible.
    -- AFTER INSERT: exclude NEW, which is itself a child of p. Counting it
    -- would make every reversal report its own parent as having an
    -- unreversed child and reject the documented unwind entirely.
    select count(*) into unreversed_kids
    from finance.ledger_entries c
    where c.parent_entry_id = p.id
      and c.id <> new.id
      and not exists (select 1 from finance.ledger_entries v
                      where v.parent_entry_id = c.id and v.entry_type = 'reversal');
    if unreversed_kids > 0 then
      raise exception 'L6: parent % has % unreversed child(ren); reverse them first',
        p.id, unreversed_kids;
    end if;

  else
    raise exception 'L1/L2: % may not carry a parent', new.entry_type;
  end if;

  return new;
end $$;

create constraint trigger ledger_invariants
  after insert on finance.ledger_entries
  for each row execute function finance.tg_ledger_invariants();

-- ------------------------------ INSERT-time protection of guarded transitions
-- Revoking UPDATE protects a transition only if the row cannot be CREATED
-- already in the destination state. The trigger is load-bearing; the
-- column-scoped grant is defence in depth (D-068).
create function finance.tg_exception_insert_guard() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
begin
  if new.resolution_status <> 'open' then
    raise exception 'a new exception must be created open, got %', new.resolution_status;
  end if;
  if new.resolved_at is not null or new.resolved_by is not null
     or new.resolution_note is not null
     or new.quarantined_at is not null or new.quarantine_reason is not null
     or new.released_at is not null or new.released_by is not null
     or new.release_note is not null then
    raise exception
      'a new exception may not be created with resolution, quarantine or release state';
  end if;
  return new;
end $$;

create trigger exception_insert_guard before insert on finance.reconciliation_exceptions
  for each row execute function finance.tg_exception_insert_guard();

create function finance.tg_run_insert_guard() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
begin
  if new.approved_by is not null or new.approved_at is not null
     or new.approval_note is not null then
    raise exception
      'a new run may not be created already approved: approval is finance.approve_dry_run() only';
  end if;
  return new;
end $$;

create trigger run_insert_guard before insert on finance.reconciliation_runs
  for each row execute function finance.tg_run_insert_guard();

-- --------------------------------------------- approved evidence is frozen
-- Keys on OLD.approved_at, not NEW: keyed on NEW the approval UPDATE itself
-- would see a non-null value and reject, making approval impossible (D-065).
create function finance.tg_run_freeze_approved() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
begin
  if old.approved_at is null then
    return new;
  end if;
  if new.status              is distinct from old.status
  or new.error               is distinct from old.error
  or new.finished_at         is distinct from old.finished_at
  or new.window_exhausted    is distinct from old.window_exhausted
  or new.window_start        is distinct from old.window_start
  or new.window_end          is distinct from old.window_end
  or new.livemode            is distinct from old.livemode
  or new.implementation_version is distinct from old.implementation_version
  or new.dry_run             is distinct from old.dry_run
  or new.would_create_count  is distinct from old.would_create_count
  or new.would_reopen_count  is distinct from old.would_reopen_count
  or new.prospective_by_kind is distinct from old.prospective_by_kind
  or new.report_samples      is distinct from old.report_samples
  or new.report_version      is distinct from old.report_version
  or new.report_completed_at is distinct from old.report_completed_at
  or new.approved_by         is distinct from old.approved_by
  or new.approved_at         is distinct from old.approved_at
  or new.approval_note       is distinct from old.approval_note
  then
    raise exception 'approved evidence is frozen: run % was approved at %',
      old.id, old.approved_at;
  end if;
  return new;
end $$;

create trigger run_freeze_approved before update on finance.reconciliation_runs
  for each row execute function finance.tg_run_freeze_approved();

-- ------------------------------------------- launch authorization (reqs 96/97)
-- A writing run must cite a dry run that is genuinely completed, exhausted,
-- finished, error-free, approved and reported, in the same mode and built from
-- the same implementation_version. The CHECK constraints alone cannot express
-- this: it depends on another row.
create function finance.tg_run_authorization() returns trigger
  language plpgsql security definer set search_path = pg_catalog, public, finance as $$
declare a finance.reconciliation_runs%rowtype;
begin
  if new.dry_run then
    return new;
  end if;

  select * into a from finance.reconciliation_runs where id = new.authorized_by_run_id;
  if not found then
    raise exception 'authorization run % does not exist', new.authorized_by_run_id;
  end if;

  if not a.dry_run then
    raise exception 'authorization run % is not a dry run', a.id;
  end if;
  if a.status <> 'completed' then
    raise exception 'authorization run % is %, not completed', a.id, a.status;
  end if;
  if not a.window_exhausted then
    raise exception 'authorization run % did not exhaust its window', a.id;
  end if;
  if a.finished_at is null then
    raise exception 'authorization run % has not finished', a.id;
  end if;
  if a.error is not null then
    raise exception 'authorization run % ended with an error', a.id;
  end if;
  if a.approved_at is null then
    raise exception 'authorization run % is not approved', a.id;
  end if;
  if a.report_completed_at is null then
    raise exception 'authorization run % has no completed report', a.id;
  end if;
  if a.livemode is distinct from new.livemode then
    raise exception 'authorization run % is livemode=%, writing run is livemode=%',
      a.id, a.livemode, new.livemode;
  end if;
  -- Material code change invalidates approval: the rehearsal exercised a
  -- different build.
  if a.implementation_version is distinct from new.implementation_version then
    raise exception 'authorization run % was version %, writing run is version %',
      a.id, a.implementation_version, new.implementation_version;
  end if;
  -- Reaching further back than what was rehearsed is not authorized.
  if new.window_start < a.window_start then
    raise exception 'writing run window_start % precedes the approved horizon %',
      new.window_start, a.window_start;
  end if;

  return new;
end $$;

create trigger run_authorization before insert on finance.reconciliation_runs
  for each row execute function finance.tg_run_authorization();
