"use client";

import { useEffect, useState } from "react";
import type { ClientJourney } from "@/lib/calendar/types";
import { isoToLocalDate } from "@/lib/calendar/dates";
import type {
  ApplyMode,
  ApplyResult,
  ProtocolTemplate,
} from "@/lib/protocols/types";
import {
  Field,
  ModalShell,
  errStyle,
  footerStyle,
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "@/components/dashboard/calendar/CalendarEventForm";

function fmt(iso: string): string {
  return isoToLocalDate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Apply a template onto a chosen journey. Generated blocks land on the calendar
// as editable events. "Replace" clears this template's previously-generated
// events on the journey first; "Add" appends.
export default function ApplyProtocolForm({
  template,
  onApplied,
  onCancel,
}: {
  template: ProtocolTemplate;
  onApplied: () => void;
  onCancel: () => void;
}) {
  const [journeys, setJourneys] = useState<ClientJourney[]>([]);
  const [journeyId, setJourneyId] = useState("");
  const [mode, setMode] = useState<ApplyMode>("append");
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<ApplyResult | null>(null);

  useEffect(() => {
    let ignore = false;
    fetch("/api/admin/calendar/journeys")
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .then((d) => {
        if (ignore) return;
        setJourneys(d.journeys ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setErr("Could not load journeys.");
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function handleApply() {
    if (!journeyId) {
      setErr("Pick a journey to apply this protocol to.");
      return;
    }
    setApplying(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/protocols/${template.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey_id: journeyId, mode }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error || "Could not apply the protocol.");
        setApplying(false);
        return;
      }
      setResult(body.result as ApplyResult);
      setApplying(false);
      onApplied();
    } catch {
      setErr("Network error — please try again.");
      setApplying(false);
    }
  }

  return (
    <ModalShell title={`Apply: ${template.name}`} onCancel={onCancel}>
      {result ? (
        <>
          <div
            style={{
              fontSize: 14,
              color: "#1A1A18",
              fontFamily: "var(--font-body, sans-serif)",
              lineHeight: 1.6,
            }}
          >
            <strong>{result.created}</strong> block
            {result.created === 1 ? "" : "s"} added to the calendar.
            {result.removed > 0 && (
              <>
                <br />
                {result.removed} previously-generated block
                {result.removed === 1 ? "" : "s"} replaced.
              </>
            )}
            {result.skipped > 0 && (
              <>
                <br />
                {result.skipped} block{result.skipped === 1 ? "" : "s"} skipped
                (fell past the journey&rsquo;s end date).
              </>
            )}
          </div>
          <div style={footerStyle}>
            <button type="button" onClick={onCancel} style={primaryButtonStyle}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <Field label="Journey">
            <select
              value={journeyId}
              onChange={(e) => setJourneyId(e.target.value)}
              style={inputStyle}
              disabled={loading}
            >
              <option value="">
                {loading ? "Loading…" : "Select a journey…"}
              </option>
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.display_name} · {fmt(j.start_date)}–{fmt(j.end_date)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mode">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ApplyMode)}
              style={inputStyle}
            >
              <option value="append">Add to existing events</option>
              <option value="replace">
                Replace this protocol&rsquo;s prior events
              </option>
            </select>
          </Field>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "#9E9E9A",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            Blocks land on the calendar as normal events you can edit or delete.
            Days past the journey&rsquo;s end are skipped.
          </p>

          {err && <p style={errStyle}>{err}</p>}

          <div style={footerStyle}>
            <button type="button" onClick={onCancel} style={ghostButtonStyle}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={applying}
              style={primaryButtonStyle}
            >
              {applying ? "Applying…" : "Apply protocol"}
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}
