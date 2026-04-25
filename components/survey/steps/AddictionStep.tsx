const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#d4c8ae',
  creamMuted: '#a89c84', goldDim: '#a4886a', goldLight: '#dfc49a',
  rose: '#c4846a', sage: '#8fa882',
  borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function AddictionStep({ responses, onUpdate, readOnly }: Props) {
  const relapseOccurred = responses.relapse_occurred === true;

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Substance use
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        This section helps us track your relationship with substances over time.
      </p>

      {/* Primary substance */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Primary substance
        </label>
        <input
          type="text"
          value={responses.primary_substance ?? ''}
          onChange={e => !readOnly && onUpdate('primary_substance', e.target.value)}
          disabled={readOnly}
          placeholder="e.g. Alcohol, cannabis, opioids..."
          style={{
            width: '100%', padding: '0.6rem 0.75rem',
            background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
            color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
            outline: 'none', opacity: readOnly ? 0.5 : 1,
          }}
        />
      </div>

      {/* Craving intensity */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Craving intensity (0&ndash;10) <span style={{ color: T.creamMuted }}>*</span>
        </label>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
          {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
            <button key={n} style={{
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: responses.craving_intensity === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
              border: `1px solid ${responses.craving_intensity === n ? T.goldDim : T.borderLight}`,
              borderRadius: 2, fontSize: '0.8rem',
              color: responses.craving_intensity === n ? T.goldLight : T.creamMuted,
              cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
              opacity: readOnly ? 0.4 : 1,
            }} onClick={() => !readOnly && onUpdate('craving_intensity', n)} disabled={readOnly}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Days abstinent */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Days abstinent <span style={{ color: T.creamMuted }}>*</span>
        </label>
        <input
          type="number"
          min={0}
          value={responses.days_abstinent ?? ''}
          onChange={e => !readOnly && onUpdate('days_abstinent', e.target.value ? parseInt(e.target.value, 10) : null)}
          disabled={readOnly}
          placeholder="Number of days"
          style={{
            width: 140, padding: '0.6rem 0.75rem',
            background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
            color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
            outline: 'none', opacity: readOnly ? 0.5 : 1,
          }}
        />
      </div>

      {/* Relapse occurred */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Relapse occurred
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => !readOnly && onUpdate('relapse_occurred', true)}
            disabled={readOnly}
            style={{
              flex: 1, padding: '0.65rem', border: `1px solid ${relapseOccurred ? 'rgba(196,132,106,0.4)' : T.borderLight}`,
              borderRadius: 3, background: relapseOccurred ? 'rgba(196,132,106,0.15)' : T.earthMid,
              color: relapseOccurred ? T.rose : T.creamMuted,
              fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1,
            }}
          >Yes</button>
          <button
            onClick={() => !readOnly && onUpdate('relapse_occurred', false)}
            disabled={readOnly}
            style={{
              flex: 1, padding: '0.65rem', border: `1px solid ${responses.relapse_occurred === false ? 'rgba(143,168,130,0.4)' : T.borderLight}`,
              borderRadius: 3, background: responses.relapse_occurred === false ? 'rgba(143,168,130,0.15)' : T.earthMid,
              color: responses.relapse_occurred === false ? T.sage : T.creamMuted,
              fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1,
            }}
          >No</button>
        </div>
      </div>

      {/* Conditional relapse fields */}
      {relapseOccurred && (
        <div style={{ paddingLeft: '1rem', borderLeft: `2px solid rgba(196,132,106,0.25)`, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
              Relapse date
            </label>
            <input
              type="date"
              value={responses.relapse_date ?? ''}
              onChange={e => !readOnly && onUpdate('relapse_date', e.target.value || null)}
              disabled={readOnly}
              style={{
                padding: '0.6rem 0.75rem',
                background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
                color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
                outline: 'none', opacity: readOnly ? 0.5 : 1,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
              Relapse substance
            </label>
            <input
              type="text"
              value={responses.relapse_substance ?? ''}
              onChange={e => !readOnly && onUpdate('relapse_substance', e.target.value)}
              disabled={readOnly}
              placeholder="Which substance?"
              style={{
                width: '100%', padding: '0.6rem 0.75rem',
                background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
                color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
                outline: 'none', opacity: readOnly ? 0.5 : 1,
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
              Days used (past 30)
            </label>
            <input
              type="number"
              min={0}
              max={30}
              value={responses.days_used_past_30 ?? ''}
              onChange={e => !readOnly && onUpdate('days_used_past_30', e.target.value ? parseInt(e.target.value, 10) : null)}
              disabled={readOnly}
              placeholder="0"
              style={{
                width: 120, padding: '0.6rem 0.75rem',
                background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
                color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
                outline: 'none', opacity: readOnly ? 0.5 : 1,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
