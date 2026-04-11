import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Overview — Vital Kauaʻi" };

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Signed — Awaiting Intake": { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  "Intake Complete": { bg: "#EAF3DE", text: "#27500A", dot: "#639922" },
  "Ceremony Scheduled": { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  "Ceremony Complete": { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  "Integration Phase": { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  Alumni: { bg: "#F1EFE8", text: "#444441", dot: "#888780" },
};
const fallback = { bg: "#F1EFE8", text: "#444441", dot: "#888780" };

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ data: members }, { data: profiles }] = await Promise.all([
    supabase
      .from("members")
      .select(
        "id, full_name, email, status, assigned_partner, membership_tier, program_price, cost_of_service",
      )
      .order("created_at", { ascending: false }),
    supabase.from("member_profiles").select("id, deposit_amount"),
  ]);

  const depositMap: Record<string, number> = {};
  for (const p of profiles ?? []) {
    if (p.id && p.deposit_amount != null) depositMap[p.id] = Number(p.deposit_amount);
  }

  const rows = (members ?? []).map((m) => {
    const price = m.program_price != null ? Number(m.program_price) : null;
    const cost = m.cost_of_service != null ? Number(m.cost_of_service) : null;
    const profit = price != null && cost != null ? price - cost : null;
    return { ...m, price, cost, profit, deposit: depositMap[m.id] ?? null };
  });

  const hasPricing = rows.some((r) => r.price != null);
  const totalRevenue = rows.reduce((s, r) => s + (r.price ?? 0), 0);
  const totalProfit = rows.reduce((s, r) => s + (r.profit ?? 0), 0);
  const totalDeposits = rows.reduce((s, r) => s + (r.deposit ?? 0), 0);
  const profitRows = rows.filter((r) => r.profit != null);
  const avgProfit = profitRows.length ? totalProfit / profitRows.length : null;

  const stageCounts: Record<string, number> = {};
  for (const r of rows) {
    const s = r.status ?? "Unknown";
    stageCounts[s] = (stageCounts[s] ?? 0) + 1;
  }

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <div style={{ marginBottom: "2rem" }}>
        <p
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            color: "#9E9E9A",
            marginBottom: 4,
          }}
        >
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: 32,
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: "#1A1A18",
          }}
        >
          Overview
        </h1>
      </div>

      {!hasPricing && (
        <div
          style={{
            background: "#FAEEDA",
            border: "0.5px solid #FAC775",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: "1.5rem",
            fontSize: 13,
            color: "#633806",
            display: "flex",
            gap: 8,
          }}
        >
          <span>&#9888;</span>
          <span>
            Revenue and profit will appear once <code>program_price</code> and{" "}
            <code>cost_of_service</code> are added to client records.
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Total clients", value: String(rows.length) },
          { label: "Total revenue", value: hasPricing ? fmt(totalRevenue, "$") : "—" },
          { label: "Total profit", value: profitRows.length ? fmt(totalProfit, "$") : "—" },
          {
            label: "Avg profit / client",
            value: avgProfit != null ? fmt(Math.round(avgProfit), "$") : "—",
          },
          {
            label: "Deposits collected",
            value: totalDeposits > 0 ? fmt(totalDeposits, "$") : "—",
          },
        ].map((c) => (
          <div
            key={c.label}
            style={{
              background: "#fff",
              border: "0.5px solid rgba(0,0,0,0.1)",
              borderRadius: 10,
              padding: "1rem 1.25rem",
            }}
          >
            <p
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#6B6B67",
                marginBottom: 6,
              }}
            >
              {c.label}
            </p>
            <p
              style={{
                fontSize: 26,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: "#1A1A18",
              }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Stage Breakdown */}
      {Object.keys(stageCounts).length > 0 && (
        <div
          style={{
            background: "#fff",
            border: "0.5px solid rgba(0,0,0,0.1)",
            borderRadius: 10,
            padding: "1rem 1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#6B6B67",
              marginBottom: 12,
            }}
          >
            Stage breakdown
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(stageCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([stage, count]) => {
                const c = STATUS_COLORS[stage] ?? fallback;
                return (
                  <div
                    key={stage}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: c.bg,
                      borderRadius: 99,
                      padding: "5px 12px",
                    }}
                  >
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: c.dot,
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 12, color: c.text }}>{stage}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: c.text, marginLeft: 2 }}>
                      {count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Clients Table */}
      <div
        style={{
          background: "#fff",
          border: "0.5px solid rgba(0,0,0,0.1)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "0.5px solid rgba(0,0,0,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "#6B6B67",
              margin: 0,
            }}
          >
            Clients
          </p>
          <span style={{ fontSize: 12, color: "#9E9E9A" }}>{rows.length} total</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#FAFAF8" }}>
                {["Name", "Partner", "Stage", "Tier", "Price", "Cost", "Profit"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "9px 14px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 500,
                      color: "#6B6B67",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      borderBottom: "0.5px solid rgba(0,0,0,0.1)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "2.5rem",
                      textAlign: "center",
                      color: "#9E9E9A",
                      fontSize: 14,
                    }}
                  >
                    No clients yet
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const c = STATUS_COLORS[r.status ?? ""] ?? fallback;
                  return (
                    <tr
                      key={r.id}
                      style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}
                    >
                      <td style={{ padding: "11px 14px" }}>
                        <a
                          href={`/dashboard/${r.id}`}
                          style={{ textDecoration: "none", color: "inherit", display: "block" }}
                        >
                          <p style={{ fontWeight: 500, fontSize: 14, margin: 0, color: "#1A1A18" }}>
                            {r.full_name}
                          </p>
                          <p style={{ fontSize: 12, color: "#9E9E9A", margin: "2px 0 0" }}>
                            {r.email}
                          </p>
                        </a>
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontSize: 13,
                          color: r.assigned_partner ? "#1A1A18" : "#9E9E9A",
                        }}
                      >
                        {r.assigned_partner ?? "—"}
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            background: c.bg,
                            color: c.text,
                            fontSize: 12,
                            fontWeight: 500,
                            padding: "3px 10px",
                            borderRadius: 99,
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: c.dot,
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          {r.status ?? "Unknown"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontSize: 13,
                          color: r.membership_tier ? "#1A1A18" : "#9E9E9A",
                        }}
                      >
                        {r.membership_tier ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontSize: 13,
                          color: r.price != null ? "#1A1A18" : "#9E9E9A",
                        }}
                      >
                        {fmt(r.price, "$")}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontSize: 13,
                          color: r.cost != null ? "#1A1A18" : "#9E9E9A",
                        }}
                      >
                        {fmt(r.cost, "$")}
                      </td>
                      <td
                        style={{
                          padding: "11px 14px",
                          fontSize: 13,
                          fontWeight: r.profit != null ? 500 : 400,
                          color:
                            r.profit == null
                              ? "#9E9E9A"
                              : r.profit >= 0
                                ? "#085041"
                                : "#A32D2D",
                        }}
                      >
                        {fmt(r.profit, "$")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
