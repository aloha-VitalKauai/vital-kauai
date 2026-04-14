import { AssessmentRow, AssessmentStatus } from '@/lib/assessments/getMemberAssessmentStatus';
import { TIMEPOINT_META } from '@/lib/assessments/timepointMeta';

// Design tokens from portal_assessments.html
const T = {
  earthMid:     '#2a2620',
  earthSurface: '#332e27',
  earthRaised:  '#3f3930',
  earthLight:   '#4a4338',
  gold:         '#c9a96e',
  goldLight:    '#dfc49a',
  goldDim:      '#8a7250',
  cream:        '#f2ead8',
  creamDim:     '#b8ac96',
  creamMuted:   '#6e6558',
  sage:         '#8fa882',
  sageDark:     '#4e7250',
  sageDeep:     '#3d5a3e',
  rose:         '#c4846a',
  roseDim:      '#7a4f3a',
  amber:        '#c9973a',
  border:       'rgba(201,169,110,0.18)',
  borderLight:  'rgba(201,169,110,0.10)',
  borderSage:   'rgba(143,168,130,0.35)',
  borderRose:   'rgba(196,132,106,0.40)',
};

const CHIP: Record<AssessmentStatus, { label: string; bg: string; color: string }> = {
  locked:    { label: 'Locked',      bg: 'rgba(110,101,88,0.25)',  color: T.creamMuted },
  available: { label: 'Open',        bg: 'rgba(201,169,110,0.15)', color: T.gold },
  overdue:   { label: 'Past due',    bg: 'rgba(196,132,106,0.18)', color: T.rose },
  draft:     { label: 'In progress', bg: 'rgba(143,168,130,0.18)', color: T.sage },
  completed: { label: 'Completed',   bg: 'rgba(78,114,80,0.25)',   color: T.sage },
  closed:    { label: 'Closed',      bg: 'rgba(110,101,88,0.15)',  color: T.creamMuted },
};

const DOT_STYLES: Record<AssessmentStatus, { bg: string; border: string }> = {
  locked:    { bg: T.earthSurface, border: T.earthLight },
  available: { bg: T.goldDim,      border: T.gold },
  overdue:   { bg: T.roseDim,      border: T.rose },
  draft:     { bg: T.sageDark,     border: T.sage },
  completed: { bg: T.sageDeep,     border: T.sage },
  closed:    { bg: T.earthSurface, border: T.earthLight },
};

const INNER_STYLES: Record<AssessmentStatus, React.CSSProperties> = {
  locked:    { opacity: 0.55 },
  available: { borderColor: T.border },
  overdue:   { borderColor: T.borderRose, background: 'rgba(196,132,106,0.04)' },
  draft:     { borderColor: T.borderSage, background: 'rgba(143,168,130,0.04)' },
  completed: { borderColor: T.borderSage },
  closed:    { opacity: 0.4 },
};

function fmtShort(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  row: AssessmentRow;
  index: number;
  isLoading?: boolean;
  errorMessage?: string;
  onBegin?: (timepoint: string, ceremonyId: string) => void;
  onContinue?: (timepoint: string, ceremonyId: string, assessmentId: string) => void;
}

// Score pill builder for completed cards
interface ScorePill { key: string; label: string; severity: 'good' | 'mild' | 'moderate' | 'severe' | 'neutral'; tooltip: string }

const PHQ9_DISPLAY: Record<string, { label: string; severity: ScorePill['severity'] }> = {
  none: { label: 'PHQ-9: None', severity: 'good' }, mild: { label: 'PHQ-9: Mild', severity: 'mild' },
  moderate: { label: 'PHQ-9: Moderate', severity: 'moderate' }, moderately_severe: { label: 'PHQ-9: Mod. severe', severity: 'severe' },
  severe: { label: 'PHQ-9: Severe', severity: 'severe' },
};
const GAD7_DISPLAY: Record<string, { label: string; severity: ScorePill['severity'] }> = {
  none: { label: 'GAD-7: None', severity: 'good' }, mild: { label: 'GAD-7: Mild', severity: 'mild' },
  moderate: { label: 'GAD-7: Moderate', severity: 'moderate' }, severe: { label: 'GAD-7: Severe', severity: 'severe' },
};
const CHANGE_DISPLAY: Record<string, { label: string; severity: ScorePill['severity'] }> = {
  much_worse: { label: 'Much worse', severity: 'severe' }, worse: { label: 'Somewhat worse', severity: 'severe' },
  slightly_worse: { label: 'Slightly worse', severity: 'moderate' }, no_change: { label: 'No change', severity: 'neutral' },
  slightly_improved: { label: 'Slightly improved', severity: 'mild' }, improved: { label: 'Improved', severity: 'good' },
  much_improved: { label: 'Much improved', severity: 'good' },
};

const PILL_COLORS: Record<string, { bg: string; color: string }> = {
  good:     { bg: 'rgba(78,114,80,0.2)',   color: T.sage },
  mild:     { bg: 'rgba(110,101,88,0.25)', color: T.creamMuted },
  moderate: { bg: 'rgba(201,151,58,0.18)', color: T.amber },
  severe:   { bg: 'rgba(196,132,106,0.18)', color: T.rose },
  neutral:  { bg: 'rgba(110,101,88,0.15)', color: T.creamMuted },
};

function buildScorePills(row: AssessmentRow): ScorePill[] {
  const pills: ScorePill[] = [];
  if (row.phq9_severity && PHQ9_DISPLAY[row.phq9_severity]) {
    const d = PHQ9_DISPLAY[row.phq9_severity];
    pills.push({ key: 'phq9', label: d.label, severity: d.severity, tooltip: `PHQ-9 total: ${row.phq9_total ?? '?'} / 27` });
  }
  if (row.gad7_severity && GAD7_DISPLAY[row.gad7_severity]) {
    const d = GAD7_DISPLAY[row.gad7_severity];
    pills.push({ key: 'gad7', label: d.label, severity: d.severity, tooltip: `GAD-7 total: ${row.gad7_total ?? '?'} / 21` });
  }
  if (row.overall_change && CHANGE_DISPLAY[row.overall_change]) {
    const d = CHANGE_DISPLAY[row.overall_change];
    pills.push({ key: 'overall', label: d.label, severity: d.severity, tooltip: 'Overall self-reported change since ceremony' });
  }
  return pills;
}

export function AssessmentCard({ row, index, isLoading, errorMessage, onBegin, onContinue }: Props) {
  const meta = TIMEPOINT_META[row.timepoint] ?? { label: row.timepoint_label, description: '' };

  // Completed cards get a dedicated layout
  if (row.status === 'completed') {
    const dot = DOT_STYLES.completed;
    const pills = buildScorePills(row);
    const submittedText = row.submitted_at
      ? `Submitted ${fmtShort(row.submitted_at)}${row.overdue_submission ? ' (late)' : ''}`
      : 'Submitted';

    return (
      <article style={{ position: 'relative', marginBottom: '1.25rem', animation: 'fadeUp 0.4s ease both', animationDelay: `${index * 0.07}s` }} role="listitem" aria-label={`${meta.label} \u2014 completed`}>
        <div style={{ position: 'absolute', left: '-2.5rem', top: '1.15rem', width: 15, height: 15, borderRadius: '50%', background: dot.bg, border: `1.5px solid ${dot.border}` }} />
        <div style={{ background: T.earthMid, border: `1px solid ${T.borderSage}`, borderRadius: 3, padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.6rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.3rem' }}>{meta.label}</p>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', fontWeight: 400, color: T.cream, lineHeight: 1.2, marginBottom: '0.45rem' }}>{meta.description}</p>
            <p style={{ fontSize: '0.72rem', color: T.sage, display: 'flex', alignItems: 'center', letterSpacing: '0.04em' }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: 'middle' }}><path d="M3 8.5L6.5 12L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {submittedText}
            </p>
            {pills.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: '0.55rem' }}>
                {pills.map(p => {
                  const c = PILL_COLORS[p.severity];
                  return <span key={p.key} title={p.tooltip} style={{ display: 'inline-block', fontSize: '0.6rem', letterSpacing: '0.1em', padding: '0.18rem 0.6rem', borderRadius: 2, whiteSpace: 'nowrap', cursor: 'default', background: c.bg, color: c.color }}>{p.label}</span>;
                })}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
            {row.assessment_id && (
              <a href={`/portal/assessments/${row.assessment_id}`} style={{ fontFamily: "'Jost', sans-serif", fontSize: '0.62rem', fontWeight: 400, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '0.4rem 0.9rem', borderRadius: 2, background: 'transparent', border: `1px solid ${T.earthLight}`, color: T.creamMuted, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                View &rarr;
              </a>
            )}
          </div>
        </div>
      </article>
    );
  }

  const chip = CHIP[row.status];
  const dot = DOT_STYLES[row.status];

  const metaLine = (() => {
    switch (row.status) {
      case 'locked':
        return row.window_open_at ? `Opens ${fmtShort(row.window_open_at)}` : null;
      case 'available':
        return [
          `Due ${fmtShort(row.window_due_at)}`,
          row.days_remaining != null ? `${row.days_remaining} days to complete` : null,
        ].filter(Boolean).join(' \u00B7 ');
      case 'overdue':
        return [
          `Was due ${fmtShort(row.window_due_at)}`,
          row.days_remaining != null ? `${row.days_remaining} days left to submit` : null,
        ].filter(Boolean).join(' \u00B7 ');
      case 'draft':
        return row.last_saved_at ? `Saved ${fmtShort(row.last_saved_at)}` : 'Draft in progress';
      case 'closed':
        return `Closed ${fmtShort(row.window_hard_close_at)}`;
      default:
        return null;
    }
  })();

  const metaColor: Record<string, string> = {
    available: T.creamDim, overdue: T.rose, draft: T.sage, completed: T.sage,
  };

  const btnBase: React.CSSProperties = {
    fontFamily: "'Jost', sans-serif", fontSize: '0.68rem', fontWeight: 400,
    letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0.55rem 1.2rem',
    borderRadius: 2, cursor: 'pointer', border: 'none', display: 'inline-flex',
    alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap',
  };

  const loadingStyle: React.CSSProperties = isLoading ? { opacity: 0.6, cursor: 'wait', pointerEvents: 'none' } : {};

  const cta = (() => {
    if (!row.is_editable || row.status === 'locked' || row.status === 'closed') {
      return (
        <button style={{ ...btnBase, background: 'transparent', border: `1px solid ${T.earthLight}`, color: T.creamMuted, opacity: 0.3, cursor: 'not-allowed' }} disabled>
          {row.status === 'locked' ? 'Not yet open' : 'Closed'}
        </button>
      );
    }
    if (row.status === 'available' || row.status === 'overdue') {
      const isOverdue = row.status === 'overdue';
      return (
        <button
          style={{ ...btnBase, ...loadingStyle, background: 'transparent', border: `1px solid ${isOverdue ? T.roseDim : T.goldDim}`, color: isOverdue ? T.rose : T.goldLight }}
          disabled={isLoading}
          onClick={() => onBegin?.(row.timepoint, row.ceremony_id)}
        >
          {isLoading ? 'Opening\u2026' : isOverdue ? 'Begin now' : 'Begin'} {!isLoading && '\u2192'}
        </button>
      );
    }
    if (row.status === 'draft' && row.assessment_id) {
      return (
        <button
          style={{ ...btnBase, ...loadingStyle, background: 'transparent', border: `1px solid ${T.goldDim}`, color: T.goldLight }}
          disabled={isLoading}
          onClick={() => onContinue?.(row.timepoint, row.ceremony_id, row.assessment_id!)}
        >
          {isLoading ? 'Opening\u2026' : 'Continue \u2192'}
        </button>
      );
    }
    return null;
  })();

  return (
    <article
      style={{ position: 'relative', marginBottom: '1.25rem', animation: `fadeUp 0.4s ease both`, animationDelay: `${index * 0.07}s` }}
      role="listitem"
      aria-label={`${meta.label} \u2014 ${row.status}`}
    >
      <div style={{
        position: 'absolute', left: '-2.5rem', top: '1.15rem', width: 15, height: 15,
        borderRadius: '50%', background: dot.bg, border: `1.5px solid ${dot.border}`,
      }} />
      <div style={{
        background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3,
        padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr auto',
        gap: '1rem', alignItems: 'center', ...INNER_STYLES[row.status],
      }}>
        <div>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.28em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.3rem' }}>{meta.label}</p>
          <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.25rem', fontWeight: 400, color: T.cream, lineHeight: 1.2, marginBottom: '0.5rem' }}>{meta.description}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.2rem', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', padding: '0.2rem 0.65rem', borderRadius: 2, background: chip.bg, color: chip.color, whiteSpace: 'nowrap' }}>
              {chip.label}
            </span>
            {metaLine && <span style={{ fontSize: '0.7rem', letterSpacing: '0.04em', color: metaColor[row.status] || T.creamMuted }}>{metaLine}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
          {cta}
        </div>
        {errorMessage && (
          <p role="alert" style={{
            gridColumn: '1 / -1', fontSize: '0.72rem', color: T.rose,
            marginTop: '0.65rem', padding: '0.5rem 0.75rem',
            borderLeft: `2px solid ${T.roseDim}`, background: 'rgba(196,132,106,0.06)',
            borderRadius: '0 2px 2px 0', lineHeight: 1.6,
          }}>
            {errorMessage}
          </p>
        )}
      </div>
    </article>
  );
}
