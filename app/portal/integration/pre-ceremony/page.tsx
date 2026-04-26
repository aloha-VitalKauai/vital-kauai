'use client'

import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveJourney } from '@/lib/journeyHelpers'
import { getWeekCountdown } from '@/lib/weekCountdown'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRE_CEREMONY_WEEKS } from '@/lib/journal-prompts'
import SectionIndex, { type SectionIndexItem } from '@/components/portal/SectionIndex'

// Section index, same six anchors for every week, plus an extra "Readiness"
// entry on Week 6 (which has the readiness gate appended to its panel).
const BASE_SECTIONS: SectionIndexItem[] = [
  { label: 'Principle', anchor: '#principle' },
  { label: 'Video',     anchor: '#week-video' },
  { label: 'Actions',   anchor: '#action-items' },
  { label: 'PNE',       anchor: '#pne-perspective' },
  { label: 'Journal',   anchor: '#journal-prompts' },
  { label: 'Community', anchor: '#community' },
]
const sectionsForWeek = (_weekIdx: number): SectionIndexItem[] => BASE_SECTIONS

// Anchor lines, one per pre-ceremony week. Sit under the live status
// in the green week-status box on the right rail of each principle.
const PRE_ANCHORS: readonly string[] = [
  'Looking at the lens itself.',
  'What you turn toward grows.',
  'Arriving in the body.',
  'What is ready to leave.',
  'Opening to your people.',
  'Arrival week. You are ready.',
] as const

// Journal prompt entries, Week 1 has explicit storage keys (so the display
// order can swap without re-attaching members' existing entries to the wrong
// prompt) plus a custom centering placeholder on prompt 3. Weeks 2–6 use the
// implicit `w${weekIdx}-p${promptIdx}` key pattern that's been in place since
// the original launch.
type PromptEntry = { key: string; q: string; hint?: string; placeholder?: string }
const WEEK_1_PROMPTS: PromptEntry[] = [
  { key: 'w0-p1', q: 'If I create my reality, what’s possible for my life after this journey?' },
  { key: 'w0-p2', q: 'What thoughts about myself, others, or the world am I mistaking for truth?' },
  {
    key: 'w0-p0',
    q: 'What sensations am I currently noticing in my body?',
    hint: 'A tightness in the jaw, warmth in the chest, buzzing in the hands, a heaviness behind the eyes.',
    placeholder: 'Before you begin, close your eyes. Take a few slow breaths. Scan your body, and notice what you notice. Then write freely…',
  },
]
const promptsForWeek = (
  weekIdx: number,
  weekPrompts: { q: string; hint?: string }[],
): PromptEntry[] => {
  if (weekIdx === 0) return WEEK_1_PROMPTS
  return weekPrompts.map((p, pi) => ({
    key: `w${weekIdx}-p${pi}`,
    q: p.q,
    hint: p.hint,
  }))
}

// Action-item card shape for the new Week 1 layout. Single-link actions
// render as a clickable card; multi-link actions fall back to inline links
// inside a static card; no-link actions render as static text.
type ActionLinkArr = { text: string; href: string; external?: boolean }[]
type ActionCard =
  | { kind: 'internal'; href: string; text: string }
  | { kind: 'hash';     href: string; text: string }
  | { kind: 'external'; href: string; text: string }
  | { kind: 'static';   text: string; links?: ActionLinkArr }

const actionsForWeek = (
  weekIdx: number,
  actions: ReadonlyArray<{ text: string; links?: ActionLinkArr }>,
): ActionCard[] => {
  // Week 1 has its own hand-tuned action set (intake, prompts anchor,
  // questions-for-the-medicine, somatic companion link) that doesn't live in
  // the WEEKS array. Hard-code it so the display matches what we built in
  // earlier iterations.
  if (weekIdx === 0) {
    return [
      { kind: 'internal', href: '/intake-form',                        text: 'Fill out the remaining questions on your intake form' },
      { kind: 'hash',     href: '#journal-prompts',                    text: 'Respond to this week’s journal prompts' },
      { kind: 'internal', href: '/portal/questions-for-the-medicine',  text: 'Begin writing your questions for the medicine.' },
      { kind: 'internal', href: '/portal/somatic-companion#top',    text: 'Read Week 1: The Language of the Body in The PsychoNeuroEnergetic Companion' },
      { kind: 'internal', href: '/portal#integration-specialist',      text: 'Schedule your first call with your integration guide' },
    ]
  }
  // Weeks 2–6 derive from the existing actions data. Notes are dropped (per
  // Rachel), only the action text + first link survive.
  return actions.map(a => {
    const links = a.links ?? []
    if (links.length === 0) return { kind: 'static', text: a.text }
    if (links.length > 1)   return { kind: 'static', text: a.text, links }
    const lnk = links[0]
    if (lnk.external)              return { kind: 'external', href: lnk.href, text: a.text }
    if (lnk.href.startsWith('#'))  return { kind: 'hash',     href: lnk.href, text: a.text }
    return { kind: 'internal', href: lnk.href, text: a.text }
  })
}

// ─── Types ────────────────────────────────────────────────
type Progress = {
  weeks_completed: number[]
  checklist_items: Record<string, boolean>
  last_updated: string
}

const STRIPE_LOVE_OFFERING_URL = 'https://buy.stripe.com/test_cNi4gzcoG3ZBeQUcmZbo400'

// Render an action's text with optional inline links. Each link matches a
// substring in `text` and is replaced with an anchor tag in place.
function renderActionText(
  text: string,
  links?: { text: string; href: string; external?: boolean }[],
) {
  if (!links || links.length === 0) return text
  type Seg = string | { text: string; href: string; external?: boolean }
  let segments: Seg[] = [text]
  for (const link of links) {
    const next: Seg[] = []
    for (const seg of segments) {
      if (typeof seg !== 'string') { next.push(seg); continue }
      const idx = seg.indexOf(link.text)
      if (idx === -1) { next.push(seg); continue }
      if (idx > 0) next.push(seg.slice(0, idx))
      next.push(link)
      const rest = seg.slice(idx + link.text.length)
      if (rest) next.push(rest)
    }
    segments = next
  }
  return segments.map((seg, i) =>
    typeof seg === 'string' ? (
      <Fragment key={i}>{seg}</Fragment>
    ) : (
      <a
        key={i}
        href={seg.href}
        target={seg.external ? '_blank' : undefined}
        rel={seg.external ? 'noopener noreferrer' : undefined}
        style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed rgba(200,169,110,.55)' }}
      >
        {seg.text}
      </a>
    ),
  )
}

// ─── Week data ────────────────────────────────────────────
const WEEKS = [
  {
    id: 0,
    code: 'IKE',
    principleName: 'Ike',
    principle: 'I create my reality.',
    theme: 'Perception',
    title: 'Seeing clearly.',
    subtitle: 'This is the beginning of something real.',
    sub: 'Iboga asks for your presence, your honesty, and your full participation. What you do in these six weeks matters. The way you prepare becomes part of the experience itself.',
    italic: 'This week calls for presence. Just begin.',
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'A real conversation about what you are walking into, why the next six weeks matter, and the one thing that protects you more than any lab result or dietary protocol. Watch this before you read anything else this week.' },
    box: { type: 'info', label: 'The most important safety factor is your honesty.', text: 'Your labs, your diet, and your supplement plan all matter—but it\'s your willingness to see yourself clearly that shapes how the medicine meets you. Iboga brings truth to the surface. When you arrive having already begun that process with yourself, the experience becomes something you can move through with awareness. This is how the medicine meets you.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        color: 'blue',
        text: 'Sign both required documents, Membership Agreement, Medical Disclaimer',
        note: 'Each document is an act of commitment. Read them with care.',
        links: [
          { text: 'Membership Agreement', href: '/portal#agreement-card' },
          { text: 'Medical Disclaimer', href: '/portal#medical-card' },
        ],
      },
      {
        color: 'blue',
        text: 'Submit your love offering',
        note: 'Your donation completes the container. It signals to your nervous system: I have chosen this. I am in.',
        links: [
          { text: 'Submit your love offering', href: STRIPE_LOVE_OFFERING_URL, external: true },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
        note: 'Begin an honest relationship with what you\'re stepping into.',
        links: [
          {
            text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html',
            external: true,
          },
        ],
      },
      // Week 1's actual rendered actions are hardcoded in actionsForWeek (since
      // the items here are mostly Stripe / signup steps, not the writing-prompt
      // flow shown on Week 1). The integration-guide reminder lives in that
      // hardcoded list, see actionsForWeek(weekIdx === 0).
    ],
    prompts: PRE_CEREMONY_WEEKS[0].prompts,
    thread: 'Your answers here are the raw material of your Questions for the Medicine, the specific questions you\'ll bring into ceremony. Write honestly. Over the coming weeks, these words will sharpen into something you can carry in. This is where that conversation begins.',
  },
  {
    id: 1,
    code: 'MAKIA',
    principleName: 'Makia',
    principle: 'Energy flows where attention goes.',
    theme: 'Focus',
    title: 'The person who arrives at ceremony',
    subtitle: 'is being shaped right now.',
    carryForward: 'You named what you want and what is asking to change. That honesty is already in motion. This week you begin aligning your whole life, your body, your choices, your attention, toward what\'s coming.',
    sub: 'Makia means energy flows where attention goes. This week is about the quiet recognition that everything you do between now and ceremony, every choice, every conversation, every moment of honesty or avoidance, is preparation. You are already in the work.',
    video: { label: 'A Message from Rachel & Josh · Week 2', text: 'Something shifts the moment you say yes. This week Rachel and Josh talk about what that shift means, how the preparation window works as active medicine, and the question that matters more than "what do I need to learn?", who am I becoming?' },
    box: { type: 'info', label: 'The identity shift', text: 'You are no longer the person who was considering this. The moment you committed, something changed. This week\'s job is to feel that shift, as a lived, embodied orientation. The portal, this video, and the prompts below all serve one thing: moving you from "I signed up for something" to "I am inside a process."' },
    actionLabel: 'Actions this week, 3 only',
    actionIntro: 'Identity shifts happen in the noticing. This week your job is to begin seeing clearly, the changes will follow.',
    actions: [
      {
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'Come with your intentions from Week 1. Come with your questions. Come as you are. This call is the beginning of a relationship that will hold you through the hardest parts of what\'s ahead.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'amber', text: 'Begin noticing your daily habits', note: 'Observe alcohol, sleep, screens, food, substances. Honest observation is all that\u2019s asked. What you notice this week becomes data for your body to begin working with.' },
      {
        color: 'blue',
        text: 'Schedule your required medical appointments and labs',
        note: 'EKG and labs must be completed before Week 5. Schedule now, medical appointments take time. This protects you.',
        links: [
          { text: 'Schedule your required medical appointments and labs', href: '/portal/physician-guide' },
        ],
      },
      {
        color: 'blue',
        text: 'Upload your lab results once you have them',
        note: 'Once your doctor returns results, upload the document here as a single PDF or image. Our medical team reviews them before ceremony.',
        links: [
          { text: 'Upload your lab results once you have them', href: '/portal/labs' },
        ],
      },
      {
        color: 'amber',
        text: 'Schedule next week\'s call with Rachel & Josh',
        links: [
          { text: 'Schedule next week\'s call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[1].prompts,
    thread: '"What must change" becomes the spine of your Week 4 shadow work and your Week 6 ceremony questions. Start a running list anywhere, the specific questions you want to bring to the medicine will take shape over the next four weeks. You\'ll draft them formally in Week 4.',
  },
  {
    id: 2,
    code: 'MANAWA',
    principleName: 'Manawa',
    principle: 'The moment of power is now.',
    theme: 'Presence',
    title: 'The body is the experience.',
    subtitle: 'This is where the medicine lands.',
    carryForward: 'You named what must change and what you\'re committing to. This week the work moves from mind into body. The clarity you found last week needs a regulated nervous system to land in. That\'s what this week builds.',
    reentry: { strong: 'Arriving at this week behind?', text: ' If you haven\'t yet completed Week 2\'s integration call, do that first, before starting anything here. One real conversation with your guide is worth more than moving forward alone. If you\'re behind on journaling, write just five minutes on Week 1\'s prompts before opening Week 3. Start here: one integration call scheduled, one journal prompt written.' },
    sub: 'Iboga works through the body, the gut, the heart, the nervous system, the tissue where unresolved experience lives. The more regulated and resourced your nervous system is when you arrive, the more cleanly the medicine can do its work. This week, you begin building that foundation.',
    video: { label: 'A Message from Rachel & Josh · Week 3', text: 'Something may already be coming up, old feelings, vivid dreams, unexpected heaviness. This is the medicine already in relationship with you. In this week\'s transmission, Rachel and Josh explain why this happens, what it means, and how to stay with what arises without being swept away by it.' },
    box: { type: 'info', label: 'If something surfaces this week', text: 'Iboga is intelligent and relational. It begins its work the moment you say yes. If difficult material arises, old grief, anxiety, somatic intensity, here is what to do: slow down deliberately. Bring your attention to one physical sensation at a time. Breathe. Place both feet on the floor. Be with what is arising, presence is enough. Your integration guide is available between sessions. Reach out whenever you need support.\n\nSome days will feel harder to begin. Noticing that, naming it honestly, is itself the practice.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        color: 'blue',
        text: 'Connect with Rachel & Josh',
        links: [
          { text: 'Connect with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
      {
        color: 'green',
        text: 'Read The Somatic Companion',
        note: 'Understanding your polyvagal states before ceremony is one of the most valuable things you can do. It gives you a map for what you\'ll encounter in your own body during the experience.',
        links: [
          { text: 'Read The Somatic Companion', href: '/portal/somatic-companion' },
        ],
      },
      {
        color: 'green',
        text: 'Begin Coherent Heart Breath, 10 minutes, every morning',
        note: 'This single practice does more for your ceremony readiness than almost anything else on this list. It is the minimum. Do it every day.',
        links: [
          { text: 'Begin Coherent Heart Breath, 10 minutes, every morning', href: '/portal/somatic-companion#coherent-heart-breath' },
        ],
      },
      {
        color: 'amber',
        text: 'Begin dietary protocol, you are now 4 weeks out',
        note: 'Read the Dietary Preparation guide. The body you bring to ceremony is built in these four weeks. This is about arriving as a clear vessel, prepared, open, and ready to receive.',
        links: [
          { text: 'Begin dietary protocol, you are now 4 weeks out', href: '/portal/dietary' },
        ],
      },
      {
        color: 'red',
        text: 'Begin DHA/EPA and magnesium glycinate supplementation daily',
        note: 'DHA/EPA: 2–4g daily with food. Magnesium glycinate: 300–400mg before bed. Confirm with your physician if you are on any medications.',
        links: [
          { text: 'Begin DHA/EPA and magnesium glycinate supplementation daily', href: '/portal/dietary#supplement-protocol' },
        ],
      },
      {
        color: 'amber',
        text: 'Schedule next week\'s integration-guide call',
        links: [
          { text: 'Schedule next week\'s integration-guide call', href: '/portal#integration-specialist' },
        ],
      },
    ],
    safetyBox: { label: 'Physiological preparation, safety note', text: 'Magnesium is cardiac-critical for iboga. Adequate magnesium levels directly affect cardiac function during the medicine, particularly QT interval regulation. This supplementation is cardiac-critical preparation, part of your physiological safety protocol. If you have any cardiac history, confirm dosing with your physician and inform the Vital Kauaʻi team before proceeding.' },
    prompts: PRE_CEREMONY_WEEKS[2].prompts,
    thread: 'The body awareness you\'re building this week is what carries you through ceremony. When the medicine is at its most intense, your capacity to track sensation without being consumed by it is the skill that matters most. You are practicing it now.',
  },
  {
    id: 3,
    code: 'KALA',
    principleName: 'Kala',
    principle: 'You are unlimited.',
    theme: 'Release',
    title: 'Iboga sees everything.',
    subtitle: '',
    carryForward: 'Your nervous system is more regulated. Your body has begun its preparation. You have a map of your own inner states. You are ready for what this week asks, trust what you\'ve built.',
    reentry: { strong: 'A note on pacing:', text: ' Let the Coherent Heart Breath be with you this week. Return to it before each journal prompt, let it settle you before you begin, and steady you when the material goes deep.' },
    sub: 'Kala means release, and release requires honesty. Kala also means that there are no limits, and the boundaries you experience are essentially self-imposed, as you untie those blocks you realize your ultimate, unlimited potential.',
    video: { label: 'A Message from Rachel & Josh · Week 4', text: 'Rachel and Josh designed this week to hold you. In this transmission they explain why the shadow work you do here changes what ceremony will ask of you, and how to go slow while staying grounded.' },
    box: { type: 'warn', label: 'Pacing permission, read this before you begin', text: 'This week\'s journaling may bring up old grief, anger, shame, or material you haven\'t touched in years. That is appropriate. It is a sign the process is working. Write for ten minutes. Stop. Breathe. Come back tomorrow. Go slow on purpose. If something feels too large to hold alone, reach out to your integration guide before your next scheduled call.\n\nAnd know this: this process moves in waves. Feeling more unsettled now than you did in Week 1, more uncertain, more raw, is often a sign something is genuinely moving. Regression before breakthrough is real.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      { color: 'red', text: 'Deep journaling, this is the primary work of this week', note: 'An act of honesty. Approach the prompts below as if the medicine is already in the room with you, because in a real sense, it is.' },
      {
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'Bring the material that is surfacing. Your guide is trained to hold exactly this territory.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      {
        color: 'blue',
        text: 'Draft your Questions for the Medicine, first version',
        note: 'You\'ve been gathering the raw material for four weeks. What do you most want to ask? What do you most need to be shown? Write freely. These will be refined in Week 6.',
        links: [
          { text: 'Draft your Questions for the Medicine, first version', href: '/portal/questions' },
        ],
      },
      {
        color: 'amber',
        text: 'Begin clearing contraindicated substances per your protocol timeline',
        note: 'Cannabis: clear fully 2 weeks before ceremony. All other substances: review the Preparedness Guide. Questions about specific medications, reach out to the team now, not later.',
        links: [
          { text: 'Begin clearing contraindicated substances per your protocol timeline', href: '/iboga-preparedness-guide.html#contraindications', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[3].prompts,
    thread: 'What you name here, you are no longer carrying unconsciously. Iboga surfaces what we hold in the dark. You are turning on a light before you arrive. Next week you turn toward your people.',
  },
  {
    id: 4,
    code: 'ALOHA',
    principleName: 'Aloha',
    principle: 'To love is to be happy with.',
    theme: 'Connection',
    title: 'You walk this with others.',
    subtitle: 'You always have.',
    carryForward: 'You looked at the shadow. You named what you\'ve been avoiding. That took courage. This week the work moves outward, into your relationships, your home, and the people who will hold you from a distance while you\'re in ceremony.',
    reentry: { strong: 'Arriving at this week without having done Week 4\'s journaling?', text: ' Do one prompt from Week 4, just one, before you move forward. The shadow work and the relational work are connected. Ten minutes of Week 4 journaling is where to begin.' },
    sub: 'Aloha is a way of being in relationship. This week, you turn outward. Even as the inner work continues, because transformation that touches your relationships is transformation that lands. The people who love you are part of this process. Let them be.',
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'The ceremony container is powerful. But the integration that follows lives or dies in your relationships and your home environment. This week Rachel and Josh talk about the most common reason people lose their ceremony gains after returning home, and what you can do right now to protect against it.' },
    box: { type: 'info', label: 'Why the relational field is the foundation of your return', text: 'The relational preparation you do this week is a structural protection for integration. The weeks and months after ceremony are when the insights are tender and the old world is asking you to return to who you were. The relational preparation you do this week is a structural protection against that pull. Share the Support Person Guide. Have the real conversations. Let your circle know you\'re asking for something from them, and be specific about what.' },
    actionLabel: 'Actions this week, 3 only',
    actions: [
      {
        color: 'green',
        text: 'Share the Support Person Guide with your home circle, this week',
        note: 'Not after ceremony. Now. So they have time to read it, ask questions, and show up prepared for your return.',
        links: [
          { text: 'Share the Support Person Guide with your home circle, this week', href: '/portal/support-person' },
        ],
      },
      {
        color: 'amber',
        text: 'Begin preparing your home environment for your return',
        note: 'Clean it. Simplify it. Stock what will nourish you. The space you return to is part of integration. Prepare it now, before you\'re altered by what\'s coming.',
        links: [
          { text: 'Begin preparing your home environment for your return', href: '/portal/support-person#return' },
        ],
      },
      {
        color: 'blue',
        text: 'Complete the What to Bring packing checklist',
        note: 'Practical, yes, and also a ritualized act of arrival. Let the packing be intentional.',
        links: [
          { text: 'Complete the What to Bring packing checklist', href: '/portal/what-to-bring' },
        ],
      },
      {
        color: 'amber',
        text: 'Schedule next week\'s call with Rachel & Josh',
        links: [
          { text: 'Schedule next week\'s call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[4].prompts,
    thread: 'The forgiveness work you begin here continues in ceremony and for months afterward. Begin it this week, the medicine will carry it forward from wherever you start. One week remains.',
  },
  {
    id: 5,
    code: 'MANA + PONO',
    principleName: 'Mana + Pono',
    principle: 'All power comes from within.',
    theme: 'Sovereignty & Integrity',
    title: 'You have done the work.',
    subtitle: 'Trust your preparation.',
    carryForward: 'You have opened to your people. You have begun the forgiveness work. You have tended your home. This final week calls for completion, alignment, and the willingness to arrive.',
    sub: 'Mana is the power that comes from within. Pono is right relationship, with yourself, with others, with what\'s coming. This week you are being asked to arrive. The work of preparation is complete. What remains is alignment, meeting yourself honestly about what you are ready to receive.',
    video: { label: 'A Message from Rachel & Josh · Week 6', text: 'Five weeks ago you were a person who was thinking about doing this. Today you are a person who has done the preparation. In this week\'s transmission, Rachel and Josh speak to the power within that got you here, and to the invitation to set down the preparation and trust that you are ready.' },
    box: { type: 'close', label: 'Emotional closure, the arc completes here', text: 'Five weeks ago this process asked you to see clearly. Then to commit. Then to tend your body. Then to meet your shadow. Then to open to your people. You have done all of that. Whatever remains unresolved, the medicine will meet it. Your job this week is to arrive with openness, trust your team, and let yourself be held. That is enough. That is everything.\n\nIf you feel uncertain right now, more unsettled than you expected to feel at the end of six weeks of preparation, that feeling often means you have done real work. Uncertainty is a form of readiness.' },
    actionLabel: 'Actions this week, 5 operational completions',
    actions: [
      {
        color: 'red',
        text: 'Confirm labs are submitted',
        note: 'If you haven\'t received confirmation, reach out now and confirm directly. This is a safety step, it directly affects whether your ceremony proceeds as planned.',
        links: [
          { text: 'Confirm labs are submitted', href: '/portal/labs' },
        ],
      },
      {
        color: 'blue',
        text: 'Save our direct contacts for arrival week',
        note: 'Rachel and Josh\'s phone numbers and our email live on one page. Keep it open or take a screenshot before you fly.',
        links: [
          { text: 'Save our direct contacts for arrival week', href: '/portal/contact' },
        ],
      },
      {
        color: 'blue',
        text: 'Connect with Rachel & Josh',
        note: 'Bring your finalized Questions for the Medicine. Bring anything still alive. Speak everything that is ready to be said.',
        links: [
          { text: 'Connect with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
      {
        color: 'amber',
        text: 'Connect with your integration guide',
        note: 'A final pre-ceremony touchpoint with the guide who will walk with you through integration. Bring what is asking to be spoken before you arrive.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      {
        color: 'amber',
        text: 'Schedule your post-ceremony integration-guide call, within 48 hours of ceremony, while still on Kauaʻi',
        links: [
          { text: 'Schedule your post-ceremony integration-guide call, within 48 hours of ceremony, while still on Kauaʻi', href: '/portal#integration-specialist' },
        ],
      },
      {
        color: 'blue',
        text: 'Confirm travel and send arrival details to aloha@vitalkauai.com',
        links: [
          { text: 'aloha@vitalkauai.com', href: 'mailto:aloha@vitalkauai.com' },
        ],
      },
      {
        color: 'green',
        text: 'Finalize your Questions for the Medicine, land on what feels most true',
        note: 'The truest question, that is the one. Hold it with open hands.',
        links: [
          { text: 'Finalize your Questions for the Medicine, land on what feels most true', href: '/portal/questions' },
        ],
      },
    ],
    prompts: PRE_CEREMONY_WEEKS[5].prompts,
    thread: 'In Week 1 you named what is asking to change. In Week 2 you named what must change. In Week 4 you looked at what you were hiding. In Week 5 you opened to your people. Now you state what you are ready for and what you are committing to.',
  },
]

const DOT_COLORS: Record<string, string> = {
  blue: '#4A7FA5',
  green: '#7A9E7E',
  amber: '#C8A96E',
  red: '#A85555',
}

// ─── Journal sync map: pre-ceremony key → member_journals key ────────────────
const PRE_TO_JOURNAL_MAP: Record<string, string> = {
  'w0-p0': 'p0-0',  // "What do I want? What is my intention?"
  'w3-p0': 'p0-6',  // "Where am I lying to myself?"
  'w4-p0': 'p0-12', // "Who do I need to forgive..."
}

// ─── Component ────────────────────────────────────────────
export default function PreCeremonyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')
  const [activeWeek, setActiveWeek] = useState(0)
  const [ceremonyStartAt, setCeremonyStartAt] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [journal, setJournal] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // ── Auth + data load
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal'); return }

      setUserId(user.id)
      setUserEmail(user.email ?? '')

      // Pull the member's active journey so each week can show a
      // countdown grounded in their actual ceremony date.
      const journey = await getActiveJourney(supabase, user.id).catch(() => null)
      if (journey?.start_at) setCeremonyStartAt(journey.start_at)

      const { data } = await supabase
        .from('pre_ceremony_progress')
        .select('*')
        .eq('member_id', user.id)
        .single()

      if (data) {
        setCompleted(new Set(data.weeks_completed ?? []))
        setChecklist(data.checklist_items ?? {})
        setJournal(data.journal_responses ?? {})
        // Resume at last uncompleted week
        const done = new Set<number>(data.weeks_completed ?? [])
        const next = [0,1,2,3,4,5].find(w => !done.has(w))
        if (next !== undefined) setActiveWeek(next)
        else setActiveWeek(5)
      }

      setLoading(false)
    }
    load()
  }, [])

  // ── Hash navigation: deep-link to a specific week's journal section
  // Weeks 2–6 use #journal-w{n}; Week 1 uses named section anchors (#principle,
  // #week-video, #pne-perspective, #journal-prompts, #action-items, #community).
  useEffect(() => {
    if (loading) return
    if (typeof window === 'undefined') return
    const hash = window.location.hash
    const WEEK1_ANCHORS = ['principle', 'week-video', 'pne-perspective', 'journal-prompts', 'action-items', 'community']
    const match = hash.match(/^#journal-w(\d)$/)
    if (match) {
      const weekNum = parseInt(match[1], 10)
      if (weekNum < 1 || weekNum > 6) return
      setActiveWeek(weekNum - 1)
      setTimeout(() => {
        document.getElementById(`journal-w${weekNum}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
      return
    }
    const anchor = hash.replace(/^#/, '')
    if (WEEK1_ANCHORS.includes(anchor)) {
      setActiveWeek(0)
      setTimeout(() => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 250)
    }
  }, [loading])

  // ── Save
  const save = useCallback(async (newCompleted: Set<number>, newChecklist: Record<string, boolean>, newJournal?: Record<string, string>) => {
    if (!userId) return
    setSaveStatus('saving')
    await supabase.from('pre_ceremony_progress').upsert({
      member_id: userId,
      weeks_completed: [...newCompleted],
      checklist_items: newChecklist,
      journal_responses: newJournal ?? journal,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }, [userId, journal])

  const syncToMainJournal = useCallback(async (integJournal: Record<string, string>, changedKey: string) => {
    if (!userId || !PRE_TO_JOURNAL_MAP[changedKey]) return
    const updates: Record<string, string> = {}
    for (const [integKey, journalKey] of Object.entries(PRE_TO_JOURNAL_MAP)) {
      if (integJournal[integKey]) updates[journalKey] = integJournal[integKey]
    }
    if (Object.keys(updates).length === 0) return
    const { data } = await supabase.from('member_journals').select('responses').eq('member_id', userId).maybeSingle()
    const merged = { ...((data?.responses as Record<string, string>) ?? {}), ...updates }
    await supabase.from('member_journals').upsert({ member_id: userId, responses: merged, last_saved_at: new Date().toISOString() }, { onConflict: 'member_id' })
  }, [userId])

  const journalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateJournal = (key: string, value: string) => {
    const next = { ...journal, [key]: value }
    setJournal(next)
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current)
    journalTimerRef.current = setTimeout(() => {
      save(completed, checklist, next)
      syncToMainJournal(next, key)
      journalTimerRef.current = null
    }, 1500)
  }

  // Flush any pending debounced journal save immediately and wait for it to finish.
  const flushJournalSave = useCallback(async () => {
    if (journalTimerRef.current) {
      clearTimeout(journalTimerRef.current)
      journalTimerRef.current = null
      await save(completed, checklist, journal)
    }
  }, [save, completed, checklist, journal])

  const saveAndExit = async () => {
    await flushJournalSave()
    router.push('/portal')
  }

  const markComplete = async (weekIdx: number) => {
    if (completed.has(weekIdx)) return
    await flushJournalSave()
    const next = new Set(completed)
    next.add(weekIdx)
    setCompleted(next)
    setTimeout(() => setActiveWeek(Math.min(weekIdx + 1, 5)), 300)
    await save(next, checklist)
  }

  const toggleCheck = async (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] }
    setChecklist(next)
    await save(completed, next)
  }

  const progress = Math.round((completed.size / 6) * 100)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0E1A10', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#7A9E7E', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
        ))}
        <style>{`@keyframes pulse { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }`}</style>
      </div>
    )
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --forest: #1C2B1E; --deep: #0E1A10;
          --sage: #7A9E7E; --sage-lt: #A8C5AC;
          --gold: #C8A96E; --cream: #F5F0E8; --warm: #FDFBF7;
          --stone: #8B8070; --ink: #1A1A18; --ink-mid: #3D3D38;
          --border: rgba(28,43,30,0.12); --border-lt: rgba(28,43,30,0.06);
        }
        html { scroll-behavior: smooth; }
        body { font-family: 'Jost', sans-serif; font-weight: 300; background: var(--warm); color: var(--ink); }

        /* NAV */
        .pc-nav { position:sticky;top:0;z-index:100;background:rgba(14,26,16,.97);backdrop-filter:blur(16px);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 48px;border-bottom:1px solid rgba(200,169,110,.08); }
        .pc-nav-left { display:flex;align-items:center;gap:32px; }
        .pc-logo { font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:var(--cream);text-decoration:none; }
        .pc-logo em { font-style:italic;color:var(--sage-lt); }
        .pc-nav-links { display:flex;align-items:center;gap:4px; }
        .pc-nav-link { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);text-decoration:none;padding:6px 14px;border-radius:3px;transition:color .2s;border:none;background:none;font-family:inherit;cursor:pointer; }
        .pc-nav-link:hover { color:var(--cream); }

        /* DROPDOWN */
        .pc-dropdown { position:relative; }
        .pc-dropdown-trigger { font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--sage-lt);padding:6px 14px;border-radius:3px;border:none;background:none;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px; }
        .pc-dropdown-trigger::after { content:'▾';font-size:8px;color:var(--gold); }
        .pc-dropdown-menu { display:none;position:absolute;top:calc(100% + 10px);left:0;background:rgba(14,26,16,.98);backdrop-filter:blur(16px);border:.5px solid rgba(200,169,110,.15);border-radius:4px;min-width:180px;padding:8px 0;box-shadow:0 16px 40px rgba(0,0,0,.4); }
        .pc-dropdown:hover .pc-dropdown-menu { display:block; }
        .pc-dropdown-item { display:block;padding:10px 20px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.55);text-decoration:none;transition:color .15s,background .15s;border-left:2px solid transparent; }
        .pc-dropdown-item:hover { color:var(--cream);background:rgba(122,158,126,.06); }
        .pc-dropdown-item.current { color:var(--sage-lt);border-left-color:var(--sage); }
        .pc-dropdown-item.soon { color:rgba(245,240,232,.22);cursor:default;pointer-events:none; }
        .pc-dropdown-item.soon::after { content:', soon';font-size:8px;color:rgba(200,169,110,.4); }

        .pc-nav-right { display:flex;align-items:center;gap:14px; }
        .pc-nav-email { font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }
        .pc-nav-out { font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(200,169,110,.5);background:none;border:none;cursor:pointer;font-family:inherit;transition:color .2s; }
        .pc-nav-out:hover { color:var(--gold); }

        /* PROGRESS */
        .pc-prog { background:rgba(28,43,30,.06);border-bottom:1px solid var(--border-lt);padding:14px 48px;display:flex;align-items:center;gap:18px; }
        .pc-prog-label { font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--stone);font-weight:500; }
        .pc-prog-track { flex:1;height:4px;background:var(--border);border-radius:3px;max-width:340px; }
        .pc-prog-fill { height:100%;background:var(--sage);border-radius:3px;transition:width .6s ease; }
        .pc-prog-week { font-size:12px;letter-spacing:.1em;color:var(--sage);font-weight:500; }

        /* HERO */
        .pc-hero { background:var(--forest);padding:80px 60px 72px;position:relative;overflow:hidden; }
        .pc-hero::before { content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 70% 50%,rgba(122,158,126,.08) 0%,transparent 70%);pointer-events:none; }
        .pc-hero-inner { position:relative;z-index:1;max-width:860px;margin:0 auto; }
        .pc-hero-eyebrow { font-size:9px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:18px; }
        .pc-hero h1 { font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5vw,62px);font-weight:300;color:var(--cream);line-height:1.06;margin-bottom:22px; }
        .pc-hero h1 em { font-style:italic;color:var(--sage-lt); }
        .pc-hero-desc { font-size:14.5px;color:rgba(245,240,232,.55);line-height:1.95;max-width:600px;margin-bottom:32px; }
        .pc-hero-meta { display:flex;gap:32px;flex-wrap:wrap; }
        .hm-num { font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:var(--cream);line-height:1; }
        .hm-lbl { font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,240,232,.35);margin-top:4px; }

        /* WEEK NAV */
        .pc-week-nav { position:sticky;top:60px;z-index:90;background:rgba(253,251,247,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 48px;display:flex;overflow-x:auto; }
        .pc-week-nav::-webkit-scrollbar { display:none; }
        .wbtn { font-family:inherit;font-size:9px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;padding:0 20px;height:52px;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--stone);background:transparent;white-space:nowrap;transition:all .2s; }
        .wbtn:hover { color:var(--ink); }
        .wbtn.active { color:var(--forest);border-bottom-color:var(--sage);font-weight:500; }
        .wbtn.done::after { content:' ✓';font-size:8px;color:var(--sage);margin-left:4px; }

        /* MAIN */
        .pc-main { max-width:860px;margin:0 auto;padding:0 48px 100px; }
        .pc-panel { display:none;padding-top:56px; }
        .pc-panel.active { display:block; }
        /* Principle + week-status side-by-side rail */
        .principle-row { display:grid;grid-template-columns:1fr 280px;gap:36px;align-items:flex-start;margin-bottom:8px; }
        .principle-row > .w1-section { margin-bottom:0; }
        .week-status { background:#1c2b1e;border:1px solid rgba(168,197,172,.18);border-radius:12px;padding:26px 28px;position:sticky;top:130px; }
        .week-status .ws-label { display:block;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:14px; }
        .week-status .ws-status { font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#f5f0e8;line-height:1.2;margin-bottom:18px; }
        .week-status .ws-anchor { font-size:13.5px;font-style:italic;color:rgba(168,197,172,.85);line-height:1.6; }
        .week-status-past .ws-status { color:rgba(168,197,172,.7); }
        .week-status-unknown .ws-status { font-size:18px;color:rgba(168,197,172,.55);font-style:italic; }
        @media (max-width:760px) {
          .principle-row { grid-template-columns:1fr;gap:20px; }
          .week-status { position:static; }
        }

        /* CONTINUITY */
        .continuity { display:flex;gap:12px;align-items:flex-start;background:rgba(122,158,126,.06);border-left:2px solid var(--sage-lt);padding:14px 18px;margin-bottom:32px; }
        .ct-arrow { font-size:13px;color:var(--sage);flex-shrink:0;margin-top:1px; }
        .ct-text { font-size:12.5px;color:var(--stone);line-height:1.75; }
        .ct-text strong { color:var(--ink-mid);font-weight:500; }

        /* WEEK HEADER */
        .wh-eyebrow { font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px; }
        .wh-title { font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4vw,46px);font-weight:300;line-height:1.1;margin-bottom:16px;color:var(--ink); }
        .wh-title em { font-style:italic;color:var(--sage); }
        .wh-sub { font-size:14px;color:var(--stone);line-height:1.9;max-width:640px;padding-bottom:32px;border-bottom:1px solid var(--border);margin-bottom:36px; }
        .wh-italic { font-size:13px;color:var(--sage);font-style:italic;margin-top:16px;letter-spacing:.02em; }
        /* Week 1 principle, same hierarchy as wh-* but bumped to read as the theme of the week. */
        .w1p-eyebrow { font-size:12px;font-weight:600;letter-spacing:.36em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:22px; }
        .w1p-title { font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5.2vw,58px);font-weight:300;line-height:1.06;margin:0 0 18px;color:var(--ink); }
        .w1p-title em { font-style:italic;color:var(--sage); }
        .w1p-pull { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(17px,1.8vw,21px);color:var(--sage);line-height:1.55;margin:0 0 26px;letter-spacing:.015em; }
        .w1p-body { font-size:15.5px;color:var(--stone);line-height:1.95;max-width:680px;padding-bottom:40px;border-bottom:1px solid var(--border);margin:0; }

        /* PRINCIPLE CARD, Hawaiian principle of the week */
        .principle-card { background:var(--cream); border-left:3px solid var(--gold); border-radius:2px; padding:56px 60px; margin-bottom:40px; }
        .pcard-eyebrow { font-size:9.5px; letter-spacing:.34em; text-transform:uppercase; color:var(--gold); display:block; margin-bottom:28px; font-weight:500; }
        .pcard-name { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:clamp(72px,10vw,108px); font-weight:400; color:var(--gold); line-height:1; margin-bottom:34px; letter-spacing:-.01em; }
        .pcard-sublabel { font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:var(--sage); display:block; margin-bottom:20px; font-weight:500; }
        .pcard-quote { font-family:'Cormorant Garamond',serif; font-style:italic; font-size:24px; color:var(--sage); line-height:1.45; margin-bottom:38px; border-left:2px solid var(--sage-lt); padding-left:20px; font-weight:300; }
        .pcard-title { font-family:'Cormorant Garamond',serif; font-size:clamp(30px,4vw,42px); font-weight:300; font-style:italic; color:var(--sage); line-height:1.15; margin-bottom:22px; }
        .pcard-title em { color:var(--sage); font-style:italic; display:block; font-size:.68em; margin-top:8px; opacity:.85; }
        .pcard-body { font-size:14.5px; color:var(--ink-mid); line-height:1.95; max-width:640px; }
        .pcard-italic { font-size:13px; color:var(--sage); font-style:italic; margin-top:16px; letter-spacing:.02em; }
        @media (max-width:640px) { .principle-card { padding:40px 28px; } .pcard-name { font-size:clamp(56px,18vw,80px); margin-bottom:26px; } .pcard-quote { font-size:20px; } }

        /* SECTION */
        .section { margin-bottom:44px;scroll-margin-top:130px; }
        .section-label { font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--sage);margin-bottom:16px;display:block; }

        /* WEEK 1, custom layout */
        .w1-section { margin-bottom:52px;scroll-margin-top:130px; }
        .w1-eyebrow { font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px; }
        .w1-h2 { font-family:'Cormorant Garamond',serif;font-size:clamp(28px,3.5vw,42px);font-weight:300;line-height:1.12;color:var(--ink);margin-bottom:14px; }
        .w1-h2 em { font-style:italic;color:var(--sage); }
        .w1-h3 { font-family:'Cormorant Garamond',serif;font-size:clamp(22px,2.6vw,30px);font-weight:300;line-height:1.2;color:var(--ink);margin-bottom:16px; }
        .w1-body { font-size:14px;color:var(--ink-mid);line-height:1.9;max-width:640px; }
        .w1-body + .w1-body { margin-top:14px; }
        .w1-companion-link { display:inline-block;margin-top:20px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);text-decoration:none;border-bottom:1px dashed rgba(200,169,110,.55);padding-bottom:2px; }
        .w1-companion-link:hover { color:var(--sage); }
        /* Centering invitation before journal prompts */
        .w1-invite { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--sage);line-height:1.7;margin:4px 0 28px;padding-left:20px;border-left:2px solid var(--sage-lt); }
        .w1-prompt { padding:22px 0;border-bottom:1px solid var(--border); }
        .w1-prompt:first-child { border-top:1px solid var(--border); }
        .w1-prompt-num { font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--sage);display:block;margin-bottom:10px; }
        .w1-prompt-q { font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:300;color:var(--ink);line-height:1.35;margin-bottom:10px; }
        .w1-prompt-hint { font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic; }
        .w1-actions { display:flex;flex-direction:column;gap:10px; }
        .w1-action { display:flex;align-items:flex-start;gap:14px;padding:16px 18px;border:.5px solid var(--border);border-radius:4px;background:white;text-decoration:none;color:var(--ink);transition:border-color .2s,background .2s; }
        .w1-action:hover { border-color:var(--sage);background:rgba(122,158,126,.04); }
        .w1-action-dot { width:8px;height:8px;border-radius:50%;background:var(--sage);flex-shrink:0;margin-top:7px; }
        .w1-action-text { font-size:13.5px;color:var(--ink);line-height:1.55; }
        .w1-community { background:rgba(122,158,126,.05);border:.5px solid rgba(122,158,126,.2);border-radius:4px;padding:28px 32px;text-align:center; }
        .w1-community-text { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:16px;color:var(--stone);line-height:1.7; }
        .w1-closing { margin-top:24px;text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:20px;color:var(--sage);letter-spacing:.02em; }

        /* VIDEO */
        .video-frame { border:.5px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:14px; }
        .video-primer { background:var(--forest);padding:24px 28px;display:flex;align-items:center;gap:20px; }
        .vp-play { width:44px;height:44px;border-radius:50%;border:1px solid rgba(168,197,172,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer; }
        .vp-play-icon { color:var(--sage-lt);font-size:14px;margin-left:3px; }
        .vp-coming-soon { margin-top:12px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;letter-spacing:.04em;color:var(--gold); }
        .vp-label { font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:6px; }
        .vp-text { font-size:13.5px;color:rgba(245,240,232,.75);line-height:1.7; }
        .vp-text em { font-style:italic;color:var(--cream); }

        /* BOXES */
        .box { margin-top:14px;border-radius:2px;padding:16px 20px; }
        .box-label { font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px;font-weight:500; }
        .box-text { font-size:13px;line-height:1.8;color:var(--ink-mid);white-space:pre-line; }
        .box-info { background:rgba(122,158,126,.07);border:.5px solid rgba(122,158,126,.25); }
        .box-info .box-label { color:var(--sage); }
        .box-warn { background:rgba(200,169,110,.08);border:.5px solid rgba(200,169,110,.28); }
        .box-warn .box-label { color:var(--gold); }
        .box-close { background:rgba(122,158,126,.06);border:.5px solid rgba(122,158,126,.2); }
        .box-close .box-label { color:var(--sage); }
        .box-safe { background:rgba(168,85,85,.06);border:.5px solid rgba(168,85,85,.22); }
        .box-safe .box-label { color:#A85555; }

        /* REENTRY */
        .reentry { background:rgba(200,169,110,.05);border:.5px solid rgba(200,169,110,.2);border-radius:2px;padding:14px 20px;margin-bottom:24px;display:flex;gap:14px;align-items:flex-start; }
        .reentry-icon { font-size:13px;color:var(--gold);flex-shrink:0;margin-top:1px; }
        .reentry-text { font-size:12.5px;color:var(--stone);line-height:1.75; }

        /* ACTIONS */
        .actions-intro { font-size:13px;color:var(--stone);line-height:1.8;font-style:italic;margin-bottom:14px;padding-bottom:14px;border-bottom:.5px solid var(--border-lt); }
        .dataset-note{background:rgba(200,169,110,.07);border:1px solid rgba(200,169,110,.32);border-left:3px solid var(--gold);border-radius:3px;padding:18px 22px;margin-top:18px;font-size:13px;color:var(--ink-mid);line-height:1.75}
        .dataset-note .dn-label{display:block;font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:10px}
        .dataset-note .dn-body{font-style:italic}
        .dataset-note .dn-cta{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);text-decoration:none;font-weight:500;padding:8px 14px;border:1px solid rgba(200,169,110,.5);border-radius:2px;transition:all .2s}
        .dataset-note .dn-cta:hover{background:rgba(200,169,110,.1);border-color:var(--gold)}
        .dataset-note .dn-header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap}
        .dataset-note .dn-header .dn-label{margin-bottom:0}
        .dataset-note .dn-footer{margin-top:14px;display:flex;justify-content:flex-end}
        .actions-list { display:flex;flex-direction:column;gap:10px; }
        .action-item { display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:.5px solid var(--border);border-radius:4px;background:white; }
        .action-dot { width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px; }
        .action-text { font-size:13.5px;color:var(--ink);line-height:1.5; }
        .action-note { font-size:12px;color:var(--stone);line-height:1.6;margin-top:5px;font-style:italic; }

        /* PROMPTS */
        .prompts-list { border-top:1px solid var(--border); }
        .prompt-item { padding:22px 0;border-bottom:1px solid var(--border); }
        .prompt-num { font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--sage);display:block;margin-bottom:10px; }
        .prompt-q { font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:300;color:var(--ink);line-height:1.35;margin-bottom:10px; }
        .prompt-hint { font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic; }
        .journal-textarea{width:100%;margin-top:14px;padding:14px 16px;border:1px solid rgba(122,158,126,0.2);border-left:2px solid var(--sage-lt);background:rgba(122,158,126,0.04);font-family:'Jost',sans-serif;font-size:14px;font-weight:300;color:var(--ink);line-height:1.85;resize:vertical;outline:none;min-height:100px;transition:border-color .2s,background .2s}
        .journal-textarea:focus{border-color:var(--sage);background:rgba(122,158,126,0.07)}
        .journal-textarea::placeholder{color:rgba(28,43,30,0.2);font-style:italic}

        /* READINESS GATE */
        .rg-wrap { margin-top:40px;border:.5px solid rgba(122,158,126,.35);border-radius:4px;overflow:hidden; }
        .rg-header { background:var(--forest);padding:18px 24px;display:flex;align-items:center;gap:12px; }
        .rg-dot { width:8px;height:8px;border-radius:50%;background:var(--sage);flex-shrink:0; }
        .rg-title { font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--sage-lt); }
        .rg-body { padding:20px 24px; }
        .rg-item { display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid var(--border); }
        .rg-item:last-of-type { border-bottom:none; }
        .rg-check { width:18px;height:18px;border-radius:2px;border:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s; }
        .rg-check.checked { background:var(--sage);border-color:var(--sage); }
        .rg-check-icon { font-size:10px;color:white;opacity:0; }
        .rg-check.checked .rg-check-icon { opacity:1; }
        .rg-item-text { font-size:13px;color:var(--ink-mid);line-height:1.5; }
        .rg-note { margin-top:16px;font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic;border-top:.5px solid var(--border);padding-top:14px; }

        /* BRIDGE */
        .bridge { margin-top:40px;background:var(--forest);padding:32px 36px;border-radius:2px; }
        .bridge-eyebrow { font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:block; }
        .bridge-title { font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--cream);line-height:1.2;margin-bottom:14px; }
        .bridge-title em { font-style:italic;color:var(--sage-lt); }
        .bridge-text { font-size:13.5px;color:rgba(245,240,232,.62);line-height:1.9; }

        /* COMPLETE */
        .wc-wrap { margin-top:48px;padding-top:36px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px; }
        .wc-text { font-size:12.5px;color:var(--stone);line-height:1.65; }
        .wc-text strong { color:var(--ink-mid);font-weight:500; }
        .btn-complete { padding:12px 28px;background:var(--sage);border:none;border-radius:3px;color:var(--deep);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:all .2s;white-space:nowrap; }
        .btn-complete:hover { background:var(--sage-lt); }
        .btn-complete.done { background:rgba(122,158,126,.12);border:.5px solid var(--sage);color:var(--sage);cursor:default; }
        .btn-save-exit { padding:12px 26px;background:transparent;border:1px solid var(--sage);border-radius:3px;color:var(--forest);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s,color .2s;white-space:nowrap; }
        .btn-save-exit:hover { background:rgba(122,158,126,.1); }
        .wc-actions { display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end; }
        .w1-autosave { font-size:11.5px;color:var(--stone);font-style:italic;margin:4px 0 20px; }

        /* SAVE STATUS */
        .save-pill { position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:4px;font-size:11px;letter-spacing:.1em;font-family:inherit;background:rgba(28,43,30,.9);color:var(--sage);opacity:0;transition:opacity .3s;pointer-events:none;z-index:200; }
        .save-pill.visible { opacity:1; }

        @media (max-width: 640px) {
          .pc-nav { padding:0 20px; }
          .pc-nav-links { display:none; }
          .pc-hero { padding:56px 24px 52px; }
          .pc-main { padding:0 24px 80px; }
          .pc-week-nav { padding:0 12px; }
          .pc-prog { padding:10px 24px; }
        }
      `}</style>

      {/* NAV provided by portal layout */}

      {/* PROGRESS */}
      <div className="pc-prog">
        <span className="pc-prog-label">Your Progress</span>
        <div className="pc-prog-track">
          <div className="pc-prog-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="pc-prog-week">
          {completed.size === 6 ? 'Preparation Complete ✓' : `Week ${Math.min(completed.size + 1, 6)} of 6`}
        </span>
      </div>

      {/* HERO */}
      <div className="pc-hero">
        <div className="pc-hero-inner">
          <span className="pc-hero-eyebrow">Member Portal · Iboga Journey · Confidential</span>
          <h1>Six Weeks of <em>Preparation</em></h1>
          <p className="pc-hero-desc">
            This portal is your companion through an evidence-based and deeply personal arc of preparation and integration.
            Each week draws on a Hawaiian principle, paired with a teaching from psychoneuroenergetics (PNE) to support the body, mind, and spirit.
            You&apos;ll find journal prompts, action items, and voices from the Vital Kauaʻi community, those who have walked this path.
          </p>
        </div>
      </div>

      {/* WEEK NAV */}
      <div className="pc-week-nav">
        {WEEKS.map((w, i) => (
          <button
            key={w.id}
            className={`wbtn${activeWeek === i ? ' active' : ''}${completed.has(i) ? ' done' : ''}`}
            onClick={() => setActiveWeek(i)}
          >
            Week {i + 1} · {w.code}
          </button>
        ))}
      </div>

      {/* SECTION INDEX, Week 1 only. Sticky right under the week-tabs (60 +
          ~52 = 112) so it stays in view as members scroll through sections.
          Weeks 2+ stay on the week-tabs alone until each week's content is
          restyled to match. */}
      <SectionIndex sections={sectionsForWeek(activeWeek)} stickyTop={112} scrollOffset={170} />

      {/* MAIN */}
      <main className="pc-main">
        {WEEKS.map((w, i) => {
          const cd = getWeekCountdown(ceremonyStartAt, 'pre', i)
          return (
          <div key={w.id} className={`pc-panel${activeWeek === i ? ' active' : ''}`}>

            {/* PRINCIPLE + WEEK STATUS */}
            <div className="principle-row">
              <section className="w1-section" id="principle">
                <span className="w1p-eyebrow">Week {i + 1} · {w.principleName} · {w.theme}</span>
                <h2 className="w1p-title">
                  {i === 0
                    ? <>Seeing <em>clearly.</em></>
                    : <>{w.title}{w.subtitle && <><br /><em>{w.subtitle}</em></>}</>}
                </h2>
                <p className="w1p-pull">&ldquo;{w.principle}&rdquo;</p>
                <p className="w1p-body">
                  {i === 0
                    ? 'What you perceive shapes what you experience, attention, assumptions, the stories carried without noticing. This week is an invitation to look at the lens itself.'
                    : w.sub}
                </p>
              </section>
              <aside className={`week-status week-status-${cd?.phase ?? 'unknown'}`}>
                <span className="ws-label">Week {i + 1}</span>
                <div className="ws-status">{cd ? cd.label : 'Begins once your dates are set'}</div>
                <div className="ws-anchor">{PRE_ANCHORS[i]}</div>
              </aside>
            </div>

            {/* VIDEO, Message from the Founders */}
            <section className="w1-section" id="week-video">
              <span className="section-label">Message from the Founders</span>
              <div className="video-frame">
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">{w.video.label}</div>
                    <div className="vp-text">{w.video.text}</div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
            </section>

            {/* ACTIONS */}
            <section className="w1-section" id="action-items">
              <h3 className="w1-h3">Action Items</h3>
              <div className="w1-actions">
                {actionsForWeek(i, w.actions).map((card, ai) => {
                  if (card.kind === 'static') {
                    return (
                      <div key={ai} className="w1-action">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{renderActionText(card.text, card.links)}</span>
                      </div>
                    )
                  }
                  if (card.kind === 'hash') {
                    return (
                      <a key={ai} href={card.href} className="w1-action">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  }
                  if (card.kind === 'external') {
                    return (
                      <a key={ai} href={card.href} target="_blank" rel="noopener noreferrer" className="w1-action">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  }
                  return (
                    <Link key={ai} href={card.href} className="w1-action">
                      <span className="w1-action-dot" />
                      <span className="w1-action-text">{card.text}</span>
                    </Link>
                  )
                })}
              </div>
              {(w as { dataset?: string }).dataset && (() => {
                const dataset = (w as { dataset?: string }).dataset as string
                const dl = (w as { datasetLink?: { text: string; href: string } }).datasetLink
                return (
                  <div className="dataset-note" style={{ marginTop: 18 }}>
                    <div className="dn-header">
                      <span className="dn-label">Outcomes, your contribution to the field</span>
                      {dl && <Link href={dl.href} className="dn-cta">{dl.text}</Link>}
                    </div>
                    <div className="dn-body">{dataset}</div>
                    {dl && (
                      <div className="dn-footer">
                        <Link href={dl.href} className="dn-cta">{dl.text}</Link>
                      </div>
                    )}
                  </div>
                )
              })()}
            </section>

            {/* PNE PERSPECTIVE */}
            <section className="w1-section" id="pne-perspective">
              <h3 className="w1-h3">
                {i === 0 ? <>PNE Perspective: <em>The Language of the Body</em></> : 'PNE Perspective'}
              </h3>
              {i === 0 && (
                <p className="w1-body">
                  Before any thought, the body is already speaking. Sensation, tightening, loosening, warmth, pressure, is the nervous system&apos;s first language, arriving long before words or meaning. What we call a &ldquo;feeling&rdquo; is actually three layers stacked: sensation in the body, charge in the emotional system, and story in the mind. The mind&apos;s story is often the loudest, but it&apos;s the last layer to arrive. This week, the invitation from PNE is to notice what&apos;s underneath the story, the raw data of the body, before the mind names it.
                </p>
              )}
              <div className="video-frame" style={{ marginTop: i === 0 ? 24 : 0 }}>
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">PNE Teaching · Week {i + 1}</div>
                    <div className="vp-text">
                      {i === 0
                        ? 'A short teaching on the three layers of feeling, sensation in the body, charge in the emotional system, and story in the mind, and why the body’s raw data arrives before the mind names it. The foundational practice of Week 1: listening underneath.'
                        : 'A short teaching paired with this week’s principle and the body’s lived response to it.'}
                    </div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
              {i === 0 && (
                <Link href="/portal/somatic-companion#top" className="w1-companion-link">
                  Read the full teaching in The PsychoNeuroEnergetic Companion → Week 1: The Language of the Body
                </Link>
              )}
            </section>

            {/* JOURNAL PROMPTS */}
            <section className="w1-section" id="journal-prompts">
              <h3 className="w1-h3">Journal Prompts</h3>
              <p className="w1-autosave">Your writing saves automatically as you type. You can return any time to continue.</p>
              {promptsForWeek(i, w.prompts).map((p, pi) => (
                <div className="w1-prompt" key={p.key}>
                  <span className="w1-prompt-num">0{pi + 1}</span>
                  <p className="w1-prompt-q">{p.q}</p>
                  {p.hint && <p className="w1-prompt-hint">{p.hint}</p>}
                  <textarea
                    className="journal-textarea"
                    value={journal[p.key] ?? ''}
                    onChange={(e) => updateJournal(p.key, e.target.value)}
                    placeholder={p.placeholder ?? 'Write freely...'}
                    rows={4}
                  />
                </div>
              ))}
            </section>

            {/* VOICES FROM THE VITAL KAUAʻI COMMUNITY */}
            <section className="w1-section" id="community">
              <h3 className="w1-h3">Voices from the Vital Kauaʻi Community</h3>
              <div className="video-frame">
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">A Reflection from the Vital Kauaʻi Community · Week {i + 1}</div>
                    <div className="vp-text">A short transmission from someone who has walked this path.</div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Mark complete */}
            <div className="wc-wrap">
              <div className="wc-text">
                <strong>{i === 5 ? 'You\'ve completed all six weeks.' : `Finished with Week ${i + 1}?`}</strong><br />
                {i === 5 ? 'Mark your preparation complete. You are ready.' : 'Your progress is saved. You can return any time.'}
              </div>
              <div className="wc-actions">
                <button
                  type="button"
                  className="btn-save-exit"
                  onClick={saveAndExit}
                >
                  Save &amp; Continue Later
                </button>
                <button
                  className={`btn-complete${completed.has(i) ? ' done' : ''}`}
                  onClick={() => markComplete(i)}
                  disabled={completed.has(i)}
                >
                  {completed.has(i) ? '✓ Completed' : i === 5 ? 'Mark Preparation Complete' : `Mark Week ${i + 1} Complete`}
                </button>
              </div>
            </div>

          </div>
        )})}
      </main>

      {/* Save status */}
      <div className={`save-pill${saveStatus !== 'idle' ? ' visible' : ''}`}>
        {saveStatus === 'saving' ? 'Saving…' : 'Saved ✓'}
      </div>
    </>
  )
}
