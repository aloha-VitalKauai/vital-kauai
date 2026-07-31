#!/usr/bin/env bash
# THE GATE. Every suite is blocking; any nonzero exit fails the whole run.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
DB="${PGTAP_DB:-fin_v2}"; export PGTAP_DB="$DB"

echo "== inventory =="        ; ./supabase/tests/finance/10_inventory.sh
echo "== no placeholders ==" ; ./supabase/tests/finance/08_no_placeholders.sh
echo "== pgTAP (prove: plans enforced, TAP parsed) =="
prove --exec "bash $PWD/supabase/tests/runsql.sh" supabase/tests/finance/*.sql
echo "== static =="          ; ./supabase/tests/finance/06_static.sh
echo "== concurrency =="     ; ./supabase/tests/concurrency.sh >/dev/null
echo "== atomicity =="       ; ./supabase/tests/atomicity_sim.sh >/dev/null
echo "== mutation =="        ; ./supabase/tests/mutation.sh >/dev/null
echo "ALL SUITES PASSED"
