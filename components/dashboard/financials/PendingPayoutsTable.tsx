"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/financials/formatMoney";
import type { PayoutCommitment } from "@/lib/financials/types";
import { PANEL, PANEL_HEAD, TH, TD, EMPTY } from "./styles";

export default function PendingPayoutsTable({
  payouts,
  cohortTitles,
  journeyLabels,
}: {
  payouts: PayoutCommitment[];
  cohortTitles: Record<string, string>;
  journeyLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function markPaid(id: string) {
    setPending(id);
    const res = await fetch(`/api/payouts/${id}/mark-paid`, { method: "POST" });
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "unknown" }));
      alert(`Failed: ${error}`);
      setPending(null);
      return;
    }
    router.refresh();
  }

  if (payouts.length === 0) {
    return (
      <div style={PANEL}>
        <div style={PANEL_HEAD}>Pending Payouts</div>
        <div style={EMPTY}>No pending payouts.</div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    pending: "#6B6B67",
    scheduled: "#633806",
    paid: "#085041",
    canceled: "#9E9E9A",
  };

  return (
    <div style={PANEL}>
      <div style={PANEL_HEAD}>Pending Payouts</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Payee", "Role", "Journey / Cohort", "Amount", "Due", "Status", ""].map(
              (h) => (
                <th key={h} style={TH}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id}>
              <td style={{ ...TD, fontWeight: 500 }}>{p.payee_name}</td>
              <td style={TD}>{p.role}</td>
              <td style={TD}>
                {p.cohort_id
                  ? cohortTitles[p.cohort_id] ?? "—"
                  : p.journey_id
                    ? journeyLabels[p.journey_id] ?? "—"
                    : "Overhead"}
              </td>
              <td style={TD}>{formatMoney(p.amount_cents)}</td>
              <td style={TD}>
                {p.due_date
                  ? new Date(p.due_date).toLocaleDateString()
                  : "—"}
              </td>
              <td
                style={{
                  ...TD,
                  color: statusColor[p.status] ?? "#6B6B67",
                  textTransform: "capitalize",
                }}
              >
                {p.status}
              </td>
              <td style={TD}>
                {(p.status === "pending" || p.status === "scheduled") && (
                  <button
                    disabled={pending === p.id}
                    onClick={() => markPaid(p.id)}
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      background: "#fff",
                      border: "0.5px solid rgba(0,0,0,0.2)",
                      borderRadius: 5,
                      padding: "4px 10px",
                      cursor: pending === p.id ? "wait" : "pointer",
                      color: "#085041",
                      opacity: pending === p.id ? 0.6 : 1,
                    }}
                  >
                    {pending === p.id ? "Marking…" : "Mark Paid"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
