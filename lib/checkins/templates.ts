// Weekly check-in question editor — the model between the founder UI and
// publish_checkin_template(). The editor works on EditorQuestion rows (the
// fields the merged renderer actually supports: label, scale|text, required);
// buildQuestionsPayload() validates them and produces the exact jsonb shape
// Build 1 seeded and the /portal/checkin renderer consumes. Scale questions
// are always 1-5, matching the seed — the editor exposes no min/max.

import {
  parseQuestionsSnapshot,
  type CheckinQuestion,
} from "@/lib/checkins/questions";

export type EditorQuestion = {
  key: string;
  label: string;
  type: "scale" | "text";
  required: boolean;
};

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;
export const MAX_QUESTIONS_PER_WEEK = 12;
const MAX_LABEL_LENGTH = 300;

/** The active template's questions, as editable rows. */
export function toEditorQuestions(snapshot: unknown): EditorQuestion[] {
  return parseQuestionsSnapshot(snapshot).map((q) => ({
    key: q.key,
    label: q.label,
    type: q.type,
    required: q.required === true,
  }));
}

/** A fresh question for "+ Add Question": text, optional, unique key. */
export function newEditorQuestion(existing: EditorQuestion[]): EditorQuestion {
  const taken = new Set(existing.map((q) => q.key));
  let n = existing.length + 1;
  while (taken.has(`q${n}`)) n += 1;
  return { key: `q${n}`, label: "", type: "text", required: false };
}

export type PayloadResult =
  | { ok: true; questions: CheckinQuestion[] }
  | { ok: false; errors: string[] };

/** Validate the editor rows and build the publishable questions array.
    Keys are preserved (so an unchanged question keeps its identity across
    versions) and must stay unique; labels must be present and bounded. */
export function buildQuestionsPayload(rows: EditorQuestion[]): PayloadResult {
  const errors: string[] = [];
  if (rows.length === 0) errors.push("A week needs at least one question.");
  if (rows.length > MAX_QUESTIONS_PER_WEEK) {
    errors.push(`A week is limited to ${MAX_QUESTIONS_PER_WEEK} questions.`);
  }

  const seen = new Set<string>();
  rows.forEach((row, idx) => {
    const label = row.label.trim();
    if (label.length === 0) errors.push(`Question ${idx + 1} needs its text.`);
    if (label.length > MAX_LABEL_LENGTH) {
      errors.push(`Question ${idx + 1} is limited to ${MAX_LABEL_LENGTH} characters.`);
    }
    if (row.type !== "scale" && row.type !== "text") {
      errors.push(`Question ${idx + 1} has an unsupported type.`);
    }
    if (!row.key || seen.has(row.key)) {
      errors.push(`Question ${idx + 1} needs a unique key.`);
    }
    seen.add(row.key);
  });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    questions: rows.map((row) =>
      row.type === "scale"
        ? {
            key: row.key,
            type: "scale",
            label: row.label.trim(),
            min: SCALE_MIN,
            max: SCALE_MAX,
            required: row.required,
          }
        : { key: row.key, type: "text", label: row.label.trim(), required: row.required },
    ),
  };
}
