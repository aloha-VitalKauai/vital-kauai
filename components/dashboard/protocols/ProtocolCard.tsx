"use client";

import { useState } from "react";
import { categoryMeta } from "@/lib/calendar/types";
import { formatClock } from "@/lib/calendar/dates";
import type {
  ProtocolTemplateDay,
  ProtocolTemplateItem,
  ProtocolTemplateWithItems,
} from "@/lib/protocols/types";
import { errStyle } from "@/components/dashboard/calendar/CalendarEventForm";
import ProtocolItemForm from "./ProtocolItemForm";

// One template: summary header + actions, expandable to a day-by-day block
// editor. Block CRUD posts to /api/admin/protocols/[id]/items[...]; the card
// calls onChanged() so the parent refetches.
export default function ProtocolCard({
  template,
  onChanged,
  onEdit,
  onApply,
}: {
  template: ProtocolTemplateWithItems;
  onChanged: () => void;
  onEdit: () => void;
  onApply: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [itemForm, setItemForm] = useState<
    { existing?: ProtocolTemplateItem; defaultDayOffset?: number } | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Group blocks by day_offset for the expanded view.
  const byDay = new Map<number, ProtocolTemplateItem[]>();
  for (const item of template.items) {
    const list = byDay.get(item.day_offset) ?? [];
    list.push(item);
    byDay.set(item.day_offset, list);
  }

  // Day identity (title / theme / description), keyed by 1-based day number.
  // Optional — a protocol without identity rows falls back to "Day N".
  const identityByNumber = new Map<number, ProtocolTemplateDay>();
  for (const d of template.days) identityByNumber.set(d.day_number, d);

  // Render the union of days that have blocks and days that carry identity, in
  // order (identity is 1-based; day_offset is 0-based).
  const dayOffsets = Array.from(
    new Set<number>([
      ...byDay.keys(),
      ...template.days.map((d) => d.day_number - 1),
    ]),
  ).sort((a, b) => a - b);

  async function deleteItem(item: ProtocolTemplateItem) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(
        `/api/admin/protocols/${template.id}/items/${item.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        onChanged();
      } else {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || "Could not delete the block.");
      }
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTemplate() {
    if (
      !window.confirm(
        `Delete the "${template.name}" template? Its blocks are removed. Events already applied to journeys stay on the calendar.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/admin/protocols/${template.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        onChanged();
      } else {
        const body = await res.json().catch(() => ({}));
        setErr(body.error || "Could not delete the protocol.");
      }
    } catch {
      setErr("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse" : "Expand"}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "#9E9E9A",
            width: 16,
          }}
        >
          {expanded ? "▾" : "▸"}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#1A1A18",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              {template.name}
            </span>
            <span style={kindBadge}>{template.kind}</span>
            {!template.is_active && <span style={inactiveBadge}>inactive</span>}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 12,
              color: "#6B6B67",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            {template.duration_days} day{template.duration_days === 1 ? "" : "s"} ·{" "}
            {template.items.length} block
            {template.items.length === 1 ? "" : "s"}
            {template.description ? ` · ${template.description}` : ""}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={onApply} style={primaryMini}>
            Apply
          </button>
          <button type="button" onClick={onEdit} style={ghostMini}>
            Edit
          </button>
          <button
            type="button"
            onClick={deleteTemplate}
            disabled={busy}
            style={{ ...ghostMini, color: "#A32D2D" }}
          >
            Delete
          </button>
        </div>
      </div>

      {err && (
        <p style={{ ...errStyle, padding: "0 16px 12px" }}>{err}</p>
      )}

      {/* Expanded block editor */}
      {expanded && (
        <div
          style={{
            borderTop: "0.5px solid rgba(0,0,0,0.08)",
            padding: "12px 16px",
            background: "#FAFAF8",
          }}
        >
          {dayOffsets.length === 0 && (
            <p
              style={{
                margin: "0 0 10px",
                fontSize: 13,
                color: "#9E9E9A",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              No blocks yet.
            </p>
          )}

          {dayOffsets.map((day) => (
            <div key={day} style={{ marginBottom: 14 }}>
              <DayHeader dayNumber={day + 1} identity={identityByNumber.get(day + 1)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {(byDay.get(day) ?? []).map((item) => {
                  const meta = categoryMeta(item.category);
                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        background: "#fff",
                        border: "0.5px solid rgba(0,0,0,0.08)",
                        borderLeft: `3px solid ${meta.accent}`,
                        borderRadius: 6,
                        padding: "6px 10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "#6B6B67",
                          fontVariantNumeric: "tabular-nums",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatClock(item.start_time)}–{formatClock(item.end_time)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 13,
                          color: "#1A1A18",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                        {item.is_private && (
                          <span title="Private" style={{ marginLeft: 6 }}>
                            🔒
                          </span>
                        )}
                      </span>
                      <span style={{ fontSize: 10, color: meta.accent }}>
                        {meta.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setItemForm({ existing: item })}
                        style={ghostMini}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item)}
                        disabled={busy}
                        style={{ ...ghostMini, color: "#A32D2D" }}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() =>
              setItemForm({
                defaultDayOffset: dayOffsets.length ? dayOffsets[0] : 0,
              })
            }
            style={{
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 14px",
              background: "#0E0C0A",
              color: "#F0EBE0",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            + Add block
          </button>
        </div>
      )}

      {itemForm && (
        <ProtocolItemForm
          templateId={template.id}
          existing={itemForm.existing}
          defaultDayOffset={itemForm.defaultDayOffset}
          onSaved={() => {
            setItemForm(null);
            onChanged();
          }}
          onCancel={() => setItemForm(null)}
        />
      )}
    </div>
  );
}

const kindBadge: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#085041",
  background: "#E1F5EE",
  padding: "2px 7px",
  borderRadius: 99,
  fontWeight: 600,
  fontFamily: "var(--font-body, sans-serif)",
};

const inactiveBadge: React.CSSProperties = {
  fontSize: 9,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#9E9E9A",
  background: "#F0EFEA",
  padding: "2px 7px",
  borderRadius: 99,
  fontWeight: 600,
  fontFamily: "var(--font-body, sans-serif)",
};

const ghostMini: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  background: "none",
  border: "0.5px solid rgba(0,0,0,0.15)",
  borderRadius: 6,
  padding: "4px 9px",
  cursor: "pointer",
  color: "#6B6B67",
  fontFamily: "var(--font-body, sans-serif)",
  whiteSpace: "nowrap",
};

const primaryMini: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  background: "#0E0C0A",
  border: "none",
  borderRadius: 6,
  padding: "4px 11px",
  cursor: "pointer",
  color: "#F0EBE0",
  fontWeight: 600,
  fontFamily: "var(--font-body, sans-serif)",
  whiteSpace: "nowrap",
};

const DAY_WORDS = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
];

// "DAY THREE" for 1–12, else "DAY 13".
function dayLabel(dayNumber: number): string {
  const word = DAY_WORDS[dayNumber];
  return (word ? `Day ${word}` : `Day ${dayNumber}`).toUpperCase();
}

// Day section header: the spelled day label plus the day's identity (title,
// theme, optional description) when present. Falls back to just the label when
// a protocol has no identity for this day.
function DayHeader({
  dayNumber,
  identity,
}: {
  dayNumber: number;
  identity?: ProtocolTemplateDay;
}) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "#9E9E9A",
          fontWeight: 600,
          fontFamily: "var(--font-body, sans-serif)",
        }}
      >
        {dayLabel(dayNumber)}
      </div>
      {identity && (
        <>
          <div
            style={{
              fontSize: 16,
              color: "#1A1A18",
              fontWeight: 500,
              fontFamily: "var(--font-display, serif)",
              marginTop: 1,
            }}
          >
            {identity.title}
          </div>
          {identity.theme && (
            <div
              style={{
                fontSize: 13,
                color: "#6B6B67",
                fontStyle: "italic",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              {identity.theme}
            </div>
          )}
          {identity.description && (
            <div
              style={{
                fontSize: 12,
                color: "#9E9E9A",
                marginTop: 3,
                lineHeight: 1.5,
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              {identity.description}
            </div>
          )}
        </>
      )}
    </div>
  );
}
