"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createJourney, rescheduleJourney } from "@/app/actions/journeys";
import MemberFinancialSection from "./MemberFinancialSection";
import BookingStatusSection from "./BookingStatusSection";
import type { Booking } from "@/lib/api/bookings";
import MemberMedicalPanel, { type MedMember, type LabDoc } from "../medical/MemberMedicalPanel";
import {
  DocumentsCard,
  CeremonyRecordsCard,
  IntakeCard,
  IntegrationProgressCards,
  FinancialRecordsCard,
  TimelineCard,
  type DosingRecord,
  type SignedDocument,
  type CeremonyRecord,
} from "./MemberProfileSections";
import { buildMemberTimeline } from "./memberTimeline";
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
  "Integration",
  "Financials",
  "Documents",
  "Timeline",
];

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
  // Date inputs and selects have wide intrinsic minimums; without this they
  // refuse to shrink and push the card past its grid track.
  minWidth: 0,
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
  labs = [],
  dosing = [],
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
  labs?: LabDoc[];
  dosing?: DosingRecord[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  /* Active internal section tab (local UI state only). */
  const [activeTab, setActiveTab] = useState("Snapshot");

  /* Shape the shared Medical panel expects: this member's medical fields +
     intake + lab documents. Same data/logic as the standalone ops Medical
     view, scoped to the current member. */
  const medMember = { ...member, intake, labs } as MedMember;

  /* Read-only Journey Timeline (V1): aggregate existing timestamps from the
     records already loaded for this member. Pure derivation — no new data. */
  const timeline = useMemo(
    () =>
      buildMemberTimeline({
        member,
        profile,
        intake,
        checklist,
        ceremonies,
        donations,
        tokens,
        labs,
        dosing,
        booking,
        preProgress,
        postProgress,
      }),
    [member, profile, intake, checklist, ceremonies, donations, tokens, labs, dosing, booking, preProgress, postProgress],
  );

  /* Editable member fields */
  const [fullName, setFullName] = useState(member.full_name ?? "");
  const [email, setEmail] = useState(member.email ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
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

    if (!result.ok) {
      setSchedSaving(false);
      setSchedMsg({ kind: "err", text: result.error || "Failed to save" });
      return;
    }

    // Also persist the member's arrival/departure dates from this card, so the
    // single "Update scheduling" action saves them to the profile too (they
    // were previously only saved by the separate "Save changes" button).
    const { error: memberErr } = await supabase
      .from("members")
      .update({
        arrival_date: arrivalDate || null,
        departure_date: departureDate || null,
      })
      .eq("id", member.id);

    setSchedSaving(false);
    if (memberErr) {
      setSchedMsg({ kind: "err", text: "Journey saved, but arrival/departure failed to save" });
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
  const [saveErr, setSaveErr] = useState<string | null>(null);

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
    // Full name and email are NOT NULL on members — guard before saving.
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName) {
      setSaveErr("Full name can't be empty.");
      return;
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setSaveErr("Enter a valid email address.");
      return;
    }
    setSaveErr(null);
    setSaving(true);
    setSaved(false);
    const priceNum = programPrice ? Number(programPrice) : null;
    const { error } = await supabase
      .from("members")
      .update({
        full_name: trimmedName,
        email: trimmedEmail,
        phone: phone.trim() || null,
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
    } else {
      setSaveErr(
        /duplicate|unique/i.test(error.message)
          ? "That email is already in use by another member."
          : error.message,
      );
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Member details card */}
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 16 }}>Member details</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 14 }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LABEL}>Full name</label>
                <input
                  style={INPUT}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Member's full name"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LABEL}>Email</label>
                <input
                  style={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
                <p style={{ fontSize: 11, color: "#9E9E9A", margin: "4px 0 0" }}>
                  Updates this member&rsquo;s contact record. Does not change their portal login email.
                </p>
              </div>
              <div>
                <label style={LABEL}>Phone</label>
                <input
                  style={INPUT}
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(808) 555-0123"
                />
              </div>
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
          {saveErr && (
            <p style={{ fontSize: 13, color: "#9b1c1c", margin: "0 0 -4px" }}>{saveErr}</p>
          )}
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
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* Document signing status */}
          <DocumentsCard documents={documents as SignedDocument[]} profile={profile} />

          {/* Ceremony records */}
          <CeremonyRecordsCard ceremonies={ceremonies as CeremonyRecord[]} />

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
          <IntakeCard intake={intake} memberId={member.id} />

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
      <IntegrationProgressCards preProgress={preProgress} postProgress={postProgress} />
        </>
      ) : activeTab === "Medical" ? (
        <div style={CARD}>
          <MemberMedicalPanel member={medMember} />
        </div>
      ) : activeTab === "Intake" ? (
        <IntakeCard intake={intake} memberId={member.id} />
      ) : activeTab === "Integration" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={CARD}>
            <p style={{ ...LABEL, marginBottom: 12 }}>Integration status</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, fontSize: 13 }}>
              <div>
                <p style={{ color: "#6B6B67", margin: "0 0 2px" }}>Assigned guide</p>
                <p style={{ color: assignedPartner ? "#1A1A18" : "#9E9E9A", margin: 0 }}>{assignedPartner || "—"}</p>
              </div>
              <div>
                <p style={{ color: "#6B6B67", margin: "0 0 2px" }}>Integration access</p>
                <p style={{ color: "#1A1A18", margin: 0 }}>{integrationUnlocked ? "Unlocked" : "Locked"}</p>
              </div>
            </div>
          </div>
          {preProgress || postProgress ? (
            <IntegrationProgressCards preProgress={preProgress} postProgress={postProgress} />
          ) : (
            <div style={CARD}>
              <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>No integration activity yet.</p>
            </div>
          )}
        </div>
      ) : activeTab === "Documents" ? (
        <DocumentsCard documents={documents as SignedDocument[]} profile={profile} />
      ) : activeTab === "Financials" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Financial records — auto-tracked contributions */}
          <FinancialRecordsCard
            donations={donations}
            commitment={commitment ?? null}
            collectedCents={collectedCents}
          />

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
        </div>
      ) : activeTab === "Timeline" ? (
        <TimelineCard events={timeline} />
      ) : null}
    </div>
  );
}
