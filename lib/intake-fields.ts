/**
 * Section groupings + friendly labels for every question on the
 * member-facing intake form (public/intake-form-legacy.html).
 *
 * Values are pulled from the typed column on `intake_forms` first, then
 * fall back to the `intake_forms.responses` jsonb (verbatim payload
 * captured by /api/intake/complete) for questions without a dedicated
 * column.
 *
 * Shared between the founder member-profile editor and the dedicated
 * /dashboard/[id]/intake review page so both render the same labels.
 */
export const INTAKE_SECTIONS: { title: string; fields: [string, string][] }[] = [
  {
    title: "Basic information",
    fields: [
      ["legal_name", "Full legal name"],
      ["preferred_name", "Preferred name / pronouns"],
      ["email", "Email"],
      ["location", "Location"],
    ],
  },
  {
    title: "Intention & orientation",
    fields: [
      ["primary_intention", "What is calling you to this work"],
      ["what_brings_you_here", "What brings you here"],
      ["life_purpose", "Purpose or mission"],
      ["ideal_life", "Ideal life / magic wand"],
      ["sacred_practice", "Relationship to sacred practice"],
    ],
  },
  {
    title: "Body & somatic awareness",
    fields: [
      ["body_relationship", "Relationship with your body"],
      ["physical_symptoms", "Physical symptoms / sensitivities"],
      ["grounding_practices", "What helps you feel safe & grounded"],
    ],
  },
  {
    title: "Emotional & psycho-spiritual",
    fields: [
      ["emotional_patterns", "Emotional patterns most present"],
      ["psychiatric_history", "Psychiatric history"],
      ["current_therapy", "Current therapist / coach / healer"],
    ],
  },
  {
    title: "Experience & history",
    fields: [
      ["personal_growth", "Personal growth / healing work"],
      ["previous_psychedelic_experience", "Past plant medicine / altered-state experience"],
      ["childhood_history", "Childhood & primary caregivers"],
      ["integration_history", "Past integration support"],
    ],
  },
  {
    title: "Health & safety",
    fields: [
      ["health_history", "Medical / health conditions"],
      ["current_medications", "Medications & supplements"],
      ["mental_health_status", "Current mental & emotional health"],
      ["substance_history", "Substance history"],
    ],
  },
  {
    title: "Support & environment",
    fields: [
      ["support_systems", "Support systems"],
      ["home_support_selection", "People holding space at home"],
      ["home_support_people", "Who they are"],
      ["ideal_integration_support", "Ideal integration support"],
    ],
  },
  {
    title: "Readiness & sovereignty",
    fields: [
      ["readiness_signals", "Signals of readiness for inner work"],
      ["self_care_practices", "Self-care during intensity"],
      ["boundaries_needs", "Boundaries / needs to know"],
      ["additional_notes", "Anything else for the care team"],
    ],
  },
  {
    title: "Acknowledgment & signature",
    fields: [
      ["signer_name", "Signed name"],
      ["signature", "Typed signature"],
      ["signed_date", "Signed date"],
    ],
  },
];

export const MENTAL_HEALTH_LABELS: Record<string, string> = {
  stable: "Stable & resourced",
  in_process: "In process — actively working",
  significant: "Significant challenges right now",
  crisis: "In crisis",
};

export const HOME_SUPPORT_LABELS: Record<string, string> = {
  one: "One trusted person",
  few: "A few people",
  help: "Need help identifying support",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function readIntakeValue(
  intake: Record<string, unknown>,
  key: string,
): string {
  // Typed column first, then jsonb responses fallback.
  const typed = intake[key];
  const responses = intake.responses;
  const raw =
    typed !== undefined && typed !== null && typed !== ""
      ? typed
      : responses && typeof responses === "object"
        ? (responses as Record<string, unknown>)[key]
        : undefined;
  if (raw === undefined || raw === null || raw === "") return "";
  if (key === "mental_health_status") return MENTAL_HEALTH_LABELS[String(raw)] || String(raw);
  if (key === "home_support_selection") return HOME_SUPPORT_LABELS[String(raw)] || String(raw);
  if (key === "signed_date") return fmtDate(String(raw));
  if (typeof raw === "string") return raw;
  return JSON.stringify(raw);
}

/**
 * Returns extra entries present in `responses` that aren't covered by any
 * INTAKE_SECTIONS field — keeps the review page forward-compatible if new
 * questions appear on the intake form before INTAKE_SECTIONS is updated.
 */
export function collectExtraResponses(
  intake: Record<string, unknown>,
): [string, string][] {
  const known = new Set<string>();
  for (const sec of INTAKE_SECTIONS) for (const [k] of sec.fields) known.add(k);
  const responses = intake.responses;
  if (!responses || typeof responses !== "object") return [];
  const extras: [string, string][] = [];
  for (const [k, v] of Object.entries(responses as Record<string, unknown>)) {
    if (known.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    extras.push([k, typeof v === "string" ? v : JSON.stringify(v)]);
  }
  return extras;
}
