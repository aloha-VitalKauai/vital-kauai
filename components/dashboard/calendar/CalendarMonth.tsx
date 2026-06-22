"use client";

import {
  categoryMeta,
  type CalendarEvent,
  type ClientJourney,
} from "@/lib/calendar/types";
import {
  diffDays,
  formatClockShort,
  isCurrentMonth,
  isWithinJourney,
  isoToLocalDate,
  journeyLengthDays,
  monthGrid,
} from "@/lib/calendar/dates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_JOURNEYS = 3;
const MAX_EVENTS = 3;

// Month grid. Each journey renders on every day of its stay as a colored bar
// labelled "Day N"; high-level events stack below. Coverage signals (ceremony,
// medical, sitter) surface as glyphs in the cell corner so the ops team can
// scan a month at a glance. Click a day to open its detail drawer.
export default function CalendarMonth({
  year,
  month1,
  journeys,
  events,
  today,
  onSelectDay,
}: {
  year: number;
  month1: number;
  journeys: ClientJourney[];
  events: CalendarEvent[];
  today: string;
  onSelectDay: (date: string) => void;
}) {
  const weeks = monthGrid(year, month1);

  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const list = eventsByDate.get(ev.event_date) ?? [];
    list.push(ev);
    eventsByDate.set(ev.event_date, list);
  }

  return (
    <div
      style={{
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderRadius: 12,
        overflow: "hidden",
        background: "#fff",
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            style={{
              padding: "8px 10px",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#9E9E9A",
              borderBottom: "0.5px solid rgba(0,0,0,0.1)",
              fontFamily: "var(--font-body, sans-serif)",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div
          key={wi}
          style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}
        >
          {week.map((date) => {
            const inMonth = isCurrentMonth(date, year, month1);
            const isToday = date === today;
            const dayEvents = (eventsByDate.get(date) ?? []).slice();
            const activeJourneys = journeys.filter((j) =>
              isWithinJourney(date, j.start_date, j.end_date),
            );

            const hasCeremony = dayEvents.some((e) => e.category === "ceremony");
            const hasMedical = dayEvents.some((e) => e.category === "medical");
            const hasSitter = dayEvents.some((e) => e.category === "sitter");

            return (
              <button
                key={date}
                type="button"
                onClick={() => onSelectDay(date)}
                style={{
                  textAlign: "left",
                  minHeight: 124,
                  padding: 6,
                  border: "none",
                  borderRight: "0.5px solid rgba(0,0,0,0.07)",
                  borderBottom: "0.5px solid rgba(0,0,0,0.07)",
                  background: hasCeremony
                    ? "#F3F6F1"
                    : inMonth
                      ? "#fff"
                      : "#FAFAF8",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                  fontFamily: "var(--font-body, sans-serif)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? 700 : 500,
                      color: isToday
                        ? "#fff"
                        : inMonth
                          ? "#1A1A18"
                          : "#C4C4BF",
                      background: isToday ? "#1D6B4A" : "transparent",
                      borderRadius: 99,
                      minWidth: 18,
                      height: 18,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: isToday ? "0 5px" : 0,
                    }}
                  >
                    {isoToLocalDate(date).getDate()}
                  </span>
                  <span style={{ display: "flex", gap: 3, fontSize: 11 }}>
                    {hasCeremony && (
                      <span title="Ceremony" style={{ color: "#1c2b1e" }}>
                        ◆
                      </span>
                    )}
                    {hasMedical && (
                      <span title="Medical coverage" style={{ color: "#A32D2D" }}>
                        ✚
                      </span>
                    )}
                    {hasSitter && (
                      <span title="Sitter coverage" style={{ color: "#C8842A" }}>
                        ●
                      </span>
                    )}
                  </span>
                </div>

                {activeJourneys.slice(0, MAX_JOURNEYS).map((j) => {
                  const dayNum = diffDays(j.start_date, date) + 1;
                  const total = journeyLengthDays(j.start_date, j.end_date);
                  const strip = j.color || "#085041";
                  return (
                    <div
                      key={j.id}
                      title={`${j.display_name} · Day ${dayNum} of ${total}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        background: "#F1EFE8",
                        borderLeft: `3px solid ${strip}`,
                        borderRadius: 4,
                        padding: "1px 5px",
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          color: "#1A1A18",
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          flex: 1,
                        }}
                      >
                        {j.display_name}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          color: "#6B6B67",
                          whiteSpace: "nowrap",
                        }}
                      >
                        D{dayNum}
                      </span>
                    </div>
                  );
                })}
                {activeJourneys.length > MAX_JOURNEYS && (
                  <span style={moreStyle}>
                    +{activeJourneys.length - MAX_JOURNEYS} more guests
                  </span>
                )}

                {dayEvents.slice(0, MAX_EVENTS).map((ev) => {
                  const meta = categoryMeta(ev.category);
                  return (
                    <div
                      key={ev.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        overflow: "hidden",
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: meta.accent,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          color: "#6B6B67",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatClockShort(ev.start_time)}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "#3d3d3a",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {ev.title}
                      </span>
                    </div>
                  );
                })}
                {dayEvents.length > MAX_EVENTS && (
                  <span style={moreStyle}>+{dayEvents.length - MAX_EVENTS} more</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const moreStyle: React.CSSProperties = {
  fontSize: 9,
  color: "#9E9E9A",
  paddingLeft: 2,
};
