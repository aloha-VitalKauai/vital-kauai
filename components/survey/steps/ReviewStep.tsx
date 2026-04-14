const T = {
  earthMid: '#2a2620', earthLight: '#4a4338', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250', borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  responses: Record<string, number | null | string | undefined>;
}

export function ReviewStep({ responses }: Props) {
  const scores = [1,2,3,4,5,6,7,8,9].map(n => responses[`phq9_q${n}`] as number | null);
  const total = scores.reduce<number>((s, v) => s + (v ?? 0), 0);
  const allDone = scores.every(v => v !== null && v !== undefined);

  const severity =
    total <= 4  ? 'Minimal'            :
    total <= 9  ? 'Mild'               :
    total <= 14 ? 'Moderate'           :
    total <= 19 ? 'Moderately severe'  : 'Severe';

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Review your responses
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Check your answers before submitting. Your draft has been saved automatically.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.85rem' }}>
          PHQ-9 &mdash; Depression
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', borderBottom: `1px solid ${T.borderLight}`, gap: '1rem' }}>
          <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>Score</span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: allDone ? T.creamDim : T.earthLight, textAlign: 'right', ...(!allDone && { fontFamily: "'Jost', sans-serif", fontSize: '0.75rem' }) }}>
            {allDone ? `${total} / 27` : 'Not completed'}
          </span>
        </div>
        {allDone && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0.6rem 0', gap: '1rem' }}>
            <span style={{ fontSize: '0.78rem', color: T.creamMuted, flex: 1 }}>Severity</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1rem', color: T.creamDim, textAlign: 'right' }}>{severity}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '1rem 1.25rem', background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3, fontSize: '0.8rem', color: T.creamMuted, lineHeight: 1.8 }}>
        Additional instruments will appear here in later steps once the full battery is built. Submission is implemented in Ticket 4.
      </div>
    </div>
  );
}
