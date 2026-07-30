#!/usr/bin/env bash
# Fails if any placeholder assertion, suppressed test or non-gating suite returns.
# A suite that cannot fail is worse than no suite: it produces a number.
set -uo pipefail
cd "$(dirname "$0")/../../.."
fail=0
bad(){ echo "not ok - $1"; fail=1; }

grep -rn 'select pass(' supabase/tests/ 2>/dev/null | grep -v no_placeholders && bad "pass() placeholder found" || echo "ok - no pass() placeholders"
grep -rn 'where false' supabase/tests/*.sql supabase/tests/finance/*.sql 2>/dev/null && bad "WHERE false test suppression found" || echo "ok - no WHERE false suppression"
# Only a SUPPRESSED SUITE INVOCATION matters. `grep -c ... || true` is a
# counting idiom (grep exits 1 on zero matches) and is not a suppressed test.
grep -rnE '(\./)?supabase/tests/[A-Za-z0-9_/.-]+\.sh[^|]*\|\|[[:space:]]*true' supabase/tests/ 2>/dev/null | grep -v no_placeholders && bad "a test suite invocation is suppressed with || true" || echo "ok - no suite invocation is suppressed"
grep -rnE 'chk "[^"]*" *"true"' supabase/tests/finance/*.sh 2>/dev/null | grep -v no_placeholders && bad "tautological static check found" || echo "ok - no tautological static checks"
for f in supabase/tests/run_all.sh supabase/tests/concurrency.sh supabase/tests/atomicity_sim.sh; do
  grep -q 'set -euo pipefail\|set -uo pipefail' "$f" || bad "$f does not set fail-fast flags"
done
echo "ok - all runners set fail-fast flags"
exit $fail
