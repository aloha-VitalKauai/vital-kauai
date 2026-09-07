#!/usr/bin/env bash
# Member Signals Build 1 — full verification against a FRESH local database.
# Never run against production. Mirrors the check-ins harness: fresh db →
# platform bootstrap → the signals migration → pgTAP via prove.
#
# Also proves the migration is safe to operate: it applies twice without error
# (idempotent), and the ROLLBACK file cleanly restores the pre-migration state
# before a final re-apply.
set -euo pipefail

export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${1:-signals_v1}"
MIG="supabase/migrations/20260907010000_member_signals_v1_foundation.sql"
ROLLBACK="supabase/migrations/ROLLBACK_member_signals_v1_foundation.sql"

echo "== fresh database reset =="
dropdb --if-exists "$DB"; createdb "$DB"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql

echo "== applying the signals migration =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG"

echo "== idempotency: the migration applies a second time cleanly =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG"

echo "== the second apply left no duplicate objects =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "do \$\$ begin
        if (select count(*) from pg_class
              where relname in ('member_signals', 'member_signal_acknowledgments')
                and relkind = 'r') <> 2
          then raise exception 'signal tables are not exactly two after re-apply'; end if;
        if (select count(*) from public.member_signals) <> 0
          then raise exception 'the migration seeded rows it should not have'; end if;
      end \$\$;"

echo "== reversibility: roll back, then re-apply =="
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$ROLLBACK"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -tA \
  -c "do \$\$ begin
        if (select count(*) from pg_class
              where relname in ('member_signals', 'member_signal_acknowledgments',
                                'v_member_signal_current')) <> 0
          then raise exception 'rollback left signal objects behind'; end if;
      end \$\$;"
psql -q -d "$DB" -v ON_ERROR_STOP=1 -f "$MIG"

echo "== pgTAP suite (prove) =="
PGTAP_DB="$DB" prove --exec "bash supabase/tests/runsql.sh" \
  supabase/tests/signals/signals_v1.sql

echo "== run_signals: all suites passed =="
