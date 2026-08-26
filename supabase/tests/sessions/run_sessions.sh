#!/usr/bin/env bash
# Sessions V1 (Builds 1 + 2) — full verification against a FRESH local
# database. Never run against production. Mirrors the finance harness
# pattern: fresh db → platform bootstrap → the sessions migrations → pgTAP
# via prove → true two-session concurrency rounds.
#
# Also proves the migrations are safe to operate: each applies twice without
# error (idempotent), and the ROLLBACK files cleanly restore the
# pre-migration state before a final re-apply. Rollback order matters:
# Build 2 first (holds reference session_bookings), then Build 1.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-sessions_v1}"
MIG_V1="supabase/migrations/20260825235000_sessions_v1_foundation.sql"
MIG_V2="supabase/migrations/20260826003000_sessions_v2_booking_holds.sql"

echo "== fresh database reset =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

echo "== applying sessions migrations =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V1"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V2"

echo "== idempotency: each migration applies a second time cleanly =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V1"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V2"

echo "== reversibility: roll back (v2 then v1), then re-apply both =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_v2_booking_holds.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_v1_foundation.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V1"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG_V2"

echo "== pgTAP suite (prove) =="
PGTAP_DB="$DB" prove --exec "bash supabase/tests/runsql.sh" supabase/tests/sessions/sessions_v1.sql supabase/tests/sessions/sessions_v2.sql

echo "== concurrency rounds =="
bash supabase/tests/sessions/concurrency_holds.sh "${DB}_conc"
