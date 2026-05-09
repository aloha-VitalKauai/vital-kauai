/**
 * Single source of truth for the weekly journey emails.
 *
 * The 12 emails (6 preparation + 6 integration) are derived directly from the
 * Integration page WEEKS arrays. Edit those, the next cron tick picks up the
 * change — there is no separate template store to keep in sync.
 *
 * Mapping per week:
 *   principle_name  ← w.principleName
 *   principle       ← w.principle (the short quote)
 *   theme           ← w.theme
 *   intro           ← w.intro (post)  /  w.sub (pre)
 *   action_items    ← actionsForWeek(...).map(a => a.text)
 *   subject         ← `Week N of <preparation|integration> · <principleName>`
 */
import {
  WEEKS as PRE_WEEKS,
  actionsForWeek as preActionsForWeek,
} from '@/lib/integration-content/pre-ceremony-weeks'
import {
  WEEKS as POST_WEEKS,
  actionsForWeek as postActionsForWeek,
} from '@/lib/integration-content/post-ceremony-weeks'
import type { JourneyArc, JourneyEmailTemplate } from '@/lib/journey-emails'

function arcLabel(arc: JourneyArc): string {
  return arc === 'pre' ? 'preparation' : 'integration'
}

function actionTextsFor(arc: JourneyArc, weekIdx: number): string[] {
  if (arc === 'pre') {
    const w = PRE_WEEKS[weekIdx]
    return preActionsForWeek(weekIdx, w.actions).map((a) => a.text)
  }
  const w = POST_WEEKS[weekIdx]
  return postActionsForWeek(w.actions).map((a) => a.text)
}

function introFor(arc: JourneyArc, weekIdx: number): string {
  if (arc === 'pre') {
    const w = PRE_WEEKS[weekIdx] as { sub?: string; intro?: string }
    return w.intro ?? w.sub ?? ''
  }
  const w = POST_WEEKS[weekIdx] as { intro?: string; sub?: string }
  return w.intro ?? w.sub ?? ''
}

export function getJourneyEmailTemplate(
  arc: JourneyArc,
  weekIdx: number,
): JourneyEmailTemplate {
  const w = (arc === 'pre' ? PRE_WEEKS[weekIdx] : POST_WEEKS[weekIdx]) as {
    principleName: string
    principle: string
    theme: string
  }
  const principleName = w.principleName
  return {
    arc,
    week_idx: weekIdx,
    principle_name: principleName,
    principle: w.principle,
    theme: w.theme,
    subject: `Week ${weekIdx + 1} of ${arcLabel(arc)} · ${principleName}`,
    intro: introFor(arc, weekIdx),
    action_items: actionTextsFor(arc, weekIdx),
  }
}

export function getAllJourneyEmailTemplates(): JourneyEmailTemplate[] {
  const all: JourneyEmailTemplate[] = []
  for (const arc of ['pre', 'post'] as JourneyArc[]) {
    for (let i = 0; i < 6; i++) all.push(getJourneyEmailTemplate(arc, i))
  }
  return all
}
