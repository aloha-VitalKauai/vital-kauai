#!/usr/bin/env bash
# Sessions (Builds 1 + 2 + default program grant + V4 recurring series) —
# full verification
# against a FRESH local database. Never run against production. Mirrors the
# finance harness pattern: fresh db → platform bootstrap → the sessions
# migrations → pgTAP via prove → true two-session concurrency rounds.
#
# Also proves the migrations are safe to operate: each applies twice without
# error (idempotent), and the ROLLBACK files cleanly restore the
# pre-migration state before a final re-apply. Rollback order is the reverse
# of apply order: the recurring series (V4 references session_bookings and
# holds), then the grant automation, then Build 2 (holds reference
# session_bookings), then Build 1.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-sessions_v1}"
MIG_V1="supabase/migrations/20260825235000_sessions_v1_foundation.sql"
MIG_V2="supabase/migrations/20260826003000_sessions_v2_booking_holds.sql"
MIG_V3="supabase/migrations/20260826020000_sessions_default_program_grant.sql"
MIG_V4="supabase/migrations/20260901150000_sessions_v4_recurring_series.sql"

echo "== fresh database reset =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

echo "== applying sessions migrations =="
for m in "$MIG_V1" "$MIG_V2" "$MIG_V3" "$MIG_V4"; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$m"
done

echo "== idempotency: each migration applies a second time cleanly =="
for m in "$MIG_V1" "$MIG_V2" "$MIG_V3" "$MIG_V4"; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$m"
done

echo "== reversibility: roll back (v4, v3, v2, v1), then re-apply all =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_v4_recurring_series.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_default_program_grant.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_v2_booking_holds.sql
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_sessions_v1_foundation.sql
for m in "$MIG_V1" "$MIG_V2" "$MIG_V3" "$MIG_V4"; do
  psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$m"
done

echo "== pgTAP suite (prove) =="
PGTAP_DB="$DB" prove --exec "bash supabase/tests/runsql.sh" \
  supabase/tests/sessions/sessions_v1.sql \
  supabase/tests/sessions/sessions_v2.sql \
  supabase/tests/sessions/sessions_v3_default_grant.sql \
  supabase/tests/sessions/sessions_v4.sql

echo "== concurrency rounds =="
bash supabase/tests/sessions/concurrency_holds.sh "${DB}_conc"
