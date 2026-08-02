#!/usr/bin/env bash
# Mutation testing. A safeguard is NOT considered covered unless removing or
# altering it makes the suite fail. Each mutant disables one safeguard on a
# throwaway database, re-runs the suites, and REQUIRES failures.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
DB="${PGTAP_DB:-fin_v2}_mut"
pass=0; fail=0

build(){
  dropdb --if-exists "$DB" >/dev/null 2>&1; createdb "$DB"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql >/dev/null
  for f in supabase/migrations/2026073000000*.sql; do
    psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" >/dev/null || return 1
  done
}
suite_failures(){
  local n=0
  for t in supabase/tests/finance/*.sql; do
    n=$((n + $(psql -X -q -tA -d "$DB" -f "$t" 2>&1 | grep -c '^not ok')))
  done
  echo "$n"
}
mutant(){ # name, sql-to-apply
  build || { echo "not ok - $1 (build failed)"; fail=$((fail+1)); return; }
  local base; base=$(suite_failures)
  if [ "$base" -ne 0 ]; then echo "not ok - $1 (baseline not green: $base)"; fail=$((fail+1)); return; fi
  psql -q -d "$DB" -c "$2" >/dev/null 2>&1
  local after; after=$(suite_failures)
  if [ "$after" -gt 0 ]; then
    echo "ok - $1 (removing the safeguard caused $after failure(s))"; pass=$((pass+1))
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
