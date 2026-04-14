'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getMemberAssessmentStatus, CeremonyGroup } from '@/lib/assessments/getMemberAssessmentStatus';
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
  borderLight: 'rgba(201,169,110,0.10)',
};

export default function AssessmentsPage() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'empty' | 'error' | 'ready'>('loading');
  const [ceremonies, setCeremonies] = useState<CeremonyGroup[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

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

  // CTA handlers (stubs \u2014 Ticket 2 will implement the survey)
  function handleBegin(timepoint: string, ceremonyId: string) {
    console.log('[TODO Ticket 2] begin:', timepoint, ceremonyId);
  }

  function handleContinue(timepoint: string, ceremonyId: string, assessmentId: string) {
    console.log('[TODO Ticket 2] continue:', timepoint, ceremonyId, assessmentId);
  }

  // Keyframe animation (injected once)
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
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>Member Portal \u00B7 Outcomes</p>
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
      <p style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>Member Portal \u00B7 Outcomes</p>
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
          onBegin={handleBegin}
          onContinue={handleContinue}
        />
      ))}
    </main>
  );
}
