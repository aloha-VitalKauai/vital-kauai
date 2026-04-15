// Shared journal prompts — single source of truth for both
// the integration pages (pre/post ceremony) and the comprehensive journal.
//
// Storage keys used by both views:
//   Pre-ceremony  — `w{weekIdx}-p{promptIdx}` in pre_ceremony_progress.journal_responses
//   Post-ceremony — `w{weekIdx}-p{promptIdx}` in post_ceremony_progress.journal_responses

export type JournalPrompt = { q: string; hint?: string }

export type JournalWeek = {
  code: string
  theme: string
  title?: string
  prompts: JournalPrompt[]
}

export const PRE_CEREMONY_WEEKS: JournalWeek[] = [
  {
    code: 'IKE',
    theme: 'Perception',
    title: 'Seeing clearly',
    prompts: [
      { q: 'What do I want? What is my intention?', hint: 'Write the truest version. If your intention is still forming, write that.' },
      { q: 'What are my greatest gifts? What is my purpose and mission in this life?', hint: 'Even a partial, uncertain answer is welcome here.' },
      { q: 'After this journey, what becomes possible?', hint: 'Dream beyond what feels realistic. Let yourself go there.' },
    ],
  },
  {
    code: 'MAKIA',
    theme: 'Focus',
    title: 'Energy flows where attention goes',
    prompts: [
      { q: 'What changes in my life are being asked of me? What do I need to let go of?', hint: 'Write from what you already know.' },
      { q: 'What am I most afraid of?', hint: 'Fear named loses half its power. Let it be seen here.' },
      { q: 'Where am I resisting?', hint: 'In my body. In my life. In my willingness to change.' },
    ],
  },
  {
    code: 'MANAWA',
    theme: 'Presence',
    title: 'The body is the experience',
    prompts: [
      { q: 'Where do I go when I feel dysregulated? What is my dominant pattern — fight, flight, freeze, or fawn?', hint: 'This is self-knowledge. Observe clearly.' },
      { q: 'How do I create safety within myself? What brings me back to center?', hint: 'Name what is true for your body.' },
    ],
  },
  {
    code: 'KALA',
    theme: 'Release',
    title: 'Iboga sees everything',
    prompts: [
      { q: 'Where am I lying to myself — and where am I living out of integrity as a result?', hint: 'Iboga sees everything. Arrive having already looked.' },
      { q: 'What shadows are showing up right now? What patterns keep returning?', hint: 'What surfaces repeatedly is ready to be seen.' },
      { q: 'What is my relationship to shame? Where does it show up — or where has it shaped me?', hint: 'Shame seen clearly begins to lose its grip.' },
    ],
  },
  {
    code: 'ALOHA',
    theme: 'Connection',
    title: 'You walk this with others',
    prompts: [
      { q: 'Who do I need to forgive in order to feel free?', hint: 'Forgiveness is releasing the weight you carry on their behalf.' },
      { q: 'Where do I need to forgive myself?', hint: 'The same grace you would offer someone you love — extend it here.' },
      { q: 'How will I connect with my support team — and what specific support do I need from them?', hint: 'Be specific. The more specific the ask, the more support lands.' },
    ],
  },
  {
    code: 'MANA + PONO',
    theme: 'Sovereignty & Integrity',
    title: 'Trust your preparation',
    prompts: [
      { q: 'What am I ready to receive?', hint: 'Write from your body, your heart, your life — what you are ready to receive and live into.' },
      { q: 'What am I committing to after — in one sentence, as concrete as possible?', hint: 'A commitment — concrete, lived. The medicine amplifies what you bring into ceremony.' },
    ],
  },
]

export const POST_CEREMONY_WEEKS: JournalWeek[] = [
  {
    code: 'LŌKAHI',
    theme: 'Unity',
    title: 'The medicine is still moving in you',
    prompts: [
      { q: 'What am I grateful for today?', hint: 'Let gratitude be specific. The smaller the detail, the more real it lands.' },
      { q: 'What is present in my body right now? Where do I feel the most sensation, heaviness, lightness, or aliveness?', hint: 'Stay in the body. Stay with sensation.' },
      { q: 'What images, impressions, or moments from ceremony keep returning? What feels most alive or most unresolved?', hint: 'Record them. The meaning arrives in its own time.' },
      { q: 'Where did I feel the most resistance during the journey? What was I holding onto — and what happened when I let go?', hint: 'Resistance during ceremony is information.' },
      { q: 'What did the medicine show me?', hint: 'What was revealed — about yourself, your nature, your life. Name it plainly.' },
      { q: 'What is one thing I feel called to do, release, or begin?', hint: 'Trust the impulse. Write it before the mind catches up.' },
    ],
  },
  {
    code: 'MĀLAMA',
    theme: 'Tending',
    title: 'The insights are alive — now you tend them',
    prompts: [
      { q: 'What relationships, dynamics, or patterns were illuminated? What did I see about how I show up with others?', hint: 'Write what you saw, without softening it.' },
      { q: 'Looking back at the intentions I set before ceremony — what was answered, exceeded, or transformed beyond what I could have imagined? What is still emerging?', hint: 'The medicine rarely answers in the way you expected. Look honestly at what actually happened.' },
      { q: 'Where am I meeting myself differently in daily life? What have I noticed about the way I move through the world since returning home?', hint: 'Small shifts count. A changed reaction. A pause before responding. Name them.' },
    ],
  },
  {
    code: 'HAʻAHAʻA',
    theme: 'Humility',
    title: 'The familiar is returning — meet it differently',
    prompts: [
      { q: 'What one commitment am I making to myself?', hint: 'Make it concrete. Something you can hold yourself to.' },
      { q: 'What do I want to say to my pre-ceremony self — the one who was afraid, uncertain, or carrying so much?', hint: 'Write them a letter if you wish.' },
      { q: 'What old patterns, reactions, or beliefs have I noticed returning — and how am I choosing to meet them now?', hint: 'Return is part of the spiral. How you respond now is what matters.' },
    ],
  },
  {
    code: 'KULEANA',
    theme: 'Responsibility',
    title: 'The knowing is yours now',
    prompts: [
      { q: 'What relationships in my life are shifting as I change? Who is meeting me in my growth — and where am I feeling friction or distance?', hint: 'Both the welcome and the friction are information.' },
      { q: 'What commitments did I make — to myself, to a new way of being — and how am I honoring them? Where do I need more support or structure?', hint: 'Honest inventory. Name where you have kept the agreement and where the work is still in motion.' },
      { q: 'What does my body need right now in this integration phase? How is it speaking to me — and am I listening?', hint: 'Sleep, nourishment, movement, stillness, touch, nature. Let the body lead.' },
    ],
  },
  {
    code: 'ALOHA',
    theme: 'Love in Action',
    title: 'You have changed — your relationships are noticing',
    prompts: [
      { q: 'What is still alive and in process? What is still seeking form in words, understanding, or action?', hint: 'The most important material sometimes takes the longest to land.' },
      { q: 'What forgiveness work is still alive in me? Who or what am I still in the process of releasing?', hint: 'Forgiveness is a practice. Be honest about where you are in it.' },
      { q: 'What is the medicine still teaching me? What insights continue to surface — in dreams, synchronicities, or the quiet moments?', hint: 'The ceremony continues to move in you.' },
    ],
  },
  {
    code: 'PONO',
    theme: 'Right Relationship',
    title: 'Six weeks in — this is who you are now',
    prompts: [
      { q: 'How has my sense of purpose shifted or clarified? What am I called to create, offer, or become in this next chapter?', hint: 'Purpose often surfaces in ceremony more clearly than we expect. Name it plainly, even if it is still forming.' },
      { q: 'Who am I now? How would I describe the person who arrived — and the person standing here today?', hint: 'Write this one without holding back. You have earned the right to see yourself clearly.' },
    ],
  },
]
