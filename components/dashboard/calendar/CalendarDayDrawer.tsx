"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarDay, CalendarEvent } from "@/lib/calendar/types";
import { hourOf, isoToLocalDate } from "@/lib/calendar/dates";
import CalendarEventCard from "./CalendarEventCard";
import CalendarEventForm from "./CalendarEventForm";

// 6 AM → 11 PM, per spec.
const START_HOUR = 6;
const END_HOUR = 23;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i,
);

function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${ampm}`;
}

// Right-side day detail. Shows which clients are on island that day, then an
// hourly timeline with each itinerary block in its start hour. Add / edit /
// delete blocks here; every change refetches the day and notifies the parent
// so the month grid stays in sync.
export default function CalendarDayDrawer({
  date,
  onClose,
  onChanged,
}: {
  date: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [day, setDay] = useState<CalendarDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<
    { existing?: CalendarEvent; defaultStartTime?: string } | null
  >(null);

  // Pure fetcher — returns the day, no setState. State updates live in the
  // promise callbacks (effect mount + manual refetch), the pattern React's
  // set-state-in-effect rule accepts.
  const loadDay = useCallback((): Promise<CalendarDay> => {
    return fetch(`/api/admin/calendar/day/${date}`).then((res) => {
      if (!res.ok) throw new Error("load failed");
      return res.json() as Promise<CalendarDay>;
    });
  }, [date]);

  useEffect(() => {
    let ignore = false;
    loadDay()
      .then((d) => {
        if (ignore) return;
        setDay(d);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError("Could not load this day.");
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [loadDay]);

  // Manual refetch after a mutation (event-handler context — setState here is
  // fine). Returns the promise so callers can await before notifying parents.
  const refetchDay = useCallback(() => {
    return loadDay()
      .then((d) => {
        setDay(d);
        setError("");
      })
      .catch(() => {
        setError("Could not reload this day.");
      });
  }, [loadDay]);

  async function handleDelete(event: CalendarEvent) {
    if (!window.confirm(`Delete "${event.title}"?`)) return;
    try {
      const res = await fetch(`/api/admin/calendar/events/${event.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError("Could not delete the block.");
        return;
      }
      await refetchDay();
      onChanged();
    } catch {
      setError("Network error deleting the block.");
    }
  }

  function onSaved() {
    setForm(null);
    refetchDay();
    onChanged();
  }

  const journeys = day?.journeys ?? [];
  const events = day?.events ?? [];
  const eventsByHour = new Map<number, CalendarEvent[]>();
  for (const ev of events) {
    const h = Math.min(Math.max(hourOf(ev.start_time), START_HOUR), END_HOUR);
    const list = eventsByHour.get(h) ?? [];
    list.push(ev);
    eventsByHour.set(h, list);
  }

  const heading = isoToLocalDate(date).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(14,12,10,0.35)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(480px, 100%)",
          height: "100%",
          background: "#FAFAF8",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            background: "#fff",
            borderBottom: "0.5px solid rgba(0,0,0,0.1)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
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
              {heading}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{
                background: "none",
                border: "none",
                fontSize: 22,
                lineHeight: 1,
                color: "#9E9E9A",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>

          {journeys.length > 0 ? (
            <div
              style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}
            >
              {journeys.map((jd) => (
                <span
                  key={jd.journey.id}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12,
                    color: "#1A1A18",
                    background: "#F1EFE8",
                    borderLeft: `3px solid ${jd.journey.color || "#085041"}`,
                    borderRadius: 5,
                    padding: "3px 9px",
                    fontFamily: "var(--font-body, sans-serif)",
                  }}
                >
                  {jd.journey.display_name}
                  <span style={{ color: "#6B6B67" }}>
                    Day {jd.dayNumber} of {jd.totalDays}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13,
                color: "#9E9E9A",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              No client scheduled on island this day.
            </p>
          )}

          <button
            type="button"
            onClick={() => setForm({})}
            disabled={journeys.length === 0}
            title={
              journeys.length === 0
                ? "Create a client journey for this day first"
                : undefined
            }
            style={{
              marginTop: 12,
              fontSize: 12,
              fontWeight: 500,
              padding: "7px 14px",
              background: journeys.length === 0 ? "#D8D7D1" : "#0E0C0A",
              color: journeys.length === 0 ? "#8A8A86" : "#F0EBE0",
              border: "none",
              borderRadius: 8,
              cursor: journeys.length === 0 ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            + Add block
          </button>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
          {loading && <p style={mutedStyle}>Loading…</p>}
          {error && (
            <p style={{ ...mutedStyle, color: "#A32D2D" }}>{error}</p>
          )}
          {!loading &&
            !error &&
            HOURS.map((h) => {
              const hourEvents = eventsByHour.get(h) ?? [];
              return (
                <div
                  key={h}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "58px 1fr",
                    gap: 8,
                    minHeight: 34,
                    borderTop: "0.5px solid rgba(0,0,0,0.06)",
                    padding: "6px 0",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#9E9E9A",
                      paddingTop: 2,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      fontFamily: "var(--font-body, sans-serif)",
                    }}
                  >
                    {hourLabel(h)}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {hourEvents.map((ev) => (
                      <CalendarEventCard
                        key={ev.id}
                        event={ev}
                        onEdit={() => setForm({ existing: ev })}
                        onDelete={() => handleDelete(ev)}
                      />
                    ))}
                    {hourEvents.length === 0 && journeys.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            defaultStartTime: `${String(h).padStart(2, "0")}:00`,
                          })
                        }
                        style={{
                          alignSelf: "flex-start",
                          fontSize: 11,
                          color: "#C4C4BF",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 0",
                          fontFamily: "var(--font-body, sans-serif)",
                        }}
                      >
                        + add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {form && (
        <CalendarEventForm
          date={date}
          journeys={journeys}
          existing={form.existing}
          defaultStartTime={form.defaultStartTime}
          onSaved={onSaved}
          onCancel={() => setForm(null)}
        />
      )}
    </div>
  );
}

const mutedStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#9E9E9A",
  fontFamily: "var(--font-body, sans-serif)",
  padding: "1rem 0",
};
