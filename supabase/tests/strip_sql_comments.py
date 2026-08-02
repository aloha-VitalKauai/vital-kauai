#!/usr/bin/env python3
"""Remove SQL comments so a source-level check cannot be satisfied by a comment.

Handles -- line comments, /* */ (nested, per the SQL standard), single-quoted
literals, and dollar-quoted bodies ($$ ... $$ / $tag$ ... $tag$) so that a
comment marker appearing inside a string or function body is not treated as a
comment. Used only for the few requirements that genuinely concern migration
source text; every other check asserts against the PostgreSQL catalog.
"""
import re, sys

def strip(s):
    out, i, n = [], 0, len(s)
    while i < n:
        c = s[i]
        if c == '-' and s.startswith('--', i):
            j = s.find('\n', i); i = n if j < 0 else j
        elif c == '/' and s.startswith('/*', i):
            depth, i = 1, i + 2
            while i < n and depth:
                if s.startswith('/*', i): depth += 1; i += 2
                elif s.startswith('*/', i): depth -= 1; i += 2
                else: i += 1
        elif c == "'":
            out.append(c); i += 1
            while i < n:
                if s[i] == "'" and s.startswith("''", i): out.append("''"); i += 2
                elif s[i] == "'": out.append("'"); i += 1; break
                else: out.append(s[i]); i += 1
        elif c == '$':
            m = re.match(r'\$[A-Za-z_0-9]*\$', s[i:])
            if m:
                tag = m.group(0); j = s.find(tag, i + len(tag))
                j = n if j < 0 else j + len(tag)
                out.append(s[i:j]); i = j
            else:
                out.append(c); i += 1
        else:
            out.append(c); i += 1
    return ''.join(out)

if __name__ == '__main__':
    sys.stdout.write(''.join(strip(open(f).read()) for f in sys.argv[1:]))
