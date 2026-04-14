'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { SurveyShell } from '@/components/survey/SurveyShell';

const T = {
  earthMid: '#2a2620', earthSurface: '#332e27', creamDim: '#b8ac96', creamMuted: '#6e6558',
  borderLight: 'rgba(201,169,110,0.10)',
};

export default function SurveyPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.assessmentId as string;
  const [assessment, setAssessment] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) {
        router.replace(`/login?next=/portal/assessments/${assessmentId}`);
        return;
      }

      const { data, error } = await supabase
        .from('outcome_assessments')
        .select(
          'id,member_id,operational_member_id,ceremony_id,timepoint,' +
          'is_final,is_locked,submitted_at,started_at,last_saved_at,' +
          'assessment_date,eligibility_snapshot,' +
          'window_open_at,window_due_at,window_hard_close_at,' +
          'phq9_q1,phq9_q2,phq9_q3,phq9_q4,phq9_q5,' +
          'phq9_q6,phq9_q7,phq9_q8,phq9_q9,phq9_total,' +
          'overall_change,regulation_score,primary_intention,' +
          'support_needed_now,adverse_event_flag'
        )
        .eq('id', assessmentId)
        .eq('member_id', user.id)
        .maybeSingle();

      if (error || !data) {
        router.replace('/portal/assessments');
        return;
      }

      setUserId(user.id);
      setAssessment(data);
    }

    load();
  }, [assessmentId, router]);

  if (!assessment || !userId) {
    if (state === 'error') {
      return (
        <main style={{ maxWidth: 600, margin: '0 auto', padding: '3rem 2rem' }}>
          <div style={{ padding: '3rem 2rem', textAlign: 'center', border: `1px solid ${T.borderLight}`, borderRadius: 3, background: T.earthMid }}>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', color: T.creamDim, marginBottom: '0.5rem' }}>Assessment not found</p>
            <p style={{ fontSize: '0.8rem', color: T.creamMuted }}>Redirecting to your timeline...</p>
          </div>
        </main>
      );
    }

    // Loading skeleton
    return (
      <main style={{ maxWidth: 600, margin: '0 auto', padding: '2.5rem 2rem' }}>
        <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
        <div style={{ height: 24, width: 180, marginBottom: 12, borderRadius: 2, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite' }} />
        <div style={{ height: 36, width: 300, marginBottom: 24, borderRadius: 2, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite', animationDelay: '0.1s' }} />
        <div style={{ height: 2, marginBottom: 32, borderRadius: 2, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite', animationDelay: '0.2s' }} />
        {[...Array(3)].map((_, i) => (
          <div key={i} style={{ height: 80, marginBottom: 16, borderRadius: 3, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite', animationDelay: `${0.3 + i * 0.1}s` }} />
        ))}
      </main>
    );
  }

  return <SurveyShell assessment={assessment} authUserId={userId} />;
}
