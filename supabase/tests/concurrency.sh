#!/usr/bin/env bash
# Financials V2 PR 1 — TRUE multi-session concurrency tests (B-74).
# Requirements 21, 35, 37, 50, 101.
#
# Two persistent psql sessions are driven through FIFOs so statements interleave
# deterministically. These demonstrate actual locking and race OUTCOMES; they do
# not inspect for the presence of FOR UPDATE.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-${PGTAP_DB:-fin_v2}_conc}"
D=$(mktemp -d)
trap 'rm -rf "$D"; kill %1 %2 2>/dev/null' EXIT

# F5 (2nd review): every build step rc-checked; a half-built database must
# abort here, not surface later as a mysterious assertion failure.
dropdb --if-exists "$DB" || exit 2
createdb "$DB" || exit 2
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql || exit 2
MIGS=$(./supabase/tests/list_migrations.sh) || { echo "ENUMERATOR FAILED"; exit 2; }
while IFS= read -r f; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" || { echo "MIGRATION FAILED: $f"; exit 2; }
done <<< "$MIGS"

psql -q -d "$DB" <<'SQL'
create table conc_result(name text primary key, detail text);
insert into auth.users (id,email) values
  ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.user_roles values ('11111111-1111-1111-1111-111111111111','founder');
insert into public.member_profiles values ('11111111-1111-1111-1111-111111111111','f@t');
insert into public.members (id,profile_id,email)
  values ('aaaaaaaa-0000-0000-0000-00000000000a','11111111-1111-1111-1111-111111111111','f@t');
insert into public.journeys (id,name) values ('cccccccc-0000-0000-0000-00000000000c','J');
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select finance.create_agreement('aaaaaaaa-0000-0000-0000-00000000000a','cccccccc-0000-0000-0000-00000000000c','journey_contribution','init');
SQL

AG=$(psql -tA -d "$DB" -c "select id from finance.agreements limit 1")

mkfifo "$D/f1" "$D/f2"
# B-82: each session carries a unique application_name so every blocking claim
# can name the exact backend it is about, never "some backend somewhere".
APP1="conc_s1_$$"; APP2="conc_s2_$$"
PGAPPNAME="$APP1" psql -q -X -d "$DB" -v ON_ERROR_STOP=0 < "$D/f1" > "$D/o1" 2>&1 &
PGAPPNAME="$APP2" psql -q -X -d "$DB" -v ON_ERROR_STOP=0 < "$D/f2" > "$D/o2" 2>&1 &
exec 3> "$D/f1"; exec 4> "$D/f2"
P1=$(jobs -p | head -1); P2=$(jobs -p | tail -1)
backend_pid(){ psql -tA -d "$DB" -c "select pid from pg_stat_activity where datname=current_database() and application_name='$1'"; }
BPID1=""; BPID2=""
for i in $(seq 1 50); do
  BPID1=$(backend_pid "$APP1"); BPID2=$(backend_pid "$APP2")
  [ -n "$BPID1" ] && [ -n "$BPID2" ] && break
  sleep 0.2
done
[ -n "$BPID1" ] && [ -n "$BPID2" ] || { echo "FATAL: could not resolve session backend pids"; exit 1; }
s1(){ echo "$1" >&3; }; s2(){ echo "$1" >&4; }
# ---------------------------------------------------------------- helpers
# Finding 7: prove blocking DETERMINISTICALLY. Marker-absence is also produced
# by a dead child, an undrained FIFO, or a slow machine, so it is not evidence.
# We poll pg_stat_activity for the session actually waiting on a Lock.
alive(){ kill -0 "$1" 2>/dev/null; }

require_alive(){
  if ! alive "$P1" || ! alive "$P2"; then
    echo "FATAL: a child psql exited early (P1=$P1 P2=$P2) during: $1" >&2
    psql -q -d "$DB" -c "insert into conc_result values ('child_died_$1','yes') on conflict do nothing" 2>/dev/null
    exit 1
  fi
}

# wait_blocked <label> <backend_pid> -> writes yes/no into conc_result.
# B-82: inspects EXACTLY the named backend. The old form accepted ANY backend
# waiting on a lock, so a straggler from a previous scenario could satisfy a
# later scenario's claim without that scenario's statement ever blocking.
wait_blocked(){
  local label="$1" want_pid="$2" i out=no
  [ -n "$want_pid" ] || { echo "FATAL: wait_blocked called without a pid ($label)"; exit 1; }
  for i in $(seq 1 50); do
    out=$(psql -tA -d "$DB" -c "
      select count(*) from pg_stat_activity
      where datname = current_database()
        and pid = $want_pid
        and wait_event_type = 'Lock'")
    [ "${out:-0}" -ge 1 ] && { out=yes; break; }
    sleep 0.2
  done
  [ "$out" = yes ] || out=no
  require_alive "$label"
  psql -q -d "$DB" -c "insert into conc_result values ('${label}','${out}') on conflict (name) do update set detail=excluded.detail"
}

# scenario_drain <label>: no scenario may start while a session backend is still
# in a transaction or waiting. Replaces blind sleeps with observed quiescence.
scenario_drain(){
  local label="$1" i n=1
  for i in $(seq 1 100); do
    n=$(psql -tA -d "$DB" -c "
      select count(*) from pg_stat_activity
      where pid in ($BPID1,$BPID2)
        and (state <> 'idle' or wait_event_type = 'Lock')")
    [ "${n:-1}" -eq 0 ] && break
    sleep 0.2
  done
  if [ "${n:-1}" -ne 0 ]; then
    echo "FATAL: a session backend survived scenario '$label' still busy/blocked"; exit 1
  fi
}


UID1="'11111111-1111-1111-1111-111111111111'"

# ---------------------------------------------------- req 21: lifecycle race
s1 "begin; select set_config('request.jwt.claim.sub',$UID1,true);"
s2 "begin; select set_config('request.jwt.claim.sub',$UID1,true);"
s1 "insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) values ('$AG','draft','active','s1',$UID1);"
sleep 1
# S2 attempts the SAME transition; must block on the agreement row lock held by S1.
s2 "insert into finance.agreement_lifecycle_events(agreement_id,from_status,to_status,reason,actor_id) values ('$AG','draft','canceled','s2',$UID1);"
wait_blocked r21_s2_blocked "$BPID2"
s1 "commit;"
sleep 2
s2 "commit;"
scenario_drain r21


# --------------------------------------------------- req 37: link claim race
psql -q -d "$DB" -c "insert into finance.payment_links(agreement_id,token_hash,expires_at,created_by) values ('$AG','tok1',now()+interval '7 days',$UID1)"
s1 "begin;"
s2 "begin;"
s1 "update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok1' and status='active';"
sleep 1
s2 "update finance.payment_links set status='creating', claimed_at=now() where token_hash='tok1' and status='active';"
wait_blocked r37_s2_blocked "$BPID2"
s1 "commit;"
sleep 2
s2 "commit;"
scenario_drain r37


# ------------------------------------------- req 50: concurrent refunds (L7)
psql -q -d "$DB" -c "insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,provider_payment_intent_id,occurred_at,livemode) values ('$AG','stripe_payment',100000,'stripe','ch_c','pi_c',now(),true)"
PAY=$(psql -tA -d "$DB" -c "select id from finance.ledger_entries where entry_type='stripe_payment' limit 1")
s1 "begin;"
s2 "begin;"
s1 "insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) values ('$AG','refund',-60000,'stripe','re_a','$PAY',now(),true);"
sleep 1
s2 "insert into finance.ledger_entries(agreement_id,entry_type,amount_cents,source,provider_object_id,parent_entry_id,occurred_at,livemode) values ('$AG','refund',-60000,'stripe','re_b','$PAY',now(),true);"
wait_blocked r50_s2_blocked "$BPID2"
s1 "commit;"
sleep 2
s2 "commit;"
scenario_drain r50

# ------------------------------------- req 35: one live session per agreement
s1 "begin;"
s2 "begin;"
s1 "insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) values ('$AG','k1',5000,true,now()+interval '1 hour');"
sleep 1
s2 "insert into finance.checkout_sessions(agreement_id,idempotency_key,amount_cents,livemode,expires_at) values ('$AG','k2',5000,true,now()+interval '1 hour');"
wait_blocked r35_s2_blocked "$BPID2"
s1 "commit;"
sleep 2
s2 "commit;"
scenario_drain r35


exec 3>&-; exec 4>&-
sleep 1

# ------------------------- req 101: quarantine ordering, two full cycles
# S2's transaction BEGINS BEFORE S1's opposing transition commits, so its now()
# is stale. Only clock_timestamp() + GREATEST can keep the ordering correct.
psql -q -d "$DB" <<SQL
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
insert into finance.reconciliation_exceptions(kind,livemode,provider_object_id,detail,consecutive_failure_runs)
values ('provider_object_processing_failed',true,'ch_q',
        '{"object_type":"charge","error_class":"object_not_found"}'::jsonb,3);
SQL
EXC=$(psql -tA -d "$DB" -c "select id from finance.reconciliation_exceptions where provider_object_id='ch_q'")

mkfifo "$D/g1" "$D/g2"
psql -q -X -d "$DB" < "$D/g1" > "$D/p1" 2>&1 &
psql -q -X -d "$DB" < "$D/g2" > "$D/p2" 2>&1 &
exec 5> "$D/g1"; exec 6> "$D/g2"
t1(){ echo "$1" >&5; }; t2(){ echo "$1" >&6; }

for cycle in 1 2; do
  # S2 opens FIRST so its transaction timestamp precedes S1's commit.
  t2 "begin; select set_config('request.jwt.claim.sub',$UID1,true); select now();"
  sleep 1
  t1 "begin; select set_config('request.jwt.claim.sub',$UID1,true); select finance.quarantine_object('$EXC'); commit;"
  sleep 2
  # S2 now releases from its OLD transaction snapshot; now() is stale.
  t2 "select finance.release_quarantine('$EXC','cycle $cycle'); commit;"
  sleep 2
  psql -q -d "$DB" -c "insert into conc_result values ('r101_cycle${cycle}_released_after_quarantined', (select (released_at > quarantined_at)::text from finance.reconciliation_exceptions where id='$EXC'))"
  psql -q -d "$DB" -c "insert into conc_result values ('r101_cycle${cycle}_not_equal', (select (released_at <> quarantined_at)::text from finance.reconciliation_exceptions where id='$EXC'))"
  psql -q -d "$DB" -c "update finance.reconciliation_exceptions set consecutive_failure_runs=3 where id='$EXC'"
done
exec 5>&-; exec 6>&-
sleep 1

# --------------------------------------------------------------- assertions
TAPOUT=$(mktemp)
psql -X -q -tA -d "$DB" > "$TAPOUT" 2>&1 <<'SQL'
create extension if not exists pgtap;
select plan(14);
select is((select detail from conc_result where name='r21_s2_blocked'),'yes',
  'req 21: the second concurrent lifecycle transition BLOCKS on the agreement row lock');
select is((select count(*)::int from finance.agreement_lifecycle_events where from_status='draft'),1,
  'req 21: exactly one transition from draft committed');
select is((select current_status::text from finance.v_agreement_lifecycle),'active',
  'req 21: the winner is S1; S2 was rejected as stale');
select is((select detail from conc_result where name='r37_s2_blocked'),'yes',
  'req 37: the second concurrent link claim BLOCKS');
select is((select count(*)::int from finance.payment_links where status='creating'),1,
  'req 37: exactly one claimant; the loser changed nothing');
select is((select detail from conc_result where name='r50_s2_blocked'),'yes',
  'req 50: the second concurrent refund BLOCKS on the parent row lock (finding 6)');
select is((select detail from conc_result where name='r35_s2_blocked'),'yes',
  'req 35: the second concurrent live-session insert BLOCKS');
select is((select coalesce(abs(sum(amount_cents)),0)::bigint from finance.ledger_entries where entry_type='refund'),60000::bigint,
  'req 50: only one concurrent refund committed; L7 rejected the second');
select is((select net_received_cents from finance.v_agreement_balances),40000::bigint,
  'req 50: cumulative refunds never exceeded the settled amount');
select is((select count(*)::int from finance.checkout_sessions where status in ('creating','open')),1,
  'req 35: exactly one live session survived the concurrent insert');
select is((select detail from conc_result where name='r101_cycle1_released_after_quarantined'),'true',
  'req 101 cycle 1: released_at > quarantined_at despite S2 starting first');
select is((select detail from conc_result where name='r101_cycle2_released_after_quarantined'),'true',
  'req 101 cycle 2: ordering holds across a second full cycle');
select is((select bool_and(detail='true')::text from conc_result where name like 'r101%not_equal'),'true',
  'req 101: no equality in either cycle');
select is((select count(*)::int from conc_result where name like 'child_died%'),0,
  'no child psql session exited early during any test (finding 7)');
select * from finish();
SQL

cat "$TAPOUT"
if grep -q '^not ok' "$TAPOUT"; then
  echo "CONCURRENCY FAILURES:"; grep '^not ok' "$TAPOUT"; rm -f "$TAPOUT"; exit 1
fi
if ! grep -q '^ok 14' "$TAPOUT"; then
  echo "not ok - concurrency suite did not run all 14 assertions"; rm -f "$TAPOUT"; exit 1
fi
rm -f "$TAPOUT"
exit 0
