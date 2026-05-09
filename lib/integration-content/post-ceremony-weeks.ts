// Post-ceremony Integration page content. Plain TS module so server code
// (the journey-emails cron, the founder dashboard's auto-derived email
// preview) can import the data — Next.js refuses to expose constants from
// 'use client' modules to Server Components, so the data lives here and the
// page imports from this file.

import { POST_CEREMONY_WEEKS } from '@/lib/journal-prompts'

export type ActionLinkArr = { text: string; href: string; external?: boolean }[]
export type ActionCard =
  | { kind: 'internal'; href: string; text: string }
  | { kind: 'hash';     href: string; text: string }
  | { kind: 'external'; href: string; text: string }
  | { kind: 'static';   text: string; links?: ActionLinkArr }

export const actionsForWeek = (
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

export const WEEKS = [
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
    video: { label: 'A Message from Rachel & Josh · Week 1', text: 'In this week’s video, Rachel and Josh share what Lōkahi has meant in their own lives and how the days right after ceremony have shaped how they listen to what wants to come through.' },
    actionLabel: 'This week, 4 things',
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
        text: 'Read Week 1 in The PsychoNeuroEnergetics (PNE) Integration Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'sage',
        text: 'Connect with your integration guide, your post-ceremony call, within 48 hours of ceremony (while still on Kauaʻi)',
        note: 'Your first integration-guide call. Held within 48 hours of ceremony so what was shown is still alive in the body. Bring whatever you need to bring, questions, gratitude, exhaustion. They are there to meet you.',
        links: [
          { text: 'Connect with your integration guide, your post-ceremony call, within 48 hours of ceremony (while still on Kauaʻi)', href: '/portal#integration-specialist' },
        ],
      },
      {
        color: 'amber',
        text: 'Schedule 5 more weekly calls with your integration guide',
        links: [
          { text: 'Schedule 5 more weekly calls with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
    ],
    prompts: POST_CEREMONY_WEEKS[0].prompts,
    thread: 'What you record this week becomes the foundation of the integration work ahead. Let it exist on the page. Next week you begin to live it.',
  },
  {
    id: 1,
    code: 'HOʻOPONOPONO',
    principleName: 'Hoʻoponopono',
    principle: 'I\'m sorry. Please forgive me. Thank you. I love you.',
    theme: 'Forgiveness',
    eyebrow: 'Week 2 · HOʻOPONOPONO · Forgiveness',
    title: 'The forgiveness work continues.',
    subtitle: 'Now it becomes a daily practice.',
    carryForward: 'You rested. You let what was shown remain wordless. This week the forgiveness you opened on Kauaʻi steps forward into your daily life.',
    intro: 'Hoʻoponopono is the practice of making right. On Kauaʻi you opened the door to forgiveness, for yourself, for the people whose weight you have been carrying, and the situations that have shaped you. This week is for anchoring that opening into something you can return to every day. The four lines, said in your own time and in your own way, are how you take 100% responsibility for the life you are living, and how you reinforce a felt sense of responsibility, forgiveness, gratitude, and love for yourself and for whatever you are holding: I\'m sorry. Please forgive me. Thank you. I love you.',
    reentry: {
      strong: 'When something resurfaces this week, do this:',
      text: ' Place one hand on your heart. Bring whoever or whatever has surfaced to mind. Say the four lines slowly: "I\'m sorry. Please forgive me. Thank you. I love you." Hoʻoponopono does not require the other person to be present, to know, or to agree. The release belongs to you.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 2', text: 'In this week’s video, Rachel and Josh share what Hoʻoponopono has meant in their own lives and how the four lines have shaped how they meet themselves and the people they love.' },
    actionLabel: 'This week, 4 things',
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
        text: 'Read Week 2 in The PsychoNeuroEnergetics (PNE) Integration Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      { color: 'gold', text: 'Practice Hoʻoponopono daily, the four lines, with one person or situation held in mind', note: 'I\'m sorry. Please forgive me. Thank you. I love you. Same lines, every day. Different person or situation when called. Even five minutes is enough. The work is internal, the other person does not need to be present, know, or agree.' },
      {
        color: 'sage',
        text: 'Connect with your integration guide',
        note: 'Your weekly call. Bring whoever or whatever has surfaced this week. Bring the forgiveness work you are doing on yourself.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
    ],
    prompts: POST_CEREMONY_WEEKS[1].prompts,
    thread: 'What you forgive this week becomes what you no longer carry. The lines are simple. Saying them honestly is the work.',
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
    carryForward: 'You opened the four lines into your daily life. You named what you are taking 100% responsibility for. This week the work moves from receiving and releasing into tending, the slow, deliberate act of bringing what was shown into how you actually live.',
    intro: 'Mālama means to care for, to tend, or to preserve. The medicine opened a door. This week the work is repetition, the small daily practices that turn what was shown into how you actually live. What you practice consistently in this early window becomes your new baseline.',
    video: { label: 'A Message from Rachel & Josh · Week 3', text: 'In this week’s video, Rachel and Josh share what Mālama has meant in their own lives and how tending the small daily practices has shaped what they have been able to keep from the medicine.' },
    actionLabel: 'This week, 4 things',
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
        text: 'Read Week 3 in The PsychoNeuroEnergetics (PNE) Integration Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'sage',
        text: 'Connect with your integration guide',
        note: 'Your weekly call. Bring whatever is alive, what is settling, what is surprising you, what is asking for tending.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'gold', text: 'Establish one morning practice, and do it every day. Write it down below', note: 'Coherent Heart Breath. Journaling. Movement. Prayer. One thing. Done every morning. The medicine opened the door. Repetition is how you walk through it.' },
      {
        color: 'blue',
        text: 'Schedule a check-in call with Rachel & Josh',
        note: 'An optional mid-integration touchpoint to bring what is still moving, notice what has anchored, and speak honestly about what is alive.',
        links: [
          { text: 'Schedule a check-in call with Rachel & Josh', href: 'https://calendly.com/aloha-vitalkauai/30-minute-check-in-call', external: true },
        ],
      },
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
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 4 in The PsychoNeuroEnergetics (PNE) Integration Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'gold',
        text: 'Connect with your integration guide',
        note: 'This is one of the most important calls of the integration arc. Bring the return of the familiar. Bring what is still unresolved. Your guide is trained to work with exactly this territory. Book via the Integration Specialist section on your Dashboard.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
      { color: 'sage', text: 'Continue your daily practice, especially on the days you least want to', note: 'The days you least want to show up are the days it matters most.' },
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
    intro: 'Pono is righteousness, balance, harmony, and goodness. It is a way of living that is morally upright, fair, and respectful toward yourself, others, and the environment. To live in pono is to do things the right way and to bring harmony into every part of your life. The medicine showed you something. You have been tending it, meeting what returned, and forgiving what you have carried. By week five, the question becomes how you act on it, in the small daily decisions that build a life of pono.',
    reentry: {
      strong: 'When you catch yourself defaulting to who you used to be, do this:',
      text: ' Pause. Name it: "This is the old habit." Bring to mind one thing the medicine showed you. Choose from there, even once, even imperfectly. Pono is not arrived at. It is practiced. The next right thing is the work.',
    },
    video: { label: 'A Message from Rachel & Josh · Week 5', text: 'In this week’s video, Rachel and Josh share what Pono has meant in their own lives and how doing what is right, in the small daily decisions, has shaped the way they live.' },
    actionLabel: 'This week, 4 things',
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
        text: 'Read Week 5 in The PsychoNeuroEnergetics (PNE) Integration Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      { color: 'gold', text: 'Ask yourself this week if your thoughts, words, and actions are pono', note: 'Pause through the day and check the alignment. When something feels off, name it, choose again, return to pono.' },
      { color: 'green', text: 'Continue Hoʻoponopono with anyone or anything still carrying weight', note: 'I\'m sorry. Please forgive me. Thank you. I love you. The forgiveness work from Week 2 is a lifelong practice. Return to it whenever something resurfaces.' },
      {
        color: 'amber',
        text: 'Connect with your integration guide',
        note: 'Bring the decisions that are surfacing. Your guide can help you stay present to what is being asked of you without abandoning yourself.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
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
        color: 'blue',
        text: 'Respond to this week’s journal prompts',
        links: [
          { text: 'Respond to this week’s journal prompts', href: '#journal-prompts' },
        ],
      },
      {
        color: 'green',
        text: 'Read Week 6 in The PsychoNeuroEnergetics (PNE) Integration Guide',
      },
      { color: 'green', text: "Complete this week's PNE Practice" },
      { color: 'green', text: "Complete this week's PNE Reflection" },
      {
        color: 'blue',
        text: 'Connect with your integration guide',
        note: 'You have sessions remaining in your six-session arc, and you can also continue beyond that as a living practice. Your guide can help you establish a monthly rhythm or meet you as the work keeps moving. Book via the Integration Specialist section on your Dashboard.',
        links: [
          { text: 'Connect with your integration guide', href: '/portal#integration-specialist' },
        ],
      },
    ],
    prompts: POST_CEREMONY_WEEKS[5].prompts,
    thread: 'Kuleana is an honor, the recognition that you have been shown something real and that you are capable of living it. The medicine opened a window. You chose to walk through it, week by week, practice by practice, honest conversation by honest conversation. What you have built is a foundation. The work continues. We continue with you.',
    monthlyArc: true,
  },
]
