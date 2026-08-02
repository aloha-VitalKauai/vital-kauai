#!/usr/bin/env python3
"""B-78: bash-aware structural check that a shell script actually EXECUTES the
required commands with the required arguments.

The previous check piped shell scripts through the SQL comment stripper, which
ate `--if-exists` as an SQL comment; its fallback was a naive grep of the raw
file, satisfiable by `# dropdb --if-exists` in a comment. Here each line is
lexed with shlex in POSIX mode with `#` comments enabled, so commented-out or
quoted text never counts: only real command tokens do.

Usage: shell_expects.py <script> <tok1,tok2> [<tok...>...]
Each argument is a comma-separated CONSECUTIVE token sequence that must appear
in the lexed token stream. Exit 0 only if every sequence is found.
"""
import shlex, sys

def tokens(path):
    out = []
    with open(path) as fh:
        for line in fh:
            try:
                out.extend(shlex.split(line, comments=True, posix=True))
            except ValueError:
                # Unterminated quote (heredoc etc.). F4 (2nd review): the raw
                # fallback once kept comment text, so `# dropdb --if-exists "x`
                # satisfied the check from a comment -- the exact attack class
                # this tool exists to close. Strip from the first
                # start-of-word `#` BEFORE splitting; a token hidden behind an
                # unterminated quote then stays findable, a comment never.
                import re as _re
                out.extend(_re.sub(r'(^|\s)#.*$', '', line).split())
    return out

def has_seq(toks, seq):
    n = len(seq)
    return any(toks[i:i+n] == seq for i in range(len(toks) - n + 1))

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('usage: shell_expects.py <script> <tok1,tok2> ...')
    toks = tokens(sys.argv[1])
    missing = [a for a in sys.argv[2:] if not has_seq(toks, a.split(','))]
    if missing:
        for m in missing:
            print(f'MISSING EXECUTED TOKEN SEQUENCE: {m!r} in {sys.argv[1]}', file=sys.stderr)
        sys.exit(1)
