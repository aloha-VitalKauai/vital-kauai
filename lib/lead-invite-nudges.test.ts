import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dueNudge, type NudgeLead, type NudgeSent } from "./lead-invite-nudges.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-10-01T17:00:00Z");
const at = (d: number) => new Date(T0.getTime() + d * DAY);
const lead = (o: Partial<NudgeLead> = {}): NudgeLead => ({
  id: "l1", full_name: "Test", email: "t@example.com", member_id: "u1",
  approval_status: "approved", converted_to_member: false, invite_sent_at: T0.toISOString(), ...o,
});
const sent = (key: string, when: Date): NudgeSent => ({ notification_type: `lead_${key}`, sent_at: when.toISOString(), created_at: when.toISOString() });

describe("dueNudge", () => {
  it("waits three days after the invitation", () => {
    assert.equal(dueNudge(lead(), [], at(2)), null);
    assert.equal(dueNudge(lead(), [], at(3)), "invite_nudge_1");
  });
  it("sends the second a week after the first, then stops", () => {
    const s1 = [sent("invite_nudge_1", at(3))];
    assert.equal(dueNudge(lead(), s1, at(9)), null);
    assert.equal(dueNudge(lead(), s1, at(10)), "invite_nudge_2");
    assert.equal(dueNudge(lead(), [...s1, sent("invite_nudge_2", at(10))], at(60)), null);
  });
  it("never nudges someone who joined, was not approved, or asked to stop", () => {
    assert.equal(dueNudge(lead({ converted_to_member: true }), [], at(10)), null);
    assert.equal(dueNudge(lead({ approval_status: "pending" }), [], at(10)), null);
    assert.equal(dueNudge(lead({ invite_sent_at: "2026-09-10T12:00:00Z" }), [], at(10)), null);
    assert.equal(dueNudge(lead({ member_id: null }), [], at(10)), null);
    const stop: NudgeSent = { notification_type: "lead_followup_stopped", sent_at: null, created_at: T0.toISOString() };
    assert.equal(dueNudge(lead(), [stop], at(10)), null);
  });
});
