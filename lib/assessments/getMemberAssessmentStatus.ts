import { SupabaseClient } from '@supabase/supabase-js';

export type AssessmentStatus =
  | 'locked'
  | 'available'
  | 'overdue'
  | 'draft'
  | 'completed'
  | 'closed';

export interface AssessmentRow {
  ceremony_id: string;
  ceremony_date: string;
  ceremony_status: string;
  timepoint: string;
  timepoint_label: string;
  sort_order: number;
  status: AssessmentStatus;
  is_editable: boolean;
  is_overdue_window: boolean;
  days_remaining: number | null;
  window_open_at: string;
  window_due_at: string;
  window_hard_close_at: string;
  assessment_id: string | null;
  started_at: string | null;
  last_saved_at: string | null;
  submitted_at: string | null;
  overdue_submission: boolean | null;
  // Score summary — non-null only when status === 'completed'
  phq9_total: number | null;
  phq9_severity: string | null;
  gad7_total: number | null;
  gad7_severity: string | null;
  qol_total: number | null;
  overall_change: string | null;
  regulation_score: number | null;
  pcl5_total: number | null;
  pcl5_severity: string | null;
}

export interface CeremonyGroup {
  ceremony_id: string;
  ceremony_date: string;
  ceremony_status: string;
  timepoints: AssessmentRow[];
}

export async function getMemberAssessmentStatus(
  supabase: SupabaseClient,
  authUserId: string
): Promise<CeremonyGroup[]> {
  // Step 1: resolve operational member_id from auth user
  // (auth.users.id \u2260 members.id \u2014 they are linked by email)
  const { data: memberId, error: memberErr } = await supabase
    .rpc('get_member_id_from_auth', { p_auth_user_id: authUserId });

  if (memberErr || !memberId) {
    throw new Error(memberErr?.message ?? 'No member record found for this account.');
  }

  // Step 2: fetch server-computed rows \u2014 DO NOT compute status client-side
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

  // Group by ceremony_id \u2014 supports multiple ceremonies from day one
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

  // Sort ceremonies by date ascending; timepoints already sorted by sort_order
  return [...map.values()].sort(
    (a, b) => new Date(a.ceremony_date).getTime() - new Date(b.ceremony_date).getTime()
  );
}
