#!/usr/bin/env python3
"""Financials V2 PR 1 — requirement coverage, verified against EXECUTED results.

Replaces the previous coverage_map.py, which counted a bare `req N` COMMENT as
coverage and reported 140/140 for a tree containing no tests at all.

This version:
  * reads a manifest mapping each requirement to an exact assertion NAME;
  * runs the suites and parses real TAP / static output;
  * requires every mapped assertion to have EXECUTED and PASSED;
  * rejects pass(), tautologies and zero-row assertions by construction --
    a name that never appears in output is simply not counted.
Usage: coverage_verify.py <results-file>
"""
import re, sys, os, json

root = os.path.dirname(os.path.dirname(os.path.abspath(os.path.dirname(__file__))))
here = os.path.dirname(os.path.abspath(__file__))
plan = open(os.path.join(root, 'docs/financials-v2/PR_PLAN.md')).read()
sec  = plan.split('## PR 1 acceptance tests', 1)[1]
reqs = {}
for line in sec.split('\n'):
    m = re.match(r'^(\d+[a-z]?)\.\s+(.*)', line)
    if m: reqs[m.group(1)] = m.group(2)

manifest = json.load(open(os.path.join(here, 'coverage_manifest.json')))

results = open(sys.argv[1]).read()
passed = set()
for m in re.finditer(r'^ok\s+\d*\s*-?\s*(.+?)\s*$', results, re.M):
    passed.add(m.group(1).strip())
failed = set()
for m in re.finditer(r'^not ok\s+\d*\s*-?\s*(.+?)\s*$', results, re.M):
    failed.add(m.group(1).strip())

covered, missing, broken = {}, [], []
for req in sorted(reqs, key=lambda x: (int(re.match(r'\d+', x).group()), x)):
    names = manifest.get(req)
    if not names:
        missing.append((req, 'no manifest entry')); continue
    hit = [n for n in names if n in passed]
    bad = [n for n in names if n in failed]
    if bad:   broken.append((req, bad))
    elif hit: covered[req] = hit
    else:     missing.append((req, 'mapped assertion did not execute: ' + '; '.join(names)[:90]))

print(f"PR 1 numbered requirements            : {len(reqs)}")
print(f"Requirements with a PASSING assertion : {len(covered)}")
print(f"Requirements with a FAILING assertion : {len(broken)}")
print(f"Requirements NOT covered              : {len(missing)}")
if broken:
    print("\nFAILING:")
    for r, b in broken: print(f"  [{r}] {b}")
if missing:
    print("\nNOT COVERED:")
    for r, why in missing: print(f"  [{r}] {why}")
sys.exit(0 if (not missing and not broken) else 1)
