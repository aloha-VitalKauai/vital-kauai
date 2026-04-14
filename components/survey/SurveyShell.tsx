'use client';

import { useState } from 'react';
import { buildSteps, resumeStepIndex, EligibilitySnapshot, StepConfig } from '@/lib/assessments/surveySteps';
import { canSubmit } from '@/lib/assessments/surveyValidation';
import { useSurveyAutosave, SaveStatus } from '@/lib/assessments/useSurveyAutosave';
import { IntroStep } from './steps/IntroStep';
import { Phq9Step } from './steps/Phq9Step';
import { Gad7Step } from './steps/Gad7Step';
import { QolStep } from './steps/QolStep';
import { SleepStep } from './steps/SleepStep';
import { IntentionStep } from './steps/IntentionStep';
import { StabilisationStep } from './steps/StabilisationStep';
import { OverallChangeStep } from './steps/OverallChangeStep';
import { PatternsStep } from './steps/PatternsStep';
import { FunctioningStep } from './steps/FunctioningStep';
import { NarrativeStep } from './steps/NarrativeStep';
import { AddictionStep } from './steps/AddictionStep';
import { PtsdStep } from './steps/PtsdStep';
import { SafetyCheckStep } from './steps/SafetyCheckStep';
import { ReviewStep } from './steps/ReviewStep';
import { createClient } from '@/lib/supabase/client';

const T = {
  earth: '#1a1712', earthLight: '#4a4338', goldDim: '#8a7250', goldLight: '#dfc49a',
  gold: '#c9a96e', cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882', sageDark: '#4e7250', borderLight: 'rgba(201,169,110,0.10)',
  borderSage: 'rgba(143,168,130,0.35)',
};

interface Props {
  assessment: Record<string, any>;
  authUserId: string;
}

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '', saving: 'Saving\u2026', saved: 'Saved', error: 'Not saved',
};
const SAVE_COLOR: Record<SaveStatus, string> = {
  idle: T.creamMuted, saving: T.goldDim, saved: T.sage, error: '#c4846a',
};

export function SurveyShell({ assessment, authUserId }: Props) {
  const supabase = createClient();
  const isReadOnly = assessment.is_locked || assessment.is_final;

  const eligibility = (assessment.eligibility_snapshot ?? null) as EligibilitySnapshot | null;
  const steps = buildSteps(assessment.timepoint, eligibility);

  // Build initial responses from all fields across all steps
  const initialResponses: Record<string, any> = {};
  for (const step of steps) {
    for (const f of step.fields) {
      if (assessment[f] != null) initialResponses[f] = assessment[f];
    }
  }

  const [stepIndex, setStepIndex] = useState(() =>
    isReadOnly ? 0 : resumeStepIndex(steps, initialResponses)
  );

  const [responses, setResponses] = useState<Record<string, any>>(initialResponses);

  const { saveStatus, updateResponse, flushSave } = useSurveyAutosave({
    supabase, assessmentId: assessment.id, authUserId, isReadOnly,
  });

  function handleUpdate(field: string, value: unknown) {
    setResponses(prev => ({ ...prev, [field]: value }));
    updateResponse(field, value);
  }

  async function goNext() {
    if (stepIndex < steps.length - 1) {
      await flushSave();
      setStepIndex(i => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // TODO Ticket 5: if last step && submitReady, call finalize_assessment()
  }

  function goBack() {
    if (stepIndex > 0) {
      setStepIndex(i => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const submitReady = canSubmit(responses, steps);

  function renderStep(s: StepConfig) {
    const commonProps = { responses, onUpdate: handleUpdate, readOnly: isReadOnly };

    switch (s.type) {
      case 'intro':          return <IntroStep timepoint={assessment.timepoint} windowDueAt={assessment.window_due_at} windowCloseAt={assessment.window_hard_close_at} />;
      case 'intention':      return <IntentionStep {...commonProps} />;
      case 'phq9':           return <Phq9Step responses={responses} onUpdateResponse={handleUpdate} readOnly={isReadOnly} />;
      case 'gad7':           return <Gad7Step {...commonProps} />;
      case 'qol':            return <QolStep {...commonProps} />;
      case 'sleep':          return <SleepStep {...commonProps} />;
      case 'stabilisation':  return <StabilisationStep {...commonProps} />;
      case 'overall_change': return <OverallChangeStep {...commonProps} />;
      case 'patterns':       return <PatternsStep {...commonProps} />;
      case 'functioning':    return <FunctioningStep {...commonProps} />;
      case 'narrative':      return <NarrativeStep {...commonProps} timepoint={assessment.timepoint} />;
      case 'addiction':      return <AddictionStep {...commonProps} />;
      case 'ptsd':           return <PtsdStep {...commonProps} />;
      case 'safety':         return <SafetyCheckStep {...commonProps} />;
      case 'review':         return <ReviewStep steps={steps} responses={responses} readOnly={isReadOnly} />;
      default:               return <p style={{ fontSize: '0.85rem', color: T.creamMuted }}>Step type &ldquo;{s.type}&rdquo; not yet implemented.</p>;
    }
  }

  const btnBase: React.CSSProperties = {
    fontFamily: "'Jost', sans-serif", fontSize: '0.68rem', fontWeight: 400,
    letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0.6rem 1.4rem',
    borderRadius: 2, cursor: 'pointer', border: 'none', display: 'inline-flex',
    alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap',
  };

  return (
    <>
      <style>{`@keyframes stepIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '2.5rem 2rem 8rem' }}>
        {isReadOnly && (
          <div style={{ background: 'rgba(143,168,130,0.08)', border: `1px solid ${T.borderSage}`, borderRadius: 3, padding: '0.75rem 1.1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <svg style={{ width: 16, height: 16, flexShrink: 0, color: T.sage }} viewBox="0 0 16 16" fill="none">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 4v4m0 2v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
            </svg>
            <p style={{ fontSize: '0.78rem', color: T.creamDim, lineHeight: 1.6 }}>This assessment has been submitted and is read-only.</p>
          </div>
        )}

        <header style={{ marginBottom: '2.5rem' }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
            Assessment &middot; {assessment.timepoint.replace(/_/g, ' ')}
          </p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.9rem', fontWeight: 300, color: T.cream, lineHeight: 1.15 }}>
            {step.title}
          </h1>
        </header>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: '2.5rem' }} role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={steps.length} aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
          {steps.map((_, i) => (
            <div key={i} style={{ height: 2, flex: 1, borderRadius: 2, background: i < stepIndex ? T.sageDark : i === stepIndex ? T.goldDim : T.earthLight, transition: 'background 0.3s ease' }} />
          ))}
        </div>

        <div key={step.id} style={{ animation: 'stepIn 0.25s ease both' }}>
          {renderStep(step)}
        </div>
      </main>

      <footer style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: T.earth,
        borderTop: `1px solid ${T.borderLight}`, padding: '1rem 2rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', zIndex: 50,
      }}>
        <div>
          <button
            style={{ ...btnBase, background: 'transparent', border: `1px solid ${T.earthLight}`, color: T.creamMuted, ...(stepIndex === 0 && { opacity: 0.3, cursor: 'not-allowed', pointerEvents: 'none' as const }) }}
            onClick={goBack} disabled={stepIndex === 0}
          >&larr; Back</button>
        </div>

        <span style={{ fontSize: '0.65rem', letterSpacing: '0.12em', color: SAVE_COLOR[saveStatus], minWidth: 80, textAlign: 'center', transition: 'color 0.3s' }} aria-live="polite">
          {SAVE_LABEL[saveStatus]}
        </span>

        <div>
          <button
            style={{
              ...btnBase, background: 'transparent',
              border: `1px solid ${isLastStep ? (submitReady ? T.sageDark : T.earthLight) : T.goldDim}`,
              color: isLastStep ? (submitReady ? T.sage : T.creamMuted) : T.goldLight,
              ...((isLastStep && !submitReady) && { opacity: 0.4, cursor: 'not-allowed', pointerEvents: 'none' as const }),
            }}
            onClick={goNext}
            disabled={isLastStep && !submitReady}
            title={isLastStep && !submitReady ? 'Complete all required fields to submit' : undefined}
          >
            {isLastStep ? 'Submit \u2192' : 'Next \u2192'}
          </button>
        </div>
      </footer>
    </>
  );
}
