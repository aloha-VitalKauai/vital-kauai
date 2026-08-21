/**
 * Financials V2 — PR 7 (D-084): the Founder Financial Command Center.
 *
 * V2-only. No legacy fallback, no financial read flag: D-077 wiped the retired
 * tables, D-078 froze them, D-082 fixed the clean start. Every canonical figure
 * comes from finance_api views computed in SQL; nothing is recomputed in React.
 * A failed V2 read renders an explicit unknown state — never a legacy value and
 * never $0, because a zero is a fact while a failed read is unknown.
 *
 * Expenses and payouts remain the existing operational records; their mutations
 * (FinancialActions, PendingPayoutsTable, RecentExpensesTable) are reused
 * unchanged. Member/journey rows deep-link to the PR 5 controls — this page
 * adds no mutation of agreements or the ledger.
 */

import { createClient } from "@/lib/supabase/server";
import FinancialActions from "@/components/dashboard/financials/FinancialActions";
import PendingPayoutsTable from "@/components/dashboard/financials/PendingPayoutsTable";
import RecentExpensesTable from "@/components/dashboard/financials/RecentExpensesTable";
import FounderFinancialCommandCenter from "./FounderFinancialCommandCenter";
import type { PayoutCommitment, ExpenseEntry } from "@/lib/financials/types";

export const metadata = { title: "Financials — Vital Kauaʻi" };
export const dynamic = "force-dynamic";

type Overview = {
  contribution_cents: number; gross_received_cents: number; refunded_cents: number;
  net_received_cents: number; remaining_cents: number; payable_remaining_cents: number;
  active_agreements: number; expenses_cents: number; payouts_cents: number;
  pending_payouts_cents: number; operating_margin_cents: number;
};
type MemberPos = {
  member_id: string; agreement_count: number; contribution_cents: number;
  net_received_cents: number; refunded_cents: number; remaining_cents: number;
  payable_remaining_cents: number;
};
type JourneyPos = Omit<MemberPos, "member_id"> & { journey_id: string };
type BalanceRow = {
  agreement_id: string; member_id: string; journey_id: string | null;
  purpose: string; payable_remaining_cents: number; payment_state: string;
};
type ActivityRow = {
  id: string; entry_type: string; amount_cents: number; source: string;
  external_method: string | null; occurred_at: string; livemode: boolean;
  purpose: string; member_id: string; member_name: string | null;
};
type RunRow = { id: string; livemode: boolean; dry_run: boolean; status: string; window_exhausted: boolean; finished_at: string | null };
type ExcRow = { id: string; livemode: boolean; resolution_status: string; quarantined_at: string | null; released_at: string | null };
type LinkRow = { id: string; agreement_id: string; status: string; expires_at: string };
type SessRow = { id: string; agreement_id: string; status: string; expires_at: string };

export default async function FinancialsPage() {
  const supabase = await createClient();
  const fin = supabase.schema("finance_api");

  const [
    overviewRes, membersRes, journeysRes, balancesRes, activityRes,
    runsRes, excRes, linksRes, sessRes,
    pendingPayoutsRes, recentExpensesRes, cohortsRes, journeyRowsRes, namesRes,
  ] = await Promise.all([
    fin.from("founder_financial_overview").select("*").returns<Overview[]>(),
    fin.from("member_financials").select("*").returns<MemberPos[]>(),
    fin.from("journey_financials").select("*").returns<JourneyPos[]>(),
    fin.from("agreement_balances")
      .select("agreement_id, member_id, journey_id, purpose, payable_remaining_cents, payment_state")
      .returns<BalanceRow[]>(),
    fin.from("founder_payment_activity").select("*")
      .order("occurred_at", { ascending: false }).limit(50).returns<ActivityRow[]>(),
    fin.from("reconciliation_runs")
      .select("id, livemode, dry_run, status, window_exhausted, finished_at")
      .order("started_at", { ascending: false }).limit(10).returns<RunRow[]>(),
    fin.from("reconciliation_exceptions")
      .select("id, livemode, resolution_status, quarantined_at, released_at")
      .eq("resolution_status", "open").returns<ExcRow[]>(),
    fin.from("payment_links").select("id, agreement_id, status, expires_at")
      .in("status", ["active", "creating"]).returns<LinkRow[]>(),
    fin.from("checkout_sessions").select("id, agreement_id, status, expires_at")
      .in("status", ["creating", "open"]).returns<SessRow[]>(),
    supabase.from("payout_commitments").select("*").neq("status", "canceled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }).limit(50),
    supabase.from("expense_entries").select("*")
      .order("incurred_at", { ascending: false }).limit(25),
    supabase.from("cohorts").select("id, title").order("start_at", { ascending: false }),
    supabase.from("journeys").select("id, start_at, member_id")
      .order("created_at", { ascending: false }),
    supabase.from("members").select("id, full_name, email"),
  ]);

  // Section-level failure: a failed V2 read is UNKNOWN, never zero.
  const overview = overviewRes.error ? null : (overviewRes.data?.[0] ?? null);
  const failed: string[] = [];
  if (overviewRes.error) failed.push("overview");
  if (membersRes.error) failed.push("members");
  if (journeysRes.error) failed.push("journeys");
  if (activityRes.error) failed.push("activity");
  if (runsRes.error || excRes.error) failed.push("reconciliation");

  const nameById = new Map<string, { name: string; email: string | null }>();
  for (const m of (namesRes.data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
    nameById.set(m.id, { name: m.full_name ?? m.email ?? m.id.slice(0, 8), email: m.email });
  }
  const journeyMeta = new Map<string, { start_at: string | null; member_id: string | null }>();
  for (const j of (journeyRowsRes.data ?? []) as { id: string; start_at: string | null; member_id: string | null }[]) {
    journeyMeta.set(j.id, { start_at: j.start_at, member_id: j.member_id });
  }

  // Reconciliation health: live mode only for launch status.
  const liveRuns = (runsRes.data ?? []).filter((r) => r.livemode);
  const lastGood = liveRuns.find((r) => r.status === "completed" && r.window_exhausted);
  const openLive = (excRes.data ?? []).filter((e) => e.livemode);
  const quarantined = openLive.filter((e) => e.quarantined_at && !e.released_at);
  const checkoutReady = process.env.FINANCE_V2_CHECKOUT_READY === "true";

  const cohortList = (cohortsRes.data ?? []) as { id: string; title: string }[];
  const cohortTitles = Object.fromEntries(cohortList.map((c) => [c.id, c.title]));
  const journeyLabels = Object.fromEntries(
    [...journeyMeta.entries()].map(([id, j]) => {
      const nm = j.member_id ? (nameById.get(j.member_id)?.name ?? "Member") : "Member";
      return [id, `${nm}${j.start_at ? ` — ${new Date(j.start_at).toLocaleDateString()}` : ""}`];
    }),
  );
  const journeyOptions = [...journeyMeta.keys()].map((id) => ({ id, label: journeyLabels[id] }));

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem", flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "#8b8a82", marginBottom: 6 }}>
            Organization financials
          </p>
          <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 34, fontWeight: 400, color: "#0D2A1D", margin: 0 }}>
            Financials
          </h1>
          <p style={{ fontSize: 14, color: "#74786F", margin: "8px 0 0" }}>
            A clear view of contributions, payments, and what needs attention.
          </p>
        </div>
        <FinancialActions cohorts={cohortList} journeys={journeyOptions} />
      </div>

      <FounderFinancialCommandCenter
        overview={overview}
        failedSections={failed}
        members={(membersRes.data ?? []).map((m) => ({
          ...m,
          name: nameById.get(m.member_id)?.name ?? m.member_id.slice(0, 8),
          email: nameById.get(m.member_id)?.email ?? null,
        }))}
        journeys={(journeysRes.data ?? []).map((j) => ({
          ...j,
          label: journeyLabels[j.journey_id] ?? j.journey_id.slice(0, 8),
          startAt: journeyMeta.get(j.journey_id)?.start_at ?? null,
        }))}
        balances={balancesRes.data ?? []}
        activity={(activityRes.data ?? []).map((a) => ({
          ...a,
          member_name: a.member_name ?? nameById.get(a.member_id)?.name ?? "Member",
        }))}
        health={{
          reconciledAt: lastGood?.finished_at ?? null,
          openLiveExceptions: openLive.length,
          quarantined: quarantined.length,
          checkoutReady,
          checkoutNeedsReview:
            (sessRes.data ?? []).filter((s) => s.status === "creating" || new Date(s.expires_at) < new Date()).length +
            (linksRes.data ?? []).filter((l) => l.status === "creating").length,
        }}
      />

      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontFamily: "var(--font-display, serif)", fontWeight: 400, fontSize: 24, color: "#0D2A1D", margin: "0 0 4px" }}>Operations</h2>
        <p style={{ fontSize: 13, color: "#74786F", margin: "0 0 12px" }}>
          Operational expense and payout records — separate from canonical member positions.
        </p>
        <PendingPayoutsTable
          payouts={(pendingPayoutsRes.data ?? []) as PayoutCommitment[]}
          cohortTitles={cohortTitles}
          journeyLabels={journeyLabels}
        />
        <RecentExpensesTable
          expenses={(recentExpensesRes.data ?? []) as ExpenseEntry[]}
          cohortTitles={cohortTitles}
          journeyLabels={journeyLabels}
        />
      </div>
    </div>
  );
}
