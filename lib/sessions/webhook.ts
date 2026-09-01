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
//                      The created half carries old_invitee. It INHERITS the
//                      allowance status of the booking it replaces — an
//                      authorized booking stays counted, an unauthorized
//                      (needs_review) one stays parked, and an unknown old
//                      booking fails closed. old_invitee alone is never
//                      authorization, and a reschedule never consumes a hold.
//   duplicate        → blocked twice over: the receipt idempotency claim and
//                      the unique index on session_bookings.calendly_invitee_uri
//                      (plain insert; 23505 = already recorded)
//   unknown email    → row parked with needs_review = true, member_id null,
//                      counts_against_allowance = false. No balance impact,
//                      no guessing.
//
// Build 2 of the recurring series adds, on top of the contract above:
//   series anchor    → a booking that consumes a hold whose purpose is
//                      'series_anchor' converts into a session_series and
//                      fans out the member's remaining weekly sessions
//                      (fanout.ts) — but ONLY on a signature-verified
//                      delivery. An unverified payload records the booking
//                      exactly as before and never creates a series.
//   meeting_url      → captured from the payload's scheduled_event.location
//                      join URL on insert; a duplicate delivery backfills it
//                      onto an existing row that is still missing one (Zoom
//                      provisions the link asynchronously, so the fan-out's
//                      own insert may predate it).
//   reschedule       → the replacement booking inherits series_id from the
//                      booking it replaces: one occurrence moves, the series
//                      rhythm never shifts.

import type { SupabaseClient } from "@supabase/supabase-js";
// Alias import (not "./fanout"): the node test loader resolves runtime-local
// imports through the @/ alias only.
import { convertAnchorToSeries } from "@/lib/sessions/fanout";

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
  oldInviteeUri: string | null;
  isReschedule: boolean;
  meetingUrl: string | null;
  inviteeTimezone: string | null;
};

export type SessionWebhookOptions = {
  /**
   * True only when the delivery's Calendly signature was checked against a
   * configured signing key and matched. Series creation fails closed on
   * anything less; ordinary booking reconciliation keeps its existing
   * compatibility behavior either way.
   */
  verified?: boolean;
  fetchImpl?: typeof fetch;
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

  const oldInviteeUri: string | null =
    typeof p.old_invitee === "string" ? p.old_invitee : p.old_invitee?.uri ?? null;

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
    oldInviteeUri,
    isReschedule: oldInviteeUri != null,
    meetingUrl: p.scheduled_event?.location?.join_url || null,
    inviteeTimezone: p.timezone || p.invitee?.timezone || null,
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
  options: SessionWebhookOptions = {},
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
      return await recordBooking(supabase, event, sessionType, receiptId, options);
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
  options: SessionWebhookOptions,
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

  // Authorization gate. A fresh booking may only count by consuming a valid
  // hold. A reschedule may only count by INHERITING authorization from the
  // booking it replaces — old_invitee alone is never authorization, so an
  // unauthorized needs_review booking cannot launder into a counted one by
  // being rescheduled.
  let candidateHoldId: string | null = null;
  let candidateHoldPurpose: string | null = null;
  let seriesId: string | null = null;
  let counts = false;
  if (matched && event.isReschedule) {
    // The canceled half of the pair has usually already flipped the old
    // row's counts_against_allowance off (that is how the session returns),
    // and Calendly's delivery order isn't guaranteed either way. The durable
    // marker of the old booking's authorization is needs_review, which
    // cancellation never touches. Unknown old booking → fail closed.
    const { data: previous } = await supabase
      .from("session_bookings")
      .select("id, needs_review, series_id")
      .eq("calendly_invitee_uri", event.oldInviteeUri)
      .maybeSingle();
    counts = previous != null && previous.needs_review === false;
    // A rescheduled series occurrence keeps its place in the series: only
    // this occurrence moves, the recurring rhythm never shifts.
    seriesId = previous?.series_id ?? null;
  } else if (matched) {
    // Find the oldest candidate hold; the claim itself is atomic further
    // down. A reschedule never reaches this branch — eating an unrelated
    // hold would strand a different in-flight booking attempt.
    const { data: hold } = await supabase
      .from("session_booking_holds")
      .select("id, purpose")
      .eq("member_id", profileId)
      .eq("session_type", sessionType)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    candidateHoldId = hold?.id ?? null;
    candidateHoldPurpose = hold?.purpose ?? null;
    counts = candidateHoldId != null;
  }

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
      series_id: seriesId,
      meeting_url: event.meetingUrl,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      // A row for this invitee already exists — a replayed delivery, or the
      // webhook echo of a booking the series fan-out created via the API.
      // Zoom provisions its join URL asynchronously, so this delivery may be
      // the first one that actually carries it: backfill, never overwrite.
      if (event.meetingUrl) {
        await supabase
          .from("session_bookings")
          .update({ meeting_url: event.meetingUrl })
          .eq("calendly_invitee_uri", event.inviteeUri)
          .is("meeting_url", null);
      }
      await setReceipt(supabase, receiptId, "ignored", `Duplicate booking: ${event.inviteeUri}`);
      return { handled: true, response: { ok: true, deduplicated: true } };
    }
    throw new Error(insertErr.message);
  }

  // Atomic consumption: only the caller that flips consumed_at from null
  // wins the authorization. If a concurrent booking claimed it first, this
  // booking is downgraded to needs_review — one entitlement can never
  // produce two counted bookings, no matter how webhooks interleave.
  let consumedAnchorHold = false;
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
    } else {
      consumedAnchorHold = candidateHoldPurpose === "series_anchor";
    }
  }

  // "Set My Weekly Time": a counted booking that consumed a series_anchor
  // hold converts into a recurring series and fans out the member's
  // remaining weekly sessions. Fails closed on an unverified delivery — a
  // payload nobody signed can never generate a series — and a conversion
  // failure never un-records the booking itself.
  let series: Record<string, unknown> | null = null;
  if (counts && consumedAnchorHold && profileId && event.startTime) {
    if (options.verified === true) {
      try {
        series = await convertAnchorToSeries(supabase, {
          profileId,
          sessionType,
          anchorBookingId: inserted.id,
          anchorStartTime: event.startTime,
          inviteeTimezone: event.inviteeTimezone,
          inviteeEmail: event.email,
          inviteeName: event.fullName,
          fetchImpl: options.fetchImpl ?? fetch,
        });
      } catch (err: any) {
        series = { ok: false, reason: `series_conversion_error: ${err?.message ?? String(err)}` };
      }
    } else {
      series = { ok: false, reason: "series_requires_verified_signature" };
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
      ...(series ? { series } : {}),
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
