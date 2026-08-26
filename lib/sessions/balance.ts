// Sessions V1 balance math (Build 1).
//
// The remaining balance is never stored anywhere; it is derived on every read:
//
//   remaining = sum(allowance quantities) - count(bookings that count)
//
// member_session_allowances is an append-only ledger (program grants, founder
// adjustments), so cancellations and reschedules can never drift a counter —
// a canceled booking simply stops counting and the session returns.

import type { SupabaseClient } from "@supabase/supabase-js";

export const SESSION_TYPES = ["coaching", "pne"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export type AllowanceRow = {
  session_type: string;
  quantity: number;
};

export type CountingBookingRow = {
  session_type: string;
  counts_against_allowance: boolean;
};

export type SessionBalance = {
  granted: number;
  used: number;
  remaining: number;
};

export function computeSessionBalance(
  allowances: AllowanceRow[],
  bookings: CountingBookingRow[],
  type: SessionType,
): SessionBalance {
  const granted = allowances
    .filter((row) => row.session_type === type)
    .reduce((sum, row) => sum + row.quantity, 0);
  const used = bookings.filter(
    (row) => row.session_type === type && row.counts_against_allowance,
  ).length;
  return { granted, used, remaining: granted - used };
}

// Works under any client: a member's session client sees only their own rows
// (RLS), so asking about another member yields an empty set and a balance of
// zero — fail closed. Founder and service-role clients see everything.
export async function getSessionBalances(
  supabase: SupabaseClient,
  memberId: string,
): Promise<Record<SessionType, SessionBalance>> {
  const [allowances, bookings] = await Promise.all([
    supabase
      .from("member_session_allowances")
      .select("session_type, quantity")
      .eq("member_id", memberId),
    supabase
      .from("session_bookings")
      .select("session_type, counts_against_allowance")
      .eq("member_id", memberId)
      .eq("counts_against_allowance", true),
  ]);
  if (allowances.error) {
    throw new Error(
      `member_session_allowances read failed: ${allowances.error.message}`,
    );
  }
  if (bookings.error) {
    throw new Error(`session_bookings read failed: ${bookings.error.message}`);
  }
  const allowanceRows = (allowances.data ?? []) as AllowanceRow[];
  const bookingRows = (bookings.data ?? []) as CountingBookingRow[];
  return {
    coaching: computeSessionBalance(allowanceRows, bookingRows, "coaching"),
    pne: computeSessionBalance(allowanceRows, bookingRows, "pne"),
  };
}

export async function getRemainingSessions(
  supabase: SupabaseClient,
  memberId: string,
  type: SessionType,
): Promise<number> {
  const balances = await getSessionBalances(supabase, memberId);
  return balances[type].remaining;
}
