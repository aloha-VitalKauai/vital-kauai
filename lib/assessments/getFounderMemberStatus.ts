import { SupabaseClient } from '@supabase/supabase-js';
import { AssessmentRow, CeremonyGroup } from './getMemberAssessmentStatus';

/**
 * Fetches a specific member's assessment timeline for founders.
 * Takes memberId directly — no auth→member resolution needed.
 */
export async function getFounderMemberStatus(
  supabase: SupabaseClient,
  memberId: string
): Promise<CeremonyGroup[]> {
  const { data, error } = await supabase
    .from('member_assessment_status')
    .select(
      'ceremony_id,ceremony_date,ceremony_status,timepoint,timepoint_label,' +
      'sort_order,status,is_editable,is_overdue_window,days_remaining,' +
      'window_open_at,window_due_at,window_hard_close_at,' +
      'assessment_id,started_at,last_saved_at,submitted_at,overdue_submission,' +
      'phq9_total,phq9_severity,gad7_total,gad7_severity,' +
      'qol_total,overall_change,regulation_score,pcl5_severity'
    )
    .eq('member_id', memberId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);

  const map = new Map<string, CeremonyGroup>();
  for (const row of (data ?? []) as unknown as AssessmentRow[]) {
    if (!map.has(row.ceremony_id)) {
      map.set(row.ceremony_id, {
        ceremony_id: row.ceremony_id,
        ceremony_date: row.ceremony_date,
        ceremony_status: row.ceremony_status,
        timepoints: [],
      });
    }
    map.get(row.ceremony_id)!.timepoints.push(row);
  }

  return [...map.values()].sort(
    (a, b) => new Date(a.ceremony_date).getTime() - new Date(b.ceremony_date).getTime()
  );
}
