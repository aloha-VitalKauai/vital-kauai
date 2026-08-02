#!/usr/bin/env bash
# Self-test of denied() -- the harness's own rejection primitive.
#
# WHY THIS EXISTS: sabotage case 23 (weaken denied() to accept any SQLSTATE)
# SURVIVED the mutation protocol. Weakening the checker makes every existing
# test MORE likely to pass, so no behavioural suite can catch it; the checker
# must be tested against probes whose expectations are deliberately wrong.
#
# Runs outside prove: denied() emits pgTAP result lines, which would corrupt a
# plan. Here its return text is captured as data and asserted on directly.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
DB="${PGTAP_DB:-fin_v2}"
pass=0; fail=0
chk(){ if eval "$2" >/dev/null 2>&1; then echo "ok - $1"; pass=$((pass+1)); else echo "not ok - $1"; fail=$((fail+1)); fi; }

OUT=$(psql -tAq -v ON_ERROR_STOP=0 -d "$DB" <<'SQL'
begin;
create extension if not exists pgtap;
select * from no_plan();
select 'R1|' || denied($$ do $x$ begin raise exception 'synthetic guard fired' using errcode='P0001'; end $x$ $$,
                       'P0001', 'synthetic guard fired', 'correct expectation');
select 'R2|' || denied($$ do $x$ begin raise exception 'synthetic guard fired' using errcode='P0001'; end $x$ $$,
                       '23505', 'synthetic guard fired', 'wrong sqlstate expected');
select 'R3|' || denied($$ do $x$ begin raise exception 'synthetic guard fired' using errcode='P0001'; end $x$ $$,
                       'P0001', 'an entirely different guard', 'wrong identifier expected');
select 'R4|' || denied($$ select 1 $$, 'P0001', 'anything', 'no exception raised');
select 'R7|' || denied($$ do $x$ begin raise exception 'resolve_exception: exception 42 not found' using errcode='P0001'; end $x$ $$,
                       'P0001', 'founder role required', 'B-84: same function, wrong internal raise');
rollback;
SQL
)
NULLSTATE=$(psql -tAq -d "$DB" -c "select denied('select 1', null, 'x', 'null state must raise')" 2>&1 || true)
NULLIDENT=$(psql -tAq -d "$DB" -c "select denied('select 1', 'P0001', '', 'empty ident must raise')" 2>&1 || true)
NUMIDENT=$(psql -tAq -d "$DB" -c "select denied('select 1', 'P0001', '12345', 'numeric ident must raise')" 2>&1 || true)
UUIDIDENT=$(psql -tAq -d "$DB" -c "select denied('select 1', 'P0001', 'a3f1c2d4-0000-4b6e-9a10-abcdefabcdef', 'uuid ident must raise')" 2>&1 || true)

chk "a correct expectation passes (control: the primitive is not simply broken)" \
  "printf '%s' \"\$OUT\" | grep -q '^R1|ok'"
chk "a WRONG SQLSTATE is rejected -- denied() cannot be weakened to accept any error" \
  "printf '%s' \"\$OUT\" | grep -q '^R2|not ok'"
chk "a WRONG guard identifier is rejected -- an unrelated error with the right state fails" \
  "printf '%s' \"\$OUT\" | grep -q '^R3|not ok'"
chk "a write that is ALLOWED is reported as a failure, never a pass" \
  "printf '%s' \"\$OUT\" | grep -q '^R4|not ok'"
chk "B-84: a DIFFERENT internal raise of the same function is rejected -- 'not found' cannot satisfy 'founder role required'" \
  "printf '%s' \"\$OUT\" | grep -q '^R7|not ok'"
chk "a null expected-SQLSTATE raises -- no site can leave the state unspecified" \
  "printf '%s' \"\$NULLSTATE\" | grep -q 'p_state is required'"
chk "an empty guard identifier raises -- no site can leave the guard unspecified" \
  "printf '%s' \"\$NULLIDENT\" | grep -q 'p_ident is required'"
chk "LOW-4: a purely NUMERIC ident raises -- it would normalize to '#' and match nearly anything" \
  "printf '%s' \"\$NUMIDENT\" | grep -q 'normalizes to nothing'"
chk "LOW-4: a bare UUID ident raises for the same reason" \
  "printf '%s' \"\$UUIDIDENT\" | grep -q 'normalizes to nothing'"

echo "# helper selftest: passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
