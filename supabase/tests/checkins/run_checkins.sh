#!/usr/bin/env bash
# Weekly Member Check-Ins Build 1 — full verification against a FRESH local
# database. Never run against production. Mirrors the sessions harness:
# fresh db → platform bootstrap → the check-ins migration → pgTAP via prove.
#
# Also proves the migration is safe to operate: it applies twice without error
# (idempotent), and the ROLLBACK file cleanly restores the pre-migration state
# before a final re-apply.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-checkins_v1}"
MIG="supabase/migrations/20260901010000_checkins_v1_foundation.sql"
MIG_V2="supabase/migrations/20260901120000_checkin_template_publish.sql"

echo "== fresh database reset =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

echo "== applying the check-ins migrations =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V2"

echo "== idempotency: each migration applies a second time cleanly =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V2"

echo "== the second apply seeded no duplicate templates =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "do \$\$ begin if (select count(*) from public.checkin_templates) <> 13
        then raise exception 'template seed is not idempotent'; end if; end \$\$;"

echo "== reversibility: roll back (v2, then v1), then re-apply =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_checkin_template_publish.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_checkins_v1_foundation.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V2"

echo "== pgTAP suite (prove) =="
PGTAP_DB="$DB" prove --exec "bash supabase/tests/runsql.sh" \
  supabase/tests/checkins/checkins_v1.sql \
  supabase/tests/checkins/checkins_v2_publish.sql

echo "== run_checkins: all suites passed =="
