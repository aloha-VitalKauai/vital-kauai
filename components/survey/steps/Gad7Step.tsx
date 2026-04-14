const T = {
  earthMid: '#2a2620', earthSurface: '#332e27', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250', goldLight: '#dfc49a',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
};

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
];

const OPTIONS = [
  { score: 0, label: 'Not at all' },
  { score: 1, label: 'Several days' },
  { score: 2, label: 'More than half the days' },
  { score: 3, label: 'Nearly every day' },
];

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function Gad7Step({ responses, onUpdate, readOnly }: Props) {
  const scores = GAD7_QUESTIONS.map((_, i) => responses[`gad7_q${i + 1}`] ?? null);
  const answered = scores.filter(s => s !== null).length;
  const total = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
  const allDone = answered === 7;

  function handleSelect(questionIdx: number, score: number) {
    const field = `gad7_q${questionIdx + 1}`;
    onUpdate(field, score);

    const next = [...scores];
    next[questionIdx] = score;
    if (next.every(s => s !== null)) {
      const sum = next.reduce<number>((a, b) => a + (b ?? 0), 0);
      onUpdate('gad7_total', sum);
    }
  }

  const btnStyle = (selected: boolean): React.CSSProperties => ({
    background: selected ? 'rgba(201,169,110,0.12)' : T.earthMid,
    border: `1px solid ${selected ? T.goldDim : T.borderLight}`,
    borderRadius: 2, padding: '0.55rem 0.4rem', cursor: readOnly ? 'not-allowed' : 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem',
    color: selected ? T.goldLight : T.creamMuted,
    fontFamily: "'Jost', sans-serif", fontSize: '0.65rem', fontWeight: 300,
    letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.3,
    opacity: readOnly ? 0.5 : 1,
  });

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Anxiety
      </p>
      <p style={{ fontSize: '0.78rem', color: T.creamMuted, lineHeight: 1.85, borderLeft: `2px solid ${T.border}`, paddingLeft: '1rem', marginBottom: '2rem', fontStyle: 'italic' }}>
        Over the <strong style={{ color: T.creamDim }}>last 2 weeks</strong>, how often have you been bothered by the following problems?
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }} role="list">
        {GAD7_QUESTIONS.map((question, idx) => (
          <div key={idx} role="listitem">
            <span style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, display: 'block', marginBottom: '0.3rem' }}>
              Question {idx + 1} of 7
            </span>
            <p style={{ fontSize: '0.92rem', color: T.creamDim, lineHeight: 1.7, marginBottom: '0.85rem' }}>{question}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }} role="radiogroup" aria-label={`Question ${idx + 1} answer`}>
              {OPTIONS.map(opt => (
                <button
                  key={opt.score}
                  style={btnStyle(scores[idx] === opt.score)}
                  onClick={() => !readOnly && handleSelect(idx, opt.score)}
                  disabled={readOnly}
                  aria-pressed={scores[idx] === opt.score}
                  aria-label={`${opt.label} \u2014 score ${opt.score}`}
                >
                  <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 400, lineHeight: 1 }}>{opt.score}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '2rem', paddingTop: '1.5rem', borderTop: `1px solid ${T.borderLight}` }}>
        <span style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.creamMuted }}>GAD-7 score</span>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: T.creamDim }}>
          {allDone ? total : answered > 0 ? `${total}+` : '\u2014'}
        </span>
        <span style={{ fontSize: '0.75rem', color: T.creamMuted }}>/ 21</span>
      </div>
    </div>
  );
}
