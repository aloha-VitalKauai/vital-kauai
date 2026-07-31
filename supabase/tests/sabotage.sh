#!/usr/bin/env bash
# Proves the harness cannot be fooled. Each case injects one defect, runs the
# FULL gate, and REQUIRES a nonzero exit. A case that leaves the gate green is
# itself a harness defect.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
SNAP=$(mktemp -d); cp -R supabase "$SNAP/"
restore(){ rm -rf supabase; cp -R "$SNAP/supabase" .; }
trap 'restore; rm -rf "$SNAP"' EXIT

pass=0; fail=0
case_run(){ # name, sabotage-command
  restore
  eval "$2" >/dev/null 2>&1
  if ./supabase/tests/harness_gate.sh >/dev/null 2>&1; then
    echo "not ok - $1 (GATE STAYED GREEN)"; fail=$((fail+1))
  else
    echo "ok - $1 (gate failed, as required)"; pass=$((pass+1))
  fi
}

echo "== sabotage: every case must make the gate exit nonzero =="
case_run "1. delete a required test file"          "rm supabase/tests/finance/05_guards.sql"
# Target whatever the plan currently is, so these cases cannot silently stop
# matching when a test file legitimately grows.
case_run "2. too FEW assertions for the plan" "perl -0pi -e 's/select plan\((\d+)\);/\"select plan(\".(\$1+1).\");\"/e' supabase/tests/finance/11_member_reads.sql"
case_run "3. too MANY assertions for the plan" "perl -0pi -e 's/select plan\((\d+)\);/\"select plan(\".(\$1-1).\");\"/e' supabase/tests/finance/11_member_reads.sql"
case_run "4. concatenated hidden not-ok"           "perl -0pi -e 's/select has_table\(.finance.,.agreements.,.table agreements exists.\);/select has_table(\"finance\",\"agreements\",\"table agreements exists\"), has_table(\"finance\",\"nope\",\"hidden\");/' supabase/tests/finance/01_structure.sql"
case_run "5. replace a real assertion with ok(true)" "perl -0pi -e 's/select is\(\(select count\(\*\)::int from finance.ledger_entries\), 1,/select ok(true,/' supabase/tests/finance/11_member_reads.sql"
case_run "6. unrelated SQL error inside a throws" "perl -0pi -e \"s/from finance.ledger_entries where entry_type='refund'/from finance.ledger_entries where bogus_col='refund'/\" supabase/tests/finance/04_coverage.sql"
case_run "7. break a concurrency assertion" "perl -0pi -e \"s/,1,\\s*\\n  'req 21: exactly one transition from draft committed'/,999,\\n  'req 21: exactly one transition from draft committed'/\" supabase/tests/concurrency.sh"
case_run "8. remove an append-only trigger"        "perl -0pi -e 's/create trigger append_only before update or delete on finance.ledger_entries\n  for each row execute function finance.tg_append_only\(\);//' supabase/migrations/20260730000005_finance_triggers.sql"
case_run "9. remove an RLS policy"                 "perl -0pi -e 's/create policy member_reads_own_ledger[^;]*;//s' supabase/migrations/20260730000008_finance_rls_grants.sql"
case_run "10. widen a grant"                       "printf '\ngrant update on finance.agreements to authenticated;\n' >> supabase/migrations/20260730000008_finance_rls_grants.sql"
case_run "11. relax a CHECK constraint"            "perl -0pi -e 's/check \(amount_cents <> 0\)/check (true)/' supabase/migrations/20260730000003_finance_tables.sql"

restore
echo "== sabotage: caught=$pass missed=$fail =="
[ "$fail" -eq 0 ]
