"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import MemberFinancialSection from "./MemberFinancialSection";
/* Integration Specialist options come from the integration_specialists
   table via the `specialists` prop. Same source as /dashboard/integration
   and the portal card — one source of truth. */

/* ── Status colours (same as dashboard) ────────────────────────── */
const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  "Signed — Awaiting Intake": { bg: "#E6F1FB", text: "#0C447C", dot: "#378ADD" },
  "Intake Complete": { bg: "#EAF3DE", text: "#27500A", dot: "#639922" },
  "Ceremony Scheduled": { bg: "#FAEEDA", text: "#633806", dot: "#EF9F27" },
  "Ceremony Complete": { bg: "#E1F5EE", text: "#085041", dot: "#1D9E75" },
  "Integration Phase": { bg: "#EEEDFE", text: "#3C3489", dot: "#7F77DD" },
  Alumni: { bg: "#F1EFE8", text: "#444441", dot: "#888780" },
};
const fallbackColor = { bg: "#F1EFE8", text: "#444441", dot: "#888780" };
const STATUSES = Object.keys(STATUS_COLORS);

/* ── Types ─────────────────────────────────────────────────────── */
type Member = Record<string, any>;
type Profile = Record<string, any> | null;
type Intake = Record<string, any> | null;
type Document = Record<string, any>;
type Ceremony = Record<string, any>;
type ChecklistItem = Record<string, any>;

/* ── Helpers ───────────────────────────────────────────────────── */
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

/* ── Shared style constants ────────────────────────────────────── */
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

const INPUT: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "0.5px solid rgba(0,0,0,0.15)",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "var(--font-body, sans-serif)",
  color: "#1A1A18",
  background: "#fff",
  outline: "none",
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' fill='none' stroke='%236B6B67' stroke-width='1.5'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 30,
};

const TEXTAREA: React.CSSProperties = {
  ...INPUT,
  minHeight: 80,
  resize: "vertical" as const,
};

/* ── Component ─────────────────────────────────────────────────── */
type Commitment = { id: string; expected_amount_cents: number; status: string; journey_id?: string | null | undefined; kind?: string | null | undefined } | null;
type PaymentToken = { token: string; expires_at: string; consumed_at: string | null; created_at: string };
type DonationRow = { id: string; amount_cents: number; completed_at: string | null; kind: string; metadata: Record<string, unknown> | null };

export default function MemberProfileEditor({
  member,
  profile,
  intake,
  documents,
  ceremonies,
  checklist,
  preProgress,
  postProgress,
  commitment,
  collectedCents = 0,
  tokens = [],
  tokenAmounts = {},
  donations = [],
  journeyTitle = null,
  journeyEndAt = null,
  specialists = [],
}: {
  member: Member;
  profile: Profile;
  intake: Intake;
  documents: Document[];
  ceremonies: Ceremony[];
  checklist: ChecklistItem[];
  preProgress: any;
  postProgress: any;
  commitment?: Commitment;
  collectedCents?: number;
  tokens?: PaymentToken[];
  tokenAmounts?: Record<string, number>;
  donations?: DonationRow[];
  journeyTitle?: string | null;
  journeyEndAt?: string | null;
  specialists?: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  /* Editable member fields */
  const [status, setStatus] = useState(member.status ?? "");
  const [assignedPartner, setAssignedPartner] = useState(member.assigned_partner ?? "");
  const [membershipTier, setMembershipTier] = useState(member.membership_tier ?? "");
  const [programPrice, setProgramPrice] = useState(member.program_price?.toString() ?? "");
  const [costOfService, setCostOfService] = useState(member.cost_of_service?.toString() ?? "");
  const [arrivalDate, setArrivalDate] = useState(member.arrival_date ?? "");
  const [journeyFocus, setJourneyFocus] = useState(member.journey_focus ?? "");
  const [notes, setNotes] = useState(member.notes ?? "");
  const [medicalCleared, setMedicalCleared] = useState(member.medical_cleared ?? false);
  const [portalUnlocked, setPortalUnlocked] = useState(member.portal_unlocked ?? false);
  const [integrationUnlocked, setIntegrationUnlocked] = useState(member.integration_unlocked ?? false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const priceNum = programPrice ? Number(programPrice) : null;
    const { error } = await supabase
      .from("members")
      .update({
        status,
        assigned_partner: assignedPartner || null,
        membership_tier: membershipTier || null,
        program_price: priceNum,
        cost_of_service: costOfService ? Number(costOfService) : null,
        arrival_date: arrivalDate || null,
        journey_focus: journeyFocus || null,
        notes: notes || null,
        medical_cleared: medicalCleared,
        portal_unlocked: portalUnlocked,
        integration_unlocked: integrationUnlocked,
      })
      .eq("id", member.id);

    // Keep the member's active commitment's expected_amount_cents in lockstep
    // with program_price so the Love Exchange page shows one unilateral number.
    // No-ops cleanly if the member has no active commitment yet.
    if (!error && priceNum != null && Number.isFinite(priceNum)) {
      await fetch("/api/payments/sync-program-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          member_id: member.id,
          amount_cents: Math.round(priceNum * 100),
        }),
      }).catch((e) => console.error("sync-program-price failed", e));
    }

    setSaving(false);
    if (!error) {
      setSaved(true);
      startTransition(() => router.refresh());
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const sc = STATUS_COLORS[status] ?? fallbackColor;
  const price = programPrice ? Number(programPrice) : null;
  const cost = costOfService ? Number(costOfService) : null;
  const profit = price != null && cost != null ? price - cost : null;

  return (
    <div style={{ fontFamily: "var(--font-body, sans-serif)" }}>
      {/* Back link + header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <a
          href="/dashboard"
          style={{
            fontSize: 12,
            color: "#6B6B67",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            marginBottom: 12,
          }}
        >
          &larr; Back to overview
        </a>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1
              style={{
                fontFamily: "var(--font-display, serif)",
                fontSize: 32,
                fontWeight: 400,
                letterSpacing: "-0.02em",
                color: "#1A1A18",
                margin: 0,
              }}
            >
              {member.full_name}
            </h1>
            <p style={{ fontSize: 14, color: "#6B6B67", margin: "4px 0 0" }}>{member.email}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: sc.bg,
                color: sc.text,
                fontSize: 13,
                fontWeight: 500,
                padding: "5px 12px",
                borderRadius: 99,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: sc.dot,
                  display: "inline-block",
                  flexShrink: 0,
                }}
              />
              {status || "Unknown"}
            </span>
            <span style={{ fontSize: 12, color: "#9E9E9A" }}>
              Joined {fmtDate(member.created_at)}
            </span>
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: "1.5rem",
        }}
      >
        {[
          { label: "Program price", value: fmt(price, "$") },
          { label: "Cost of service", value: fmt(cost, "$") },
          {
            label: "Profit",
            value: fmt(profit, "$"),
            color: profit == null ? "#9E9E9A" : profit >= 0 ? "#085041" : "#A32D2D",
          },
          { label: "Deposit", value: fmt(profile?.deposit_amount, "$") },
        ].map((c) => (
          <div key={c.label} style={CARD}>
            <p style={LABEL}>{c.label}</p>
            <p
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: c.color ?? "#1A1A18",
                margin: 0,
              }}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Main two‑column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 16,
          marginBottom: "1.5rem",
        }}
      >
        {/* ── Left column: Editable details ─────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Member details card */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Member details</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={LABEL}>Status</label>
                <select style={SELECT} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL}>Assigned partner</label>
                <select
                  style={INPUT}
                  value={
                    assignedPartner && !specialists.includes(assignedPartner)
                      ? "__custom__"
                      : assignedPartner
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") return; // keep current value, user can clear via —
                    setAssignedPartner(v);
                  }}
                >
                  <option value="">— Unassigned —</option>
                  {specialists.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  {assignedPartner && !specialists.includes(assignedPartner) && (
                    <option value="__custom__">{assignedPartner} (legacy)</option>
                  )}
                </select>
              </div>
              <div>
                <label style={LABEL}>Membership tier</label>
                <input
                  style={INPUT}
                  value={membershipTier}
                  onChange={(e) => setMembershipTier(e.target.value)}
                  placeholder="e.g. Premium"
                />
              </div>
              <div>
                <label style={LABEL}>Journey focus</label>
                <input
                  style={INPUT}
                  value={journeyFocus}
                  onChange={(e) => setJourneyFocus(e.target.value)}
                  placeholder="e.g. Personal growth"
                />
              </div>
              <div>
                <label style={LABEL}>Program price ($)</label>
                <input
                  style={INPUT}
                  type="number"
                  value={programPrice}
                  onChange={(e) => setProgramPrice(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={LABEL}>Cost of service ($)</label>
                <input
                  style={INPUT}
                  type="number"
                  value={costOfService}
                  onChange={(e) => setCostOfService(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label style={LABEL}>Ceremony date</label>
                <p style={{ fontSize: 12, color: '#888', margin: '4px 0 0', fontStyle: 'italic' }}>
                  {member.ceremony_date ? fmtDate(member.ceremony_date) : 'Not set'} — manage via Journey Scheduling tab
                </p>
              </div>
              <div>
                <label style={LABEL}>Arrival date</label>
                <input
                  style={INPUT}
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>Toggles</label>
                {[
                  { label: "Medical cleared", checked: medicalCleared, set: setMedicalCleared },
                  { label: "Portal unlocked", checked: portalUnlocked, set: setPortalUnlocked },
                  { label: "Integration unlocked", checked: integrationUnlocked, set: setIntegrationUnlocked },
                ].map((t) => (
                  <label
                    key={t.label}
                    style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#1A1A18", cursor: "pointer" }}
                  >
                    <input
                      type="checkbox"
                      checked={t.checked}
                      onChange={(e) => t.set(e.target.checked)}
                      style={{ accentColor: "#085041" }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Notes card */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Notes</p>
            <textarea
              style={TEXTAREA}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this member..."
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? "#9E9E9A" : "#085041",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 500,
              fontFamily: "var(--font-body, sans-serif)",
              cursor: saving ? "not-allowed" : "pointer",
              width: "100%",
              transition: "background 0.15s",
            }}
          >
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </button>
        </div>

        {/* ── Right column: Read-only data ──────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Document signing status */}
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

            {/* Membership agreement & medical disclaimer from profile */}
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
                  <span style={{ fontSize: 13, color: "#1A1A18" }}>
                    Membership agreement
                    {profile.membership_agreement_signed_at && (
                      <span style={{ color: "#9E9E9A", marginLeft: 8, fontSize: 11 }}>
                        {fmtDate(profile.membership_agreement_signed_at)}
                      </span>
                    )}
                  </span>
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
                  <span style={{ fontSize: 13, color: "#1A1A18" }}>
                    Medical disclaimer
                    {profile.medical_disclaimer_signed_at && (
                      <span style={{ color: "#9E9E9A", marginLeft: 8, fontSize: 11 }}>
                        {fmtDate(profile.medical_disclaimer_signed_at)}
                      </span>
                    )}
                  </span>
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

          {/* Financial records — auto-tracked contributions */}
          <div style={CARD}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <p style={{ ...LABEL, margin: 0 }}>Financial records</p>
              {donations.length > 0 && (
                <a
                  href="#journey-financials"
                  style={{ fontSize: 11, color: "#085041", textDecoration: "none" }}
                >
                  View full ledger →
                </a>
              )}
            </div>

            {donations.length === 0 && !commitment ? (
              <p style={{ fontSize: 13, color: "#9E9E9A" }}>
                No contributions yet
              </p>
            ) : (
              <>
                {/* Totals summary */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: commitment ? "repeat(3, 1fr)" : "1fr",
                    gap: 10,
                    marginBottom: donations.length > 0 ? 14 : 0,
                    padding: "10px 12px",
                    background: "#FAFAF8",
                    borderRadius: 8,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "#6B6B67",
                        margin: "0 0 2px",
                      }}
                    >
                      Total contributed
                    </p>
                    <p
                      style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: "#085041",
                        margin: 0,
                      }}
                    >
                      {fmt(
                        donations.reduce((s, d) => s + d.amount_cents, 0) / 100,
                        "$",
                      )}
                    </p>
                  </div>
                  {commitment && (
                    <>
                      <div>
                        <p
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "#6B6B67",
                            margin: "0 0 2px",
                          }}
                        >
                          Pledged
                        </p>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#1A1A18",
                            margin: 0,
                          }}
                        >
                          {fmt(commitment.expected_amount_cents / 100, "$")}
                        </p>
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: 10,
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: "#6B6B67",
                            margin: "0 0 2px",
                          }}
                        >
                          Remaining
                        </p>
                        <p
                          style={{
                            fontSize: 16,
                            fontWeight: 600,
                            color:
                              commitment.expected_amount_cents -
                                collectedCents >
                              0
                                ? "#B8683D"
                                : "#085041",
                            margin: 0,
                          }}
                        >
                          {fmt(
                            Math.max(
                              commitment.expected_amount_cents -
                                collectedCents,
                              0,
                            ) / 100,
                            "$",
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Contribution list */}
                {donations.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {donations.slice(0, 6).map((d) => {
                      const kindLabel =
                        d.kind === "initial_membership"
                          ? "Initial membership"
                          : d.kind === "journey_contribution"
                            ? "Journey contribution"
                            : d.kind === "additional_gift"
                              ? "Additional gift"
                              : d.kind === "monthly_membership"
                                ? "Monthly membership"
                                : "Contribution";
                      return (
                        <div
                          key={d.id}
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
                            <p
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                color: "#1A1A18",
                                margin: 0,
                              }}
                            >
                              {kindLabel}
                            </p>
                            <p
                              style={{
                                fontSize: 11,
                                color: "#9E9E9A",
                                margin: "2px 0 0",
                              }}
                            >
                              {fmtDate(d.completed_at)}
                            </p>
                          </div>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#085041",
                            }}
                          >
                            {fmt(d.amount_cents / 100, "$")}
                          </span>
                        </div>
                      );
                    })}
                    {donations.length > 6 && (
                      <p
                        style={{
                          fontSize: 11,
                          color: "#9E9E9A",
                          margin: "4px 0 0",
                          textAlign: "center",
                        }}
                      >
                        + {donations.length - 6} more in full ledger below
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Ceremony records */}
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

          {/* Intake form summary */}
          <div style={CARD}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
                gap: 8,
              }}
            >
              <p style={{ ...LABEL, margin: 0 }}>Intake form</p>
              <a
                href="/intake-form"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  color: "#3D5A2E",
                  textDecoration: "none",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                }}
              >
                View full intake form ↗
              </a>
            </div>
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
          </div>

          {/* Preparation checklist */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Preparation checklist</p>
            {checklist.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9E9E9A" }}>No checklist items</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {checklist.map((item) => (
                  <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: item.completed ? "#639922" : "#D4D4D0",
                        display: "inline-block",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: item.completed ? "#1A1A18" : "#6B6B67",
                        textDecoration: item.completed ? "line-through" : "none",
                      }}
                    >
                      {item.item_key.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                    {item.completed_at && (
                      <span style={{ fontSize: 11, color: "#9E9E9A", marginLeft: "auto" }}>
                        {fmtDate(item.completed_at)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Integration Progress */}
      {(preProgress || postProgress) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.5rem" }}>
          {/* Pre-Ceremony */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Pre-ceremony progress</p>
            {preProgress ? (() => {
              const weeks = preProgress.weeks_completed ?? [];
              const pct = Math.round((weeks.length / 6) * 100);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 4, background: "#E1F5EE", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#1D9E75", borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#085041", fontWeight: 500 }}>{weeks.length}/6 weeks</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[0,1,2,3,4,5].map(w => (
                      <span key={w} style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, background: weeks.includes(w) ? "#E1F5EE" : "#FAFAF8", color: weeks.includes(w) ? "#085041" : "#9E9E9A", border: `0.5px solid ${weeks.includes(w) ? "#1D9E75" : "rgba(0,0,0,0.1)"}` }}>
                        {w + 1}
                      </span>
                    ))}
                  </div>
                  {preProgress.last_updated && <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 8 }}>Last active: {fmtDate(preProgress.last_updated)}</p>}
                </>
              );
            })() : <p style={{ fontSize: 13, color: "#9E9E9A" }}>Not started</p>}
          </div>

          {/* Post-Ceremony */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Post-ceremony progress</p>
            {postProgress ? (() => {
              const weeks = postProgress.weeks_completed ?? [];
              const pct = Math.round((weeks.length / 6) * 100);
              return (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 4, background: "#FAEEDA", borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "#C8A96E", borderRadius: 2 }} />
                    </div>
                    <span style={{ fontSize: 12, color: "#633806", fontWeight: 500 }}>{weeks.length}/6 weeks</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[0,1,2,3,4,5].map(w => (
                      <span key={w} style={{ width: 28, height: 28, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 500, background: weeks.includes(w) ? "#FAEEDA" : "#FAFAF8", color: weeks.includes(w) ? "#633806" : "#9E9E9A", border: `0.5px solid ${weeks.includes(w) ? "#C8A96E" : "rgba(0,0,0,0.1)"}` }}>
                        {w + 1}
                      </span>
                    ))}
                  </div>
                  {postProgress.last_updated && <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 8 }}>Last active: {fmtDate(postProgress.last_updated)}</p>}
                </>
              );
            })() : <p style={{ fontSize: 13, color: "#9E9E9A" }}>Not started</p>}
          </div>
        </div>
      )}

      {/* Journey payment — full financial section */}
      <div id="journey-financials" style={{ scrollMarginTop: 80 }} />
      <MemberFinancialSection
        commitment={commitment ? { ...commitment, journey_id: commitment.journey_id ?? null, kind: commitment.kind ?? null } : null}
        collectedCents={collectedCents}
        tokens={tokens}
        tokenAmounts={tokenAmounts}
        donations={donations}
        journeyTitle={journeyTitle}
        journeyEndAt={journeyEndAt}
      />
    </div>
  );
}
