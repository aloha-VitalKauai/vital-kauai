import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentArcWeek } from "@/lib/weekCountdown";

/**
 * Journey wayfinder. The mobile dock's "Journey" tab lands here; we look
 * up the member's ceremony date and drop them on the calendar week they
 * are in right now — the same week the weekly journey emails follow.
 * Pre-ceremony weeks count down from 42 days before ceremony; on ceremony
 * day the arc hands off to post-ceremony integration.
 *
 * Members with an unscheduled ceremony (start_at null, schedule_type tbd)
 * go to the preparation page, which resumes at their first uncompleted
 * week. Completed journeys still count — post-ceremony integration runs
 * for six weeks after ceremony day; only canceled journeys are ignored.
 */
export default async function JourneyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/portal");

  const { data: journey } = await supabase
    .from("journeys")
    .select("start_at")
    .eq("member_id", user.id)
    .neq("status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const current = getCurrentArcWeek(journey?.start_at);
  if (!current) redirect("/portal/integration/pre-ceremony");

  const page = current.arc === "post" ? "post-ceremony" : "pre-ceremony";
  redirect(`/portal/integration/${page}?week=${current.weekIndex + 1}`);
}
