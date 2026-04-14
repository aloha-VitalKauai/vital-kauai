'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getMemberAssessmentStatus, CeremonyGroup } from '@/lib/assessments/getMemberAssessmentStatus';
import { startOrResumeAssessment } from '@/lib/assessments/startOrResumeAssessment';
import { AssessmentTimeline } from '@/components/assessments/AssessmentTimeline';

const T = {
  earth: '#1a1712',
  earthMid: '#2a2620',
  earthSurface: '#332e27',
  goldDim: '#8a7250',
  cream: '#f2ead8',
  creamMuted: '#6e6558',
  creamDim: '#b8ac96',
  sage: '#8fa882',
  border: 'rgba(201,169,110,0.18)',
  borderLight: 'rgba(201,169,110,0.10)',
};

export default function AssessmentsPage() {
  return (
    <Suspense>
      <AssessmentsPageInner />
    </Suspense>
  );
}

const TIMEPOINT_LABELS: Record<string, string> = {
  baseline: 'Baseline', post_72h: '72-hour', post_1m: '1-month',
  post_3m: '3-month', post_6m: '6-month', post_12m: '12-month',
};

function AssessmentsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading');
  const [ceremonies, setCeremonies] = useState<CeremonyGroup[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState('');
  const [cardStates, setCardStates] = useState<Record<string, { loading: boolean; error: string }>>({});
  const inFlightRef = useRef(new Set<string>());

  function setCardState(timepoint: string, ceremonyId: string, patch: { loading?: boolean; error?: string }) {
    const key = `${timepoint}:${ceremonyId}`;
    setCardStates(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { loading: false, error: '' }), ...patch },
    }));
  }

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3500);
  }

  // Show success toast when returning from a completed submission
  useEffect(() => {
    const submitted = searchParams.get('submitted');
    if (!submitted) return;
    const label = TIMEPOINT_LABELS[submitted] ?? submitted;
    showToast(`Your ${label} assessment has been submitted.`);
    router.replace('/portal/assessments', { scroll: false });
  }, [searchParams, router]);

  async function refreshTimeline() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getMemberAssessmentStatus(supabase, user.id);
      setCeremonies(data);
    } catch {
      // Silent — timeline may be slightly stale but not broken
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();

      if (authErr || !user) {
        router.replace('/login?next=/portal/assessments');
        return;
      }

      try {
        const data = await getMemberAssessmentStatus(supabase, user.id);
        if (cancelled) return;
        if (!data.length) {
          setState('empty');
        } else {
          setCeremonies(data);
          setState('ready');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.');
        setState('error');
      }
    }

    load();
    return () => { cancelled = true; };
  }, [router]);

  // Begin and Continue use the same handler — the RPC handles resume automatically
  async function handleBegin(timepoint: string, ceremonyId: string) {
    const key = `${timepoint}:${ceremonyId}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);

    setCardState(timepoint, ceremonyId, { loading: true, error: '' });

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login?next=/portal/assessments'); return; }

      const result = await startOrResumeAssessment(supabase, user.id, ceremonyId, timepoint);

      switch (result.outcome) {
        case 'draft_created':
        case 'draft_resumed':
          router.push(`/portal/assessments/${result.assessmentId}`);
          break;

        case 'already_completed':
          showToast('This assessment has already been submitted.');
          setCardState(timepoint, ceremonyId, { loading: false });
          await refreshTimeline();
          break;

        case 'error':
          setCardState(timepoint, ceremonyId, { loading: false, error: result.message });
          break;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setCardState(timepoint, ceremonyId, { loading: false, error: msg });
    } finally {
      inFlightRef.current.delete(key);
    }
  }

  const handleContinue = (timepoint: string, ceremonyId: string, _assessmentId: string) => {
    handleBegin(timepoint, ceremonyId);
  };

  // Keyframe animations
  const keyframes = `@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;

  if (state === 'loading') {
    return (
      <main style={{ maxWidth: 740, margin: '0 auto', padding: '3rem 2rem 6rem' }}>
        <style>{keyframes}</style>
        <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            height: 86, marginBottom: '1.25rem', borderRadius: 3,
            background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`,
            backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite',
            animationDelay: `${i * 0.1}s`,
          }} />
        ))}
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main style={{ maxWidth: 740, margin: '0 auto', padding: '3rem 2rem 6rem' }}>
        <div style={{ padding: '3rem 2rem', textAlign: 'center', border: `1px solid ${T.borderLight}`, borderRadius: 3, background: T.earthMid }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: T.creamDim, marginBottom: '0.5rem' }}>Could not load your assessments</p>
          <p style={{ fontSize: '0.8rem', color: T.creamMuted, maxWidth: 340, margin: '0 auto', lineHeight: 1.9 }}>{errorMessage || 'Please refresh the page or contact support.'}</p>
        </div>
      </main>
    );
  }

  if (state === 'empty') {
    return (
      <main style={{ maxWidth: 740, margin: '0 auto', padding: '3rem 2rem 6rem' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>Member Portal &middot; Outcomes</p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.6rem', fontWeight: 300, color: T.cream, marginBottom: '0.6rem', lineHeight: 1.1 }}>
          Your outcomes <em style={{ fontStyle: 'italic', color: T.sage }}>journey</em>
        </h1>
        <div style={{ padding: '3rem 2rem', textAlign: 'center', border: `1px solid ${T.borderLight}`, borderRadius: 3, background: T.earthMid }}>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: T.creamDim, marginBottom: '0.5rem' }}>No ceremony scheduled yet</p>
          <p style={{ fontSize: '0.8rem', color: T.creamMuted, maxWidth: 340, margin: '0 auto', lineHeight: 1.9 }}>
            Your assessment timeline will appear here once your ceremony date is confirmed. Reach out to your guide if you have questions.
          </p>
        </div>
      </main>
    );
  }

  const showCeremonyHeader = ceremonies.length > 1;

  return (
    <main style={{ maxWidth: 740, margin: '0 auto', padding: '3rem 2rem 6rem' }}>
      <style>{keyframes}</style>
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>Member Portal &middot; Outcomes</p>
      <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.6rem', fontWeight: 300, color: T.cream, marginBottom: '0.6rem', lineHeight: 1.1 }}>
        Your outcomes <em style={{ fontStyle: 'italic', color: T.sage }}>journey</em>
      </h1>
      <p style={{ fontSize: '0.875rem', color: T.creamMuted, lineHeight: 1.8, maxWidth: 500, marginBottom: '3rem' }}>
        These surveys are the evidence &mdash; for you first, for the broader understanding of iboga second. Your responses form one of the most honest records of what this experience produced in a real human life.
      </p>

      {ceremonies.map((group) => (
        <AssessmentTimeline
          key={group.ceremony_id}
          group={group}
          showCeremonyHeader={showCeremonyHeader}
          cardStates={cardStates}
          onBegin={handleBegin}
          onContinue={handleContinue}
        />
      ))}

      {toast && (
        <div role="status" aria-live="polite" style={{
          position: 'fixed', bottom: '2rem', left: '50%',
          transform: 'translateX(-50%)', background: T.earthSurface,
          border: `1px solid ${T.border}`, color: T.creamDim,
          fontSize: '0.75rem', letterSpacing: '0.04em',
          padding: '0.65rem 1.4rem', borderRadius: 3, zIndex: 200,
          whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}
    </main>
  );
}
