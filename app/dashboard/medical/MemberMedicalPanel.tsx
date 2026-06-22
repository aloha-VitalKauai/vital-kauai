"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* ──────────────────────────────────────────────────────────────────
   Shared single-member medical panel.

   This is the source of truth for how one member's medical readiness is
   rendered and managed. It is consumed in two places:
     • the standalone ops Medical view (app/dashboard/medical) — inside a
       slide-out detail panel, and
     • the Member Profile Medical tab (app/dashboard/[id]).
   Keeping the body and its business logic here means there is exactly one
   medical system, not two. ────────────────────────────────────────── */

/* ── Types ─────────────────────────────────────────────────────── */
export type MedMember = {
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

export type LabDoc = {
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

export const LAB_TYPES = [
  { key: "ekg", label: "EKG / QTc" },
  { key: "thyroid", label: "Thyroid Panel" },
  { key: "liver", label: "Liver Panel" },
  { key: "magnesium", label: "Magnesium" },
  { key: "stress_test", label: "Cardiac Stress Test" },
  { key: "cyp450", label: "CYP450" },
  { key: "cmp", label: "CMP" },
];

/* ── Helpers ───────────────────────────────────────────────────── */
export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

/* ── Contraindications logic ───────────────────────────────────── */
export function getContraindications(m: MedMember) {
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

export function getFlags(m: MedMember) {
  const flags: string[] = [];
  if (!m.intake) flags.push("Intake missing");
  if (!m.cardiac_cleared && m.medical_cleared) flags.push("Cardiac pending");
  if (m.bp_systolic && (m.bp_systolic >= 135 || (m.bp_diastolic ?? 0) >= 85)) flags.push("BP elevated");
  const meds = m.intake?.current_medications?.toLowerCase() ?? "";
  if (meds.includes("bupropion") || meds.includes("wellbutrin")) flags.push("Bupropion interaction");
  if (meds.includes("ssri") || meds.includes("sertraline")) flags.push("SSRI interaction");
  return flags;
}

/* ── Clearance badge ───────────────────────────────────────────── */
export function CkBadge({ ok, warn }: { ok: boolean | null | undefined; warn?: boolean }) {
  if (ok) return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#E1F5EE", color: "#085041", fontSize: 10, fontWeight: 700 }}>✓</span>;
  if (warn) return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#FCEBEB", color: "#A32D2D", fontSize: 11, fontWeight: 700 }}>!</span>;
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "50%", background: "#F1EFE8", color: "#9E9E9A", fontSize: 10 }}>—</span>;
}

/* ──────────────────────────────────────────────────────────────────
   The per-member medical body. Renders the readiness banner, identity &
   contact, vitals, contraindications, history, medications, lab docs, etc.
   The consumer supplies its own surrounding chrome (the ops view wraps it
   in a slide-out panel with an avatar header; the profile tab wraps it in
   a card). Member name/email/status are intentionally NOT repeated here. */
export default function MemberMedicalPanel({ member: m }: { member: MedMember }) {
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
    <>
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
    </>
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
        founder_reviewed_at: new Date().toISOString(),
      })
      .eq("id", docId);
    window.location.reload();
  }

  // memberId is accepted so callers can scope this section to one member and
  // is reserved for member-scoped lab uploads in a future PR.
  void memberId;

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
