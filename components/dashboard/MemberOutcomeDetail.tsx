'use client';

import { AssessmentRow, CeremonyGroup } from '@/lib/assessments/getMemberAssessmentStatus';

const T = {
  earth: '#1a1712', earthMid: '#2a2620', earthSurface: '#332e27', earthLight: '#4a4338',
  gold: '#c9a96e', goldDim: '#8a7250', goldLight: '#dfc49a',
  cream: '#f2ead8', creamDim: '#b8ac96', creamMuted: '#6e6558',
  sage: '#8fa882', sageDark: '#4e7250', sageDeep: '#3d5a3e',
  rose: '#c4846a', roseDim: '#7a4f3a', amber: '#c9973a',
  border: 'rgba(201,169,110,0.18)', borderLight: 'rgba(201,169,110,0.10)',
  borderSage: 'rgba(143,168,130,0.35)',
};

interface MemberInfo {
  id: string;
  full_name: string;
  assigned_partner?: string;
  ceremony_date?: string;
  phq9_delta?: number | null;
  gad7_delta?: number | null;
  phq9_response_class?: string | null;
  baseline_phq9?: number | null;
  latest_phq9?: number | null;
  baseline_gad7?: number | null;
  latest_gad7?: number | null;
}

interface Props {
  member: MemberInfo;
  ceremonies: CeremonyGroup[];
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

function deltaColor(d: number | null | undefined): string {
  if (d == null) return T.creamMuted;
  if (d < -3) return T.sage;
  if (d > 3) return T.rose;
  return T.creamMuted;
}

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  none: { bg: 'rgba(78,114,80,0.2)', color: T.sage },
  mild: { bg: 'rgba(110,101,88,0.25)', color: T.creamMuted },
  moderate: { bg: 'rgba(201,151,58,0.18)', color: T.amber },
  moderately_severe: { bg: 'rgba(196,132,106,0.18)', color: T.rose },
  severe: { bg: 'rgba(196,132,106,0.18)', color: T.rose },
};

const CHANGE_LABELS: Record<string, string> = {
  much_worse: 'Much worse', worse: 'Somewhat worse', slightly_worse: 'Slightly worse',
  no_change: 'No change', slightly_improved: 'Slightly improved',
  improved: 'Improved', much_improved: 'Much improved',
};

const STATUS_COLORS: Record<string, { dotBg: string; dotBorder: string; border: string }> = {
  locked:    { dotBg: T.earthSurface, dotBorder: T.earthLight, border: T.borderLight },
  available: { dotBg: T.goldDim, dotBorder: T.gold, border: T.border },
  overdue:   { dotBg: T.roseDim, dotBorder: T.rose, border: 'rgba(196,132,106,0.40)' },
  draft:     { dotBg: T.sageDark, dotBorder: T.sage, border: T.borderSage },
  completed: { dotBg: T.sageDeep, dotBorder: T.sage, border: T.borderSage },
  closed:    { dotBg: T.earthSurface, dotBorder: T.earthLight, border: T.borderLight },
};

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  locked:    { label: 'Locked', bg: 'rgba(110,101,88,0.25)', color: T.creamMuted },
  available: { label: 'Open', bg: 'rgba(201,169,110,0.15)', color: T.gold },
  overdue:   { label: 'Past due', bg: 'rgba(196,132,106,0.18)', color: T.rose },
  draft:     { label: 'In progress', bg: 'rgba(143,168,130,0.18)', color: T.sage },
  completed: { label: 'Completed', bg: 'rgba(78,114,80,0.25)', color: T.sage },
  closed:    { label: 'Closed', bg: 'rgba(110,101,88,0.15)', color: T.creamMuted },
};

export function MemberOutcomeDetail({ member, ceremonies }: Props) {
  const scoreCard = (label: string, baseline: number | null | undefined, latest: number | null | undefined, delta: number | null | undefined, max: number) => (
    <div style={{ background: T.earthMid, border: `1px solid ${T.borderLight}`, borderRadius: 3, padding: '1rem 1.25rem', flex: 1, minWidth: 140 }}>
      <p style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.4rem', color: T.cream }}>{latest ?? '\u2014'}</span>
        <span style={{ fontSize: '0.7rem', color: T.creamMuted }}>/ {max}</span>
      </div>
      {baseline != null && latest != null && delta != null && (
        <p style={{ fontSize: '0.7rem', color: deltaColor(delta), marginTop: '0.3rem' }}>
          {delta > 0 ? '+' : ''}{delta} from baseline ({baseline})
        </p>
      )}
    </div>
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem' }}>
      {/* Back link */}
      <a href="/founders/outcomes" style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: T.creamMuted, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '2rem' }}>
        &larr; Back to dashboard
      </a>

      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <p style={{ fontSize: '0.62rem', letterSpacing: '0.3em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.5rem' }}>Member Outcomes</p>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.2rem', fontWeight: 300, color: T.cream, marginBottom: '0.5rem' }}>{member.full_name}</h1>
        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: T.creamMuted }}>
          {member.assigned_partner && <span>Guide: {member.assigned_partner}</span>}
          {member.ceremony_date && <span>Ceremony: {fmtDate(member.ceremony_date)}</span>}
          {member.phq9_response_class && (
            <span style={{ padding: '0.1rem 0.5rem', borderRadius: 2, background: member.phq9_response_class === 'remission' || member.phq9_response_class === 'responder' ? 'rgba(78,114,80,0.25)' : 'rgba(110,101,88,0.2)', color: member.phq9_response_class === 'remission' || member.phq9_response_class === 'responder' ? T.sage : T.creamMuted, fontSize: '0.62rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {member.phq9_response_class.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Score summary cards */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
        {scoreCard('PHQ-9', member.baseline_phq9, member.latest_phq9, member.phq9_delta, 27)}
        {scoreCard('GAD-7', member.baseline_gad7, member.latest_gad7, member.gad7_delta, 21)}
      </div>

      {/* Assessment timeline per ceremony */}
      {ceremonies.length === 0 ? (
        <div style={{ padding: '3rem 2rem', textAlign: 'center', border: `1px solid ${T.borderLight}`, borderRadius: 3, background: T.earthMid }}>
          <p style={{ fontSize: '0.85rem', color: T.creamMuted }}>No assessments found for this member.</p>
        </div>
      ) : (
        ceremonies.map(group => (
          <div key={group.ceremony_id} style={{ marginBottom: '2.5rem' }}>
            {ceremonies.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: T.creamMuted }}>Ceremony</span>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', color: T.creamDim }}>{fmtLong(group.ceremony_date)}</span>
                <span style={{ flex: 1, height: 1, background: T.borderLight }} />
              </div>
            )}

            {/* Timeline */}
            <div style={{ position: 'relative', paddingLeft: '2.5rem' }}>
              <div style={{ position: 'absolute', left: 7, top: 16, bottom: 16, width: 1, background: `linear-gradient(to bottom, transparent 0%, ${T.border} 8%, ${T.border} 92%, transparent 100%)` }} />

              {group.timepoints.map((row) => {
                const sc = STATUS_COLORS[row.status] || STATUS_COLORS.locked;
                const sl = STATUS_LABELS[row.status] || STATUS_LABELS.locked;

                return (
                  <div key={row.timepoint} style={{ position: 'relative', marginBottom: '1rem' }}>
                    {/* Dot */}
                    <div style={{ position: 'absolute', left: '-2.5rem', top: '1rem', width: 13, height: 13, borderRadius: '50%', background: sc.dotBg, border: `1.5px solid ${sc.dotBorder}` }} />

                    {/* Card */}
                    <div style={{
                      background: T.earthMid, border: `1px solid ${sc.border}`, borderRadius: 3,
                      padding: '1rem 1.25rem', display: 'grid', gridTemplateColumns: '1fr auto',
                      gap: '0.75rem', alignItems: 'center',
                      opacity: row.status === 'locked' || row.status === 'closed' ? 0.5 : 1,
                    }}>
                      <div>
                        <p style={{ fontSize: '0.58rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: T.goldDim, marginBottom: '0.2rem' }}>{row.timepoint_label || row.timepoint.replace(/_/g, ' ')}</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', padding: '0.15rem 0.5rem', borderRadius: 2, background: sl.bg, color: sl.color }}>{sl.label}</span>

                          {row.status === 'completed' && row.submitted_at && (
                            <span style={{ fontSize: '0.68rem', color: T.sage }}>
                              Submitted {fmtDate(row.submitted_at)}{row.overdue_submission ? ' (late)' : ''}
                            </span>
                          )}

                          {row.status === 'completed' && <ScoreRow row={row} />}
                        </div>
                      </div>

                      {row.status === 'completed' && row.assessment_id && (
                        <a href={`/portal/assessments/${row.assessment_id}`} style={{
                          fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase',
                          color: T.creamMuted, textDecoration: 'none', border: `1px solid ${T.earthLight}`,
                          padding: '0.35rem 0.75rem', borderRadius: 2,
                        }}>
                          View &rarr;
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ScoreRow({ row }: { row: AssessmentRow }) {
  const pills: { label: string; bg: string; color: string }[] = [];

  if (row.phq9_severity && SEVERITY_COLORS[row.phq9_severity]) {
    const c = SEVERITY_COLORS[row.phq9_severity];
    pills.push({ label: `PHQ-9: ${row.phq9_total ?? '?'}`, ...c });
  }
  if (row.gad7_severity && SEVERITY_COLORS[row.gad7_severity]) {
    const c = SEVERITY_COLORS[row.gad7_severity];
    pills.push({ label: `GAD-7: ${row.gad7_total ?? '?'}`, ...c });
  }
  if (row.qol_total != null) {
    pills.push({ label: `QoL: ${row.qol_total}`, bg: 'rgba(110,101,88,0.2)', color: T.creamMuted });
  }
  if (row.overall_change && CHANGE_LABELS[row.overall_change]) {
    pills.push({ label: CHANGE_LABELS[row.overall_change], bg: 'rgba(110,101,88,0.15)', color: T.creamMuted });
  }

  if (!pills.length) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: '0.3rem' }}>
      {pills.map((p, i) => (
        <span key={i} style={{ fontSize: '0.55rem', letterSpacing: '0.08em', padding: '0.12rem 0.5rem', borderRadius: 2, background: p.bg, color: p.color, whiteSpace: 'nowrap' }}>{p.label}</span>
      ))}
    </div>
  );
}
