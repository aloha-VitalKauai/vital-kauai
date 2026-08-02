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
# A signal must END the run, not just clean up: without the exit, a SIGTERM
# mid-case deleted the workspace and every later case failed vacuously.
trap 'cleanup; trap - EXIT; echo "== sabotage: INTERRUPTED -- results above are valid, run is INCOMPLETE =="; exit 143' INT TERM
trap cleanup EXIT

# Guard: refuse to run if WORK is not a temp dir, or resolves into the repo.
case "$WORK" in /tmp/fin_sabotage.*) ;; *) echo "FATAL: unsafe WORK=$WORK"; exit 2;; esac
case "$WORK" in "$SRC"*) echo "FATAL: WORK is inside the repo"; exit 2;; esac

cp -R "$SRC/supabase" "$WORK/supabase"
PRISTINE="$WORK/pristine"; cp -R "$SRC/supabase" "$PRISTINE"
cd "$WORK"

export PGTAP_DB="$DB"
gate(){ ( cd "$WORK" && ./supabase/tests/harness_gate.sh ) >/dev/null 2>&1; }
restore(){
  [ -d "$PRISTINE" ] || { echo "FATAL: pristine snapshot missing -- aborting instead of producing vacuous results"; exit 3; }
  rm -rf "$WORK/supabase"; cp -R "$PRISTINE" "$WORK/supabase"; }
hash_tree(){ find "$WORK/supabase" -type f \( -name '*.sql' -o -name '*.sh' -o -name '*.json' -o -name '*.py' \) \
             -exec shasum {} \; | sed "s|$WORK||" | sort | shasum | cut -d' ' -f1; }

pass=0; fail=0
LAST_GREEN=""   # tree-hash most recently PROVEN green by an executed gate run
case_run(){ # name, command, expect_kill(1|0)
  local name="$1" cmd="$2" expect="${3:-1}"
  # SABOTAGE_ONLY="12 13 22b": run a subset so long protocols can be executed in
  # resumable chunks. Every selected case still executes all five conditions.
  if [ -n "${SABOTAGE_ONLY:-}" ]; then
    local id="${name%%.*}"
    case " $SABOTAGE_ONLY " in *" $id "*) ;; *) return;; esac
  fi
  restore
  local before; before=$(hash_tree)
  # Condition 1 (pristine green). If this exact tree-hash was proven green by the
  # immediately preceding executed gate run (condition 5 of the prior case), the
  # result carries over -- same bytes, same build, same result. Otherwise execute.
  if [ "$before" = "$LAST_GREEN" ]; then
    echo "# $name: pristine green carried over (tree-hash identical to last executed green gate)"
  else
    if ! gate; then echo "not ok - $name (PRISTINE GATE RED -- proof would be vacuous)"; fail=$((fail+1)); return; fi
    LAST_GREEN="$before"
  fi
  ( cd "$WORK" && eval "$cmd" ) >/dev/null 2>&1 || true
  local after; after=$(hash_tree)
  if [ "$expect" -eq 1 ] && [ "$before" = "$after" ]; then
    echo "not ok - $name (MUTATION DID NOT LAND -- case is a no-op)"; fail=$((fail+1)); restore; return
  fi
  local red=0; gate || red=1
  restore
  if [ "$(hash_tree)" != "$before" ]; then echo "not ok - $name (RESTORE FAILED)"; fail=$((fail+1)); return; fi
  if ! gate; then echo "not ok - $name (GATE STILL RED AFTER RESTORE)"; fail=$((fail+1)); return; fi
  LAST_GREEN="$before"
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


# ---- COMMENT-DISGUISE CASES ----------------------------------------------
# Each removes the real mechanism but leaves the words a naive grep looked for
# inside an SQL comment. A text-matching check passes; the gate must still fail.
case_run "16. version assert removed, words left in a comment" \
  "python3 -c \"
import re,io
p='supabase/migrations/20260730000001_finance_harden_is_founder.sql'; s=open(p).read()
s=re.sub(r'(?m)^.*server_version_num.*\$', '-- server_version_num assertion (text only, mechanism deleted)', s)
open(p,'w').write(s)\""
case_run "17. is_founder() execution removed, words left in a comment" \
  "python3 -c \"
import re
p='supabase/migrations/20260730000001_finance_harden_is_founder.sql'; s=open(p).read()
s=re.sub(r'(?m)^.*select public\.is_founder\(\) into.*\$', '-- select public.is_founder() into ok (text only, mechanism deleted)', s)
open(p,'w').write(s)\""
case_run "18. rollback search_path reset removed, words left in a comment" \
  "python3 -c \"
import re
p='supabase/migrations/ROLLBACK_pr1.sql'; s=open(p).read()
s=re.sub(r'(?mi)^.*reset search_path.*\$', '-- reset search_path (text only, mechanism deleted)', s)
open(p,'w').write(s)\""
case_run "19. security_invoker stripped from v_agreement_lifecycle, word left in a comment" \
  "python3 -c \"
p='supabase/migrations/20260730000007_finance_views.sql'; s=open(p).read()
i=s.index('create view finance.v_agreement_lifecycle')
j=s.index(' as', i)
s=s[:i]+'-- security_invoker = true (text only, option deleted)\n'+'create view finance.v_agreement_lifecycle'+s[j:]
open(p,'w').write(s)\""
case_run "20. legacy-table reference added inside a routine, denial left in a comment" \
  "python3 -c \"
p='supabase/migrations/20260730000006_finance_functions.sql'; s=open(p).read()
s=s.replace('create function finance.current_member_id()',
  '-- no finance object references a legacy financial table\ncreate function finance.current_member_id()',1)
s=s.replace('from public.members m', 'from public.members m left join public.donations d on false',1)
open(p,'w').write(s)\""
case_run "21. an untracked object added to the finance schema" \
  "printf '\ncreate table finance.smuggled_in (id uuid primary key);\n' >> supabase/migrations/20260730000003_finance_tables.sql"

case_run "22. req 121 resolution guard removed" \
  "perl -0pi -e 's/create trigger exception_resolution_guard\n  before update on finance.reconciliation_exceptions\n  for each row execute function finance.tg_exception_resolution_guard\(\);//' supabase/migrations/20260730000005_finance_triggers.sql"
case_run "22b. resolution-column grant widened to authenticated" \
  "printf '\ngrant update (resolution_status, resolved_at, resolved_by, resolution_note) on finance.reconciliation_exceptions to authenticated;\n' >> supabase/migrations/20260730000008_finance_rls_grants.sql"
case_run "22c. resolution guard weakened to trust a caller-settable setting" \
  "perl -0pi -e \"s/if current_user::regrole::oid <> trusted_owner then/if coalesce(current_setting('finance.resolution_write', true), '') <> 'on' and false then/\" supabase/migrations/20260730000005_finance_triggers.sql"
case_run "23. denied() weakened to accept any SQLSTATE" \
  "perl -0pi -e 's/if state <> p_state then/if false then/' supabase/tests/_test_helpers.sql"
# Case 24 is a DOCUMENTED EQUIVALENT MUTANT, expected green: the digest
# comparison is unreachable because subtransaction rollback restores state
# before the handler runs (see _test_helpers.sql). The case remains so the
# equivalence CLAIM is executed, not asserted: if a refactor ever makes the
# check reachable, this case starts killing and must be flipped to expect=1.
case_run "24. denied() state-digest disabled (documented equivalent -- PostgreSQL already guarantees restore)" \
  "perl -0pi -e 's/if after_d <> before_d then/if false then/' supabase/tests/_test_helpers.sql" 0
case_run "25. resolution guard flipped to SECURITY DEFINER (identity check would self-compare)" \
  "perl -0pi -e 's/security invoker/security definer/' supabase/migrations/20260730000005_finance_triggers.sql"

echo "== sabotage: killed=$pass failed=$fail =="
[ "$fail" -eq 0 ]
