import { SURVEY_CONFIG, StepConfig } from './surveyConfig';

export type { StepConfig };

export interface EligibilitySnapshot {
  track_addiction?:         boolean;
  track_ptsd?:              boolean;
  track_pain?:              boolean;
  track_motor?:             boolean;
  track_cognitive?:         boolean;
  track_chronic_illness?:   boolean;
  track_autism_regulation?: boolean;
}

export function buildSteps(
  timepoint: string,
  eligibilitySnapshot: EligibilitySnapshot | null
): StepConfig[] {
  const steps = SURVEY_CONFIG[timepoint];
  if (!steps) throw new Error(`No survey config found for timepoint: ${timepoint}`);

  const snap = eligibilitySnapshot ?? {};
  return steps.filter(step => {
    if (!step.conditional) return true;
    return snap[step.conditional] === true;
  });
}

export function resumeStepIndex(steps: StepConfig[], responses: Record<string, unknown>): number {
  let lastFilledIdx = 0;
  for (let i = 0; i < steps.length - 1; i++) {
    const step = steps[i];
    if (step.type === 'intro' || step.type === 'review') continue;
    const hasData = step.fields.some(f => responses[f] != null);
    if (hasData) lastFilledIdx = i;
  }
  return lastFilledIdx > 0
    ? Math.min(lastFilledIdx + 1, steps.length - 2)
    : (steps.some((s, i) => i > 0 && s.fields.some(f => responses[f] != null)) ? 1 : 0);
}
