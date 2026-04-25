const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#d4c8ae',
  creamMuted: '#a89c84', goldDim: '#a4886a', goldLight: '#dfc49a',
  borderLight: 'rgba(201,169,110,0.10)',
};

const LEVEL_OPTIONS: { value: string; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Patterns have not returned' },
  { value: 'slight', label: 'Slight', description: 'Noticed but manageable' },
  { value: 'moderate', label: 'Moderate', description: 'Noticeable and somewhat disruptive' },
  { value: 'strong', label: 'Strong', description: 'Significant return of old patterns' },
];

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function PatternsStep({ responses, onUpdate, readOnly }: Props) {
  const showIntensity = responses.pattern_return_level && responses.pattern_return_level !== 'none';

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Patterns &amp; practice
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Have any old patterns returned since your session?
      </p>

      {/* Pattern return level */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>
          Pattern return level
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LEVEL_OPTIONS.map(opt => {
            const selected = responses.pattern_return_level === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !readOnly && onUpdate('pattern_return_level', opt.value)}
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
                <div>
                  <span style={{ display: 'block' }}>{opt.label}</span>
                  <span style={{ fontSize: '0.72rem', color: T.creamMuted }}>{opt.description}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Pattern intensity (conditional) */}
      {showIntensity && (
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
            Pattern intensity (1&ndash;10)
          </label>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <button key={n} style={{
                width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: responses.pattern_intensity === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
                border: `1px solid ${responses.pattern_intensity === n ? T.goldDim : T.borderLight}`,
                borderRadius: 2, fontSize: '0.8rem',
                color: responses.pattern_intensity === n ? T.goldLight : T.creamMuted,
                cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
                opacity: readOnly ? 0.4 : 1,
              }} onClick={() => !readOnly && onUpdate('pattern_intensity', n)} disabled={readOnly}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Response to returned patterns */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Response to returned patterns (1&ndash;10)
        </label>
        <p style={{ fontSize: '0.78rem', color: T.creamMuted, marginBottom: '0.5rem' }}>
          How well have you been able to work with patterns when they arise?
        </p>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: responses.response_to_returned_patterns_score === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
              border: `1px solid ${responses.response_to_returned_patterns_score === n ? T.goldDim : T.borderLight}`,
              borderRadius: 2, fontSize: '0.8rem',
              color: responses.response_to_returned_patterns_score === n ? T.goldLight : T.creamMuted,
              cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              opacity: readOnly ? 0.4 : 1,
            }} onClick={() => !readOnly && onUpdate('response_to_returned_patterns_score', n)} disabled={readOnly}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Practice days */}
      <div>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Practice days this week (0&ndash;7)
        </label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {[0,1,2,3,4,5,6,7].map(n => (
            <button key={n} style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: responses.practice_days === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
              border: `1px solid ${responses.practice_days === n ? T.goldDim : T.borderLight}`,
              borderRadius: 2, fontSize: '0.8rem',
              color: responses.practice_days === n ? T.goldLight : T.creamMuted,
              cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              opacity: readOnly ? 0.4 : 1,
            }} onClick={() => !readOnly && onUpdate('practice_days', n)} disabled={readOnly}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
