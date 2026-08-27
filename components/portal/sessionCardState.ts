// Presentation logic for the member Sessions card, kept separate from the
// component so it can be tested without a DOM.
//
// The member sees one thing per session type: how many are left, and whether
// they can book. Everything the engine does underneath—holds, booking
// authorizations, webhook state, the allowance ledger—stays invisible.

export type SessionRowState = {
  label: string;
  canBook: boolean;
};

export function sessionRowState(args: {
  remaining: number;
  /** The booking endpoint reported this type isn't configured yet (503). */
  unavailable?: boolean;
}): SessionRowState {
  if (args.unavailable) {
    return { label: 'Scheduling coming soon', canBook: false };
  }
  if (args.remaining <= 0) {
    return { label: '0 sessions left', canBook: false };
  }
  return {
    label: `${args.remaining} session${args.remaining === 1 ? '' : 's'} left`,
    canBook: true,
  };
}

// A member with no allowance of a given type was never given those sessions —
// that row simply doesn't apply to them, so it isn't rendered at all. This is
// different from having used them all up, which shows "0 sessions left".
export function shouldShowRow(granted: number): boolean {
  return granted > 0;
}

// Reduce an unknown thrown value to a short, sanitized string for console
// diagnostics. Deliberately extracts ONLY name + code/status + message —
// never the raw object—so a rejection that happens to carry response
// payloads, tokens, emails, or stack-embedded values can never reach the
// console. The message is capped; anything longer than an error message
// isn't an error message.
export function describeError(err: unknown): string {
  const e = err as { name?: unknown; code?: unknown; status?: unknown; message?: unknown } | null;
  const name = typeof e?.name === 'string' ? e.name : 'Error';
  const code =
    typeof e?.code === 'string' || typeof e?.code === 'number'
      ? String(e.code)
      : typeof e?.status === 'string' || typeof e?.status === 'number'
        ? String(e.status)
        : '';
  const message =
    typeof e?.message === 'string' ? e.message : typeof err === 'string' ? err : 'unknown error';
  return `${name}${code ? ` ${code}` : ''}: ${message}`.slice(0, 300);
}
