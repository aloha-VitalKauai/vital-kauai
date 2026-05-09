import type { SupabaseClient } from "@supabase/supabase-js";

// Journal-page data layer. The portal /portal/journal page persists its
// pre- and post-ceremony free-write responses in the journal_responses
// jsonb column of pre_ceremony_progress and post_ceremony_progress
// (NOT member_journals — that table is used by unrelated portal surfaces).
//
// Bodies are byte-equivalent copies of the Supabase calls that previously
// lived inline in app/portal/journal/JournalClient.tsx — relocated here
// so the mobile client can consume the same typed contract.

export function getPreCeremonyJournal(supabase: SupabaseClient, memberId: string) {
  return supabase
    .from("pre_ceremony_progress")
    .select("journal_responses")
    .eq("member_id", memberId)
    .maybeSingle();
}

export function getPostCeremonyJournal(supabase: SupabaseClient, memberId: string) {
  return supabase
    .from("post_ceremony_progress")
    .select("journal_responses")
    .eq("member_id", memberId)
    .maybeSingle();
}

export function savePreCeremonyJournal(
  supabase: SupabaseClient,
  memberId: string,
  responses: Record<string, string>,
) {
  return supabase.from("pre_ceremony_progress").upsert(
    {
      member_id: memberId,
      journal_responses: responses,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
}

export function savePostCeremonyJournal(
  supabase: SupabaseClient,
  memberId: string,
  responses: Record<string, string>,
) {
  return supabase.from("post_ceremony_progress").upsert(
    {
      member_id: memberId,
      journal_responses: responses,
      last_updated: new Date().toISOString(),
    },
    { onConflict: "member_id" },
  );
}
