// Shared journal prompts — single source of truth for both
// the integration pages (pre/post ceremony) and the comprehensive journal.
//
// Storage keys used by both views:
//   Pre-ceremony  — `w{weekIdx}-p{promptIdx}` in pre_ceremony_progress.journal_responses
//   Post-ceremony — `w{weekIdx}-p{promptIdx}` in post_ceremony_progress.journal_responses
//   PNE reflections (pre)  — `pre-pne-reflection-w{weekIdx}` in pre_ceremony_progress.journal_responses
//   PNE reflections (post) — `post-pne-reflection-w{weekIdx}` in post_ceremony_progress.journal_responses

export type JournalPrompt = {
  q: string
  hint?: string
  // Optional explicit storage key. When present, this overrides the implicit
  // `w{weekIdx}-p{promptIdx}` pattern so prompts can be reordered without
  // re-attaching members' existing entries to the wrong question. Used
  // wherever a week's display order has shifted since the original launch.
  key?: string
}

export type JournalWeek = {
  code: string
  theme: string
  title?: string
  prompts: JournalPrompt[]
}

// Per-week PNE practice + reflection. Empty reflection => no writable prompt
// (rendered as "Coming Soon" on the integration page; skipped in the
// comprehensive journal unless the member has an existing entry).
//
// Storage keys for reflection responses:
//   Primary  — `pre-pne-reflection-w{weekIdx}` (or `post-…`)
//   Follow-up — `pre-pne-reflection-w{weekIdx}-2` when reflectionFollowUp is set
export type PneWeekDetails = {
  // Synopsis shown in the PNE Teaching video card on the integration page.
  // Empty string falls back to the generic "A teaching from PsychoNeuroEnergetics
  // paired with this week's principle and the body's lived response to it."
  teaching?: string
  practice: string
  reflection: string
  reflectionFollowUp?: string
}

export const PRE_PNE_DETAILS: ReadonlyArray<PneWeekDetails> = [
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: internal safety, what happens when the system senses threat, and how internal and external structures build the ground your nervous system can rest into.',
    practice: 'Breath regulation practice',
    reflection: 'What do I notice differently in my body after practicing the 4 / 7 / 8 Breath?',
  },
  {
    teaching: 'A Polyvagal Neuroscience-Informed framework for understanding how your body moves between states of safety, protection, and rest, and how to support its natural return to balance.',
    practice: '',
    reflection: 'Where do I go when I feel dysregulated? What is my dominant pattern — fight, flight, freeze, or fawn?',
    reflectionFollowUp: 'What situations tend to call these patterns forward most quickly in your life?',
  },
  { practice: '', reflection: 'When I am stressed, where do I notice it in my body, and how do I create safety within myself? What brings me back to center?' },
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: the five primary emotions and the intelligence each one carries, the secondary patterns layered on top, and how to let what has been long held finally move through.',
    practice: '',
    reflection: 'When you feel anger, what sensations arise in your body? When you feel sadness? When you feel fear?',
    reflectionFollowUp: 'What emotions had no safe place at home as you were growing up? What did your parents, directly or indirectly, teach you about feeling?',
  },
  { practice: '', reflection: '' },
  { practice: '', reflection: '' },
]

export const POST_PNE_DETAILS: ReadonlyArray<PneWeekDetails> = [
  { practice: '', reflection: '' },
  { practice: '', reflection: '' },
  { practice: '', reflection: '' },
  { practice: '', reflection: '' },
  { practice: '', reflection: '' },
  { practice: '', reflection: '' },
]

export const PRE_CEREMONY_WEEKS: JournalWeek[] = [
  {
    code: 'IKE',
    theme: 'Perception',
    title: 'Seeing clearly',
    prompts: [
      { key: 'w0-p1', q: 'If I create my reality, what’s possible for my life after this journey?' },
      { key: 'w0-p2', q: 'What stories am I still believing that no longer belong to the life I want?' },
    ],
  },
  {
    code: 'MAKIA',
    theme: 'Focus',
    title: 'Energy flows where attention goes',
    prompts: [
      { q: 'Where is most of your energy going right now? What is receiving the most of you, and does that feel true?' },
      { q: 'What are you most afraid of?', hint: 'Fear named loses half its power.' },
      { q: 'What do you resist the most?' },
      { q: 'What have your closest relationships shown you about where you withhold or overgive?' },
    ],
  },
  {
    code: 'MANAWA',
    theme: 'Presence',
    title: 'The body is the experience',
    prompts: [
      { q: 'What choices am I proud of, and which ones do I wish I had made differently?' },
      { q: 'Where am I holding onto something I cannot change, and what is actually mine to choose now?' },
    ],
  },
  {
    code: 'KALA',
    theme: 'Release',
    title: 'Iboga sees everything',
    prompts: [
      { q: 'Where am I lying to myself, and where am I living out of integrity as a result?', hint: 'Iboga sees everything. Arrive having already looked.' },
      { q: 'What shadows are showing up right now? What patterns keep returning?', hint: 'The shadow is the part of yourself you have hidden, denied, or disowned, often because it was not safe or acceptable to express. Write freely about what you have kept in the dark.' },
      { q: 'What is my relationship to shame? Where does it show up, and how has it shaped me?', hint: 'Shame seen clearly begins to lose its grip.' },
    ],
  },
  {
    code: 'ALOHA',
    theme: 'Connection',
    title: 'You walk this with others',
    prompts: [
      { q: 'How can I be more compassionate with myself?' },
      { q: 'Who do I need to forgive? What do I need to forgive in myself?', hint: 'Forgiveness is releasing the weight you carry on their behalf.' },
      { q: 'How will I connect with my support team, and what specific support will I ask for from them?', hint: 'Be specific. The more specific the ask, the more support lands.' },
    ],
  },
  {
    code: 'MANA',
    theme: 'Sovereignty',
    title: 'Trust your preparation',
    prompts: [
      { q: 'What am I ready to receive?', hint: 'Write from your body, your heart, your life — what you are ready to receive and live into.' },
      { q: 'What am I committed to after this ceremony? Be as concrete as possible.', hint: 'The medicine amplifies what you bring into ceremony.' },
    ],
  },
]

export const POST_CEREMONY_WEEKS: JournalWeek[] = [
  {
    code: 'LŌKAHI',
    theme: 'Unity',
    title: 'The medicine is still moving in you',
    prompts: [
      { q: 'What did the medicine show me?', hint: 'What was revealed about yourself, your nature, your life.' },
      { q: 'What did the ceremony reveal that surprised me, or that I did not know before receiving the medicine?', hint: 'Stay with what was unexpected.' },
      { q: 'What images, impressions, or moments from ceremony keep returning? What feels most alive or most unresolved?', hint: 'Record them. The meaning arrives in its own time.' },
      { q: 'Where did I feel the most resistance during the journey? What was I holding onto, and what happened when I let go?', hint: 'Resistance during ceremony is information.' },
      { q: 'What is one thing I am committed to begin? What am I committed to release?', hint: 'Trust the impulse. Write it before the mind catches up.' },
    ],
  },
  {
    code: 'HOʻOPONOPONO',
    theme: 'Forgiveness',
    title: 'The forgiveness work continues',
    prompts: [
      { q: 'Who or what am I still in the process of forgiving, including myself? What would forgiveness make possible in my life?', hint: 'Forgiveness is the weight you stop carrying on their behalf, including your own.' },
      { q: 'Where in my life am I taking less than full responsibility, and what shifts when I claim 100% of it?', hint: 'Hoʻoponopono begins with "I\'m sorry."' },
      { q: 'What am I genuinely grateful for in the very situation that has been hardest? What does it feel like in the body to hold responsibility, forgiveness, gratitude, and love for myself and this situation at once?', hint: 'Gratitude inside the difficulty is where the medicine roots.' },
    ],
  },
  {
    code: 'MĀLAMA',
    theme: 'Tending',
    title: 'The insights are alive — now you tend them',
    prompts: [
      { key: 'w1-p2', q: 'Where am I meeting myself differently in daily life? What have I noticed about the way I move through the world since returning home?', hint: 'Small shifts count. A changed reaction. A pause before responding. Name them.' },
      { key: 'w1-p3', q: 'How am I tending to myself differently since ceremony?', hint: 'Notice the small shifts in how you eat, rest, move, listen. Name what is being cared for now that was not before.' },
      { key: 'w1-p4', q: 'What is one practice I am committing to, to care for myself in this season?', hint: 'One practice. Liveable. Something you can return to on the days you least feel like it.' },
    ],
  },
  {
    code: 'HAʻAHAʻA',
    theme: 'Humility',
    title: 'The familiar is returning — meet it differently',
    prompts: [
      { key: 'w2-p2', q: 'What old patterns, reactions, or beliefs have I noticed returning, and how am I choosing to meet them now?', hint: 'Return is part of the spiral. How you respond now is what matters.' },
      { key: 'w2-p1', q: 'What do I want to say to my pre-ceremony self — the one who was afraid, uncertain, or carrying so much?', hint: 'Write them a letter if you wish.' },
    ],
  },
  {
    code: 'PONO',
    theme: 'Right Relationship',
    title: 'You have changed — your relationships are noticing',
    prompts: [
      { key: 'w5-p0', q: 'How has my sense of purpose shifted or clarified? What am I called to create, offer, or become in this next chapter?', hint: 'Purpose often surfaces in ceremony more clearly than we expect.' },
      { key: 'w5-p1', q: 'Who am I now? How would I describe the person who arrived, and the person standing here today?' },
      { key: 'w5-p1b', q: 'What new beliefs or stories are taking shape in me, the ones that support who I am committed to being today and moving forward?' },
      { key: 'w5-p2', q: 'What does pono mean to me? What are my values now, and how will I live them moving forward?', hint: 'For example, to live authentically and honestly, to practice moderation, or to practice compassion with yourself and others.' },
    ],
  },
  {
    code: 'KULEANA',
    theme: 'Responsibility',
    title: 'Six weeks in — the knowing is yours now',
    prompts: [
      { key: 'w5-completion-1', q: 'What genuinely changed?', hint: 'Actual, lived change. How do you move through the world differently now? Name specific behaviors, responses, ways of being.' },
      { key: 'w5-completion-3', q: 'What am I committed to in the next six months?', hint: 'One sentence. Concrete and liveable. Something you can return to and know immediately whether you kept it.' },
      { key: 'w5-accountability', q: 'How will I hold myself accountable, and how will I ask for continued support with my home circle?', hint: 'Name the people in your home circle and what you are asking them to hold with you.' },
    ],
  },
]
