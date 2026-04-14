import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Leads — Vital Kauaʻi" };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Check({ ok }: { ok: boolean | null | undefined }) {
  return ok ? (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#E1F5EE", color: "#085041", fontSize: 10, fontWeight: 700 }}>✓</span>
  ) : (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", background: "#F1EFE8", color: "#9E9E9A", fontSize: 10 }}>—</span>
  );
}

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select("id, full_name, email, source, lead_date, welcome_video_sent, discovery_call_booked, discovery_call_date, converted_to_member, notes, phone, message")
    .order("lead_date", { ascending: false });

  const rows = leads ?? [];
  const videoSent = rows.filter((l) => l.welcome_video_sent).length;
  const callsBooked = rows.filter((l) => l.discovery_call_booked).length;
  const converted = rows.filter((l) => l.converted_to_member).length;
  const open = rows.filter((l) => !l.converted_to_member).length;

  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 6, fontWeight: 500 };
  const TH: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.09)", background: "#FAFAF8", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "10px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12, verticalAlign: "middle" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Pipeline</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.5rem" }}>Leads</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total leads", value: String(rows.length) },
          { label: "Video sent", value: String(videoSent), sub: rows.length > 0 ? `${Math.round((videoSent / rows.length) * 100)}%` : "0%" },
          { label: "Calls booked", value: String(callsBooked), sub: rows.length > 0 ? `${Math.round((callsBooked / rows.length) * 100)}%` : "0%" },
          { label: "Converted", value: String(converted), sub: rows.length > 0 ? `${Math.round((converted / rows.length) * 100)}%` : "0%" },
          { label: "Open leads", value: String(open) },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: "#1A1A18", margin: 0 }}>{c.value}</p>
            {c.sub && <p style={{ fontSize: 10, color: "#9E9E9A", marginTop: 5 }}>{c.sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 }}>All leads</span>
          <span style={{ fontSize: 11, color: "#9E9E9A" }}>{rows.length} total</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Message", "Source", "Lead date", "Video sent", "Call booked", "Call date", "Status", "Notes"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "2.5rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No leads yet</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <td style={TD}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.full_name}</div>
                    <div style={{ fontSize: 11, color: "#9E9E9A", marginTop: 1 }}>{r.email}</div>
                    {r.phone && <div style={{ fontSize: 11, color: "#9E9E9A", marginTop: 1 }}>{r.phone}</div>}
                  </td>
                  <td style={{ ...TD, fontSize: 11, color: r.message ? "#444441" : "#9E9E9A", maxWidth: 260, whiteSpace: "pre-wrap", lineHeight: 1.4 }}>{r.message ?? "—"}</td>
                  <td style={TD}>{r.source ?? "—"}</td>
                  <td style={TD}>{fmtDate(r.lead_date)}</td>
                  <td style={TD}><Check ok={r.welcome_video_sent} /></td>
                  <td style={TD}><Check ok={r.discovery_call_booked} /></td>
                  <td style={{ ...TD, color: r.discovery_call_date ? "#1A1A18" : "#9E9E9A" }}>{fmtDate(r.discovery_call_date)}</td>
                  <td style={TD}>
                    {r.converted_to_member ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#E1F5EE", color: "#085041", fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99 }}>Member</span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#F1EFE8", color: "#444441", fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 99 }}>Open</span>
                    )}
                  </td>
                  <td style={{ ...TD, fontSize: 11, color: r.notes ? "#6B6B67" : "#9E9E9A" }}>{r.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
