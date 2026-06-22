"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CATEGORY_META,
  type CalendarRange,
  type ClientJourney,
} from "@/lib/calendar/types";
import {
  addMonths,
  isoToLocalDate,
  monthGridBounds,
  todayIso,
  toIso,
} from "@/lib/calendar/dates";
import CalendarMonth from "./CalendarMonth";
import CalendarDayDrawer from "./CalendarDayDrawer";
import JourneyForm from "./JourneyForm";

// Top-level ops calendar: owns the visible month, fetches the grid's date range
// once per month from /api/admin/calendar/range, and coordinates the day drawer
// and journey modal. Any mutation refetches the range so the grid stays live.
export default function CalendarClient() {
  const today = todayIso();
  const initial = isoToLocalDate(today);
  const [year, setYear] = useState(initial.getFullYear());
  const [month1, setMonth1] = useState(initial.getMonth() + 1);
  const [data, setData] = useState<CalendarRange | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [journeyForm, setJourneyForm] = useState<
    { existing?: ClientJourney } | null
  >(null);

  // Pure fetcher — returns the range, no setState. State updates live in the
  // promise callbacks below (the effect mount + the manual refetch), which is
  // the pattern React's set-state-in-effect rule accepts.
  const loadRange = useCallback((): Promise<CalendarRange> => {
    const { start, end } = monthGridBounds(year, month1);
    return fetch(
      `/api/admin/calendar/range?start=${start}&end=${end}`,
    ).then((res) => {
      if (!res.ok) throw new Error("load failed");
      return res.json() as Promise<CalendarRange>;
    });
  }, [year, month1]);

  useEffect(() => {
    let ignore = false;
    loadRange()
      .then((d) => {
        if (ignore) return;
        setData(d);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setError("Could not load the calendar.");
        setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [loadRange]);

  // Manual refetch after a mutation. Called from event handlers, so the
  // upfront setLoading is fine here.
  const refetch = useCallback(() => {
    setLoading(true);
    loadRange()
      .then((d) => {
        setData(d);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load the calendar.");
        setLoading(false);
      });
  }, [loadRange]);

  function shiftMonth(delta: number) {
    setLoading(true);
    const next = addMonths(year, month1, delta);
    setYear(next.year);
    setMonth1(next.month1);
  }

  function goToday() {
    setLoading(true);
    const t = isoToLocalDate(todayIso());
    setYear(t.getFullYear());
    setMonth1(t.getMonth() + 1);
  }

  const monthTitle = isoToLocalDate(toIso(year, month1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );

  const journeys = data?.journeys ?? [];
  const events = data?.events ?? [];

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              color: "#1A1A18",
              fontFamily: "var(--font-display, serif)",
              minWidth: 168,
            }}
          >
            {monthTitle}
          </h1>
          <div style={{ display: "flex", gap: 4 }}>
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              style={navButtonStyle}
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              style={navButtonStyle}
              aria-label="Next month"
            >
              ›
            </button>
            <button type="button" onClick={goToday} style={todayButtonStyle}>
              Today
            </button>
          </div>
          {loading && (
            <span
              style={{
                fontSize: 12,
                color: "#9E9E9A",
                fontFamily: "var(--font-body, sans-serif)",
              }}
            >
              Loading…
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setJourneyForm({})}
          style={{
            fontSize: 13,
            fontWeight: 500,
            padding: "8px 16px",
            background: "#0E0C0A",
            color: "#F0EBE0",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          + New client journey
        </button>
      </div>

      {error && (
        <p
          style={{
            fontSize: 13,
            color: "#A32D2D",
            fontFamily: "var(--font-body, sans-serif)",
          }}
        >
          {error}
        </p>
      )}

      <CalendarMonth
        year={year}
        month1={month1}
        journeys={journeys}
        events={events}
        today={today}
        onSelectDay={setSelectedDate}
      />

      <Legend />

      {selectedDate && (
        <CalendarDayDrawer
          date={selectedDate}
          onClose={() => setSelectedDate(null)}
          onChanged={refetch}
          onEditJourney={(j) => setJourneyForm({ existing: j })}
        />
      )}

      {journeyForm && (
        <JourneyForm
          existing={journeyForm.existing}
          onSaved={() => {
            // A journey edit/delete can change which clients appear on the open
            // day (delete cascades to its events), so close the drawer and
            // return to a refreshed month view.
            setJourneyForm(null);
            setSelectedDate(null);
            refetch();
          }}
          onCancel={() => setJourneyForm(null)}
        />
      )}
    </div>
  );
}

function Legend() {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 14,
        marginTop: 14,
        padding: "10px 14px",
        background: "#fff",
        border: "0.5px solid rgba(0,0,0,0.1)",
        borderRadius: 10,
      }}
    >
      <span style={{ ...legendText, color: "#6B6B67" }}>Coverage:</span>
      <LegendItem glyph="◆" color="#1c2b1e" label="Ceremony" />
      <LegendItem glyph="✚" color="#A32D2D" label="Medical" />
      <LegendItem glyph="●" color="#C8842A" label="Sitter" />
      <span
        style={{
          width: 1,
          height: 16,
          background: "rgba(0,0,0,0.12)",
        }}
      />
      {Object.entries(CATEGORY_META)
        .filter(([key]) => key !== "other")
        .map(([key, meta]) => (
          <span
            key={key}
            style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: meta.accent,
              }}
            />
            <span style={legendText}>{meta.label}</span>
          </span>
        ))}
    </div>
  );
}

function LegendItem({
  glyph,
  color,
  label,
}: {
  glyph: string;
  color: string;
  label: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ color, fontSize: 12 }}>{glyph}</span>
      <span style={legendText}>{label}</span>
    </span>
  );
}

const legendText: React.CSSProperties = {
  fontSize: 11,
  color: "#3d3d3a",
  fontFamily: "var(--font-body, sans-serif)",
};

const navButtonStyle: React.CSSProperties = {
  width: 30,
  height: 30,
  fontSize: 16,
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 8,
  cursor: "pointer",
  color: "#3d3d3a",
  lineHeight: 1,
};

const todayButtonStyle: React.CSSProperties = {
  height: 30,
  padding: "0 12px",
  fontSize: 12,
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.2)",
  borderRadius: 8,
  cursor: "pointer",
  color: "#3d3d3a",
  fontFamily: "var(--font-body, sans-serif)",
};
