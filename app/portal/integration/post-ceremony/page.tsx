'use client'

import { Fragment, useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getActiveJourney } from '@/lib/journeyHelpers'
import { getWeekCountdown } from '@/lib/weekCountdown'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { POST_CEREMONY_WEEKS } from '@/lib/journal-prompts'
import SectionIndex, { type SectionIndexItem } from '@/components/portal/SectionIndex'

// Section index per week, same six entries every week, plus a Completion
// anchor on Week 6 (the integration-statement + checklist + monthly-arc
// block is rendered there).
const BASE_SECTIONS: SectionIndexItem[] = [
  { label: 'Principle', anchor: '#principle' },
  { label: 'Video',     anchor: '#week-video' },
  { label: 'Actions',   anchor: '#action-items' },
  { label: 'PNE',       anchor: '#pne-perspective' },
  { label: 'Journal',   anchor: '#journal-prompts' },
  { label: 'Community', anchor: '#community' },
]
const COMPLETION_SECTION: SectionIndexItem = { label: 'Completion', anchor: '#completion' }
const sectionsForWeek = (weekIdx: number): SectionIndexItem[] =>
  weekIdx === 5 ? [...BASE_SECTIONS, COMPLETION_SECTION] : BASE_SECTIONS

// Action-item card shape, matches pre-ceremony's renderer so cards look and
// behave identically across the 12-week arc.
type ActionLinkArr = { text: string; href: string; external?: boolean }[]
type ActionCard =
  | { kind: 'internal'; href: string; text: string }
  | { kind: 'hash';     href: string; text: string }
  | { kind: 'external'; href: string; text: string }
  | { kind: 'static';   text: string; links?: ActionLinkArr }

const actionsForWeek = (
  actions: ReadonlyArray<{ text: string; links?: ActionLinkArr }>,
): ActionCard[] =>
  actions.map(a => {
    const links = a.links ?? []
    if (links.length === 0) return { kind: 'static', text: a.text }
    if (links.length > 1)   return { kind: 'static', text: a.text, links }
    const lnk = links[0]
    if (lnk.external)              return { kind: 'external', href: lnk.href, text: a.text }
    if (lnk.href.startsWith('#'))  return { kind: 'hash',     href: lnk.href, text: a.text }
    return { kind: 'internal', href: lnk.href, text: a.text }
  })

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

// ─── Return-practice calendar helpers ─────────────────────
function returnDates(): { months: number; label: string; date: Date }[] {
  const base = new Date()
  base.setHours(9, 0, 0, 0)
  const add = (m: number) => {
    const d = new Date(base)
    d.setMonth(d.getMonth() + m)
    return d
  }
  return [
    { months: 3,  label: '3-month integration return',  date: add(3)  },
    { months: 6,  label: '6-month integration return',  date: add(6)  },
    { months: 12, label: '1-year integration return',   date: add(12) },
  ]
}

function toICSDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function downloadReturnICS() {
  if (typeof window === 'undefined') return
  const now = new Date()
  const stamp = toICSDate(now)
  const desc = 'Return to your Vital Kauaʻi integration portal. Notice what has moved, what has deepened, what still asks for attention.\\n\\nhttps://vital-kauai.vercel.app/portal/integration/post-ceremony'
  const events = returnDates().map((r, i) => {
    const end = new Date(r.date.getTime() + 30 * 60 * 1000)
    return [
      'BEGIN:VEVENT',
      `UID:vk-return-${i}-${Date.now()}@vitalkauai`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toICSDate(r.date)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:Vital Kauaʻi · ${r.label}`,
      `DESCRIPTION:${desc}`,
      'END:VEVENT',
    ].join('\r\n')
  }).join('\r\n')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Vital Kauaʻi//Integration Returns//EN',
    events,
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vital-kauai-integration-returns.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function returnMailto(): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const lines = returnDates().map((r) => `• ${r.label}, ${fmt(r.date)}`).join('\n')
  const body =
    'A gentle reminder to return to your Vital Kauaʻi integration portal at these three markers:\n\n' +
    lines +
    '\n\nWhen each arrives, return and notice what has moved.\n\n' +
    'https://vital-kauai.vercel.app/portal/integration/post-ceremony'
  return `mailto:?subject=${encodeURIComponent('Vital Kauaʻi · Integration return dates')}&body=${encodeURIComponent(body)}`
}

// ─── Types ────────────────────────────────────────────────
type WeekTracking = {
  regulation: number        // 1–10
  practice_days: number     // 0–7
  patterns_returned: boolean
  patterns_intensity: number // 1–10, only if patterns_returned
  completed: boolean
}

type MonthlyTracking = {
  alignment: number         // 1–10
  patterns_returned: boolean
  practice_maintained: boolean
}

// ─── Per-week anchor lines for the green status box ──────
const POST_ANCHORS: readonly string[] = [
  'The medicine is still moving in you.',
  'Tending what arose.',
  'Meeting the familiar differently.',
  'Living the insight.',
  'Turning what you received outward.',
  'The work takes root.',
] as const

// ─── Week data ────────────────────────────────────────────
const WEEKS = [
  {
    id: 0,
    code: 'LŌKAHI',
    principleName: 'Lōkahi',
    principle: 'All things are connected. Act in unity.',
    theme: 'Unity',
    eyebrow: 'Week 1 · LŌKAHI · Unity',
    title: 'The medicine is still\nmoving in you.',
    subtitle: '',
    intro: 'Lōkahi means unity, the integration of all that was shown into the whole of who you are. This week asks almost nothing of you except presence. Rest after ceremony is active integration. Your nervous system is processing. Trust it.',
    safetyNote: {
      type: 'gold',
      label: 'The 48-hour window, read this first',
      text: 'The first 48 hours after ceremony are the most neurologically plastic of your entire journey. What you allow yourself to feel, what you speak aloud, what you write, is being encoded more deeply than at almost any other moment in your life. This is a time for receiving what was shown, set aside decisions, analysis, and explanation.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'You made it through. In this first transmission Rachel and Josh speak directly to where you are right now, the tenderness, the strange combination of exhaustion and aliveness. They want to meet you exactly here, before you do anything else.' },
    actionLabel: 'This week, 4 things',
    actions: [
      {
        color: 'sage',
        text: 'Connect with your integration guide, your post-ceremony call, within 48 hours of ceremony (while still on Kauaʻi)',
        note: 'Your first integration-guide call. Held within 48 hours of ceremony so what was shown is still alive in the body. Bring whatever you need to bring, questions, gratitude, exhaustion. They are there to meet you.',
        links: [
          { text: 'Connect with your integration guide, your post-ceremony call, within 48 hours of ceremony (while still on Kauaʻi)', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'green', text: 'Rest completely for the first 48 hours', note: 'Let the experience settle. Rest before sharing. Allow what happened to remain wordless a little longer.' },
      { color: 'blue', text: 'Journal what arose, images, moments, what the medicine showed you', note: 'Don\'t interpret it yet. Just record it. The meaning arrives in its own time. What you write now will be the material you return to for months.' },
      {
        color: 'amber',
        text: 'Schedule next week\'s integration-guide call',
        links: [
          { text: 'Schedule next week\'s integration-guide call', href: '/portal#integration-specialist' },
        ],
      },
    ],
    prompts: POST_CEREMONY_WEEKS[0].prompts,
    thread: 'What you record this week becomes the foundation of the integration work ahead. Let it exist on the page. Next week you begin to live it.',
  },
  {
    id: 1,
    code: 'MĀLAMA',
    principleName: 'Mālama',
    principle: 'Tend what is precious.',
    theme: 'Tending',
    eyebrow: 'Week 2 · MĀLAMA · Tending',
    title: 'The insights are alive.',
    subtitle: 'Now you tend them.',
    carryForward: 'You rested. You recorded what arose. You checked in with your guide. This week the work moves from receiving into tending, the slow, deliberate act of bringing what was shown into how you actually live.',
    intro: 'Mālama means to care for, to tend, to preserve. The noribogaine window, your brain\'s heightened state of plasticity, is at its most open right now. This is the most important behavioral window of your entire process. What you practice this week is being written more deeply than usual.',
    safetyNote: {
      type: 'gold',
      label: 'The noribogaine window, this is urgent',
      text: 'Noribogaine, iboga\'s primary metabolite, keeps your brain in a state of heightened neuroplasticity for approximately 4–6 weeks post-ceremony. Right now you are at peak plasticity. What you practice consistently this week becomes your new baseline faster than at almost any other time in your adult life. This is the most important behavioral window of your entire process. Use it deliberately.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 2', text: 'The neuroplasticity window is real, and this week is its peak. Rachel and Josh talk about what that actually means in practice, why this week\'s small daily choices matter more than they appear, and how to tend what the medicine opened without forcing it into shape too quickly.' },
    actionLabel: 'This week, 4 things',
    actions: [
      {
        color: 'sage',
        text: 'Connect with your integration guide',
        note: 'Your weekly call. Bring whatever is alive, what is settling, what is surprising you, what is asking for tending.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'gold', text: 'Establish one morning practice, and do it every day, tracking your days below', note: 'Coherent Heart Breath. Journaling. Movement. Prayer. One thing. Done every morning. The medicine opened the door. Repetition is how you walk through it.' },
      { color: 'green', text: 'Continue magnesium glycinate (300–400mg) and DHA/EPA (2–4g) daily', note: 'The supplement protocol from your preparation does not end at ceremony. Magnesium supports nervous system regulation during the post-ceremony window. DHA/EPA supports the neuroplasticity process. Continue both for at minimum 30 days post-ceremony.' },
      { color: 'sage', text: 'Continue full sobriety, minimum 30 days, 3 months strongly recommended', note: 'Iboga resets tolerance. Returning to any substance before the window closes undermines what the medicine worked to open. The noribogaine window is your most protected asset right now.' },
      {
        color: 'blue',
        text: 'Schedule a check-in call with Rachel & Josh',
        note: 'An optional mid-integration touchpoint to bring what is still moving, notice what has anchored, and speak honestly about what is alive.',
        links: [
          { text: 'Schedule a check-in call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-check-in-call', external: true },
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
    prompts: POST_CEREMONY_WEEKS[1].prompts,
    thread: 'The practice you establish this week has a disproportionate impact on everything that follows. The medicine opened the window. This week you decide what you\'re building inside it.',
  },
  {
    id: 2,
    code: 'HAʻAHAʻA',
    principleName: 'Haʻahaʻa',
    principle: 'Remain humble. Stay teachable.',
    theme: 'Humility',
    eyebrow: 'Week 3 · HAʻAHAʻA · Humility',
    title: 'The familiar is returning.',
    subtitle: 'Meet it differently.',
    carryForward: 'You\'ve been tending new practices. You\'ve begun to bring the insights into your days. This week something will shift, old patterns may begin to resurface. This is the real integration beginning.',
    intro: 'Haʻahaʻa means humility, the willingness to be exactly where you are without pretending to be further along. By week three, the acute aliveness of ceremony has softened. The ordinary world has returned. And with it, the familiar, however slightly, may start to return. Your ability to notice it, welcome it, and shift it with greater awareness is alive. This week asks you to meet all of that with humility.',
    reentry: {
      strong: 'When the pattern hits, do this:',
      text: ' (1) Name it aloud or in writing: "This is the [fear / avoidance / contraction] pattern." (2) Feet flat on the floor. One hand on your heart. One slow breath, in for 5, hold for 2, out for 7. (3) Name it openly, tell your guide, your support person, or write it here. (4) Return to your practice, even for five minutes. The pattern yields to your sustained attention and your practice. This is neuroscience.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 3', text: 'Rachel and Josh speak directly to the return of the familiar, why it happens, what it means, and why the people who stay with the practice through this week are the ones who see lasting change.' },
    actionLabel: 'This week, 3 things',
    actions: [
      {
        color: 'gold',
        text: 'Connect with your integration guide',
        note: 'This is the most important call of the integration arc. Bring the return of the familiar. Bring what is still unresolved. Your guide is trained to work with exactly this territory. Book via the Integration Specialist section on your Dashboard.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'blue', text: 'Name one old pattern that has returned, write about it', note: 'To see it clearly. Naming with precision is itself a form of integration. Your guide can see your weekly tracking and will reach out if they notice something that needs support.' },
      { color: 'sage', text: 'Continue your daily practice, especially on the days you least want to', note: 'The days you least want to show up are the days it matters most.' },
      {
        color: 'amber',
        text: 'Schedule next week\'s integration-guide call',
        links: [
          { text: 'Schedule next week\'s integration-guide call', href: '/portal#integration-specialist' },
        ],
      },
    ],
    prompts: POST_CEREMONY_WEEKS[2].prompts,
    thread: 'Every person who has done deep transformational work meets this week. The ones who move through it are the ones who keep showing up to their practice. You are in the long arc now.',
  },
  {
    id: 3,
    code: 'KULEANA',
    principleName: 'Kuleana',
    principle: 'Carry your responsibility with honor.',
    theme: 'Responsibility',
    eyebrow: 'Week 4 · KULEANA · Responsibility',
    title: 'The knowing is yours now.',
    subtitle: 'Let it become how you live.',
    carryForward: 'You met the return of the familiar with humility. You kept your practice. You stayed honest with your guide. This week the work becomes a choice, a deliberate, daily act of accountability to the person the medicine showed you that you could be.',
    intro: 'Kuleana means sacred accountability, responsibility that serves your deepest transformation. The medicine showed you something. You have seen it clearly. Week four is where the seeing becomes choosing. The noribogaine window is beginning to narrow. What you anchor into behavior now is what will carry forward.',
    safetyNote: {
      type: 'gold',
      label: 'The window is beginning to close, anchor now',
      text: 'By the end of week four, the peak neuroplasticity driven by noribogaine begins to narrow. The extraordinary ease of new pattern formation that characterized weeks 1–3 is shifting toward normal, and what you have practiced is becoming structural. What you have yet to commit to in behavior will ask more of you after this week. This week matters.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 4', text: 'Kuleana is one of the most important Hawaiian concepts for understanding what integration actually requires. In this transmission Rachel and Josh talk about the difference between insight and accountability, and what it looks like to take full responsibility for the change you\'ve been shown is possible.' },
    actionLabel: 'This week, 4 things',
    actions: [
      { color: 'gold', text: 'Write your three non-negotiables for the next three months', note: 'Three things you are committing to, in your body, your relationships, your daily life, that reflect who you are becoming. Specific, liveable, honest.' },
      { color: 'blue', text: 'Share your non-negotiables with one person in your life', note: 'Accountability held by another person anchors differently than accountability held alone. Be specific about what you are asking them to hold with you.' },
      { color: 'sage', text: 'Audit one thing in your environment that actively works against your new self \u2014 and change it this week', note: 'Physical environment. Social environment. Digital environment. What in each is pulling you back toward who you were? Make one concrete change this week.' },
      {
        color: 'amber',
        text: 'Connect with your integration guide',
        note: 'Bring your non-negotiables. Name the pattern you are auditing. This is the call that anchors Week 4 accountability into behavior.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
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
    prompts: POST_CEREMONY_WEEKS[3].prompts,
    thread: 'Kuleana is an honor, the recognition that you have been shown something real and that you are capable of living it. Next week the work moves outward, into your relationships.',
  },
  {
    id: 4,
    code: 'ALOHA',
    principleName: 'Aloha',
    principle: 'Let love be the way you act.',
    theme: 'Love in Action',
    eyebrow: 'Week 5 · ALOHA · Love in Action',
    title: 'You have changed.',
    subtitle: 'Your relationships are noticing.',
    carryForward: 'You have anchored your non-negotiables. You have taken responsibility for what you know. This week the work moves outward, into the relational field, where transformation either lands or dissolves.',
    intro: 'Aloha as genuine, embodied presence in relationship. By week five, the people in your life are responding to a changed version of you. This week you learn how to hold your new ground with love rather than armor.',
    reentry: {
      strong: 'If people in your life are struggling with your changes:',
      text: ' When one person does deep transformational work, the entire relational system around them reorganizes. This is a sign the change is real. The people closest to you have built their relationship with the previous version of you. Give them time. Hold your changes clearly without needing their immediate understanding or approval. The skill here is patience without self-abandonment, staying present to the relationship while remaining your changed self. Bring specific relationships to your guide this week.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'The integration that happens in relationship is some of the most important integration of all. Rachel and Josh talk about what it looks like to bring a changed self back into existing relationships, how to hold new ground without disconnecting from the people you love, and how to let the medicine\'s work deepen through honest contact with others.' },
    actionLabel: 'This week, 4 things',
    actions: [
      { color: 'blue', text: 'Have one honest conversation you have been postponing', note: 'The medicine may have shown you something about a relationship that needs to be spoken. Come from the changed place. Bring what comes up to your next call with your guide.' },
      { color: 'sage', text: 'Practice being your changed self in the presence of people who knew you before', note: 'Notice when you contract back into who you were in someone\'s presence. That noticing is the practice. You can only keep showing up as the person you are becoming.' },
      { color: 'green', text: 'Practice Ho\'oponopono with anyone you are still carrying', note: 'I\'m sorry. Please forgive me. Thank you. I love you. The forgiveness work from ceremony continues here. It does not require the other person to be present or to know. This is an internal release.' },
      {
        color: 'amber',
        text: 'Connect with your integration guide',
        note: 'Bring the relationships that are reorganizing around your change. Your guide can help you stay present to what is arising without abandoning yourself or the people you love.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
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
    prompts: POST_CEREMONY_WEEKS[4].prompts,
    thread: 'The integration that holds in relationship is the integration that holds in life. What you are practicing this week, being your changed self in the presence of people who knew you before, is some of the most important work of the entire arc.',
  },
  {
    id: 5,
    code: 'PONO',
    principleName: 'Pono',
    principle: 'Stand in right relationship.',
    theme: 'Right Relationship',
    eyebrow: 'Week 6 · PONO · Right Relationship',
    title: 'Six weeks in.',
    subtitle: 'This is who you are now.',
    carryForward: 'You have moved through the full arc, from the raw tenderness of emergence to the relational work of week five. This final week is a transition from active integration into sustained living.',
    intro: 'Pono means right relationship, with yourself, with others, with the life you are building. Week six marks the close of the intensive integration window and the opening of a longer, quieter arc. The medicine\'s most dramatic effects have passed, but its work continues, in your dreams, your relationships, your daily choices, and in the moments you catch yourself responding differently than you used to.',
    video: { label: 'A Message from Rachel & Josh · Week 6', text: 'Six weeks ago you came home from ceremony. In this final weekly transmission Rachel and Josh want to mark what you have done. The long integration is beginning. They want you to know what to expect, and how to hold yourself through the months ahead.' },
    actionLabel: 'This week, 4 completions',
    actions: [
      {
        color: 'blue',
        text: 'Schedule your Completion Call with Rachel & Josh',
        note: 'The closing call of your integration arc with Rachel & Josh. Bring your integration statement. Bring what has landed, what is still moving, and what you are carrying forward.',
        links: [
          { text: 'Schedule your Completion Call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-completion-call', external: true },
        ],
      },
      {
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'You have sessions remaining in your six-session arc, and you can also continue beyond that as a living practice. Your guide can help you establish a monthly rhythm or meet you as the work keeps moving. Book via the Integration Specialist section on your Dashboard.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'sage', text: 'Write your integration statement, guided below', note: 'Three questions, one page. What changed. What you know now. What you are committed to. Date it. You will want to read it in six months.' },
      { color: 'green', text: 'Establish your monthly rhythm, one practice, one question, one connection', note: 'One thing you do every day. One honest question each month. One conversation with someone who knows what you went through. Simple enough to sustain.' },
    ],
    integrationStatement: [
      { q: 'What genuinely changed?', hint: 'Actual, lived change. How do you move through the world differently now? Name specific behaviors, responses, ways of being.' },
      { q: 'What do you know now that you didn\'t know before?', hint: 'About yourself. About what you want. About what you were carrying. About what is possible.' },
      { q: 'What are you committed to in the next six months?', hint: 'One sentence. Concrete and liveable. Something you can return to and know immediately whether you kept it.' },
    ],
    checklist: [
      'Integration statement written and dated',
      'Monthly rhythm established',
    ],
    prompts: POST_CEREMONY_WEEKS[5].prompts,
    thread: 'The medicine opened a window. You chose to walk through it, week by week, practice by practice, honest conversation by honest conversation. What you have built is a foundation. The work continues. We continue with you.',
    monthlyArc: true,
  },
]

const DOT: Record<string, string> = {
  blue: '#4A7FA5', green: '#7A9E7E', gold: '#C8A96E', sage: '#7A9E7E', amber: '#B8956A',
}

// ─── Weekly Check-in Modal ────────────────────────────────
function WeeklyCheckIn({
  weekIdx, onComplete, onCancel, previousTracking
}: {
  weekIdx: number
  onComplete: (data: Omit<WeekTracking, 'completed'>) => void
  onCancel: () => void
  previousTracking: WeekTracking | null
}) {
  const [regulation, setRegulation] = useState(7)
  const [practiceDays, setPracticeDays] = useState(4)
  const [patternsReturned, setPatternsReturned] = useState(false)
  const [patternsIntensity, setPatternsIntensity] = useState(5)
  const [honest, setHonest] = useState(false)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(14,26,16,0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
    }}>
      <div style={{
        background: '#FDFBF7', borderRadius: 6, maxWidth: 520, width: '100%',
        padding: '40px 44px', border: '0.5px solid rgba(200,169,110,0.25)'
      }}>
        <div style={{ fontSize: 8.5, letterSpacing: '0.28em', textTransform: 'uppercase', color: '#C8A96E', marginBottom: 8 }}>
          Before you complete Week {weekIdx + 1}
        </div>
        <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 300, color: '#1A1A18', marginBottom: 6, lineHeight: 1.2 }}>
          Weekly check-in
        </h3>
        <p style={{ fontSize: 12.5, color: '#8B8070', marginBottom: 28, lineHeight: 1.7 }}>
          A short reflection to help you notice what is moving and surface anything that wants more support. Be honest, this is for you.
        </p>

        {/* Previous week context */}
        {previousTracking && (
          <div style={{
            background: 'rgba(28,43,30,0.04)', border: '0.5px solid rgba(28,43,30,0.1)',
            borderRadius: 4, padding: '12px 16px', marginBottom: 22,
            display: 'flex', gap: 20, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#8B8070', alignSelf: 'center', flexShrink: 0 }}>Last week</span>
            <span style={{ fontSize: 12.5, color: '#3D3D38', fontFamily: 'Cormorant Garamond, serif' }}>
              Regulation <strong style={{ color: '#C8A96E' }}>{previousTracking.regulation}/10</strong>
            </span>
            <span style={{ fontSize: 12.5, color: '#3D3D38', fontFamily: 'Cormorant Garamond, serif' }}>
              Practice <strong style={{ color: '#C8A96E' }}>{previousTracking.practice_days}/7 days</strong>
            </span>
            {previousTracking.patterns_returned && (
              <span style={{ fontSize: 12.5, color: '#3D3D38', fontFamily: 'Cormorant Garamond, serif' }}>
                Patterns <strong style={{ color: '#A85555' }}>returned ({previousTracking.patterns_intensity}/10)</strong>
              </span>
            )}
          </div>
        )}

        {/* Regulation */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 10 }}>
            How regulated do you feel this week? <span style={{ color: '#C8A96E', fontWeight: 500 }}>{regulation}/10</span>
          </label>
          <input type="range" min={1} max={10} value={regulation}
            onChange={e => setRegulation(+e.target.value)}
            style={{ width: '100%', accentColor: '#C8A96E' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#8B8070', marginTop: 4 }}>
            <span>Dysregulated</span><span>Fully grounded</span>
          </div>
        </div>

        {/* Practice days */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 10 }}>
            Days you completed your daily practice this week: <span style={{ color: '#C8A96E', fontWeight: 500 }}>{practiceDays}/7</span>
          </label>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2,3,4,5,6,7].map(d => (
              <button key={d} onClick={() => setPracticeDays(d)} style={{
                width: 36, height: 36, borderRadius: 4, border: '1px solid',
                borderColor: practiceDays === d ? '#C8A96E' : 'rgba(28,43,30,0.15)',
                background: practiceDays === d ? 'rgba(200,169,110,0.12)' : 'white',
                color: practiceDays === d ? '#C8A96E' : '#8B8070',
                fontSize: 13, cursor: 'pointer', fontFamily: 'Jost, sans-serif',
                fontWeight: practiceDays === d ? 500 : 300,
              }}>{d}</button>
            ))}
          </div>
        </div>

        {/* Patterns */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 10 }}>
            Did old patterns return this week?
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[{label: 'Yes', val: true}, {label: 'No', val: false}].map(({label, val}) => (
              <button key={label} onClick={() => setPatternsReturned(val)} style={{
                padding: '8px 22px', borderRadius: 3, border: '1px solid',
                borderColor: patternsReturned === val ? '#C8A96E' : 'rgba(28,43,30,0.15)',
                background: patternsReturned === val ? 'rgba(200,169,110,0.1)' : 'white',
                color: patternsReturned === val ? '#C8A96E' : '#8B8070',
                fontSize: 12, cursor: 'pointer', fontFamily: 'Jost, sans-serif',
              }}>{label}</button>
            ))}
          </div>
          {patternsReturned && (
            <div style={{ marginTop: 14 }}>
              <label style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#3D3D38', display: 'block', marginBottom: 8 }}>
                Intensity: <span style={{ color: '#C8A96E', fontWeight: 500 }}>{patternsIntensity}/10</span>
              </label>
              <input type="range" min={1} max={10} value={patternsIntensity}
                onChange={e => setPatternsIntensity(+e.target.value)}
                style={{ width: '100%', accentColor: '#A85555' }} />
            </div>
          )}
        </div>

        {/* Honest confirmation */}
        <div style={{
          background: 'rgba(200,169,110,0.06)', border: '0.5px solid rgba(200,169,110,0.2)',
          borderRadius: 4, padding: '14px 18px', marginBottom: 24,
          display: 'flex', gap: 12, alignItems: 'flex-start'
        }}>
          <input type="checkbox" id="honest" checked={honest}
            onChange={e => setHonest(e.target.checked)}
            style={{ marginTop: 3, accentColor: '#C8A96E', flexShrink: 0 }} />
          <label htmlFor="honest" style={{ fontSize: 12.5, color: '#3D3D38', lineHeight: 1.65, cursor: 'pointer' }}>
            I completed this week honestly, including the actions that were most difficult, and the parts I would rather have skipped.
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '12px 0', background: 'none',
            border: '0.5px solid rgba(28,43,30,0.2)', borderRadius: 3,
            fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
            color: '#8B8070', cursor: 'pointer', fontFamily: 'Jost, sans-serif',
          }}>Go back</button>
          <button
            disabled={!honest}
            onClick={() => onComplete({ regulation, practice_days: practiceDays, patterns_returned: patternsReturned, patterns_intensity: patternsIntensity })}
            style={{
              flex: 2, padding: '12px 0',
              background: honest ? '#C8A96E' : 'rgba(200,169,110,0.25)',
              border: 'none', borderRadius: 3,
              fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
              color: honest ? '#0E1A10' : '#8B8070',
              cursor: honest ? 'pointer' : 'not-allowed', fontFamily: 'Jost, sans-serif',
              fontWeight: 500, transition: 'all 0.2s',
            }}>
            Complete Week {weekIdx + 1}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Progress Insights ───────────────────────────────────
function ProgressInsights({ tracking }: { tracking: Record<number, WeekTracking> }) {
  const entries = Object.entries(tracking)
    .filter(([, t]) => t.completed)
    .sort(([a], [b]) => +a - +b)
    .map(([, t]) => t)

  if (entries.length < 1) return null

  const first = entries[0]
  const latest = entries[entries.length - 1]
  const hasMultiple = entries.length >= 2

  // Regulation
  const regFirst = first.regulation
  const regLatest = latest.regulation
  const regDelta = hasMultiple ? regLatest - regFirst : null
  const regUp = regDelta !== null && regDelta > 0
  const regDown = regDelta !== null && regDelta < 0

  // Practice average across all completed weeks
  const avgPractice = Math.round(entries.reduce((s, t) => s + t.practice_days, 0) / entries.length * 10) / 10

  // Pattern intensity trend
  const withPatterns = entries.filter(t => t.patterns_returned)
  const patternDelta = withPatterns.length >= 2
    ? withPatterns[withPatterns.length - 1].patterns_intensity - withPatterns[0].patterns_intensity
    : null
  const patternsEasing = patternDelta !== null && patternDelta < 0

  const Arrow = ({ up }: { up: boolean }) => (
    <span style={{ fontSize: 11, marginLeft: 4, color: up ? '#7A9E7E' : '#A85555' }}>
      {up ? '↑' : '↓'}
    </span>
  )

  return (
    <div style={{
      background: 'rgba(28,43,30,0.03)',
      borderBottom: '0.5px solid rgba(28,43,30,0.08)',
      padding: '12px 48px',
      display: 'flex', alignItems: 'center', gap: 0,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 8, letterSpacing: '0.26em', textTransform: 'uppercase',
        color: '#8B8070', marginRight: 28, flexShrink: 0,
      }}>Your progress</span>

      {/* Regulation */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 28, gap: 0 }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B8070', marginRight: 8 }}>Regulation</span>
        {hasMultiple ? (
          <span style={{ fontSize: 13, color: '#1A1A18', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
            {regFirst}
            <span style={{ color: '#C8A96E', margin: '0 5px', fontSize: 11 }}>→</span>
            {regLatest}
            {regDelta !== 0 && <Arrow up={regUp} />}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: '#1A1A18', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
            {regLatest}/10
          </span>
        )}
      </div>

      {/* Practice */}
      <div style={{ display: 'flex', alignItems: 'center', marginRight: 28, gap: 0 }}>
        <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B8070', marginRight: 8 }}>Practice</span>
        <span style={{ fontSize: 13, color: '#1A1A18', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
          {avgPractice}
          <span style={{ fontSize: 10, color: '#8B8070', marginLeft: 2 }}>/7 days avg</span>
          {avgPractice >= 5 && <span style={{ fontSize: 11, color: '#7A9E7E', marginLeft: 4 }}>↑</span>}
        </span>
      </div>

      {/* Patterns easing */}
      {patternsEasing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ fontSize: 8.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8B8070', marginRight: 8 }}>Patterns</span>
          <span style={{ fontSize: 13, color: '#7A9E7E', fontFamily: 'Cormorant Garamond, serif', fontWeight: 300 }}>
            easing ↓
          </span>
        </div>
      )}

      {/* Encouragement line, contextual */}
      {hasMultiple && (
        <span style={{
          marginLeft: 'auto', fontSize: 11.5, color: '#8B8070',
          fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic',
          fontWeight: 300,
        }}>
          {regUp && regDelta! >= 2
            ? `Regulation improved by ${regDelta} points.`
            : regDown
            ? 'Harder weeks are part of the arc.'
            : avgPractice >= 5
            ? 'Consistency is showing.'
            : 'Keep going.'}
        </span>
      )}
    </div>
  )
}

// ─── Journal sync map: post-ceremony key → member_journals key ───────────────
const POST_TO_JOURNAL_MAP: Record<string, string> = {
  'w1-p2': 'p1-4',  // "What did the medicine show me about my own nature..."
  'w2-p2': 'p1-8',  // "Looking back at the intentions I set before ceremony..."
  'w4-p4': 'p2-6',  // "Where is forgiveness still alive..."
  'w5-p0': 'p2-9',  // "Who am I now, compared to who I was when I arrived at ceremony?"
  'w5-p2': 'p2-8',  // "How has my sense of purpose or direction shifted?"
}

// ─── Main component ───────────────────────────────────────
export default function PostCeremonyPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const [activeWeek, setActiveWeek] = useState(0)
  const [ceremonyStartAt, setCeremonyStartAt] = useState<string | null>(null)
  const [completed, setCompleted] = useState<Set<number>>(new Set())
  const [checklist, setChecklist] = useState<Record<string, boolean>>({})
  const [weeklyTracking, setWeeklyTracking] = useState<Record<number, WeekTracking>>({})
  const [journal, setJournal] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [checkInWeek, setCheckInWeek] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/portal'); return }
      setUserId(user.id)
      setUserEmail(user.email ?? '')

      const journey = await getActiveJourney(supabase, user.id).catch(() => null)
      if (journey?.start_at) setCeremonyStartAt(journey.start_at)

      const { data } = await supabase
        .from('post_ceremony_progress')
        .select('*')
        .eq('member_id', user.id)
        .single()
      if (data) {
        const done = new Set<number>(data.weeks_completed ?? [])
        setCompleted(done)
        setChecklist(data.checklist_items ?? {})
        setWeeklyTracking(data.weekly_tracking ?? {})
        setJournal(data.journal_responses ?? {})
        const next = [0,1,2,3,4,5].find(w => !done.has(w))
        setActiveWeek(next !== undefined ? next : 5)
      }
      setLoading(false)
    }
    load()
  }, [])

  const save = useCallback(async (
    newCompleted: Set<number>,
    newChecklist: Record<string, boolean>,
    newTracking: Record<number, WeekTracking>,
    newJournal?: Record<string, string>
  ) => {
    if (!userId) return
    setSaveStatus('saving')
    await supabase.from('post_ceremony_progress').upsert({
      member_id: userId,
      weeks_completed: [...newCompleted],
      checklist_items: newChecklist,
      weekly_tracking: newTracking,
      journal_responses: newJournal ?? journal,
      last_updated: new Date().toISOString(),
    }, { onConflict: 'member_id' })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2200)
  }, [userId, journal])

  const syncToMainJournal = useCallback(async (integJournal: Record<string, string>, changedKey: string) => {
    if (!userId || !POST_TO_JOURNAL_MAP[changedKey]) return
    const updates: Record<string, string> = {}
    for (const [integKey, journalKey] of Object.entries(POST_TO_JOURNAL_MAP)) {
      if (integJournal[integKey]) updates[journalKey] = integJournal[integKey]
    }
    if (Object.keys(updates).length === 0) return
    const { data } = await supabase.from('member_journals').select('responses').eq('member_id', userId).maybeSingle()
    const merged = { ...((data?.responses as Record<string, string>) ?? {}), ...updates }
    await supabase.from('member_journals').upsert({ member_id: userId, responses: merged, last_saved_at: new Date().toISOString() }, { onConflict: 'member_id' })
  }, [userId])

  // Journal auto-save with debounce
  const journalTimerRef = { current: null as ReturnType<typeof setTimeout> | null }
  const updateJournal = (key: string, value: string) => {
    const next = { ...journal, [key]: value }
    setJournal(next)
    if (journalTimerRef.current) clearTimeout(journalTimerRef.current)
    journalTimerRef.current = setTimeout(() => {
      save(completed, checklist, weeklyTracking, next)
      syncToMainJournal(next, key)
    }, 1500)
  }

  const handleCheckInComplete = async (weekIdx: number, data: Omit<WeekTracking, 'completed'>) => {
    setCheckInWeek(null)
    const newTracking = { ...weeklyTracking, [weekIdx]: { ...data, completed: true } }
    const newCompleted = new Set(completed)
    newCompleted.add(weekIdx)
    setWeeklyTracking(newTracking)
    setCompleted(newCompleted)
    setTimeout(() => setActiveWeek(Math.min(weekIdx + 1, 5)), 350)
    await save(newCompleted, checklist, newTracking)
  }

  const toggleCheck = async (id: string) => {
    const next = { ...checklist, [id]: !checklist[id] }
    setChecklist(next)
    await save(completed, next, weeklyTracking)
  }

  const progress = Math.round((completed.size / 6) * 100)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0E1A10', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8A96E', animation: `pulse 1.2s ease-in-out ${i*0.2}s infinite` }} />)}
      <style>{`@keyframes pulse{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
    </div>
  )

  return (
    <>
      {checkInWeek !== null && (
        <WeeklyCheckIn
          weekIdx={checkInWeek}
          onComplete={(data) => handleCheckInComplete(checkInWeek, data)}
          onCancel={() => setCheckInWeek(null)}
          previousTracking={checkInWeek > 0 ? (weeklyTracking[checkInWeek - 1] ?? null) : null}
        />
      )}

      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--forest:#1C2B1E;--deep:#0E1A10;--sage:#7A9E7E;--sage-lt:#A8C5AC;--gold:#C8A96E;--cream:#F5F0E8;--warm:#FDFBF7;--stone:#8B8070;--ink:#1A1A18;--ink-mid:#3D3D38;--border:rgba(28,43,30,0.12);--border-lt:rgba(28,43,30,0.06)}
        html{scroll-behavior:smooth}body{font-family:'Jost',sans-serif;font-weight:300;background:var(--warm);color:var(--ink)}
        .pc-nav{position:sticky;top:0;z-index:100;background:rgba(14,26,16,.97);backdrop-filter:blur(16px);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 48px;border-bottom:1px solid rgba(200,169,110,.08)}
        .pc-nav-left{display:flex;align-items:center;gap:32px}.pc-logo{font-family:'Cormorant Garamond',serif;font-size:17px;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:var(--cream);text-decoration:none}.pc-logo em{font-style:italic;color:var(--sage-lt)}
        .pc-nav-links{display:flex;align-items:center;gap:4px}.pc-nav-link{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.45);text-decoration:none;padding:6px 14px;border:none;background:none;font-family:inherit;cursor:pointer;transition:color .2s}.pc-nav-link:hover{color:var(--cream)}
        .pc-dropdown{position:relative}.pc-dropdown-trigger{font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--sage-lt);padding:6px 14px;border:none;background:none;font-family:inherit;cursor:pointer;display:flex;align-items:center;gap:6px}.pc-dropdown-trigger::after{content:'▾';font-size:8px;color:var(--gold)}
        .pc-dropdown-menu{display:none;position:absolute;top:calc(100% + 10px);left:0;background:rgba(14,26,16,.98);backdrop-filter:blur(16px);border:.5px solid rgba(200,169,110,.15);border-radius:4px;min-width:190px;padding:8px 0;box-shadow:0 16px 40px rgba(0,0,0,.4)}.pc-dropdown:hover .pc-dropdown-menu{display:block}
        .pc-dropdown-item{display:block;padding:10px 20px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(245,240,232,.55);text-decoration:none;transition:color .15s,background .15s;border-left:2px solid transparent}.pc-dropdown-item:hover{color:var(--cream);background:rgba(122,158,126,.06)}.pc-dropdown-item.current{color:var(--sage-lt);border-left-color:var(--sage)}
        .pc-nav-right{display:flex;align-items:center;gap:14px}.pc-nav-email{font-size:9px;letter-spacing:.1em;color:rgba(245,240,232,.3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.pc-nav-out{font-size:8.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(200,169,110,.5);background:none;border:none;cursor:pointer;font-family:inherit;transition:color .2s}.pc-nav-out:hover{color:var(--gold)}
        .pc-prog{background:rgba(28,43,30,.06);border-bottom:1px solid var(--border-lt);padding:14px 48px;display:flex;align-items:center;gap:18px}.pc-prog-label{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--stone);font-weight:500}.pc-prog-track{flex:1;height:4px;background:var(--border);border-radius:3px;max-width:340px}.pc-prog-fill{height:100%;background:var(--gold);border-radius:3px;transition:width .6s ease}.pc-prog-week{font-size:12px;letter-spacing:.1em;color:var(--gold);font-weight:500}
        .pc-hero{background:linear-gradient(135deg,#1C2B1E 0%,#2E4231 60%,#1a3020 100%);padding:80px 60px 72px;position:relative;overflow:hidden}.pc-hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 30% 60%,rgba(200,169,110,.07) 0%,transparent 65%);pointer-events:none}
        .pc-hero-inner{position:relative;z-index:1;max-width:860px;margin:0 auto}.pc-hero-eyebrow{font-size:9px;letter-spacing:.42em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:18px}.pc-hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5vw,62px);font-weight:300;color:var(--cream);line-height:1.06;margin-bottom:22px}.pc-hero h1 em{font-style:italic;color:var(--gold)}.pc-hero-desc{font-size:14.5px;color:rgba(245,240,232,.55);line-height:1.95;max-width:600px;margin-bottom:32px}.pc-hero-meta{display:flex;gap:32px;flex-wrap:wrap}.hm-num{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:300;color:var(--cream);line-height:1}.hm-lbl{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:rgba(245,240,232,.35);margin-top:4px}
        .pc-week-nav{position:sticky;top:60px;z-index:90;background:rgba(253,251,247,.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);padding:0 48px;display:flex;overflow-x:auto}.pc-week-nav::-webkit-scrollbar{display:none}
        .wbtn{font-family:inherit;font-size:9px;font-weight:400;letter-spacing:.18em;text-transform:uppercase;padding:0 20px;height:52px;border:none;border-bottom:2px solid transparent;cursor:pointer;color:var(--stone);background:transparent;white-space:nowrap;transition:all .2s}.wbtn:hover{color:var(--ink)}.wbtn.active{color:var(--forest);border-bottom-color:var(--gold);font-weight:500}.wbtn.done::after{content:' ✓';font-size:8px;color:var(--gold);margin-left:4px}
        .pc-main{max-width:860px;margin:0 auto;padding:0 48px 100px}.pc-panel{display:none;padding-top:56px}.pc-panel.active{display:block}
        /* Principle + week-status side-by-side rail */
        .principle-row{display:grid;grid-template-columns:1fr 280px;gap:36px;align-items:flex-start;margin-bottom:8px}
        .principle-row > .w1-section{margin-bottom:0}
        .week-status{background:#1c2b1e;border:1px solid rgba(168,197,172,.18);border-radius:12px;padding:26px 28px;position:sticky;top:130px}
        .week-status .ws-label{display:block;font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:14px}
        .week-status .ws-status{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:#f5f0e8;line-height:1.2;margin-bottom:18px}
        .week-status .ws-anchor{font-size:13.5px;font-style:italic;color:rgba(168,197,172,.85);line-height:1.6}
        .week-status-past .ws-status{color:rgba(168,197,172,.7)}
        .week-status-unknown .ws-status{font-size:18px;color:rgba(168,197,172,.55);font-style:italic}
        @media(max-width:760px){.principle-row{grid-template-columns:1fr;gap:20px}.week-status{position:static}}
        .continuity{display:flex;gap:12px;align-items:flex-start;background:rgba(122,158,126,.06);border-left:2px solid var(--sage-lt);padding:14px 18px;margin-bottom:32px}.ct-arrow{font-size:13px;color:var(--sage);flex-shrink:0;margin-top:1px}.ct-text{font-size:12.5px;color:var(--stone);line-height:1.75}.ct-text strong{color:var(--ink-mid);font-weight:500}
        .wh-eyebrow{font-size:9px;letter-spacing:.38em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:14px}.wh-title{font-family:'Cormorant Garamond',serif;font-size:clamp(30px,4vw,46px);font-weight:300;line-height:1.1;margin-bottom:16px;color:var(--ink);white-space:pre-line}.wh-title em{font-style:italic;color:var(--gold)}.wh-sub{font-size:14px;color:var(--stone);line-height:1.9;max-width:640px;padding-bottom:32px;border-bottom:1px solid var(--border);margin-bottom:36px}
        /* Week 1 shared layout (matched to pre-ceremony so the 12-week arc reads as one piece) */
        .w1-section { margin-bottom:52px;scroll-margin-top:130px; }
        .w1-h3 { font-family:'Cormorant Garamond',serif;font-size:clamp(22px,2.6vw,30px);font-weight:300;line-height:1.2;color:var(--ink);margin-bottom:16px; }
        .w1-h3 em { font-style:italic;color:var(--gold); }
        .w1-body { font-size:14px;color:var(--ink-mid);line-height:1.9;max-width:640px; }
        .w1-companion-link { display:inline-block;margin-top:20px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);text-decoration:none;border-bottom:1px dashed rgba(200,169,110,.55);padding-bottom:2px; }
        .w1-companion-link:hover { color:var(--sage); }
        .w1-autosave { font-size:11.5px;color:var(--stone);font-style:italic;margin:4px 0 20px; }
        .w1-prompt { padding:22px 0;border-bottom:1px solid var(--border); }
        .w1-prompt:first-child { border-top:1px solid var(--border); }
        .w1-prompt-num { font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px; }
        .w1-prompt-q { font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:300;color:var(--ink);line-height:1.35;margin-bottom:10px; }
        .w1-prompt-hint { font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic; }
        .w1-actions { display:flex;flex-direction:column;gap:10px; }
        .w1-action { display:flex;align-items:flex-start;gap:14px;padding:16px 18px;border:.5px solid var(--border);border-radius:4px;background:white;text-decoration:none;color:var(--ink);transition:border-color .2s,background .2s; }
        .w1-action:hover { border-color:var(--gold);background:rgba(200,169,110,.05); }
        .w1-action-dot { width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0;margin-top:7px; }
        .w1-action-text { font-size:13.5px;color:var(--ink);line-height:1.55; }
        /* Week 1 principle display, scaled up so the principle reads as the theme */
        .w1p-eyebrow { font-size:12px;font-weight:600;letter-spacing:.36em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:22px; }
        .w1p-title { font-family:'Cormorant Garamond',serif;font-size:clamp(38px,5.2vw,58px);font-weight:300;line-height:1.06;margin:0 0 18px;color:var(--ink); }
        .w1p-title em { font-style:italic;color:var(--gold); }
        .w1p-pull { font-family:'Cormorant Garamond',serif;font-style:italic;font-size:clamp(17px,1.8vw,21px);color:var(--gold);line-height:1.55;margin:0 0 26px;letter-spacing:.015em; }
        .w1p-body { font-size:15.5px;color:var(--stone);line-height:1.95;max-width:680px;padding-bottom:40px;border-bottom:1px solid var(--border);margin:0; }
        /* Save & continue secondary button */
        .btn-save-exit { padding:12px 26px;background:transparent;border:1px solid var(--gold);border-radius:3px;color:var(--forest);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:background .2s;white-space:nowrap; }
        .btn-save-exit:hover { background:rgba(200,169,110,.08); }
        .wc-actions { display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end; }
        .section{margin-bottom:44px}.section-label{font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;display:block}
        .video-frame{border:.5px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:14px}.video-primer{background:var(--forest);padding:24px 28px;display:flex;align-items:center;gap:20px}.vp-play{width:44px;height:44px;border-radius:50%;border:1px solid rgba(200,169,110,.3);display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer}.vp-play-icon{color:var(--gold);font-size:14px;margin-left:3px}.vp-label{font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}.vp-text{font-size:13.5px;color:rgba(245,240,232,.75);line-height:1.7}.vp-coming-soon{margin-top:12px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:15px;letter-spacing:.04em;color:var(--gold)}
        .box{margin-top:0;border-radius:2px;padding:16px 20px;margin-bottom:28px}.box-label{font-size:8.5px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:8px;font-weight:500}.box-text{font-size:13px;line-height:1.8;color:var(--ink-mid)}.box-gold{background:rgba(200,169,110,.08);border:.5px solid rgba(200,169,110,.28)}.box-gold .box-label{color:var(--gold)}.box-sage{background:rgba(122,158,126,.07);border:.5px solid rgba(122,158,126,.25)}.box-sage .box-label{color:var(--sage)}
        .reentry{background:rgba(200,169,110,.05);border:.5px solid rgba(200,169,110,.2);border-radius:2px;padding:14px 20px;margin-bottom:24px;display:flex;gap:14px;align-items:flex-start}.reentry-icon{font-size:13px;color:var(--gold);flex-shrink:0;margin-top:1px}.reentry-text{font-size:12.5px;color:var(--stone);line-height:1.75}
        .dataset-note{background:rgba(200,169,110,.07);border:1px solid rgba(200,169,110,.32);border-left:3px solid var(--gold);border-radius:3px;padding:18px 22px;margin-top:18px;font-size:13px;color:var(--ink-mid);line-height:1.75}
        .dataset-note .dn-label{display:block;font-size:9px;letter-spacing:.32em;text-transform:uppercase;color:var(--gold);font-weight:500;margin-bottom:10px}
        .dataset-note .dn-body{font-style:italic}
        .dataset-note .dn-cta{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);text-decoration:none;font-weight:500;padding:8px 14px;border:1px solid rgba(200,169,110,.5);border-radius:2px;transition:all .2s}
        .dataset-note .dn-cta:hover{background:rgba(200,169,110,.1);border-color:var(--gold)}
        .dataset-note .dn-header{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:14px;flex-wrap:wrap}
        .dataset-note .dn-header .dn-label{margin-bottom:0}
        .dataset-note .dn-footer{margin-top:14px;display:flex;justify-content:flex-end}
        .actions-list{display:flex;flex-direction:column;gap:10px}.action-item{display:flex;align-items:flex-start;gap:14px;padding:14px 16px;border:.5px solid var(--border);border-radius:4px;background:white}.action-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;margin-top:5px}.action-text{font-size:13.5px;color:var(--ink);line-height:1.5}.action-note{font-size:12px;color:var(--stone);line-height:1.6;margin-top:5px;font-style:italic}
        .prompts-list{border-top:1px solid var(--border)}.prompt-item{padding:22px 0;border-bottom:1px solid var(--border)}.prompt-num{font-size:8.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:10px}.prompt-q{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:300;color:var(--ink);line-height:1.35;margin-bottom:10px}.prompt-hint{font-size:12.5px;color:var(--stone);line-height:1.75;font-style:italic}
        .journal-textarea{width:100%;margin-top:14px;padding:14px 16px;border:1px solid rgba(200,169,110,0.2);border-left:2px solid var(--gold);background:rgba(200,169,110,0.03);font-family:'Jost',sans-serif;font-size:14px;font-weight:300;color:var(--ink);line-height:1.85;resize:vertical;outline:none;min-height:100px;transition:border-color .2s,background .2s}
        .journal-textarea:focus{border-color:var(--gold);background:rgba(200,169,110,0.06)}
        .journal-textarea::placeholder{color:rgba(28,43,30,0.2);font-style:italic}
        .integration-qs{margin-top:28px;border:.5px solid rgba(200,169,110,.2);border-radius:4px;overflow:hidden}.iq-header{background:rgba(200,169,110,.06);padding:14px 20px;border-bottom:.5px solid rgba(200,169,110,.15)}.iq-label{font-size:8.5px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold)}.iq-item{padding:18px 20px;border-bottom:.5px solid var(--border-lt)}.iq-item:last-of-type{border-bottom:none}.iq-q{font-size:13px;color:var(--ink-mid);font-weight:500;margin-bottom:6px}.iq-hint{font-size:12px;color:var(--stone);font-style:italic;line-height:1.65}
        .rg-wrap{margin-top:40px;border:.5px solid rgba(200,169,110,.35);border-radius:4px;overflow:hidden}.rg-header{background:var(--forest);padding:18px 24px;display:flex;align-items:center;gap:12px}.rg-dot{width:8px;height:8px;border-radius:50%;background:var(--gold);flex-shrink:0}.rg-title{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}.rg-body{padding:20px 24px}.rg-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:.5px solid var(--border)}.rg-item:last-of-type{border-bottom:none}.rg-check{width:18px;height:18px;border-radius:2px;border:1px solid var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s}.rg-check.checked{background:var(--gold);border-color:var(--gold)}.rg-check-icon{font-size:10px;color:white;opacity:0}.rg-check.checked .rg-check-icon{opacity:1}.rg-item-text{font-size:13px;color:var(--ink-mid);line-height:1.5}
        .monthly-arc{margin-top:48px;background:linear-gradient(135deg,rgba(28,43,30,.04) 0%,rgba(200,169,110,.04) 100%);border:.5px solid rgba(200,169,110,.18);border-radius:4px;padding:32px 36px}.ma-eyebrow{font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:block}.ma-title{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:300;color:var(--ink);line-height:1.2;margin-bottom:14px}.ma-title em{font-style:italic;color:var(--gold)}.ma-text{font-size:13.5px;color:var(--stone);line-height:1.9;margin-bottom:20px}.ma-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}.ma-card{background:white;border:.5px solid var(--border);border-radius:4px;padding:18px 20px}.ma-card-label{font-size:8px;letter-spacing:.24em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;display:block}.ma-card-text{font-size:13px;color:var(--ink-mid);line-height:1.7}.ma-question{margin-top:20px;background:rgba(200,169,110,.06);border:.5px solid rgba(200,169,110,.2);border-radius:4px;padding:16px 20px}.ma-q-label{font-size:8.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);margin-bottom:8px;display:block}.ma-q-text{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:300;color:var(--ink);line-height:1.4}
        .return-practice{margin-top:40px;background:rgba(200,169,110,.06);border:.5px solid rgba(200,169,110,.25);border-left:3px solid var(--gold);border-radius:4px;padding:28px 32px}.rp-eyebrow{font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:block;font-weight:500}.rp-title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:300;color:var(--ink);line-height:1.2;margin-bottom:14px}.rp-text{font-size:13.5px;color:var(--ink-mid);line-height:1.85;margin-bottom:12px}.rp-text:last-of-type{margin-bottom:20px}.rp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}.rp-btn{font-family:inherit;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);background:transparent;border:1px solid var(--gold);border-radius:2px;padding:10px 16px;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;transition:all .2s;font-weight:500}.rp-btn:hover{background:rgba(200,169,110,.1)}.rp-btn-alt{background:rgba(200,169,110,.06)}
        .bridge{margin-top:28px;background:var(--forest);padding:32px 36px;border-radius:2px}.bridge-eyebrow{font-size:8.5px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:block}.bridge-title{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:300;color:var(--cream);line-height:1.2;margin-bottom:14px}.bridge-title em{font-style:italic;color:var(--gold)}.bridge-text{font-size:13.5px;color:rgba(245,240,232,.62);line-height:1.9}
        .wc-wrap{margin-top:48px;padding-top:36px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}.wc-text{font-size:12.5px;color:var(--stone);line-height:1.65}.wc-text strong{color:var(--ink-mid);font-weight:500}
        .btn-complete{padding:12px 28px;background:var(--gold);border:none;border-radius:3px;color:var(--deep);font-family:inherit;font-size:9px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:all .2s;white-space:nowrap}.btn-complete:hover{background:#d4b87a}.btn-complete.done{background:rgba(200,169,110,.12);border:.5px solid var(--gold);color:var(--gold);cursor:default}
        .save-pill{position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:4px;font-size:11px;letter-spacing:.1em;font-family:inherit;background:rgba(28,43,30,.9);color:var(--gold);opacity:0;transition:opacity .3s;pointer-events:none;z-index:200}.save-pill.visible{opacity:1}
        @media(max-width:640px){.pc-nav{padding:0 20px}.pc-nav-links{display:none}.pc-hero{padding:56px 24px 52px}.pc-main{padding:0 24px 80px}.pc-week-nav{padding:0 12px}.pc-prog{padding:10px 24px}.ma-grid{grid-template-columns:1fr}}
      `}</style>

      {/* NAV provided by portal layout */}

      {/* PROGRESS */}
      <div className="pc-prog">
        <span className="pc-prog-label">Integration Progress</span>
        <div className="pc-prog-track"><div className="pc-prog-fill" style={{ width: `${progress}%` }} /></div>
        <span className="pc-prog-week">{completed.size === 6 ? 'Integration Complete ✓' : `Week ${Math.min(completed.size + 1, 6)} of 6`}</span>
      </div>

      {/* PROGRESS INSIGHTS, only renders when ≥1 week tracked */}
      <ProgressInsights tracking={weeklyTracking} />

      {/* HERO */}
      <div className="pc-hero">
        <div className="pc-hero-inner">
          <span className="pc-hero-eyebrow">Member Portal · Post-Ceremony Integration · Confidential</span>
          <h1>Six Weeks of<br /><em>Integration</em></h1>
          <p className="pc-hero-desc">The medicine opened the window. Integration is how you build what goes inside it. Each week has one theme, one video, clear actions, and a weekly check-in that tracks your progress over time.</p>
        </div>
      </div>

      {/* WEEK NAV */}
      <div className="pc-week-nav">
        {WEEKS.map((w, i) => (
          <button key={w.id} className={`wbtn${activeWeek===i?' active':''}${completed.has(i)?' done':''}`} onClick={() => setActiveWeek(i)}>
            Week {i+1} · {w.code}
          </button>
        ))}
      </div>

      {/* SECTION INDEX, sticky under the week-tabs so members can jump between
          Principle / Video / Actions / PNE / Journal / Community (+ Completion
          on Week 6) while they scroll. */}
      <SectionIndex sections={sectionsForWeek(activeWeek)} stickyTop={112} scrollOffset={170} />

      <main className="pc-main">
        {WEEKS.map((w, i) => {
          const cd = getWeekCountdown(ceremonyStartAt, 'post', i)
          return (
          <div key={w.id} className={`pc-panel${activeWeek===i?' active':''}`}>

            {/* PRINCIPLE + WEEK STATUS */}
            <div className="principle-row">
              <section className="w1-section" id="principle">
                <span className="w1p-eyebrow">Week {i + 1} · {w.principleName} · {w.theme}</span>
                <h2 className="w1p-title">{w.title}{w.subtitle && <><br /><em>{w.subtitle}</em></>}</h2>
                <p className="w1p-pull">&ldquo;{w.principle}&rdquo;</p>
                <p className="w1p-body">{w.intro}</p>
              </section>
              <aside className={`week-status week-status-${cd?.phase ?? 'unknown'}`}>
                <span className="ws-label">Week {i + 1}</span>
                <div className="ws-status">{cd ? cd.label : 'Begins once your dates are set'}</div>
                <div className="ws-anchor">{POST_ANCHORS[i]}</div>
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
                {actionsForWeek(w.actions).map((card, ai) => {
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
              {w.dataset && (() => {
                const dl = (w as { datasetLink?: { text: string; href: string } }).datasetLink
                return (
                  <div className="dataset-note" style={{ marginTop: 18 }}>
                    <div className="dn-header">
                      <span className="dn-label">Outcomes, your contribution to the field</span>
                      {dl && <Link href={dl.href} className="dn-cta">{dl.text}</Link>}
                    </div>
                    <div className="dn-body">{w.dataset}</div>
                    {dl && (
                      <div className="dn-footer">
                        <Link href={dl.href} className="dn-cta">{dl.text}</Link>
                      </div>
                    )}
                  </div>
                )
              })()}
            </section>

            {/* PNE PERSPECTIVE (placeholder until per-week content ships) */}
            <section className="w1-section" id="pne-perspective">
              <h3 className="w1-h3">PNE Perspective</h3>
              <div className="video-frame">
                <div className="video-primer">
                  <div className="vp-play"><span className="vp-play-icon">▶</span></div>
                  <div>
                    <div className="vp-label">PNE Teaching · Week {i + 1}</div>
                    <div className="vp-text">A short teaching paired with this week&apos;s principle and the body&apos;s lived response to it.</div>
                    <div className="vp-coming-soon">Coming Soon</div>
                  </div>
                </div>
              </div>
            </section>

            {/* JOURNAL PROMPTS */}
            <section className="w1-section" id="journal-prompts">
              <h3 className="w1-h3">Journal Prompts</h3>
              <p className="w1-autosave">Your writing saves automatically as you type. You can return any time to continue.</p>
              {w.prompts.map((p, pi) => {
                const jKey = `w${i}-p${pi}`
                return (
                  <div className="w1-prompt" key={pi}>
                    <span className="w1-prompt-num">0{pi + 1}</span>
                    <p className="w1-prompt-q">{p.q}</p>
                    {p.hint && <p className="w1-prompt-hint">{p.hint}</p>}
                    <textarea
                      className="journal-textarea"
                      value={journal[jKey] ?? ''}
                      onChange={(e) => updateJournal(jKey, e.target.value)}
                      placeholder="Write freely..."
                      rows={4}
                    />
                  </div>
                )
              })}
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

            {/* COMPLETION, Week 6 only: integration statement + six-week
                checklist + monthly arc + return-practice + closing bridge. */}
            {w.integrationStatement && (
              <section className="w1-section" id="completion">
                <h3 className="w1-h3">Completion</h3>
                <div className="integration-qs">
                  <div className="iq-header">
                    <span className="iq-label">Your integration statement, three questions, one page</span>
                  </div>
                  {w.integrationStatement.map((q, qi) => (
                    <div className="iq-item" key={qi}>
                      <div className="iq-q">{qi + 1}. {q.q}</div>
                      <div className="iq-hint">{q.hint}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {w.checklist && (
              <div className="rg-wrap" style={{ marginTop: 24 }}>
                <div className="rg-header">
                  <div className="rg-dot" /><div className="rg-title">Six-week integration, completions</div>
                </div>
                <div className="rg-body">
                  {w.checklist.map((txt, ri) => (
                    <div className="rg-item" key={ri}>
                      <div className={`rg-check${checklist[`w6-${ri}`]?' checked':''}`} onClick={() => toggleCheck(`w6-${ri}`)}>
                        <span className="rg-check-icon">✓</span>
                      </div>
                      <div className="rg-item-text">{txt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {w.monthlyArc && (
              <div className="monthly-arc">
                <span className="ma-eyebrow">What comes next, months 2 & 3</span>
                <h3 className="ma-title">After the <em>Six Weeks</em></h3>
                <p className="ma-text">The pace softens from here. One daily practice, one honest question each month, one conversation with someone who knows the fuller picture of you. Your integration guide remains available whenever you need them.</p>
                <div className="ma-grid">
                  <div className="ma-card">
                    <span className="ma-card-label">One daily practice</span>
                    <div className="ma-card-text">The practice you established in week 2. Continue it, consistently. It is the thread that connects ceremony to the life you are building.</div>
                  </div>
                  <div className="ma-card">
                    <span className="ma-card-label">One monthly check-in</span>
                    <div className="ma-card-text">Rate your alignment (1–10). Notice what is holding and what is asking for renewal. One honest conversation with your guide each month.</div>
                  </div>
                  <div className="ma-card">
                    <span className="ma-card-label">One monthly connection</span>
                    <div className="ma-card-text">One conversation per month with someone who knows what you went through, your integration guide, your support person, or another who can hold the fuller picture of you.</div>
                  </div>
                </div>
                <div className="ma-question">
                  <span className="ma-q-label">Your monthly question</span>
                  <div className="ma-q-text">What is different in how I think this month, and how am I living that in what I do?</div>
                </div>
              </div>
            )}

            {w.monthlyArc && (
              <div className="return-practice">
                <span className="rp-eyebrow">A practice of return</span>
                <h3 className="rp-title">Mark the returns.</h3>
                <p className="rp-text">Integration happens in waves. Place three gentle markers on your own calendar, three months, six months, and one year from today. When each arrives, return here. Notice what has moved, what has deepened, what still asks for attention.</p>
              </div>
            )}

            {w.monthlyArc && (
              <div className="bridge">
                <span className="bridge-eyebrow">You are held</span>
                <h3 className="bridge-title">The work continues.<br /><em>So do we.</em></h3>
                <p className="bridge-text">Vital Kauaʻi does not end at the ceremony gate or the close of this program. Your integration guide, your care team, and this portal remain with you. If something arises, six weeks from now, six months from now, reach out. <strong style={{ color: 'var(--gold)' }}>aloha@vitalkauai.com</strong></p>
              </div>
            )}

            {/* Mark complete */}
            <div className="wc-wrap">
              <div className="wc-text">
                <strong>{i===5 ? 'Six weeks complete.' : `Finished with Week ${i+1}?`}</strong><br />
                {i===5 ? 'Complete your check-in to close the integration arc.' : 'Complete your weekly check-in before marking this week done.'}
              </div>
              {completed.has(i) ? (
                <button className="btn-complete done">✓ Complete</button>
              ) : (
                <button className="btn-complete" onClick={() => setCheckInWeek(i)}>
                  {i===5 ? 'Complete Integration' : `Complete Week ${i+1}`}
                </button>
              )}
            </div>

          </div>
        )})}
      </main>

      <div className={`save-pill${saveStatus!=='idle'?' visible':''}`}>
        {saveStatus==='saving' ? 'Saving…' : 'Saved ✓'}
      </div>
    </>
  )
}
