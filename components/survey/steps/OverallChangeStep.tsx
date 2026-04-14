const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250', goldLight: '#dfc49a',
  borderLight: 'rgba(201,169,110,0.10)',
};

const CHANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'much_worse', label: 'Much worse' },
  { value: 'moderately_worse', label: 'Moderately worse' },
  { value: 'slightly_worse', label: 'Slightly worse' },
  { value: 'no_change', label: 'No change' },
  { value: 'slightly_improved', label: 'Slightly improved' },
  { value: 'moderately_improved', label: 'Moderately improved' },
  { value: 'much_improved', label: 'Much improved' },
];

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function OverallChangeStep({ responses, onUpdate, readOnly }: Props) {
  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Overall change
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Compared to before your session, how would you describe your overall state?
      </p>

      <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>
        Overall change <span style={{ color: T.creamMuted }}>*</span>
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {CHANGE_OPTIONS.map(opt => {
          const selected = responses.overall_change === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => !readOnly && onUpdate('overall_change', opt.value)}
              disabled={readOnly}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.7rem 1rem', borderRadius: 3,
                background: selected ? 'rgba(201,169,110,0.10)' : T.earthMid,
                border: `1px solid ${selected ? T.goldDim : T.borderLight}`,
                color: selected ? T.goldLight : T.creamMuted,
                fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
                cursor: readOnly ? 'not-allowed' : 'pointer',
                opacity: readOnly ? 0.5 : 1, textAlign: 'left',
              }}
            >
              <span style={{
                width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                border: `2px solid ${selected ? T.goldDim : T.borderLight}`,
                background: selected ? T.goldDim : 'transparent',
              }} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
