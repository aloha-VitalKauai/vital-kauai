'use client';

import React, { useState } from 'react';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
};

interface DashboardPanelProps {
  title: string;
  badge?: { count: number; color: string };
  children: React.ReactNode;
}

export function DashboardPanel({ title, badge, children }: DashboardPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      style={{
        background: T.earthMid,
        border: `1px solid ${T.border}`,
        borderRadius: '8px',
        marginBottom: '1.25rem',
        overflow: 'hidden',
      }}
    >
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: T.earthSurface,
          cursor: 'pointer',
          userSelect: 'none',
          borderBottom: collapsed ? 'none' : `1px solid ${T.borderLight}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span
            style={{
              color: T.creamMuted,
              fontSize: '0.75rem',
              transition: 'transform 0.2s',
              transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}
          >
            &#9660;
          </span>
          <span style={{ color: T.cream, fontSize: '0.95rem', fontWeight: 600, letterSpacing: '0.02em' }}>
            {title}
          </span>
          {badge && badge.count > 0 && (
            <span
              style={{
                background: badge.color,
                color: T.earth,
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.125rem 0.5rem',
                borderRadius: '10px',
                lineHeight: '1.4',
              }}
            >
              {badge.count}
            </span>
          )}
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: '0.75rem 1rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}
