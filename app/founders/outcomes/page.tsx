'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CeremonySelector } from '@/components/dashboard/CeremonySelector';
import { DashboardPanel } from '@/components/dashboard/DashboardPanel';
import { CompletionPanel } from '@/components/dashboard/panels/CompletionPanel';
import { TrajectoriesPanel } from '@/components/dashboard/panels/TrajectoriesPanel';
import { FollowupQueuePanel } from '@/components/dashboard/panels/FollowupQueuePanel';
import { AdverseEventsPanel } from '@/components/dashboard/panels/AdverseEventsPanel';
import { ExportPanel } from '@/components/dashboard/panels/ExportPanel';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882',
  rose: '#c4846a',
  amber: '#c9973a',
  border: 'rgba(201,169,110,0.18)',
};

const FOUNDER_IDS = [
  'd6e824e3-69ab-447c-b046-afecfe4b7028',
  '268f721a-9c7c-4bb2-82b7-3c29178281b1',
];

interface PanelData {
  completion: any[];
  cohort: any[];
  trajectories: any[];
  followups: any[];
  adverse: any[];
}

type LoadingState = Record<keyof PanelData, boolean>;

const supabase = createClient();

export default function FoundersOutcomesPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [ceremonies, setCeremonies] = useState<{ ceremony_id: string; ceremony_date: string }[]>([]);
  const [selectedCeremony, setSelectedCeremony] = useState<string | null>(null);
  const [panelData, setPanelData] = useState<PanelData>({
    completion: [],
    cohort: [],
    trajectories: [],
    followups: [],
    adverse: [],
  });
  const [loading, setLoading] = useState<LoadingState>({
    completion: false,
    cohort: false,
    trajectories: false,
    followups: false,
    adverse: false,
  });
  const [pageLoading, setPageLoading] = useState(true);

  // Auth check
  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      // Check founder via hardcoded IDs first
      if (FOUNDER_IDS.includes(user.id)) {
        setAuthed(true);
        return;
      }

      // Fallback: check user_roles table
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'founder')
        .limit(1);

      if (roles && roles.length > 0) {
        setAuthed(true);
      } else {
        router.replace('/login');
      }
    }
    checkAuth().finally(() => setPageLoading(false));
  }, [router]);

  // Load ceremonies
  useEffect(() => {
    if (!authed) return;
    async function loadCeremonies() {
      const { data } = await supabase
        .from('assessment_completion_summary')
        .select('ceremony_id, ceremony_date');

      if (data) {
        const seen = new Map<string, string>();
        for (const row of data) {
          if (row.ceremony_id && !seen.has(row.ceremony_id)) {
            seen.set(row.ceremony_id, row.ceremony_date);
          }
        }
        const list = Array.from(seen.entries())
          .map(([ceremony_id, ceremony_date]) => ({ ceremony_id, ceremony_date }))
          .sort((a, b) => b.ceremony_date.localeCompare(a.ceremony_date));
        setCeremonies(list);
        if (list.length > 0) {
          setSelectedCeremony(list[0].ceremony_id);
        }
      }
    }
    loadCeremonies();
  }, [authed]);

  // Fetch panel data on ceremony change
  const fetchPanelData = useCallback(async (ceremonyId: string) => {
    setLoading({ completion: true, cohort: true, trajectories: true, followups: true, adverse: true });

    const results = await Promise.allSettled([
      supabase
        .from('assessment_completion_summary')
        .select('*')
        .eq('ceremony_id', ceremonyId),
      supabase
        .from('cohort_summary')
        .select('*')
        .eq('ceremony_id', ceremonyId),
      supabase
        .from('member_outcomes_summary_view')
        .select('*')
        .eq('ceremony_id', ceremonyId),
      supabase
        .from('followup_overdue_view')
        .select('*')
        .eq('ceremony_id', ceremonyId),
      supabase
        .from('adverse_events_review_view')
        .select('*')
        .eq('ceremony_id', ceremonyId),
    ]);

    const extract = (r: PromiseSettledResult<any>) =>
      r.status === 'fulfilled' ? (r.value.data ?? []) : [];

    setPanelData({
      completion: extract(results[0]),
      cohort: extract(results[1]),
      trajectories: extract(results[2]),
      followups: extract(results[3]),
      adverse: extract(results[4]),
    });

    setLoading({ completion: false, cohort: false, trajectories: false, followups: false, adverse: false });
  }, []);

  useEffect(() => {
    if (selectedCeremony) {
      fetchPanelData(selectedCeremony);
    }
  }, [selectedCeremony, fetchPanelData]);

  function handleCeremonyChange(id: string) {
    setSelectedCeremony(id || null);
  }

  if (pageLoading) {
    return (
      <div style={{ background: T.earth, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: T.creamMuted, fontSize: '0.9rem' }}>Loading...</div>
      </div>
    );
  }

  if (!authed) return null;

  const spinner = (
    <div style={{ textAlign: 'center', padding: '1.5rem', color: T.creamMuted, fontSize: '0.85rem' }}>
      Loading...
    </div>
  );

  return (
    <div style={{ background: T.earth, minHeight: '100vh', color: T.cream }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '1.5rem 1.25rem 3rem' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: T.gold,
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            Outcomes Dashboard
          </h1>
          <CeremonySelector
            ceremonies={ceremonies}
            selected={selectedCeremony}
            onChange={handleCeremonyChange}
          />
        </div>

        {/* Completion & Cohort */}
        <DashboardPanel title="Assessment Completion">
          {loading.completion || loading.cohort
            ? spinner
            : <CompletionPanel completion={panelData.completion} cohort={panelData.cohort} />
          }
        </DashboardPanel>

        {/* Member Trajectories */}
        <DashboardPanel
          title="Member Trajectories"
          badge={panelData.trajectories.length > 0 ? { count: panelData.trajectories.length, color: T.sage } : undefined}
        >
          {loading.trajectories
            ? spinner
            : <TrajectoriesPanel data={panelData.trajectories} />
          }
        </DashboardPanel>

        {/* Follow-up Queue */}
        <DashboardPanel
          title="Follow-up Queue"
          badge={panelData.followups.length > 0 ? { count: panelData.followups.length, color: T.amber } : undefined}
        >
          {loading.followups
            ? spinner
            : <FollowupQueuePanel data={panelData.followups} />
          }
        </DashboardPanel>

        {/* Adverse Events */}
        <DashboardPanel
          title="Adverse Events"
          badge={panelData.adverse.length > 0 ? { count: panelData.adverse.length, color: T.rose } : undefined}
        >
          {loading.adverse
            ? spinner
            : <AdverseEventsPanel data={panelData.adverse} />
          }
        </DashboardPanel>

        {/* Data Export */}
        <DashboardPanel title="Data Export">
          <ExportPanel ceremonyId={selectedCeremony} supabase={supabase} />
        </DashboardPanel>
      </div>
    </div>
  );
}
