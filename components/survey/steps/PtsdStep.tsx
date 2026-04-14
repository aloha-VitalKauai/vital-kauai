const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function PtsdStep({ responses, onUpdate, readOnly }: Props) {
  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Trauma &amp; stress
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        If you have completed the PCL-5 checklist with your guide, enter your total score below.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          PCL-5 total score (0&ndash;80)
        </label>
        <input
          type="number"
          min={0}
          max={80}
          value={responses.pcl5_total ?? ''}
          onChange={e => !readOnly && onUpdate('pcl5_total', e.target.value ? parseInt(e.target.value, 10) : null)}
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

      <div style={{ padding: '1rem 1.25rem', background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3, fontSize: '0.8rem', color: T.creamMuted, lineHeight: 1.8 }}>
        The PCL-5 is a 20-item self-report measure of PTSD symptoms. Each item is rated 0&ndash;4, giving a total range of 0&ndash;80. A score of 31&ndash;33 or above suggests a provisional PTSD diagnosis. Your guide can help you complete this instrument if needed.
      </div>
    </div>
  );
}
