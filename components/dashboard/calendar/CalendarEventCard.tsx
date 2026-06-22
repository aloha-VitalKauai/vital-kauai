"use client";

import { categoryMeta, type CalendarEvent } from "@/lib/calendar/types";
import { formatClock } from "@/lib/calendar/dates";

// One itinerary block in the day timeline. Category color runs down the left
// edge; private blocks carry a lock so coverage notes aren't shown to the
// client. Edit/delete actions appear on hover (always visible on touch).
export default function CalendarEventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}) {
  const meta = categoryMeta(event.category);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        gap: 10,
        padding: "10px 12px",
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderLeft: `3px solid ${meta.accent}`,
        borderRadius: 8,
      }}
    >
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
              fontSize: 11,
              color: "#6B6B67",
              fontVariantNumeric: "tabular-nums",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            {formatClock(event.start_time)}–{formatClock(event.end_time)}
          </span>
          <span
            style={{
              fontSize: 9,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: meta.accent,
              background: meta.soft,
              padding: "2px 7px",
              borderRadius: 99,
              fontWeight: 600,
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            {meta.label}
          </span>
          {event.is_private && (
            <span
              title="Private — not shown to the client"
              style={{ fontSize: 10, color: "#9E9E9A" }}
            >
              🔒
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 14,
            color: "#1A1A18",
            fontWeight: 500,
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          {event.title}
        </div>

        {(event.location || event.assigned_to) && (
          <div
            style={{
              marginTop: 3,
              fontSize: 12,
              color: "#6B6B67",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            {[event.assigned_to, event.location].filter(Boolean).join(" · ")}
          </div>
        )}

        {event.notes && (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              color: "#9E9E9A",
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            {event.notes}
          </div>
        )}
      </div>

      {(onEdit || onDelete) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(event)}
              style={iconButtonStyle}
              aria-label="Edit event"
            >
              Edit
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(event)}
              style={{ ...iconButtonStyle, color: "#A32D2D" }}
              aria-label="Delete event"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const iconButtonStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  background: "none",
  border: "0.5px solid rgba(0,0,0,0.15)",
  borderRadius: 6,
  padding: "3px 8px",
  cursor: "pointer",
  color: "#6B6B67",
  fontFamily: "var(--font-body, sans-serif)",
  whiteSpace: "nowrap",
};
