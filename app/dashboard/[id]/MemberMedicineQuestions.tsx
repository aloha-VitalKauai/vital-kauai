"use client";

import { type MedicineQuestionGroup } from "@/lib/medicine-questions";

/* Read-only founder view of a member's "Questions for the Medicine" (aka
   questions for the plant). Only rendered when the member has shared — the
   server sends an empty groups array otherwise, so no private text is present
   in the client at all. Members write their own questions, so each line is the
   member's own words grouped under the section they wrote it in. */

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

export default function MemberMedicineQuestions({
  groups,
}: {
  groups: MedicineQuestionGroup[];
}) {
  return (
    <div style={CARD}>
      <p style={{ ...LABEL, marginBottom: 4 }}>Questions for the Medicine</p>
      {groups.length === 0 ? (
        <p style={{ fontSize: 13, color: "#9E9E9A", margin: "8px 0 0" }}>
          No questions submitted yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 12 }}>
          {groups.map((group) => (
            <div key={group.label}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#3D5A2E", margin: "0 0 2px" }}>
                {group.label}
              </p>
              <p style={{ fontSize: 12, color: "#9E9E9A", fontStyle: "italic", margin: "0 0 8px" }}>
                {group.title}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {group.questions.map((q, i) => (
                  <div
                    key={i}
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 13,
                      color: "#1A1A18",
                      lineHeight: 1.7,
                      background: "#FAFAF8",
                      border: "0.5px solid rgba(0,0,0,0.1)",
                      borderRadius: 8,
                      padding: "10px 12px",
                    }}
                  >
                    {q}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
