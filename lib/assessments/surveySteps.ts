export type StepType = 'intro' | 'phq9' | 'review';

export interface SurveyStep {
  id:    string;
  type:  StepType;
  title: string;
}

export function buildSteps(_timepoint: string): SurveyStep[] {
  // Ticket 3: same 3-step shell for all timepoints.
  // Ticket N will branch by timepoint (post_72h gets shorter battery, etc.)
  return [
    { id: 'intro',  type: 'intro',  title: 'Before you begin'        },
    { id: 'phq9',   type: 'phq9',   title: "How you've been feeling" },
    { id: 'review', type: 'review', title: 'Review'                   },
  ];
}
