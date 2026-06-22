"use client";

import { useState, useMemo } from "react";
import MemberMedicalPanel, {
  type MedMember,
  fmtDate,
  getFlags,
  CkBadge,
  initials,
} from "./MemberMedicalPanel";

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Signed — Awaiting Intake": { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  "Intake Complete": { bg: "#EAF3DE", text: "#27500A", dot: "#639922" },
  "Ceremony Scheduled": { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  "Ceremony Complete": { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  "Integration Phase": { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  Alumni: { bg: "#F1EFE8", text: "#444441", dot: "#888780" },
};
const fallbackColor = { bg: "#F1EFE8", text: "#444441", dot: "#888780" };

/* ── Component ─────────────────────────────────────────────────── */
export default function MedicalView({ members }: { members: MedMember[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterCleared, setFilterCleared] = useState("");
  const [filterCardiac, setFilterCardiac] = useState("");
  const [filterGuide, setFilterGuide] = useState("");
  const [filterFlag, setFilterFlag] = useState("");

  const guides = useMemo(() => {
    const set = new Set(members.map((m) => m.assigned_partner).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [members]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const q = search.toLowerCase();
      if (q && !m.full_name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q) && !(m.assigned_partner ?? "").toLowerCase().includes(q)) return false;
      if (filterCleared === "cleared" && !m.medical_cleared) return false;
      if (filterCleared === "not-cleared" && m.medical_cleared) return false;
      if (filterCardiac === "cleared" && !m.cardiac_cleared) return false;
      if (filterCardiac === "pending" && m.cardiac_cleared) return false;
      if (filterGuide && (filterGuide === "Unassigned" ? m.assigned_partner : m.assigned_partner !== filterGuide)) return false;
      const flags = getFlags(m);
      if (filterFlag === "flagged" && flags.length === 0) return false;
      if (filterFlag === "clear" && flags.length > 0) return false;
      return true;
    });
  }, [members, search, filterCleared, filterCardiac, filterGuide, filterFlag]);

  const selected = selectedId ? members.find((m) => m.id === selectedId) ?? null : null;

  const totalMembers = members.length;
  const medClearedCount = members.filter((m) => m.medical_cleared).length;
  const cardiacClearedCount = members.filter((m) => m.cardiac_cleared).length;
  const activeContras = members.filter((m) => getFlags(m).some((f) => f.includes("interaction"))).length;
  const intakeCount = members.filter((m) => m.intake).length;

  const LABEL: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", marginBottom: 6, fontWeight: 500 };
  const SELECT: React.CSSProperties = { padding: "7px 10px", fontSize: 12, border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 7, background: "#fff", color: "#1A1A18", cursor: "pointer", outline: "none" };

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Confidential — founders & assigned guide only</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.25rem" }}>Medical profiles</h1>

      <div style={{ background: "#FAEEDA", border: "0.5px solid #FAC775", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#633806", display: "flex", gap: 8, marginBottom: "1.25rem" }}>
        <span>🔒</span>
        <span>This section is visible to founders and the member&apos;s assigned guide only.</span>
      </div>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 10, marginBottom: "1.25rem" }}>
        {[
          { label: "Total members", value: String(totalMembers) },
          { label: "Medically cleared", value: `${medClearedCount}/${totalMembers}` },
          { label: "Cardiac cleared", value: `${cardiacClearedCount}/${totalMembers}` },
          { label: "Active contraindications", value: String(activeContras), color: activeContras > 0 ? "#A32D2D" : undefined },
          { label: "Intake forms submitted", value: `${intakeCount}/${totalMembers}` },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, padding: "1rem 1.1rem" }}>
            <p style={LABEL}>{c.label}</p>
            <p style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1, color: c.color ?? "#1A1A18", margin: 0 }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Split panel layout */}
      <div style={{ display: "flex", gap: 0, background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden", minHeight: 500 }}>
        {/* Left: Table */}
        <div style={{ flex: selected ? "0 0 420px" : 1, display: "flex", flexDirection: "column", overflow: "hidden", transition: "all 0.25s ease" }}>
          {/* Toolbar */}
          <div style={{ background: "#fff", borderBottom: "0.5px solid rgba(0,0,0,0.1)", padding: "10px 1.25rem", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <input
                type="text"
                placeholder="Search by name, email, guide..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: "100%", padding: "7px 10px 7px 10px", fontSize: 13, border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 7, background: "#FAFAF8", color: "#1A1A18", outline: "none", fontFamily: "var(--font-body, sans-serif)" }}
              />
            </div>
            <select style={SELECT} value={filterCleared} onChange={(e) => setFilterCleared(e.target.value)}>
              <option value="">All clearance</option>
              <option value="cleared">Medically cleared</option>
              <option value="not-cleared">Not cleared</option>
            </select>
            <select style={SELECT} value={filterCardiac} onChange={(e) => setFilterCardiac(e.target.value)}>
              <option value="">All cardiac</option>
              <option value="cleared">Cardiac cleared</option>
              <option value="pending">Cardiac pending</option>
            </select>
            <select style={SELECT} value={filterGuide} onChange={(e) => setFilterGuide(e.target.value)}>
              <option value="">All guides</option>
              {guides.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="Unassigned">Unassigned</option>
            </select>
            <select style={SELECT} value={filterFlag} onChange={(e) => setFilterFlag(e.target.value)}>
              <option value="">All flags</option>
              <option value="flagged">Has flags</option>
              <option value="clear">No flags</option>
            </select>
            <span style={{ fontSize: 12, color: "#9E9E9A", whiteSpace: "nowrap" }}>{filtered.length} member{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: selected ? 420 : 780 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 5 }}>
                <tr>
                  {["Member", "Guide", "Stage", "Med cleared", "Cardiac", "Contraindications", "BP", "HR", "Intake", "Ceremony"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 10, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.1)", background: "#FAFAF8", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ padding: "4rem", textAlign: "center", color: "#9E9E9A", fontSize: 14 }}>No members match your filters.</td></tr>
                ) : filtered.map((m) => {
                  const sc = STATUS_COLORS[m.status ?? ""] ?? fallbackColor;
                  const flags = getFlags(m);
                  const bpWarn = m.bp_systolic != null && (m.bp_systolic >= 135 || (m.bp_diastolic ?? 0) >= 85);
                  const isSelected = selectedId === m.id;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setSelectedId(isSelected ? null : m.id)}
                      style={{ cursor: "pointer", borderBottom: "0.5px solid rgba(0,0,0,0.06)", background: isSelected ? "#E8F5F0" : undefined, transition: "background 0.1s" }}
                    >
                      <td style={{ padding: "10px 14px", fontSize: 12, borderLeft: isSelected ? "2px solid #1D6B4A" : "2px solid transparent" }}>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{m.full_name}</div>
                        <div style={{ fontSize: 11, color: "#9E9E9A" }}>{m.email}</div>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: m.assigned_partner ? "#1A1A18" : "#9E9E9A" }}>
                        {m.assigned_partner ?? <span style={{ color: "#9E9E9A" }}>Unassigned</span>}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: sc.bg, color: sc.text, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />
                          {m.status ?? "Unknown"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <CkBadge ok={m.medical_cleared} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <CkBadge ok={m.cardiac_cleared} warn={flags.includes("Cardiac pending")} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {flags.length > 0 ? (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {flags.map((f) => (
                              <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FCEBEB", color: "#A32D2D", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 500 }}>{f}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#E1F5EE", color: "#085041", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 500 }}>Clear</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12 }}>
                        {m.bp_systolic ? <span style={{ fontWeight: 500, color: bpWarn ? "#A32D2D" : "#085041" }}>{m.bp_systolic}/{m.bp_diastolic}</span> : <span style={{ color: "#9E9E9A" }}>—</span>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: m.heart_rate ? "#1A1A18" : "#9E9E9A" }}>
                        {m.heart_rate ? `${m.heart_rate} bpm` : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {m.intake ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#E1F5EE", color: "#085041", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 500 }}>{fmtDate(m.intake.submission_date)}</span>
                        ) : (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FAEEDA", color: "#633806", borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 500 }}>Pending</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: m.ceremony_date ? "#1A1A18" : "#9E9E9A" }}>
                        {fmtDate(m.ceremony_date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Detail panel */}
        {selected && (
          <DetailPanel member={selected} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}

/* ── Detail panel (slide-out) ──────────────────────────────────────
   Thin chrome around the shared MemberMedicalPanel: an avatar header with
   the member's name/email and a close button. The medical body itself —
   readiness, vitals, contraindications, labs — is the shared component, so
   the standalone ops view and the Member Profile Medical tab stay in sync. */
function DetailPanel({ member: m, onClose }: { member: MedMember; onClose: () => void }) {
  return (
    <div style={{ width: 540, borderLeft: "0.5px solid rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", overflowY: "auto", background: "#fff" }}>
      {/* Header */}
      <div style={{ padding: "1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "sticky", top: 0, background: "#fff", zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#E1F5EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 600, color: "#085041", flexShrink: 0, marginRight: 12 }}>
            {initials(m.full_name)}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 2 }}>{m.full_name}</div>
            <div style={{ fontSize: 12, color: "#6B6B67" }}>{m.email}</div>
          </div>
        </div>
        <button onClick={onClose} style={{ fontSize: 18, color: "#9E9E9A", cursor: "pointer", background: "none", border: "none", lineHeight: 1, padding: "2px 6px", borderRadius: 4 }}>✕</button>
      </div>

      {/* Body — shared single-member medical panel */}
      <div style={{ padding: "1.25rem" }}>
        <MemberMedicalPanel member={m} />
      </div>
    </div>
  );
}
