import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Financials — Vital Kauaʻi" };

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function Check({ ok }: { ok: boolean | null | undefined }) {
  return ok ? (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#E1F5EE", color: "#085041", fontSize: 10, fontWeight: 700 }}>✓</span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#F1EFE8", color: "#9E9E9A", fontSize: 10 }}>—</span>
  );
}

export default async function FinancialsPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase.from("members").select("id, full_name, assigned_partner, membership_tier, program_price, cost_of_service").order("created_at", { ascending: false }),
    supabase.from("member_profiles").select("id, deposit_paid, deposit_amount"),
  ]);

  const profileMap: Record<string, any> = {};
  for (const p of profiles ?? []) profileMap[p.id] = p;

  const rows = (members ?? []).map((m) => {
    const price = m.program_price != null ? Number(m.program_price) : null;
    const cost = m.cost_of_service != null ? Number(m.cost_of_service) : null;
    const profit = price != null && cost != null ? price - cost : null;
    const margin = price != null && price > 0 && profit != null ? Math.round((profit / price) * 100) : null;
    const p = profileMap[m.id];
    const deposit = p?.deposit_amount != null ? Number(p.deposit_amount) : null;
    const balance = price != null ? price - (deposit ?? 0) : null;
    return { ...m, price, cost, profit, margin, depositPaid: p?.deposit_paid, deposit, balance };
  });

  const totalRevenue = rows.reduce((s, r) => s + (r.price ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalDeposits = rows.reduce((s, r) => s + (r.deposit ?? 0), 0);
  const totalBalance = rows.reduce((s, r) => s + (r.balance ?? 0), 0);
  const overallMargin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
  const profitRows = rows.filter((r) => r.profit != null);
  const avgProfit = profitRows.length ? Math.round(totalProfit / profitRows.length) : null;

  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 6, fontWeight: 500 };
  const TH: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Revenue & costs</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.5rem" }}>Financials</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total revenue", value: fmt(totalRevenue, "$") },
          { label: "Total costs", value: fmt(totalCost, "$") },
          { label: "Gross profit", value: fmt(totalProfit, "$"), color: "#085041" },
          { label: "Profit margin", value: `${overallMargin}%`, color: "#085041" },
          { label: "Avg profit / member", value: fmt(avgProfit, "$") },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: c.color ?? "#1A1A18", margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>Revenue breakdown by member</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} members</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Partner", "Tier", "Program price", "Cost of service", "Gross profit", "Margin", "Deposit paid", "Deposit amt", "Balance remaining"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={10} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No members yet</td></tr>
              ) : (
                <>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                      <td style={TD}><div style={{ fontWeight: 500, fontSize: 13 }}>{r.full_name}</div></td>
                      <td style={{ ...TD, color: r.assigned_partner ? "#1A1A18" : "#9E9E9A" }}>{r.assigned_partner ?? "—"}</td>
                      <td style={{ ...TD, color: r.membership_tier ? "#1A1A18" : "#9E9E9A" }}>{r.membership_tier ?? "—"}</td>
                      <td style={TD}>{fmt(r.price, "$")}</td>
                      <td style={TD}>{fmt(r.cost, "$")}</td>
                      <td style={{ ...TD, color: "#085041", fontWeight: 500 }}>{fmt(r.profit, "$")}</td>
                      <td style={{ ...TD, color: "#085041", fontWeight: 500 }}>{r.margin != null ? `${r.margin}%` : "—"}</td>
                      <td style={TD}><Check ok={r.depositPaid} /></td>
                      <td style={{ ...TD, color: r.deposit ? "#1A1A18" : "#9E9E9A" }}>{fmt(r.deposit, "$")}</td>
                      <td style={{ ...TD, color: "#633806" }}>{fmt(r.balance, "$")}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr style={{ background: "#FAFAF8" }}>
                    <td colSpan={3} style={{ ...TD, fontWeight: 500, fontSize: 12, padding: "10px 12px" }}>Totals</td>
                    <td style={{ ...TD, fontWeight: 500 }}>{fmt(totalRevenue, "$")}</td>
                    <td style={{ ...TD, fontWeight: 500 }}>{fmt(totalCost, "$")}</td>
                    <td style={{ ...TD, color: "#085041", fontWeight: 500, fontSize: 13 }}>{fmt(totalProfit, "$")}</td>
                    <td style={{ ...TD, color: "#085041", fontWeight: 500 }}>{overallMargin}%</td>
                    <td style={TD}></td>
                    <td style={{ ...TD, fontWeight: 500 }}>{fmt(totalDeposits, "$")}</td>
                    <td style={{ ...TD, color: "#633806", fontWeight: 500 }}>{fmt(totalBalance, "$")}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
