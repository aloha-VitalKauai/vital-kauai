import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Ceremonies — Vital Kauaʻi" };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function CeremoniesPage() {
  const supabase = await createClient();

  const [{ data: ceremonies }, { data: members }] = await Promise.all([
    supabase.from("ceremony_records").select("*").order("ceremony_date", { ascending: false }),
    supabase.from("members").select("id, full_name"),
  ]);

  const memberMap: Record<string, string> = {};
  for (const m of members ?? []) memberMap[m.id] = m.full_name;

  const rows = ceremonies ?? [];
  const completed = rows.filter((c) => c.status === "Complete").length;
  const upcoming = rows.filter((c) => c.status !== "Complete").length;
  const totalCalls = rows.reduce((s, c) => s + (c.integration_calls ?? 0), 0);
  const completedWithCalls = rows.filter((c) => c.status === "Complete" && c.integration_calls != null);
  const avgCalls = completedWithCalls.length > 0 ? (totalCalls / completedWithCalls.length).toFixed(1) : "—";

  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 6, fontWeight: 500 };
  const TH: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Ceremony records</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.5rem" }}>Ceremonies</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total ceremonies", value: String(rows.length) },
          { label: "Completed", value: String(completed) },
          { label: "Upcoming", value: String(upcoming) },
          { label: "Avg integration calls", value: String(avgCalls) },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>All ceremony records</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} records</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Member", "Ceremony date", "Medicine form", "Guides present", "Status", "Integration calls", "Pre notes", "Post notes"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No ceremony records yet</td></tr>
              ) : rows.map((r) => {
                const isComplete = r.status === "Complete";
                return (
                  <tr key={r.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <td style={TD}><div style={{ fontWeight: 500, fontSize: 13 }}>{memberMap[r.member_id] ?? "Unknown"}</div></td>
                    <td style={TD}>{fmtDate(r.ceremony_date)}</td>
                    <td style={TD}>{r.medicine_form ?? "—"}</td>
                    <td style={TD}>{r.guides_present ?? "—"}</td>
                    <td style={TD}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99, whiteSpace: "nowrap",
                        background: isComplete ? "#E1F5EE" : "#FAEEDA",
                        color: isComplete ? "#085041" : "#633806",
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: isComplete ? "#1D9E75" : "#EF9F27", display: "inline-block" }} />
                        {r.status ?? "Unknown"}
                      </span>
                    </td>
                    <td style={TD}>{r.integration_calls ?? 0}</td>
                    <td style={{ ...TD, fontSize: 11, color: r.pre_notes ? "#6B6B67" : "#9E9E9A", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.pre_notes ?? "—"}</td>
                    <td style={{ ...TD, fontSize: 11, color: r.post_notes ? "#6B6B67" : "#9E9E9A", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.post_notes ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
