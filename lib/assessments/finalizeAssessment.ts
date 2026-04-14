import { SupabaseClient } from '@supabase/supabase-js';

interface RpcOk {
  ok: true;
  message?: 'already_final';
  assessment_id?: string;
  version: number;
  submitted_at: string;
  overdue?: boolean;
  replaced_id?: string | null;
}

interface RpcFail {
  ok: false;
  error: 'not_found' | 'locked' | 'window_not_open' | 'window_closed'
       | 'baseline_past_ceremony' | 'incomplete';
  missing_fields?: string[];
  opens_at?: string;
  closed_at?: string;
}

type RpcResponse = RpcOk | RpcFail;

export type FinalizeResult =
  | { outcome: 'success';               submittedAt: string; overdue: boolean }
  | { outcome: 'already_submitted';     submittedAt: string }
  | { outcome: 'incomplete';            missingFields: string[] }
  | { outcome: 'window_closed';         closedAt: string }
  | { outcome: 'window_not_open';       opensAt: string }
  | { outcome: 'baseline_past_ceremony' }
  | { outcome: 'locked' }
  | { outcome: 'error';                 message: string };

export async function finalizeAssessment(
  supabase: SupabaseClient,
  assessmentId: string
): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc('finalize_assessment', {
    p_assessment_id: assessmentId,
  });

  if (error) return { outcome: 'error', message: error.message };

  const rpc = data as RpcResponse;

  if (rpc.ok) {
    if (rpc.message === 'already_final') {
      return { outcome: 'already_submitted', submittedAt: rpc.submitted_at };
    }
    return { outcome: 'success', submittedAt: rpc.submitted_at, overdue: rpc.overdue ?? false };
  }

  switch (rpc.error) {
    case 'incomplete':             return { outcome: 'incomplete', missingFields: rpc.missing_fields ?? [] };
    case 'window_closed':          return { outcome: 'window_closed', closedAt: rpc.closed_at! };
    case 'window_not_open':        return { outcome: 'window_not_open', opensAt: rpc.opens_at! };
    case 'baseline_past_ceremony': return { outcome: 'baseline_past_ceremony' };
    case 'locked':                 return { outcome: 'locked' };
    case 'not_found':              return { outcome: 'error', message: 'Assessment not found. Return to your timeline.' };
    default:                       return { outcome: 'error', message: 'Submission failed. Please try again.' };
  }
}
