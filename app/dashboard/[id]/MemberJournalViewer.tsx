"use client";

import { useEffect } from "react";
import {
  PRE_CEREMONY_WEEKS,
  POST_CEREMONY_WEEKS,
  PRE_PNE_DETAILS,
  POST_PNE_DETAILS,
} from "@/lib/journal-prompts";

/* ──────────────────────────────────────────────────────────────────
   Read-only journal viewer for the Member Profile.

   Opened by clicking a week circle in the Integration progress cards.
   Renders the member's saved journal_responses (already loaded by the
   profile page's server query) against the shared prompt definitions in
   lib/journal-prompts — the same source and storage keys the member
   portal writes to — so there is no separate journal query or system.
   Responses are display-only: no inputs, no writes. */

export type JournalPhase = "pre" | "post";

const PHASE_LABEL: Record<JournalPhase, string> = {
  pre: "Pre-Ceremony",
  post: "Post-Ceremony",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const PROMPT_Q: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
  color: "#1A1A18",
  lineHeight: 1.5,
  margin: "0 0 4px",
};

const PROMPT_HINT: React.CSSProperties = {
  fontSize: 12,
  color: "#6B6B67",
  fontStyle: "italic",
  lineHeight: 1.6,
  margin: "0 0 10px",
};

const RESPONSE_BOX: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  fontSize: 13,
  color: "#1A1A18",
  lineHeight: 1.75,
  background: "#FAFAF8",
  border: "0.5px solid rgba(0,0,0,0.1)",
  borderRadius: 8,
  padding: "12px 14px",
  marginTop: 8,
};

const EMPTY_BOX: React.CSSProperties = {
  ...RESPONSE_BOX,
  color: "#9E9E9A",
  fontStyle: "italic",
};

function ResponseBlock({ text }: { text: string | undefined }) {
  return text?.trim() ? (
    <div style={RESPONSE_BOX}>{text}</div>
  ) : (
    <div style={EMPTY_BOX}>No response submitted for this prompt.</div>
  );
}

export default function MemberJournalViewer({
  memberName,
  phase,
  weekIdx,
  responses,
  lastUpdated,
  sharingState = "shared",
  onWeekChange,
  onClose,
}: {
  memberName: string;
  phase: JournalPhase;
  weekIdx: number; // 0-based, 0–5
  responses: Record<string, string>;
  lastUpdated?: string | null;
  // When not "shared", the server has stripped all response text; the viewer
  // shows prompt titles plus a privacy notice instead of response boxes.
  sharingState?: "shared" | "private" | "undecided";
  onWeekChange: (weekIdx: number) => void;
  onClose: () => void;
}) {
  const isShared = sharingState === "shared";
  const privacyNotice =
    sharingState === "private"
      ? "This member has chosen to keep their journal and reflection responses private."
      : "This member has not shared their journal and reflection responses with the care team.";
  const weeks = phase === "pre" ? PRE_CEREMONY_WEEKS : POST_CEREMONY_WEEKS;
  const pneDetails = phase === "pre" ? PRE_PNE_DETAILS : POST_PNE_DETAILS;
  const week = weeks[weekIdx];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!week) return null;

  // Same key scheme the member portal saves under (see lib/journal-prompts.ts):
  // explicit prompt.key when set, else `w{weekIdx}-p{promptIdx}`; PNE
  // reflections under `{phase}-pne-reflection-w{weekIdx}` with -2/-3/-4 follow-ups.
  const pne = pneDetails[weekIdx];
  const pneKey = `${phase}-pne-reflection-w${weekIdx}`;
  const pneEntries = [
    { q: pne?.reflection, key: pneKey },
    { q: pne?.reflectionFollowUp, key: `${pneKey}-2` },
    { q: pne?.reflectionThird, key: `${pneKey}-3` },
    { q: pne?.reflectionFourth, key: `${pneKey}-4` },
  ].filter((r) => r.q || responses[r.key]?.trim());

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${PHASE_LABEL[phase]} Week ${weekIdx + 1} journal — ${memberName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          width: "100%",
          maxWidth: 960,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.25rem 1.5rem 1rem", borderBottom: "0.5px solid rgba(0,0,0,0.08)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6B67", margin: "0 0 4px", fontWeight: 500 }}>
                {memberName} · Read-only member journal
              </p>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: "#1A1A18", margin: 0 }}>
                {PHASE_LABEL[phase]} — Week {weekIdx + 1} · {week.code} · {week.theme}
              </h2>
              {week.title && (
                <p style={{ fontSize: 12, color: "#6B6B67", fontStyle: "italic", margin: "3px 0 0" }}>{week.title}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close journal viewer"
              style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, color: "#6B6B67", padding: 4 }}
            >
              ✕
            </button>
          </div>

          {/* Week navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => onWeekChange(weekIdx - 1)}
              disabled={weekIdx === 0}
              aria-label={`View ${PHASE_LABEL[phase]} Week ${weekIdx} journal entries`}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: weekIdx === 0 ? "#C9C9C5" : "#1A1A18", cursor: weekIdx === 0 ? "default" : "pointer" }}
            >
              ← Prev
            </button>
            {weeks.map((_, w) => (
              <button
                key={w}
                type="button"
                onClick={() => onWeekChange(w)}
                aria-label={`View ${PHASE_LABEL[phase]} Week ${w + 1} journal entries`}
                aria-current={w === weekIdx ? "true" : undefined}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  background: w === weekIdx ? "#1A1A18" : "#FAFAF8",
                  color: w === weekIdx ? "#fff" : "#6B6B67",
                  border: `0.5px solid ${w === weekIdx ? "#1A1A18" : "rgba(0,0,0,0.12)"}`,
                }}
              >
                {w + 1}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onWeekChange(weekIdx + 1)}
              disabled={weekIdx === 5}
              aria-label={`View ${PHASE_LABEL[phase]} Week ${weekIdx + 2} journal entries`}
              style={{ fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: weekIdx === 5 ? "#C9C9C5" : "#1A1A18", cursor: weekIdx === 5 ? "default" : "pointer" }}
            >
              Next →
            </button>
            {lastUpdated && (
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#9E9E9A" }}>
                Last active: {fmtDate(lastUpdated)}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ overflowY: "auto", padding: "1.25rem 1.5rem 1.5rem" }}>
          {!isShared && (
            <div
              style={{
                background: "#FAFAF8",
                border: "0.5px solid rgba(0,0,0,0.1)",
                borderRadius: 8,
                padding: "14px 16px",
                marginBottom: 18,
                fontSize: 13,
                color: "#6B6B67",
                lineHeight: 1.6,
              }}
            >
              {privacyNotice}
            </div>
          )}
          {week.prompts.length === 0 && pneEntries.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9E9E9A", textAlign: "center", padding: "2.5rem 0" }}>
              No journal prompts are configured for this week.
            </p>
          ) : (
            <>
              {week.prompts.map((prompt, pj) => {
                const key = prompt.key ?? `w${weekIdx}-p${pj}`;
                return (
                  <div key={key} style={{ padding: "16px 0", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#6B6B67", margin: "0 0 6px" }}>{pj + 1}</p>
                    <p style={PROMPT_Q}>{prompt.q}</p>
                    {prompt.hint && <p style={PROMPT_HINT}>{prompt.hint}</p>}
                    {isShared && <ResponseBlock text={responses[key]} />}
                  </div>
                );
              })}

              {pneEntries.length > 0 && (
                <div style={{ padding: "16px 0 0" }}>
                  <p style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6B6B67", fontWeight: 600, margin: "0 0 10px" }}>
                    PNE Reflection
                  </p>
                  {pneEntries.map((r) => (
                    <div key={r.key} style={{ marginBottom: 14 }}>
                      <p style={PROMPT_Q}>{r.q || "Earlier PNE reflection"}</p>
                      {isShared && <ResponseBlock text={responses[r.key]} />}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
