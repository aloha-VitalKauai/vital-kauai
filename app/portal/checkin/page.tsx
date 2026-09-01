import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CheckinClient from "./CheckinClient";
import { parseQuestionsSnapshot } from "@/lib/checkins/questions";

export const metadata = { title: "Weekly Check-In—Vital Kauaʻi" };

// The member's open check-in, loaded under their own RLS (member-read-own on
// member_checkins). "Open" means: theirs, available now (scheduled_at has
// passed), and awaiting answers — earliest week first, so a member who fell
// a week behind completes weeks in order. Build 3's SMS link lands here.
export default async function CheckinPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/portal/checkin");

  const { data: rows, error } = await supabase
    .from("member_checkins")
    .select("id, week_number, status, scheduled_at, questions_snapshot")
    .eq("member_id", user.id)
    .in("status", ["scheduled", "sent"])
    .lte("scheduled_at", new Date().toISOString())
    .order("week_number", { ascending: true })
    .limit(1);

  // A failed read is unknown, never "all caught up" — show a retry state
  // instead of quietly telling the member nothing is due.
  if (error) return <CheckinClient state="error" />;

  const row = rows?.[0];
  if (!row) return <CheckinClient state="none" />;

  const questions = parseQuestionsSnapshot(row.questions_snapshot);
  if (questions.length === 0) return <CheckinClient state="error" />;

  return (
    <CheckinClient
      state="open"
      checkin={{ id: row.id, weekNumber: row.week_number, questions }}
    />
  );
}
