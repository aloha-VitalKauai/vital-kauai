'use client';

import React from 'react';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882', sageDark: '#4e7250',
  rose: '#c4846a', roseDim: '#7a4f3a',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
};

const th: React.CSSProperties = {
  background: T.earthSurface,
  color: T.creamMuted,
  textTransform: 'uppercase',
  fontSize: '0.68rem',
  letterSpacing: '0.08em',
  fontWeight: 600,
  padding: '0.5rem 0.75rem',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  color: T.cream,
  fontSize: '0.85rem',
  borderBottom: `1px solid ${T.borderLight}`,
};

function deltaColor(delta: number | null | undefined): string {
  if (delta == null || isNaN(Number(delta))) return T.creamMuted;
  if (delta < -3) return T.sage;
  if (delta > 3) return T.rose;
  return T.creamMuted;
}

function responseChip(response: string | null | undefined): React.ReactNode {
  if (!response) return <span style={{ color: T.creamMuted }}>-</span>;

  const r = response.toLowerCase();
  let bg: string;
  let fg: string;

  if (r === 'remission' || r === 'responder') {
    bg = T.sageDark;
    fg = T.sage;
  } else if (r === 'partial') {
    bg = T.goldDim;
    fg = T.gold;
  } else if (r === 'deteriorated') {
    bg = T.roseDim;
    fg = T.rose;
  } else {
    bg = T.earthLight;
    fg = T.creamMuted;
  }

  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: '0.72rem',
        fontWeight: 600,
        padding: '0.15rem 0.5rem',
        borderRadius: '10px',
        whiteSpace: 'nowrap',
      }}
    >
      {response}
    </span>
  );
}

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(Number(val))) return '-';
  return Number(val).toFixed(1);
}

function fmtDelta(val: number | null | undefined): string {
  if (val == null || isNaN(Number(val))) return '-';
  const n = Number(val);
  return (n > 0 ? '+' : '') + n.toFixed(1);
}

function fmtPct(val: number | null | undefined): string {
  if (val == null || isNaN(Number(val))) return '-';
  return Math.round(Number(val)) + '%';
}

interface TrajectoriesPanelProps {
  data: any[];
}

export function TrajectoriesPanel({ data }: TrajectoriesPanelProps) {
  if (!data || data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: T.creamMuted, fontSize: '0.85rem' }}>
        No data for this ceremony
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Member</th>
            <th style={th}>Partner</th>
            <th style={th}>Assessments</th>
            <th style={th}>PHQ-9 base</th>
            <th style={th}>PHQ-9 latest</th>
            <th style={th}>&Delta;</th>
            <th style={th}>% improve</th>
            <th style={th}>Response</th>
            <th style={th}>GAD-7 base</th>
            <th style={th}>GAD-7 &Delta;</th>
            <th style={th}>Latest</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ background: T.earthMid }}>
              <td style={{ ...td, fontWeight: 600, color: T.goldLight, whiteSpace: 'nowrap' }}>
                {row.display_name ?? row.member_name ?? '-'}
              </td>
              <td style={{ ...td, color: T.creamDim }}>{row.partner_name ?? '-'}</td>
              <td style={td}>{row.assessment_count ?? row.total_assessments ?? '-'}</td>
              <td style={td}>{fmt(row.phq9_baseline)}</td>
              <td style={td}>{fmt(row.phq9_latest)}</td>
              <td style={{ ...td, color: deltaColor(row.phq9_delta), fontWeight: 600 }}>
                {fmtDelta(row.phq9_delta)}
              </td>
              <td style={td}>{fmtPct(row.phq9_pct_improvement)}</td>
              <td style={td}>{responseChip(row.phq9_response_category)}</td>
              <td style={td}>{fmt(row.gad7_baseline)}</td>
              <td style={{ ...td, color: deltaColor(row.gad7_delta), fontWeight: 600 }}>
                {fmtDelta(row.gad7_delta)}
              </td>
              <td style={td}>{fmt(row.gad7_latest)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
