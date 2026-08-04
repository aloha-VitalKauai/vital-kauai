#!/usr/bin/env bash
# Regenerate the catalog fingerprint baseline. THE ONLY writer of
# expected_objects.txt. Never invoked by harness_gate.sh or any test.
#
# WHAT THE FINGERPRINT IS: a DRIFT DETECTOR. It proves the schema is what it was
# the last time a human reviewed it. It is NOT semantic proof -- it cannot say a
# policy is correct, only that it changed. Semantic claims belong in the pgTAP
# behavioural suites; this catches the silent, unreviewed change.
#
# Regeneration is deliberately awkward: an accidental or automated rebaseline
# would convert every real regression into a green run.
set -euo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"; export LC_ALL="en_US.UTF-8"
cd "$(dirname "$0")/../.."
DB="${PGTAP_DB:-fin_v2}"
BASE=supabase/tests/expected_objects.txt

if [ "${FINANCE_REBASELINE:-}" != "I-REVIEWED-THE-DIFF" ]; then
  echo "refusing to rebaseline."
  echo "  Review the drift first:  ./supabase/tests/rebaseline_census.sh --diff"
  echo "  Then, only if every line is an intended change:"
  echo "    FINANCE_REBASELINE=I-REVIEWED-THE-DIFF ./supabase/tests/rebaseline_census.sh"
  [ "${1:-}" = "--diff" ] || exit 2
fi

psql -tAq -d "$DB" -f supabase/tests/object_census.sql > /tmp/census_new.$$
if [ "${1:-}" = "--diff" ]; then
  echo "=== drift vs the reviewed baseline (- removed / + added) ==="
  diff -u "$BASE" /tmp/census_new.$$ || true
  echo "=== $(diff "$BASE" /tmp/census_new.$$ | grep -c '^[<>]' || true) changed line(s) ==="
  rm -f /tmp/census_new.$$; exit 0
fi
mv /tmp/census_new.$$ "$BASE"
echo "baseline rewritten: $(wc -l < "$BASE") lines. Commit it as a reviewed change."
