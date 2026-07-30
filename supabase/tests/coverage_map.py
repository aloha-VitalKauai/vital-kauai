#!/usr/bin/env python3
"""Financials V2 PR 1 — script-verified requirement -> test coverage map.

Reads the 140 numbered PR 1 acceptance requirements from PR_PLAN.md and scans
every test file for an explicit `req N` / `test N` tag. Reports any requirement
with NO executable coverage. Makes no claim a tag cannot support.
"""
import re, sys, glob, os

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
root = os.path.dirname(root)  # repo root

plan = open(os.path.join(root, 'docs/financials-v2/PR_PLAN.md')).read()
sec  = plan.split('## PR 1 acceptance tests', 1)[1]
reqs = {}
for line in sec.split('\n'):
    m = re.match(r'^(\d+[a-z]?)\.\s+(.*)', line)
    if m:
        reqs[m.group(1)] = m.group(2)

tests = {}
for f in sorted(glob.glob(os.path.join(root, 'supabase/tests/**/*.sql'), recursive=True)) + \
         sorted(glob.glob(os.path.join(root, 'supabase/tests/**/*.sh'), recursive=True)):
    if '_local_bootstrap' in f:
        continue
    body = open(f).read()
    for m in re.finditer(r"\b(?:test|req)\s+(\d+[a-z]?)\b", body):
        tests.setdefault(m.group(1), set()).add(os.path.basename(f))

covered = {k: v for k, v in tests.items() if k in reqs}
missing = sorted(set(reqs) - set(covered),
                 key=lambda x: (int(re.match(r'\d+', x).group()), x))

print(f"PR 1 numbered requirements : {len(reqs)}")
print(f"Requirements with an executable test tag : {len(covered)}")
print(f"Requirements WITHOUT executable coverage : {len(missing)}")
print()
if missing:
    print("UNCOVERED:")
    for k in missing:
        print(f"  [{k}] {reqs[k][:110]}")
print()
extra = sorted(set(tests) - set(reqs), key=lambda x: (int(re.match(r'\d+', x).group()), x))
if extra:
    print(f"Tags not matching a PR 1 requirement number ({len(extra)}): {', '.join(extra[:20])}")
sys.exit(0)
