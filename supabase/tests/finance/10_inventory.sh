#!/usr/bin/env bash
# Required-test-file inventory: exact manifest comparison, no failing globs.
# The previous version globbed supabase/tests/*.py, which matches nothing; under
# `set -euo pipefail` that made `ls` exit 1 and aborted the script AFTER printing
# success. The gate therefore never exited 0, which made the whole sabotage proof
# vacuous -- every mutant "failed" a gate that always failed.
# Portable: no mapfile (macOS ships bash 3.2), no globs that can match nothing.
set -euo pipefail
cd "$(dirname "$0")/../../.."
fail=0
WANT=$(python3 -c "import json;print('\n'.join(json.load(open('supabase/tests/required_files.json'))))")
HAVE=$(find supabase/tests -type f \( -name '*.sql' -o -name '*.sh' -o -name '*.py' \) \
       ! -name '_local_bootstrap.sql' ! -name '_test_helpers.sql' | sort)

while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || { echo "not ok - REQUIRED TEST FILE MISSING: $f"; fail=1; }
done <<< "$WANT"

while IFS= read -r f; do
  [ -n "$f" ] || continue
  printf '%s\n' "$WANT" | grep -qxF "$f" || { echo "not ok - UNINVENTORIED TEST FILE: $f"; fail=1; }
done <<< "$HAVE"

n=$(printf '%s\n' "$WANT" | grep -c . || true)
[ "$fail" -eq 0 ] && echo "ok - inventory exact: $n required files, none missing, none extra"
exit "$fail"
