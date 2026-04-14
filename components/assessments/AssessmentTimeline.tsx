import { CeremonyGroup } from '@/lib/assessments/getMemberAssessmentStatus';
import { AssessmentCard } from './AssessmentCard';

function fmtLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

interface Props {
  group: CeremonyGroup;
  showCeremonyHeader: boolean;
  cardStates: Record<string, { loading: boolean; error: string }>;
  onBegin: (timepoint: string, ceremonyId: string) => void;
  onContinue: (timepoint: string, ceremonyId: string, assessmentId: string) => void;
}

export function AssessmentTimeline({ group, showCeremonyHeader, cardStates, onBegin, onContinue }: Props) {
  return (
    <section style={{ marginBottom: '3rem' }} aria-label={`Assessments for ceremony on ${fmtLong(group.ceremony_date)}`}>
      {showCeremonyHeader && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.2rem', marginBottom: '2rem' }}>
          <span style={{ fontSize: '0.65rem', letterSpacing: '0.25em', textTransform: 'uppercase', color: '#6e6558' }}>Ceremony</span>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '0.95rem', color: '#b8ac96' }}>{fmtLong(group.ceremony_date)}</span>
          <span style={{ flex: 1, height: 1, background: 'rgba(201,169,110,0.10)' }} />
        </div>
      )}

      <div role="list" aria-label="Assessment timeline" style={{ position: 'relative', paddingLeft: '2.5rem' }}>
        <div style={{
          position: 'absolute', left: 7, top: 16, bottom: 16, width: 1,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(201,169,110,0.18) 8%, rgba(201,169,110,0.18) 92%, transparent 100%)',
        }} />

        {group.timepoints.map((row, i) => {
          const key = `${row.timepoint}:${row.ceremony_id}`;
          const cs = cardStates[key];
          return (
            <AssessmentCard
              key={row.timepoint}
              row={row}
              index={i}
              isLoading={cs?.loading}
              errorMessage={cs?.error}
              onBegin={onBegin}
              onContinue={onContinue}
            />
          );
        })}
      </div>
    </section>
  );
}
