"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const fieldStyle: React.CSSProperties = { width: "100%", border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 7, padding: "9px 12px", fontSize: 14, fontFamily: "inherit", outline: "none" };
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#6B6B67", display: "block", marginBottom: 5, fontWeight: 500 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "flex-start", justifyContent: "center", zIndex: 50, overflowY: "auto", padding: "2rem 1rem" };
const modal: React.CSSProperties = { background: "#fff", borderRadius: 12, width: "100%", maxWidth: 560, border: "0.5px solid rgba(0,0,0,0.12)" };
const MEDICINE_FORMS = ["Whole Root Bark", "Total Alkaloid Extract", "Ibogaine HCl", "PTA Extract", "Other"];

export default function BatchForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const supabase = createClient();
  const [batchCode, setBatchCode] = useState("");
  const [form, setForm] = useState("Whole Root Bark");
  const [supplier, setSupplier] = useState("");
  const [ibogainePct, setIbogainePct] = useState("");
  const [alkPct, setAlkPct] = useState("");
  const [coaLab, setCoaLab] = useState("");
  const [coaDate, setCoaDate] = useState("");
  const [quantityG, setQuantityG] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [heavyMetals, setHeavyMetals] = useState<boolean | null>(null);
  const [microbial, setMicrobial] = useState<boolean | null>(null);
  const [pesticides, setPesticides] = useState<boolean | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function triBtn(val: boolean | null, target: boolean): React.CSSProperties {
    const active = val === target;
    return {
      padding: "7px 16px", borderRadius: 7, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
      border: active ? "none" : "0.5px solid rgba(0,0,0,0.15)",
      background: active ? (target ? "#1C2B1E" : "#A32D2D") : "#fff",
      color: active ? "#F5F0E8" : "#6B6B67",
    };
  }

  async function save() {
    if (!batchCode) { setError("Batch code required"); return; }
    setSaving(true); setError(null);
    const qty = parseFloat(quantityG) || null;
    const { error: err } = await supabase.from("medicine_batches").insert({
      batch_code: batchCode, medicine_form: form, supplier: supplier || null,
      ibogaine_pct: ibogainePct ? parseFloat(ibogainePct) : null,
      total_alkaloids_pct: alkPct ? parseFloat(alkPct) : null,
      coa_lab: coaLab || null, coa_date: coaDate || null,
      received_date: receivedDate || null, quantity_g: qty, quantity_remaining_g: qty,
      heavy_metals_pass: heavyMetals, microbial_pass: microbial, pesticides_pass: pesticides,
      notes: notes || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={modal}>
        <div style={{ padding: "1.25rem 1.5rem", borderBottom: "0.5px solid rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.07em", color: "#9E9E9A", margin: "0 0 2px" }}>Medicine</p>
            <h2 style={{ fontFamily: "var(--font-display, serif)", fontSize: 22, fontWeight: 400, margin: 0 }}>New batch</h2>
          </div>
          <button onClick={onCancel} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9E9E9A" }}>&times;</button>
        </div>

        <div style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Batch code *</label><input value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="e.g. VK-2026-04-A" style={fieldStyle} /></div>
            <div><label style={labelStyle}>Medicine form</label><select value={form} onChange={(e) => setForm(e.target.value)} style={fieldStyle}>{MEDICINE_FORMS.map((f) => <option key={f}>{f}</option>)}</select></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Ibogaine % (COA)</label><input type="number" step="0.01" value={ibogainePct} onChange={(e) => setIbogainePct(e.target.value)} placeholder="e.g. 2.4" style={fieldStyle} /></div>
            <div><label style={labelStyle}>Total alkaloids %</label><input type="number" step="0.01" value={alkPct} onChange={(e) => setAlkPct(e.target.value)} placeholder="e.g. 6.1" style={fieldStyle} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>COA lab</label><input value={coaLab} onChange={(e) => setCoaLab(e.target.value)} placeholder="Lab name" style={fieldStyle} /></div>
            <div><label style={labelStyle}>COA date</label><input type="date" value={coaDate} onChange={(e) => setCoaDate(e.target.value)} style={fieldStyle} /></div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Quantity received (g)</label><input type="number" value={quantityG} onChange={(e) => setQuantityG(e.target.value)} placeholder="e.g. 500" style={fieldStyle} /></div>
            <div><label style={labelStyle}>Supplier</label><input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Source" style={fieldStyle} /></div>
            <div><label style={labelStyle}>Received date</label><input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} style={fieldStyle} /></div>
          </div>

          <div>
            <label style={{ ...labelStyle, marginBottom: 10 }}>Safety testing — COA results</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                { label: "Heavy metals", val: heavyMetals, set: setHeavyMetals },
                { label: "Microbial", val: microbial, set: setMicrobial },
                { label: "Pesticides", val: pesticides, set: setPesticides },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <p style={{ fontSize: 12, color: "#9E9E9A", marginBottom: 6 }}>{label}</p>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => set(true)} style={triBtn(val, true)}>Pass</button>
                    <button onClick={() => set(false)} style={triBtn(val, false)}>Fail</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div><label style={labelStyle}>Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Storage conditions, provenance, observations..." style={{ ...fieldStyle, resize: "vertical" }} /></div>

          {error && <p style={{ color: "#A32D2D", fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button onClick={onCancel} style={{ padding: "10px 20px", borderRadius: 7, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: "#6B6B67", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: "10px 24px", borderRadius: 7, border: "none", background: saving ? "#8B8070" : "#1C2B1E", color: "#F5F0E8", fontSize: 13, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>
              {saving ? "Saving..." : "Save batch"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
