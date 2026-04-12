"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DosingEntryForm from "./DosingEntryForm";
import BatchForm from "./BatchForm";

const s = {
  card: { background: "#fff", border: "0.5px solid rgba(0,0,0,0.1)", borderRadius: 10, overflow: "hidden" as const },
  cardHd: { padding: "0.875rem 1.25rem", borderBottom: "0.5px solid rgba(0,0,0,0.07)", display: "flex", justifyContent: "space-between", alignItems: "center" } as React.CSSProperties,
  lbl: { fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.06em", color: "#6B6B67", fontWeight: 500 },
  th: { padding: "9px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 500, color: "#6B6B67", textTransform: "uppercase" as const, letterSpacing: "0.06em", borderBottom: "0.5px solid rgba(0,0,0,0.1)", background: "#FAFAF8", whiteSpace: "nowrap" as const },
  td: { padding: "10px 14px", fontSize: 13, borderBottom: "0.5px solid rgba(0,0,0,0.06)", verticalAlign: "middle" as const },
  btn: { padding: "8px 18px", borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: "#1C2B1E", color: "#F5F0E8", fontSize: 13, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
  btnGhost: { padding: "8px 18px", borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: "#6B6B67", fontSize: 13, cursor: "pointer", fontFamily: "inherit" } as React.CSSProperties,
};

const RANGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Consultation dose": { bg: "#EAF3DE", color: "#3B6D11" },
  "Sub-flood / microdose": { bg: "#E6F1FB", color: "#0C447C" },
  "Booster / integration": { bg: "#C0DD97", color: "#27500A" },
  "Standard flood": { bg: "#B5D4F4", color: "#185FA5" },
  "Deep flood": { bg: "#FAC775", color: "#633806" },
  "Extended / intensive": { bg: "#F7C1C1", color: "#A32D2D" },
  "Not recorded": { bg: "#F1EFE8", color: "#8B8070" },
};

export default function DosingClient({ dosing, batches, members, ceremonies }: { dosing: any[]; batches: any[]; members: any[]; ceremonies: any[] }) {
  const [showDoseForm, setShowDoseForm] = useState(false);
  const [showBatchForm, setShowBatchForm] = useState(false);
  const [editingDose, setEditingDose] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"records" | "batches">("records");
  const [deleting, setDeleting] = useState<string | null>(null);
  const supabase = createClient();

  function onSaved() { setShowDoseForm(false); setShowBatchForm(false); setEditingDose(null); window.location.reload(); }

  async function deleteDose(id: string) {
    if (!confirm("Delete this dosing record?")) return;
    setDeleting(id);
    await supabase.from("dosing_records").delete().eq("id", id);
    window.location.reload();
  }

  const memberMap = Object.fromEntries(members.map((m) => [m.id, m.full_name ?? m.email]));

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 3 }}>Medicine &middot; Safety</p>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 32, fontWeight: 400, letterSpacing: "-0.02em", color: "#1A1A18", marginBottom: "1.5rem" }}>Dosing & Batches</h1>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {(["records", "batches"] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ ...(activeTab === t ? s.btn : s.btnGhost), textTransform: "capitalize" }}>
              {t === "records" ? "Dosing records" : "Medicine batches"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={s.btnGhost} onClick={() => setShowBatchForm(true)}>+ New batch</button>
          <button style={s.btn} onClick={() => setShowDoseForm(true)}>+ Log dose</button>
        </div>
      </div>

      {showDoseForm && <DosingEntryForm members={members} ceremonies={ceremonies} batches={batches} onSaved={onSaved} onCancel={() => setShowDoseForm(false)} />}
      {editingDose && <DosingEntryForm members={members} ceremonies={ceremonies} batches={batches} onSaved={onSaved} onCancel={() => setEditingDose(null)} editRecord={editingDose} />}
      {showBatchForm && <BatchForm onSaved={onSaved} onCancel={() => setShowBatchForm(false)} />}

      {activeTab === "records" && (
        <div style={s.card}>
          <div style={s.cardHd}>
            <span style={s.lbl}>Dosing records</span>
            <span style={{ fontSize: 12, color: "#9E9E9A" }}>{dosing.length} total</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            {dosing.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No dosing records yet — click &quot;Log dose&quot; to add the first.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {["Member", "Date", "Weight", "Dose (g)", "g/kg", "Protocol", "Range", "Batch", "QTc peak", "Ibogaine g", "Adverse", ""].map((h) => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {dosing.map((r) => {
                    const range = r.dose_range_label ?? "Not recorded";
                    const rc = RANGE_COLORS[range] ?? RANGE_COLORS["Not recorded"];
                    const qtcFlag = r.qtc_peak > 500;
                    const qtcWarn = r.qtc_peak >= 450 && r.qtc_peak <= 500;
                    return (
                      <tr key={r.id}>
                        <td style={{ ...s.td, fontWeight: 500 }}>{memberMap[r.member_id] ?? r.member_id}</td>
                        <td style={{ ...s.td, whiteSpace: "nowrap", color: "#6B6B67" }}>
                          {r.ceremony_records?.ceremony_date
                            ? new Date(r.ceremony_records.ceremony_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
                            : r.administered_at ? new Date(r.administered_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
                        </td>
                        <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                          {r.member_weight_lbs ? <>{r.member_weight_lbs} lbs<span style={{ fontSize: 11, color: "#9E9E9A", display: "block" }}>{r.member_weight_kg} kg</span></> : "—"}
                        </td>
                        <td style={{ ...s.td, fontWeight: 500, fontSize: 15 }}>{r.dose_g ? `${r.dose_g} g` : "—"}</td>
                        <td style={{ ...s.td, color: "#6B6B67" }}>{r.dose_g_per_kg ?? "—"}</td>
                        <td style={{ ...s.td, color: "#6B6B67" }}>{r.protocol_type ?? "—"}</td>
                        <td style={s.td}>
                          <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, fontWeight: 500, background: rc.bg, color: rc.color, whiteSpace: "nowrap" }}>{range}</span>
                        </td>
                        <td style={{ ...s.td, fontSize: 12, color: "#6B6B67" }}>
                          {r.medicine_batches?.batch_code ?? "—"}
                          {r.medicine_batches?.ibogaine_pct && <span style={{ display: "block", fontSize: 11, color: "#9E9E9A" }}>{r.medicine_batches.ibogaine_pct}% ibogaine</span>}
                        </td>
                        <td style={s.td}>
                          {r.qtc_peak ? <span style={{ fontWeight: 500, color: qtcFlag ? "#A32D2D" : qtcWarn ? "#BA7517" : "#1A1A18" }}>{r.qtc_peak} ms{qtcFlag ? " \u26A0" : qtcWarn ? " \u2191" : ""}</span> : <span style={{ color: "#9E9E9A" }}>—</span>}
                        </td>
                        <td style={{ ...s.td, color: "#6B6B67" }}>
                          {r.medicine_batches?.ibogaine_pct && r.dose_g ? `${((r.medicine_batches.ibogaine_pct / 100) * r.dose_g).toFixed(2)} g` : "—"}
                        </td>
                        <td style={s.td}>
                          {r.adverse_events ? <span style={{ color: "#A32D2D", fontSize: 12 }}>{r.adverse_events}</span> : <span style={{ color: "#9E9E9A" }}>None</span>}
                        </td>
                        <td style={{ ...s.td, whiteSpace: "nowrap" }}>
                          <button onClick={() => setEditingDose(r)} style={{ fontSize: 11, color: "#1D6B4A", background: "none", border: "0.5px solid #1D6B4A", borderRadius: 5, padding: "3px 8px", cursor: "pointer", marginRight: 4, fontFamily: "inherit" }}>Edit</button>
                          <button onClick={() => deleteDose(r.id)} disabled={deleting === r.id} style={{ fontSize: 11, color: "#A32D2D", background: "none", border: "0.5px solid #A32D2D", borderRadius: 5, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit", opacity: deleting === r.id ? 0.5 : 1 }}>{deleting === r.id ? "..." : "Delete"}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === "batches" && (
        <div style={s.card}>
          <div style={s.cardHd}>
            <span style={s.lbl}>Medicine batches</span>
            <span style={{ fontSize: 12, color: "#9E9E9A" }}>{batches.length} batches</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            {batches.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#9E9E9A", fontSize: 13 }}>No batches yet — click &quot;New batch&quot; to log your first COA.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  {["Batch code", "Form", "Ibogaine%", "Total alk%", "COA lab", "Received", "Stock (g)", "Remaining (g)", "Safety"].map((h) => <th key={h} style={s.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {batches.map((b, i) => (
                    <tr key={b.id} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAF8" }}>
                      <td style={{ ...s.td, fontWeight: 500 }}>{b.batch_code}</td>
                      <td style={{ ...s.td, color: "#6B6B67" }}>{b.medicine_form}</td>
                      <td style={s.td}>{b.ibogaine_pct != null ? `${b.ibogaine_pct}%` : "—"}</td>
                      <td style={s.td}>{b.total_alkaloids_pct != null ? `${b.total_alkaloids_pct}%` : "—"}</td>
                      <td style={{ ...s.td, color: "#6B6B67" }}>{b.coa_lab ?? "—"}</td>
                      <td style={{ ...s.td, color: "#6B6B67", whiteSpace: "nowrap" }}>{b.received_date ? new Date(b.received_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}</td>
                      <td style={s.td}>{b.quantity_g != null ? `${b.quantity_g} g` : "—"}</td>
                      <td style={{ ...s.td, color: b.quantity_remaining_g < 50 ? "#BA7517" : "#1A1A18", fontWeight: b.quantity_remaining_g < 50 ? 500 : 400 }}>{b.quantity_remaining_g != null ? `${b.quantity_remaining_g} g` : "—"}</td>
                      <td style={s.td}>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {[{ key: "heavy_metals_pass", label: "Metals" }, { key: "microbial_pass", label: "Micro" }, { key: "pesticides_pass", label: "Pest" }].map(({ key, label }) => (
                            <span key={key} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 4, fontWeight: 500, background: b[key] === true ? "#E1F5EE" : b[key] === false ? "#FCEBEB" : "#F1EFE8", color: b[key] === true ? "#085041" : b[key] === false ? "#A32D2D" : "#8B8070" }}>
                              {label} {b[key] === true ? "\u2713" : b[key] === false ? "\u2717" : "?"}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
