// Client half of the booking flow: ask the server for this member's booking
// link and classify the answer.
//
// The gating all lives server-side in book-route.ts — this only translates
// its status codes into something a component can render. Kept in one place
// so every "Book a session" surface (the sessions card in the integration
// hero, the team cards on the portal home, the Week 1 action item) goes
// through the same authorization path and the same allowance ledger. A
// surface that linked straight to Calendly would book a session nothing
// counted.

import type { SessionType } from "./balance";

export type BookingRequest =
  /** A link was issued; send the member to it. */
  | { status: "ok"; bookingUrl: string }
  /** 503 — this session type has no active Calendly mapping yet. */
  | { status: "unavailable" }
  /** 409 — the allowance is spent. */
  | { status: "none_remaining" }
  /** Anything else, including a network failure. */
  | { status: "error" };

export async function requestSessionBooking(
  type: SessionType,
  fetchImpl: typeof fetch = fetch,
): Promise<BookingRequest> {
  try {
    const res = await fetchImpl(`/api/sessions/${type}/book`, { method: "POST" });
    if (res.status === 503) return { status: "unavailable" };
    if (res.status === 409) return { status: "none_remaining" };
    if (!res.ok) return { status: "error" };
    const { booking_url: bookingUrl } = await res.json();
    if (!bookingUrl) return { status: "error" };
    return { status: "ok", bookingUrl };
  } catch {
    return { status: "error" };
  }
}

/** Shown wherever a booking attempt fails. One sentence, no engine detail. */
export const BOOKING_UNAVAILABLE_NOTICE =
  "Scheduling is unavailable right now. Please try again shortly.";

/** Shown when the member's included sessions of this type are all used. */
export const BOOKING_NONE_REMAINING_NOTICE =
  "Your included sessions of this type are complete.";
