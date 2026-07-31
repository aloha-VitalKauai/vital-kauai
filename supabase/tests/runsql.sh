#!/usr/bin/env bash
# pg_prove equivalent: run one pgTAP file and emit clean TAP on stdout.
# `prove` then parses it properly -- enforcing plan(N), detecting out-of-sequence
# results, and failing on any psql/connection error. This replaces grep.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${PGTAP_DB:-fin_v2}"
out=$(psql -X -q -tA --no-psqlrc -v ON_ERROR_STOP=0 -c "set client_min_messages=warning" -d "$DB" -f "$1" 2>&1)
rc=$?
# Surface SQL errors as a TAP bail-out rather than letting them look like a pass.
# Bail only on a genuine ERROR/FATAL. A NOTICE is not a failure.
if printf '%s' "$out" | grep -qE '(^|:)(ERROR|FATAL):'; then
  printf '%s\n' "$out" | sed 's/^/# /'
  echo "Bail out!  SQL error while running $1"
  exit 1
fi
printf '%s\n' "$out"
[ "$rc" -eq 0 ] || { echo "Bail out!  psql exited $rc for $1"; exit 1; }
