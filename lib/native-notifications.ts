"use client";

// Journey reminders for the Capacitor iOS shell.
//
// Schedules a small set of on-device local notifications around the
// member's journey: two before arrival, four check-ins after
// departure. Everything runs locally — no push server, no APNs key,
// no device-token storage. When the org's Apple Developer enrollment
// lands, remote push can be layered on separately without touching
// this module.
//
// Same safety contract as lib/biometric.ts: every entry point
// short-circuits off native iOS, and the plugin is dynamic-imported
// inside guarded functions so the web/PWA bundle never references
// native bridge code.
//
// Notification copy is lock-screen visible. It stays warm and
// non-specific — arrival, welcome, check-in — so nothing about the
// nature of a member's journey is readable off a locked phone. That
// rules out the vocabulary of the work itself (medicine, ceremony,
// integration); a bystander should read ordinary travel and wellness.
//
// Reminders are deliberately silent (banner only, no sound field) —
// gentle by intent. Delivery uses calendar triggers (wall-clock date
// components), so "10:00" floats to the member's timezone at fire
// time rather than freezing at the timezone where the last sync ran.

import { isNativeIOS } from "@/lib/biometric";
import { createClient } from "@/lib/supabase/client";

// Fixed ID block for this module. Sync cancels exactly this range
// before scheduling, which makes the whole operation idempotent and
// keeps us clear of any future notification IDs elsewhere.
const REMINDER_ID_BASE = 4100;
const REMINDER_ID_MAX = 4199;

// Wall-clock hour (member's timezone at fire time) reminders land at.
const REMINDER_HOUR = 10;

// Ceremony timestamps are stored as instants; their calendar day is
// always interpreted in the retreat's timezone, so a member syncing
// from home anchors to the same day as one syncing on island.
const RETREAT_TIME_ZONE = "Pacific/Honolulu";

export type Reminder = {
  id: number;
  title: string;
  body: string;
  at: Date;
};

export type ReminderAnchors = {
  // Date-only strings ("YYYY-MM-DD") from members; null when unset.
  arrivalDate: string | null;
  departureDate: string | null;
  // Timestamps from the journey row; null when unscheduled.
  ceremonyStart: string | null;
  ceremonyEnd: string | null;
};

// Renders a timestamp as its calendar day on Kauaʻi ("YYYY-MM-DD").
// en-CA is the locale whose date format is already YYYY-MM-DD.
function retreatDayOf(timestamp: string): string | null {
  const parsed = new Date(timestamp);
  if (isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RETREAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

// Parses a date-only string into a local Date pinned to REMINDER_HOUR.
function atReminderHour(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!dateOnly) return null;
  const [, y, m, d] = dateOnly;
  return new Date(Number(y), Number(m) - 1, Number(d), REMINDER_HOUR, 0, 0);
}

function shiftDays(base: Date, days: number): Date {
  const shifted = new Date(base);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
}

// Pure schedule builder — exported for direct testing. Returns only
// reminders strictly in the future relative to `now`.
export function buildReminderSchedule(
  anchors: ReminderAnchors,
  now: Date,
): Reminder[] {
  // Members' stated travel dates win; ceremony timestamps (as Kauaʻi
  // calendar days) fill in when travel dates are unset. The home
  // anchor has no ceremony-start fallback: counting "days home" from
  // a journey's first day would fire mid-stay, so with no end anchor
  // the check-ins simply wait for a later sync to schedule them.
  const arrivalAnchor =
    anchors.arrivalDate ??
    (anchors.ceremonyStart ? retreatDayOf(anchors.ceremonyStart) : null);
  const homeAnchor =
    anchors.departureDate ??
    (anchors.ceremonyEnd ? retreatDayOf(anchors.ceremonyEnd) : null);

  const reminders: Reminder[] = [];

  if (arrivalAnchor) {
    const arrival = atReminderHour(arrivalAnchor);
    if (arrival) {
      reminders.push(
        {
          id: REMINDER_ID_BASE + 1,
          title: "Your journey nears",
          body: "One week until you arrive on Kauaʻi. Your preparation is waiting in the portal.",
          at: shiftDays(arrival, -7),
        },
        {
          id: REMINDER_ID_BASE + 2,
          title: "See you tomorrow",
          body: "We welcome you tomorrow. Travel gently.",
          at: shiftDays(arrival, -1),
        },
      );
    }
  }

  if (homeAnchor) {
    const home = atReminderHour(homeAnchor);
    if (home) {
      reminders.push(
        {
          id: REMINDER_ID_BASE + 3,
          title: "A gentle check-in",
          body: "Three days home. Your practices are in the portal whenever you are ready.",
          at: shiftDays(home, 3),
        },
        {
          id: REMINDER_ID_BASE + 4,
          title: "One week home",
          body: "Your rhythm continues. A journal prompt is waiting for you.",
          at: shiftDays(home, 7),
        },
        {
          id: REMINDER_ID_BASE + 5,
          title: "Two weeks home",
          body: "Steady and easeful — your rhythm lives in the portal.",
          at: shiftDays(home, 14),
        },
        {
          id: REMINDER_ID_BASE + 6,
          title: "One month home",
          body: "A month at home. We would love to hear how you are.",
          at: shiftDays(home, 30),
        },
      );
    }
  }

  return reminders.filter((r) => r.at.getTime() > now.getTime());
}

// Fetches the anchors for the signed-in member. Returns null when any
// query fails (or there is no session) so the caller can abort without
// touching already-scheduled reminders — a flaky network must never
// read as "no journey" and wipe a valid schedule. supabase-js reports
// failures via the error field rather than throwing.
async function fetchAnchors(): Promise<
  { anchors: ReminderAnchors; scheduled: boolean } | null
> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { data: journey, error: journeyError } = await supabase
    .from("journeys")
    .select("status, schedule_type, start_at, end_at")
    .eq("member_id", userId)
    .not("status", "in", '("canceled","completed")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (journeyError) return null;

  if (!journey) {
    // A genuine "no active journey" — clear any leftovers.
    return {
      anchors: {
        arrivalDate: null,
        departureDate: null,
        ceremonyStart: null,
        ceremonyEnd: null,
      },
      scheduled: false,
    };
  }

  const { data: memberRow, error: memberError } = await supabase
    .from("members")
    .select("arrival_date, departure_date")
    .eq("id", userId)
    .maybeSingle();
  if (memberError) return null;

  const scheduled = Boolean(
    journey.start_at &&
      journey.schedule_type !== "tbd" &&
      (journey.status === "scheduled" || journey.status === "in_progress"),
  );

  return {
    anchors: {
      arrivalDate: memberRow?.arrival_date ?? null,
      departureDate: memberRow?.departure_date ?? null,
      ceremonyStart: journey.start_at,
      ceremonyEnd: journey.end_at,
    },
    scheduled,
  };
}

let syncInFlight: Promise<void> | null = null;

// Recomputes and reschedules this device's journey reminders from the
// member's current data. Called on portal load and app foreground
// inside the native shell. Idempotent: the module's ID range is
// cleared and rebuilt each run, so date changes and cancellations
// converge on the right set. Concurrent calls share one run. No-op
// outside native iOS.
export function syncJourneyReminders(): Promise<void> {
  if (!isNativeIOS()) return Promise.resolve();
  if (syncInFlight) return syncInFlight;
  syncInFlight = doSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

async function doSync(): Promise<void> {
  try {
    const fetched = await fetchAnchors();
    if (!fetched) return; // fetch failed — leave the schedule untouched

    const reminders = fetched.scheduled
      ? buildReminderSchedule(fetched.anchors, new Date())
      : [];

    const { LocalNotifications } = await import(
      "@capacitor/local-notifications"
    );

    // Reconcile first: clearing needs no notification permission, and
    // must happen even when permission was revoked so a canceled
    // journey's reminders never outlive it.
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter(
      (n) => n.id >= REMINDER_ID_BASE && n.id <= REMINDER_ID_MAX,
    );
    if (ours.length > 0) {
      await LocalNotifications.cancel({
        notifications: ours.map((n) => ({ id: n.id })),
      });
    }

    if (reminders.length === 0) return;

    // Ask for permission only when there is something concrete to
    // schedule — the system dialog is one-shot on iOS, so it should
    // appear for members with a journey ahead, never as a cold prompt.
    let permission = await LocalNotifications.checkPermissions();
    if (
      permission.display === "prompt" ||
      permission.display === "prompt-with-rationale"
    ) {
      permission = await LocalNotifications.requestPermissions();
    }
    if (permission.display !== "granted") return;

    await LocalNotifications.schedule({
      notifications: reminders.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        // Calendar trigger: date components evaluate in the device's
        // timezone at fire time, so the hour travels with the member.
        schedule: {
          on: {
            year: r.at.getFullYear(),
            month: r.at.getMonth() + 1,
            day: r.at.getDate(),
            hour: r.at.getHours(),
            minute: 0,
          },
        },
      })),
    });
  } catch {
    // Reminders are a convenience layer; the portal never surfaces
    // scheduling failures.
  }
}
