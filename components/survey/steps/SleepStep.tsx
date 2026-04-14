const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250', goldLight: '#dfc49a',
  borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function SleepStep({ responses, onUpdate, readOnly }: Props) {
  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Sleep
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        How has your sleep been recently?
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Sleep quality (1&ndash;10)
        </label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {[1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: responses.sleep_quality === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
              border: `1px solid ${responses.sleep_quality === n ? T.goldDim : T.borderLight}`,
              borderRadius: 2, fontSize: '0.8rem',
              color: responses.sleep_quality === n ? T.goldLight : T.creamMuted,
              cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              opacity: readOnly ? 0.4 : 1,
            }} onClick={() => !readOnly && onUpdate('sleep_quality', n)} disabled={readOnly}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Average hours of sleep
        </label>
        <input
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={responses.sleep_hours_avg ?? ''}
          onChange={e => !readOnly && onUpdate('sleep_hours_avg', e.target.value ? parseFloat(e.target.value) : null)}
          disabled={readOnly}
          placeholder="e.g. 7"
          style={{
            width: 120, padding: '0.6rem 0.75rem',
            background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
            color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
            outline: 'none', opacity: readOnly ? 0.5 : 1,
          }}
        />
      </div>
    </div>
  );
}
