// Single source of truth for the PNE (PsychoNeuroEnergetics) Companion weeks.
//
// Drives:
//   - /portal/pne                            (the Resources landing page)
//   - /portal/somatic-companion[/week-N]     (per-week companion pages)
//   - PRE_PNE_COMPANION / POST_PNE_COMPANION (linked from the integration
//     pages — see app/portal/integration/{pre,post}-ceremony/page.tsx)
//
// Adding/editing a week here automatically refreshes the landing page,
// the integration page links, and any future video library that reads
// from this file.

export type CompanionStatus = "live" | "coming-soon"

export type PneCompanion = {
  phase: "pre" | "post"
  weekIdx: number          // 0..5
  code: string             // 'IKE', 'MAKIA', …
  theme: string            // 'Perception', 'Focus', …
  title: string            // companion theme, e.g. 'The Language of the Body'
  href: string             // page URL (always set; "coming-soon" links still
                           //   resolve to the landing if the page is unbuilt)
  status: CompanionStatus
  videoSummary: string
  // YouTube embed URL (https://www.youtube.com/embed/<id>). When set, the
  // /portal/pne week row and the /portal/integration/{pre,post}-ceremony
  // PNE Perspective section render the iframe in place of the placeholder.
  videoUrl?: string
}

export const PNE_COMPANIONS: ReadonlyArray<PneCompanion> = [
  // ── Pre-ceremony ─────────────────────────────────────────────
  {
    phase: "pre",
    weekIdx: 0,
    code: "IKE",
    theme: "Perception",
    title: "The Language of the Body",
    href: "/portal/somatic-companion",
    status: "live",
    videoSummary:
      "Internal safety, what happens when the system senses threat, and how internal and external structures build the ground your nervous system can rest into.",
    videoUrl: "https://www.youtube.com/embed/k_hxugBtDIw?rel=0",
  },
  {
    phase: "pre",
    weekIdx: 1,
    code: "MAKIA",
    theme: "Focus",
    title: "Nervous System Regulation",
    href: "/portal/somatic-companion/week-2",
    status: "live",
    videoSummary:
      "Tracking the body through fight, flight, freeze, and fawn, and the practices that bring the system back to center.",
    videoUrl: "https://www.youtube.com/embed/G5bU4kuRDKs?rel=0",
  },
  {
    phase: "pre",
    weekIdx: 2,
    code: "MANAWA",
    theme: "Presence",
    title: "Building Somatic Awareness",
    href: "/portal/somatic-companion/week-3",
    status: "live",
    videoSummary:
      "Listening to sensation as information, and learning to stay with what arises in the body.",
  },
  {
    phase: "pre",
    weekIdx: 3,
    code: "KALA",
    theme: "Release",
    title: "The Language of Emotion",
    href: "/portal/somatic-companion/week-4",
    status: "live",
    videoSummary:
      "The five primary emotions, the secondary patterns layered on top, and how to let what has been long held finally move through.",
  },
  {
    phase: "pre",
    weekIdx: 4,
    code: "ALOHA",
    theme: "Connection",
    title: "The Architecture of Belief",
    href: "/portal/somatic-companion/week-5",
    status: "live",
    videoSummary:
      "Beliefs as embodied patterns, the survival truths that hold suffering in place, and how a trauma imprint softens when the body feels safe enough to know something new.",
  },
  {
    phase: "pre",
    weekIdx: 5,
    code: "MANA",
    theme: "Sovereignty",
    title: "Spirit and the Sacred",
    href: "/portal/somatic-companion/week-6",
    status: "live",
    videoSummary:
      "Iboga as spiritual encounter, the life review that arises in ceremony, your own relationship to Higher Power, the PNE lens of ancestral healing, discerning the voice of the Divine, prayers to carry, and integration as ongoing spiritual practice.",
  },

  // ── Post-ceremony ────────────────────────────────────────────
  {
    phase: "post",
    weekIdx: 0,
    code: "MAHALO",
    theme: "Gratitude",
    title: "Begin in Gratitude",
    href: "/portal/pne",
    status: "coming-soon",
    videoSummary: "Coming Soon.",
  },
  {
    phase: "post",
    weekIdx: 1,
    code: "LŌKAHI",
    theme: "Unity",
    title: "The Medicine Is Still Moving",
    href: "/portal/pne",
    status: "coming-soon",
    videoSummary: "Coming Soon.",
  },
  {
    phase: "post",
    weekIdx: 2,
    code: "MĀLAMA",
    theme: "Tending",
    title: "Tending What Was Revealed",
    href: "/portal/pne",
    status: "coming-soon",
    videoSummary: "Coming Soon.",
  },
  {
    phase: "post",
    weekIdx: 3,
    code: "HAʻAHAʻA",
    theme: "Humility",
    title: "Meeting the Familiar Differently",
    href: "/portal/pne",
    status: "coming-soon",
    videoSummary: "Coming Soon.",
  },
  {
    phase: "post",
    weekIdx: 4,
    code: "PONO",
    theme: "Right Relationship",
    title: "Standing in Right Relationship",
    href: "/portal/pne",
    status: "coming-soon",
    videoSummary: "Coming Soon.",
  },
  {
    phase: "post",
    weekIdx: 5,
    code: "KULEANA",
    theme: "Responsibility",
    title: "The Knowing Is Yours Now",
    href: "/portal/pne",
    status: "coming-soon",
    videoSummary: "Coming Soon.",
  },
]

export function companionsFor(phase: "pre" | "post"): ReadonlyArray<PneCompanion> {
  return PNE_COMPANIONS.filter((c) => c.phase === phase)
}

// ─── Additional Vital Kauaʻi resources surfaced on the PNE landing ───────────
export type PneAdditionalResource = {
  title: string
  description: string
  href: string
  status: CompanionStatus
}

export const PNE_ADDITIONAL_RESOURCES: ReadonlyArray<PneAdditionalResource> = [
  {
    title: "Member Intake & Readiness Form",
    description: "The health, history, and intention questionnaire that grounds your preparation with us.",
    href: "/intake-form-legacy.html",
    status: "live",
  },
  {
    title: "Iboga Preparedness Guide",
    description: "The full medical, somatic, and logistical preparation framework.",
    href: "/iboga-preparedness-guide.html",
    status: "live",
  },
  {
    title: "Questions for the Medicine",
    description: "A living document where you shape the questions you carry into ceremony.",
    href: "/portal/questions",
    status: "live",
  },
  {
    title: "Physician Reference Guide",
    description: "Required lab work, contraindications, and medical context to share with your physician.",
    href: "/portal/physician-guide",
    status: "live",
  },
  {
    title: "Dietary Guide",
    description: "Foundation principles, whole-food preparation, and the supplement protocol that ready the body for ceremony.",
    href: "/portal/dietary",
    status: "live",
  },
  {
    title: "Support Person Guide",
    description: "For the people who love you, how to show up well, before and after ceremony.",
    href: "/portal/support-person",
    status: "live",
  },
  {
    title: "Packing Guide",
    description: "What to bring for your journey with us, practical and intentional.",
    href: "/portal/what-to-bring",
    status: "live",
  },
  {
    title: "Ceremony Day Guide",
    description: "A walkthrough of the day itself — flow, support, what to bring close.",
    href: "/ceremony-day-guide.html",
    status: "live",
  },
  {
    title: "Ceremony Guidelines",
    description: "How we hold the container, and what to expect inside it.",
    href: "/portal/ceremony-guidelines",
    status: "live",
  },
  {
    title: "Recommended Reading",
    description: "A curated reading list spanning iboga and plant medicine, the science of the mind, and the great spiritual traditions.",
    href: "/portal/reading-list",
    status: "live",
  },
]
