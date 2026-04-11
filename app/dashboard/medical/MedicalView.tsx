"use client";

import { useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/* ── Types ─────────────────────────────────────────────────────── */
type MedMember = {
  id: string;
  full_name: string;
  email: string;
  assigned_partner: string | null;
  status: string | null;
  journey_focus: string | null;
  ceremony_date: string | null;
  medical_cleared: boolean | null;
  cardiac_cleared: boolean | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  heart_rate: number | null;
  medical_notes: string | null;
  medication_interactions: string | null;
  intake: {
    date_of_birth: string | null;
    phone: string | null;
    emergency_contact: string | null;
    emergency_phone: string | null;
    dietary_restrictions: string | null;
    health_history: string | null;
    current_medications: string | null;
    primary_intention: string | null;
    psychiatric_history: string | null;
    substance_history: string | null;
    supplements: string | null;
    previous_psychedelic_experience: string | null;
    submission_date: string | null;
  } | null;
  labs: LabDoc[];
};

type LabDoc = {
  id: string;
  lab_type: string;
  file_name: string;
  file_path: string;
  status: string;
  ai_extracted_data: any;
  ai_summary: string | null;
  founder_notes: string | null;
  reviewed_at: string | null;
  uploaded_at: string;
};

const LAB_TYPES = [
  { key: "ekg", label: "EKG / QTc" },
  { key: "thyroid", label: "Thyroid Panel" },
  { key: "liver", label: "Liver Panel" },
  { key: "magnesium", label: "Magnesium" },
  { key: "stress_test", label: "Cardiac Stress Test" },
  { key: "cyp450", label: "CYP450" },
  { key: "cmp", label: "CMP" },
];

/* ── Helpers ───────────────────────────────────────────────────── */
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Signed — Awaiting Intake": { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  "Intake Complete": { bg: "#EAF3DE", text: "#27500A", dot: "#639922" },
  "Ceremony Scheduled": { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  "Ceremony Complete": { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  "Integration Phase": { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  Alumni: { bg: "#F1EFE8", text: "#444441", dot: "#888780" },
};
const fallbackColor = { bg: "#F1EFE8", text: "#444441", dot: "#888780" };

/* ── Contraindications logic ───────────────────────────────────── */
function getContraindications(m: MedMember) {
  const meds = m.intake?.current_medications?.toLowerCase() ?? "";
  const psych = m.intake?.psychiatric_history?.toLowerCase() ?? "";
  const health = m.intake?.health_history?.toLowerCase() ?? "";
  const noIntake = !m.intake;

  const items = [
    { label: "Liver disease", status: noIntake ? "Unknown" : health.includes("liver") ? "FLAGGED" : "Clear", cls: noIntake ? "unknown" : health.includes("liver") ? "flag" : "clear" },
    { label: "Heart disease / QT prolongation", status: !m.cardiac_cleared ? (noIntake ? "Unknown" : "Pending EKG") : "Clear", cls: m.cardiac_cleared ? "clear" : "unknown" },
    { label: "SSRI / antidepressants", status: noIntake ? "Unknown" : (meds.includes("ssri") || meds.includes("sertraline") || meds.includes("bupropion") || meds.includes("wellbutrin") || meds.includes("fluoxetine") || meds.includes("paroxetine")) ? "FLAGGED" : "Clear", cls: noIntake ? "unknown" : (meds.includes("ssri") || meds.includes("sertraline") || meds.includes("bupropion") || meds.includes("wellbutrin") || meds.includes("fluoxetine") || meds.includes("paroxetine")) ? "flag" : "clear" },
    { label: "MAOI medications", status: noIntake ? "Unknown" : meds.includes("maoi") ? "FLAGGED" : "Clear", cls: noIntake ? "unknown" : meds.includes("maoi") ? "flag" : "clear" },
    { label: "Psychiatric history (psychosis)", status: noIntake ? "Unknown" : (psych.includes("psychosis") || psych.includes("schizophrenia") || psych.includes("bipolar")) ? "FLAGGED" : "Clear", cls: noIntake ? "unknown" : (psych.includes("psychosis") || psych.includes("schizophrenia") || psych.includes("bipolar")) ? "flag" : "clear" },
    { label: "Seizure history", status: noIntake ? "Unknown" : health.includes("seizure") ? "FLAGGED" : "Clear", cls: noIntake ? "unknown" : health.includes("seizure") ? "flag" : "clear" },
    { label: "Blood thinners", status: noIntake ? "Unknown" : (meds.includes("warfarin") || meds.includes("blood thinner") || meds.includes("anticoagulant")) ? "FLAGGED" : "Clear", cls: noIntake ? "unknown" : (meds.includes("warfarin") || meds.includes("blood thinner") || meds.includes("anticoagulant")) ? "flag" : "clear" },
    { label: "Pregnancy", status: noIntake ? "Unknown" : "Clear", cls: noIntake ? "unknown" : "clear" },
  ];
  return items;
}

function getFlags(m: MedMember) {
  const flags: string[] = [];
  if (!m.intake) flags.push("Intake missing");
  if (!m.cardiac_cleared && m.medical_cleared) flags.push("Cardiac pending");
  if (m.bp_systolic && (m.bp_systolic >= 135 || (m.bp_diastolic ?? 0) >= 85)) flags.push("BP elevated");
  const meds = m.intake?.current_medications?.toLowerCase() ?? "";
  if (meds.includes("bupropion") || meds.includes("wellbutrin")) flags.push("Bupropion interaction");
  if (meds.includes("ssri") || meds.includes("sertraline")) flags.push("SSRI interaction");
  return flags;
}

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

/* ── Sub-components ────────────────────────────────────────────── */
function CkBadge({ ok, warn }: { ok: boolean | null | undefined; warn?: boolean }) {
  if (ok) return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#E1F5EE", color: "#085041", fontSize: 10, fontWeight: 700 }}>✓</span>;
  if (warn) return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#FCEBEB", color: "#A32D2D", fontSize: 11, fontWeight: 700 }}>!</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#F1EFE8", color: "#9E9E9A", fontSize: 10 }}>—</span>;
}

function DetailPanel({ member: m, onClose }: { member: MedMember; onClose: () => void }) {
  const flags = getFlags(m);
  const contras = getContraindications(m);
  const bpWarn = m.bp_systolic != null && (m.bp_systolic >= 135 || (m.bp_diastolic ?? 0) >= 85);

  const bannerClass = !m.intake
    ? { bg: "#FAEEDA", border: "#FAC775", color: "#633806", text: "Intake form not submitted — medical profile incomplete" }
    : flags.length > 0
      ? { bg: "#FCEBEB", border: "#F09595", color: "#A32D2D", text: `${flags.join(" · ")} — review required` }
      : { bg: "#E1F5EE", border: "#5DCAA5", color: "#085041", text: "Medically cleared · Cardiac passed · No active contraindications" };

  const bannerIcon = bannerClass.bg === "#E1F5EE" ? "✓" : "⚠";

  const SEC_TITLE: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500, marginBottom: 8 };
  const TEXT_BLOCK: React.CSSProperties = { background: "#FAFAF8", borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.6, color: "#1A1A18" };

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

      {/* Body */}
      <div style={{ padding: "1.25rem" }}>
        {/* Banner */}
        <div style={{ borderRadius: 8, padding: "10px 14px", fontSize: 12, display: "flex", gap: 8, marginBottom: "1.25rem", background: bannerClass.bg, color: bannerClass.color, border: `0.5px solid ${bannerClass.border}` }}>
          <span>{bannerIcon}</span>
          <span>{bannerClass.text}</span>
        </div>

        {/* Identity & contact */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={SEC_TITLE}>Identity & contact</p>
          <div style={{ background: "#FAFAF8", borderRadius: 8, overflow: "hidden" }}>
            {[
              { label: "Date of birth", value: m.intake?.date_of_birth ? fmtDate(m.intake.date_of_birth) : "Not submitted" },
              { label: "Phone", value: m.intake?.phone ?? "Not submitted" },
              { label: "Emergency contact", value: m.intake?.emergency_contact ?? "Not submitted" },
              { label: "Emergency phone", value: m.intake?.emergency_phone ?? "Not submitted" },
              { label: "Assigned guide", value: m.assigned_partner ?? "Not assigned" },
              { label: "Journey focus", value: m.journey_focus ?? "Not set" },
              { label: "Dietary restrictions", value: m.intake?.dietary_restrictions ?? "Not submitted" },
              { label: "Ceremony date", value: fmtDate(m.ceremony_date) },
              { label: "Intake submitted", value: m.intake ? fmtDate(m.intake.submission_date) : "Pending" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", fontSize: 12 }}>
                <span style={{ color: "#6B6B67" }}>{row.label}</span>
                <span style={{ fontWeight: 500, textAlign: "right", maxWidth: 220, color: row.value.includes("Not") || row.value === "Pending" || row.value === "—" ? "#9E9E9A" : "#1A1A18" }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vitals */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={SEC_TITLE}>Vitals</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1, color: m.bp_systolic ? (bpWarn ? "#A32D2D" : "#085041") : "#9E9E9A" }}>
                {m.bp_systolic ? `${m.bp_systolic}/${m.bp_diastolic}` : "—"}
              </div>
              <div style={{ fontSize: 10, color: "#9E9E9A", marginTop: 2 }}>mmHg{bpWarn ? " ↑" : ""}</div>
              <div style={{ fontSize: 11, color: "#6B6B67", marginTop: 6 }}>Blood pressure</div>
            </div>
            <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1, color: m.heart_rate ? "#085041" : "#9E9E9A" }}>
                {m.heart_rate ?? "—"}
              </div>
              <div style={{ fontSize: 10, color: "#9E9E9A", marginTop: 2 }}>{m.heart_rate ? "bpm" : ""}</div>
              <div style={{ fontSize: 11, color: "#6B6B67", marginTop: 6 }}>Resting heart rate</div>
            </div>
            <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12, textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 500, lineHeight: 1 }}>
                <CkBadge ok={m.cardiac_cleared} warn={flags.includes("Cardiac pending")} />
              </div>
              <div style={{ fontSize: 10, color: "#9E9E9A", marginTop: 4 }}>{m.cardiac_cleared ? "passed" : "pending"}</div>
              <div style={{ fontSize: 11, color: "#6B6B67", marginTop: 6 }}>Cardiac screening</div>
            </div>
          </div>
        </div>

        {/* Contraindications */}
        {contras.length > 0 && (
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={SEC_TITLE}>Contraindications checklist</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {contras.map((c) => {
                const colors = c.cls === "clear" ? { bg: "#E1F5EE", color: "#085041", dot: "#1D9E75" } : c.cls === "flag" ? { bg: "#FCEBEB", color: "#A32D2D", dot: "#A32D2D" } : { bg: "#F1EFE8", color: "#6B6B67", dot: "#888780" };
                return (
                  <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 7, fontSize: 12, background: colors.bg, color: colors.color }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors.dot, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontWeight: 500 }}>{c.label}</span>
                    <span style={{ fontSize: 11, opacity: 0.85 }}>{c.status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Health history + Medications */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
          <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12 }}>
            <p style={{ ...SEC_TITLE, marginBottom: 8 }}>Health history</p>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: m.intake?.health_history ? "#1A1A18" : "#9E9E9A", fontStyle: m.intake?.health_history ? "normal" : "italic" }}>
              {m.intake?.health_history ?? "Not submitted"}
            </div>
          </div>
          <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12 }}>
            <p style={{ ...SEC_TITLE, marginBottom: 8 }}>Current medications</p>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: m.intake?.current_medications ? "#1A1A18" : "#9E9E9A", fontStyle: m.intake?.current_medications ? "normal" : "italic" }}>
              {m.intake?.current_medications ?? "Not submitted"}
            </div>
          </div>
        </div>

        {/* Medication interactions */}
        {m.medication_interactions && (
          <div style={{ marginBottom: "1.25rem" }}>
            <p style={SEC_TITLE}>Medication interactions with iboga</p>
            <div style={{ ...TEXT_BLOCK, background: m.medication_interactions.toLowerCase().includes("flag") || m.medication_interactions.toLowerCase().includes("interact") ? "#FCEBEB" : "#FAFAF8", color: m.medication_interactions.toLowerCase().includes("flag") || m.medication_interactions.toLowerCase().includes("interact") ? "#A32D2D" : "#1A1A18" }}>
              {m.medication_interactions}
            </div>
          </div>
        )}

        {/* Supplements + Previous experience */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: "1.25rem" }}>
          <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12 }}>
            <p style={{ ...SEC_TITLE, marginBottom: 8 }}>Current supplements</p>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: m.intake?.supplements ? "#1A1A18" : "#9E9E9A", fontStyle: m.intake?.supplements ? "normal" : "italic" }}>
              {m.intake?.supplements ?? "Not submitted"}
            </div>
          </div>
          <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 12 }}>
            <p style={{ ...SEC_TITLE, marginBottom: 8 }}>Previous psychedelic experience</p>
            <div style={{ fontSize: 12, lineHeight: 1.6, color: m.intake?.previous_psychedelic_experience ? "#1A1A18" : "#9E9E9A", fontStyle: m.intake?.previous_psychedelic_experience ? "normal" : "italic" }}>
              {m.intake?.previous_psychedelic_experience ?? "Not submitted"}
            </div>
          </div>
        </div>

        {/* Primary intention */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={SEC_TITLE}>Primary intention</p>
          <div style={{ ...TEXT_BLOCK, color: m.intake?.primary_intention ? "#1A1A18" : "#9E9E9A", fontStyle: m.intake?.primary_intention ? "normal" : "italic" }}>
            {m.intake?.primary_intention ?? "Not submitted"}
          </div>
        </div>

        {/* Internal medical notes */}
        <div style={{ marginBottom: "1.25rem" }}>
          <p style={SEC_TITLE}>Internal medical notes</p>
          <div style={{ ...TEXT_BLOCK, background: m.medical_notes?.toLowerCase().includes("await") ? "#FFF8EC" : "#FAFAF8", color: m.medical_notes ? "#1A1A18" : "#9E9E9A", fontStyle: m.medical_notes ? "normal" : "italic" }}>
            {m.medical_notes ?? "No medical notes recorded"}
          </div>
        </div>

        {/* Lab Documents */}
        <LabDocumentsSection labs={m.labs} memberId={m.id} />
      </div>
    </div>
  );
}

/* ── Lab Documents Section ─────────────────────────────────────── */
function LabDocumentsSection({ labs, memberId }: { labs: LabDoc[]; memberId: string }) {
  const supabase = createClient();
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const labByType: Record<string, LabDoc> = {};
  for (const l of labs) {
    if (!labByType[l.lab_type] || new Date(l.uploaded_at) > new Date(labByType[l.lab_type].uploaded_at)) {
      labByType[l.lab_type] = l;
    }
  }

  const approvedCount = LAB_TYPES.filter((t) => labByType[t.key]?.status === "approved").length;

  async function viewFile(filePath: string) {
    const { data } = await supabase.storage.from("lab-documents").createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function updateLabStatus(docId: string, status: "approved" | "flagged" | "reviewed", notes?: string) {
    setLoading((l) => ({ ...l, [docId]: true }));
    await supabase
      .from("lab_documents")
      .update({
        status,
        founder_notes: notes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", docId);
    window.location.reload();
  }

  const SEC_TITLE: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500, marginBottom: 8 };

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ ...SEC_TITLE, margin: 0 }}>Lab Documents</p>
        <span style={{
          fontSize: 11, padding: "2px 8px", borderRadius: 99,
          background: approvedCount === 7 ? "#E1F5EE" : "#FAEEDA",
          color: approvedCount === 7 ? "#085041" : "#633806",
        }}>
          {approvedCount}/7 approved{approvedCount === 7 ? " — fully cleared" : ""}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {LAB_TYPES.map(({ key, label }) => {
          const doc = labByType[key];
          const isLoading = doc && loading[doc.id];
          const statusDot = !doc ? "#C5C5C2" : doc.status === "approved" ? "#1D9E75" : doc.status === "flagged" ? "#A32D2D" : doc.status === "processing" ? "#EF9F27" : "#378ADD";
          const statusLabel = !doc ? "Not submitted" : doc.status === "approved" ? "Approved" : doc.status === "flagged" ? "Flagged" : doc.status === "processing" ? "Processing" : doc.status === "reviewed" ? "AI Reviewed" : "Uploaded";

          return (
            <div key={key}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FAFAF8", borderRadius: 7 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#1A1A18" }}>{label}</span>
                <span style={{ fontSize: 11, color: statusDot }}>{statusLabel}</span>
                {doc && (
                  <>
                    <span style={{ fontSize: 10, color: "#9E9E9A" }}>{fmtDate(doc.uploaded_at)}</span>
                    <button
                      onClick={() => viewFile(doc.file_path)}
                      style={{ fontSize: 11, color: "#1D6B4A", background: "none", border: "0.5px solid #1D6B4A", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                    >
                      View
                    </button>
                    {(doc.status === "uploaded" || doc.status === "reviewed") && (
                      <>
                        <button
                          onClick={() => updateLabStatus(doc.id, "approved")}
                          disabled={isLoading}
                          style={{ fontSize: 11, color: "#fff", background: "#1D9E75", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                        >
                          {isLoading ? "..." : "Approve"}
                        </button>
                        <button
                          onClick={() => {
                            const note = noteInputs[doc.id]?.trim();
                            if (!note) { alert("Add a note before flagging."); return; }
                            updateLabStatus(doc.id, "flagged", note);
                          }}
                          disabled={isLoading}
                          style={{ fontSize: 11, color: "#A32D2D", background: "#FCEBEB", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}
                        >
                          Flag
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* AI extraction summary */}
              {doc && doc.ai_extracted_data && (doc.status === "reviewed" || doc.status === "approved") && (
                <div style={{ margin: "4px 0 0 18px", padding: "8px 12px", background: "#0E1A10", borderRadius: 6, fontSize: 12, color: "#A8C5AC", lineHeight: 1.5 }}>
                  {doc.ai_summary && <p style={{ margin: "0 0 4px" }}>{doc.ai_summary}</p>}
                  {doc.ai_extracted_data.flagged_values?.length > 0 && (
                    <p style={{ margin: 0, color: "#FF9E8C" }}>Flagged: {doc.ai_extracted_data.flagged_values.join(" · ")}</p>
                  )}
                </div>
              )}

              {/* Flag note for founder */}
              {doc && doc.status === "flagged" && doc.founder_notes && (
                <div style={{ margin: "4px 0 0 18px", padding: "8px 12px", background: "#FCEBEB", borderRadius: 6, fontSize: 12, color: "#A32D2D" }}>
                  Note: {doc.founder_notes}
                </div>
              )}

              {/* Note input for flagging */}
              {doc && (doc.status === "uploaded" || doc.status === "reviewed") && (
                <input
                  placeholder="Note (required to flag)..."
                  value={noteInputs[doc.id] ?? ""}
                  onChange={(e) => setNoteInputs((n) => ({ ...n, [doc.id]: e.target.value }))}
                  style={{ margin: "4px 0 0 18px", width: "calc(100% - 18px)", padding: "6px 10px", fontSize: 12, border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 5, background: "#fff", color: "#1A1A18", outline: "none" }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
