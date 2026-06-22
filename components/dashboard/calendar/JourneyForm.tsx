"use client";

import { useEffect, useState } from "react";
import {
  JOURNEY_STATUSES,
  type ClientJourney,
  type JourneyInput,
} from "@/lib/calendar/types";
import {
  Field,
  ModalShell,
  errStyle,
  footerStyle,
  ghostButtonStyle,
  inputStyle,
  primaryButtonStyle,
} from "./CalendarEventForm";

type ClientOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

// Preset journey colors — the strip shown on each day. Muted, on-palette.
const COLOR_SWATCHES = [
  "#085041",
  "#1c2b1e",
  "#C8842A",
  "#7A6BB0",
  "#3E7E8C",
  "#A32D2D",
  "#6E8B3D",
  "#9A5BA0",
];

// Create/edit modal for a scheduled client journey. A journey may link to an
// existing member (client_id) or stand alone with just a display name. Posts to
// /api/admin/calendar/journeys (create) or PATCHes /journeys/[id] (edit).
export default function JourneyForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: ClientJourney;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(existing?.client_id ?? "");
  const [displayName, setDisplayName] = useState(existing?.display_name ?? "");
  const [startDate, setStartDate] = useState(existing?.start_date ?? "");
  const [endDate, setEndDate] = useState(existing?.end_date ?? "");
  const [status, setStatus] = useState(existing?.status ?? "scheduled");
  const [color, setColor] = useState(existing?.color ?? COLOR_SWATCHES[0]);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/calendar/clients")
      .then((r) => (r.ok ? r.json() : { clients: [] }))
      .then((d) => {
        if (active) setClients(d.clients ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function pickClient(id: string) {
    setClientId(id);
    const found = clients.find((c) => c.id === id);
    // Auto-fill the display name from the member, but only when the field is
    // empty so we never clobber a name the founder already typed.
    if (found?.full_name && !displayName.trim()) setDisplayName(found.full_name);
  }

  async function handleSave() {
    if (!displayName.trim()) {
      setErr("A display name is required.");
      return;
    }
    if (!startDate || !endDate) {
      setErr("Start and end dates are required.");
      return;
    }
    if (endDate < startDate) {
      setErr("End date must be on or after start date.");
      return;
    }

    setSaving(true);
    setErr("");

    const payload: Partial<JourneyInput> = {
      display_name: displayName.trim(),
      start_date: startDate,
      end_date: endDate,
      client_id: clientId || null,
      status,
      color,
      notes: notes.trim() || null,
    };

    try {
      const res = existing
        ? await fetch(`/api/admin/calendar/journeys/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/calendar/journeys", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(
          body.details?.join(", ") ||
            body.error ||
            "Could not save the journey.",
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

  async function handleDelete() {
    if (!existing) return;
    if (
      !window.confirm(
        `Delete ${existing.display_name}'s journey? This removes the stay and all of its scheduled blocks.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/calendar/journeys/${existing.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || "Could not delete the journey.");
        setDeleting(false);
        return;
      }
      onSaved();
    } catch {
      setErr("Network error — please try again.");
      setDeleting(false);
    }
  }

  return (
    <ModalShell
      title={existing ? "Edit journey" : "New client journey"}
      onCancel={onCancel}
    >
      <Field label="Link to member (optional)">
        <select
          value={clientId}
          onChange={(e) => pickClient(e.target.value)}
          style={inputStyle}
        >
          <option value="">Not linked — ad hoc journey</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name || c.email || c.id}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name shown on the calendar"
          style={inputStyle}
        />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Arrival" style={{ flex: 1 }}>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
        <Field label="Departure" style={{ flex: 1 }}>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Status">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={inputStyle}
        >
          {JOURNEY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Color">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {COLOR_SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Color ${c}`}
              style={{
                width: 26,
                height: 26,
                borderRadius: 99,
                background: c,
                cursor: "pointer",
                border:
                  color === c
                    ? "2px solid #1A1A18"
                    : "2px solid transparent",
                outline:
                  color === c ? "1px solid rgba(0,0,0,0.15)" : "none",
              }}
            />
          ))}
        </div>
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Program, focus, anything the ops team should know…"
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      {err && <p style={errStyle}>{err}</p>}

      <div style={{ ...footerStyle, justifyContent: "space-between" }}>
        <div>
          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{ ...ghostButtonStyle, color: "#A32D2D" }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" onClick={onCancel} style={ghostButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={primaryButtonStyle}
          >
            {saving ? "Saving…" : existing ? "Save changes" : "Create journey"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
