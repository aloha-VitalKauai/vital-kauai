// Shared "Questions for the Medicine" (aka questions for the plant) config.
//
// Single source of truth for the section metadata and the storage-key scheme,
// imported by both the member-facing portal editor (app/portal/questions) and
// the read-only founder viewer. Members write their own questions; each answer
// is stored in member_journals.responses under `qftm-s{sectionIdx}-q{qIdx}`.

export const MEDICINE_QUESTION_SECTIONS = [
  {
    num: "1",
    label: "Healing & the Body",
    title: "What do you want to heal?",
    subtitle:
      "Physical, emotional, relational, what are you carrying that is ready to be released?",
    examples: [
      "How can I heal my chronic pain?",
      "What is the root of my anxiety, and how do I release it?",
      "Where is my grief living in my body, and what does it need from me?",
    ],
    count: 4,
  },
  {
    num: "2",
    label: "Blind Spots & Shadows",
    title: "What do I most need to see?",
    subtitle:
      "What patterns, beliefs, or truths are ready to come into the light, about yourself, others, or the life you are living?",
    examples: [
      "What do I most need to see right now?",
      "Where am I lying to myself?",
      "What shadows are alive in me that I have been unwilling to face?",
    ],
    count: 4,
  },
  {
    num: "3",
    label: "Forgiveness & Relationships",
    title: "Who do you need to forgive?",
    subtitle:
      "Toward yourself and others, where is there unresolved pain, resentment, or grief that is ready to be met with grace?",
    examples: [
      "How can I forgive myself for _____?",
      "What do I need to understand about _____ in order to release what happened between us?",
      "Where am I out of integrity, and what needs to be made right?",
    ],
    count: 4,
  },
  {
    num: "4",
    label: "Purpose & Becoming",
    title: "Who are you becoming?",
    subtitle:
      "Beyond healing, what are you moving toward? What life, version of yourself, or quality of being are you called to step into?",
    examples: [
      "What is my purpose, and am I living it fully?",
      "What do I need to let go of in order to live a more whole and vital life?",
      "After this journey, what becomes possible for me?",
    ],
    count: 4,
  },
  {
    num: "5",
    label: "Your Own Voice",
    title: "What else is in your heart?",
    subtitle:
      "Any question that arises from your own knowing, trust it. Write it down exactly as it comes.",
    examples: [],
    count: 6,
  },
] as const;

// Prefix used for Questions-for-the-Medicine keys inside the shared
// member_journals.responses JSONB blob, so they don't collide with the
// pre/post-ceremony journal prompt keys.
export const QFTM_PREFIX = "qftm-";

export type MedicineQuestionGroup = {
  label: string;
  title: string;
  questions: string[];
};

// Given the raw member_journals.responses map, return the member's written
// questions grouped by section (non-empty only), for read-only founder display.
export function extractMedicineQuestions(
  responses: Record<string, string> | null | undefined,
): MedicineQuestionGroup[] {
  const map = responses ?? {};
  return MEDICINE_QUESTION_SECTIONS.map((section, si) => {
    const questions = Array.from({ length: section.count }, (_, qi) =>
      (map[`${QFTM_PREFIX}s${si}-q${qi}`] ?? "").trim(),
    ).filter(Boolean);
    return { label: section.label, title: section.title, questions };
  }).filter((group) => group.questions.length > 0);
}
