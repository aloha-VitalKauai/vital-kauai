// Presentation logic for the member Sessions card, kept separate from the
// component so it can be tested without a DOM.
//
// The member sees one thing per session type: how many are left, and whether
// they can book. Everything the engine does underneath — holds, booking
// authorizations, webhook state, the allowance ledger — stays invisible.

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
