#!/usr/bin/env bash
# Proves the harness cannot be fooled.
#
# ISOLATION CONTRACT: this script NEVER modifies the working repository. An
# earlier version did `rm -rf supabase && cp -R snapshot .` against the live
# tree; run in the background it silently reverted in-flight edits and deleted a
# test file mid-session. Every mutation now happens inside a disposable mktemp
# copy with its own database. The active branch is untouched whether this
# succeeds, fails, or is interrupted.
#
# A mutant counts as KILLED only when all five conditions hold:
#   1. pristine gate green   2. mutation verified to have landed
#   3. mutated gate red      4. restoration verified
#   5. restored gate green again
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
SRC=$(cd "$(dirname "$0")/../.." && pwd)
WORK=$(mktemp -d /tmp/fin_sabotage.XXXXXX)
DB="sab_$$"
cleanup(){ rm -rf "$WORK"; dropdb --if-exists "$DB" >/dev/null 2>&1; }
trap cleanup EXIT INT TERM

# Guard: refuse to run if WORK is not a temp dir, or resolves into the repo.
case "$WORK" in /tmp/fin_sabotage.*) ;; *) echo "FATAL: unsafe WORK=$WORK"; exit 2;; esac
case "$WORK" in "$SRC"*) echo "FATAL: WORK is inside the repo"; exit 2;; esac

cp -R "$SRC/supabase" "$WORK/supabase"
PRISTINE="$WORK/pristine"; cp -R "$SRC/supabase" "$PRISTINE"
cd "$WORK"

export PGTAP_DB="$DB"
gate(){ ( cd "$WORK" && ./supabase/tests/harness_gate.sh ) >/dev/null 2>&1; }
restore(){ rm -rf "$WORK/supabase"; cp -R "$PRISTINE" "$WORK/supabase"; }
hash_tree(){ find "$WORK/supabase" -type f \( -name '*.sql' -o -name '*.sh' -o -name '*.json' \) \
             -exec shasum {} \; | sed "s|$WORK||" | sort | shasum | cut -d' ' -f1; }

pass=0; fail=0
case_run(){ # name, command, expect_kill(1|0)
  local name="$1" cmd="$2" expect="${3:-1}"
  restore
  if ! gate; then echo "not ok - $name (PRISTINE GATE RED -- proof would be vacuous)"; fail=$((fail+1)); return; fi
  local before; before=$(hash_tree)
  ( cd "$WORK" && eval "$cmd" ) >/dev/null 2>&1 || true
  local after; after=$(hash_tree)
  if [ "$expect" -eq 1 ] && [ "$before" = "$after" ]; then
    echo "not ok - $name (MUTATION DID NOT LAND -- case is a no-op)"; fail=$((fail+1)); restore; return
  fi
  local red=0; gate || red=1
  restore
  if [ "$(hash_tree)" != "$before" ]; then echo "not ok - $name (RESTORE FAILED)"; fail=$((fail+1)); return; fi
  if ! gate; then echo "not ok - $name (GATE STILL RED AFTER RESTORE)"; fail=$((fail+1)); return; fi
  if [ "$expect" -eq 1 ]; then
    [ "$red" -eq 1 ] && { echo "ok - $name"; pass=$((pass+1)); } || { echo "not ok - $name (GATE STAYED GREEN)"; fail=$((fail+1)); }
  else
    [ "$red" -eq 0 ] && { echo "ok - $name (no defect -> gate correctly GREEN)"; pass=$((pass+1)); } || { echo "not ok - $name (NULL SABOTAGE TURNED GATE RED)"; fail=$((fail+1)); }
  fi
}

echo "== sabotage in $WORK (repo untouched); each mutant must satisfy all five conditions =="
case_run "0. NULL CONTROL (no defect)" "true" 0
case_run "1. delete a required test file"        "rm supabase/tests/finance/05_guards.sql"
case_run "2. too FEW assertions for the plan"    "perl -0pi -e 's/select plan\((\d+)\);/\"select plan(\".(\$1+1).\");\"/e' supabase/tests/finance/11_member_reads.sql"
case_run "3. too MANY assertions for the plan"   "perl -0pi -e 's/select plan\((\d+)\);/\"select plan(\".(\$1-1).\");\"/e' supabase/tests/finance/11_member_reads.sql"
case_run "4. concatenated hidden not-ok"         "perl -0pi -e \"s/select has_table\\('finance','agreements','table agreements exists'\\);/select has_table('finance','agreements','t'), has_table('finance','nope','hidden');/\" supabase/tests/finance/01_structure.sql"
case_run "5. real assertion -> ok(true)"         "perl -0pi -e \"s/select is\\(\\(select count\\(\\*\\)::int from finance.ledger_entries\\), 1,/select ok(true,/\" supabase/tests/finance/11_member_reads.sql"
case_run "6. unrelated SQL error in a throws"    "perl -0pi -e \"s/from finance.ledger_entries where entry_type='refund'/from finance.ledger_entries where bogus_col='refund'/\" supabase/tests/finance/04_coverage.sql"
case_run "7. break a concurrency assertion"      "perl -0pi -e \"s/,1,\\s*\\n  'req 21: exactly one transition from draft committed'/,999,\\n  'req 21: exactly one transition from draft committed'/\" supabase/tests/concurrency.sh"
case_run "8. remove an append-only trigger"      "perl -0pi -e 's/create trigger append_only before update or delete on finance.ledger_entries\n  for each row execute function finance.tg_append_only\(\);//' supabase/migrations/20260730000005_finance_triggers.sql"
case_run "9. remove an RLS policy"               "perl -0pi -e 's/create policy member_reads_own_ledger[^;]*;//s' supabase/migrations/20260730000008_finance_rls_grants.sql"
case_run "10. widen a grant"                     "printf '\ngrant update on finance.agreements to authenticated;\n' >> supabase/migrations/20260730000008_finance_rls_grants.sql"
case_run "11. relax a CHECK constraint"          "perl -0pi -e 's/check \(amount_cents <> 0\)/check (true)/' supabase/migrations/20260730000003_finance_tables.sql"
case_run "12. SECURITY DEFINER -> INVOKER"       "perl -0pi -e 's/(create function finance.current_member_id\(\) returns uuid\n  language sql stable )security definer/\${1}security invoker/' supabase/migrations/20260730000006_finance_functions.sql"
case_run "13. drop a required foreign key"       "perl -0pi -e 's/references public.members\(id\) on delete restrict//' supabase/migrations/20260730000003_finance_tables.sql"
case_run "14. founder predicate off the test view" "perl -0pi -e 's/ where public.is_founder\(\);/;/' supabase/migrations/20260730000007_finance_views.sql"
case_run "15. livemode filter off a member policy" "perl -0pi -e 's/using \(livemode = true and exists \(/using (exists (/' supabase/migrations/20260730000008_finance_rls_grants.sql"

echo "== sabotage: killed=$pass failed=$fail =="
[ "$fail" -eq 0 ]
