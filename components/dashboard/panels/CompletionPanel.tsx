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

function barColor(pct: number): string {
  if (pct >= 80) return T.sage;
  if (pct >= 50) return T.amber;
  return T.rose;
}

function fmt(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return '-';
  return Number(val).toFixed(1);
}

interface CompletionPanelProps {
  completion: any[];
  cohort: any[];
}

export function CompletionPanel({ completion, cohort }: CompletionPanelProps) {
  // Merge by timepoint
  const timepointMap = new Map<string, any>();

  for (const row of completion ?? []) {
    const key = row.timepoint ?? row.timepoint_label;
    timepointMap.set(key, { ...timepointMap.get(key), ...row });
  }
  for (const row of cohort ?? []) {
    const key = row.timepoint ?? row.timepoint_label;
    timepointMap.set(key, { ...timepointMap.get(key), ...row });
  }

  const rows = Array.from(timepointMap.values());

  if (rows.length === 0) {
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
            <th style={th}>Timepoint</th>
            <th style={th}>Enrolled</th>
            <th style={th}>Submitted</th>
            <th style={{ ...th, minWidth: '140px' }}>Completion %</th>
            <th style={th}>PHQ-9 mean (n)</th>
            <th style={th}>GAD-7 mean (n)</th>
            <th style={th}>QoL mean</th>
            <th style={th}>Regulation</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const pct = row.completion_pct != null
              ? Number(row.completion_pct)
              : row.enrolled > 0
                ? Math.round((Number(row.submitted ?? 0) / Number(row.enrolled)) * 100)
                : 0;

            return (
              <tr key={i} style={{ background: T.earthMid }}>
                <td style={{ ...td, fontWeight: 600, color: T.goldLight }}>
                  {row.timepoint ?? row.timepoint_label ?? '-'}
                </td>
                <td style={td}>{row.enrolled ?? '-'}</td>
                <td style={td}>{row.submitted ?? '-'}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '8px',
                        background: T.earthLight,
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          height: '100%',
                          background: barColor(pct),
                          borderRadius: '4px',
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.78rem', color: T.creamDim, minWidth: '32px' }}>
                      {pct}%
                    </span>
                  </div>
                </td>
                <td style={td}>
                  {fmt(row.phq9_mean)} {row.phq9_n != null ? <span style={{ color: T.creamMuted }}>(n={row.phq9_n})</span> : null}
                </td>
                <td style={td}>
                  {fmt(row.gad7_mean)} {row.gad7_n != null ? <span style={{ color: T.creamMuted }}>(n={row.gad7_n})</span> : null}
                </td>
                <td style={td}>{fmt(row.qol_mean)}</td>
                <td style={td}>{fmt(row.regulation_mean)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
