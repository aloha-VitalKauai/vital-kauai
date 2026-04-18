"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PayoutRole, ExpenseScope } from "@/lib/financials/types";
import {
  MODAL_BACKDROP,
  MODAL,
  MODAL_ACTIONS,
  LABEL,
  INPUT,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  ERROR_TEXT,
} from "./styles";

const ROLES: PayoutRole[] = [
  "guide",
  "founder",
  "partner",
  "vendor",
  "contractor",
  "other",
];

export default function AddPayoutModal({
  open,
  onClose,
  cohorts,
  journeys,
}: {
  open: boolean;
  onClose: () => void;
  cohorts: { id: string; title: string }[];
  journeys: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [scope, setScope] = useState<ExpenseScope>("cohort");
  const [journeyId, setJourneyId] = useState("");
  const [cohortId, setCohortId] = useState("");
  const [payeeName, setPayeeName] = useState("");
  const [payeeEmail, setPayeeEmail] = useState("");
  const [role, setRole] = useState<PayoutRole>("guide");
  const [dollars, setDollars] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    const cents = Math.round(parseFloat(dollars) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErr("Enter a positive amount.");
      return;
    }
    if (!payeeName.trim()) {
      setErr("Payee name required.");
      return;
    }
    if (scope === "cohort" && !cohortId) {
      setErr("Pick a cohort.");
      return;
    }
    if (scope === "journey" && !journeyId) {
      setErr("Pick a journey.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        journey_id: scope === "journey" ? journeyId : null,
        cohort_id: scope === "cohort" ? cohortId : null,
        payee_name: payeeName,
        payee_email: payeeEmail || null,
        role,
        amount_cents: cents,
        due_date: dueDate || null,
        notes: notes || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "unknown" }));
      setErr(error);
      return;
    }
    onClose();
    router.refresh();
  }

  if (!open) return null;

  return (
    <div style={MODAL_BACKDROP} onClick={onClose}>
      <div style={MODAL} onClick={(e) => e.stopPropagation()}>
        <h2
          style={{
            fontFamily: "var(--font-display, serif)",
            fontSize: 20,
            fontWeight: 400,
            marginTop: 0,
            marginBottom: "1rem",
            color: "#1A1A18",
          }}
        >
          Add Payout
        </h2>

        <label style={LABEL}>
          Scope
          <select
            style={INPUT}
            value={scope}
            onChange={(e) => setScope(e.target.value as ExpenseScope)}
          >
            <option value="cohort">Cohort</option>
            <option value="journey">Journey</option>
            <option value="overhead">Overhead</option>
          </select>
        </label>

        {scope === "cohort" && (
          <label style={LABEL}>
            Cohort
            <select
              style={INPUT}
              value={cohortId}
              onChange={(e) => setCohortId(e.target.value)}
            >
              <option value="">— Select —</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {scope === "journey" && (
          <label style={LABEL}>
            Journey
            <select
              style={INPUT}
              value={journeyId}
              onChange={(e) => setJourneyId(e.target.value)}
            >
              <option value="">— Select —</option>
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={LABEL}>
          Payee name
          <input
            style={INPUT}
            value={payeeName}
            onChange={(e) => setPayeeName(e.target.value)}
          />
        </label>

        <label style={LABEL}>
          Payee email (optional)
          <input
            type="email"
            style={INPUT}
            value={payeeEmail}
            onChange={(e) => setPayeeEmail(e.target.value)}
          />
        </label>

        <label style={LABEL}>
          Role
          <select
            style={INPUT}
            value={role}
            onChange={(e) => setRole(e.target.value as PayoutRole)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label style={LABEL}>
          Amount (USD)
          <input
            style={INPUT}
            value={dollars}
            onChange={(e) => setDollars(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>

        <label style={LABEL}>
          Due date
          <input
            type="date"
            style={INPUT}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </label>

        <label style={LABEL}>
          Notes
          <textarea
            style={{ ...INPUT, minHeight: 60, fontFamily: "inherit" }}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>

        {err && <p style={ERROR_TEXT}>{err}</p>}

        <div style={MODAL_ACTIONS}>
          <button style={BUTTON_SECONDARY} onClick={onClose}>
            Cancel
          </button>
          <button
            style={{ ...BUTTON_PRIMARY, opacity: saving ? 0.6 : 1 }}
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Payout"}
          </button>
        </div>
      </div>
    </div>
  );
}
