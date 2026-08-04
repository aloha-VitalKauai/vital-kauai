#!/usr/bin/env bash
# THE GATE. Every suite is blocking; any nonzero exit fails the whole run.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
DB="${PGTAP_DB:-fin_v2}"; export PGTAP_DB="$DB"

# BUILD THE DATABASE FROM SOURCE EVERY RUN.
# Without this the gate tested a stale database: a mutated migration was never
# applied, so every migration-level mutant survived undetected.
echo "== build $DB from migrations =="
dropdb --if-exists "$DB"
createdb "$DB"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/_local_bootstrap.sql
MIGS=$(./supabase/tests/list_migrations.sh)   # canonical; enumerator failure aborts under set -e
while IFS= read -r m; do
  psql -v ON_ERROR_STOP=1 -q -d "$DB" -f "$m"
done <<< "$MIGS"
psql -v ON_ERROR_STOP=1 -q -d "$DB" -f supabase/tests/_test_helpers.sql
echo "   applied $(printf '%s\n' "$MIGS" | wc -l | tr -d ' ') migrations (canonical manifest)"

# B-81: expected_objects.txt must not change during a gate run, no matter what
# writes it. This is the enforced exclusivity of the rebaseline script.
BASELINE_HASH_BEFORE=$(shasum supabase/tests/expected_objects.txt | cut -d" " -f1)

echo "== inventory =="        ; ./supabase/tests/finance/10_inventory.sh
echo "== no placeholders ==" ; ./supabase/tests/finance/08_no_placeholders.sh
echo "== pgTAP (prove: plans enforced, TAP parsed) =="
# Space-path support: prove splits --exec on whitespace, so an absolute $PWD
# containing spaces (the main repo path does) broke it. The gate cd's to the
# repo root above, so a relative exec string is stable and space-free.
prove --exec "bash supabase/tests/runsql.sh" supabase/tests/finance/*.sql
# Checkpoint B: stable assertion IDs. Every pgTAP ok-line must carry a unique
# [A*-NNN] tag -- the requirement map references these IDs, so an untagged or
# duplicated assertion would silently detach evidence from the map.
echo "== assertion-ID integrity =="
TAP=$(for f in supabase/tests/finance/*.sql; do bash supabase/tests/runsql.sh "$f"; done)
UNTAGGED=$(printf '%s\n' "$TAP" | grep -E '^ok [0-9]+ - ' | grep -cv '\[A' || true)
DUPES=$(printf '%s\n' "$TAP" | grep -oE '\[A[0-9]+-[0-9]+\]' | sort | uniq -d | wc -l | tr -d ' ')
[ "$UNTAGGED" -eq 0 ] || { echo "GATE FAILED: $UNTAGGED assertion(s) lack a stable ID tag"; exit 1; }
[ "$DUPES" -eq 0 ] || { echo "GATE FAILED: duplicated assertion IDs: $(printf '%s\n' "$TAP" | grep -oE '\[A[0-9]+-[0-9]+\]' | sort | uniq -d | tr '\n' ' ')"; exit 1; }
echo "   $(printf '%s\n' "$TAP" | grep -cE '^ok [0-9]+ - ') assertions, all tagged, all unique"

echo "== helper selftest ==" ; ./supabase/tests/14_helper_selftest.sh
echo "== static =="          ; ./supabase/tests/finance/06_static.sh
echo "== concurrency =="     ; ./supabase/tests/concurrency.sh >/dev/null
echo "== atomicity =="       ; ./supabase/tests/atomicity_sim.sh >/dev/null
echo "== mutation =="        ; ./supabase/tests/mutation.sh >/dev/null
BASELINE_HASH_AFTER=$(shasum supabase/tests/expected_objects.txt | cut -d" " -f1)
if [ "$BASELINE_HASH_BEFORE" != "$BASELINE_HASH_AFTER" ]; then
  echo "GATE FAILED: the census baseline changed during the run"; exit 1
fi
echo "ALL SUITES PASSED"
