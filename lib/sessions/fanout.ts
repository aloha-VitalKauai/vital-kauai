// Sessions V4 Build 2 — series creation and weekly fan-out.
//
// Entered from the webhook when a counted booking consumed a hold whose
// purpose is 'series_anchor' (and only on a signature-verified delivery —
// webhook.ts enforces that before calling in). From that one anchor:
//
//   1. planned_sessions is snapshotted from the member's ACTUAL remaining
//      coaching allowance — the anchor already counts, so the series covers
//      remaining + 1 (the anchor plus everything still owed). Never a
//      hard-coded 6; a member arriving with a different balance gets a
//      series exactly that long.
//   2. One session_series row is created. The partial unique index (one
//      ACTIVE series per member per type) makes a replayed anchor webhook
//      collapse onto the existing series instead of creating a second.
//   3. Each remaining weekly occurrence — the same wall-clock time in the
//      member's timezone, from recurrence.ts — is checked against Calendly
//      availability and booked through the Calendly API. Every occurrence
//      becomes an ordinary session_bookings row; a week that cannot be
//      booked (slot taken, API refusal) gets a needs_scheduling row and the
//      rest of the series is untouched.
//
// Idempotency, layer by layer:
//   * the series row: unique partial index, resumed on conflict;
//   * occurrences: the target instants are a pure function of the series
//     row, and any existing row at an occurrence's instant — scheduled,
//     completed, canceled, no_show or needs_scheduling — claims that slot,
//     so a re-run only ever fills genuine gaps and a canceled week is never
//     silently rebooked;
//   * the Calendly side: each API-created invitee is recorded immediately
//     under the invitee-URI unique index, and the webhook echo of that same
//     invitee deduplicates against it (or, if the echo won the race, the
//     insert conflict is resolved by claiming the echo's parked row).
//   * the allowance: the live balance is re-derived before every single
//     creation; the fan-out stops the moment nothing remains, so it can
//     never book past the ledger no matter how it interleaves with other
//     bookings.
//
// The one race left open, deliberately: between our POST /invitees and our
// own insert (sub-second), Calendly's echo can process first; if the member
// ALSO holds an unconsumed single-booking hold at that exact moment, the
// echo consumes it. The booking still counts exactly once — the stranded
// single link later parks as needs_review, a founder-fixable inconvenience.
// Closing it would need pre-registering invitee URIs Calendly hasn't
// assigned yet.

import type { SupabaseClient } from "@supabase/supabase-js";
// Alias imports (not "./balance" etc.): the node test loader resolves
// runtime-local imports through the @/ alias only.
import { getSessionBalances, type SessionType } from "@/lib/sessions/balance";
import { calendlyTokenFor } from "@/lib/sessions/booking";
import { generateWeeklyOccurrences } from "@/lib/sessions/recurrence";

const CALENDLY_API = "https://api.calendly.com";
export const DEFAULT_SERIES_TIMEZONE = "Pacific/Honolulu";

export type FanoutSummary = {
  ok: boolean;
  seriesId?: string;
  planned?: number;
  created?: number;
  needsScheduling?: number;
  skippedExisting?: number;
  stoppedAtAllowance?: boolean;
  reason?: string;
};

type SeriesRow = {
  id: string;
  member_id: string;
  journey_id: string | null;
  session_type: string;
  first_session_at: string;
  timezone: string;
  planned_sessions: number;
};

export async function convertAnchorToSeries(
  supabase: SupabaseClient,
  args: {
    profileId: string;
    sessionType: string;
    anchorBookingId: string;
    anchorStartTime: string;
    inviteeTimezone: string | null;
    inviteeEmail: string | null;
    inviteeName: string | null;
    fetchImpl: typeof fetch;
  },
): Promise<FanoutSummary> {
  const { profileId, sessionType } = args;

  // planned = the member's actual remaining allowance, anchor included. The
  // anchor booking is already recorded and counting at this point, so the
  // live remaining is what is still owed AFTER it.
  const balances = await getSessionBalances(supabase, profileId);
  const remainingAfterAnchor = balances[sessionType as SessionType]?.remaining ?? 0;
  const planned = remainingAfterAnchor + 1;
  if (planned < 1) {
    return { ok: false, reason: "no_allowance_for_series" };
  }

  // Optional journey context, same resolution the portal uses: the member's
  // latest journey that wasn't canceled.
  const { data: journey } = await supabase
    .from("journeys")
    .select("id, status, created_at")
    .eq("member_id", profileId)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const timezone = args.inviteeTimezone || DEFAULT_SERIES_TIMEZONE;

  let series: SeriesRow | null = null;
  const { data: insertedSeries, error: seriesErr } = await supabase
    .from("session_series")
    .insert({
      member_id: profileId,
      journey_id: journey?.id ?? null,
      session_type: sessionType,
      anchor_booking_id: args.anchorBookingId,
      first_session_at: args.anchorStartTime,
      timezone,
      planned_sessions: planned,
      status: "active",
    })
    .select("id, member_id, journey_id, session_type, first_session_at, timezone, planned_sessions")
    .single();

  if (seriesErr) {
    if (seriesErr.code !== "23505") throw new Error(seriesErr.message);
    // An active series already exists (replayed anchor, or a second anchor
    // booked while one is live). Resume the EXISTING series — its own
    // first_session_at and planned_sessions stay authoritative; this anchor
    // never restarts or reshapes a series that is already running.
    const { data: existing } = await supabase
      .from("session_series")
      .select("id, member_id, journey_id, session_type, first_session_at, timezone, planned_sessions, anchor_booking_id")
      .eq("member_id", profileId)
      .eq("session_type", sessionType)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!existing) throw new Error(seriesErr.message);
    series = existing as SeriesRow;
  } else {
    series = insertedSeries as SeriesRow;
    // The anchor is occurrence #1 of its own series.
    await supabase
      .from("session_bookings")
      .update({ series_id: series.id })
      .eq("id", args.anchorBookingId);
  }

  const fanout = await runSeriesFanout(supabase, series, {
    inviteeEmail: args.inviteeEmail,
    inviteeName: args.inviteeName,
    fetchImpl: args.fetchImpl,
  });
  return { ...fanout, seriesId: series.id, planned: series.planned_sessions };
}

// Bookable window Calendly accepts for an availability query: it must start
// in the future and span less than 7 days.
function availabilityWindow(occurrence: Date, now: Date) {
  const start = new Date(Math.max(occurrence.getTime() - 60 * 60_000, now.getTime() + 60_000));
  const end = new Date(occurrence.getTime() + 60 * 60_000);
  return { start, end };
}

export async function runSeriesFanout(
  supabase: SupabaseClient,
  series: SeriesRow,
  deps: {
    inviteeEmail: string | null;
    inviteeName: string | null;
    fetchImpl: typeof fetch;
    now?: () => Date;
  },
): Promise<FanoutSummary> {
  const now = deps.now ?? (() => new Date());

  // The Calendly capability this fan-out books through — same resolution as
  // the booking flow. URL-only mappings (no event type URI or no token, PNE
  // today) cannot be booked via the API, so no series fan-out is possible.
  const { data: mapping } = await supabase
    .from("calendly_event_mappings")
    .select("calendly_event_type_uri, scheduling_url")
    .eq("session_type", series.session_type)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  const token = calendlyTokenFor(series.session_type as SessionType);
  if (!mapping?.calendly_event_type_uri || !token) {
    return { ok: false, reason: "fanout_not_configured" };
  }
  const eventTypeUri = mapping.calendly_event_type_uri;

  const calendly = async (path: string, init?: RequestInit) => {
    const res = await deps.fetchImpl(`${CALENDLY_API}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`calendly ${path} → ${res.status}`);
    return res.json() as Promise<any>;
  };

  // The full deterministic occurrence list, anchor included. Any existing
  // row of this series at an occurrence's instant claims that slot — which
  // both makes re-runs no-ops and keeps a canceled week canceled.
  const occurrences = generateWeeklyOccurrences({
    firstSessionAt: series.first_session_at,
    timezone: series.timezone,
    count: series.planned_sessions,
  });
  const { data: existingRows } = await supabase
    .from("session_bookings")
    .select("scheduled_at")
    .eq("series_id", series.id);
  const claimed = new Set(
    (existingRows ?? [])
      .filter((r: any) => r.scheduled_at != null)
      .map((r: any) => new Date(r.scheduled_at).getTime()),
  );

  let created = 0;
  let needsScheduling = 0;
  let skippedExisting = 0;
  let stoppedAtAllowance = false;

  const markNeedsScheduling = async (occurrenceIso: string) => {
    const { error } = await supabase.from("session_bookings").insert({
      member_id: series.member_id,
      journey_id: series.journey_id,
      session_type: series.session_type,
      scheduled_at: occurrenceIso,
      status: "needs_scheduling",
      counts_against_allowance: false,
      needs_review: false,
      series_id: series.id,
    });
    if (!error) needsScheduling++;
  };

  for (const occurrenceIso of occurrences) {
    const occurrence = new Date(occurrenceIso);
    if (claimed.has(occurrence.getTime())) {
      skippedExisting++;
      continue;
    }

    // Never book past the ledger: the live balance is re-derived before
    // every creation, so a concurrent booking elsewhere shrinks this run
    // instead of being overdrawn.
    const balances = await getSessionBalances(supabase, series.member_id);
    if ((balances[series.session_type as SessionType]?.remaining ?? 0) <= 0) {
      stoppedAtAllowance = true;
      break;
    }

    // A slot already in the past can't be booked by anyone; record it as
    // needing scheduling rather than pretending.
    if (occurrence.getTime() <= now().getTime()) {
      await markNeedsScheduling(occurrenceIso);
      continue;
    }

    try {
      const { start, end } = availabilityWindow(occurrence, now());
      const availability = await calendly(
        `/event_type_available_times?event_type=${encodeURIComponent(eventTypeUri)}` +
          `&start_time=${start.toISOString()}&end_time=${end.toISOString()}`,
      );
      const slotOpen = (availability?.collection ?? []).some(
        (slot: any) =>
          slot?.status === "available" &&
          new Date(slot.start_time).getTime() === occurrence.getTime(),
      );
      if (!slotOpen) {
        await markNeedsScheduling(occurrenceIso);
        continue;
      }

      const bookedInvitee = await calendly("/invitees", {
        method: "POST",
        body: JSON.stringify({
          event_type: eventTypeUri,
          start_time: occurrenceIso,
          invitee: {
            email: deps.inviteeEmail,
            name: deps.inviteeName ?? "Vital Kauaʻi member",
            timezone: series.timezone,
          },
          location: { kind: "zoom_conference" },
        }),
      });
      const inviteeUri: string | null = bookedInvitee?.resource?.uri ?? null;
      const scheduledEventUri: string | null = bookedInvitee?.resource?.event ?? null;
      if (!inviteeUri) throw new Error("calendly create returned no invitee uri");

      const { error: insertErr } = await supabase.from("session_bookings").insert({
        member_id: series.member_id,
        journey_id: series.journey_id,
        session_type: series.session_type,
        calendly_event_uri: scheduledEventUri,
        calendly_invitee_uri: inviteeUri,
        invitee_email: deps.inviteeEmail,
        invitee_name: deps.inviteeName,
        scheduled_at: occurrenceIso,
        status: "scheduled",
        counts_against_allowance: true,
        needs_review: false,
        series_id: series.id,
      });
      if (insertErr) {
        if (insertErr.code !== "23505") throw new Error(insertErr.message);
        // The webhook echo for this invitee processed first and parked the
        // row (no hold to consume). The fan-out IS the authorization: claim
        // the parked row for the series and let it count.
        await supabase
          .from("session_bookings")
          .update({
            member_id: series.member_id,
            journey_id: series.journey_id,
            series_id: series.id,
            scheduled_at: occurrenceIso,
            counts_against_allowance: true,
            needs_review: false,
          })
          .eq("calendly_invitee_uri", inviteeUri);
      }
      created++;

      // One immediate fetch for the Zoom join URL — it usually exists within
      // seconds of creation. When it doesn't yet, the row stays without one
      // and the webhook echo backfills meeting_url when it arrives carrying
      // the link (recordBooking's duplicate path). No polling loops here.
      if (scheduledEventUri?.startsWith(CALENDLY_API)) {
        try {
          const eventDetail = await calendly(scheduledEventUri.slice(CALENDLY_API.length));
          const joinUrl: string | null = eventDetail?.resource?.location?.join_url ?? null;
          if (joinUrl) {
            await supabase
              .from("session_bookings")
              .update({ meeting_url: joinUrl })
              .eq("calendly_invitee_uri", inviteeUri)
              .is("meeting_url", null);
          }
        } catch {
          // The echo backfill covers this; a missing join URL is never worth
          // failing the occurrence over.
        }
      }
    } catch {
      // Availability check or creation failed for THIS occurrence only.
      // Record it honestly and keep going — one bad week never takes the
      // rest of the series down.
      await markNeedsScheduling(occurrenceIso);
    }
  }

  return { ok: true, created, needsScheduling, skippedExisting, stoppedAtAllowance };
}
