#!/usr/bin/env bash
# Financials V2 PR 1 — full verification against a FRESH local database.
# Never run against production.
set -euo pipefail

# No suite may be non-gating. `|| true` is forbidden here.
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-fin_v2}"

echo "== fresh database reset =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

echo "== applying finance migrations =="
MIGS=$(./supabase/tests/list_migrations.sh)   # canonical; failure aborts under set -e
while IFS= read -r f; do
  printf '  %-56s' "$(basename "$f")"
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$f" && echo OK
done <<< "$MIGS"

echo "== pgTAP suite =="
total_ok=0; total_fail=0
for f in supabase/tests/finance/*.sql; do
  out=$(psql -X -q -tA -d "$DB" -f "$f" 2>&1)
  o=$(printf '%s' "$out" | grep -c '^ok [0-9]' || true)
  n=$(printf '%s' "$out" | grep -c '^not ok' || true)
  total_ok=$((total_ok+o)); total_fail=$((total_fail+n))
  printf '  %-24s passed=%-4s failed=%s\n' "$(basename "$f")" "$o" "$n"
  [ "$n" -gt 0 ] && printf '%s\n' "$out" | grep -A3 '^not ok'
  printf '%s' "$out" | grep -q 'Looks like you planned' && printf '%s\n' "$out" | grep 'Looks like you planned'
done
echo "== static checks =="
if ! ./supabase/tests/finance/06_static.sh; then
  echo "STATIC CHECKS FAILED"; total_fail=$((total_fail+1))
fi
echo "== TOTAL pgTAP passed=$total_ok failed=$total_fail =="
[ "$total_fail" -eq 0 ]
