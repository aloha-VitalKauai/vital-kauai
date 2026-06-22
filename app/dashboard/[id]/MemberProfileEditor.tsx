"use client";

import { useState, useTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createJourney, rescheduleJourney } from "@/app/actions/journeys";
import MemberFinancialSection from "./MemberFinancialSection";
import BookingStatusSection from "./BookingStatusSection";
import type { Booking } from "@/lib/api/bookings";
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

/* ── Internal profile section tabs ─────────────────────────────────
   The existing profile overview lives under "Snapshot" for now. The
   remaining tabs are placeholders today — Intake, Medical, Ceremony,
   Dosing, Integration, Financials, Documents, and Timeline move into
   this member-centered profile in future PRs. */
const MEMBER_TABS: string[] = [
  "Snapshot",
  "Intake",
  "Medical",
  "Ceremony",
  "Dosing",
  "Integration",
  "Financials",
  "Documents",
  "Timeline",
];

const TAB_PLACEHOLDER: Record<string, string> = {
  Intake: "Intake information will live here in a future PR.",
  Medical: "Medical information will live here in a future PR.",
  Ceremony: "Ceremony information will live here in a future PR.",
  Dosing: "Dosing information will live here in a future PR.",
  Integration: "Integration information will live here in a future PR.",
  Financials: "Financial information will live here in a future PR.",
  Documents: "Documents will live here in a future PR.",
  Timeline: "Timeline will live here in a future PR.",
};

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
  outcomesRows = [],
  bookedCents = null,
  expenseCents = null,
  booking = null,
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
  outcomesRows?: Array<Record<string, any>>;
  bookedCents?: number | null;
  expenseCents?: number | null;
  booking?: Booking | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  /* Active internal section tab (local UI state only). */
  const [activeTab, setActiveTab] = useState("Snapshot");

  /* Editable member fields */
  const [status, setStatus] = useState(member.status ?? "");
  const [assignedPartner, setAssignedPartner] = useState(member.assigned_partner ?? "");
  const [programPrice, setProgramPrice] = useState(member.program_price?.toString() ?? "");
  const [costOfService, setCostOfService] = useState(member.cost_of_service?.toString() ?? "");
  const [arrivalDate, setArrivalDate] = useState(member.arrival_date ?? "");
  const [departureDate, setDepartureDate] = useState(member.departure_date ?? "");
  const [journeyFocus, setJourneyFocus] = useState(member.journey_focus ?? "");

  /* Scheduling: cohort dropdown + individual journey dates */
  type CohortRow = {
    id: string;
    title: string | null;
    start_at: string | null;
    end_at: string | null;
    status: string | null;
  };
  type ActiveJourney = {
    id: string;
    cohort_id: string | null;
    start_at: string | null;
    end_at: string | null;
  };
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [activeJourney, setActiveJourney] = useState<ActiveJourney | null>(null);
  // "" = individual / private journey; otherwise = cohort id
  const [schedCohortId, setSchedCohortId] = useState<string>("");
  const [schedStart, setSchedStart] = useState("");
  const [schedEnd, setSchedEnd] = useState("");
  const [schedSaving, setSchedSaving] = useState(false);
  const [schedMsg, setSchedMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayIso = new Date().toISOString().slice(0, 10);
      const [cohortRes, journeyRes] = await Promise.all([
        supabase
          .from("cohorts")
          .select("id, title, start_at, end_at, status")
          .gte("start_at", todayIso)
          .not("status", "in", "(canceled,closed)")
          .order("start_at", { ascending: true }),
        supabase
          .from("journeys")
          .select("id, cohort_id, start_at, end_at, status")
          .eq("member_id", member.id)
          .not("status", "in", "(canceled,completed)")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const cohortRows = (cohortRes.data ?? []) as CohortRow[];
      setCohorts(cohortRows);
      const j = journeyRes.data as ActiveJourney | null;
      setActiveJourney(j);
      if (j) {
        if (j.cohort_id) {
          // If the journey is linked to a cohort that's no longer in the
          // upcoming-open list (past or closed), still show it as the
          // current selection so we don't silently drop it.
          if (!cohortRows.some((c) => c.id === j.cohort_id)) {
            // pull the linked cohort so the dropdown can render it
            const { data: linked } = await supabase
              .from("cohorts")
              .select("id, title, start_at, end_at, status")
              .eq("id", j.cohort_id)
              .maybeSingle();
            if (linked && !cancelled) setCohorts((prev) => [linked as CohortRow, ...prev]);
          }
          setSchedCohortId(j.cohort_id);
        } else {
          setSchedCohortId("");
          if (j.start_at) setSchedStart(j.start_at.slice(0, 10));
          if (j.end_at) setSchedEnd(j.end_at.slice(0, 10));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, member.id]);

  async function handleSaveScheduling() {
    setSchedSaving(true);
    setSchedMsg(null);

    const isCohort = schedCohortId !== "";

    let payload: Parameters<typeof createJourney>[0];
    if (isCohort) {
      const cohort = cohorts.find((c) => c.id === schedCohortId);
      const start = cohort?.start_at ? cohort.start_at.slice(0, 10) : null;
      const end = cohort?.end_at ? cohort.end_at.slice(0, 10) : null;
      const useRange = !!(start && end && end > start);
      payload = {
        memberId: member.id,
        bookingType: "cohort",
        scheduleType: useRange ? "date_range" : "single_date",
        startDate: start,
        endDate: useRange ? end : null,
        cohortId: schedCohortId,
        notes: null,
      };
    } else {
      if (!schedStart) {
        setSchedSaving(false);
        setSchedMsg({ kind: "err", text: "Enter a start date for the individual journey" });
        return;
      }
      const useRange = !!(schedEnd && schedEnd > schedStart);
      payload = {
        memberId: member.id,
        bookingType: "private",
        scheduleType: useRange ? "date_range" : "single_date",
        startDate: schedStart,
        endDate: useRange ? schedEnd : null,
        cohortId: null,
        notes: null,
      };
    }

    const result = activeJourney
      ? await rescheduleJourney(activeJourney.id, {
          scheduleType: payload.scheduleType!,
          startDate: payload.startDate,
          endDate: payload.endDate,
          cohortId: payload.cohortId,
          notes: null,
        })
      : await createJourney(payload);

    setSchedSaving(false);
    if (!result.ok) {
      setSchedMsg({ kind: "err", text: result.error || "Failed to save" });
      return;
    }
    setSchedMsg({ kind: "ok", text: "Saved" });
    startTransition(() => router.refresh());
    setTimeout(() => setSchedMsg(null), 3000);
  }
  const [notes, setNotes] = useState(member.notes ?? "");
  const [medicalCleared, setMedicalCleared] = useState(member.medical_cleared ?? false);
  const [portalUnlocked, setPortalUnlocked] = useState(member.portal_unlocked ?? false);
  const [integrationUnlocked, setIntegrationUnlocked] = useState(member.integration_unlocked ?? false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [resendingSetup, setResendingSetup] = useState(false);
  const [setupResendMsg, setSetupResendMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleResendSetupLink() {
    if (resendingSetup) return;
    if (!confirm(`Send a fresh password setup link to ${member.email}?`)) return;
    setResendingSetup(true);
    setSetupResendMsg(null);
    try {
      const res = await fetch("/api/resend-setup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ member_id: member.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setSetupResendMsg({ kind: "ok", text: `Setup link sent to ${member.email}` });
    } catch (e: any) {
      setSetupResendMsg({ kind: "err", text: e?.message || "Failed to resend setup link" });
    } finally {
      setResendingSetup(false);
      setTimeout(() => setSetupResendMsg(null), 6000);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const priceNum = programPrice ? Number(programPrice) : null;
    const { error } = await supabase
      .from("members")
      .update({
        status,
        assigned_partner: assignedPartner || null,
        program_price: priceNum,
        cost_of_service: costOfService ? Number(costOfService) : null,
        arrival_date: arrivalDate || null,
        departure_date: departureDate || null,
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
  // Top stat cards mirror the Financials → Private Ceremony row for this
  // member when one exists (booked = sum of commitments / fallback to
  // program_price; expenses = sum of expense_entries logged to the journey).
  // Falls back to the manually-entered members.program_price /
  // cost_of_service for members who don't yet have a private journey.
  const price =
    bookedCents != null ? bookedCents / 100 : programPrice ? Number(programPrice) : null;
  const cost =
    expenseCents != null ? expenseCents / 100 : costOfService ? Number(costOfService) : null;
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
            <p style={{ fontSize: 14, color: "#6B6B67", margin: "4px 0 0" }}>
              {member.email}
              <button
                type="button"
                onClick={handleResendSetupLink}
                disabled={resendingSetup}
                title="Email this member a fresh password-setup link (use if their welcome link expired)"
                style={{
                  marginLeft: 10,
                  padding: "3px 10px",
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  background: "transparent",
                  color: "#6B6B67",
                  border: "1px solid #D9D6CC",
                  borderRadius: 99,
                  cursor: resendingSetup ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {resendingSetup ? "Sending\u2026" : "Resend setup link"}
              </button>
              {setupResendMsg && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: 12,
                    color: setupResendMsg.kind === "ok" ? "#1D9E75" : "#A32D2D",
                  }}
                >
                  {setupResendMsg.text}
                </span>
              )}
            </p>
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

      {/* Internal section tabs */}
      <nav
        style={{
          display: "flex",
          gap: 0,
          overflowX: "auto",
          borderBottom: "0.5px solid rgba(0,0,0,0.1)",
          marginBottom: "1.5rem",
        }}
      >
        {MEMBER_TABS.map((t) => {
          const active = activeTab === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              style={{
                fontSize: 13,
                color: active ? "#1A1A18" : "#6B6B67",
                padding: "10px 16px",
                background: "none",
                border: "none",
                borderBottom: active ? "2px solid #085041" : "2px solid transparent",
                whiteSpace: "nowrap",
                fontWeight: active ? 500 : 400,
                fontFamily: "var(--font-body, sans-serif)",
                flexShrink: 0,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {t}
            </button>
          );
        })}
      </nav>

      {activeTab === "Snapshot" ? (
        <>
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
                <label style={LABEL}>Ceremony scheduling</label>
                <select
                  style={SELECT}
                  value={schedCohortId}
                  onChange={(e) => setSchedCohortId(e.target.value)}
                >
                  <option value="">Individual journey (custom dates)</option>
                  {cohorts.map((c) => {
                    const start = c.start_at ? fmtDate(c.start_at) : "TBD";
                    const end =
                      c.end_at && c.end_at.slice(0, 10) !== (c.start_at ?? "").slice(0, 10)
                        ? ` – ${fmtDate(c.end_at)}`
                        : "";
                    return (
                      <option key={c.id} value={c.id}>
                        {(c.title || "Untitled cohort") + ` · ${start}${end}`}
                      </option>
                    );
                  })}
                </select>
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

              <div>
                {schedCohortId === "" ? (
                  <>
                    <label style={LABEL}>Journey dates</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        style={INPUT}
                        type="date"
                        value={schedStart}
                        onChange={(e) => setSchedStart(e.target.value)}
                        placeholder="Start"
                      />
                      <input
                        style={INPUT}
                        type="date"
                        value={schedEnd}
                        onChange={(e) => setSchedEnd(e.target.value)}
                        placeholder="End (optional)"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <label style={LABEL}>Cohort dates</label>
                    <p style={{ fontSize: 13, color: "#1A1A18", margin: "4px 0 0" }}>
                      {(() => {
                        const c = cohorts.find((x) => x.id === schedCohortId);
                        if (!c) return "—";
                        const s = c.start_at ? fmtDate(c.start_at) : "TBD";
                        const e =
                          c.end_at && c.end_at.slice(0, 10) !== (c.start_at ?? "").slice(0, 10)
                            ? ` – ${fmtDate(c.end_at)}`
                            : "";
                        return s + e;
                      })()}
                    </p>
                  </>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={handleSaveScheduling}
                    disabled={schedSaving}
                    style={{
                      background: schedSaving ? "#9E9E9A" : "#085041",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      fontFamily: "var(--font-body, sans-serif)",
                      cursor: schedSaving ? "not-allowed" : "pointer",
                    }}
                  >
                    {schedSaving
                      ? "Saving…"
                      : activeJourney
                        ? "Update scheduling"
                        : "Save scheduling"}
                  </button>
                  {schedMsg && (
                    <span
                      style={{
                        fontSize: 12,
                        color: schedMsg.kind === "ok" ? "#085041" : "#9b1c1c",
                      }}
                    >
                      {schedMsg.text}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label style={LABEL}>Departure date</label>
                <input
                  style={INPUT}
                  type="date"
                  value={departureDate}
                  onChange={(e) => setDepartureDate(e.target.value)}
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

          {/* Outcomes card hidden while the outcomes experience is being refined.
              Restore by removing the `false &&` guard. */}
          {false && (
          <div style={CARD}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <p style={{ ...LABEL, margin: 0 }}>Outcomes</p>
              {outcomesRows.length > 0 && (
                <a
                  href={`/founders/outcomes/${member.id}`}
                  style={{ fontSize: 11, color: "#085041", textDecoration: "none" }}
                >
                  Full timeline →
                </a>
              )}
            </div>
            {outcomesRows.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9E9E9A" }}>
                Assessment timeline appears here once a ceremony date is set.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {outcomesRows.map((r) => {
                  const sLabel: Record<string, { label: string; bg: string; color: string }> = {
                    locked:    { label: "Locked",     bg: "#F1EFE8", color: "#6B6B67" },
                    available: { label: "Open",       bg: "#FAEEDA", color: "#633806" },
                    overdue:   { label: "Past due",   bg: "#FCEBEB", color: "#A32D2D" },
                    draft:     { label: "In progress", bg: "#EAF3DE", color: "#27500A" },
                    completed: { label: "Completed",  bg: "#E1F5EE", color: "#085041" },
                    closed:    { label: "Closed",     bg: "#F1EFE8", color: "#6B6B67" },
                  };
                  const s = sLabel[r.status] ?? sLabel.locked;
                  return (
                    <div
                      key={`${r.ceremony_id}-${r.timepoint}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "#FAFAF8",
                        borderRadius: 6,
                        opacity: r.status === "locked" || r.status === "closed" ? 0.65 : 1,
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1A18", margin: 0 }}>
                          {r.timepoint_label || (r.timepoint as string).replace(/_/g, " ")}
                        </p>
                        {r.status === "completed" && r.submitted_at && (
                          <p style={{ fontSize: 11, color: "#9E9E9A", margin: "2px 0 0" }}>
                            {fmtDate(r.submitted_at)}
                            {r.phq9_total != null && <> &middot; PHQ-9 {r.phq9_total}</>}
                            {r.gad7_total != null && <> &middot; GAD-7 {r.gad7_total}</>}
                          </p>
                        )}
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 99,
                          background: s.bg,
                          color: s.color,
                          fontWeight: 500,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}

          {/* Intake form summary */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Intake form</p>
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
                href={`/dashboard/${member.id}/intake`}
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

          {/* Preparation checklist — exclude post-ceremony outcome surveys */}
          {(() => {
            const prepItems = checklist.filter((item) => !item.item_key.startsWith("post_"));
            return (
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Preparation checklist</p>
            {prepItems.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9E9E9A" }}>No checklist items</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {prepItems.map((item) => (
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
            );
          })()}
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

      {/* Booking & payment status (Square era) */}
      <div id="booking-status" style={{ scrollMarginTop: 80 }} />
      <BookingStatusSection
        booking={booking}
        memberId={member.id}
        memberName={member.full_name ?? null}
      />

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
        memberName={member.full_name ?? null}
        memberEmail={member.email ?? null}
      />
        </>
      ) : (
        <div style={CARD}>
          <p
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: 18,
              fontWeight: 400,
              color: "#1A1A18",
              margin: "0 0 6px",
            }}
          >
            {activeTab}
          </p>
          <p style={{ fontSize: 14, color: "#6B6B67", margin: 0 }}>
            {TAB_PLACEHOLDER[activeTab]}
          </p>
        </div>
      )}
    </div>
  );
}
