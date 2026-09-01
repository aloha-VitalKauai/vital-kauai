"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  toEditorQuestions,
  newEditorQuestion,
  buildQuestionsPayload,
  MAX_QUESTIONS_PER_WEEK,
  type EditorQuestion,
} from "@/lib/checkins/templates";

/* Weekly Check-In Questions — founder editor for the weeks 1-13 question
   sets. Same visual vocabulary as the rest of the dashboard (cards, LABEL
   caps, week circles from the progress cards). Saving never edits a live
   version: publish_checkin_template() retires the current version and
   activates the new one atomically, and every already-created check-in
   keeps its own frozen snapshot. */

export type ActiveTemplateRow = {
  id: string;
  week_number: number;
  version: number;
  questions: unknown;
  updated_at: string;
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

const INPUT: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "8px 10px",
  border: "0.5px solid rgba(0,0,0,0.15)",
  borderRadius: 8,
  fontSize: 13,
  color: "#1A1A18",
  background: "#fff",
  fontFamily: "inherit",
};

const TOTAL_WEEKS = 13;
const GREEN = { bg: "#E1F5EE", text: "#085041", border: "#1D9E75" };

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; week: number }
  | { kind: "error"; messages: string[] };

export default function CheckinQuestionsPanel({
  templates,
  loadFailed,
}: {
  templates: ActiveTemplateRow[];
  loadFailed: boolean;
}) {
  const [byWeek, setByWeek] = useState<Map<number, ActiveTemplateRow>>(
    () => new Map(templates.map((t) => [t.week_number, t])),
  );
  const [week, setWeek] = useState(1);
  const [rows, setRows] = useState<EditorQuestion[]>(() =>
    toEditorQuestions(templates.find((t) => t.week_number === 1)?.questions ?? []),
  );
  const [dirty, setDirty] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const supabase = createClient();

  function openWeek(w: number) {
    setWeek(w);
    setRows(toEditorQuestions(byWeek.get(w)?.questions ?? []));
    setDirty(false);
    setSave({ kind: "idle" });
  }

  function edit(mutate: (next: EditorQuestion[]) => EditorQuestion[]) {
    setRows((cur) => mutate([...cur]));
    setDirty(true);
    setSave({ kind: "idle" });
  }

  async function saveWeek() {
    if (save.kind === "saving") return;
    const payload = buildQuestionsPayload(rows);
    if (!payload.ok) {
      setSave({ kind: "error", messages: payload.errors });
      return;
    }
    setSave({ kind: "saving" });
    const { error } = await supabase.rpc("publish_checkin_template", {
      p_week_number: week,
      p_questions: payload.questions,
    });
    if (error) {
      setSave({
        kind: "error",
        messages: [
          "Saving did not go through — the current questions are unchanged. Please try again.",
        ],
      });
      return;
    }
    // Re-read the newly active version so the panel shows what is now live.
    const { data: fresh } = await supabase
      .from("checkin_templates")
      .select("id, week_number, version, questions, updated_at")
      .eq("week_number", week)
      .eq("active", true)
      .maybeSingle();
    if (fresh) {
      setByWeek((cur) => new Map(cur).set(week, fresh as ActiveTemplateRow));
      setRows(toEditorQuestions((fresh as ActiveTemplateRow).questions));
    }
    setDirty(false);
    setSave({ kind: "saved", week });
  }

  const current = byWeek.get(week) ?? null;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
      <h1 style={{ fontFamily: "var(--font-display, serif)", fontSize: 26, fontWeight: 400, color: "#1A1A18", margin: "0 0 4px" }}>
        Weekly Check-In Questions
      </h1>
      <p style={{ fontSize: 13, color: "#6B6B67", margin: "0 0 20px" }}>
        Manage the questions members receive during each week of their 13-week journey.
      </p>

      {loadFailed ? (
        <div style={CARD}>
          <p style={{ fontSize: 13, color: "#6B6B67", margin: 0 }}>
            The question sets are taking a moment to load. Please refresh the page.
          </p>
        </div>
      ) : (
        <>
          <div style={{ ...CARD, marginBottom: 16 }}>
            <p style={LABEL}>Select a week</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map((w) => {
                const active = w === week;
                return (
                  <button
                    key={w}
                    type="button"
                    aria-pressed={active}
                    onClick={() => openWeek(w)}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 500,
                      background: active ? GREEN.bg : "#FAFAF8",
                      color: active ? GREEN.text : "#6B6B67",
                      border: active ? `1.5px solid ${GREEN.border}` : "0.5px solid rgba(0,0,0,0.1)",
                      cursor: "pointer",
                      padding: 0,
                      fontFamily: "inherit",
                    }}
                  >
                    {w}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={CARD}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
              <p style={{ fontFamily: "var(--font-display, serif)", fontSize: 20, fontWeight: 400, color: "#1A1A18", margin: 0 }}>
                Week {week}
              </p>
              <p style={{ fontSize: 11, color: "#9E9E9A", margin: 0 }}>
                {current
                  ? `Active version ${current.version}`
                  : "This week has no active question set yet — saving will create one."}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {rows.map((q, idx) => (
                <div key={q.key} style={{ padding: 12, background: "#FAFAF8", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ ...LABEL, marginBottom: 0 }}>Question {idx + 1}</p>
                    <button
                      type="button"
                      onClick={() => edit((next) => next.filter((_, i) => i !== idx))}
                      style={{ fontSize: 11, color: "#8B4513", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", fontFamily: "inherit" }}
                    >
                      Remove
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={q.label}
                    onChange={(e) =>
                      edit((next) => ((next[idx] = { ...next[idx], label: e.target.value }), next))
                    }
                    placeholder="Write the question exactly as the member will read it."
                    style={{ ...INPUT, resize: "vertical", marginBottom: 10, lineHeight: 1.5 }}
                  />
                  <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                    <label style={{ fontSize: 12, color: "#6B6B67", display: "flex", alignItems: "center", gap: 6 }}>
                      Type
                      <select
                        value={q.type}
                        onChange={(e) =>
                          edit((next) => ((next[idx] = { ...next[idx], type: e.target.value as EditorQuestion["type"] }), next))
                        }
                        style={{ ...INPUT, width: "auto", padding: "6px 8px" }}
                      >
                        <option value="scale">Scale (1–5)</option>
                        <option value="text">Free text</option>
                      </select>
                    </label>
                    <label style={{ fontSize: 12, color: "#6B6B67", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          edit((next) => ((next[idx] = { ...next[idx], required: e.target.checked }), next))
                        }
                      />
                      Required
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => edit((next) => [...next, newEditorQuestion(next)])}
                disabled={rows.length >= MAX_QUESTIONS_PER_WEEK}
                style={{ fontSize: 12, fontWeight: 500, color: "#1A1A18", background: "#fff", border: "0.5px solid rgba(0,0,0,0.25)", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontFamily: "inherit" }}
              >
                + Add Question
              </button>
              <button
                type="button"
                onClick={saveWeek}
                disabled={save.kind === "saving" || !dirty}
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: "#FDFBF7",
                  background: "#085041",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 18px",
                  cursor: save.kind === "saving" || !dirty ? "default" : "pointer",
                  opacity: save.kind === "saving" || !dirty ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {save.kind === "saving" ? "Saving…" : `Save Week ${week}`}
              </button>
              {save.kind === "saved" && (
                <span style={{ fontSize: 12, color: GREEN.text }}>
                  Week {save.week} questions updated.
                </span>
              )}
              {dirty && save.kind === "idle" && (
                <span style={{ fontSize: 11, color: "#9E9E9A" }}>Unsaved changes</span>
              )}
            </div>

            {save.kind === "error" && (
              <div style={{ marginTop: 12 }}>
                {save.messages.map((m) => (
                  <p key={m} style={{ fontSize: 12, color: "#A32D2D", margin: "0 0 4px" }}>
                    {m}
                  </p>
                ))}
              </div>
            )}

            <p style={{ fontSize: 11, color: "#9E9E9A", margin: "16px 0 0" }}>
              Saving creates a new question-set version for this week. Check-ins already
              sent or submitted keep the questions the member actually saw; check-ins
              created from now on use the new set.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
