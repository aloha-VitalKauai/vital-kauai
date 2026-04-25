import { createClient } from "@/lib/supabase/server";
import FinancialKpiRow from "@/components/dashboard/financials/FinancialKpiRow";
import FinancialActions from "@/components/dashboard/financials/FinancialActions";
import CohortMarginsTable from "@/components/dashboard/financials/CohortMarginsTable";
import PendingPayoutsTable from "@/components/dashboard/financials/PendingPayoutsTable";
import RecentExpensesTable from "@/components/dashboard/financials/RecentExpensesTable";
import type {
  CohortMargin,
  FinancialsOverview,
  PayoutCommitment,
  ExpenseEntry,
} from "@/lib/financials/types";

export const metadata = { title: "Financials — Vital Kauaʻi" };
export const dynamic = "force-dynamic";

type JourneyRow = {
  id: string;
  start_at: string | null;
  member_id: string | null;
  member: { full_name: string | null } | { full_name: string | null }[] | null;
};

type CohortRow = { id: string; title: string };

export default async function FinancialsPage() {
  const supabase = await createClient();

  const [
    { data: overview },
    { data: cohortMargins },
    { data: pendingPayouts },
    { data: recentExpenses },
    { data: cohorts },
    { data: journeys },
  ] = await Promise.all([
    supabase.from("financials_overview").select("*").single(),
    supabase
      .from("cohort_margin_summary")
      .select("*")
      .order("start_at", { ascending: false }),
    supabase
      .from("payout_commitments")
      .select("*")
      .neq("status", "canceled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("expense_entries")
      .select("*")
      .order("incurred_at", { ascending: false })
      .limit(25),
    supabase
      .from("cohorts")
      .select("id, title")
      .order("start_at", { ascending: false }),
    supabase
      .from("journeys")
      .select("id, start_at, member_id, member:member_profiles(full_name)")
      .order("created_at", { ascending: false }),
  ]);

  const ov: FinancialsOverview = (overview as FinancialsOverview | null) ?? {
    total_revenue_cents: 0,
    onboarding_revenue_cents: 0,
    journey_revenue_cents: 0,
    total_expenses_cents: 0,
    total_payouts_cents: 0,
    payouts_pending_cents: 0,
    payouts_scheduled_cents: 0,
    payouts_paid_cents: 0,
    booked_revenue_cents: 0,
    enrolled_members: 0,
  };

  const activePayoutsCents =
    ov.payouts_pending_cents +
    ov.payouts_scheduled_cents +
    ov.payouts_paid_cents;
  const marginCents =
    ov.total_revenue_cents - ov.total_expenses_cents - activePayoutsCents;

  // Booked + enrolled members come straight from the view so this page
  // matches Overview and Ops without any client-side math.
  const bookedCents = ov.booked_revenue_cents;
  const enrolledMembers = ov.enrolled_members;

  const cohortList: CohortRow[] = (cohorts ?? []) as CohortRow[];
  const cohortTitles = Object.fromEntries(cohortList.map((c) => [c.id, c.title]));

  const journeyList: JourneyRow[] = (journeys ?? []) as JourneyRow[];
  const journeyLabels = Object.fromEntries(
    journeyList.map((j) => {
      const m = Array.isArray(j.member) ? j.member[0] : j.member;
      const name = m?.full_name ?? "Member";
      const date = j.start_at
        ? ` — ${new Date(j.start_at).toLocaleDateString()}`
        : "";
      return [j.id, `${name}${date}`];
    }),
  );
  const journeyOptions = journeyList.map((j) => ({
    id: j.id,
    label: journeyLabels[j.id],
  }));

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              color: "#9E9E9A",
              marginBottom: 3,
            }}
          >
            Revenue, expenses & margins
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: 26,
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: "#1A1A18",
              margin: 0,
            }}
          >
            Financials
          </h1>
        </div>
        <FinancialActions cohorts={cohortList} journeys={journeyOptions} />
      </div>

      <FinancialKpiRow
        overview={ov}
        marginCents={marginCents}
        bookedCents={bookedCents}
        enrolledMembers={enrolledMembers}
      />

      <CohortMarginsTable rows={(cohortMargins ?? []) as CohortMargin[]} />

      <PendingPayoutsTable
        payouts={(pendingPayouts ?? []) as PayoutCommitment[]}
        cohortTitles={cohortTitles}
        journeyLabels={journeyLabels}
      />

      <RecentExpensesTable
        expenses={(recentExpenses ?? []) as ExpenseEntry[]}
        cohortTitles={cohortTitles}
        journeyLabels={journeyLabels}
      />
    </div>
  );
}
