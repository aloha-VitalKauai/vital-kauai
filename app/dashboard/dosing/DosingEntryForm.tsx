"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const PROTOCOL_OPTIONS = ["Flood", "Split", "Booster", "Test Dose", "Microdose", "Other"];

function getRanges(lbs: number) {
  const kg = lbs / 2.20462;
  return {
    consult: { low: kg * 0.01, high: kg * 0.02, label: "Consultation dose", color: "#3B6D11", bg: "#EAF3DE" },
    integration: { low: kg * 0.08, high: kg * 0.14, label: "Booster / integration", color: "#27500A", bg: "#C0DD97" },
    flood: { low: kg * 0.14, mid: kg * 0.18, high: kg * 0.22, label: "Standard flood", color: "#185FA5", bg: "#B5D4F4" },
    deep: { low: kg * 0.22, high: kg * 0.32, label: "Deep flood", color: "#633806", bg: "#FAC775" },
  };
}

function fmt(n: number) { return n.toFixed(1); }

function classifyDose(gPerKg: number): string {
  if (gPerKg < 0.02) return "Test Dose";
  if (gPerKg < 0.08) return "Microdose";
  if (gPerKg < 0.14) return "Booster";
  return "Flood";
}

const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, overflowY: "auto", padding: "2rem 1rem" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 12, width: "100%", maxWidth: 680, border: "0.5px solid rgba(0,0,0,0.12)", overflow: "hidden" };
const fieldStyle: React.CSSProperties = { width: "100%", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 7, padding: "9px 12px", fontSize: 14, fontFamily: "inherit", outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6B6B67", display: "block", marginBottom: 5, fontWeight: 500 };

export default function DosingEntryForm({ members, ceremonies, batches, onSaved, onCancel }: {
  members: any[]; ceremonies: any[]; batches: any[]; onSaved: () => void; onCancel: () => void;
}) {
  const supabase = createClient();
  const [memberId, setMemberId] = useState("");
  const [ceremonyId, setCeremonyId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [doseG, setDoseG] = useState("");
  const [protocol, setProtocol] = useState("Flood");
  const [adminAt, setAdminAt] = useState(new Date().toISOString().slice(0, 16));
  const [qtcPre, setQtcPre] = useState("");
  const [qtcPeak, setQtcPeak] = useState("");
  const [adminBy, setAdminBy] = useState("");
  const [notes, setNotes] = useState("");
  const [adverse, setAdverse] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lbs = parseFloat(weightLbs) || 0;
  const kg = lbs / 2.20462;
  const ranges = lbs > 0 ? getRanges(lbs) : null;
  const doseNum = parseFloat(doseG) || 0;
  const gPerKg = kg > 0 && doseNum > 0 ? doseNum / kg : null;

  useEffect(() => { if (lbs > 0 && doseG === "") { setDoseG(fmt(kg * 0.18)); setProtocol("Flood"); } }, [lbs]);
  useEffect(() => { if (gPerKg) setProtocol(classifyDose(gPerKg)); }, [doseG]);

  const memberCeremonies = ceremonies.filter((c) => !memberId || c.member_id === memberId);

  async function save() {
    setSaving(true); setError(null);
    const { error: err } = await supabase.from("dosing_records").insert({
      member_id: memberId || null, ceremony_id: ceremonyId || null, batch_id: batchId || null,
      member_weight_lbs: lbs || null, dose_g: doseNum || null, protocol_type: protocol,
      dose_sequence: 1, administered_at: adminAt,
      qtc_pre_dose: qtcPre ? parseInt(qtcPre) : null, qtc_peak: qtcPeak ? parseInt(qtcPeak) : null,
      administered_by: adminBy || null, notes: notes || null, adverse_events: adverse || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={modal}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", margin: "0 0 2px" }}>Log ceremony</p>
            <h2 style={{ fontFamily: "var(--font-display, serif)", fontSize: 22, fontWeight: 400, margin: 0 }}>Dosing record</h2>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9E9E9A" }}>&times;</button>
        </div>

        <div style={{ padding: "1.5rem", display: "grid", gap: "1.25rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Member</label>
              <select value={memberId} onChange={(e) => setMemberId(e.target.value)} style={fieldStyle}>
                <option value="">Select member...</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Ceremony</label>
              <select value={ceremonyId} onChange={(e) => setCeremonyId(e.target.value)} style={fieldStyle}>
                <option value="">Select ceremony...</option>
                {memberCeremonies.map((c) => <option key={c.id} value={c.id}>{new Date(c.ceremony_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Member weight (lbs)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="number" value={weightLbs} onChange={(e) => setWeightLbs(e.target.value)} placeholder="e.g. 190" style={{ ...fieldStyle, width: 140 }} />
              {lbs > 0 && <span style={{ fontSize: 13, color: "#9E9E9A" }}>= {kg.toFixed(1)} kg</span>}
            </div>
          </div>

          {ranges && (
            <div style={{ background: "#FAFAF8", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "1rem 1.25rem" }}>
              <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", marginBottom: 10 }}>
                Iboga root bark dose ranges for {Math.round(lbs)} lbs
              </p>
              <div style={{ display: "grid", gap: 6 }}>
                {[
                  { key: "consult", r: ranges.consult },
                  { key: "integration", r: ranges.integration },
                  { key: "flood", r: ranges.flood, isStandard: true },
                  { key: "deep", r: ranges.deep },
                ].map(({ key, r, isStandard }) => {
                  const lo = (r as any).low, hi = (r as any).high, mid = (r as any).mid;
                  const isActive = doseNum > 0 && doseNum >= lo * 0.95 && doseNum <= hi * 1.05;
                  return (
                    <div key={key} onClick={() => { if (mid) setDoseG(fmt(mid)); else setDoseG(fmt((lo + hi) / 2)); }}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 7, cursor: "pointer",
                        border: isActive ? `1.5px solid ${r.color}` : isStandard ? "1.5px solid #B5D4F4" : "0.5px solid rgba(0,0,0,0.08)",
                        background: isActive ? r.bg : isStandard ? "#EEF5FC" : "#fff", transition: "all 0.15s",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: isStandard ? 500 : 400, color: "#1A1A18" }}>
                          {r.label}{isStandard && <span style={{ fontSize: 11, color: "#9E9E9A", fontWeight: 400, marginLeft: 6 }}>— tap to use midpoint</span>}
                        </span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: r.color }}>{fmt(lo)}&ndash;{fmt(hi)} g</span>
                        {mid && <span style={{ fontSize: 11, color: "#9E9E9A", display: "block" }}>mid {fmt(mid)} g</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Dose administered (g)</label>
              <input type="number" step="0.1" value={doseG} onChange={(e) => setDoseG(e.target.value)} placeholder="e.g. 15.5" style={{ ...fieldStyle, fontSize: 18, fontWeight: 500 }} />
              {gPerKg && <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 4 }}>{gPerKg.toFixed(3)} g/kg</p>}
            </div>
            <div>
              <label style={labelStyle}>Protocol</label>
              <select value={protocol} onChange={(e) => setProtocol(e.target.value)} style={fieldStyle}>
                {PROTOCOL_OPTIONS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Administered at</label>
              <input type="datetime-local" value={adminAt} onChange={(e) => setAdminAt(e.target.value)} style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Medicine batch (COA)</label>
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} style={fieldStyle}>
              <option value="">Select batch...</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.batch_code} — {b.medicine_form}{b.ibogaine_pct ? ` \u00B7 ${b.ibogaine_pct}% ibogaine` : ""}</option>)}
            </select>
            {batchId && batches.find((b) => b.id === batchId)?.ibogaine_pct && doseNum > 0 && (
              <p style={{ fontSize: 12, color: "#6B6B67", marginTop: 6 }}>
                &asymp; {((batches.find((b) => b.id === batchId)!.ibogaine_pct / 100) * doseNum).toFixed(2)} g actual ibogaine in this dose
              </p>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>QTc pre-dose (ms)</label>
              <input type="number" value={qtcPre} onChange={(e) => setQtcPre(e.target.value)} placeholder="e.g. 410" style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle}>QTc peak (ms)</label>
              <input type="number" value={qtcPeak} onChange={(e) => setQtcPeak(e.target.value)} placeholder="e.g. 438" style={fieldStyle} />
              {parseInt(qtcPeak) > 500 && <p style={{ fontSize: 11, color: "#A32D2D", marginTop: 4, fontWeight: 500 }}>Critical — &gt;500ms</p>}
              {parseInt(qtcPeak) >= 450 && parseInt(qtcPeak) <= 500 && <p style={{ fontSize: 11, color: "#BA7517", marginTop: 4 }}>Elevated — 450&ndash;500ms</p>}
            </div>
            <div>
              <label style={labelStyle}>Administered by</label>
              <input type="text" value={adminBy} onChange={(e) => setAdminBy(e.target.value)} placeholder="Guide name" style={fieldStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Adverse events (leave blank if none)</label>
            <input type="text" value={adverse} onChange={(e) => setAdverse(e.target.value)} placeholder="e.g. prolonged QTc, vomiting — leave blank if none" style={fieldStyle} />
          </div>

          <div>
            <label style={labelStyle}>Guide notes (internal)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Experience quality, observations, integration notes..." style={{ ...fieldStyle, resize: "vertical" }} />
          </div>

          {error && <p style={{ color: "#A32D2D", fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
            <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: "#6B6B67", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} disabled={saving || !doseNum} style={{ padding: "10px 24px", borderRadius: 7, border: "none", background: saving || !doseNum ? "#8B8070" : "#1C2B1E", color: "#F5F0E8", fontSize: 13, cursor: saving || !doseNum ? "default" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving..." : "Save dosing record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
