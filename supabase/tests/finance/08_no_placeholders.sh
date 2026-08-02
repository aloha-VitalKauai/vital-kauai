#!/usr/bin/env bash
# Fails if any placeholder assertion, suppressed test or non-gating suite returns.
# A suite that cannot fail is worse than no suite: it produces a number.
set -uo pipefail
cd "$(dirname "$0")/../../.."
fail=0
bad(){ echo "not ok - $1"; fail=1; }
# B-83: grep has three outcomes -- match (0), no match (1), ERROR (>=2, e.g. an
# unreadable file). The old `&& bad || ok` chain reported an ERROR as "ok".
# scan <description-of-violation> <grep-args...>: match -> violation; no match
# -> ok; error -> fail closed.
scan(){
  local desc="$1"; shift
  local out rc
  out=$(grep "$@" 2>&1); rc=$?
  case "$rc" in
    0) printf '%s\n' "$out"; bad "$desc";;
    1) echo "ok - no ${desc}";;
    *) echo "not ok - SCANNER ERROR (rc=$rc) while checking: $desc"; printf '%s\n' "$out" | sed 's/^/# /'; fail=1;;
  esac
}
# fail closed on unreadable inputs before any scan runs
while IFS= read -r f; do
  [ -r "$f" ] || { echo "not ok - UNREADABLE TEST FILE: $f"; fail=1; }
done < <(find supabase/tests -name '*.sql' -o -name '*.sh')


scan "pass() placeholder" -rn --include='*.sql' --include='*.sh' -e 'select pass(' --exclude='08_no_placeholders.sh' supabase/tests/
scan "WHERE false suppression" -rn -e 'where false' supabase/tests/*.sql supabase/tests/finance/*.sql
scan "suppressed suite invocation (|| true)" -rnE -e '(\./)?supabase/tests/[A-Za-z0-9_/.-]+\.sh[^|]*\|\|[[:space:]]*true' --exclude='08_no_placeholders.sh' supabase/tests/
scan "tautological static check" -rnE -e 'chk "[^"]*" *"true"' --exclude='08_no_placeholders.sh' supabase/tests/finance/
scan "ok(true,...) placeholder" -rnE -e '\bok\(\s*true\s*,' supabase/tests/finance/*.sql
scan "is(N,N) tautology" -rnE -e '\bis\(\s*([0-9]+)\s*,\s*\1\s*,' supabase/tests/finance/*.sql
scan "ok(N=N) tautology" -rnE -e '\bok\(\s*[0-9]+\s*=\s*[0-9]+' supabase/tests/finance/*.sql
scan "bare throws_ok(null,null)" -rnE -e 'throws_ok\(.*null\s*,\s*null' supabase/tests/finance/*.sql
for f in supabase/tests/run_all.sh supabase/tests/concurrency.sh supabase/tests/atomicity_sim.sh; do
  grep -q 'set -euo pipefail\|set -uo pipefail' "$f" || bad "$f does not set fail-fast flags"
done
echo "ok - all runners set fail-fast flags"
exit $fail
