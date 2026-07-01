// Post-ceremony Integration page content. Plain TS module so server code
// (the journey-emails cron, the founder dashboard's auto-derived email
// preview) can import the data — Next.js refuses to expose constants from
// 'use client' modules to Server Components, so the data lives here and the
// page imports from this file.

import { POST_CEREMONY_WEEKS } from '@/lib/journal-prompts'

export type ActionLinkArr = { text: string; href: string; external?: boolean }[]
export type ActionCard =
  | { kind: 'internal'; href: string; text: string; key: string }
  | { kind: 'hash';     href: string; text: string; key: string }
  | { kind: 'external'; href: string; text: string; key: string }
  | { kind: 'static';   text: string; links?: ActionLinkArr; key: string }

export const actionsForWeek = (
  actions: ReadonlyArray<{ text: string; links?: ActionLinkArr; key?: string }>,
): ActionCard[] =>
  actions.map((a, idx) => {
    const key = a.key ?? `a${idx}`
    const links = a.links ?? []
    if (links.length === 0) return { kind: 'static', text: a.text, key }
    if (links.length > 1)   return { kind: 'static', text: a.text, links, key }
    const lnk = links[0]
    if (lnk.external)              return { kind: 'external', href: lnk.href, text: a.text, key }
    if (lnk.href.startsWith('#'))  return { kind: 'hash',     href: lnk.href, text: a.text, key }
    return { kind: 'internal', href: lnk.href, text: a.text, key }
  })

export const WEEKS = [
  {
    id: 0,
    code: 'MAHALO',
    principleName: 'Mahalo',
    principle: 'Give thanks. Gratitude is the ground all integration grows from.',
    theme: 'Gratitude',
    eyebrow: 'Week 1 · MAHALO · Gratitude',
    title: 'Begin in gratitude.',
    subtitle: 'The medicine is still moving in you.',
    intro: 'Mahalo means gratitude, the open-hearted thanks for what you have just received. This first week asks almost nothing of you except presence and gratitude. Rest after ceremony is active integration. Your nervous system is processing. Let gratitude be the first thing you reach for, and trust it.',
    safetyNote: {
      type: 'gold',
      label: 'The 48-hour window, read this first',
      text: 'The first 48 hours after ceremony are the most neurologically plastic of your entire journey. What you allow yourself to feel, what you speak aloud, what you write, is being encoded more deeply than at almost any other moment in your life. This is a time for receiving what was shown with gratitude, set aside decisions, analysis, and explanation.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'In this week’s video, Rachel and Josh share what Mahalo has meant in their own lives and how meeting the days right after ceremony with gratitude has shaped how they listen to what wants to come through.' },
    actionLabel: 'This week, 4 things',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 1 in The PsychoNeuroEnergetics (PNE) Integration Guide, complete the practice and PNE reflection',
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
      { key: 'a4', color: 'gold', text: 'Each day, name one thing you are grateful for, aloud, in writing, or in silence', note: 'One moment of thanks, every day. Said aloud, written down, or simply held. Gratitude practiced daily becomes the ground everything else roots into.' },
      {
        key: 'a5',
        color: 'amber',
        text: 'Schedule your remaining two or three integration-guide calls so you use all six',
        links: [
          { text: 'Schedule your remaining two or three integration-guide calls so you use all six', href: '/portal#integration-specialist' },
        ],
      },
      {
        key: 'a6',
        color: 'blue',
        text: 'Schedule your three integration coaching calls with Rachel & Josh',
        note: 'Book all three now so they are on the calendar; space them across your integration however serves you.',
        links: [
          { text: 'Schedule your three integration coaching calls with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-check-in-call', external: true },
        ],
      },
    ],
    prompts: POST_CEREMONY_WEEKS[0].prompts,
    thread: 'What you give thanks for this week becomes the ground the integration work grows from. Let gratitude exist on the page. Next week you begin to weave it together.',
  },
  {
    id: 1,
    code: 'LŌKAHI',
    principleName: 'Lōkahi',
    principle: 'All things are connected. Act in unity.',
    theme: 'Unity',
    eyebrow: 'Week 2 · LŌKAHI · Unity',
    title: 'The threads begin to weave.',
    subtitle: 'Now they become whole.',
    carryForward: 'You began in gratitude. You rested and gave thanks for what was received. This week the many threads of what was shown begin to weave into the whole of who you are.',
    intro: 'Lōkahi means unity, the integration of all that was shown into the whole of who you are. This week the separate moments of ceremony, the images, the feelings, the knowings, begin to settle into one connected whole. Your work is to notice the threads as they weave together, and to let them.',
    video: { label: 'A Message from Rachel & Josh · Week 2', text: 'In this week’s video, Rachel and Josh share what Lōkahi has meant in their own lives and how letting the threads of ceremony weave into one has shaped how they live what they were shown.' },
    actionLabel: 'This week, 4 things',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 2 in The PsychoNeuroEnergetics (PNE) Integration Guide, complete the practice and PNE reflection',
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
      { key: 'a4', color: 'gold', text: 'Notice one thread from ceremony as it weaves into daily life, and write it down', note: 'A feeling, an image, a knowing from ceremony showing up in an ordinary moment. Catch it. Name it. This is unity becoming lived.' },
    ],
    prompts: POST_CEREMONY_WEEKS[1].prompts,
    thread: 'What weaves together this week becomes the whole you carry forward. The threads are many. Letting them become one is the work.',
  },
  {
    id: 2,
    code: 'MĀLAMA',
    principleName: 'Mālama',
    principle: 'Tend what is precious.',
    theme: 'Tending',
    eyebrow: 'Week 3 · MĀLAMA · Tending',
    title: 'The insights are alive.',
    subtitle: 'Now you tend them.',
    carryForward: 'You began in gratitude, and you let the threads of ceremony weave into one. This week the work moves from receiving and weaving into tending, the slow, deliberate act of bringing what was shown into how you actually live.',
    intro: 'Mālama means to care for, to tend, or to preserve. The medicine opened a door. This week the work is repetition, the small daily practices that turn what was shown into how you actually live. What you practice consistently in this early window becomes your new baseline.',
    video: { label: 'A Message from Rachel & Josh · Week 3', text: 'In this week’s video, Rachel and Josh share what Mālama has meant in their own lives and how tending the small daily practices has shaped what they have been able to keep from the medicine.' },
    actionLabel: 'This week, 4 things',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 3 in The PsychoNeuroEnergetics (PNE) Integration Guide, complete the practice and PNE reflection',
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
      { key: 'a4', color: 'gold', text: 'Establish one morning practice, and do it every day. Write it down below', note: 'Coherent Heart Breath. Journaling. Movement. Prayer. One thing. Done every morning. The medicine opened the door. Repetition is how you walk through it.' },
    ],
    prompts: POST_CEREMONY_WEEKS[2].prompts,
    thread: 'The practice you establish this week has a disproportionate impact on everything that follows. The medicine opened the door. This week you decide what you\'re building.',
  },
  {
    id: 3,
    code: 'HAʻAHAʻA',
    principleName: 'Haʻahaʻa',
    principle: 'Remain humble. Stay teachable.',
    theme: 'Humility',
    eyebrow: 'Week 4 · HAʻAHAʻA · Humility',
    title: 'The familiar is returning.',
    subtitle: 'Meet it differently.',
    carryForward: 'You have been tending new practices. You have begun to bring the insights into your days. This week something will shift, old patterns may begin to resurface. This is integration beginning.',
    intro: 'Haʻahaʻa means humility, the willingness to be exactly where you are without pretending to be further along. By week four, the acute aliveness of ceremony has softened. The ordinary world has returned. And with it, the familiar, however slightly, may start to return. Your ability to notice it, welcome it, and shift it with greater awareness is alive. This week asks you to meet all of that with humility rather than shame.',
    reentry: {
      strong: 'When the pattern hits, do this:',
      text: ' (1) Name it aloud or in writing: "This is the [fear / avoidance / contraction] pattern." (2) Feet flat on the floor. One hand on your heart. One slow breath, in for 5, hold for 2, out for 7. (3) Name it openly, tell your guide, your support person, or write it here. (4) Return to your practice, even for five minutes. The pattern yields to your sustained attention and your practice. This is neuroscience.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 4', text: 'In this week’s video, Rachel and Josh share what Haʻahaʻa has meant in their own lives and how meeting the familiar with humility has shaped how they hold the long arc of integration.' },
    actionLabel: 'This week, 3 things',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 4 in The PsychoNeuroEnergetics (PNE) Integration Guide, complete the practice and PNE reflection',
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
      { key: 'a4', color: 'sage', text: 'Continue your daily practice, especially on the days you least want to', note: 'The days you least want to show up are the days it matters most.' },
    ],
    prompts: POST_CEREMONY_WEEKS[3].prompts,
    thread: 'Every person who has done deep transformational work meets this week. The ones who move through it are the ones who keep showing up to their practice. You are in the long arc now.',
  },
  {
    id: 4,
    code: 'PONO',
    principleName: 'Pono',
    principle: 'Do what is right with what you know.',
    theme: 'Righteousness',
    eyebrow: 'Week 5 · PONO · Righteousness',
    title: 'Do what is right.',
    subtitle: 'With what you know now.',
    carryForward: 'You met the return of the familiar with humility. You kept your practice. You forgave what you have been carrying. This week the work becomes a choice, the daily, deliberate act of doing what is right with what you have seen.',
    intro: 'Pono is righteousness, balance, harmony, and goodness. It is a way of living that is morally upright, fair, and respectful toward yourself, others, and the environment. To live in pono is to do things the right way and to bring harmony into every part of your life. The medicine showed you something. You have been tending it and meeting what returns. By week five, the question becomes how you act on it, in the small daily decisions that build a life of pono.',
    reentry: {
      strong: 'When you catch yourself defaulting to who you used to be, do this:',
      text: ' Pause. Name it: "This is the old habit." Bring to mind one thing the medicine showed you. Choose from there, even once, even imperfectly. Pono is not arrived at. It is practiced. The next right thing is the work.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'In this week’s video, Rachel and Josh share what Pono has meant in their own lives and how doing what is right, in the small daily decisions, has shaped the way they live.' },
    actionLabel: 'This week, 4 things',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 5 in The PsychoNeuroEnergetics (PNE) Integration Guide, complete the practice and PNE reflection',
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
      { key: 'a4', color: 'gold', text: 'Ask yourself this week if your thoughts, words, and actions are pono', note: 'Pause through the day and check the alignment. When something feels off, name it, choose again, return to pono.' },
      { key: 'a5', color: 'green', text: 'Continue Hoʻoponopono with anyone or anything still carrying weight', note: 'I\'m sorry. Please forgive me. Thank you. I love you. The Hoʻoponopono you practiced on Kauaʻi is a lifelong practice. Return to it whenever something resurfaces.' },
    ],
    prompts: POST_CEREMONY_WEEKS[4].prompts,
    thread: 'Pono is built choice by choice. The integration that holds is the integration that shows up in your decisions, especially the small ones, especially when no one is watching.',
  },
  {
    id: 5,
    code: 'KULEANA',
    principleName: 'Kuleana',
    principle: 'Carry your responsibility with honor.',
    theme: 'Responsibility',
    eyebrow: 'Week 6 · KULEANA · Responsibility',
    title: 'Six weeks in.',
    subtitle: 'The kuleana is yours now.',
    carryForward: 'You have moved through the full arc, from the raw tenderness of emergence to the practice of choosing pono. This final week is a transition from active integration into sustained living.',
    intro: 'Kuleana is responsibility. It is sacred accountability to yourself, your family, your community, your practices, and to the new stories and beliefs you continue to live and reinforce. Six weeks in, the medicine\'s most dramatic effects have passed and you\'re living it through the new rhythms of your life.',
    video: { label: 'A Message from Rachel & Josh · Week 6', text: 'In this week’s video, Rachel and Josh share what Kuleana has meant in their own lives and how owning what they were shown has shaped the work and the way they live.' },
    actionLabel: 'This week, 4 completions',
    actions: [
      {
        key: 'a0',
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        key: 'a1',
        color: 'green',
        text: 'Read Week 6 in The PsychoNeuroEnergetics (PNE) Integration Guide, complete the practice and PNE reflection',
      },
      { key: 'a2', color: 'green', text: "Complete this week's PNE Practice" },
      { key: 'a3', color: 'green', text: "Complete this week's PNE Reflection" },
    ],
    prompts: POST_CEREMONY_WEEKS[5].prompts,
    thread: 'Kuleana is an honor, the recognition that you have been shown something real and that you are capable of living it. The medicine opened a window. You chose to walk through it, week by week, practice by practice, honest conversation by honest conversation. What you have built is a foundation. The work continues. We continue with you.',
    monthlyArc: true,
  },
]
