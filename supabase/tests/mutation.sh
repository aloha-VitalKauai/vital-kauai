#!/usr/bin/env bash
# Mutation testing. A safeguard is NOT considered covered unless removing or
# altering it makes the suite fail. Each mutant disables one safeguard on a
# throwaway database, re-runs the suites, and REQUIRES failures.
#
# B-80: the verdict authority is `prove` over runsql.sh -- the SAME TAP parser
# and plan enforcement as the main gate. The previous version counted `^not ok`
# lines itself with psql exit codes ignored, so a test file that ERRORed on its
# first statement contributed a silent zero and the baseline passed with entire
# files unexecuted. Now: a SQL error anywhere bails the file, prove sees the
# bail, and the baseline is not green.
# B-79: the database is built from the canonical enumerator, never a glob.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
DB="${PGTAP_DB:-fin_v2}_mut"
pass=0; fail=0

build(){
  local mig
  mig=$(./supabase/tests/list_migrations.sh) || { echo "ENUMERATOR FAILED" >&2; return 1; }
  dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB" || return 1
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql >/dev/null || return 1
  while IFS= read -r f; do
    psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null || return 1
  done <<< "$mig"
}
suite_green(){  # exit 0 iff prove passes every file with its plan intact
  PGTAP_DB="$DB" prove --exec "bash supabase/tests/runsql.sh" supabase/tests/finance/*.sql >/dev/null 2>&1
}
mutant(){ # name, sql-to-apply
  build || { echo "not ok - $1 (build failed)"; fail=$((fail+1)); return; }
  if ! suite_green; then echo "not ok - $1 (BASELINE NOT GREEN under prove -- unexecuted or failing files)"; fail=$((fail+1)); return; fi
  if ! psql -q -d "$DB" -v ON_ERROR_STOP=1 -c "$2" >/dev/null 2>&1; then
    echo "not ok - $1 (MUTATION FAILED TO APPLY -- nothing was tested)"; fail=$((fail+1)); return
  fi
  if ! suite_green; then
    echo "ok - $1 (removing the safeguard fails the suite under prove)"; pass=$((pass+1))
  else
    echo "not ok - $1 (SAFEGUARD REMOVED AND EVERY TEST STILL PASSED)"; fail=$((fail+1))
  fi
}

echo "== mutation tests =="
mutant "append-only on ledger_entries"            "drop trigger append_only on finance.ledger_entries"
mutant "append-only on agreement_amounts"         "drop trigger append_only on finance.agreement_amounts"
mutant "append-only on agreement_lifecycle_events" "drop trigger append_only on finance.agreement_lifecycle_events"
mutant "payment_links insert guard"               "drop trigger link_insert_guard on finance.payment_links"
mutant "payment_links revocation terminality"     "drop trigger link_revocation_terminal on finance.payment_links"
mutant "launch-authorization trigger"             "drop trigger run_authorization on finance.reconciliation_runs"
mutant "exception insert guard"                   "drop trigger exception_insert_guard on finance.reconciliation_exceptions"
mutant "run insert guard"                         "drop trigger run_insert_guard on finance.reconciliation_runs"
mutant "approved-evidence freeze"                 "drop trigger run_freeze_approved on finance.reconciliation_runs"
mutant "ledger invariants L3b/L4/L6/L7/L11"       "drop trigger ledger_invariants on finance.ledger_entries"
mutant "lifecycle transition validation"          "drop trigger lifecycle_transition on finance.agreement_lifecycle_events"
mutant "agreement completeness (deferred)"        "drop trigger agreement_has_lifecycle on finance.agreements"
mutant "lifecycle view ordering drift"            "create or replace view finance.v_agreement_lifecycle with (security_invoker=true,security_barrier=true) as select distinct on (e.agreement_id) e.agreement_id, e.to_status as current_status, e.occurred_at as since, e.actor_id, e.reason from finance.agreement_lifecycle_events e order by e.agreement_id, e.occurred_at asc, e.seq asc"

dropdb --if-exists "$DB" >/dev/null 2>&1
echo "== mutation: survived=$fail killed=$pass =="
[ "$fail" -eq 0 ]
