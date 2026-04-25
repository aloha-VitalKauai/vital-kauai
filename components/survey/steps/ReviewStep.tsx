import { surveyCompleteness } from '@/lib/assessments/surveyValidation';
import type { StepConfig } from '@/lib/assessments/surveyConfig';
import { FIELD_LABELS, SubmitError } from '@/lib/assessments/submitErrorHelpers';

const T = {
  earthMid: '#2a2620', earthLight: '#4a4338', cream: '#f2ead8', creamDim: '#d4c8ae',
  creamMuted: '#a89c84', goldDim: '#a4886a', goldLight: '#dfc49a',
  sage: '#8fa882', sageDark: '#4e7250', rose: '#c4846a', roseDim: '#7a4f3a',
  borderLight: 'rgba(201,169,110,0.10)', borderSage: 'rgba(143,168,130,0.35)',
  borderRose: 'rgba(196,132,106,0.40)',
};

interface Props {
  steps: StepConfig[];
  responses: Record<string, unknown>;
  readOnly: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitError: SubmitError | null;
  onSubmit: () => void;
  onGoToStep: (stepIndex: number) => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

export function ReviewStep({ steps, responses, readOnly, isSubmitting, canSubmit: canSubmitProp, submitError, onSubmit, onGoToStep }: Props) {
  const completeness = surveyCompleteness(steps, responses);
  const phq9Total = responses.phq9_total as number | undefined;
  const gad7Total = responses.gad7_total as number | undefined;
  const qolTotal = responses.qol_total as number | undefined;

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Review your responses
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Check your answers before submitting. Your progress has been saved automatically.
      </p>

      {/* Per-step completeness */}
      <div style={{ marginBottom: '2rem' }}>
        {completeness.map(({ step, complete, missing }) => (
          <div key={step.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: `1px solid ${T.borderLight}` }}>
            <span style={{ fontSize: '0.78rem', color: T.creamMuted }}>{step.title}</span>
            {complete ? (
              <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.15rem 0.55rem', borderRadius: 2, background: 'rgba(78,114,80,0.25)', color: T.sage }}>Complete</span>
            ) : step.required.length === 0 ? (
              <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.15rem 0.55rem', borderRadius: 2, background: 'rgba(110,101,88,0.2)', color: T.creamMuted }}>Optional</span>
            ) : (
              <button
                onClick={() => { const idx = steps.findIndex(s => s.id === step.id); if (idx !== -1) onGoToStep(idx); }}
                title={`Missing: ${missing.map(f => FIELD_LABELS[f] ?? f).join(', ')}`}
                style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0.15rem 0.55rem', borderRadius: 2, background: 'rgba(196,132,106,0.18)', color: T.rose, border: 'none', cursor: 'pointer', fontFamily: "'Jost', sans-serif" }}
              >
                Incomplete, go back
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Score summaries */}
      {(phq9Total != null || gad7Total != null || qolTotal != null) && (
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.85rem' }}>Key scores</p>
          {phq9Total != null && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}` }}>
                <span style={{ fontSize: '0.78rem', color: T.creamMuted }}>PHQ-9</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim }}>{phq9Total} / 27 &middot; {scoreSeverity('phq9', phq9Total)}</span>
              </div>
            </>
          )}
          {gad7Total != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}` }}>
              <span style={{ fontSize: '0.78rem', color: T.creamMuted }}>GAD-7</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim }}>{gad7Total} / 21 &middot; {scoreSeverity('gad7', gad7Total)}</span>
            </div>
          )}
          {qolTotal != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0' }}>
              <span style={{ fontSize: '0.78rem', color: T.creamMuted }}>WHO-5</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim }}>{qolTotal} / 25</span>
            </div>
          )}
        </div>
      )}

      {/* Submit zone */}
      {!readOnly && (
        <div style={{ marginTop: '2rem', paddingTop: '1.75rem', borderTop: `1px solid ${T.borderLight}`, display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-start' }}>

          {submitError && <SubmitErrorDisplay error={submitError} onGoToStep={onGoToStep} />}

          <button
            onClick={onSubmit}
            disabled={!canSubmitProp || isSubmitting}
            aria-busy={isSubmitting}
            title={!canSubmitProp ? 'Complete all required fields before submitting' : undefined}
            style={{
              fontFamily: "'Jost', sans-serif", fontSize: '0.78rem', fontWeight: 400,
              letterSpacing: '0.2em', textTransform: 'uppercase', padding: '0.85rem 2.5rem',
              background: 'transparent', border: `1px solid ${T.borderSage}`, borderRadius: 3,
              color: T.sage, cursor: (!canSubmitProp || isSubmitting) ? 'not-allowed' : 'pointer',
              opacity: (!canSubmitProp || isSubmitting) ? 0.35 : 1,
              pointerEvents: isSubmitting ? 'none' : undefined,
            }}
          >
            {isSubmitting ? 'Submitting\u2026' : 'Submit assessment'}
          </button>

          <p style={{ fontSize: '0.7rem', color: T.creamMuted, fontStyle: 'italic' }}>
            Once submitted, this assessment is locked and cannot be edited.
          </p>
        </div>
      )}

      {readOnly && (
        <div style={{ padding: '1rem 1.25rem', background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3, fontSize: '0.8rem', color: T.creamMuted, lineHeight: 1.8 }}>
          This assessment has been submitted. Your responses are locked.
        </div>
      )}
    </div>
  );
}

function SubmitErrorDisplay({ error, onGoToStep }: { error: SubmitError; onGoToStep: (idx: number) => void }) {
  const errorBoxStyle: React.CSSProperties = { width: '100%', padding: '1rem 1.25rem', border: `1px solid ${T.borderRose}`, borderRadius: 3, background: 'rgba(196,132,106,0.05)' };
  const windowBoxStyle: React.CSSProperties = { ...errorBoxStyle, borderColor: T.earthLight, background: T.earthMid };
  const pStyle: React.CSSProperties = { fontSize: '0.8rem', color: T.creamMuted, lineHeight: 1.7 };

  if (error.type === 'incomplete') {
    return (
      <div style={errorBoxStyle} role="alert">
        <p style={{ fontSize: '0.8rem', color: T.rose, marginBottom: '0.75rem' }}>Please complete the following before submitting:</p>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {error.stepsWithErrors.map(({ stepIndex, stepTitle, humanFields }) => (
            <li key={stepIndex} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.78rem', color: T.creamDim, marginBottom: '0.15rem' }}>{stepTitle}</span>
                <span style={{ display: 'block', fontSize: '0.7rem', color: T.creamMuted, lineHeight: 1.5 }}>{humanFields.join(' \u00B7 ')}</span>
              </div>
              <button onClick={() => onGoToStep(stepIndex)} style={{ flexShrink: 0, fontFamily: "'Jost', sans-serif", fontSize: '0.65rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: T.goldDim, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, whiteSpace: 'nowrap' }}>
                Go back &rarr;
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error.type === 'window_closed') return <div style={windowBoxStyle} role="alert"><p style={pStyle}>The submission window closed on {fmtDate(error.closedAt)}.</p><p style={{ ...pStyle, marginTop: '0.4rem' }}>This assessment can no longer be submitted. Your draft has been preserved.</p></div>;
  if (error.type === 'window_not_open') return <div style={windowBoxStyle} role="alert"><p style={pStyle}>This assessment does not open until {fmtDate(error.opensAt)}.</p></div>;
  if (error.type === 'baseline_past_ceremony') return <div style={windowBoxStyle} role="alert"><p style={pStyle}>Baseline must be submitted before ceremony day.</p><p style={{ ...pStyle, marginTop: '0.4rem' }}>This window has closed.</p></div>;
  if (error.type === 'locked') return <div style={windowBoxStyle} role="alert"><p style={pStyle}>This assessment is locked. Please contact your guide.</p></div>;

  return <div style={windowBoxStyle} role="alert"><p style={pStyle}>{error.message}</p></div>;
}
