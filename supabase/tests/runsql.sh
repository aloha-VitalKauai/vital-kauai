#!/usr/bin/env bash
# pg_prove equivalent: run one pgTAP file and emit clean TAP on stdout.
# `prove` then parses it properly -- enforcing plan(N), detecting out-of-sequence
# results, and failing on any psql/connection error. This replaces grep.
set -uo pipefail
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
export LC_ALL="en_US.UTF-8"
DB="${PGTAP_DB:-fin_v2}"
# F1 (2nd review): ON_ERROR_STOP=1 -- healthy suites emit ZERO top-level
# errors (every intentional rejection is absorbed inside denied()'s plpgsql),
# so any psql-visible ERROR is genuine breakage and must fail the file. This
# also makes the rc check below LIVE: with ON_ERROR_STOP=0 psql always exited
# 0 and the check was dead code.
out=$(psql -X -q -tA --no-psqlrc -v ON_ERROR_STOP=1 -c "set client_min_messages=warning" -d "$DB" -f "$1" 2>&1)
rc=$?
# Belt and braces: also bail on the message text. psql's file-mode format is
# `psql:<path>:<line>: ERROR:  ...` -- note the SPACE after the colon, which
# the previous pattern `(^|:)(ERROR|FATAL):` could never match (dead bail,
# found by independent review). `: ` covers file mode; `^` covers bare mode.
if printf '%s' "$out" | grep -qE '(^|: )(ERROR|FATAL):'; then
  printf '%s\n' "$out" | sed 's/^/# /'
  echo "Bail out!  SQL error while running $1"
  exit 1
fi
printf '%s\n' "$out"
[ "$rc" -eq 0 ] || { echo "Bail out!  psql exited $rc for $1"; exit 1; }
