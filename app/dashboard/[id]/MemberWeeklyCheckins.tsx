"use client";

import { useState } from "react";
import { parseQuestionsSnapshot } from "@/lib/checkins/questions";

/* Weekly Check-Ins — read-only card on the member profile (Outcomes tab).
   Same visual language as the pre/post-ceremony progress cards: a slim
   progress bar with an N/13 count, then one circle per week. A submitted
   week is filled in the green palette and clickable; selecting it shows
   that week's question/answer pairs below, rendered from that check-in's
   own questions_snapshot, so the card always shows the wording the member
   actually answered even after a template changes. Weeks without a
   submission stay quiet circles. No graphs, trends, or scores — this is a
   reading surface for the care team. */

export type WeeklyCheckinRow = {
  id: string;
  week_number: number;
  submitted_at: string | null;
  questions_snapshot: unknown;
  responses: Record<string, unknown> | null;
};

const TOTAL_WEEKS = 13;

// Green palette shared with the pre-ceremony progress card.
const BAR = "#E1F5EE";
const FILL = "#1D9E75";
const COUNT = "#085041";
const DONE_BG = "#E1F5EE";
const DONE_TEXT = "#085041";
const DONE_BORDER = "#1D9E75";

const CARD: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 10,
  padding: "1.25rem",
};

const LABEL: React.CSSProperties = {
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B6B67",
  marginBottom: 6,
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function MemberWeeklyCheckins({ checkins }: { checkins: WeeklyCheckinRow[] }) {
  const byWeek = new Map(checkins.map((c) => [c.week_number, c]));
  const latestWeek = checkins.reduce(
    (max, c) => (c.week_number > max ? c.week_number : max),
    0,
  );
  // The most recent submitted week opens first.
  const [selectedWeek, setSelectedWeek] = useState<number>(latestWeek);
  const selected = byWeek.get(selectedWeek) ?? null;
  const lastSubmitted = checkins
    .map((c) => c.submitted_at)
    .filter((d): d is string => d !== null)
    .sort()
    .at(-1);
  const pct = Math.round((byWeek.size / TOTAL_WEEKS) * 100);

  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Weekly check-ins</p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, height: 4, background: BAR, borderRadius: 2 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: FILL, borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 12, color: COUNT, fontWeight: 500 }}>
          {byWeek.size}/{TOTAL_WEEKS} weeks
        </span>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((week) => {
          const done = byWeek.has(week);
          const active = done && week === selectedWeek;
          const style: React.CSSProperties = {
            width: 28,
            height: 28,
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 500,
            background: done ? DONE_BG : "#FAFAF8",
            color: done ? DONE_TEXT : "#9E9E9A",
            border: active ? `1.5px solid ${DONE_BORDER}` : `0.5px solid ${done ? DONE_BORDER : "rgba(0,0,0,0.1)"}`,
          };
          return done ? (
            <button
              key={week}
              type="button"
              aria-label={`View Week ${week} check-in`}
              aria-pressed={active}
              onClick={() => setSelectedWeek(week)}
              style={{ ...style, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
            >
              {week}
            </button>
          ) : (
            <span key={week} style={style}>
              {week}
            </span>
          );
        })}
      </div>

      {checkins.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: "12px 0 0" }}>
          No weekly check-ins have been submitted yet.
        </p>
      ) : (
        selected && (
          <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)", marginTop: 14, paddingTop: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <p style={{ fontFamily: "var(--font-display, serif)", fontSize: 17, fontWeight: 500, color: "#1A1A18", margin: 0 }}>
                Week {selected.week_number}
              </p>
              <p style={{ fontSize: 12, color: "#9E9E9A", margin: 0 }}>
                Submitted {formatDate(selected.submitted_at)}
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {parseQuestionsSnapshot(selected.questions_snapshot).map((q) => {
                const answer = (selected.responses ?? {})[q.key];
                return (
                  <div key={q.key}>
                    <p style={{ fontSize: 12, color: "#6B6B67", margin: "0 0 2px" }}>{q.label}</p>
                    <p style={{ fontSize: 13, color: answer === undefined ? "#9E9E9A" : "#1A1A18", margin: 0, whiteSpace: "pre-wrap" }}>
                      {answer === undefined
                        ? "—"
                        : q.type === "scale"
                          ? `${answer} of ${q.max}`
                          : String(answer)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {lastSubmitted && (
        <p style={{ fontSize: 11, color: "#9E9E9A", marginTop: 12, marginBottom: 0 }}>
          Last submitted: {formatDate(lastSubmitted)}
        </p>
      )}
    </div>
  );
}
