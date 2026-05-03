'use client'

import { Fragment, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PRE_CEREMONY_WEEKS, PRE_PNE_DETAILS } from '@/lib/journal-prompts'
import { companionsFor } from '@/lib/pne-companions'
import SectionIndex, { type SectionIndexItem } from '@/components/portal/SectionIndex'
import HeroCountdown from '@/components/portal/HeroCountdown'

// Section index, same six anchors for every week, plus an extra "Readiness"
// entry on Week 6 (which has the readiness gate appended to its panel).
const BASE_SECTIONS: SectionIndexItem[] = [
  { label: 'Principle', anchor: '#principle' },
  { label: 'Video',     anchor: '#week-video' },
  { label: 'Actions',   anchor: '#action-items' },
  { label: 'Journal',   anchor: '#journal-prompts' },
  { label: 'PNE',       anchor: '#pne-perspective' },
  { label: 'Community', anchor: '#community' },
]
const sectionsForWeek = (_weekIdx: number): SectionIndexItem[] => BASE_SECTIONS

// Display rows for a week's journal prompts. Source of truth is
// lib/journal-prompts.ts: prompts may carry an explicit `key` (used where the
// display order has shifted since the original launch) or fall back to the
// implicit `w${weekIdx}-p${promptIdx}` storage key.
type PromptEntry = { key: string; q: string; hint?: string }
const promptsForWeek = (
  weekIdx: number,
  weekPrompts: { q: string; hint?: string; key?: string }[],
): PromptEntry[] =>
  weekPrompts.map((p, pi) => ({
    key: p.key ?? `w${weekIdx}-p${pi}`,
    q: p.q,
    hint: p.hint,
  }))

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
      { kind: 'internal', href: '/intake-form',                        text: 'Fill out Your Member Intake & Readiness Form' },
      { kind: 'hash',     href: '#journal-prompts',                    text: 'Respond to this week’s journal prompts' },
      { kind: 'external', href: '/iboga-preparedness-guide.html#iboga', text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide' },
      { kind: 'internal', href: '/portal/somatic-companion#top',    text: 'Read Week 1 in The PsychoNeuroEnergetics (PNE) Guide: The Language of the Body' },
      { kind: 'static',                                              text: "Complete this week's PNE Practice" },
      { kind: 'static',                                              text: "Complete this week's PNE Reflection" },
      { kind: 'internal', href: '/portal#integration-specialist',      text: 'Schedule your two pre-ceremony calls with your integration guide, one in week two and one in week four' },
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

// Per-week PNE Companion theme + URL, filtered from the shared companion
// registry. Live weeks get a hash-anchored deep-link to #top; coming-soon
// weeks render their theme as plain text.
const PRE_PNE_COMPANION: ReadonlyArray<{ theme: string; url: string }> =
  companionsFor('pre').map((c) => ({
    theme: c.title,
    url: c.status === 'live' ? `${c.href}#top` : '',
  }))

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
  return segments.map((seg, i) => {
    if (typeof seg === 'string') return <Fragment key={i}>{seg}</Fragment>
    // Hash-only links scroll the current page — keep them in the same tab.
    // Everything else (internal route or external URL) opens in a new tab so
    // members don't lose their place on the week page.
    const isHashOnly = seg.href.startsWith('#')
    return (
      <a
        key={i}
        href={seg.href}
        target={isHashOnly ? undefined : '_blank'}
        rel={isHashOnly ? undefined : 'noopener noreferrer'}
        style={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed rgba(200,169,110,.55)' }}
      >
        {seg.text}
      </a>
    )
  })
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
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'In this week’s video, Rachel and Josh share what Ike has meant in their own lives and how it has shaped the way they walk through the world.' },
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
        text: 'Submit your contribution',
        note: 'Your donation completes the container. It signals to your nervous system: I have chosen this. I am in.',
        links: [
          { text: 'Submit your contribution', href: STRIPE_LOVE_OFFERING_URL, external: true },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
        note: 'Begin an honest relationship with what you\'re stepping into.',
        links: [
          {
            text: 'Read "Understanding Iboga" and "What Iboga Works On" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#iboga',
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
    title: 'What you turn toward,',
    subtitle: 'turns toward you.',
    carryForward: 'You named what you want and what is asking to change. That honesty is already in motion. This week you begin aligning your whole life, your body, your choices, your attention, toward what\'s coming.',
    sub: 'Makia means energy flows where attention goes. Where are you spending yours? This week asks you to look at what you are feeding with your focus, and what that is growing.',
    video: { label: 'A Message from Rachel & Josh · Week 2', text: 'In this week’s video, Rachel and Josh share what Makia has meant in their own lives and how learning to focus and follow their attention has shaped what they have built and what they have let go of.' },
    box: { type: 'info', label: 'The identity shift', text: 'You are no longer the person who was considering this. The moment you committed, something changed. This week\'s job is to feel that shift, as a lived, embodied orientation. The portal, this video, and the prompts below all serve one thing: moving you from "I signed up for something" to "I am inside a process."' },
    actionLabel: 'Actions this week, 3 only',
    actionIntro: 'Identity shifts happen in the noticing. This week your job is to begin seeing clearly, the changes will follow.',
    actions: [
      {
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Iboga & Ibogaine" and "Medical Preparation & Contraindications" in your Preparedness Guide',
        note: 'Two short sections. The first names what we work with; the second is the safety frame your physician will use.',
        links: [
          {
            text: 'Read "Iboga & Ibogaine" and "Medical Preparation & Contraindications" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#medicine-forms',
            external: true,
          },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 2 in The PsychoNeuroEnergetics (PNE) Guide: Nervous System Regulation',
        links: [
          { text: 'Read Week 2 in The PsychoNeuroEnergetics (PNE) Guide: Nervous System Regulation', href: '/portal/somatic-companion/week-2#top' },
        ],
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'Come with your intentions from Week 1. Come with your questions. Come as you are. This call is the beginning of a relationship that will hold you through the hardest parts of what\'s ahead.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      {
        color: 'blue',
        text: 'Schedule your required medical appointments and labs',
        note: 'EKG and labs must be completed before Week 5. Schedule now, medical appointments take time. This protects you.',
        links: [
          { text: 'Schedule your required medical appointments and labs', href: '/portal/physician-guide' },
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
    title: 'Presence is the practice.',
    subtitle: '',
    carryForward: 'You named what must change and what you\'re committing to. This week the work moves from mind into body. The clarity you found last week needs a regulated nervous system to land in. That\'s what this week builds.',
    reentry: { strong: 'Arriving at this week behind?', text: ' If you haven\'t yet completed Week 2\'s integration call, do that first, before starting anything here. One real conversation with your guide is worth more than moving forward alone. If you\'re behind on journaling, write just five minutes on Week 1\'s prompts before opening Week 3. Start here: one integration call scheduled, one journal prompt written.' },
    sub: 'You have everything you need, right here, in this moment. The past is memory dressed as nostalgia or regret. The future is vision or imagination, in the shape of hope or anxiety. Now is the only ground that is true. Now is the only place where change and choice can happen.\n\nWeek 3 is about remembering the power of the present moment. Through simple practices of breath, body awareness, and sensation, you build the muscle of presence, and capacity to be with what is. When ceremony comes, this is what carries you.',
    video: { label: 'A Message from Rachel & Josh · Week 3', text: 'In this week’s video, Rachel and Josh share what Manawa has meant in their own lives and how returning to the body has shaped the way they meet what each day brings.' },
    box: { type: 'info', label: 'If something surfaces this week', text: 'Iboga is intelligent and relational. It begins its work the moment you say yes. If difficult material arises, old grief, anxiety, somatic intensity, here is what to do: slow down deliberately. Bring your attention to one physical sensation at a time. Breathe. Place both feet on the floor. Be with what is arising, presence is enough. Your integration guide is available between sessions. Reach out whenever you need support.\n\nSome days will feel harder to begin. Noticing that, naming it honestly, is itself the practice.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Body, Mind, Spirit Preparation" in your Preparedness Guide',
        note: 'A short orientation to how the body lands into ceremony, paired with the Dietary Guide you\'re beginning this week.',
        links: [
          {
            text: 'Read "Body, Mind, Spirit Preparation" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#preparing-body',
            external: true,
          },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 3 in The PsychoNeuroEnergetics (PNE) Guide: Building Somatic Awareness',
        links: [
          { text: 'Read Week 3 in The PsychoNeuroEnergetics (PNE) Guide: Building Somatic Awareness', href: '/portal/somatic-companion/week-3#top' },
        ],
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'blue',
        text: 'Begin writing your questions for the medicine',
        note: 'Open the questions document and let the first lines arrive. You\'ll keep adding to it as the weeks unfold; Week 4 is when you draft the first version, and Week 6 is when you finalize.',
        links: [
          { text: 'Begin writing your questions for the medicine', href: '/portal/questions-for-the-medicine' },
        ],
      },
      {
        color: 'blue',
        text: 'Connect with Rachel & Josh',
        links: [
          { text: 'Connect with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-prep-call', external: true },
        ],
      },
      {
        color: 'amber',
        text: 'Begin dietary protocol',
        note: 'Read the Dietary Preparation guide. The body you bring to ceremony is built in these four weeks. This is about arriving as a clear vessel, prepared, open, and ready to receive.',
        links: [
          { text: 'Begin dietary protocol', href: '/portal/dietary' },
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
    title: 'Iboga sees the truth.',
    subtitle: '',
    carryForward: 'Your nervous system is more regulated. Your body has begun its preparation. You have a map of your own inner states. You are ready for what this week asks, trust what you\'ve built.',
    reentry: { strong: 'A note on pacing:', text: ' Let the Coherent Heart Breath be with you this week. Return to it before each journal prompt, let it settle you before you begin, and steady you when the material goes deep.' },
    sub: 'Kala means release. The limits you live inside are mostly inherited. Stories you were given. Strategies you built to survive. Grips you took on long ago and forgot you were holding.\n\nWeek 4 is about loosening those grips. About trusting what arises when you stop managing your life so closely. Underneath the control is a self that is whole, vast, and already free.',
    video: { label: 'A Message from Rachel & Josh · Week 4', text: 'In this week’s video, Rachel and Josh share what Kala has meant in their own lives and how letting go has shaped what they are now able to carry.' },
    box: { type: 'warn', label: 'Pacing permission, read this before you begin', text: 'This week\'s journaling may bring up old grief, anger, shame, or material you haven\'t touched in years. That is appropriate. It is a sign the process is working. Write for ten minutes. Stop. Breathe. Come back tomorrow. Go slow on purpose. If something feels too large to hold alone, reach out to your integration guide before your next scheduled call.\n\nAnd know this: this process moves in waves. Feeling more unsettled now than you did in Week 1, more uncertain, more raw, is often a sign something is genuinely moving. Regression before breakthrough is real.' },
    actionLabel: 'Actions this week, 4 only',
    actions: [
      {
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 4 in The PsychoNeuroEnergetics (PNE) Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'Bring the material that is surfacing. Your guide is trained to hold exactly this territory.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
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
    subtitle: '',
    carryForward: 'You looked at the shadow. You named what you\'ve been avoiding. That took courage. This week the work moves outward, into your relationships, your home, and the people who will hold you from a distance while you\'re in ceremony.',
    reentry: { strong: 'Arriving at this week without having done Week 4\'s journaling?', text: ' Do one prompt from Week 4, just one, before you move forward. The shadow work and the relational work are connected. Ten minutes of Week 4 journaling is where to begin.' },
    sub: 'Aloha is mutual respect, kindness, and harmony, often interpreted as the “presence of breath” or “breath of life.” It is the alignment of mind and heart. It is how you meet a stranger, how you care for the land, how you hold the people closest to you, and how you return to yourself.\n\nThe Hawaiian teaching holds that to love is to be happy with: to be with what is, with who is, exactly as they are. Without trying to fix, change, or rearrange. This is the practice of relationship.',
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'In this week’s video, Rachel and Josh share what Aloha has meant in their own lives and how it has shaped the way they show up for each other and for this community.' },
    box: { type: 'info', label: 'Why the relational field is the foundation of your return', text: 'The relational preparation you do this week is a structural protection for integration. The weeks and months after ceremony are when the insights are tender and the old world is asking you to return to who you were. The relational preparation you do this week is a structural protection against that pull. Share the Support Person Guide. Have the real conversations. Let your circle know you\'re asking for something from them, and be specific about what.' },
    actionLabel: 'Actions this week, 3 only',
    actions: [
      {
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Ceremony Day" and "The Days After" in your Preparedness Guide',
        note: 'A walkthrough of the ceremony arc and the days that follow, share what feels useful with your support people.',
        links: [
          {
            text: 'Read "Ceremony Day" and "The Days After" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#ceremony-day',
            external: true,
          },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 5 in The PsychoNeuroEnergetics (PNE) Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'green',
        text: 'Share the Support Person Guide with your home circle',
        note: 'Not after ceremony. Now. So they have time to read it, ask questions, and show up prepared for your return.',
        links: [
          { text: 'Share the Support Person Guide with your home circle', href: '/portal/support-person' },
        ],
      },
      {
        color: 'blue',
        text: 'Start packing',
        note: 'Practical, yes, and also a ritualized act of arrival. Let the packing be intentional.',
        links: [
          { text: 'Start packing', href: '/portal/what-to-bring' },
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
    code: 'MANA',
    principleName: 'Mana',
    principle: 'All power comes from within.',
    theme: 'Sovereignty',
    title: 'You have done the work.',
    subtitle: 'Trust your preparation.',
    carryForward: 'You have opened to your people. You have begun the forgiveness work. You have tended your home. This final week calls for completion, alignment, and the willingness to arrive.',
    sub: 'Mana is the power that comes from within. This week you are being asked to arrive. The work of preparation is complete. What remains is alignment, meeting yourself honestly about what you are ready to receive.',
    video: { label: 'A Message from Rachel & Josh · Week 6', text: 'In this week’s video, Rachel and Josh share what Mana has meant in their own lives and how standing in their own truth has shaped the way they walk into ceremony.' },
    box: { type: 'close', label: 'Emotional closure, the arc completes here', text: 'Five weeks ago this process asked you to see clearly. Then to commit. Then to tend your body. Then to meet your shadow. Then to open to your people. You have done all of that. Whatever remains unresolved, the medicine will meet it. Your job this week is to arrive with openness, trust your team, and let yourself be held. That is enough. That is everything.\n\nIf you feel uncertain right now, more unsettled than you expected to feel at the end of six weeks of preparation, that feeling often means you have done real work. Uncertainty is a form of readiness.' },
    actionLabel: 'Actions this week, 5 operational completions',
    actions: [
      {
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'blue',
        text: 'Read "Integration, The Real Work" in your Preparedness Guide',
        note: 'A simple orientation to the integration arc that begins the moment ceremony ends.',
        links: [
          {
            text: 'Read "Integration, The Real Work" in your Preparedness Guide',
            href: '/iboga-preparedness-guide.html#integration',
            external: true,
          },
        ],
      },
      {
        color: 'blue',
        text: 'Read the Ceremony Day Guide and Ceremony Guidelines',
        note: 'A walkthrough of how the day itself unfolds, and the agreements that hold the container.',
        links: [
          { text: 'Ceremony Day Guide', href: '/ceremony-day-guide.html', external: true },
          { text: 'Ceremony Guidelines', href: '/portal/ceremony-guidelines' },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 6 in The PsychoNeuroEnergetics (PNE) Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'green',
        text: 'Finalize your Questions for the Medicine',
        note: 'The truest question, that is the one. Hold it with open hands.',
        links: [
          { text: 'Finalize your Questions for the Medicine', href: '/portal/questions' },
        ],
      },
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
        text: 'Review your arrival packet',
        note: 'Everything you need for the days right before ceremony, in one place.',
        links: [
          { text: 'Review your arrival packet', href: '/portal/arrival-packet' },
        ],
      },
      {
        color: 'blue',
        text: 'Finish packing',
        links: [
          { text: 'Finish packing', href: '/portal/what-to-bring' },
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
        text: 'Schedule your post-ceremony integration-guide call, within 48 hours of ceremony, while still on Kauaʻi',
        links: [
          { text: 'Schedule your post-ceremony integration-guide call, within 48 hours of ceremony, while still on Kauaʻi', href: '/portal#integration-specialist' },
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
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [journal, setJournal] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

  // ── Sync activeWeek with #week-N hash so dropdown links can deep-link.
  useEffect(() => {
    const applyHash = () => {
      const m = /^#week-([1-6])$/.exec(window.location.hash)
      if (m) setActiveWeek(Number(m[1]) - 1)
    }
    applyHash()
    window.addEventListener('hashchange', applyHash)
    return () => window.removeEventListener('hashchange', applyHash)
  }, [])

  // ── Auth + data load
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal'); return }

      setUserId(user.id)
      setUserEmail(user.email ?? '')

      // ?week=N (1–6) forces a specific week and skips the resume-where-you-
      // left-off behavior. Used by the "Open Week 1" CTA on /portal so it
      // always lands on Ike at the top of the page.
      const params = new URLSearchParams(window.location.search)
      const weekParam = parseInt(params.get('week') ?? '', 10)
      const forcedWeek =
        Number.isInteger(weekParam) && weekParam >= 1 && weekParam <= 6
          ? weekParam - 1
          : null

      // #week-N (from the nav dropdown) also forces a specific week so the
      // async resume logic below doesn't overwrite the deep-link selection.
      const hashMatch = /^#week-([1-6])$/.exec(window.location.hash)
      const hashWeek = hashMatch ? Number(hashMatch[1]) - 1 : null
      const explicitWeek = forcedWeek ?? hashWeek

      const { data } = await supabase
        .from('pre_ceremony_progress')
        .select('*')
        .eq('member_id', user.id)
        .single()

      if (data) {
        setCompleted(new Set(data.weeks_completed ?? []))
        setChecklist(data.checklist_items ?? {})
        setJournal(data.journal_responses ?? {})
        if (explicitWeek !== null) {
          setActiveWeek(explicitWeek)
        } else {
          // Resume at last uncompleted week
          const done = new Set<number>(data.weeks_completed ?? [])
          const next = [0,1,2,3,4,5].find(w => !done.has(w))
          if (next !== undefined) setActiveWeek(next)
          else setActiveWeek(5)
        }
      } else if (explicitWeek !== null) {
        setActiveWeek(explicitWeek)
      }

      if (forcedWeek !== null) {
        window.scrollTo({ top: 0, behavior: 'auto' })
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
        .pc-hero-inner { position:relative;z-index:1;max-width:1140px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:56px;align-items:start; }
        .pc-hero-text { min-width:0; }
        .pc-hero-aside { justify-self:end; }
        @media (max-width: 880px) {
          .pc-hero-inner { grid-template-columns:1fr;gap:32px; }
          .pc-hero-aside { justify-self:start; }
        }
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
        .w1p-body { font-size:15.5px;color:var(--stone);line-height:1.95;max-width:680px;margin:0 0 18px; }
        .w1p-body:last-child { margin-bottom:0;padding-bottom:40px;border-bottom:1px solid var(--border); }

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
        .section-label { font-size:14px;letter-spacing:.28em;text-transform:uppercase;color:var(--sage);margin-bottom:16px;display:block; }

        /* WEEK 1, custom layout */
        .w1-section { margin-bottom:52px;scroll-margin-top:130px; }
        .w1-eyebrow { font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px; }
        .w1-h2 { font-family:'Cormorant Garamond',serif;font-size:clamp(28px,3.5vw,42px);font-weight:300;line-height:1.12;color:var(--ink);margin-bottom:14px; }
        .w1-h2 em { font-style:italic;color:var(--sage); }
        .w1-h3 { font-family:'Cormorant Garamond',serif;font-size:clamp(22px,2.6vw,30px);font-weight:300;line-height:1.2;color:var(--ink);margin-bottom:16px; }
        .w1-body { font-size:14px;color:var(--ink-mid);line-height:1.9;max-width:640px; }
        .w1-body + .w1-body { margin-top:14px; }
        .w1-h3-link { color:inherit;text-decoration:none;border-bottom:1px dashed rgba(200,169,110,.5);padding-bottom:3px;transition:border-color .2s,color .2s; }
        .w1-h3-link:hover { color:var(--gold);border-bottom-color:var(--gold); }
        /* Centering invitation before journal prompts */
        .w1-invite { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--sage);line-height:1.7;margin:4px 0 28px;padding-left:20px;border-left:2px solid var(--sage-lt); }
        .w1-prompt { padding:22px 0;border-bottom:1px solid var(--border); }
        .w1-prompt:first-child { border-top:1px solid var(--border); }
        .w1-prompt-num { font-size:13px;font-weight:600;letter-spacing:.3em;text-transform:uppercase;color:var(--sage);display:block;margin-bottom:10px; }
        .w1-prompt-q { font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;color:var(--ink);line-height:1.4;margin-bottom:10px; }
        .w1-prompt-hint { font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic; }
        .w1-actions { display:flex;flex-direction:column;gap:10px; }
        .w1-action { display:flex;align-items:stretch;border:.5px solid var(--border);border-radius:4px;background:white;transition:border-color .2s,background .2s; }
        .w1-action:hover { border-color:var(--sage);background:rgba(122,158,126,.04); }
        .w1-action.is-checked { background:rgba(122,158,126,.08);border-color:rgba(122,158,126,.45); }
        .w1-action.is-checked .w1-action-text { color:var(--ink-soft);text-decoration:line-through;text-decoration-color:rgba(107,140,110,.5);text-decoration-thickness:1px; }
        .w1-action.is-child { margin-left:32px;background:rgba(122,158,126,.04);border-color:rgba(122,158,126,.22); }
        .w1-action.is-child.is-checked { background:rgba(122,158,126,.10); }
        .w1-action-body { flex:1;min-width:0;display:flex;align-items:flex-start;gap:14px;padding:16px 18px;text-decoration:none;color:var(--ink); }
        .w1-action-dot { width:8px;height:8px;border-radius:50%;background:var(--sage);flex-shrink:0;margin-top:7px; }
        .w1-action-text { font-size:13.5px;color:var(--ink);line-height:1.55; }
        .w1-action-check { flex-shrink:0;display:flex;align-items:center;justify-content:center;width:54px;background:none;border:none;border-left:.5px solid var(--border);cursor:pointer;font-family:inherit;padding:0;color:var(--sage);transition:background .15s; }
        .w1-action-check:hover { background:rgba(122,158,126,.08); }
        .w1-action-check-box { width:22px;height:22px;border:1.5px solid rgba(107,140,110,.55);border-radius:4px;display:flex;align-items:center;justify-content:center;background:white;transition:background .2s,border-color .2s; }
        .w1-action-check:hover .w1-action-check-box { border-color:var(--sage); }
        .w1-action-check.checked .w1-action-check-box { background:var(--sage);border-color:var(--sage); }
        .w1-action-check-mark { color:white;font-size:14px;font-weight:700;line-height:1; }
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
        .pne-detail { margin-top:10px;background:var(--forest);border:.5px solid var(--border);border-radius:4px;padding:18px 24px; }
        .pne-detail .vp-coming-soon { margin-top:6px; }
        .pne-practice-rich { padding:24px 28px; }
        .pne-practice-title { margin:10px 0 4px;font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--cream);line-height:1.25; }
        .pne-practice-tag { margin:0 0 14px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;color:var(--sage-lt); }
        .pne-practice-p { margin:0 0 12px; }
        .pne-practice-steps { margin:8px 0 14px;border-top:1px solid rgba(168,197,172,.18); }
        .pne-step { display:flex;align-items:flex-start;gap:18px;padding:10px 0;border-bottom:1px solid rgba(168,197,172,.18); }
        .pne-step-time { flex-shrink:0;width:54px;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);padding-top:2px; }
        .pne-step-text { font-size:13.5px;color:rgba(245,240,232,.85);line-height:1.7; }
        .pne-practice-closer { margin:8px 0 0;font-style:italic;color:var(--sage-lt); }
        .pne-reflection { margin-top:18px;padding:26px 28px;background:var(--forest);border:.5px solid var(--border);border-left:3px solid var(--sage);border-radius:4px; }
        .pne-reflection-label { font-size:11px;font-weight:600;letter-spacing:.28em;text-transform:uppercase;color:var(--sage-lt);display:block;margin-bottom:12px; }
        .pne-reflection-q { font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;color:var(--cream);line-height:1.4;margin:0; }
        .pne-reflection .pne-reflection-textarea { margin-top:16px;background:rgba(245,240,232,0.96);border:1px solid rgba(168,197,172,0.35);border-left:2px solid var(--sage-lt);color:var(--ink); }
        .pne-reflection .pne-reflection-textarea:focus { background:#fff;border-color:var(--sage-lt); }
        .pne-reflection-pending { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;color:var(--sage-lt);margin:6px 0 0; }
        .pne-companion-read { display:inline-flex;align-items:center;gap:8px;margin:14px 0 4px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:17px;color:var(--sage);text-decoration:none;border-bottom:1px solid rgba(122,158,126,0.35);padding-bottom:2px;transition:color .15s,border-color .15s; }
        .pne-companion-read:hover { color:var(--ink);border-color:var(--sage); }
        .pne-companion-read-static { color:var(--stone);border-bottom:1px dashed rgba(122,158,126,0.25);cursor:default; }

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
        .journal-textarea{width:100%;margin-top:14px;padding:14px 16px;border:1px solid rgba(122,158,126,0.2);border-left:2px solid var(--sage-lt);background:rgba(122,158,126,0.04);font-family:'Jost',sans-serif;font-size:13.5px;font-weight:300;color:var(--ink);line-height:1.7;resize:vertical;outline:none;min-height:100px;transition:border-color .2s,background .2s}
        .journal-textarea:focus{border-color:var(--sage);background:rgba(122,158,126,0.07)}
        .journal-textarea::placeholder{color:rgba(28,43,30,0.5);font-style:italic}

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
        .w1-autosave { font-size:14px;color:var(--stone);font-style:italic;margin:4px 0 20px; }

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
          <div className="pc-hero-text">
            <span className="pc-hero-eyebrow">Member Portal · Iboga Journey · Confidential</span>
            <h1>Six Weeks of <em>Preparation</em></h1>
            <p className="pc-hero-desc">
              This portal is your guide through an evidence-based and deeply personal arc of preparation and integration.
              Each week draws on a Hawaiian principle, paired with a teaching from psychoneuroenergetics (PNE) to support the body, mind, and spirit.
              You&apos;ll find journal prompts, action items, and voices from the Vital Kauaʻi community.
            </p>
          </div>
          <div className="pc-hero-aside">
            <HeroCountdown mode="pre" />
          </div>
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
        {WEEKS.map((w, i) => (
          <div key={w.id} className={`pc-panel${activeWeek === i ? ' active' : ''}`}>

            {/* PRINCIPLE */}
            <section className="w1-section" id="principle">
              <span className="w1p-eyebrow">Week {i + 1} · {w.principleName} · {w.theme}</span>
              <h2 className="w1p-title">
                {i === 0
                  ? <>Seeing <em>clearly.</em></>
                  : <>{w.title}{w.subtitle && <><br /><em>{w.subtitle}</em></>}</>}
              </h2>
              <p className="w1p-pull">&ldquo;{w.principle}&rdquo;</p>
              {i === 0
                ? <p className="w1p-body">What you perceive shapes what you experience, and the world reflects it back as truth. Your attention, assumptions, and stories running underneath are the lens, and life answers in kind. This week is an invitation to look at the lens from which you view your reality.</p>
                : w.sub.split('\n\n').map((para, pi) => (
                    <p key={pi} className="w1p-body">{para}</p>
                  ))}
            </section>

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
                  const checkId = `pre-w${i}-a${ai}`
                  const isChecked = !!checklist[checkId]
                  const checkbox = (
                    <button
                      type="button"
                      className={`w1-action-check${isChecked ? ' checked' : ''}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCheck(checkId) }}
                      aria-label={isChecked ? 'Mark as not done' : 'Mark as done'}
                      aria-pressed={isChecked}
                    >
                      <span className="w1-action-check-box">
                        {isChecked && <span className="w1-action-check-mark">✓</span>}
                      </span>
                    </button>
                  )
                  let body
                  if (card.kind === 'static') {
                    body = (
                      <div className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{renderActionText(card.text, card.links)}</span>
                      </div>
                    )
                  } else if (card.kind === 'hash') {
                    body = (
                      <a href={card.href} className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  } else if (card.kind === 'external') {
                    body = (
                      <a href={card.href} target="_blank" rel="noopener noreferrer" className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </a>
                    )
                  } else {
                    body = (
                      <Link href={card.href} target="_blank" rel="noopener noreferrer" className="w1-action-body">
                        <span className="w1-action-dot" />
                        <span className="w1-action-text">{card.text}</span>
                      </Link>
                    )
                  }
                  return (
                    <div
                      key={ai}
                      className={`w1-action${isChecked ? ' is-checked' : ''}${card.text.startsWith("Complete this week's PNE") ? ' is-child' : ''}`}
                    >
                      {body}
                      {checkbox}
                    </div>
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
                      {dl && <Link href={dl.href} target="_blank" rel="noopener noreferrer" className="dn-cta">{dl.text}</Link>}
                    </div>
                    <div className="dn-body">{dataset}</div>
                    {dl && (
                      <div className="dn-footer">
                        <Link href={dl.href} target="_blank" rel="noopener noreferrer" className="dn-cta">{dl.text}</Link>
                      </div>
                    )}
                  </div>
                )
              })()}
            </section>

            {/* JOURNAL PROMPTS */}
            <section className="w1-section" id="journal-prompts">
              <h3 className="w1-h3">Journal Prompts</h3>
              <p className="w1-autosave">(Your writing saves automatically as you type. You can return any time to continue.)</p>
              {promptsForWeek(i, w.prompts).map((p, pi) => (
                <div className="w1-prompt" key={p.key}>
                  <span className="w1-prompt-num">{pi + 1}</span>
                  <p className="w1-prompt-q">{p.q}</p>
                  {p.hint && <p className="w1-prompt-hint">{p.hint}</p>}
                  <textarea
                    className="journal-textarea"
                    value={journal[p.key] ?? ''}
                    onChange={(e) => updateJournal(p.key, e.target.value)}
                    placeholder="Write freely..."
                    rows={4}
                  />
                </div>
              ))}
            </section>

            {/* PNE PERSPECTIVE */}
            <section className="w1-section" id="pne-perspective">
              <h3 className="w1-h3">
                {i === 0 ? (
                  <>PNE (PsychoNeuroEnergetics) Perspective: <em>The Language of the Body</em></>
                ) : i === 1 ? (
                  <>PNE (PsychoNeuroEnergetics) Perspective: <em>Nervous System Regulation</em></>
                ) : i === 2 ? (
                  <>PNE (PsychoNeuroEnergetics) Perspective: <em>Building Somatic Awareness</em></>
                ) : 'PNE Perspective'}
              </h3>
              {i === 0 && (
                <p className="w1-body">
                  This week&apos;s PNE (PsychoNeuroEnergetics) teaching introduces internal safety, the felt sense the nervous system rests into when all is well. From there, the PNE Guide walks through what happens when the system senses threat and how the body shifts into protection, and the internal and external structures, the people, places, and rhythms of your life, that build a foundation of safety from the inside out and the outside in.
                </p>
              )}
              {i === 1 && (
                <p className="w1-body">
                  This week&apos;s PNE (PsychoNeuroEnergetics) teaching introduces nervous system regulation, the body&apos;s natural movement between states of safety, protection, and rest. The PNE Guide walks through how to read the body&apos;s weather, ventral vagal, sympathetic, and dorsal vagal, the patterns of protection the system reaches for under stress, fight, flight, fawn, freeze, withdraw, soften inward, and the capacity to move through, how a regulated body returns to balance, and what that means as you prepare for ceremony.
                </p>
              )}
              {i === 2 && (
                <p className="w1-body">
                  This week&apos;s PNE (PsychoNeuroEnergetics) teaching turns toward sensation as the body&apos;s native language. The PNE Guide explores what a sensation is, neutral, locatable, alive, what deer can teach us about completing stress and shaking it off, how unprocessed energy gets held in the body, and the vocabulary that helps you describe what you feel. From there, it walks through working with sensation through a six-step inner practice you can return to whenever something asks for attention.
                </p>
              )}
              {(() => {
                const c = PRE_PNE_COMPANION[i]
                const label = `Read Week ${i + 1} in The PsychoNeuroEnergetics (PNE) Guide${c?.theme ? `: ${c.theme}` : ''}`
                return c?.url ? (
                  <Link href={c.url} target="_blank" rel="noopener noreferrer" className="pne-companion-read">
                    {label} <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <p className="pne-companion-read pne-companion-read-static">{label}</p>
                )
              })()}
              <div className="video-frame" style={{ marginTop: 18 }}>
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">{i < 3 ? 'PNE (PsychoNeuroEnergetics)' : 'PNE'} Teaching · Week {i + 1}</div>
                    <div className="vp-text">
                      {PRE_PNE_DETAILS[i]?.teaching
                        ?? 'A teaching from PsychoNeuroEnergetics paired with this week’s principle and the body’s lived response to it.'}
                    </div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
              {i === 0 ? (
                <div className="pne-detail pne-practice-rich">
                  <div className="vp-label">This Week&apos;s PNE Practice: The 4 / 7 / 8 Breath</div>
                  <h4 className="pne-practice-title">The 4 / 7 / 8 Breath</h4>
                  <p className="pne-practice-tag">A practice for returning to calm</p>
                  <p className="vp-text pne-practice-p">A simple, rhythmic breath that signals safety to the body. It slows the heart rate, lowers cortisol, and brings the system out of activation. Any breath where the exhale is longer than the inhale calms the nervous system.</p>
                  <p className="vp-text pne-practice-p">Bring one hand to your belly. Soften your gaze.</p>
                  <div className="pne-practice-steps">
                    <div className="pne-step"><span className="pne-step-time">4 sec</span><span className="pne-step-text">Inhale through the nose. Fill the belly first, then the chest.</span></div>
                    <div className="pne-step"><span className="pne-step-time">7 sec</span><span className="pne-step-text">Hold. Rest at the top.</span></div>
                    <div className="pne-step"><span className="pne-step-time">8 sec</span><span className="pne-step-text">Exhale through the mouth. Slow, soft, complete.</span></div>
                  </div>
                  <p className="vp-text pne-practice-closer">Repeat for four cycles.</p>
                </div>
              ) : i === 2 ? (
                <div className="pne-detail pne-practice-rich">
                  <div className="vp-label">This Week&apos;s PNE Practice: A Six-Step Inner Practice</div>
                  <h4 className="pne-practice-title">A Six-Step Inner Practice</h4>
                  <p className="pne-practice-tag">A gentle progression for meeting any sensation that calls for attention</p>
                  <p className="vp-text pne-practice-p">Choose any sensation that calls to you. Walk it gently through the six steps.</p>
                  <div className="pne-practice-steps">
                    <div className="pne-step"><span className="pne-step-time">I</span><span className="pne-step-text"><strong>Notice the Sensation.</strong> &ldquo;What am I feeling right now in my body?&rdquo;</span></div>
                    <div className="pne-step"><span className="pne-step-time">II</span><span className="pne-step-text"><strong>Name It Without Judgment.</strong> &ldquo;Tightness.&rdquo; &ldquo;Heaviness.&rdquo; &ldquo;Warmth.&rdquo;</span></div>
                    <div className="pne-step"><span className="pne-step-time">III</span><span className="pne-step-text"><strong>Make Space for It.</strong> &ldquo;Can I welcome it? Can I breathe into it?&rdquo;</span></div>
                    <div className="pne-step"><span className="pne-step-time">IV</span><span className="pne-step-text"><strong>Follow Its Movement.</strong> &ldquo;Notice any shifts. Stay curious.&rdquo;</span></div>
                    <div className="pne-step"><span className="pne-step-time">V</span><span className="pne-step-text"><strong>Ask Gently.</strong> &ldquo;What might this be about?&rdquo;</span></div>
                    <div className="pne-step"><span className="pne-step-time">VI</span><span className="pne-step-text"><strong>Offer Compassion.</strong> &ldquo;I am here with you.&rdquo;</span></div>
                  </div>
                  <p className="vp-text pne-practice-closer">Notice what shifts, and what simply asks to be witnessed.</p>
                </div>
              ) : (
                <div className="pne-detail">
                  <div className="vp-label">This Week&apos;s PNE Practice</div>
                  {PRE_PNE_DETAILS[i]?.practice
                    ? <div className="vp-text">{PRE_PNE_DETAILS[i].practice}</div>
                    : <div className="vp-coming-soon">Coming Soon</div>}
                </div>
              )}
              <div className="pne-reflection">
                <span className="pne-reflection-label">This Week&apos;s PNE Reflection</span>
                {PRE_PNE_DETAILS[i]?.reflection ? (
                  <>
                    <p className="pne-reflection-q">{PRE_PNE_DETAILS[i].reflection}</p>
                    <textarea
                      className="journal-textarea pne-reflection-textarea"
                      value={journal[`pre-pne-reflection-w${i}`] ?? ''}
                      onChange={(e) => updateJournal(`pre-pne-reflection-w${i}`, e.target.value)}
                      placeholder="Write freely..."
                      rows={4}
                    />
                    {PRE_PNE_DETAILS[i].reflectionFollowUp && (
                      <>
                        <p className="pne-reflection-q" style={{ marginTop: 24 }}>{PRE_PNE_DETAILS[i].reflectionFollowUp}</p>
                        <textarea
                          className="journal-textarea pne-reflection-textarea"
                          value={journal[`pre-pne-reflection-w${i}-2`] ?? ''}
                          onChange={(e) => updateJournal(`pre-pne-reflection-w${i}-2`, e.target.value)}
                          placeholder="Write freely..."
                          rows={4}
                        />
                      </>
                    )}
                  </>
                ) : (
                  <p className="pne-reflection-pending">Coming Soon</p>
                )}
              </div>
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
        ))}
      </main>

      {/* Save status */}
      <div className={`save-pill${saveStatus !== 'idle' ? ' visible' : ''}`}>
        {saveStatus === 'saving' ? 'Saving…' : 'Saved ✓'}
      </div>
    </>
  )
}
