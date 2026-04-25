"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  ExpenseCategory,
  ExpenseScope,
} from "@/lib/financials/types";
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

const CATEGORIES: ExpenseCategory[] = [
  "food",
  "lodging",
  "medicine",
  "guide_prep",
  "transportation",
  "facility",
  "supplies",
  "admin",
  "other",
];

export default function AddExpenseModal({
  open,
  onClose,
  cohorts,
  journeys,
  lockedJourney,
  lockedCohort,
}: {
  open: boolean;
  onClose: () => void;
  cohorts: { id: string; title: string }[];
  journeys: { id: string; label: string }[];
  /** When set, the modal is pre-filled to this journey, the scope
   *  dropdown is hidden, and the journey field is read-only. */
  lockedJourney?: { id: string; label: string };
  /** Same idea for cohorts. */
  lockedCohort?: { id: string; title: string };
}) {
  const router = useRouter();
  const initialScope: ExpenseScope = lockedJourney
    ? "journey"
    : lockedCohort
      ? "cohort"
      : "cohort";
  const [scope, setScope] = useState<ExpenseScope>(initialScope);
  const [journeyId, setJourneyId] = useState(lockedJourney?.id ?? "");
  const [cohortId, setCohortId] = useState(lockedCohort?.id ?? "");
  const [category, setCategory] = useState<ExpenseCategory>("supplies");
  const [dollars, setDollars] = useState("");
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [incurredAt, setIncurredAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const locked = !!(lockedJourney || lockedCohort);

  async function submit() {
    setErr(null);
    const cents = Math.round(parseFloat(dollars) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setErr("Enter a positive amount.");
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
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        journey_id: scope === "journey" ? journeyId : null,
        cohort_id: scope === "cohort" ? cohortId : null,
        category,
        amount_cents: cents,
        vendor: vendor || null,
        notes: notes || null,
        incurred_at: incurredAt,
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
          {lockedJourney
            ? `Add Expense — ${lockedJourney.label}`
            : lockedCohort
              ? `Add Expense — ${lockedCohort.title}`
              : "Add Expense"}
        </h2>

        {!locked && (
          <label style={LABEL}>
            Scope
            <select
              style={INPUT}
              value={scope}
              onChange={(e) => setScope(e.target.value as ExpenseScope)}
            >
              <option value="cohort">Cohort</option>
              <option value="journey">Journey</option>
              <option value="overhead">Overhead (no cohort/journey)</option>
            </select>
          </label>
        )}

        {scope === "cohort" && lockedCohort && (
          <label style={LABEL}>
            Cohort
            <div style={{ ...INPUT, background: "#F4EFE5", color: "#1A1A18" }}>
              {lockedCohort.title}
            </div>
          </label>
        )}
        {scope === "cohort" && !lockedCohort && (
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
        {scope === "journey" && lockedJourney && (
          <label style={LABEL}>
            Journey
            <div style={{ ...INPUT, background: "#F4EFE5", color: "#1A1A18" }}>
              {lockedJourney.label}
            </div>
          </label>
        )}
        {scope === "journey" && !lockedJourney && (
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
          Category
          <select
            style={INPUT}
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
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
          Vendor
          <input
            style={INPUT}
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
          />
        </label>

        <label style={LABEL}>
          Date
          <input
            type="date"
            style={INPUT}
            value={incurredAt}
            onChange={(e) => setIncurredAt(e.target.value)}
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
            {saving ? "Saving…" : "Save Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
