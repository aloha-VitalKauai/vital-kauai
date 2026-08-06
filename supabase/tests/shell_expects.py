#!/usr/bin/env python3
"""B-78 / LOW-3: bash-aware structural check that a shell script actually
EXECUTES the required commands with the required arguments.

Lines are lexed with shlex (POSIX, `#` comments enabled), so commented-out or
quoted text never counts. LOW-3 (post-approval): matching is COMMAND-POSITION
aware. Tokens are grouped into simple commands (split at ; && || | &), leading
VAR=value assignments are skipped, and a specification only matches a command
whose HEAD token is the named program -- `echo dropdb --if-exists` no longer
satisfies a dropdb requirement, because its head is echo.

Usage: shell_expects.py <script> <head[:arg1,arg2,...]> ...
Each spec requires at least one simple command whose head token equals <head>
and whose arguments contain the given CONSECUTIVE arg sequence (head alone if
no args given). Exit 0 only if every spec is satisfied.
"""
import re, shlex, sys

CTRL = {';', '&&', '||', '|', '&'}
ASSIGN = re.compile(r'^[A-Za-z_][A-Za-z_0-9]*=')

def line_tokens(line):
    try:
        return shlex.split(line, comments=True, posix=True)
    except ValueError:
        # Unterminated quote (heredoc etc.). Strip from the first start-of-word
        # `#` BEFORE splitting so comment text can never satisfy a check, then
        # split crudely -- a real command hidden behind the quote stays findable.
        return re.sub(r'(^|\s)#.*$', '', line).split()

def commands(path):
    """Yield [head, arg, ...] for every simple command in the script."""
    for line in open(path):
        cmd = []
        # punctuation-attached operators (tok;, tok&&) split conservatively
        toks = []
        for t in line_tokens(line):
            parts = re.split(r'(;|\|\||\||&&|&)', t)
            toks.extend(p for p in parts if p)
        for t in toks:
            if t in CTRL:
                if cmd: yield cmd
                cmd = []
            else:
                cmd.append(t)
        if cmd: yield cmd

def strip_assignments(cmd):
    i = 0
    while i < len(cmd) and ASSIGN.match(cmd[i]):
        i += 1
    return cmd[i:]

def spec_ok(cmds, spec):
    head, _, args = spec.partition(':')
    want = args.split(',') if args else []
    n = len(want)
    for cmd in cmds:
        cmd = strip_assignments(cmd)
        if not cmd or cmd[0].split('/')[-1] != head:
            continue
        rest = cmd[1:]
        if n == 0 or any(rest[i:i+n] == want for i in range(len(rest) - n + 1)):
            return True
    return False

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit('usage: shell_expects.py <script> <head[:arg1,arg2,...]> ...')
    cmds = list(commands(sys.argv[1]))
    missing = [s for s in sys.argv[2:] if not spec_ok(cmds, s)]
    if missing:
        for m in missing:
            print(f'NO EXECUTED COMMAND MATCHES SPEC: {m!r} in {sys.argv[1]}', file=sys.stderr)
        sys.exit(1)
