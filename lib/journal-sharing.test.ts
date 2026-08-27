import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canCareTeamViewJournal,
  resolveJournalSharingState,
  journalSharingNotice,
  sanitizeProgressForFounder,
  describeJournalSharingConsent,
} from "./journal-sharing.ts";

test("canCareTeamViewJournal: personal share enables access", () => {
  assert.equal(canCareTeamViewJournal({ journal_sharing_enabled: true }), true);
});

test("canCareTeamViewJournal: legacy compatibility enables access", () => {
  assert.equal(
    canCareTeamViewJournal({ legacy_journal_access_enabled: true }),
    true,
  );
});

test("canCareTeamViewJournal: neither flag denies access", () => {
  assert.equal(
    canCareTeamViewJournal({
      journal_sharing_enabled: false,
      legacy_journal_access_enabled: false,
    }),
    false,
  );
});

test("canCareTeamViewJournal: null/undefined/missing resolve to false", () => {
  assert.equal(canCareTeamViewJournal(null), false);
  assert.equal(canCareTeamViewJournal(undefined), false);
  assert.equal(canCareTeamViewJournal({}), false);
});

test("resolveJournalSharingState: shared when a flag is set", () => {
  assert.equal(
    resolveJournalSharingState({ journal_sharing_enabled: true }),
    "shared",
  );
  assert.equal(
    resolveJournalSharingState({ legacy_journal_access_enabled: true }),
    "shared",
  );
});

test("resolveJournalSharingState: private when decided but not shared", () => {
  assert.equal(
    resolveJournalSharingState({
      journal_sharing_enabled: false,
      journal_sharing_decided_at: "2026-07-24T00:00:00.000Z",
    }),
    "private",
  );
});

test("resolveJournalSharingState: undecided when no decision and no access", () => {
  assert.equal(resolveJournalSharingState({}), "undecided");
  assert.equal(resolveJournalSharingState(null), "undecided");
});

test("journalSharingNotice wording matches spec, null when shared", () => {
  assert.equal(journalSharingNotice("shared"), null);
  assert.match(journalSharingNotice("private")!, /chosen to keep/);
  assert.match(journalSharingNotice("undecided")!, /has not shared/);
});

test("sanitizeProgressForFounder strips response text when not allowed, keeps metadata", () => {
  const row = {
    weeks_completed: [0, 1],
    last_updated: "2026-07-23T00:00:00Z",
    journal_responses: { "w0-p1": "private text", "pre-pne-reflection-w0": "more" },
  };
  const stripped = sanitizeProgressForFounder(row, false);
  assert.deepEqual(stripped!.journal_responses, {});
  assert.deepEqual(stripped!.weeks_completed, [0, 1]);
  assert.equal(stripped!.last_updated, "2026-07-23T00:00:00Z");
  // Original object is not mutated.
  assert.equal(row.journal_responses["w0-p1"], "private text");
});

test("sanitizeProgressForFounder passes content through when allowed", () => {
  const row = { weeks_completed: [0], journal_responses: { "w0-p1": "shared" } };
  const kept = sanitizeProgressForFounder(row, true);
  assert.deepEqual(kept!.journal_responses, { "w0-p1": "shared" });
});

test("sanitizeProgressForFounder tolerates null/undefined progress", () => {
  assert.equal(sanitizeProgressForFounder(null, false), null);
  assert.equal(sanitizeProgressForFounder(undefined, false), undefined);
});

test("describeJournalSharingConsent: member opt-in is reported as consent", () => {
  const c = describeJournalSharingConsent({
    journal_sharing_enabled: true,
    journal_sharing_decided_at: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(c.state, "shared");
  assert.equal(c.consented, true);
  assert.equal(c.decidedAt, "2026-07-24T00:00:00.000Z");
});

// The distinction the founder UI exists to make: legacy access grants reads but
// is explicitly NOT a record that the member agreed to share.
test("describeJournalSharingConsent: legacy access is never labelled as consent", () => {
  const c = describeJournalSharingConsent({
    journal_sharing_enabled: false,
    legacy_journal_access_enabled: true,
  });
  assert.equal(c.state, "shared");
  assert.equal(c.consented, false);
  assert.match(c.label, /not a record of consent/i);
});

// Member consent wins the label even when legacy access also happens to be on,
// so a genuine opt-in is never downgraded to a legacy warning.
test("describeJournalSharingConsent: personal consent takes precedence over legacy", () => {
  const c = describeJournalSharingConsent({
    journal_sharing_enabled: true,
    legacy_journal_access_enabled: true,
  });
  assert.equal(c.consented, true);
  assert.match(c.label, /shared with the care team/i);
});

test("describeJournalSharingConsent: deliberate opt-out reads as private", () => {
  const c = describeJournalSharingConsent({
    journal_sharing_enabled: false,
    journal_sharing_decided_at: "2026-07-24T00:00:00.000Z",
  });
  assert.equal(c.state, "private");
  assert.equal(c.consented, false);
  assert.match(c.label, /chose not to share/i);
});

test("describeJournalSharingConsent: no decision is distinct from opting out", () => {
  for (const member of [null, undefined, {}, { journal_sharing_enabled: false }]) {
    const c = describeJournalSharingConsent(member);
    assert.equal(c.state, "undecided");
    assert.equal(c.consented, false);
    assert.equal(c.decidedAt, null);
  }
});
