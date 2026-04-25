const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#d4c8ae',
  creamMuted: '#a89c84', goldDim: '#a4886a',
  borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
  timepoint: string;
}

export function NarrativeStep({ responses, onUpdate, readOnly, timepoint }: Props) {
  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Reflection
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Take a moment to reflect on what has stayed with you.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          What has lasted
        </label>
        <p style={{ fontSize: '0.78rem', color: T.creamMuted, marginBottom: '0.5rem' }}>
          What shifts or insights from your session have stayed with you?
        </p>
        <textarea
          value={responses.what_has_lasted ?? ''}
          onChange={e => !readOnly && onUpdate('what_has_lasted', e.target.value)}
          disabled={readOnly}
          placeholder="Share what has endured since your session..."
          style={{
            width: '100%', minHeight: 120, padding: '0.85rem', resize: 'vertical',
            background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
            color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
            lineHeight: 1.7, outline: 'none', opacity: readOnly ? 0.5 : 1,
          }}
        />
      </div>

      {timepoint === 'post_12m' && (
        <div>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
            Year reflection
          </label>
          <p style={{ fontSize: '0.78rem', color: T.creamMuted, marginBottom: '0.5rem' }}>
            Looking back over the past year, how has your journey unfolded?
          </p>
          <textarea
            value={responses.year_reflection ?? ''}
            onChange={e => !readOnly && onUpdate('year_reflection', e.target.value)}
            disabled={readOnly}
            placeholder="Reflect on the past year..."
            style={{
              width: '100%', minHeight: 140, padding: '0.85rem', resize: 'vertical',
              background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
              color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
              lineHeight: 1.7, outline: 'none', opacity: readOnly ? 0.5 : 1,
            }}
          />
        </div>
      )}
    </div>
  );
}
