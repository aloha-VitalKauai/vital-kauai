import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { verifyFounder } from "@/lib/auth/founder-check";
import CheckinQuestionsPanel, {
  type ActiveTemplateRow,
} from "@/components/dashboard/CheckinQuestionsPanel";

export const metadata = { title: "Weekly Check-In Questions — Vital Kauaʻi" };
export const dynamic = "force-dynamic";

// Founder-only editor for the weeks 1-13 question sets. The page loads every
// week's ACTIVE template under the founder's own RLS; saving goes through
// publish_checkin_template(), which retires the old version and activates the
// new one in a single transaction. Historical check-ins keep their own
// questions_snapshot and are never touched from here.
export default async function CheckinQuestionsPage() {
  const founder = await verifyFounder();
  if (!founder) redirect("/login");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("checkin_templates")
    .select("id, week_number, version, questions, updated_at")
    .eq("active", true)
    .order("week_number", { ascending: true });

  // A failed read is unknown, never "no templates": the panel shows a retry
  // state instead of thirteen empty weeks.
  return (
    <CheckinQuestionsPanel
      templates={(data ?? []) as ActiveTemplateRow[]}
      loadFailed={Boolean(error)}
    />
  );
}
