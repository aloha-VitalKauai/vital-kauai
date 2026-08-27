// Shared journal prompts—single source of truth for both
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
//   Third — `pre-pne-reflection-w{weekIdx}-3` when reflectionThird is set
//   Fourth — `pre-pne-reflection-w{weekIdx}-4` when reflectionFourth is set
export type PneWeekDetails = {
  // Synopsis shown in the PNE Teaching video card on the integration page.
  // Empty string falls back to the generic "A teaching from PsychoNeuroEnergetics
  // paired with this week's principle and the body's lived response to it."
  teaching?: string
  practice: string
  reflection: string
  reflectionFollowUp?: string
  reflectionThird?: string
  reflectionFourth?: string
}

export const PRE_PNE_DETAILS: ReadonlyArray<PneWeekDetails> = [
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: internal safety, what happens when the system senses threat, and how internal and external structures can build safety.',
    practice: 'Breath regulation practice',
    reflection: 'What do you notice differently in your body after practicing the 4 / 7 / 8 Breath?',
  },
  {
    teaching: 'A Polyvagal Neuroscience-Informed framework for understanding how your body moves between states of safety, protection, and rest, and how to support its natural return to balance.',
    practice: '',
    reflection: 'Where do you go when you feel dysregulated? What is your dominant pattern—fight, flight, freeze, or fawn?',
    reflectionFollowUp: 'What situations tend to call these patterns forward most quickly in your life?',
  },
  {
    practice: '',
    reflection: 'How easily can you feel sensation in your body?',
    reflectionFollowUp: 'When sensation arrives, do you tend to feel it in one place, or in many?',
    reflectionThird: 'When you are stressed, what sensations do you notice most?',
  },
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: the five primary emotions and the intelligence each one carries, the secondary patterns layered on top, and how to let what has been long held finally move through.',
    practice: '',
    reflection: 'When you feel anger, what sensations arise in your body? When you feel sadness? When you feel fear?',
    reflectionFollowUp: 'What emotions had no safe place at home as you were growing up? What did your parents, directly or indirectly, teach you about feeling?',
  },
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: beliefs as embodied patterns the body has learned, the survival truths that hold suffering in place, and how a trauma imprint can soften when the body feels safe enough to know something new.',
    practice: '',
    reflection: 'What do you believe about yourself, others, pain, love, and safety that has made suffering feel necessary?',
    reflectionFollowUp: 'What do you believe you have to do or be in order to be loved, accepted, or safe?',
    reflectionThird: 'What parts of yourself do you feel you need to hide? Why?',
    reflectionFourth: 'What did you decide about yourself, life, the divine, or others during painful moments of your childhood?',
  },
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: iboga as a spiritual encounter, the life review that may arise in ceremony, your own relationship to Higher Power, trauma imprints as ancestral healing, discerning the voice of the Divine, prayers to carry, and integration as ongoing spiritual practice.',
    practice: '',
    reflection: 'How do you experience the sacred in your life right now? What practices already open you to something larger than yourself?',
    reflectionFollowUp: 'What unfinished energy in your family lineage might be asking to be completed through you?',
    reflectionThird: 'When guidance arises in your body, how do you tell the voice of inherited programming from the voice of the Divine?',
  },
]

export const POST_PNE_DETAILS: ReadonlyArray<PneWeekDetails> = [
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: the binary lens people fall into during conflict, what being right protects, how the paradigm is inherited through families, and the inquiry that opens in its place.',
    practice: 'Trading a verdict for a need',
    reflection: 'Where in your life are you most committed to being right? What would you have to feel if you set that position down?',
    reflectionFollowUp: 'What role were you cast in growing up—the responsible one, the hero, the scapegoat? What did that role protect the family from facing?',
    reflectionThird: 'Take one judgment you carry and rewrite it as a need. What changes in your body when you say the second version?',
  },
  {
    teaching: 'A teaching from PsychoNeuroEnergetics: how inner experience is received, what the body learns in the moments it is overridden, and the listening practices that return a person to their own authority.',
    practice: 'Reparative listening practice',
    reflection: 'Where in your life did you learn that your inner experience was better kept quiet? Who was in the room?',
    reflectionFollowUp: 'Of the ten listening errors, which one is most yours? What does reaching for it protect you from?',
    reflectionThird: 'What moved in your body the first time you asked someone, "Would you like me to just listen, or would ideas help?"',
  },
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
      { key: 'w0-p1', q: 'If you create your reality, what’s possible for your life after this journey?', hint: 'Take a moment to close your eyes, breathe, and see and feel the life you want.' },
      { key: 'w0-p2', q: 'What stories are you still believing that no longer serve the life you want?', hint: 'Describe your beliefs about yourself, relationships, work, money, health, spirituality, or religion.' },
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
      { q: 'What choices are you proud of, and which ones do you wish you had made differently?' },
      { q: 'Where are you holding onto something you cannot change, and what is actually yours to choose now?' },
      { q: 'Who or what are you still in the process of forgiving, including yourself? What would forgiveness make possible in your life?', hint: 'Forgiveness is the weight you stop carrying on their behalf, including your own.' },
      { q: 'Where in your life are you taking less than full responsibility, and what shifts when you claim 100% of it?', hint: 'Responsibility is where your power to change what comes next lives.' },
    ],
  },
  {
    code: 'KALA',
    theme: 'Release',
    title: 'Iboga sees everything',
    prompts: [
      { q: 'Where are you lying to yourself, and where are you living out of integrity as a result?', hint: 'Iboga sees everything. Arrive having already looked.' },
      { q: 'What shadows are showing up right now? What patterns keep returning?', hint: 'The shadow is the part of yourself you have hidden, denied, or disowned, often because it was not safe or acceptable to express. Write freely about what you have kept in the dark.' },
      { q: 'What is your relationship to shame? Where does it show up, and how has it shaped you?', hint: 'Shame seen clearly begins to lose its grip.' },
    ],
  },
  {
    code: 'ALOHA',
    theme: 'Connection',
    title: 'You walk this with others',
    prompts: [
      { q: 'How can you be more compassionate with yourself?' },
      { q: 'Who do you need to forgive? What do you need to forgive in yourself?', hint: 'Forgiveness is releasing the weight you carry on their behalf.' },
      { q: 'How will you connect with your support team, and what specific support will you ask for from them?', hint: 'Be specific. The more specific the ask, the more support lands.' },
    ],
  },
  {
    code: 'MANA',
    theme: 'Sovereignty',
    title: 'Trust your preparation',
    prompts: [
      { q: 'What are you ready to receive?', hint: 'Write from your body, your heart, your life—what you are ready to receive and live into.' },
      { q: 'What are you committed to after this ceremony? Be as concrete as possible.', hint: 'The medicine amplifies what you bring into ceremony.' },
    ],
  },
]

export const POST_CEREMONY_WEEKS: JournalWeek[] = [
  {
    code: 'MAHALO',
    theme: 'Gratitude',
    title: 'Begin in gratitude',
    prompts: [
      { key: 'w0-p0', q: 'What did the medicine show you?', hint: 'What was revealed about yourself, your nature, your life.' },
      { key: 'w0-p1', q: 'What did the ceremony reveal that surprised you, or that you did not know before receiving the medicine?', hint: 'Stay with what was unexpected.' },
      { key: 'w0-p2', q: 'What images, impressions, or moments from ceremony keep returning? What feels most alive or most unresolved?', hint: 'Record them. The meaning arrives in its own time.' },
      { key: 'w0-p3', q: 'Where did you feel the most resistance during the journey? What were you holding onto, and what happened when you let go?', hint: 'Resistance during ceremony is information.' },
      { key: 'w0-p4', q: 'What is one thing you are committed to begin? What are you committed to release?', hint: 'Trust the impulse. Write it before the mind catches up.' },
      { key: 'w1-p2', q: 'Name everything you are grateful for.', hint: 'Include the things that have challenged you, the difficult moments, even the unsavory ones. Gratitude can hold all of it.' },
      { key: 'post-mahalo-daily', q: 'How will you incorporate gratitude into your daily living?', hint: 'Name something small and repeatable—a morning pause, a word said aloud, a moment of thanks at the table.' },
    ],
  },
  {
    code: 'LŌKAHI',
    theme: 'Unity',
    title: 'The threads begin to weave',
    prompts: [
      { key: 'post-lokahi-1', q: 'Where are you noticing connection this week—between what ceremony showed you and the life you have returned to, or between yourself and the people around you?', hint: 'Lōkahi is felt before it is understood. Notice where the threads touch.' },
      { key: 'post-lokahi-2', q: 'What is beginning to feel more whole in you? What parts of yourself are weaving back together?', hint: 'Unity is the many becoming one.' },
      { key: 'post-lokahi-3', q: 'How do you want to act in unity this week—with your body, your relationships, and the land around you?', hint: 'Connection becomes real in how you live it.' },
    ],
  },
  {
    code: 'MĀLAMA',
    theme: 'Tending',
    title: 'The insights are alive—now you tend them',
    prompts: [
      { key: 'w1-p2', q: 'Where are you meeting yourself differently in daily life? What have you noticed about the way you move through the world since returning home?', hint: 'Small shifts count. A changed reaction. A pause before responding. Name them.' },
      { key: 'w1-p3', q: 'How are you tending to yourself differently since ceremony?', hint: 'Notice the small shifts in how you eat, rest, move, listen. Name what is being cared for now that was not before.' },
      { key: 'w1-p4', q: 'What is one practice you are committing to, to care for yourself in this season?', hint: 'One practice. Liveable. Something you can return to on the days you least feel like it.' },
    ],
  },
  {
    code: 'HAʻAHAʻA',
    theme: 'Humility',
    title: 'The familiar is returning—meet it differently',
    prompts: [
      { key: 'w2-p2', q: 'What old patterns, reactions, or beliefs have you noticed returning, and how are you choosing to meet them now?', hint: 'Return is part of the spiral. How you respond now is what matters.' },
      { key: 'w2-p1', q: 'What do you want to say to your pre-ceremony self—the one who was afraid, uncertain, or carrying so much?', hint: 'Write them a letter if you wish.' },
    ],
  },
  {
    code: 'PONO',
    theme: 'Right Relationship',
    title: 'You have changed—your relationships are noticing',
    prompts: [
      { key: 'w5-p0', q: 'How has your sense of purpose shifted or clarified? What are you called to create, offer, or become in this next chapter?', hint: 'Write down at least 3 SMART goals: specific (what am I feeling called to create?), measurable (how will I know when it is accomplished?), achievable (how can I do this?), relevant (is this worthwhile, and why?), and time-bound (by when can I accomplish this calling?).' },
      { key: 'w5-p1', q: 'Who are you now? How would you describe the person who arrived, and the person standing here today?' },
      { key: 'w5-p1b', q: 'What new beliefs are taking shape in you, the ones that support who you are committed to being today and moving forward?' },
      { key: 'w5-p2', q: 'What does pono mean to you? What are your values now, and how will you live them moving forward?', hint: 'For example, to live authentically and honestly, to practice moderation, or to practice compassion with yourself and others.' },
    ],
  },
  {
    code: 'KULEANA',
    theme: 'Responsibility',
    title: 'Six weeks in—the knowing is yours now',
    prompts: [
      { key: 'w5-completion-1', q: 'What genuinely changed?', hint: 'Actual, lived change. How do you move through the world differently now? Name specific behaviors, responses, ways of being.' },
      { key: 'w5-connection', q: 'How did this experience change your connection with yourself, with others, and with Nature?', hint: 'Notice where each relationship feels different now than it did before.' },
      { key: 'w5-perspective', q: 'How has this journey changed your perspective on life?', hint: 'What you see differently now than the day you arrived.' },
      { key: 'w5-completion-3', q: 'What are you committed to in the next six months?', hint: 'One sentence. Concrete and liveable. Something you can return to and know immediately whether you kept it.' },
      { key: 'w5-accountability', q: 'How will you hold yourself accountable, and how will you ask for continued support with your home circle?', hint: 'Name the people in your home circle and what you are asking them to hold with you.' },
    ],
  },
]
