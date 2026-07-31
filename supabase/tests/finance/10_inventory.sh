#!/usr/bin/env bash
# Required-test-file inventory. Deleting or renaming any file fails the build.
set -euo pipefail
cd "$(dirname "$0")/../../.."
fail=0
while IFS= read -r f; do
  if [ ! -f "$f" ]; then echo "not ok - REQUIRED TEST FILE MISSING: $f"; fail=1; fi
done < <(python3 -c "import json;[print(x) for x in json.load(open('supabase/tests/required_files.json'))]")
n=$(python3 -c "import json;print(len(json.load(open('supabase/tests/required_files.json'))))")
[ "$fail" -eq 0 ] && echo "ok - all $n required test files present"
# A new, uninventoried test file is also a failure: the inventory must be updated.
actual=$(ls supabase/tests/finance/*.sql supabase/tests/finance/*.sh supabase/tests/*.sh supabase/tests/*.py 2>/dev/null | wc -l | tr -d ' ')
if [ "$actual" -ne "$n" ]; then echo "not ok - inventory is stale: $actual files on disk, $n in inventory"; fail=1; fi
exit $fail
