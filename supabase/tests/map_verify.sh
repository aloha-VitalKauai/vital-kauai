#!/usr/bin/env bash
# Checkpoint B: structural verifier for the requirement map. It checks form,
# not meaning -- semantic correctness of each mapping is the human review's job,
# and NO coverage number is printed here or anywhere until that review is done.
# Fails on: a requirement ID missing from the map, an evidence ID that does not
# exist in the assertion index or the known suite-evidence list, an entry with
# neither evidence nor an explicit GAP marker, or a duplicate requirement entry.
set -uo pipefail
cd "$(dirname "$0")/../.."
MAP=docs/financials-v2/REQUIREMENTS_MAP.md
IDX=supabase/tests/assertion_index.txt
fail=0
REQS=$(python3 - <<'PYEOF'
import re
s=open('docs/financials-v2/PR_PLAN.md').read()
i=s.index('## PR 1 acceptance tests'); j=s.find('\n## ', i+10)
sec=s[i:] if j<0 else s[i:j]
print('\n'.join(m.group(1) for m in re.finditer(r'(?m)^(\d{1,3}[a-z]?)\. ', sec)))
PYEOF
)
[ "$(printf '%s\n' "$REQS" | wc -l | tr -d ' ')" -eq 140 ] || { echo "not ok - spec no longer yields 140 requirements"; exit 1; }
while IFS= read -r r; do
  n=$(grep -cE "^### R$r( |:|$)" "$MAP" || true)
  case "$n" in
    0) echo "not ok - requirement $r missing from the map"; fail=1;;
    1) ;;
    *) echo "not ok - requirement $r appears $n times"; fail=1;;
  esac
done <<< "$REQS"
# every evidence token must exist; every entry needs evidence or explicit GAP
while IFS= read -r line; do
  r=$(printf '%s' "$line" | sed -E 's/^### R([0-9]+[a-z]?).*/\1/')
  block=$(awk "/^### R$r( |:|\$)/{f=1;next} /^### /{f=0} f" "$MAP")
  ev=$(printf '%s\n' "$block" | grep -oE '\[(A[0-9]+-[0-9]+|ST-[0-9]+|SUITE:[a-z_0-9]+)\]' | tr -d '[]' | sort -u)
  if [ -z "$ev" ] && ! printf '%s' "$block" | grep -q 'GAP:'; then
    echo "not ok - R$r has neither evidence IDs nor an explicit GAP marker"; fail=1; continue
  fi
  while IFS= read -r e; do
    [ -n "$e" ] || continue
    case "$e" in
      SUITE:*) grep -q "^${e#SUITE:}$" supabase/tests/suite_evidence.txt || { echo "not ok - R$r cites unknown suite evidence $e"; fail=1; };;
      *) grep -q "^$e |" "$IDX" || { echo "not ok - R$r cites nonexistent assertion $e"; fail=1; };;
    esac
  done <<< "$ev"
done < <(grep -E '^### R' "$MAP")
[ "$fail" -eq 0 ] && echo "ok - map structure verified (form only; semantic review pending)"
exit "$fail"
