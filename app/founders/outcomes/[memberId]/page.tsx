'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getFounderMemberStatus } from '@/lib/assessments/getFounderMemberStatus';
import { CeremonyGroup } from '@/lib/assessments/getMemberAssessmentStatus';
import { MemberOutcomeDetail } from '@/components/dashboard/MemberOutcomeDetail';

const FOUNDER_IDS = [
  'd6e824e3-69ab-447c-b046-afecfe4b7028',
  '268f721a-9c7c-4bb2-82b7-3c29178281b1',
];

const T = { earthMid: '#2a2620', earthSurface: '#332e27', creamDim: '#b8ac96', creamMuted: '#6e6558', borderLight: 'rgba(201,169,110,0.10)' };

export default function MemberOutcomePage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;
  const [member, setMember] = useState<any>(null);
  const [ceremonies, setCeremonies] = useState<CeremonyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !FOUNDER_IDS.includes(user.id)) { router.replace('/login'); return; }

      // Fetch member info + summary in parallel
      const [memberRes, summaryRes, timelineData] = await Promise.all([
        supabase.from('members').select('id, full_name, assigned_partner, ceremony_date').eq('id', memberId).single(),
        supabase.from('member_outcomes_summary_view').select('*').eq('member_id', memberId).limit(1).maybeSingle(),
        getFounderMemberStatus(supabase, memberId),
      ]);

      if (!memberRes.data) { router.replace('/founders/outcomes'); return; }

      setMember({
        ...memberRes.data,
        ...(summaryRes.data ?? {}),
      });
      setCeremonies(timelineData);
      setLoading(false);
    }
    load();
  }, [memberId, router]);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '3rem 2rem' }}>
        <style>{`@keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}`}</style>
        <div style={{ height: 20, width: 120, marginBottom: 16, borderRadius: 2, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite' }} />
        <div style={{ height: 40, width: 280, marginBottom: 24, borderRadius: 2, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite' }} />
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ height: 70, marginBottom: 12, borderRadius: 3, background: `linear-gradient(90deg,${T.earthMid} 25%,${T.earthSurface} 50%,${T.earthMid} 75%)`, backgroundSize: '800px 100%', animation: 'shimmer 1.4s linear infinite', animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    );
  }

  return <MemberOutcomeDetail member={member} ceremonies={ceremonies} />;
}
