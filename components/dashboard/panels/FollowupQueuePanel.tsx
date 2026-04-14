'use client';

import React from 'react';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882', sageDark: '#4e7250',
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

function urgencyBadge(days: number | null | undefined, urgency: string | null | undefined): React.ReactNode {
  const d = Number(days ?? 0);
  let label = urgency ?? (d > 30 ? 'critical' : d > 14 ? 'high' : d > 7 ? 'medium' : 'low');
  label = label.toLowerCase();

  let bg: string;
  let fg: string;

  if (label === 'critical') {
    bg = T.roseDim;
    fg = T.rose;
  } else if (label === 'high') {
    bg = T.amberDim;
    fg = T.amber;
  } else if (label === 'medium') {
    bg = T.goldDim;
    fg = T.gold;
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
      {label}
    </span>
  );
}

interface FollowupQueuePanelProps {
  data: any[];
}

export function FollowupQueuePanel({ data }: FollowupQueuePanelProps) {
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
            <th style={th}>Days Overdue</th>
            <th style={th}>Urgency</th>
            <th style={th}>Task Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ background: T.earthMid }}>
              <td style={{ ...td, fontWeight: 600, color: T.goldLight, whiteSpace: 'nowrap' }}>
                {row.display_name ?? row.member_name ?? '-'}
              </td>
              <td style={{ ...td, color: T.creamDim }}>{row.timepoint ?? row.timepoint_label ?? '-'}</td>
              <td style={{ ...td, fontWeight: 600 }}>{row.days_overdue ?? '-'}</td>
              <td style={td}>
                {urgencyBadge(row.days_overdue, row.urgency)}
              </td>
              <td style={td}>
                {row.task_exists ? (
                  <span style={{ color: T.sage, fontSize: '0.8rem', fontWeight: 600 }}>Task exists</span>
                ) : (
                  <span style={{ color: T.creamMuted, fontSize: '0.8rem' }}>No task</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
