import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentArcWeek } from "@/lib/weekCountdown";

/**
 * Journey wayfinder. The mobile dock's "Journey" tab lands here; we look
 * up the member's ceremony date and drop them on the week they are in
 * right now — using the same week calendar the weekly journey emails
 * follow (six preparation weeks before ceremony, six integration weeks
 * after). Pre-ceremony weeks count down from 42 days before ceremony; on
 * ceremony day the arc hands off to post-ceremony integration.
 *
 * A ?week token is appended so a repeat tap re-snaps the integration page
 * to the current week even when the member has browsed to another week
 * (the App Router keeps the page mounted across a query-only change, so a
 * fresh token is what re-triggers the page's re-apply effect).
 *
 * When no journey has a ceremony date inside the twelve-week arc — a
 * member not yet scheduled, booked far out, or long past integration — we
 * hand off to the integration page without a forced week so its
 * resume-where-you-left-off logic picks the right week. Only canceled
 * journeys are ignored; the newest live arc wins for returning members.
 */
export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal");

  const { data: journeys } = await supabase
    .from("journeys")
    .select("start_at, created_at")
    .eq("member_id", user.id)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(5);

  const rows = journeys ?? [];

  // Prefer the newest journey whose twelve-week arc contains today.
  for (const j of rows) {
    const current = getCurrentArcWeek(j.start_at);
    if (current) {
      const page =
        current.arc === "post" ? "post-ceremony" : "pre-ceremony";
      redirect(
        `/portal/integration/${page}?week=${current.weekIndex + 1}&t=${Date.now()}`,
      );
    }
  }

  // No live arc: resume-where-you-left-off. A ceremony already in the past
  // means integration; otherwise preparation.
  const latest = rows[0];
  const ceremonyPast =
    !!latest?.start_at && new Date(latest.start_at).getTime() < Date.now();
  redirect(
    `/portal/integration/${ceremonyPast ? "post-ceremony" : "pre-ceremony"}`,
  );
}
