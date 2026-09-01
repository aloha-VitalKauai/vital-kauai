// Weekly check-in submission — everything testable behind
// POST /api/checkins/submit. The route stays thin (auth + JSON plumbing);
// ownership, the already-submitted guard, snapshot validation, and the
// guarded write all live here.
//
// The caller passes the SERVICE-ROLE client plus the authenticated member's
// id from their cookie session — member_checkins has no member write policy
// (Build 1 decision), so this function is the write path and enforces
// ownership itself, exactly like lib/sessions/booking.ts does for holds.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseQuestionsSnapshot,
  validateResponses,
  type CheckinResponses,
} from "@/lib/checkins/questions";

export type SubmitCheckinResult =
  | { ok: true; checkin: { id: string; week_number: number; submitted_at: string } }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "already_submitted" }
  | { ok: false; reason: "invalid_responses"; errors: string[] }
  | { ok: false; reason: "write_failed" };

export async function submitCheckin(
  supabase: SupabaseClient,
  {
    checkinId,
    memberId,
    answers,
  }: { checkinId: string; memberId: string; answers: unknown },
): Promise<SubmitCheckinResult> {
  const { data: row, error } = await supabase
    .from("member_checkins")
    .select("id, member_id, week_number, status, questions_snapshot")
    .eq("id", checkinId)
    .maybeSingle();

  // A failed read is never "no row": surface it as a write-path failure so
  // the member retries, rather than a 404 that reads as "not yours".
  if (error) return { ok: false, reason: "write_failed" };
  // Someone else's check-in answers exactly like a missing one — no probe
  // can distinguish "not yours" from "does not exist".
  if (!row || row.member_id !== memberId) return { ok: false, reason: "not_found" };
  if (row.status === "submitted") return { ok: false, reason: "already_submitted" };

  const questions = parseQuestionsSnapshot(row.questions_snapshot);
  const validation = validateResponses(questions, answers);
  if (!validation.ok) {
    return { ok: false, reason: "invalid_responses", errors: validation.errors };
  }

  const submittedAt = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("member_checkins")
    .update({
      responses: validation.responses satisfies CheckinResponses,
      status: "submitted",
      submitted_at: submittedAt,
    })
    .eq("id", checkinId)
    .eq("member_id", memberId)
    .neq("status", "submitted")
    .select("id, week_number, submitted_at");

  if (updateError) return { ok: false, reason: "write_failed" };
  // Zero rows means a concurrent submit won the race after our read — the
  // member's earlier answers stand, exactly like the pre-checked case.
  if (!updated || updated.length === 0) return { ok: false, reason: "already_submitted" };

  const c = updated[0];
  return {
    ok: true,
    checkin: { id: c.id, week_number: c.week_number, submitted_at: c.submitted_at },
  };
}
