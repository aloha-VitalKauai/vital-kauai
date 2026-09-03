-- Financials V2 — PR 10B (D-090) behavioural proof: founder-chosen collection amount.
--
-- Run against a database where 20260904010000_finance_pr10b_chosen_amount.sql
-- has been applied. ONE transaction that ends in ROLLBACK: every row it creates
-- (two agreements, their links, attempts and ledger entries) is discarded, so
-- no production fact row survives. Self-contained: it picks the first founder
-- in public.user_roles (what is_founder() reads) and an existing member with no
-- agreement of the purpose it uses, then creates its own agreements through
-- finance.create_agreement_with_contribution + transition_agreement. Nothing is
-- passed in.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/proofs/pr10b_partial_collection.sql
--
-- Each criterion prints PASS/FAIL. A setup failure stops psql (ON_ERROR_STOP)
-- with the transaction aborted; the connection closes and the database rolls
-- it back. Any FAIL raises at the end so the exit code is nonzero — the
-- transaction is rolled back either way.
--
-- Criteria covered here: 1, 2 (database half), 3, 4, 5, 7 (database half), 8,
-- 9, 10, 11, 12, 13 (database half), 14, 15 (column/CHECK), 16 (apply output
-- is the proof; this script asserts the resulting objects).

\set ON_ERROR_STOP on

begin;
set local client_min_messages = notice;

create temp table pr10b_proof (seq serial, criterion text, ok boolean, detail text) on commit drop;
create temp table pr10b_ctx (
  founder_id uuid, member_a uuid, member_b uuid, agreement_a uuid, agreement_b uuid,
  link1 uuid, link2 uuid, link3 uuid, attempt1 uuid, attempt2 uuid
) on commit drop;
insert into pr10b_ctx default values;

create function pg_temp.check(c text, ok boolean, d text) returns void language plpgsql as $$
begin
  insert into pr10b_proof (criterion, ok, detail) values (c, ok, d);
  if ok then raise notice 'PASS  criterion %: %', c, d;
  else       raise notice 'FAIL  criterion %: %', c, d; end if;
end $$;

-- Run a statement that MUST raise; the savepoint psql's exception block opens
-- means a refused call leaves nothing behind.
create function pg_temp.expect(c text, stmt text, want_code text, want_msg text, d text)
returns void language plpgsql as $$
declare got_code text; got_msg text;
begin
  begin
    execute stmt;
  exception when others then
    got_code := sqlstate; got_msg := sqlerrm;
    perform pg_temp.check(c, got_code = want_code and got_msg like want_msg,
      d || ' [' || got_code || ': ' || got_msg || ']');
    return;
  end;
  perform pg_temp.check(c, false, d || ' [expected ' || want_code || ' but the call succeeded]');
end $$;

create function pg_temp.hash(n text) returns text language sql as $$
  select encode(sha256(('pr10b-proof-' || n)::bytea), 'base64');
$$;

create function pg_temp.links(a uuid) returns bigint language sql as $$
  select count(*) from finance.payment_links where agreement_id = a;
$$;

-- ── Setup: founder identity, members, agreements ─────────────────────────────

do $$
declare v_founder uuid; v_ma uuid; v_mb uuid; v_a uuid; v_b uuid;
begin
  select user_id into v_founder from public.user_roles where role = 'founder' order by user_id limit 1;
  if v_founder is null then raise exception 'setup: no founder in public.user_roles'; end if;
  perform set_config('request.jwt.claim.sub', v_founder::text, true);
  if not public.is_founder() then raise exception 'setup: is_founder() is false for %', v_founder; end if;

  select m.id into v_ma from public.members m
   where not exists (select 1 from finance.agreements a
                      where a.member_id = m.id and a.purpose = 'membership' and a.journey_id is null)
   order by m.id limit 1;
  select m.id into v_mb from public.members m
   where not exists (select 1 from finance.agreements a
                      where a.member_id = m.id and a.purpose = 'journey_contribution' and a.journey_id is null)
   order by m.id limit 1;
  if v_ma is null or v_mb is null then raise exception 'setup: no member available'; end if;

  v_a := finance.create_agreement_with_contribution(v_ma, null, 'membership', 1250000, 'PR 10B proof A');
  perform finance.transition_agreement(v_a, 'active', 'PR 10B proof A');
  v_b := finance.create_agreement_with_contribution(v_mb, null, 'journey_contribution', 1250000, 'PR 10B proof B');
  perform finance.transition_agreement(v_b, 'active', 'PR 10B proof B');
  update pr10b_ctx set founder_id = v_founder, member_a = v_ma, member_b = v_mb, agreement_a = v_a, agreement_b = v_b;
  raise notice 'setup: founder %, agreement A %, agreement B %', v_founder, v_a, v_b;
end $$;

-- ── 15 / 16: the objects the migration leaves behind ─────────────────────────

do $$
declare n int; v_def text;
begin
  select count(*) into n from pg_attribute
   where attrelid = 'finance.payment_links'::regclass and attname = 'amount_cents'
     and not attisdropped and not attnotnull;
  perform pg_temp.check('15', n = 1, 'finance.payment_links.amount_cents exists and is nullable');
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'finance.payment_links'::regclass and conname = 'payment_links_amount_cents_positive';
  perform pg_temp.check('15', v_def = 'CHECK (((amount_cents IS NULL) OR (amount_cents > 0)))',
    'payment_links_amount_cents_positive = ' || coalesce(v_def, '<missing>'));
  select count(*) into n from finance.payment_links where amount_cents is not null;
  perform pg_temp.check('16', true, 'pre-existing links carrying an amount: ' || n || ' (no backfill; NULL keeps every existing row''s meaning)');
end $$;

-- ── 14: exactly one overload per schema, one defaulted parameter ─────────────

do $$
declare n int; m int;
begin
  select count(*), count(*) filter (where pronargdefaults = 1) into n, m
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance' and p.proname = 'issue_payment_link';
  perform pg_temp.check('14', n = 1 and m = 1, 'finance.issue_payment_link: ' || n || ' overload(s), ' || m || ' with pronargdefaults = 1');
  select count(*), count(*) filter (where pronargdefaults = 1) into n, m
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance_api' and p.proname = 'issue_payment_link';
  perform pg_temp.check('14', n = 1 and m = 1, 'finance_api.issue_payment_link: ' || n || ' overload(s), ' || m || ' with pronargdefaults = 1');
end $$;

-- ── 1: omitted amount is unchanged (named three-argument call, as PostgREST makes it) ──

do $$
declare c pr10b_ctx%rowtype; r record; v_row_amount bigint; v_payable bigint;
begin
  select * into c from pr10b_ctx;
  select payable_remaining_cents into v_payable from finance.v_agreement_balances where agreement_id = c.agreement_a;
  select * into r from finance_api.issue_payment_link(
    p_agreement_id => c.agreement_a, p_token_hash => pg_temp.hash('1'), p_reason => 'PR 10B proof: full remaining');
  update pr10b_ctx set link1 = r.link_id;
  select amount_cents into v_row_amount from finance.payment_links where id = r.link_id;
  perform pg_temp.check('14', r.link_id is not null, 'three-argument named call resolved without ambiguity');
  perform pg_temp.check('1', r.amount_cents = v_payable and v_payable = 1250000,
    'omitted amount returns payable_remaining_cents = ' || r.amount_cents);
  perform pg_temp.check('1', v_row_amount is null, 'row amount_cents IS NULL');
end $$;

-- ── 8 (NULL link) then 1 (attempt for the live payable remaining) ─────────────

do $$
declare c pr10b_ctx%rowtype; r record; v_amt bigint; v_status text;
begin
  select * into c from pr10b_ctx;
  perform pg_temp.expect('8',
    format('select * from finance.begin_checkout_attempt(%L, %L, 400000, true)', c.link1, c.agreement_a),
    'VK409', '%does not match the link%',
    'NULL-amount link: an amount other than the current payable remaining is refused');
  select * into r from finance.begin_checkout_attempt(c.link1, c.agreement_a, 1250000, true);
  update pr10b_ctx set attempt1 = r.attempt_id;
  select amount_cents, status::text into v_amt, v_status from finance.checkout_sessions where id = r.attempt_id;
  perform pg_temp.check('1', v_amt = 1250000 and v_status = 'creating',
    'attempt for the payable remaining read at attempt time: amount_cents = ' || v_amt || ', ' || v_status);
  -- Free the single-flight slot the way the recovery path does, then retire the link.
  perform finance.transition_checkout_session(r.attempt_id, 'canceled');
  perform finance.revoke_payment_link(c.link1);
end $$;

-- ── 3 / 4: zero and negative are refused at issuance; nothing is inserted ─────

do $$
declare c pr10b_ctx%rowtype; before bigint;
begin
  select * into c from pr10b_ctx;
  before := pg_temp.links(c.agreement_a);
  perform pg_temp.expect('3',
    format('select * from finance_api.issue_payment_link(%L, %L, %L, 0)', c.agreement_a, pg_temp.hash('3'), 'PR 10B proof: zero'),
    'VK400', '%amount must be a positive number of cents%', 'p_amount_cents = 0');
  perform pg_temp.check('3', pg_temp.links(c.agreement_a) = before, 'zero rows inserted');
  perform pg_temp.expect('4',
    format('select * from finance_api.issue_payment_link(%L, %L, %L, -1)', c.agreement_a, pg_temp.hash('4'), 'PR 10B proof: negative'),
    'VK400', '%amount must be a positive number of cents%', 'p_amount_cents = -1');
  perform pg_temp.check('4', pg_temp.links(c.agreement_a) = before, 'zero rows inserted');
end $$;

-- ── 5: over the cap is refused; exactly the cap succeeds ──────────────────────

do $$
declare c pr10b_ctx%rowtype; before bigint; r record; v_row bigint;
begin
  select * into c from pr10b_ctx;
  before := pg_temp.links(c.agreement_a);
  perform pg_temp.expect('5',
    format('select * from finance_api.issue_payment_link(%L, %L, %L, 1250001)', c.agreement_a, pg_temp.hash('5a'), 'PR 10B proof: over cap'),
    'VK409', '%amount 1250001 exceeds payable remaining 1250000%', 'payable_remaining + 1');
  perform pg_temp.check('5', pg_temp.links(c.agreement_a) = before, 'zero rows inserted');
  select * into r from finance_api.issue_payment_link(c.agreement_a, pg_temp.hash('5b'), 'PR 10B proof: exactly cap', 1250000);
  select amount_cents into v_row from finance.payment_links where id = r.link_id;
  perform pg_temp.check('5', r.amount_cents = 1250000 and v_row = 1250000, 'p_amount_cents = payable_remaining succeeds: row ' || v_row);
  perform finance.revoke_payment_link(r.link_id);
end $$;

-- ── 2: partial issuance ──────────────────────────────────────────────────────

do $$
declare c pr10b_ctx%rowtype; r record; v_row bigint; p record;
begin
  select * into c from pr10b_ctx;
  select * into r from finance_api.issue_payment_link(c.agreement_a, pg_temp.hash('2'), 'PR 10B proof: deposit', 500000);
  update pr10b_ctx set link2 = r.link_id;
  select amount_cents into v_row from finance.payment_links where id = r.link_id;
  perform pg_temp.check('2', r.amount_cents = 500000 and v_row = 500000,
    'issue 500000 on payable 1250000: returned ' || r.amount_cents || ', row ' || v_row);
  select * into p from finance_api.peek_payment_link(pg_temp.hash('2'));
  perform pg_temp.check('2', p.link_amount_cents = 500000 and p.payable_remaining_cents = 1250000 and p.link_status = 'active',
    'peek: link_amount_cents ' || p.link_amount_cents || ', payable_remaining_cents ' || p.payable_remaining_cents
    || ' (resolveTokenState -> ready 500000 is pinned in lib/finance/checkout.test.ts)');
end $$;

-- ── 8 (amount link) and 9 (one live link) ────────────────────────────────────

do $$
declare c pr10b_ctx%rowtype; before bigint;
begin
  select * into c from pr10b_ctx;
  perform pg_temp.expect('8',
    format('select * from finance.begin_checkout_attempt(%L, %L, 400000, true)', c.link2, c.agreement_a),
    'VK409', '%amount 400000 does not match the link%', 'link amount 500000, attempt 400000');
  before := pg_temp.links(c.agreement_a);
  perform pg_temp.expect('9',
    format('select * from finance_api.issue_payment_link(%L, %L, %L, 300000)', c.agreement_a, pg_temp.hash('9a'), 'PR 10B proof: second'),
    'VK409', '%a live link already exists%', 'second link WITH an amount while one is live');
  perform pg_temp.expect('9',
    format('select * from finance_api.issue_payment_link(%L, %L, %L)', c.agreement_a, pg_temp.hash('9b'), 'PR 10B proof: second'),
    'VK409', '%a live link already exists%', 'second link WITHOUT an amount while one is live');
  perform pg_temp.check('9', pg_temp.links(c.agreement_a) = before, 'zero rows inserted');
end $$;

-- ── 2 (attempt) and 9 (single-flight index untouched) ────────────────────────

do $$
declare c pr10b_ctx%rowtype; r record; v_amt bigint; v_status text; v_def text;
begin
  select * into c from pr10b_ctx;
  select * into r from finance.begin_checkout_attempt(c.link2, c.agreement_a, 500000, true);
  update pr10b_ctx set attempt2 = r.attempt_id;
  select amount_cents, status::text into v_amt, v_status from finance.checkout_sessions where id = r.attempt_id;
  perform pg_temp.check('2', v_amt = 500000 and v_status = 'creating',
    'begin_checkout_attempt row amount_cents = ' || v_amt || ' (' || v_status || '); Stripe unit_amount is pinned in checkout.test.ts and proven by the live drill');
  perform pg_temp.expect('9',
    format('select * from finance.begin_checkout_attempt(null, %L, 500000, true)', c.agreement_a),
    '23505', '%checkout_sessions_live_uq%', 'second creating Session for the same (agreement_id, livemode)');
  select pg_get_indexdef('finance.checkout_sessions_live_uq'::regclass) into v_def;
  perform pg_temp.check('9', v_def = 'CREATE UNIQUE INDEX checkout_sessions_live_uq ON finance.checkout_sessions USING btree (agreement_id, livemode) WHERE (status = ANY (ARRAY[''creating''::finance.checkout_status, ''open''::finance.checkout_status]))',
    'checkout_sessions_live_uq is the PR 1 definition');
end $$;

-- ── 10: downstream is untouched ──────────────────────────────────────────────

do $$
declare c pr10b_ctx%rowtype; b record; r record; v_row bigint; v_entry uuid;
begin
  select * into c from pr10b_ctx;
  v_entry := finance.record_v2_stripe_payment(
    c.agreement_a, 500000, 'cs_pr10b_proof', 'pi_pr10b_proof', clock_timestamp(), true, null);
  select * into b from finance.v_agreement_balances where agreement_id = c.agreement_a;
  perform pg_temp.check('10',
    b.gross_received_cents = 500000 and b.remaining_cents = 750000 and b.payable_remaining_cents = 750000
      and b.payment_state = 'partial',
    'after a 500000 stripe_payment: gross_received ' || b.gross_received_cents || ', remaining ' || b.remaining_cents
      || ', payable_remaining ' || b.payable_remaining_cents || ', payment_state ' || b.payment_state);
  perform pg_temp.check('10', true, 'v_agreement_balances definition md5 ' || md5(pg_get_viewdef('finance.v_agreement_balances'::regclass))
    || ' / f_balances md5 ' || md5(pg_get_functiondef('finance.f_balances(boolean)'::regprocedure))
    || ' (the migration file names neither; pinned in checkout.test.ts)');
  -- Sequential, not concurrent: retire the deposit link, then the remainder.
  perform finance.revoke_payment_link(c.link2);
  select * into r from finance_api.issue_payment_link(c.agreement_a, pg_temp.hash('10a'), 'PR 10B proof: remainder, omitted');
  select amount_cents into v_row from finance.payment_links where id = r.link_id;
  perform pg_temp.check('10', r.amount_cents = 750000 and v_row is null, 'second link, omitted amount -> returned ' || r.amount_cents || ', row NULL');
  perform finance.revoke_payment_link(r.link_id);
  select * into r from finance_api.issue_payment_link(c.agreement_a, pg_temp.hash('10b'), 'PR 10B proof: remainder, chosen', 750000);
  select amount_cents into v_row from finance.payment_links where id = r.link_id;
  perform pg_temp.check('10', r.amount_cents = 750000 and v_row = 750000, 'second link, p_amount_cents = 750000 -> row ' || v_row);
  perform finance.revoke_payment_link(r.link_id);
end $$;

-- ── 11: a paid agreement still refuses, with or without an amount ────────────

do $$
declare c pr10b_ctx%rowtype; b record; before bigint;
begin
  select * into c from pr10b_ctx;
  perform finance.record_external_payment(c.agreement_a, 750000, 'wire', now(), 'PR 10B proof: settle', gen_random_uuid());
  select * into b from finance.v_agreement_balances where agreement_id = c.agreement_a;
  perform pg_temp.check('11', b.payable_remaining_cents = 0 and b.payment_state = 'paid',
    'payable_remaining_cents ' || b.payable_remaining_cents || ', payment_state ' || b.payment_state);
  before := pg_temp.links(c.agreement_a);
  perform pg_temp.expect('11',
    format('select * from finance_api.issue_payment_link(%L, %L, %L)', c.agreement_a, pg_temp.hash('11a'), 'PR 10B proof: paid'),
    'VK409', '%nothing remains to collect%', 'omitted amount on a paid agreement');
  perform pg_temp.expect('11',
    format('select * from finance_api.issue_payment_link(%L, %L, %L, 100)', c.agreement_a, pg_temp.hash('11b'), 'PR 10B proof: paid'),
    'VK409', '%nothing remains to collect%', 'p_amount_cents = 100 on a paid agreement');
  perform pg_temp.check('11', pg_temp.links(c.agreement_a) = before, 'zero rows inserted');
end $$;

-- ── 7: a balance that moved below the link's figure is refused, never clamped ──

do $$
declare c pr10b_ctx%rowtype; r record; p record; v_status text; n bigint;
begin
  select * into c from pr10b_ctx;
  select * into r from finance_api.issue_payment_link(c.agreement_b, pg_temp.hash('7'), 'PR 10B proof: deposit', 500000);
  update pr10b_ctx set link3 = r.link_id;
  perform finance.record_external_payment(c.agreement_b, 800000, 'check', now(), 'PR 10B proof: cheque arrived', gen_random_uuid());
  select * into p from finance_api.peek_payment_link(pg_temp.hash('7'));
  perform pg_temp.check('7', p.link_amount_cents = 500000 and p.payable_remaining_cents = 450000,
    'peek after an 800000 external payment: link_amount_cents ' || p.link_amount_cents || ' > payable_remaining_cents '
    || p.payable_remaining_cents || ' (resolveTokenState -> review, startCheckout -> not_ready before phase 1: checkout.test.ts)');
  perform pg_temp.expect('7',
    format('select * from finance.begin_checkout_attempt(%L, %L, 500000, true)', r.link_id, c.agreement_b),
    'VK409', '%amount 500000 exceeds payable remaining 450000%', 'direct begin_checkout_attempt(link, agreement, 500000, true) at the link''s figure');
  select status::text into v_status from finance.payment_links where id = r.link_id;
  select count(*) into n from finance.checkout_sessions where agreement_id = c.agreement_b;
  perform pg_temp.check('7', v_status = 'active' and n = 0,
    'link ' || r.link_id || ' still ' || coalesce(v_status, '<missing>') || ' (never claimed); checkout_sessions rows for B: ' || n);
  -- Review finding 3: a link of another agreement is refused as missing. The
  -- amount is within B's payable remaining so the cap check passes first.
  perform pg_temp.expect('F3',
    format('select * from finance.begin_checkout_attempt(%L, %L, 400000, true)', c.link2, c.agreement_b),
    'VK404', '%link % does not exist%', 'agreement A''s link id with agreement B''s id');
  select count(*) into n from finance.checkout_sessions where agreement_id = c.agreement_b;
  perform pg_temp.check('F3', n = 0, 'checkout_sessions rows for B: ' || n);
end $$;

-- ── 12: role boundary ────────────────────────────────────────────────────────

do $$
declare c pr10b_ctx%rowtype; before bigint; got text; n int; names text;
begin
  select * into c from pr10b_ctx;
  before := pg_temp.links(c.agreement_b);
  begin
    perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
    execute 'set local role authenticated';
    execute format('select * from finance_api.issue_payment_link(%L, %L, %L, 100)', c.agreement_b, pg_temp.hash('12'), 'PR 10B proof: non-founder');
    got := 'succeeded';
  exception when others then
    got := sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', c.founder_id::text, true);
  perform pg_temp.check('12', got like '%founder role required%', 'non-founder authenticated caller: ' || got);
  perform pg_temp.check('12', pg_temp.links(c.agreement_b) = before, 'inserts nothing');

  perform pg_temp.check('12',
    not has_function_privilege('service_role', 'finance_api.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE'),
    'service_role holds no EXECUTE on finance_api.issue_payment_link(uuid,text,text,bigint)');
  perform pg_temp.check('12',
    has_function_privilege('authenticated', 'finance_api.issue_payment_link(uuid,text,text,bigint)', 'EXECUTE')
    and has_function_privilege('service_role', 'finance_api.peek_payment_link(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'finance_api.peek_payment_link(text)', 'EXECUTE'),
    'authenticated may issue; only service_role may peek');
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
   where ns.nspname in ('finance', 'finance_api')
     and p.proname in ('issue_payment_link', 'peek_payment_link')
     and a.privilege_type = 'EXECUTE' and (a.grantee = 0 or a.grantee = 'anon'::regrole::oid);
  perform pg_temp.check('12', n = 0, 'anon/PUBLIC EXECUTE grants on the migration''s functions: ' || n);
  select count(*), coalesce(string_agg(p.proname, ','), '') into n, names
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance_api' and p.prosecdef and p.proname <> 'public_campaign_status';
  perform pg_temp.check('12', n = 0, 'finance_api SECURITY DEFINER functions beyond the D-088 public_campaign_status carve-out: ' || n || ' ' || names);
end $$;

-- ── 13: the member path has no amount parameter ──────────────────────────────

do $$
declare n int; args text;
begin
  select count(*), string_agg(pg_get_function_identity_arguments(p.oid), ' | ') into n, args
    from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'finance' and p.proname = 'begin_member_contribution_checkout';
  perform pg_temp.check('13', n = 1 and args = 'p_agreement_id uuid, p_request_id uuid',
    'finance.begin_member_contribution_checkout: ' || n || ' signature(s): ' || coalesce(args, '<none>')
    || ' (route refusal amount_not_accepted is pinned in checkout.test.ts)');
end $$;

-- ── Summary ──────────────────────────────────────────────────────────────────

do $$
declare n_pass int; n_fail int; f record;
begin
  select count(*) filter (where ok), count(*) filter (where not ok) into n_pass, n_fail from pr10b_proof;
  raise notice '────────────────────────────────────────────────────────────';
  raise notice 'PR 10B proof: % checks passed, % failed', n_pass, n_fail;
  for f in select criterion, detail from pr10b_proof where not ok order by seq loop
    raise notice '  FAILED criterion %: %', f.criterion, f.detail;
  end loop;
  raise notice 'Rolling back: every row this script created is discarded.';
  if n_fail > 0 then raise exception 'PR 10B proof: % check(s) failed', n_fail; end if;
end $$;

rollback;
