#!/usr/bin/env bash
# Sessions V1 (Build 1) — full verification against a FRESH local database.
# Never run against production. Mirrors the finance harness pattern:
# fresh db → platform bootstrap → the sessions migration → pgTAP via prove.
#
# Also proves the migration is safe to operate: it applies twice without
# error (idempotent), and the ROLLBACK file cleanly restores the
# pre-migration state before a final re-apply.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-sessions_v1}"
MIGRATION="supabase/migrations/20260825235000_sessions_v1_foundation.sql"

echo "== fresh database reset =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

echo "== applying sessions migration =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "== idempotency: migration applies a second time cleanly =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "== reversibility: rollback restores pre-migration state, then re-apply =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_v1_foundation.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIGRATION"

echo "== pgTAP suite (prove) =="
PGTAP_DB="$DB" prove --exec "bash supabase/tests/runsql.sh" supabase/tests/sessions/sessions_v1.sql
