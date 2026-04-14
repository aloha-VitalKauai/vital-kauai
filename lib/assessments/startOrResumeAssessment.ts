import { SupabaseClient } from '@supabase/supabase-js';

// RPC response shapes
interface RpcSuccess {
  ok: true;
  action: 'started' | 'resuming' | 'completed';
  assessment_id: string;
  is_overdue: boolean;
  window_hard_close_at: string;
  detail: string;
}

interface RpcError {
  ok: false;
  error:
    | 'window_not_open'
    | 'window_closed'
    | 'baseline_past_ceremony'
    | 'ceremony_not_found'
    | 'member_not_found'
    | 'invalid_timepoint'
    | 'locked';
  detail: string;
  opens_at?: string;
  closed_at?: string;
}

type RpcResponse = RpcSuccess | RpcError;

export type AssessmentEntryResult =
  | { outcome: 'draft_created';     assessmentId: string; isOverdue: boolean }
  | { outcome: 'draft_resumed';     assessmentId: string; isOverdue: boolean }
  | { outcome: 'already_completed'; assessmentId: string }
  | { outcome: 'error';             message: string };

function serverErrorMessage(rpc: RpcError): string {
  switch (rpc.error) {
    case 'window_not_open':
      return rpc.opens_at
        ? `Not available yet \u2014 opens ${new Date(rpc.opens_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        : 'This assessment is not yet available.';
    case 'window_closed':
      return 'The submission window for this assessment has closed.';
    case 'baseline_past_ceremony':
      return 'Baseline must be completed before ceremony day.';
    case 'ceremony_not_found':
      return 'Ceremony not found. Please contact your guide.';
    case 'member_not_found':
      return 'Member record not found. Please contact support.';
    case 'invalid_timepoint':
      return 'Unrecognised timepoint. Please contact support.';
    case 'locked':
      return 'This assessment is locked and cannot be opened.';
    default:
      return rpc.detail ?? 'Unable to open assessment. Please try again.';
  }
}

export async function startOrResumeAssessment(
  supabase: SupabaseClient,
  authUserId: string,
  ceremonyId: string,
  timepoint: string
): Promise<AssessmentEntryResult> {
  const { data, error } = await supabase.rpc('create_or_resume_assessment', {
    p_auth_user_id: authUserId,
    p_ceremony_id:  ceremonyId,
    p_timepoint:    timepoint,
  });

  if (error) {
    return { outcome: 'error', message: error.message };
  }

  const rpc = data as RpcResponse;

  if (!rpc.ok) {
    return { outcome: 'error', message: serverErrorMessage(rpc) };
  }

  if (rpc.action === 'started') {
    return { outcome: 'draft_created', assessmentId: rpc.assessment_id, isOverdue: rpc.is_overdue };
  }
  if (rpc.action === 'resuming') {
    return { outcome: 'draft_resumed', assessmentId: rpc.assessment_id, isOverdue: rpc.is_overdue };
  }
  if (rpc.action === 'completed') {
    return { outcome: 'already_completed', assessmentId: rpc.assessment_id };
  }

  return { outcome: 'error', message: 'Unexpected server response.' };
}
