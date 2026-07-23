// Portal-wide journal & reflection sharing consent (PR #3).
//
// A member's canonical `members` row carries the preference:
//   - journal_sharing_enabled       true only when the member personally opted in
//   - journal_sharing_decided_at     when they made that choice (intake submit)
//   - legacy_journal_access_enabled  admin compatibility for members whose
//     journals were already visible to authorized founders before this control
//     existed. This is NOT a record of consent.
//
// The care team (founders / assigned guides) may view a member's journal, PNE,
// and medicine-question responses only when the member has shared OR legacy
// access applies. Enforcement is server-side: gated response text is removed
// from page props before it ever reaches the founder's browser.

export type JournalSharingFields = {
  journal_sharing_enabled?: boolean | null;
  legacy_journal_access_enabled?: boolean | null;
  journal_sharing_decided_at?: string | null;
};

export type JournalSharingState = "shared" | "private" | "undecided";

// Single source of truth for care-team access. Either the member personally
// enabled sharing, or legacy compatibility access applies.
export function canCareTeamViewJournal(
  member: JournalSharingFields | null | undefined,
): boolean {
  if (!member) return false;
  return (
    member.journal_sharing_enabled === true ||
    member.legacy_journal_access_enabled === true
  );
}

// Distinguishes a deliberate privacy choice from a member who simply has not
// submitted a preference yet, so the founder UI can word the notice correctly.
export function resolveJournalSharingState(
  member: JournalSharingFields | null | undefined,
): JournalSharingState {
  if (canCareTeamViewJournal(member)) return "shared";
  if (member?.journal_sharing_decided_at) return "private";
  return "undecided";
}

export function journalSharingNotice(state: JournalSharingState): string | null {
  if (state === "private") {
    return "This member has chosen to keep their journal and reflection responses private.";
  }
  if (state === "undecided") {
    return "This member has not shared their journal and reflection responses with the care team.";
  }
  return null;
}

// Remove response text from a progress row so private journal/PNE content never
// reaches the founder client. Progress metadata (weeks_completed, last_updated,
// checklist_items, weekly_tracking) is preserved so the dashboard still shows
// counts, completed weeks, and last-active dates. Returns the row unchanged when
// access is allowed, and null/undefined untouched.
export function sanitizeProgressForFounder<
  T extends { journal_responses?: unknown } | null | undefined,
>(progress: T, canView: boolean): T {
  if (!progress || canView) return progress;
  return { ...progress, journal_responses: {} };
}
