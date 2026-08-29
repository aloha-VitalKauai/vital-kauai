"use client";

import type { TimelineEvent, TimelineCategory } from "./memberTimeline";
import type { JournalSharingConsent } from "@/lib/journal-sharing";

/* ──────────────────────────────────────────────────────────────────
   Reusable, read-only Member Profile sections.

   These are extracted verbatim from the Member Profile Snapshot view so
   each operational tab (Intake, Ceremony, Dosing, Integration, Documents)
   can render the same existing data with no duplicated business logic or
   queries — the profile page loads the data once and passes it in. The
   Snapshot view and the dedicated tabs both render these components. */

/* ── Shared display helpers (match the editor's formatting) ──────── */
const LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B6B67",
  marginBottom: 6,
};

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  padding: "1.25rem",
};

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDatetime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ── Types (only the fields these read-only views render) ────────── */
export type SignedDocument = {
  id: string;
  document_name: string | null;
  document_version?: string | null;
  signed_at: string | null;
};

export type ProfileDocStatus = {
  membership_agreement_signed?: boolean | null;
  membership_agreement_signed_at?: string | null;
  medical_disclaimer_signed?: boolean | null;
  medical_disclaimer_signed_at?: string | null;
  safety_agreement_signed?: boolean | null;
  safety_agreement_signed_at?: string | null;
  deposit_paid?: boolean | null;
  deposit_amount?: number | null;
} | null;

export type CeremonyRecord = {
  id: string;
  ceremony_date: string | null;
  status: string | null;
  medicine_form?: string | null;
  guides_present?: string | null;
  integration_calls?: number | null;
  pre_notes?: string | null;
  ceremony_notes?: string | null;
  post_notes?: string | null;
};

export type IntakeData = {
  phone?: string | null;
  date_of_birth?: string | null;
  emergency_contact?: string | null;
  emergency_phone?: string | null;
  dietary_restrictions?: string | null;
  accommodation_requests?: string | null;
  primary_intention?: string | null;
  what_brings_you_here?: string | null;
  health_history?: string | null;
  current_medications?: string | null;
  psychiatric_history?: string | null;
  substance_history?: string | null;
  submission_date?: string | null;
} | null;

export type Progress = {
  weeks_completed?: number[] | null;
  last_updated?: string | null;
} | null;

export type DosingRecord = {
  id: string;
  administered_at?: string | null;
  member_weight_lbs?: number | null;
  member_weight_kg?: number | null;
  dose_g?: number | null;
  dose_g_per_kg?: number | null;
  protocol_type?: string | null;
  dose_range_label?: string | null;
  qtc_peak?: number | null;
  adverse_events?: string | null;
  medicine_batches?: {
    batch_code?: string | null;
    ibogaine_pct?: number | null;
    total_alkaloids_pct?: number | null;
    medicine_form?: string | null;
  } | null;
  ceremony_records?: {
    ceremony_date?: string | null;
    status?: string | null;
  } | null;
};

/* ── Documents signed ──────────────────────────────────────────── */
export function DocumentsCard({
  documents,
  profile,
}: {
  documents: SignedDocument[];
  profile: ProfileDocStatus;
}) {
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Documents signed</p>
      {documents.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A" }}>No documents signed yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "#FAFAF8",
                borderRadius: 6,
              }}
            >
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1A18", margin: 0 }}>
                  {doc.document_name}
                </p>
                {doc.document_version && (
                  <p style={{ fontSize: 11, color: "#9E9E9A", margin: "2px 0 0" }}>
                    v{doc.document_version}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#085041" }}>
                {fmtDate(doc.signed_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Membership agreement, medical disclaimer, safety agreement — from profile */}
      {profile && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: profile.membership_agreement_signed ? "#639922" : "#D4D4D0",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "#1A1A18", flex: 1 }}>
              Membership agreement
              {profile.membership_agreement_signed_at && (
                <span style={{ color: "#9E9E9A", marginLeft: 8, fontSize: 11 }}>
                  {fmtDate(profile.membership_agreement_signed_at)}
                </span>
              )}
            </span>
            <a
              href="/dashboard/sops/membership-agreement"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "#085041", textDecoration: "none", letterSpacing: "0.04em" }}
            >
              View →
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: profile.medical_disclaimer_signed ? "#639922" : "#D4D4D0",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "#1A1A18", flex: 1 }}>
              Medical disclaimer
              {profile.medical_disclaimer_signed_at && (
                <span style={{ color: "#9E9E9A", marginLeft: 8, fontSize: 11 }}>
                  {fmtDate(profile.medical_disclaimer_signed_at)}
                </span>
              )}
            </span>
            <a
              href="/dashboard/sops/medical-disclaimer"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "#085041", textDecoration: "none", letterSpacing: "0.04em" }}
            >
              View →
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: profile.safety_agreement_signed ? "#639922" : "#D4D4D0",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "#1A1A18", flex: 1 }}>
              Participant safety & informed consent
              {profile.safety_agreement_signed_at && (
                <span style={{ color: "#9E9E9A", marginLeft: 8, fontSize: 11 }}>
                  {fmtDate(profile.safety_agreement_signed_at)}
                </span>
              )}
            </span>
            <a
              href="/dashboard/sops/safety-agreement"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11, color: "#085041", textDecoration: "none", letterSpacing: "0.04em" }}
            >
              View →
            </a>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: profile.deposit_paid ? "#639922" : "#D4D4D0",
                display: "inline-block",
              }}
            />
            <span style={{ fontSize: 13, color: "#1A1A18" }}>
              Deposit paid
              {profile.deposit_paid && profile.deposit_amount && (
                <span style={{ color: "#9E9E9A", marginLeft: 8, fontSize: 11 }}>
                  {fmt(profile.deposit_amount, "$")}
                </span>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Ceremony records ──────────────────────────────────────────── */
export function CeremonyRecordsCard({ ceremonies }: { ceremonies: CeremonyRecord[] }) {
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Ceremony records</p>
      {ceremonies.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A" }}>No ceremony records yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ceremonies.map((cer) => (
            <div
              key={cer.id}
              style={{
                padding: "12px",
                background: "#FAFAF8",
                borderRadius: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18" }}>
                  {fmtDate(cer.ceremony_date)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 99,
                    background: cer.status === "Complete" ? "#E1F5EE" : "#FAEEDA",
                    color: cer.status === "Complete" ? "#085041" : "#633806",
                    fontWeight: 500,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  {cer.status}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
                <div>
                  <span style={{ color: "#6B6B67" }}>Medicine: </span>
                  <span style={{ color: "#1A1A18" }}>{cer.medicine_form ?? "—"}</span>
                </div>
                <div>
                  <span style={{ color: "#6B6B67" }}>Guides: </span>
                  <span style={{ color: "#1A1A18" }}>{cer.guides_present ?? "—"}</span>
                </div>
                <div>
                  <span style={{ color: "#6B6B67" }}>Integration calls: </span>
                  <span style={{ color: "#1A1A18" }}>{cer.integration_calls ?? 0}</span>
                </div>
              </div>
              {(cer.pre_notes || cer.ceremony_notes || cer.post_notes) && (
                <div style={{ marginTop: 8, fontSize: 13 }}>
                  {cer.pre_notes && (
                    <p style={{ color: "#1A1A18", margin: "4px 0" }}>
                      <span style={{ color: "#6B6B67" }}>Pre: </span>
                      {cer.pre_notes}
                    </p>
                  )}
                  {cer.ceremony_notes && (
                    <p style={{ color: "#1A1A18", margin: "4px 0" }}>
                      <span style={{ color: "#6B6B67" }}>During: </span>
                      {cer.ceremony_notes}
                    </p>
                  )}
                  {cer.post_notes && (
                    <p style={{ color: "#1A1A18", margin: "4px 0" }}>
                      <span style={{ color: "#6B6B67" }}>Post: </span>
                      {cer.post_notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Intake form summary ───────────────────────────────────────── */
export function IntakeCard({
  intake,
  memberId,
  consent,
}: {
  intake: IntakeData;
  memberId: string;
  consent?: JournalSharingConsent;
}) {
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Intake form</p>
      {/* Sharing consent sits above the intake details, and renders even with
          no intake on file, because it governs whether the care team may read
          this member's reflections at all. */}
      {consent && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 12px",
            background: consent.consented ? "rgba(61,90,46,0.06)" : "rgba(0,0,0,0.03)",
            borderLeft: `2px solid ${consent.consented ? "#3D5A2E" : "#C8A96E"}`,
          }}
        >
          <p style={{ fontSize: 11, color: "#6B6B67", margin: "0 0 3px" }}>
            Journal &amp; reflection sharing
          </p>
          <p style={{ fontSize: 13, color: "#1A1A18", margin: 0, fontWeight: 500 }}>
            {consent.label}
          </p>
        </div>
      )}
      {!intake ? (
        <p style={{ fontSize: 13, color: "#9E9E9A" }}>No intake form submitted</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13 }}>
          {[
            { label: "Phone", value: intake.phone },
            { label: "Date of birth", value: fmtDate(intake.date_of_birth) },
            { label: "Emergency contact", value: intake.emergency_contact },
            { label: "Emergency phone", value: intake.emergency_phone },
            { label: "Dietary restrictions", value: intake.dietary_restrictions },
            { label: "Accommodation", value: intake.accommodation_requests },
          ].map((f) => (
            <div key={f.label}>
              <p style={{ color: "#6B6B67", margin: "0 0 2px" }}>{f.label}</p>
              <p style={{ color: f.value ? "#1A1A18" : "#9E9E9A", margin: 0 }}>{f.value || "—"}</p>
            </div>
          ))}
          {[
            { label: "Primary intention", value: intake.primary_intention },
            { label: "What brings you here", value: intake.what_brings_you_here },
            { label: "Health history", value: intake.health_history },
            { label: "Current medications", value: intake.current_medications },
            { label: "Psychiatric history", value: intake.psychiatric_history },
            { label: "Substance history", value: intake.substance_history },
          ].map((f) => (
            <div key={f.label} style={{ gridColumn: "1 / -1" }}>
              <p style={{ color: "#6B6B67", margin: "0 0 2px" }}>{f.label}</p>
              <p
                style={{
                  color: f.value ? "#1A1A18" : "#9E9E9A",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                }}
              >
                {f.value || "—"}
              </p>
            </div>
          ))}
          <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#9E9E9A", marginTop: 4 }}>
            Submitted {fmtDatetime(intake.submission_date)}
          </div>
        </div>
      )}
      {intake && (
        <a
          href={`/dashboard/${memberId}/intake`}
          style={{
            display: "inline-block",
            marginTop: 16,
            fontSize: 12,
            fontWeight: 500,
            color: "#3D5A2E",
            textDecoration: "none",
            borderTop: "0.5px solid rgba(0,0,0,0.08)",
            paddingTop: 12,
            width: "100%",
          }}
        >
          Review their full intake →
        </a>
      )}
    </div>
  );
}

/* ── Integration progress (pre / post ceremony) ────────────────── */
export function IntegrationProgressCards({
  preProgress,
  postProgress,
  onWeekSelect,
}: {
  preProgress: Progress;
  postProgress: Progress;
  // When provided, every week circle (completed or not) becomes a button
  // that opens the member's read-only journal for that phase + week.
  onWeekSelect?: (phase: "pre" | "post", weekIdx: number) => void;
}) {
  // Both cards always render. A missing progress row normalizes to an empty
  // 0/6 display (no completed weeks, no Last active date) rather than hiding
  // the card, so founders can open the read-only journal for every member —
  // the prompts live in lib/journal-prompts and never depend on a DB row.
  // Phase-specific palette; everything else is shared between the two cards.
  const PHASES = [
    { phase: "pre" as const, progress: preProgress, label: "Pre-ceremony progress", viewer: "Pre-Ceremony", bar: "#E1F5EE", fill: "#1D9E75", count: "#085041", doneBg: "#E1F5EE", doneText: "#085041", doneBorder: "#1D9E75" },
    { phase: "post" as const, progress: postProgress, label: "Post-ceremony progress", viewer: "Post-Ceremony", bar: "#FAEEDA", fill: "#C8A96E", count: "#633806", doneBg: "#FAEEDA", doneText: "#633806", doneBorder: "#C8A96E" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.5rem" }}>
      {PHASES.map(p => {
        const weeks = p.progress?.weeks_completed ?? [];
        const pct = Math.round((weeks.length / 6) * 100);
        return (
          <div key={p.phase} style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>{p.label}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, height: 4, background: p.bar, borderRadius: 2 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: p.fill, borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 12, color: p.count, fontWeight: 500 }}>{weeks.length}/6 weeks</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[0,1,2,3,4,5].map(w => {
                const done = weeks.includes(w);
                const style: React.CSSProperties = { width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, background: done ? p.doneBg : "#FAFAF8", color: done ? p.doneText : "#9E9E9A", border: `0.5px solid ${done ? p.doneBorder : "rgba(0,0,0,0.1)"}` };
                return onWeekSelect ? (
                  <button key={w} type="button" aria-label={`View ${p.viewer} Week ${w + 1} journal entries`} onClick={() => onWeekSelect(p.phase, w)} style={{ ...style, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>
                    {w + 1}
                  </button>
                ) : (
                  <span key={w} style={style}>{w + 1}</span>
                );
              })}
            </div>
            {p.progress?.last_updated && <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 8 }}>Last active: {fmtDate(p.progress.last_updated)}</p>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Financial records (auto-tracked contributions) ────────────────
   Donations/contributions summary plus pledged / remaining totals.
   Relocated verbatim from the Snapshot view into the Financials tab; the
   "View full ledger →" link targets the #journey-financials anchor, which
   the Financials tab renders alongside this card. No payment or commitment
   logic is changed. */
export type FinancialDonation = {
  id: string;
  amount_cents: number;
  completed_at: string | null;
  kind: string;
};

/* Dosing history — read-only per-member card. Logging/editing/deleting and
   batch inventory stay in /dashboard/dosing. */
const RANGE_COLORS: Record<string, { bg: string; color: string }> = {
  "Consultation dose": { bg: "#EAF3DE", color: "#3B6D11" },
  "Sub-flood / microdose": { bg: "#E6F1FB", color: "#0C447C" },
  "Booster / integration": { bg: "#C0DD97", color: "#27500A" },
  "Standard flood": { bg: "#B5D4F4", color: "#185FA5" },
  "Deep flood": { bg: "#FAC775", color: "#633806" },
  "Extended / intensive": { bg: "#F7C1C1", color: "#A32D2D" },
  "Not recorded": { bg: "#F1EFE8", color: "#8B8070" },
};

export function DosingCard({ records }: { records: DosingRecord[] }) {
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Dosing records</p>
      {records.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A" }}>No dosing records yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {records.map((r) => {
            const range = r.dose_range_label ?? "Not recorded";
            const rc = RANGE_COLORS[range] ?? RANGE_COLORS["Not recorded"];
            const date = r.ceremony_records?.ceremony_date ?? r.administered_at;
            const qtcFlag = (r.qtc_peak ?? 0) > 500;
            const qtcWarn = (r.qtc_peak ?? 0) >= 450 && (r.qtc_peak ?? 0) <= 500;
            return (
              <div key={r.id} style={{ padding: "12px", background: "#FAFAF8", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18" }}>{fmtDate(date)}</span>
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, fontWeight: 500, background: rc.bg, color: rc.color, whiteSpace: "nowrap" }}>{range}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "#6B6B67" }}>Dose: </span>
                    <span style={{ color: "#1A1A18", fontWeight: 500 }}>{r.dose_g != null ? `${r.dose_g} g` : "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B6B67" }}>g/kg: </span>
                    <span style={{ color: "#1A1A18" }}>{r.dose_g_per_kg ?? "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B6B67" }}>Protocol: </span>
                    <span style={{ color: "#1A1A18" }}>{r.protocol_type ?? "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B6B67" }}>Weight: </span>
                    <span style={{ color: "#1A1A18" }}>{r.member_weight_lbs ? `${r.member_weight_lbs} lbs` : "—"}</span>
                  </div>
                  <div>
                    <span style={{ color: "#6B6B67" }}>Medicine: </span>
                    <span style={{ color: "#1A1A18" }}>
                      {r.medicine_batches?.batch_code ?? "—"}
                      {r.medicine_batches?.medicine_form ? ` · ${r.medicine_batches.medicine_form}` : ""}
                      {r.medicine_batches?.ibogaine_pct != null ? ` · ${r.medicine_batches.ibogaine_pct}% ibogaine` : ""}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#6B6B67" }}>QTc peak: </span>
                    {r.qtc_peak ? (
                      <span style={{ fontWeight: 500, color: qtcFlag ? "#A32D2D" : qtcWarn ? "#BA7517" : "#1A1A18" }}>
                        {r.qtc_peak} ms{qtcFlag ? " ⚠" : qtcWarn ? " ↑" : ""}
                      </span>
                    ) : (
                      <span style={{ color: "#9E9E9A" }}>—</span>
                    )}
                  </div>
                </div>
                {r.adverse_events && (
                  <p style={{ marginTop: 8, fontSize: 13, color: "#A32D2D" }}>
                    <span style={{ color: "#6B6B67" }}>Adverse events: </span>
                    {r.adverse_events}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Member Journey Timeline (read-only V1) ────────────────────────
   Renders the aggregated events from buildMemberTimeline() in reverse
   chronological order. Pure presentation — the profile computes the
   events and passes them in. */
const TIMELINE_DOT: Record<TimelineCategory, string> = {
  lifecycle: "#6B6B67",
  intake: "#639922",
  documents: "#3C3489",
  medical: "#A32D2D",
  financial: "#085041",
  ceremony: "#B8683D",
  dosing: "#633806",
  integration: "#1D9E75",
};

function fmtLongDate(d: string) {
  // Date-only values (YYYY-MM-DD — e.g. arrival/ceremony/departure dates) parse
  // as UTC midnight, which renders a day early in Americas timezones. Pin them
  // to local midnight so the timeline shows the intended calendar day.
  const local = /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d;
  return new Date(local).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function TimelineCard({ events }: { events: TimelineEvent[] }) {
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 16 }}>Journey timeline</p>
      {events.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A" }}>No timeline events yet</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {events.map((e, i) => {
            const dot = TIMELINE_DOT[e.category] ?? "#9E9E9A";
            const last = i === events.length - 1;
            return (
              <div key={e.id} style={{ display: "flex", gap: 14 }}>
                {/* Date */}
                <div style={{ width: 112, flexShrink: 0, textAlign: "right", paddingTop: 1 }}>
                  <span style={{ fontSize: 12, color: "#6B6B67" }}>{fmtLongDate(e.date)}</span>
                </div>
                {/* Rail: dot + connecting line */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: "50%",
                      background: dot,
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  {!last && (
                    <span style={{ width: 1, flex: 1, background: "rgba(0,0,0,0.1)", minHeight: 18 }} />
                  )}
                </div>
                {/* Content */}
                <div style={{ paddingBottom: last ? 0 : 18, flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18", margin: 0 }}>{e.title}</p>
                  {e.description && (
                    <p style={{ fontSize: 12, color: "#6B6B67", margin: "2px 0 0" }}>{e.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
