'use client';

import React, { useState } from 'react';
import { downloadFoundersCSV, downloadDeidentifiedCSV } from '@/lib/dashboard/exportUtils';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882',
  rose: '#c4846a',
  border: 'rgba(201,169,110,0.18)',
};

interface ExportPanelProps {
  ceremonyId: string | null;
  supabase: any;
}

export function ExportPanel({ ceremonyId, supabase }: ExportPanelProps) {
  const [foundersLoading, setFoundersLoading] = useState(false);
  const [deidentifiedLoading, setDeidentifiedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buttonBase: React.CSSProperties = {
    padding: '0.6rem 1.25rem',
    borderRadius: '6px',
    border: `1px solid ${T.border}`,
    fontSize: '0.85rem',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
  };

  async function handleFounders() {
    if (!ceremonyId) return;
    setFoundersLoading(true);
    setError(null);
    try {
      await downloadFoundersCSV(supabase, ceremonyId);
    } catch (e: any) {
      setError(e.message ?? 'Export failed');
    } finally {
      setFoundersLoading(false);
    }
  }

  async function handleDeidentified() {
    setDeidentifiedLoading(true);
    setError(null);
    try {
      await downloadDeidentifiedCSV(supabase);
    } catch (e: any) {
      setError(e.message ?? 'Export failed');
    } finally {
      setDeidentifiedLoading(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={handleFounders}
          disabled={!ceremonyId || foundersLoading}
          style={{
            ...buttonBase,
            background: ceremonyId ? T.gold : T.earthLight,
            color: ceremonyId ? T.earth : T.creamMuted,
            opacity: foundersLoading ? 0.6 : 1,
            cursor: !ceremonyId || foundersLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {foundersLoading ? 'Downloading...' : 'Founders CSV'}
        </button>
        <button
          onClick={handleDeidentified}
          disabled={deidentifiedLoading}
          style={{
            ...buttonBase,
            background: T.earthSurface,
            color: T.cream,
            opacity: deidentifiedLoading ? 0.6 : 1,
            cursor: deidentifiedLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {deidentifiedLoading ? 'Downloading...' : 'De-identified CSV (All Ceremonies)'}
        </button>
      </div>
      {!ceremonyId && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: T.creamMuted }}>
          Select a ceremony to enable Founders CSV export
        </div>
      )}
      {error && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: T.rose }}>
          {error}
        </div>
      )}
    </div>
  );
}
