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
  onBegin?: (timepoint: string, ceremonyId: string) => void;
  onContinue?: (timepoint: string, ceremonyId: string, assessmentId: string) => void;
}

export function AssessmentCard({ row, index, onBegin, onContinue }: Props) {
  const meta = TIMEPOINT_META[row.timepoint] ?? { label: row.timepoint_label, description: '' };
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
      case 'completed':
        return row.submitted_at ? `Submitted ${fmtShort(row.submitted_at)}` : 'Submitted';
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
          style={{ ...btnBase, background: 'transparent', border: `1px solid ${isOverdue ? T.roseDim : T.goldDim}`, color: isOverdue ? T.rose : T.goldLight }}
          onClick={() => onBegin?.(row.timepoint, row.ceremony_id)}
        >
          {isOverdue ? 'Begin now' : 'Begin'} \u2192
        </button>
      );
    }
    if (row.status === 'draft' && row.assessment_id) {
      return (
        <button
          style={{ ...btnBase, background: 'transparent', border: `1px solid ${T.goldDim}`, color: T.goldLight }}
          onClick={() => onContinue?.(row.timepoint, row.ceremony_id, row.assessment_id!)}
        >
          Continue \u2192
        </button>
      );
    }
    if (row.status === 'completed') {
      return (
        <button style={{ ...btnBase, background: 'transparent', border: `1px solid ${T.borderSage}`, color: T.sage }}>
          View summary
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
      </div>
    </article>
  );
}
