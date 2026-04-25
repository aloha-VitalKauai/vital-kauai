const T = {
  earthMid: '#2a2620', cream: '#f2ead8', creamDim: '#d4c8ae', creamMuted: '#a89c84',
  goldDim: '#a4886a', amber: '#c9973a', borderLight: 'rgba(201,169,110,0.10)',
};

const INTRO_COPY: Record<string, string> = {
  baseline:  'This is your before picture \u2014 taken before the ceremony so we have a meaningful baseline to compare against later. There are no right or wrong answers. Answer as honestly as you can.',
  post_72h:  'Three days after your ceremony. This is a short check-in focused on how you are stabilising, not a full assessment. Answer for how you\'ve been since the ceremony.',
  post_1m:   'One month has passed. This is the first full follow-up assessment \u2014 the earliest reliable picture of what has changed.',
  post_3m:   'Three months is the most predictive timepoint in iboga research. Your responses here are some of the most valuable data in your longitudinal record.',
  post_6m:   'Six months. Patterns still present at this point tend to persist. Patterns gone tend to stay gone.',
  post_12m:  'One year. The full story of what this experience produced in your life.',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  timepoint: string;
  windowDueAt: string | null;
  windowCloseAt: string | null;
}

export function IntroStep({ timepoint, windowDueAt, windowCloseAt }: Props) {
  const isOverdue = windowDueAt ? new Date() > new Date(windowDueAt) : false;

  return (
    <div>
      <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem', lineHeight: 1.2 }}>
        A few things to know
      </p>
      <p style={{ fontSize: '0.85rem', color: T.creamMuted, lineHeight: 1.85, maxWidth: 480, marginBottom: '2rem' }}>
        {INTRO_COPY[timepoint] ?? 'Take your time. Answer honestly.'}
      </p>

      <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
        {windowDueAt && (
          <div style={{ background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.creamMuted }}>Due date</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: isOverdue ? T.amber : T.creamDim, textAlign: 'right' }}>
              {fmtDate(windowDueAt)}
            </span>
          </div>
        )}
        {windowCloseAt && (
          <div style={{ background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3, padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem' }}>
            <span style={{ fontSize: '0.68rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: T.creamMuted }}>Last day to submit</span>
            <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', color: T.creamDim, textAlign: 'right' }}>
              {fmtDate(windowCloseAt)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
