import { surveyCompleteness } from '@/lib/assessments/surveyValidation';
import type { StepConfig } from '@/lib/assessments/surveyConfig';

const T = {
  earthMid: '#2a2620', earthLight: '#4a4338', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250', goldLight: '#dfc49a',
  sage: '#8fa882', rose: '#c4846a',
  borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  steps: StepConfig[];
  responses: Record<string, unknown>;
  readOnly: boolean;
}

function scoreSeverity(instrument: string, total: number): string {
  if (instrument === 'phq9') {
    if (total <= 4) return 'Minimal';
    if (total <= 9) return 'Mild';
    if (total <= 14) return 'Moderate';
    if (total <= 19) return 'Moderately severe';
    return 'Severe';
  }
  if (instrument === 'gad7') {
    if (total <= 4) return 'Minimal';
    if (total <= 9) return 'Mild';
    if (total <= 14) return 'Moderate';
    return 'Severe';
  }
  return '';
}

export function ReviewStep({ steps, responses, readOnly }: Props) {
  const completeness = surveyCompleteness(steps, responses);
  const allComplete = completeness.every(c => c.complete);

  const phq9Total = responses.phq9_total as number | undefined;
  const gad7Total = responses.gad7_total as number | undefined;
  const qolTotal = responses.qol_total as number | undefined;

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Review your responses
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Check your answers before submitting. Your draft has been saved automatically.
      </p>

      {/* Step completion status */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.85rem' }}>
          Completion status
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {completeness.map(({ step, complete, missing }) => (
            <div key={step.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}`, gap: '1rem',
            }}>
              <span style={{ fontSize: '0.82rem', color: T.creamDim, flex: 1 }}>{step.title}</span>
              <span style={{
                fontSize: '0.72rem', fontWeight: 400,
                color: complete ? T.sage : T.rose,
              }}>
                {complete ? 'Complete' : `${missing.length} remaining`}
              </span>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: '0.75rem', fontSize: '0.78rem',
          color: allComplete ? T.sage : T.creamMuted,
        }}>
          {allComplete ? 'All sections complete. Ready to submit.' : 'Some sections are incomplete.'}
        </div>
      </div>

      {/* Score summaries */}
      {(phq9Total != null || gad7Total != null || qolTotal != null) && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.85rem' }}>
            Score summary
          </p>

          {phq9Total != null && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}`, gap: '1rem' }}>
                <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>PHQ-9 (Depression)</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim, textAlign: 'right' }}>
                  {phq9Total} / 27
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', gap: '1rem' }}>
                <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>Severity</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim, textAlign: 'right' }}>
                  {scoreSeverity('phq9', phq9Total)}
                </span>
              </div>
            </div>
          )}

          {gad7Total != null && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}`, gap: '1rem' }}>
                <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>GAD-7 (Anxiety)</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim, textAlign: 'right' }}>
                  {gad7Total} / 21
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', gap: '1rem' }}>
                <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>Severity</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim, textAlign: 'right' }}>
                  {scoreSeverity('gad7', gad7Total)}
                </span>
              </div>
            </div>
          )}

          {qolTotal != null && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}`, gap: '1rem' }}>
                <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>WHO-5 (Wellbeing)</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim, textAlign: 'right' }}>
                  {qolTotal} / 25
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
