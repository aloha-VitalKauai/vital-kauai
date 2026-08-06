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

# F2 (2nd review): the verdict is prove's -- the same parser and plan
# enforcement as the gate. The old grep-count loop scored a wholesale-erroring
# file as passed=0 failed=0 (green) and printed plan mismatches without
# counting them. F6: PGTAP_DB is exported so runsql and 06_static examine THE
# database this script just built, never a stale default.
export PGTAP_DB="$DB"
echo "== pgTAP suite (prove) =="
prove --exec "bash supabase/tests/runsql.sh" supabase/tests/finance/*.sql
echo "== static checks =="
./supabase/tests/finance/06_static.sh
echo "== run_all: all suites passed =="
