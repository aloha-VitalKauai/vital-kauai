import { StepConfig } from './surveyConfig';

export function buildRequiredFields(steps: StepConfig[]): string[] {
  return steps.flatMap(s => s.required);
}

export function canSubmit(responses: Record<string, unknown>, steps: StepConfig[]): boolean {
  const required = buildRequiredFields(steps);
  return required.every(field => responses[field] != null && responses[field] !== '');
}

export function stepCompleteness(step: StepConfig, responses: Record<string, unknown>): { complete: boolean; missing: string[] } {
  const missing = step.required.filter(f => responses[f] == null || responses[f] === '');
  return { complete: missing.length === 0, missing };
}

export function surveyCompleteness(steps: StepConfig[], responses: Record<string, unknown>): Array<{ step: StepConfig; complete: boolean; missing: string[] }> {
  return steps
    .filter(s => s.type !== 'intro' && s.type !== 'review')
    .map(s => ({ step: s, ...stepCompleteness(s, responses) }));
}
