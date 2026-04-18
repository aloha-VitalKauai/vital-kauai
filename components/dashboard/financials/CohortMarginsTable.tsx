"use client";
import { useState } from "react";
import { formatMoney, formatPercent } from "@/lib/financials/formatMoney";
import type { CohortMargin } from "@/lib/financials/types";
import { PANEL, PANEL_HEAD, TH, TD, EMPTY } from "./styles";

type SortKey = "start_at" | "margin_cents";

export default function CohortMarginsTable({ rows }: { rows: CohortMargin[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("start_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  if (rows.length === 0) {
    return (
      <div style={PANEL}>
        <div style={PANEL_HEAD}>Cohort Margins</div>
        <div style={EMPTY}>No cohorts yet.</div>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (sortKey === "start_at") {
      return dir === "asc"
        ? new Date(av as string).getTime() - new Date(bv as string).getTime()
        : new Date(bv as string).getTime() - new Date(av as string).getTime();
    }
    return dir === "asc"
      ? (av as number) - (bv as number)
      : (bv as number) - (av as number);
  });

  const toggle = (k: SortKey) => {
    if (sortKey === k) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  const sortableStyle: React.CSSProperties = {
    ...TH,
    cursor: "pointer",
    userSelect: "none",
  };

  return (
    <div style={PANEL}>
      <div style={PANEL_HEAD}>Cohort Margins</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={TH}>Cohort</th>
            <th style={sortableStyle} onClick={() => toggle("start_at")}>
              Start Date{" "}
              {sortKey === "start_at" && (dir === "asc" ? "↑" : "↓")}
            </th>
            <th style={TH}>Members</th>
            <th style={TH}>Revenue</th>
            <th style={TH}>Expenses</th>
            <th style={TH}>Payouts</th>
            <th style={sortableStyle} onClick={() => toggle("margin_cents")}>
              Margin{" "}
              {sortKey === "margin_cents" && (dir === "asc" ? "↑" : "↓")}
            </th>
            <th style={TH}>Margin %</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.cohort_id}>
              <td style={{ ...TD, fontWeight: 500 }}>{r.cohort_title}</td>
              <td style={TD}>
                {r.start_at ? new Date(r.start_at).toLocaleDateString() : "—"}
              </td>
              <td style={TD}>{r.enrolled_members ?? 0}</td>
              <td style={TD}>{formatMoney(r.revenue_cents)}</td>
              <td style={TD}>{formatMoney(r.expense_cents)}</td>
              <td style={TD}>{formatMoney(r.payout_cents)}</td>
              <td
                style={{
                  ...TD,
                  color: r.margin_cents < 0 ? "#8a1e1e" : "#085041",
                  fontWeight: 500,
                }}
              >
                {formatMoney(r.margin_cents)}
              </td>
              <td style={TD}>{formatPercent(r.margin_pct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
