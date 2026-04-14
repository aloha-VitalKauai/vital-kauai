'use client';

import React from 'react';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882',
  rose: '#c4846a', roseDim: '#7a4f3a',
  amber: '#c9973a', amberDim: '#8a6a20',
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

function severityChip(severity: string | null | undefined): React.ReactNode {
  if (!severity) return <span style={{ color: T.creamMuted }}>-</span>;
  const s = severity.toLowerCase();
  let bg: string;
  let fg: string;

  if (s === 'severe') {
    bg = T.roseDim;
    fg = T.rose;
  } else if (s === 'moderate') {
    bg = T.amberDim;
    fg = T.amber;
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
        textTransform: 'capitalize',
      }}
    >
      {severity}
    </span>
  );
}

function reviewChip(status: string | null | undefined): React.ReactNode {
  if (!status) return <span style={{ color: T.creamMuted }}>-</span>;
  const s = status.toLowerCase();
  let bg: string;
  let fg: string;

  if (s === 'unreviewed') {
    bg = T.roseDim;
    fg = T.rose;
  } else if (s === 'reviewed') {
    bg = T.amberDim;
    fg = T.amber;
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
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) return '-';
  return text.length > max ? text.slice(0, max) + '...' : text;
}

interface AdverseEventsPanelProps {
  data: any[];
}

export function AdverseEventsPanel({ data }: AdverseEventsPanelProps) {
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
            <th style={th}>Timepoint</th>
            <th style={th}>Severity</th>
            <th style={{ ...th, minWidth: '200px' }}>Description</th>
            <th style={th}>Days Since</th>
            <th style={th}>Review Status</th>
            <th style={th}>Escalation</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ background: T.earthMid }}>
              <td style={{ ...td, fontWeight: 600, color: T.goldLight, whiteSpace: 'nowrap' }}>
                {row.display_name ?? row.member_name ?? '-'}
              </td>
              <td style={{ ...td, color: T.creamDim }}>{row.timepoint ?? row.timepoint_label ?? '-'}</td>
              <td style={td}>{severityChip(row.severity)}</td>
              <td style={{ ...td, color: T.creamDim, maxWidth: '300px' }}>
                {truncate(row.description, 180)}
              </td>
              <td style={td}>{row.days_since ?? row.days_since_event ?? '-'}</td>
              <td style={td}>{reviewChip(row.review_status)}</td>
              <td style={{ ...td, color: T.creamDim }}>{row.escalation_level ?? row.escalation ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
