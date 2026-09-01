"use client";

/* Weekly Check-Ins — compact read-only card on the member profile
   (Integration tab). Submitted check-ins newest first; each renders its
   question/answer pairs from that check-in's own questions_snapshot, so the
   card always shows the wording the member actually answered, even after a
   template changes. No graphs, trends, or scores — this is a reading
   surface for the care team. */

import { parseQuestionsSnapshot } from "@/lib/checkins/questions";

export type WeeklyCheckinRow = {
  id: string;
  week_number: number;
  submitted_at: string | null;
  questions_snapshot: unknown;
  responses: Record<string, unknown> | null;
};

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
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 12 }}>Weekly Check-Ins</p>

      {checkins.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: 0 }}>
          Submitted weekly check-ins will appear here.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {checkins.map((c) => {
            const questions = parseQuestionsSnapshot(c.questions_snapshot);
            const responses = c.responses ?? {};
            return (
              <div key={c.id} style={{ borderTop: "0.5px solid rgba(0,0,0,0.08)", paddingTop: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <p style={{ fontFamily: "var(--font-display, serif)", fontSize: 17, fontWeight: 500, color: "#1A1A18", margin: 0 }}>
                    Week {c.week_number}
                  </p>
                  <p style={{ fontSize: 12, color: "#9E9E9A", margin: 0 }}>
                    Submitted {formatDate(c.submitted_at)}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {questions.map((q) => {
                    const answer = responses[q.key];
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
            );
          })}
        </div>
      )}
    </div>
  );
}
