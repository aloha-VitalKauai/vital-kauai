const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#b8ac96',
  creamMuted: '#6e6558', goldDim: '#8a7250',
  rose: '#c4846a', sage: '#8fa882', amber: '#c9973a',
  borderLight: 'rgba(201,169,110,0.10)',
};

interface Props {
  responses: Record<string, any>;
  onUpdate: (field: string, value: any) => void;
  readOnly: boolean;
}

export function SafetyCheckStep({ responses, onUpdate, readOnly }: Props) {
  const hasAdverse = responses.adverse_event_flag === true;
  const needsSupport = responses.support_needed_now === true;

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        Wellbeing check
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        Your safety matters. Please let us know if anything concerning has come up.
      </p>

      {/* Adverse event flag */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Have you experienced any adverse or concerning effects?
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => !readOnly && onUpdate('adverse_event_flag', true)}
            disabled={readOnly}
            style={{
              flex: 1, padding: '0.65rem', border: `1px solid ${hasAdverse ? 'rgba(196,132,106,0.4)' : T.borderLight}`,
              borderRadius: 3, background: hasAdverse ? 'rgba(196,132,106,0.15)' : T.earthMid,
              color: hasAdverse ? T.rose : T.creamMuted,
              fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1,
            }}
          >Yes</button>
          <button
            onClick={() => !readOnly && onUpdate('adverse_event_flag', false)}
            disabled={readOnly}
            style={{
              flex: 1, padding: '0.65rem', border: `1px solid ${responses.adverse_event_flag === false ? 'rgba(143,168,130,0.4)' : T.borderLight}`,
              borderRadius: 3, background: responses.adverse_event_flag === false ? 'rgba(143,168,130,0.15)' : T.earthMid,
              color: responses.adverse_event_flag === false ? T.sage : T.creamMuted,
              fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1,
            }}
          >No</button>
        </div>
      </div>

      {/* Adverse event report (conditional) */}
      {hasAdverse && (
        <div style={{ marginBottom: '2rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(196,132,106,0.25)' }}>
          <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
            Please describe what happened
          </label>
          <textarea
            value={responses.adverse_event_member_report ?? ''}
            onChange={e => !readOnly && onUpdate('adverse_event_member_report', e.target.value)}
            disabled={readOnly}
            placeholder="Describe any adverse effects or concerns..."
            style={{
              width: '100%', minHeight: 100, padding: '0.85rem', resize: 'vertical',
              background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
              color: T.creamDim, fontFamily: "'Jost', sans-serif", fontSize: '0.88rem',
              lineHeight: 1.7, outline: 'none', opacity: readOnly ? 0.5 : 1,
            }}
          />
        </div>
      )}

      {/* Support needed now */}
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>
          Do you need support right now?
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => !readOnly && onUpdate('support_needed_now', true)}
            disabled={readOnly}
            style={{
              flex: 1, padding: '0.65rem', border: `1px solid ${needsSupport ? 'rgba(196,132,106,0.4)' : T.borderLight}`,
              borderRadius: 3, background: needsSupport ? 'rgba(196,132,106,0.15)' : T.earthMid,
              color: needsSupport ? T.rose : T.creamMuted,
              fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1,
            }}
          >Yes</button>
          <button
            onClick={() => !readOnly && onUpdate('support_needed_now', false)}
            disabled={readOnly}
            style={{
              flex: 1, padding: '0.65rem', border: `1px solid ${responses.support_needed_now === false ? 'rgba(143,168,130,0.4)' : T.borderLight}`,
              borderRadius: 3, background: responses.support_needed_now === false ? 'rgba(143,168,130,0.15)' : T.earthMid,
              color: responses.support_needed_now === false ? T.sage : T.creamMuted,
              fontFamily: "'Jost', sans-serif", fontSize: '0.85rem', fontWeight: 300,
              cursor: readOnly ? 'not-allowed' : 'pointer', opacity: readOnly ? 0.5 : 1,
            }}
          >No</button>
        </div>
      </div>

      {/* Safety notice */}
      <div style={{
        padding: '1rem 1.25rem', borderRadius: 3,
        background: 'rgba(201,151,58,0.08)', border: '1px solid rgba(201,151,58,0.2)',
        fontSize: '0.8rem', color: T.amber, lineHeight: 1.8,
      }}>
        If you indicate that you need support, your guide will be notified and will reach out to you. If you are in immediate danger, please contact emergency services.
      </div>
    </div>
  );
}
