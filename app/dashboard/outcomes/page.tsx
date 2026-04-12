import { createClient } from "@/lib/supabase/server";
import OutcomesClient from "./OutcomesClient";

export const metadata = { title: "Outcomes — Vital Kauaʻi" };

export default async function OutcomesPage() {
  const supabase = await createClient();

  const [
    { data: cohort },
    { data: trajectory },
    { data: doseOutcome },
    { data: followups },
    { data: members },
  ] = await Promise.all([
    supabase.from("cohort_summary").select("*"),
    supabase.from("participant_trajectory").select("*").order("member_id").order("timepoint"),
    supabase.from("dose_outcome_linkage").select("*").order("assessment_date", { ascending: false }),
    supabase
      .from("followup_tasks")
      .select("*")
      .in("status", ["pending", "sent"])
      .order("due_date", { ascending: true })
      .limit(20),
    supabase.from("members").select("email, full_name, assigned_partner, journey_focus"),
  ]);

  // Build member name lookup
  const memberIds = [...new Set((trajectory ?? []).map((r) => r.member_id))];
  const { data: profiles } = await supabase
    .from("member_profiles")
    .select("id, email, full_name")
    .in("id", memberIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
  const memberMap = Object.fromEntries((members ?? []).map((m) => [m.email, m]));

  // Summary stats
  const baseline = cohort?.find((r) => r.timepoint === "baseline");
  const oneMonth = cohort?.find((r) => r.timepoint === "1_month");
  const threeMonth = cohort?.find((r) => r.timepoint === "3_months");

  const summaryStats = {
    totalParticipants: baseline?.n ?? 0,
    phq9BaselineMean: baseline?.phq9_mean ?? null,
    phq9OneMonthMean: oneMonth?.phq9_mean ?? null,
    phq9Delta:
      baseline?.phq9_mean && oneMonth?.phq9_mean
        ? Number((oneMonth.phq9_mean - baseline.phq9_mean).toFixed(1))
        : null,
    gad7BaselineMean: baseline?.gad7_mean ?? null,
    gad7OneMonthMean: oneMonth?.gad7_mean ?? null,
    gad7Delta:
      baseline?.gad7_mean && oneMonth?.gad7_mean
        ? Number((oneMonth.gad7_mean - baseline.gad7_mean).toFixed(1))
        : null,
    relapseRate3m: threeMonth?.relapse_rate_pct ?? null,
    abstinentDays1m: oneMonth?.abstinent_days_mean ?? null,
  };

  const overdueCount = (followups ?? []).filter(
    (f) => new Date(f.due_date) < new Date() && f.status === "pending"
  ).length;

  return (
    <OutcomesClient
      cohort={cohort ?? []}
      trajectory={trajectory ?? []}
      doseOutcome={doseOutcome ?? []}
      followups={followups ?? []}
      profileMap={profileMap}
      memberMap={memberMap}
      summaryStats={summaryStats}
      overdueCount={overdueCount}
    />
  );
}
