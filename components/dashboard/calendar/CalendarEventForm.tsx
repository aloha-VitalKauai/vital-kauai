"use client";

import { useState } from "react";
import {
  CALENDAR_CATEGORIES,
  CATEGORY_META,
  type CalendarEvent,
  type CalendarEventInput,
  type JourneyDay,
} from "@/lib/calendar/types";

// Add/edit modal for a single itinerary block. Used inside the day drawer, so
// it receives that day's active journeys (an event must belong to one) and the
// day's date as the default. Posts to /api/admin/calendar/events (create) or
// PATCHes /events/[id] (edit).
function addHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const next = Math.min(h + 1, 23);
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function CalendarEventForm({
  date,
  journeys,
  existing,
  defaultStartTime,
  onSaved,
  onCancel,
}: {
  date: string;
  journeys: JourneyDay[];
  existing?: CalendarEvent;
  defaultStartTime?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const initialStart = (existing?.start_time ?? defaultStartTime ?? "09:00").slice(
    0,
    5,
  );
  const [journeyId, setJourneyId] = useState(
    existing?.journey_id ?? journeys[0]?.journey.id ?? "",
  );
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "yoga");
  const [eventDate, setEventDate] = useState(existing?.event_date ?? date);
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(
    (existing?.end_time ?? addHour(initialStart)).slice(0, 5),
  );
  const [location, setLocation] = useState(existing?.location ?? "");
  const [assignedTo, setAssignedTo] = useState(existing?.assigned_to ?? "");
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!journeyId) {
      setErr("Pick which client this block belongs to.");
      return;
    }
    if (!title.trim()) {
      setErr("Title is required.");
      return;
    }
    if (endTime < startTime) {
      setErr("End time must be on or after start time.");
      return;
    }

    setSaving(true);
    setErr("");

    const payload: Partial<CalendarEventInput> = {
      journey_id: journeyId,
      title: title.trim(),
      category,
      event_date: eventDate,
      start_time: startTime,
      end_time: endTime,
      location: location.trim() || null,
      assigned_to: assignedTo.trim() || null,
      is_private: isPrivate,
      notes: notes.trim() || null,
    };

    try {
      const res = existing
        ? await fetch(`/api/admin/calendar/events/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/calendar/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(
          body.details?.join(", ") || body.error || "Could not save the event.",
        );
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setErr("Network error — please try again.");
      setSaving(false);
    }
  }

  return (
    <ModalShell title={existing ? "Edit block" : "Add block"} onCancel={onCancel}>
      <Field label="Client">
        <select
          value={journeyId}
          onChange={(e) => setJourneyId(e.target.value)}
          style={inputStyle}
        >
          {journeys.length === 0 && <option value="">No client scheduled</option>}
          {journeys.map((jd) => (
            <option key={jd.journey.id} value={jd.journey.id}>
              {jd.journey.display_name} · Day {jd.dayNumber} of {jd.totalDays}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Morning yoga, Ceremony, Nurse check-in…"
          style={inputStyle}
          autoFocus
        />
      </Field>

      <Field label="Category">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={inputStyle}
        >
          {CALENDAR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_META[c].label}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Date" style={{ flex: 1 }}>
          <input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Start" style={{ width: 110 }}>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="End" style={{ width: 110 }}>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Assigned to" style={{ flex: 1 }}>
          <input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            placeholder="Guide, nurse, sitter…"
            style={inputStyle}
          />
        </Field>
        <Field label="Location" style={{ flex: 1 }}>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Hale, beach, clinic…"
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: "#3d3d3a",
          fontFamily: "var(--font-body, sans-serif)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />
        Private — internal coverage only, not shown to the client
      </label>

      {err && <p style={errStyle}>{err}</p>}

      <div style={footerStyle}>
        <button type="button" onClick={onCancel} style={ghostButtonStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={primaryButtonStyle}
        >
          {saving ? "Saving…" : existing ? "Save changes" : "Add block"}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Shared modal pieces (kept local to the calendar feature) ────────────────

export function ModalShell({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,12,10,0.45)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "5vh 1rem",
        zIndex: 60,
        overflowY: "auto",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          width: "100%",
          maxWidth: 480,
          padding: "1.5rem",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            color: "#1A1A18",
            fontFamily: "var(--font-display, serif)",
          }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, ...style }}>
      <span
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "#6B6B67",
          fontFamily: "var(--font-body, sans-serif)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  width: "100%",
  fontSize: 14,
  padding: "8px 10px",
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 8,
  background: "#FAFAF8",
  color: "#1A1A18",
  fontFamily: "var(--font-body, sans-serif)",
  boxSizing: "border-box",
};

export const footerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 4,
};

export const primaryButtonStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  padding: "8px 16px",
  background: "#0E0C0A",
  color: "#F0EBE0",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-body, sans-serif)",
};

export const ghostButtonStyle: React.CSSProperties = {
  fontSize: 13,
  padding: "8px 16px",
  background: "none",
  color: "#3d3d3a",
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "var(--font-body, sans-serif)",
};

export const errStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: "#A32D2D",
  fontFamily: "var(--font-body, sans-serif)",
};
