// Sessions V1 Build 2 — the gated booking flow.
//
//   Member clicks Book
//     → if an ISSUED authorization (hold + single-use link) is already
//       outstanding for this member + type, return the SAME link — repeat
//       clicks never mint a second entitlement
//     → otherwise acquire_session_hold() atomically reserves 1 of the
//       remaining sessions (or refuses: two simultaneous attempts on the
//       last session cannot both pass)
//     → a SINGLE-USE Calendly scheduling link is created and ATTACHED to the
//       hold, extending the authorization to the link's own validity horizon
//       (~90 days). The link and its entitlement expire together; an unused
//       link can never outlive its hold and turn into a free session.
//
// Any failure after the hold is taken releases it immediately — and if the
// link can't be attached to the hold, the link is withheld entirely (a URL
// nobody received can't be booked).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SessionType } from "./balance";

// Calendly single-use scheduling links remain bookable for ~90 days; the
// authorization must live exactly as long as the link it backs.
export const CALENDLY_LINK_VALIDITY_DAYS = 90;

export type BookingLinkResult =
  | { ok: true; bookingUrl: string; holdExpiresAt: string }
  | { ok: false; reason: "no_sessions_remaining" | "not_configured" | "calendly_error" };

export function calendlyTokenFor(sessionType: SessionType): string | undefined {
  // Two Calendly organizations feed one system: the Vital team org (coaching)
  // uses the long-standing CALENDLY_API_TOKEN; the PNE org has its own token.
  return sessionType === "coaching"
    ? process.env.CALENDLY_API_TOKEN
    : process.env.CALENDLY_API_TOKEN_PNE;
}

export async function createSessionBookingLink(
  supabase: SupabaseClient,
  args: {
    memberId: string;
    memberEmail: string | null;
    memberName: string | null;
    sessionType: SessionType;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<BookingLinkResult> {
  const { memberId, sessionType } = args;

  // 0. One outstanding authorization per member + type: a still-valid issued
  //    link is returned as-is instead of minting another.
  const { data: outstanding } = await supabase
    .from("session_booking_holds")
    .select("id, booking_url, expires_at")
    .eq("member_id", memberId)
    .eq("session_type", sessionType)
    .is("consumed_at", null)
    .not("booking_url", "is", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (outstanding?.booking_url) {
    return {
      ok: true,
      bookingUrl: outstanding.booking_url,
      holdExpiresAt: outstanding.expires_at,
    };
  }

  // 1. Atomically reserve one session. Empty result = nothing available.
  const { data: holds, error: holdErr } = await supabase.rpc("acquire_session_hold", {
    p_member: memberId,
    p_session_type: sessionType,
  });
  if (holdErr) throw new Error(`acquire_session_hold failed: ${holdErr.message}`);
  const hold = Array.isArray(holds) ? holds[0] : holds;
  if (!hold) return { ok: false, reason: "no_sessions_remaining" };

  const releaseHold = async () => {
    await supabase
      .from("session_booking_holds")
      .delete()
      .eq("id", hold.hold_id)
      .is("consumed_at", null);
  };

  // 2. Resolve which Calendly event type this session type books.
  const { data: mapping } = await supabase
    .from("calendly_event_mappings")
    .select("calendly_event_type_uri")
    .eq("session_type", sessionType)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const token = calendlyTokenFor(sessionType);
  if (!mapping || !token) {
    await releaseHold();
    return { ok: false, reason: "not_configured" };
  }

  // 3. Single-use scheduling link: gate first, then hand out one booking's
  //    worth of access — never a reusable URL.
  let bookingUrl: string | null = null;
  try {
    const res = await fetchImpl("https://api.calendly.com/scheduling_links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        max_event_count: 1,
        owner: mapping.calendly_event_type_uri,
        owner_type: "EventType",
      }),
    });
    if (res.ok) {
      const json: any = await res.json();
      bookingUrl = json?.resource?.booking_url ?? null;
    }
  } catch {
    bookingUrl = null;
  }
  if (!bookingUrl) {
    await releaseHold();
    return { ok: false, reason: "calendly_error" };
  }

  // Prefill so the invitee email matches the account email — that match is
  // how the webhook ties the booking back to the member.
  const params = new URLSearchParams();
  if (args.memberEmail) params.set("email", args.memberEmail);
  if (args.memberName) params.set("name", args.memberName);
  const query = params.toString();
  const finalUrl = query ? `${bookingUrl}?${query}` : bookingUrl;

  // 4. Attach the link to its authorization and extend the hold to the
  //    link's validity horizon: they now expire together. If the attach
  //    fails, the link is withheld and the hold released — fail closed.
  const linkExpiresAt = new Date(
    Date.now() + CALENDLY_LINK_VALIDITY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { error: attachErr } = await supabase
    .from("session_booking_holds")
    .update({ booking_url: finalUrl, expires_at: linkExpiresAt })
    .eq("id", hold.hold_id)
    .is("consumed_at", null);
  if (attachErr) {
    await releaseHold();
    return { ok: false, reason: "calendly_error" };
  }

  return { ok: true, bookingUrl: finalUrl, holdExpiresAt: linkExpiresAt };
}
