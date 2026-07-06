"use client";

// Keeps this device's journey reminders in sync while inside the
// Capacitor iOS shell. Renders nothing; on portal load — and again
// whenever the app returns to the foreground — it recomputes the
// local-notification schedule from the member's current journey
// (see lib/native-notifications.ts). Foreground resyncs matter for
// members who travel: they pick up rescheduled dates and re-pin
// reminder hours to the timezone the member is actually in. Web and
// PWA mount this as an inert null — syncJourneyReminders()
// short-circuits off native iOS.

import { useEffect } from "react";
import { syncJourneyReminders } from "@/lib/native-notifications";

export function NativeReminderScheduler() {
  useEffect(() => {
    void syncJourneyReminders();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void syncJourneyReminders();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  return null;
}
