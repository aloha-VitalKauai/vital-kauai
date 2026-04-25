const T = {
  earthMid: '#2a2620', earthSurface: '#332e27', cream: '#f2ead8', creamDim: '#d4c8ae',
  creamMuted: '#a89c84', gold: '#c9a96e', goldDim: '#a4886a', goldLight: '#dfc49a',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
};

const SYMPTOM_OPTIONS = [
  'Anxiety / worry', 'Depression / low mood', 'Grief / loss', 'Trauma / PTSD',
  'Addiction', 'Anger / reactivity', 'Relationship patterns', 'Chronic pain',
  'Sleep problems', 'Fatigue / burnout', 'Spiritual seeking', 'Life direction',
  'Autism / neurodivergence', 'Chronic illness', 'Other',
];

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function IntentionStep({ responses, onUpdate, readOnly }: Props) {
  const selected: string[] = [
    responses.top_symptom_1,
    responses.top_symptom_2,
    responses.top_symptom_3,
  ].filter(Boolean);

  function handleChipToggle(symptom: string) {
    if (readOnly) return;
    const idx = selected.indexOf(symptom);
    let next: string[];
    if (idx >= 0) {
      next = selected.filter(s => s !== symptom);
    } else {
      if (selected.length >= 3) return;
      next = [...selected, symptom];
    }
    onUpdate('top_symptom_1', next[0] ?? null);
    onUpdate('top_symptom_2', next[1] ?? null);
    onUpdate('top_symptom_3', next[2] ?? null);
  }

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Your intention
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        What brings you here? Share as much or as little as feels right.
      </p>

      <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
        Primary intention <span style={{ color: T.creamMuted }}>*</span>
      </label>
      <textarea
        value={responses.primary_intention ?? ''}
        onChange={e => !readOnly && onUpdate('primary_intention', e.target.value)}
        disabled={readOnly}
        placeholder="What are you hoping to explore, heal, or understand?"
        style={{
          width: '100%', minHeight: 120, padding: '0.85rem', resize: 'vertical',
          background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
          color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
          lineHeight: 1.7, outline: 'none', opacity: readOnly ? 0.5 : 1,
        }}
      />

      <div style={{ marginTop: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.75rem' }}>
          Top areas of focus <span style={{ color: T.creamMuted }}>(choose up to 3)</span>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {SYMPTOM_OPTIONS.map(symptom => {
            const isSelected = selected.includes(symptom);
            return (
              <button
                key={symptom}
                onClick={() => handleChipToggle(symptom)}
                disabled={readOnly}
                style={{
                  padding: '0.45rem 0.85rem', borderRadius: 999,
                  background: isSelected ? 'rgba(201,169,110,0.15)' : T.earthMid,
                  border: `1px solid ${isSelected ? T.goldDim : T.borderLight}`,
                  color: isSelected ? T.goldLight : T.creamMuted,
                  fontFamily: "'Jost', sans-serif", fontSize: '0.78rem', fontWeight: 300,
                  cursor: readOnly ? 'not-allowed' : (selected.length >= 3 && !isSelected ? 'not-allowed' : 'pointer'),
                  opacity: readOnly ? 0.5 : (selected.length >= 3 && !isSelected ? 0.4 : 1),
                  letterSpacing: '0.02em',
                }}
              >
                {symptom}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
