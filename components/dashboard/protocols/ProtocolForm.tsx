"use client";

import { useState } from "react";
import {
  PROTOCOL_KINDS,
  type ProtocolTemplate,
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

// Create/edit the header of a protocol template. Blocks are managed separately
// on the expanded card (they need a template id). On save, onSaved tells the
// parent to refresh.
export default function ProtocolForm({
  existing,
  onSaved,
  onCancel,
}: {
  existing?: ProtocolTemplate;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [kind, setKind] = useState(existing?.kind ?? "protocol");
  const [duration, setDuration] = useState(
    String(existing?.duration_days ?? 7),
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!name.trim()) {
      setErr("Name is required.");
      return;
    }
    const dur = parseInt(duration, 10);
    if (!Number.isInteger(dur) || dur < 1) {
      setErr("Duration must be 1 day or more.");
      return;
    }

    setSaving(true);
    setErr("");

    const payload = {
      name: name.trim(),
      kind,
      duration_days: dur,
      description: description.trim() || null,
      is_active: isActive,
    };

    try {
      const res = existing
        ? await fetch(`/api/admin/protocols/${existing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/protocols", {
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
    <ModalShell
      title={existing ? "Edit protocol" : "New protocol template"}
      onCancel={onCancel}
    >
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 7-Day Private Protocol"
          style={inputStyle}
          autoFocus
        />
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field label="Kind" style={{ flex: 1 }}>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            style={inputStyle}
          >
            {PROTOCOL_KINDS.map((k) => (
              <option key={k} value={k}>
                {k[0].toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Duration (days)" style={{ width: 130 }}>
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            style={inputStyle}
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="What this protocol is for…"
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
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        Active
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
          {saving ? "Saving…" : existing ? "Save changes" : "Create"}
        </button>
      </div>
    </ModalShell>
  );
}
