"use client";

import { useState } from "react";
import type { CheckinQuestion } from "@/lib/checkins/questions";

/* Mobile-first weekly check-in. Questions render dynamically from the
   check-in's stored questions_snapshot — nothing here knows what a given
   week asks. Visual system matches the portal guides: cream ground,
   Cormorant Garamond display, Jost body. */

const cream = "#FAF6F0";
const ink = "#2C2416";
const inkSoft = "#5C5043";
const gold = "#B8956A";
const rule = "rgba(184,149,106,0.25)";
const cardBg = "#FEFCF8";
const forest = "#085041";

type OpenCheckin = {
  id: string;
  weekNumber: number;
  questions: CheckinQuestion[];
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: cream, fontFamily: "'Jost', sans-serif", fontWeight: 300, lineHeight: 1.75, color: ink }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2.5rem 1.25rem 5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2.25rem" }}>
          <span style={{ display: "block", fontWeight: 400, fontSize: "0.7rem", letterSpacing: "0.22em", textTransform: "uppercase", color: gold, marginBottom: "0.75rem" }}>
            Vital Kauaʻi
          </span>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: "clamp(1.9rem, 6vw, 2.5rem)", lineHeight: 1.2, margin: 0 }}>
            Weekly Check-In
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: cardBg, border: `1px solid ${rule}`, borderRadius: 2, padding: "1.75rem 1.5rem", marginBottom: "1.25rem" }}>
      {children}
    </div>
  );
}

export default function CheckinClient(
  props:
    | { state: "open"; checkin: OpenCheckin }
    | { state: "none"; checkin?: undefined }
    | { state: "error"; checkin?: undefined },
) {
  const [values, setValues] = useState<Record<string, number | string>>({});
  const [errors, setErrors] = useState<string[]>([]);
  const [phase, setPhase] = useState<"editing" | "submitting" | "done">("editing");

  if (props.state === "none") {
    return (
      <Shell>
        <Card>
          <p style={{ fontSize: "0.95rem", color: inkSoft, textAlign: "center", margin: 0 }}>
            You&rsquo;re all caught up. Your next check-in opens with the coming week.
          </p>
        </Card>
      </Shell>
    );
  }

  if (props.state === "error") {
    return (
      <Shell>
        <Card>
          <p style={{ fontSize: "0.95rem", color: inkSoft, textAlign: "center", margin: 0 }}>
            Your check-in is taking a moment to load. Please refresh, and reach
            out to your care team if it keeps happening.
          </p>
        </Card>
      </Shell>
    );
  }

  const { checkin } = props;

  if (phase === "done") {
    return (
      <Shell>
        <Card>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "1.6rem", fontWeight: 400, textAlign: "center", margin: "0 0 0.5rem" }}>
            Mahalo.
          </p>
          <p style={{ fontSize: "0.95rem", color: inkSoft, textAlign: "center", margin: 0 }}>
            Your check-in has been received.
          </p>
        </Card>
      </Shell>
    );
  }

  // Client-side pass of the same rules the server enforces: required answered,
  // scales chosen. The server re-validates against the stored snapshot.
  function missingRequired(): string[] {
    return checkin.questions
      .filter((q) => q.required)
      .filter((q) => {
        const v = values[q.key];
        return v === undefined || (typeof v === "string" && v.trim() === "");
      })
      .map((q) => q.label);
  }

  async function submit() {
    const missing = missingRequired();
    if (missing.length > 0) {
      setErrors(missing.map((label) => `"${label}" needs an answer.`));
      return;
    }
    setErrors([]);
    setPhase("submitting");
    try {
      const res = await fetch("/api/checkins/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId: checkin.id, answers: values }),
      });
      if (res.ok) {
        setPhase("done");
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (body?.error === "already_submitted") {
        // Someone (or another tab) already sent this week's answers in —
        // the received state is the truthful one.
        setPhase("done");
        return;
      }
      setErrors(
        Array.isArray(body?.details) && body.details.length > 0
          ? body.details
          : ["Something interrupted the save. Your answers are still here — please try again."],
      );
      setPhase("editing");
    } catch {
      setErrors(["Something interrupted the save. Your answers are still here — please try again."]);
      setPhase("editing");
    }
  }

  return (
    <Shell>
      <p style={{ textAlign: "center", fontSize: "0.8rem", letterSpacing: "0.14em", textTransform: "uppercase", color: inkSoft, margin: "-1.25rem 0 1.75rem" }}>
        Week {checkin.weekNumber}
      </p>

      {checkin.questions.map((q) => (
        <Card key={q.key}>
          <p style={{ fontSize: "0.95rem", color: ink, fontWeight: 400, margin: "0 0 0.9rem", lineHeight: 1.5 }}>
            {q.label}
          </p>
          {q.type === "scale" ? (
            <div role="radiogroup" aria-label={q.label} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((n) => {
                const selected = values[q.key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setValues((v) => ({ ...v, [q.key]: n }))}
                    style={{
                      flex: 1,
                      minWidth: 44,
                      minHeight: 44,
                      borderRadius: 2,
                      border: selected ? `1px solid ${forest}` : `1px solid ${rule}`,
                      background: selected ? forest : "transparent",
                      color: selected ? "#FDFBF7" : inkSoft,
                      fontFamily: "'Jost', sans-serif",
                      fontSize: "1rem",
                      fontWeight: selected ? 500 : 300,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              rows={4}
              value={(values[q.key] as string) ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [q.key]: e.target.value }))}
              placeholder="Share as much or as little as feels right."
              style={{
                width: "100%",
                border: "none",
                borderBottom: `1px solid ${rule}`,
                background: "transparent",
                fontFamily: "'Jost', sans-serif",
                fontSize: 16,
                fontWeight: 300,
                color: ink,
                resize: "vertical",
                outline: "none",
                minHeight: 96,
                lineHeight: 1.7,
                padding: "4px 0 8px",
              }}
            />
          )}
        </Card>
      ))}

      {errors.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          {errors.map((e) => (
            <p key={e} style={{ fontSize: "0.85rem", color: "#A0522D", margin: "0 0 4px" }}>
              {e}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={phase === "submitting"}
        style={{
          width: "100%",
          padding: "14px 20px",
          background: forest,
          color: "#FDFBF7",
          border: "none",
          borderRadius: 2,
          fontFamily: "'Jost', sans-serif",
          fontSize: "0.95rem",
          fontWeight: 400,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: phase === "submitting" ? "default" : "pointer",
          opacity: phase === "submitting" ? 0.7 : 1,
        }}
      >
        {phase === "submitting" ? "Sending…" : "Submit Check-In"}
      </button>
    </Shell>
  );
}
