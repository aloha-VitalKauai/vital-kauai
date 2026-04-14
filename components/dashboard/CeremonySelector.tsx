'use client';

import React from 'react';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  border: 'rgba(201,169,110,0.18)',
};

interface CeremonySelectorProps {
  ceremonies: { ceremony_id: string; ceremony_date: string }[];
  selected: string | null;
  onChange: (id: string) => void;
}

export function CeremonySelector({ ceremonies, selected, onChange }: CeremonySelectorProps) {
  return (
    <select
      value={selected ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: T.earthSurface,
        color: T.cream,
        border: `1px solid ${T.border}`,
        borderRadius: '6px',
        padding: '0.5rem 2rem 0.5rem 0.75rem',
        fontSize: '0.9rem',
        fontFamily: 'inherit',
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23c9a96e' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.75rem center',
        minWidth: '220px',
      }}
    >
      <option value="" style={{ background: T.earthMid, color: T.creamMuted }}>
        Select a ceremony...
      </option>
      {ceremonies.map((c) => (
        <option
          key={c.ceremony_id}
          value={c.ceremony_id}
          style={{ background: T.earthMid, color: T.cream }}
        >
          {new Date(c.ceremony_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </option>
      ))}
    </select>
  );
}
