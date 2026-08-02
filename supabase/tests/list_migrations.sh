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
for f in supabase/migrations/*.sql; do
  b=$(basename "$f")
  case "$b" in ROLLBACK_*) continue;; esac
  # lexicographic compare works because the names are zero-padded timestamps
  [ "$b" \< "$series_start" ] && continue
  grep -qxF "$b" "$MANIFEST" || { echo "UNLISTED IN-SERIES MIGRATION ON DISK: $b" >&2; fail=2; }
done
[ "$fail" -eq 0 ] || exit "$fail"
sed 's|^|supabase/migrations/|' "$MANIFEST"
