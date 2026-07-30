#!/usr/bin/env bash
# Financials V2 PR 1 — complete gating verification. Every stage is blocking.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
R=/tmp/pr1_results.txt; : > "$R"

echo "== 1. fresh forward migration =="
dropdb --if-exists fin_v2; createdb fin_v2
psql -q -d fin_v2 -v ON_ERROR_STOP=1 -f supabase/tests/_local_bootstrap.sql
for f in supabase/migrations/2026073000000*.sql; do
  psql -q -d fin_v2 -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
echo "ok - all 8 migrations applied to a fresh database"
echo "ok - all 8 migrations applied to a fresh database" >> "$R"

echo "== 1b. pgTAP suites (full TAP captured) =="
for t in supabase/tests/finance/*.sql; do
  psql -X -q -tA -d fin_v2 -f "$t" >> "$R" 2>&1
done
grep -c '^ok' "$R" | sed 's/^/  pgTAP assertions so far: /'
if grep -q '^not ok' "$R"; then echo "PGTAP FAILURES:"; grep '^not ok' "$R"; exit 1; fi

echo "== 1c. static checks =="
./supabase/tests/finance/06_static.sh | tee -a "$R" | tail -2

echo "== 2. no placeholders / non-gating suites =="
./supabase/tests/finance/08_no_placeholders.sh | tee -a "$R"

echo "== 3. concurrency =="
./supabase/tests/concurrency.sh 2>&1 | grep -E '^(ok|not ok)' | tee -a "$R" | tail -3

echo "== 4. atomic-failure simulation =="
./supabase/tests/atomicity_sim.sh | tee -a "$R" | tail -2

echo "== 5. mutation =="
./supabase/tests/mutation.sh | tee -a "$R" | tail -2

echo "== 6. rollback + second forward migration =="
psql -q -d fin_v2 -v ON_ERROR_STOP=1 -f supabase/migrations/ROLLBACK_pr1.sql 2>&1 | grep -i notice
for f in supabase/migrations/2026073000000*.sql; do psql -q -d fin_v2 -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
echo "ok - rollback then second forward migration succeeded"
echo "ok - rollback then second forward migration succeeded" >> "$R"

echo "== 7. requirement coverage (results-based) =="
python3 supabase/tests/coverage_verify.py "$R"
echo "TOTAL ASSERTIONS EXECUTED: $(grep -c '^ok' "$R")  FAILURES: $(grep -c '^not ok' "$R" || true)"
