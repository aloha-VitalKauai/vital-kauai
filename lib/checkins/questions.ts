// Weekly check-in questions — the shared contract between the stored
// questions_snapshot jsonb, the member-facing renderer, and the submit
// validation. The snapshot is the single source of truth for what a member
// was asked: the UI renders from it and the server validates against it, so
// question wording and count can change per week (and per template version)
// with zero code changes here.
//
// Snapshot shape (established by the Build 1 seed):
//   [{ key, type: "scale", label, min, max, required? },
//    { key, type: "text",  label, required? }]

export type ScaleQuestion = {
  key: string;
  type: "scale";
  label: string;
  min: number;
  max: number;
  required?: boolean;
};

export type TextQuestion = {
  key: string;
  type: "text";
  label: string;
  required?: boolean;
};

export type CheckinQuestion = ScaleQuestion | TextQuestion;

/** A member's answers, keyed by question key — the shape stored in
    member_checkins.responses. Scales save as numbers, text as strings. */
export type CheckinResponses = Record<string, number | string>;

// Bounds a single text answer. Generous for a reflective note, small enough
// that a runaway payload can't balloon the row.
export const MAX_TEXT_ANSWER_LENGTH = 5000;

/** Narrow a questions_snapshot jsonb value to the questions this build knows
    how to render and validate. Unknown or malformed entries are dropped
    rather than crashing the page — the founder-side card still shows the
    stored answers verbatim, so nothing is lost, and a future question type
    ships with its renderer in the same PR. */
export function parseQuestionsSnapshot(snapshot: unknown): CheckinQuestion[] {
  if (!Array.isArray(snapshot)) return [];
  const out: CheckinQuestion[] = [];
  for (const entry of snapshot) {
    if (typeof entry !== "object" || entry === null) continue;
    const q = entry as Record<string, unknown>;
    if (typeof q.key !== "string" || q.key.length === 0) continue;
    if (typeof q.label !== "string" || q.label.length === 0) continue;
    if (q.type === "scale") {
      if (typeof q.min !== "number" || typeof q.max !== "number" || q.min >= q.max) continue;
      out.push({
        key: q.key,
        type: "scale",
        label: q.label,
        min: q.min,
        max: q.max,
        required: q.required === true,
      });
    } else if (q.type === "text") {
      out.push({ key: q.key, type: "text", label: q.label, required: q.required === true });
    }
  }
  return out;
}

export type ValidationResult =
  | { ok: true; responses: CheckinResponses }
  | { ok: false; errors: string[] };

/** Validate a member's submitted answers against the questions they were
    actually shown. Returns the cleaned responses to store: only known
    question keys survive (anything else in the payload is discarded), text
    is trimmed, and every stored value has already passed its question's own
    rule. */
export function validateResponses(
  questions: CheckinQuestion[],
  submitted: unknown,
): ValidationResult {
  if (typeof submitted !== "object" || submitted === null || Array.isArray(submitted)) {
    return { ok: false, errors: ["Answers must be an object keyed by question."] };
  }
  const raw = submitted as Record<string, unknown>;
  const errors: string[] = [];
  const responses: CheckinResponses = {};

  for (const q of questions) {
    const value = raw[q.key];
    const missing =
      value === undefined || value === null || (typeof value === "string" && value.trim() === "");
    if (missing) {
      if (q.required) errors.push(`"${q.label}" needs an answer.`);
      continue;
    }
    if (q.type === "scale") {
      if (typeof value !== "number" || !Number.isInteger(value) || value < q.min || value > q.max) {
        errors.push(`"${q.label}" needs a whole number between ${q.min} and ${q.max}.`);
        continue;
      }
      responses[q.key] = value;
    } else {
      if (typeof value !== "string") {
        errors.push(`"${q.label}" needs a written answer.`);
        continue;
      }
      const trimmed = value.trim();
      if (trimmed.length > MAX_TEXT_ANSWER_LENGTH) {
        errors.push(`"${q.label}" is limited to ${MAX_TEXT_ANSWER_LENGTH} characters.`);
        continue;
      }
      responses[q.key] = trimmed;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, responses };
}
