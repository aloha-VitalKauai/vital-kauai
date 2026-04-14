const T = {
  earthMid: '#2a2620', earthSurface: '#332e27', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250', goldLight: '#dfc49a',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
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

export function StabilisationStep({ responses, onUpdate, readOnly }: Props) {
  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        How you&apos;re landing
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Compared to before your session, how would you describe your overall state?
      </p>

      {/* Overall change */}
      <div style={{ marginBottom: '2.5rem' }}>
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

      {/* Regulation score */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Regulation score (1&ndash;10) <span style={{ color: T.creamMuted }}>*</span>
        </label>
        <p style={{ fontSize: '0.78rem', color: T.creamMuted, marginBottom: '0.5rem' }}>
          How well are you able to regulate your emotions right now?
        </p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: responses.regulation_score === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
              border: `1px solid ${responses.regulation_score === n ? T.goldDim : T.borderLight}`,
              borderRadius: 2, fontSize: '0.8rem',
              color: responses.regulation_score === n ? T.goldLight : T.creamMuted,
              cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              opacity: readOnly ? 0.4 : 1,
            }} onClick={() => !readOnly && onUpdate('regulation_score', n)} disabled={readOnly}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Emotional intensity */}
      <div>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Emotional intensity (1&ndash;10) <span style={{ color: T.creamMuted }}>*</span>
        </label>
        <p style={{ fontSize: '0.78rem', color: T.creamMuted, marginBottom: '0.5rem' }}>
          How intense are your emotions right now?
        </p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: responses.emotional_intensity_score === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
              border: `1px solid ${responses.emotional_intensity_score === n ? T.goldDim : T.borderLight}`,
              borderRadius: 2, fontSize: '0.8rem',
              color: responses.emotional_intensity_score === n ? T.goldLight : T.creamMuted,
              cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              opacity: readOnly ? 0.4 : 1,
            }} onClick={() => !readOnly && onUpdate('emotional_intensity_score', n)} disabled={readOnly}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
