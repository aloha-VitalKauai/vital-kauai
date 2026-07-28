// Vital Kauaʻi Participant Safety and Informed Consent Agreement.
// Source of truth for both the member-facing signing flow at
// /portal/safety-agreement and the printable copy under
// /dashboard/sops → Important Documents.
//
// Edit the text here and both surfaces update.

export type AgreementBullet = string;

export type AgreementSection = {
  id: string;       // stable key — used to store per-section initials
  number: string;   // display label, e.g. "1"
  heading: string;
  body?: string[];  // paragraphs
  items?: AgreementBullet[];
  /** If true, this section has an extra yes/no preference question. */
  preference?: {
    intro: string;
    questions: { id: string; text: string }[];
    closing?: string;
  };
};

export const SAFETY_AGREEMENT_TITLE =
  "Participant Safety and Informed Consent Agreement";
export const SAFETY_AGREEMENT_SUBTITLE = "Vital Kauaʻi Church";

export const SAFETY_AGREEMENT_PREAMBLE =
  "This agreement names the safety frame within which Vital Kauaʻi Church holds ceremony, and the participation each member is committing to. Read every section with care. Initial each section as you go, and sign at the end. Your initials and signature confirm that you have read, understood, and agreed to every section above your signature.";

export const SAFETY_AGREEMENT_SECTIONS: AgreementSection[] = [
  {
    id: "safety-commitment",
    number: "1",
    heading: "Commitment to Safety in Ceremony",
    body: [
      "The ceremony arc unfolds within an intentionally held container. By entering, you agree to honor the practices that keep that container safe for yourself and for everyone held alongside you.",
    ],
    items: [
      "Remain on the designated ceremony land for the duration of the ceremony arc, except when accompanied by a Vital Kauaʻi staff member.",
      "Respect the silence, stillness, and inner experience of every other member held in the same container.",
      "Follow the guidance of Vital Kauaʻi practitioners and stewards throughout the arc.",
    ],
  },
  {
    id: "medication-and-substance-use",
    number: "2",
    heading: "Medication and Substance Use",
    body: [
      "Iboga has clear medical considerations and interacts with many medications and substances. To protect you and the others held with you, the following applies.",
    ],
    items: [
      "All current medications, supplements, and substances have been disclosed in full during medical screening and intake.",
      "No unauthorized substances — pharmaceutical, recreational, or supplemental — are brought onto the ceremony land or consumed during the arc.",
      "Any change in medication or supplement use between intake and ceremony is communicated to a Vital Kauaʻi staff member before ceremony begins.",
      "Failure to disclose may result in dismissal from the ceremony arc, without refund.",
    ],
  },
  {
    id: "early-departures",
    number: "3",
    heading: "Early Departures and Emergency Situations",
    body: [
      "From time to time a member faces a situation that asks them to leave before the ceremony arc is complete. The frame below preserves both your safety and the integrity of the container.",
    ],
    items: [
      "Your choice to depart before the scheduled end of the arc is honored. Once you have left the land, Vital Kauaʻi is no longer responsible for your safety or wellbeing.",
      "Early departures are coordinated with a Vital Kauaʻi staff member and follow the safety protocols already in place.",
      "No refunds are issued for early departures. By leaving early, the member accepts that they have chosen this path freely.",
    ],
  },
  {
    id: "departure-date",
    number: "4",
    heading: "Departure Date",
    body: [
      "The ceremony arc concludes on the morning of the final day. Once the closing has happened, your onward journey is yours to coordinate.",
    ],
    items: [
      "Members arrange their own transportation off the land on the final day, unless coordinated in advance with Vital Kauaʻi.",
      "Vital Kauaʻi is not responsible for travel logistics, accommodation, or care beyond the conclusion of the ceremony arc.",
    ],
  },
  {
    id: "sleep-and-safety",
    number: "5",
    heading: "Sleep and Safety Policy",
    body: [
      "Iboga affects perception, judgment, motor function, and decision-making for an extended period. Your safety during this window depends on remaining rested and remaining on the land.",
    ],
    items: [
      "Members remain on the ceremony land each night of the arc, and do not depart on their own until they have had a full night of sleep following the medicine ceremony.",
      "Members deemed by practitioners and stewards to still be under the influence of Iboga do not drive, swim, hike, or otherwise leave the land without escort.",
    ],
  },
  {
    id: "no-leaving-grounds",
    number: "6",
    heading: "No Leaving Grounds Unaccompanied",
    body: [
      "During the most vulnerable part of the arc, leaving the held land without a staff member exposes the member and the container to avoidable risk.",
    ],
    items: [
      "Members do not leave the ceremony land alone during the active medicine and emergence phases.",
      "Hikes, excursions, and time off-land happen with a Vital Kauaʻi staff member present or with explicit prior agreement.",
      "This frame extends through the stillness day that follows the medicine ceremony.",
    ],
  },
  {
    id: "voluntary-forfeiture",
    number: "7",
    heading: "Voluntary Agreement to Remain on the Land",
    body: [
      "By signing this agreement, you voluntarily agree to remain on the ceremony land through the medicine ceremony and the first full night that follows, except in coordinated departures as outlined above. This frame exists because the safety of the medicine arc depends on it, for you and for everyone in the container with you.",
    ],
  },
  {
    id: "stillness-day-protocols",
    number: "8",
    heading: "Post-Ceremony Stillness Day Protocols",
    body: [
      "The day after the medicine ceremony is held as a stillness day — a recovery and integration day. The frame below allows the body and nervous system to land safely.",
    ],
    items: [
      "No unsupervised hikes, swims, or excursions on stillness day. Movement happens with a Vital Kauaʻi staff member.",
      "Phones remain in the care of Vital Kauaʻi staff during stillness day. A member who needs to use their phone requests it from staff, who may decline or postpone based on the member's state.",
    ],
  },
  {
    id: "rest-and-reflection",
    number: "9",
    heading: "Rest and Reflection",
    body: [
      "The stillness day asks for genuine rest. Physical exertion is honored as something to limit, not something to push through.",
    ],
    items: [
      "Members keep physical exertion within the bounds offered by practitioners and stewards.",
      "Members rest when rest is offered, and reach for staff support when something is alive that asks for attention.",
    ],
  },
  {
    id: "land-and-water",
    number: "10",
    heading: "The Land, the Ocean, and the Natural Environment",
    body: [
      "Vital Kauaʻi is held on wild, living land on the island of Kauaʻi, near the ocean, rivers, and forest trails. These places carry their own beauty and their own power, and conditions here shift with the weather, the tides, and the season in ways no one governs. Time on the land and in the water is part of what makes this place what it is, and it is entered as a sovereign adult, at your own choice.",
    ],
    items: [
      "You understand that Vital Kauaʻi is set on natural, undeveloped land whose conditions include uneven ground, streams and waterfalls, cliffs and rocks, changing weather, and the ordinary presence of wildlife. You move through it with awareness and care.",
      "You understand that the ocean and fresh water carry serious inherent risk, including strong currents, shore break, surf, and the risk of drowning, and that conditions change quickly and remain outside anyone's control.",
      "You enter any hiking, swimming, ocean or river time, excursion, or exploration as a sovereign adult at your own choice and risk, whether it is offered by Vital Kauaʻi, accompanied by staff, or chosen freely on your own time. You remain responsible for your own decisions, limits, and wellbeing.",
      "You release Vital Kauaʻi Church, its founders, practitioners, stewards, staff, and affiliates from claims of liability arising from these activities and from the natural condition of the land and water, except in cases of gross negligence as defined by law.",
    ],
  },
  {
    id: "general-liability",
    number: "11",
    heading: "General Liability and Acknowledgment of Risk",
    body: [
      "Voluntary participation in plant-medicine ceremony carries inherent physical, mental, emotional, and spiritual risk. By signing below, you acknowledge and accept that risk.",
    ],
    items: [
      "You participate voluntarily and accept full responsibility for your own physical, mental, emotional, and spiritual wellbeing throughout the arc.",
      "You release Vital Kauaʻi Church, its founders, practitioners, stewards, staff, and affiliates from claims of liability arising from voluntary participation, except in cases of gross negligence as defined by law.",
      "You confirm that all relevant medical and psychological history has been truthfully disclosed during intake and medical screening.",
    ],
  },
  {
    id: "psycho-spiritual-support",
    number: "12",
    heading: "Psycho-Spiritual Journey Support",
    body: [
      "Vital Kauaʻi offers the option of an additional facilitator present as a neutral witness during the medicine ceremony — a person whose role is to hold space, offer reflective questions when invited, and bear witness, without directing or interfering with the unfolding experience. This support is optional.",
    ],
    preference: {
      intro: "Indicate your preferences:",
      questions: [
        {
          id: "psycho-spiritual-support-wanted",
          text: "I would like the option of psycho-spiritual journey support during my ceremony.",
        },
        {
          id: "psycho-spiritual-neutral-witness",
          text: "I consent to an additional facilitator being present as a neutral third-party witness during my ceremony.",
        },
      ],
      closing:
        "Regardless of the selection above, Vital Kauaʻi practitioners and stewards remain present and available throughout the ceremony. Declining additional support does not mean you will be left alone or unheld. Saying no to a facilitator at any time during the ceremony is always honored; consent will be checked again before any guided support is offered.",
    },
  },
];

/** The fields that close the agreement out. Captured at signing. */
export const SAFETY_AGREEMENT_SIGNATURE_HEADING = "Acknowledgment and Signature";
export const SAFETY_AGREEMENT_SIGNATURE_INTRO =
  "By signing below, you confirm that you have read, understood, and agreed to every section of this agreement, and acknowledge that failure to adhere to these protocols may result in dismissal from the ceremony arc without refund.";

/** A flat list of the ids that need initials (every section). */
export const SAFETY_AGREEMENT_INITIAL_IDS = SAFETY_AGREEMENT_SECTIONS.map(
  (s) => s.id,
);
