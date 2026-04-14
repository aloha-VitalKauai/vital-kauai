import { StepConfig } from './surveyConfig';

export const FIELD_LABELS: Record<string, string> = {
  phq9_total:                'PHQ-9 (complete all 9 questions)',
  gad7_total:                'GAD-7 (complete all 7 questions)',
  qol_total:                 'WHO-5 Quality of Life',
  primary_intention:         'Your intention',
  overall_change:            'Overall change',
  regulation_score:          'Regulation score',
  emotional_intensity_score: 'Emotional intensity',
  functioning_score:         'Daily functioning',
  what_has_lasted:           'What has lasted',
  year_reflection:           'Year reflection',
  craving_intensity:         'Craving intensity',
  days_abstinent:            'Days abstinent',
};

export interface StepError {
  stepIndex: number;
  stepTitle: string;
  humanFields: string[];
}

export function mapMissingFieldsToSteps(missingFields: string[], steps: StepConfig[]): StepError[] {
  const byStep = new Map<number, StepError>();

  for (const field of missingFields) {
    const idx = steps.findIndex(s => s.required.includes(field) || s.fields.includes(field));
    if (idx === -1) continue;
    if (!byStep.has(idx)) {
      byStep.set(idx, { stepIndex: idx, stepTitle: steps[idx].title, humanFields: [] });
    }
    byStep.get(idx)!.humanFields.push(FIELD_LABELS[field] ?? field);
  }

  return [...byStep.values()].sort((a, b) => a.stepIndex - b.stepIndex);
}

export type SubmitError =
  | { type: 'incomplete';            stepsWithErrors: StepError[] }
  | { type: 'window_closed';         closedAt: string }
  | { type: 'window_not_open';       opensAt: string }
  | { type: 'baseline_past_ceremony' }
  | { type: 'locked' }
  | { type: 'error';                 message: string };
