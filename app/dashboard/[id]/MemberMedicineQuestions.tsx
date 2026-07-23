"use client";

import { useEffect } from "react";
import { type MedicineQuestionGroup } from "@/lib/medicine-questions";

/* Read-only founder drawer for a member's "Questions for the Medicine" (aka
   questions for the plant). Only opened when the member has shared — the server
   sends an empty groups array otherwise, so no private text is ever present in
   the client. Members write their own questions, so each line is the member's
   own words. */

const LeafIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3D5A2E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 4 13c0-5 4-9 15-9 0 8-4 13-8 15z" />
    <path d="M4 20c3-5 6-7 11-8" />
  </svg>
);

const LockIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#5C7A5F" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="10.5" width="16" height="10" rx="1.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

export default function MemberMedicineQuestions({
  memberName,
  groups,
  open,
  onClose,
}: {
  memberName: string;
  groups: MedicineQuestionGroup[];
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!open) return null;

  // The drawer shows a single numbered list of every question the member wrote.
  const questions = groups.flatMap((g) => g.questions);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Questions for the Medicine — ${memberName}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FDFBF7",
          width: "min(560px, 100%)",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.16)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "1.5rem 1.75rem 1.25rem", borderBottom: "0.5px solid rgba(28,43,30,0.12)", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', serif)", fontSize: 28, fontWeight: 400, color: "#1A1A18", margin: 0, lineHeight: 1.1 }}>
              Questions for the Medicine
            </h2>
            <p style={{ fontSize: 13, color: "#6B6B67", margin: "4px 0 0" }}>{memberName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, color: "#6B6B67", padding: 4 }}>
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "1.5rem 1.75rem", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, background: "rgba(122,158,126,0.08)", border: "0.5px solid rgba(122,158,126,0.25)", borderRadius: 10, padding: "14px 16px", marginBottom: 24 }}>
            <LeafIcon />
            <span style={{ fontSize: 13, color: "#3D4D3F", lineHeight: 1.5 }}>
              The questions below were submitted by this member as part of their preparation.
            </span>
          </div>

          {questions.length === 0 ? (
            <p style={{ fontSize: 13, color: "#9E9E9A" }}>No questions submitted yet.</p>
          ) : (
            questions.map((q, i) => (
              <div key={i} style={{ display: "flex", gap: 16, padding: "18px 0", borderBottom: "0.5px solid rgba(28,43,30,0.1)" }}>
                <span
                  style={{
                    fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
                    fontStyle: "italic",
                    fontSize: 20,
                    lineHeight: 1.4,
                    color: i % 2 === 0 ? "#5C7A5F" : "#B08D4F",
                    minWidth: 22,
                  }}
                >
                  {i + 1}.
                </span>
                <p style={{ fontFamily: "var(--font-display, 'Cormorant Garamond', serif)", fontSize: 19, fontWeight: 400, color: "#1A1A18", lineHeight: 1.5, margin: 0, whiteSpace: "pre-wrap" }}>
                  {q}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Footer note */}
        <div style={{ padding: "1rem 1.75rem", borderTop: "0.5px solid rgba(28,43,30,0.12)", display: "flex", alignItems: "center", gap: 10 }}>
          <LockIcon />
          <span style={{ fontSize: 12, color: "#5C7A5F", lineHeight: 1.5 }}>
            This member has chosen to share these questions with their Vital Kauaʻi care team.
          </span>
        </div>
      </div>
    </div>
  );
}
