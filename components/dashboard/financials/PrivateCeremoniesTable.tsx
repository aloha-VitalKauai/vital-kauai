"use client";
import { useState } from "react";
import { formatMoney } from "@/lib/financials/formatMoney";
import type { PrivateCeremonyMargin } from "@/lib/financials/types";
import { TH, TD, EMPTY } from "./styles";

type SortKey = "start_at" | "booked_cents" | "revenue_cents";

export default function PrivateCeremoniesTable({
  rows,
}: {
  rows: PrivateCeremonyMargin[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("start_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  if (rows.length === 0) {
    return <div style={EMPTY}>No private ceremonies yet.</div>;
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? 0;
    const bv = b[sortKey] ?? 0;
    if (sortKey === "start_at") {
      const at = av ? new Date(av as string).getTime() : 0;
      const bt = bv ? new Date(bv as string).getTime() : 0;
      return dir === "asc" ? at - bt : bt - at;
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
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={TH}>Member</th>
          <th style={sortableStyle} onClick={() => toggle("start_at")}>
            Date {sortKey === "start_at" && (dir === "asc" ? "↑" : "↓")}
          </th>
          <th style={TH}>Status</th>
          <th style={sortableStyle} onClick={() => toggle("booked_cents")}>
            Booked{" "}
            {sortKey === "booked_cents" && (dir === "asc" ? "↑" : "↓")}
          </th>
          <th style={sortableStyle} onClick={() => toggle("revenue_cents")}>
            Collected{" "}
            {sortKey === "revenue_cents" && (dir === "asc" ? "↑" : "↓")}
          </th>
          <th style={TH}>Outstanding</th>
          <th style={TH}>Expenses</th>
          <th style={TH}>Payouts</th>
          <th style={TH}>Margin</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => {
          const outstanding = Math.max(
            0,
            (r.booked_cents ?? 0) - (r.revenue_cents ?? 0),
          );
          const margin =
            (r.revenue_cents ?? 0) -
            (r.expense_cents ?? 0) -
            (r.payout_cents ?? 0);
          return (
            <tr key={r.journey_id}>
              <td style={{ ...TD, fontWeight: 500 }}>{r.member_name}</td>
              <td style={TD}>
                {r.start_at
                  ? new Date(r.start_at).toLocaleDateString()
                  : "TBD"}
              </td>
              <td style={{ ...TD, textTransform: "capitalize" }}>
                {r.journey_status.replace(/_/g, " ")}
              </td>
              <td style={TD}>{formatMoney(r.booked_cents)}</td>
              <td style={TD}>{formatMoney(r.revenue_cents)}</td>
              <td
                style={{
                  ...TD,
                  color: outstanding > 0 ? "#633806" : "#9E9E9A",
                }}
              >
                {formatMoney(outstanding)}
              </td>
              <td style={TD}>{formatMoney(r.expense_cents)}</td>
              <td style={TD}>{formatMoney(r.payout_cents)}</td>
              <td
                style={{
                  ...TD,
                  color: margin < 0 ? "#8a1e1e" : "#085041",
                  fontWeight: 500,
                }}
              >
                {formatMoney(margin)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
