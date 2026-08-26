// Sessions V1 Build 2 — Calendly webhook processing for session bookings.
//
// Called by /api/calendly-webhook AFTER signature verification and receipt
// logging, BEFORE the legacy discovery-call lead flow. An event belongs to
// the sessions system if (and only if) its Calendly event type URI has an
// active row in calendly_event_mappings; everything else returns
// { handled: false } and falls through to the existing lead pipeline
// completely untouched.
//
// Behavior contract (Build 2 acceptance):
//   invitee.created  → booking row recorded. It counts against the allowance
//                      ONLY by atomically consuming a valid authorization
//                      (an active hold) — a matching email alone never
//                      deducts. No authorization → parked needs_review.
//   invitee.canceled → booking stops counting, the session returns
//   reschedule       → Calendly sends canceled + created; net balance 0.
//                      The created half carries old_invitee: it stays counted
//                      (it replaces a counted booking) and does NOT consume
//                      an authorization.
//   duplicate        → blocked twice over: the receipt idempotency claim and
//                      the unique index on session_bookings.calendly_invitee_uri
//                      (plain insert; 23505 = already recorded)
//   unknown email    → row parked with needs_review = true, member_id null,
//                      counts_against_allowance = false. No balance impact,
//                      no guessing.

import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionWebhookOutcome =
  | { handled: false }
  | { handled: true; response: Record<string, unknown> };

export type SessionEvent = {
  eventType: "invitee.created" | "invitee.canceled";
  eventTypeUri: string | null;
  inviteeUri: string | null;
  scheduledEventUri: string | null;
  email: string | null;
  fullName: string;
  startTime: string | null;
  isReschedule: boolean;
};

// Calendly has shipped more than one payload shape (V1 objects, V2 URI
// strings); extraction mirrors the defensive style of the legacy handler.
export function extractSessionEvent(body: any): SessionEvent | null {
  const eventType = body?.event;
  if (eventType !== "invitee.created" && eventType !== "invitee.canceled") {
    return null;
  }
  const p = body?.payload || {};

  const eventTypeUri: string | null =
    p.scheduled_event?.event_type ||
    (typeof p.event_type === "string" ? p.event_type : null) ||
    null;

  const scheduledEventUri: string | null =
    p.scheduled_event?.uri ||
    (typeof p.event === "string" ? p.event : p.event?.uri || null);

  return {
    eventType,
    eventTypeUri,
    inviteeUri: p.uri || p.invitee?.uri || null,
    scheduledEventUri,
    email: p.invitee?.email || p.email || body.email || null,
    fullName: p.invitee?.name || p.name || body.name || "Unknown",
    startTime:
      p.scheduled_event?.start_time ||
      (typeof p.event === "object" ? p.event?.start_time : null) ||
      null,
    isReschedule: p.old_invitee != null,
  };
}

async function setReceipt(
  supabase: SupabaseClient,
  receiptId: string | null,
  status: string,
  error?: string,
) {
  if (!receiptId) return;
  try {
    await supabase
      .from("webhook_receipts")
      .update({ processing_status: status, processing_error: error })
      .eq("id", receiptId);
  } catch {
    // Receipt bookkeeping must never break webhook processing.
  }
}

export async function processSessionWebhook(
  supabase: SupabaseClient,
  body: any,
  receiptId: string | null,
): Promise<SessionWebhookOutcome> {
  const event = extractSessionEvent(body);
  if (!event || !event.eventTypeUri) return { handled: false };

  // Only mapped event types belong to the sessions system.
  const { data: mapping } = await supabase
    .from("calendly_event_mappings")
    .select("session_type")
    .eq("calendly_event_type_uri", event.eventTypeUri)
    .eq("active", true)
    .maybeSingle();
  if (!mapping) return { handled: false };

  const sessionType: string = mapping.session_type;

  try {
    if (!event.inviteeUri) {
      await setReceipt(supabase, receiptId, "failed", "Session event without invitee URI");
      return { handled: true, response: { ok: false, reason: "missing_invitee_uri" } };
    }

    // Receipt-level idempotency, same claim trick as the lead flow: the key is
    // event-prefixed because a reschedule's canceled + created halves share
    // one invitee URI and must both process.
    if (receiptId) {
      const { error: claimErr } = await supabase
        .from("webhook_receipts")
        .update({ idempotency_key: `${event.eventType}:${event.inviteeUri}` })
        .eq("id", receiptId);
      if (claimErr && claimErr.code === "23505") {
        await setReceipt(supabase, receiptId, "ignored", `Duplicate session event: ${event.inviteeUri}`);
        return { handled: true, response: { ok: true, deduplicated: true } };
      }
    }

    if (event.eventType === "invitee.created") {
      return await recordBooking(supabase, event, sessionType, receiptId);
    }
    return await recordCancellation(supabase, event, sessionType, receiptId);
  } catch (err: any) {
    await setReceipt(supabase, receiptId, "failed", `Session processing: ${err?.message ?? String(err)}`);
    return { handled: true, response: { ok: false, reason: "session_processing_error" } };
  }
}

async function recordBooking(
  supabase: SupabaseClient,
  event: SessionEvent,
  sessionType: string,
  receiptId: string | null,
): Promise<SessionWebhookOutcome> {
  // Match strictly on the member's account email. No guessing: anything else
  // parks as needs_review with zero balance impact.
  let profileId: string | null = null;
  if (event.email) {
    const { data: member } = await supabase
      .from("members")
      .select("id, profile_id")
      .ilike("email", event.email)
      .maybeSingle();
    profileId = member?.profile_id ?? null;
  }
  const matched = profileId != null;

  // Authorization gate: a fresh (non-reschedule) booking may only count by
  // consuming a valid hold. Find the oldest candidate; the claim itself is
  // atomic further down. A reschedule's created half counts without one — it
  // replaces a booking that already consumed its authorization, and eating an
  // unrelated hold would strand a different in-flight booking attempt.
  let candidateHoldId: string | null = null;
  if (matched && !event.isReschedule) {
    const { data: hold } = await supabase
      .from("session_booking_holds")
      .select("id")
      .eq("member_id", profileId)
      .eq("session_type", sessionType)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    candidateHoldId = hold?.id ?? null;
  }
  let counts = matched && (event.isReschedule || candidateHoldId != null);

  // Plain insert; the partial unique index on calendly_invitee_uri makes a
  // replayed webhook fail with 23505 — one invitee, one deduction, ever.
  const { data: inserted, error: insertErr } = await supabase
    .from("session_bookings")
    .insert({
      member_id: profileId,
      session_type: sessionType,
      calendly_event_uri: event.scheduledEventUri,
      calendly_invitee_uri: event.inviteeUri,
      invitee_email: event.email,
      invitee_name: event.fullName,
      scheduled_at: event.startTime,
      status: "scheduled",
      counts_against_allowance: counts,
      needs_review: !counts,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      await setReceipt(supabase, receiptId, "ignored", `Duplicate booking: ${event.inviteeUri}`);
      return { handled: true, response: { ok: true, deduplicated: true } };
    }
    throw new Error(insertErr.message);
  }

  // Atomic consumption: only the caller that flips consumed_at from null
  // wins the authorization. If a concurrent booking claimed it first, this
  // booking is downgraded to needs_review — one entitlement can never
  // produce two counted bookings, no matter how webhooks interleave.
  if (candidateHoldId) {
    const { data: claimed } = await supabase
      .from("session_booking_holds")
      .update({ consumed_at: new Date().toISOString(), consumed_by_booking_id: inserted.id })
      .eq("id", candidateHoldId)
      .is("consumed_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      counts = false;
      await supabase
        .from("session_bookings")
        .update({ counts_against_allowance: false, needs_review: true })
        .eq("id", inserted.id);
    }
  }

  await setReceipt(supabase, receiptId, "processed");
  return {
    handled: true,
    response: {
      ok: true,
      session: sessionType,
      recorded: "booked",
      needsReview: !counts,
      bookingId: inserted.id,
    },
  };
}

async function recordCancellation(
  supabase: SupabaseClient,
  event: SessionEvent,
  sessionType: string,
  receiptId: string | null,
): Promise<SessionWebhookOutcome> {
  // Naturally idempotent: canceling an already-canceled booking rewrites the
  // same terminal state. The session returns because the row stops counting.
  const { data: updated, error } = await supabase
    .from("session_bookings")
    .update({
      status: "canceled",
      counts_against_allowance: false,
      canceled_at: new Date().toISOString(),
    })
    .eq("calendly_invitee_uri", event.inviteeUri)
    .select("id");

  if (error) throw new Error(error.message);

  if (!updated || updated.length === 0) {
    // A cancel for a booking we never recorded (e.g. booked before Build 2
    // went live). Nothing counted, so nothing returns; keep the audit trail.
    await setReceipt(supabase, receiptId, "ignored", `Cancel for unknown booking: ${event.inviteeUri}`);
    return { handled: true, response: { ok: true, session: sessionType, recorded: "cancel_unmatched" } };
  }

  await setReceipt(supabase, receiptId, "processed");
  return {
    handled: true,
    response: { ok: true, session: sessionType, recorded: "canceled", bookingId: updated[0].id },
  };
}
