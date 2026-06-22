"use client";

import { useState } from "react";
import {
  CALENDAR_CATEGORIES,
  CATEGORY_META,
} from "@/lib/calendar/types";
import type { ProtocolTemplateItem } from "@/lib/protocols/types";
import {
  Field,
  ModalShell,
  errStyle,
  footerStyle,
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "@/components/dashboard/calendar/CalendarEventForm";

// Add/edit a single block within a protocol template. Day is shown 1-based
// (Day 1 = arrival) but stored as a 0-based day_offset.
export default function ProtocolItemForm({
  templateId,
  existing,
  defaultDayOffset,
  onSaved,
  onCancel,
}: {
  templateId: string;
  existing?: ProtocolTemplateItem;
  defaultDayOffset?: number;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const initialOffset = existing?.day_offset ?? defaultDayOffset ?? 0;
  const [dayNumber, setDayNumber] = useState(String(initialOffset + 1));
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "yoga");
  const [startTime, setStartTime] = useState(
    (existing?.start_time ?? "09:00").slice(0, 5),
  );
  const [endTime, setEndTime] = useState(
    (existing?.end_time ?? "10:00").slice(0, 5),
  );
  const [location, setLocation] = useState(existing?.location ?? "");
  const [assignedTo, setAssignedTo] = useState(existing?.assigned_to ?? "");
  const [isPrivate, setIsPrivate] = useState(existing?.is_private ?? false);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    const dayNum = parseInt(dayNumber, 10);
    if (!Number.isInteger(dayNum) || dayNum < 1) {
      setErr("Day must be 1 or greater.");
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

    const payload = {
      day_offset: dayNum - 1,
      title: title.trim(),
      category,
      start_time: startTime,
      end_time: endTime,
      location: location.trim() || null,
      assigned_to: assignedTo.trim() || null,
      is_private: isPrivate,
      notes: notes.trim() || null,
    };

    try {
      const res = existing
        ? await fetch(
            `/api/admin/protocols/${templateId}/items/${existing.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            },
          )
        : await fetch(`/api/admin/protocols/${templateId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.details?.join(", ") || body.error || "Could not save.");
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
      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Day" style={{ width: 90 }}>
          <input
            type="number"
            min={1}
            value={dayNumber}
            onChange={(e) => setDayNumber(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Title" style={{ flex: 1 }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Morning yoga, Ceremony…"
            style={inputStyle}
            autoFocus
          />
        </Field>
      </div>

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
        <Field label="Start" style={{ flex: 1 }}>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="End" style={{ flex: 1 }}>
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
        Private — internal coverage only
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
