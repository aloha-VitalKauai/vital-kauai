#!/usr/bin/env bash
# B-79: THE canonical migration enumerator. Every database builder (gate,
# run_all, mutation, concurrency, atomicity, sabotage workspaces) consumes this
# output and nothing else. Globs are forbidden as a migration source: two
# builders once used different glob widths, so a future migration could be
# applied to the gate database but silently omitted from the mutation and
# concurrency databases, which then proved nothing about it.
#
# SCOPE: the Financials V2 series only. The 28 pre-existing application
# migrations are never applied by this harness -- _local_bootstrap.sql
# recreates the objects the finance schema depends on. The series boundary is
# the first manifest entry, so "unexpected" is well defined: any on-disk
# migration at or after that timestamp that is not listed fails the build and
# must be added here -- there is no glob to silently miss it.
#
# Prints ordered relative paths on stdout; exits nonzero on ANY of: a listed
# file missing, an on-disk in-series migration not listed, a duplicate entry,
# or an empty manifest.
set -uo pipefail
cd "$(dirname "$0")/../.."
MANIFEST=supabase/tests/migrations_manifest.txt
fail=0
[ -s "$MANIFEST" ] || { echo "MANIFEST MISSING OR EMPTY: $MANIFEST" >&2; exit 2; }
dups=$(sort "$MANIFEST" | uniq -d)
[ -z "$dups" ] || { echo "DUPLICATE MANIFEST ENTRIES: $dups" >&2; fail=2; }
series_start=$(head -1 "$MANIFEST")
while IFS= read -r m; do
  [ -n "$m" ] || continue
  [ -f "supabase/migrations/$m" ] || { echo "LISTED MIGRATION MISSING FROM DISK: $m" >&2; fail=2; }
done < "$MANIFEST"
# F3 (2nd review): pre-series files are NOT exempt. The frozen ledger pins the
# exact set of pre-existing application migrations; anything on disk that is
# neither frozen nor in the manifest fails -- including a NEW file crafted to
# sort before the series start, which a real deploy would happily apply.
FROZEN=supabase/tests/migrations_preseries_frozen.txt
[ -s "$FROZEN" ] || { echo "FROZEN PRE-SERIES LEDGER MISSING: $FROZEN" >&2; exit 2; }
# LOW-1 (post-approval): ROLLBACK_* files are INVENTORIED, not exempt. The old
# `continue` meant any file named ROLLBACK_*.sql escaped every ledger.
RB_MANIFEST=supabase/tests/rollback_manifest.txt
[ -s "$RB_MANIFEST" ] || { echo "ROLLBACK MANIFEST MISSING: $RB_MANIFEST" >&2; exit 2; }
for f in supabase/migrations/*.sql; do
  b=$(basename "$f")
  case "$b" in ROLLBACK_*)
    grep -qxF "$b" "$RB_MANIFEST" || { echo "UNLISTED ROLLBACK FILE ON DISK: $b" >&2; fail=2; }
    continue;;
  esac
  # lexicographic compare works because the names are zero-padded timestamps
  if [ "$b" \< "$series_start" ]; then
    grep -qxF "$b" "$FROZEN" || { echo "UNKNOWN PRE-SERIES MIGRATION ON DISK (not in the frozen ledger): $b" >&2; fail=2; }
    continue
  fi
  grep -qxF "$b" "$MANIFEST" || { echo "UNLISTED IN-SERIES MIGRATION ON DISK: $b" >&2; fail=2; }
done
[ "$fail" -eq 0 ] || exit "$fail"
sed 's|^|supabase/migrations/|' "$MANIFEST"
