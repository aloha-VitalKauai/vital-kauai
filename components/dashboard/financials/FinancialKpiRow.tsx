import { formatMoney } from "@/lib/financials/formatMoney";
import type { FinancialsOverview } from "@/lib/financials/types";

export default function FinancialKpiRow({
  overview,
  marginCents,
  bookedCents,
  enrolledMembers,
}: {
  overview: FinancialsOverview;
  marginCents: number;
  bookedCents: number;
  enrolledMembers: number;
}) {
  const pendingScheduled =
    overview.payouts_pending_cents + overview.payouts_scheduled_cents;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 10,
        marginBottom: "1.75rem",
      }}
    >
      <Kpi
        label="Booked Revenue"
        value={formatMoney(bookedCents)}
        sub={`${enrolledMembers} member${enrolledMembers === 1 ? "" : "s"} enrolled`}
      />
      <Kpi
        label="Collected Revenue"
        value={formatMoney(overview.total_revenue_cents)}
        sub="Cash received to date"
      />
      <Kpi
        label="Total Expenses"
        value={formatMoney(overview.total_expenses_cents)}
        sub="Logged costs"
      />
      <Kpi
        label="Total Payouts"
        value={formatMoney(overview.total_payouts_cents)}
        sub={`${formatMoney(pendingScheduled)} pending · ${formatMoney(
          overview.payouts_paid_cents,
        )} paid`}
      />
      <Kpi
        label="Gross Margin"
        value={formatMoney(marginCents)}
        sub="Collected minus costs"
        negative={marginCents < 0}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  negative,
}: {
  label: string;
  value: string;
  sub: string;
  negative?: boolean;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
        padding: "1rem 1.1rem",
      }}
    >
      <p
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "#6B6B67",
          marginBottom: 6,
          fontWeight: 500,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: negative ? "#8a1e1e" : "#1A1A18",
          margin: "0 0 4px",
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: "#9E9E9A", margin: 0 }}>{sub}</p>
    </div>
  );
}
