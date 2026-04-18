import { formatMoney } from "@/lib/financials/formatMoney";
import type { ExpenseEntry } from "@/lib/financials/types";
import { PANEL, PANEL_HEAD, TH, TD, EMPTY } from "./styles";

export default function RecentExpensesTable({
  expenses,
  cohortTitles,
  journeyLabels,
}: {
  expenses: ExpenseEntry[];
  cohortTitles: Record<string, string>;
  journeyLabels: Record<string, string>;
}) {
  if (expenses.length === 0) {
    return (
      <div style={PANEL}>
        <div style={PANEL_HEAD}>Recent Expenses</div>
        <div style={EMPTY}>No expenses logged yet.</div>
      </div>
    );
  }

  return (
    <div style={PANEL}>
      <div style={PANEL_HEAD}>Recent Expenses</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["Date", "Category", "Journey / Cohort", "Vendor", "Amount", "Notes"].map(
              (h) => (
                <th key={h} style={TH}>
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td style={TD}>
                {new Date(e.incurred_at).toLocaleDateString()}
              </td>
              <td style={{ ...TD, textTransform: "capitalize" }}>
                {e.category.replace(/_/g, " ")}
              </td>
              <td style={TD}>
                {e.cohort_id
                  ? cohortTitles[e.cohort_id] ?? "—"
                  : e.journey_id
                    ? journeyLabels[e.journey_id] ?? "—"
                    : "Overhead"}
              </td>
              <td style={TD}>{e.vendor ?? "—"}</td>
              <td style={{ ...TD, fontWeight: 500 }}>
                {formatMoney(e.amount_cents)}
              </td>
              <td style={{ ...TD, color: "#6B6B67" }}>{e.notes ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
