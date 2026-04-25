const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#d4c8ae',
  creamMuted: '#a89c84', goldDim: '#a4886a', goldLight: '#dfc49a',
  borderLight: 'rgba(201,169,110,0.10)',
};

const SCALES: { field: string; label: string; description: string }[] = [
  { field: 'functioning_score', label: 'Functioning', description: 'How well are you able to carry out day-to-day activities?' },
  { field: 'emotional_intensity_score', label: 'Emotional intensity', description: 'How intense are your emotions overall?' },
  { field: 'support_score', label: 'Support', description: 'How supported do you feel in your life right now?' },
];

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function FunctioningStep({ responses, onUpdate, readOnly }: Props) {
  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Functioning
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Rate the following areas of your current experience.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {SCALES.map(scale => (
          <div key={scale.field}>
            <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.35rem' }}>
              {scale.label} (1&ndash;10)
            </label>
            <p style={{ fontSize: '0.78rem', color: T.creamMuted, marginBottom: '0.5rem' }}>
              {scale.description}
            </p>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {[1,2,3,4,5,6,7,8,9,10].map(n => (
                <button key={n} style={{
                  width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: responses[scale.field] === n ? 'rgba(201,169,110,0.12)' : T.earthMid,
                  border: `1px solid ${responses[scale.field] === n ? T.goldDim : T.borderLight}`,
                  borderRadius: 2, fontSize: '0.8rem',
                  color: responses[scale.field] === n ? T.goldLight : T.creamMuted,
                  cursor: readOnly ? 'not-allowed' : 'pointer', fontFamily: "'Jost', sans-serif",
                  opacity: readOnly ? 0.4 : 1,
                }} onClick={() => !readOnly && onUpdate(scale.field, n)} disabled={readOnly}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
