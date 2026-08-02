#!/usr/bin/env bash
# Simulates the exact production risk migration 0001 exists to catch:
# an is_founder() body that resolves only via a schema outside the pinned path.
# The migration MUST fail AND leave proconfig unchanged.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
DB="${PGTAP_DB:-fin_v2}_atom"
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

# Replace is_founder with a body that only resolves when `helpers` is on the path.
psql -q -d "$DB" -v ON_ERROR_STOP=1 <<'SQL'
create schema helpers;
create function helpers.founder_check() returns boolean language sql stable as 'select true';
-- check_function_bodies=off lets us install a body that only resolves when
-- `helpers` is on the search_path -- exactly the production shape the
-- verification block exists to catch.
set check_function_bodies = off;
create or replace function public.is_founder() returns boolean
  language sql stable security definer as $f$ select founder_check(); $f$;
alter function public.is_founder() set search_path = pg_catalog, public, helpers;
reset check_function_bodies;
SQL

BEFORE=$(psql -tA -d "$DB" -c "select coalesce(array_to_string(proconfig,','),'NOT_SET') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_founder'")
echo "BEFORE proconfig : $BEFORE"

set +e
FIRST_MIG=$(./supabase/tests/list_migrations.sh | head -1)
[ -n "$FIRST_MIG" ] || { echo "ENUMERATOR FAILED"; exit 2; }
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$FIRST_MIG" >/tmp/atom.log 2>&1
RC=$?
set -e
AFTER=$(psql -tA -d "$DB" -c "select coalesce(array_to_string(proconfig,','),'NOT_SET') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_founder'")
STILL=$(psql -tA -d "$DB" -c "select public.is_founder()::text" 2>/dev/null || echo "BROKEN")

echo "migration exit code: $RC (expect non-zero)"
echo "AFTER  proconfig : $AFTER"
echo "is_founder still callable: $STILL"
grep -o 'no longer resolves[^"]*' /tmp/atom.log | head -1 || true

fail=0
[ "$RC" -ne 0 ]            || { echo "not ok - migration should have failed"; fail=1; }
[ "$AFTER" = "$BEFORE" ]   || { echo "not ok - proconfig CHANGED ($BEFORE -> $AFTER)"; fail=1; }
[ "$STILL" = "true" ]      || { echo "not ok - is_founder() is broken after the failed migration"; fail=1; }
[ "$fail" -eq 0 ] && echo "ok - atomic failure: migration failed, proconfig unchanged, is_founder() still works"
dropdb "$DB"
exit "$fail"
