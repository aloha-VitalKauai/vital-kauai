import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dueStep,
  isEligible,
  stopToken,
  verifyStopToken,
  type FollowupLead,
  type SentRecord,
} from "./lead-followups.ts";

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-09-01T17:00:00Z");
const at = (days: number) => new Date(T0.getTime() + days * DAY);

function lead(over: Partial<FollowupLead> = {}): FollowupLead {
  return {
    id: "lead-1",
    full_name: "Test Person",
    email: "person@example.com",
    source: "Free Guide",
    created_at: T0.toISOString(),
    discovery_call_booked: false,
    converted_to_member: false,
    approval_status: null,
    ...over,
  };
}

function sent(key: string, when: Date): SentRecord {
  return { notification_type: `lead_followup_${key}`, sent_at: when.toISOString(), created_at: when.toISOString() };
}

describe("isEligible", () => {
  it("accepts an unbooked lead with a valid email", () => {
    assert.equal(isEligible(lead(), []), true);
  });
  it("stops once a call is booked or the lead became a member", () => {
    assert.equal(isEligible(lead({ discovery_call_booked: true }), []), false);
    assert.equal(isEligible(lead({ converted_to_member: true }), []), false);
  });
  it("never enters Calendly-sourced leads, declined leads, or bad emails", () => {
    assert.equal(isEligible(lead({ source: "Calendly" }), []), false);
    assert.equal(isEligible(lead({ approval_status: "declined" }), []), false);
    assert.equal(isEligible(lead({ email: "nope" }), []), false);
  });
  it("honours a stop request", () => {
    const stop: SentRecord = { notification_type: "lead_followup_stopped", sent_at: null, created_at: T0.toISOString() };
    assert.equal(isEligible(lead(), [stop]), false);
  });
});

describe("dueStep", () => {
  it("sends nothing before day 2", () => {
    assert.equal(dueStep(lead(), [], at(1)), null);
  });
  it("sends day2 at two days, then waits for the gap before day5", () => {
    assert.equal(dueStep(lead(), [], at(2))?.key, "day2");
    const after2 = [sent("day2", at(2))];
    assert.equal(dueStep(lead(), after2, at(4)), null);
    assert.equal(dueStep(lead(), after2, at(5))?.key, "day5");
  });
  it("spaces the series out for an old lead who never received anything", () => {
    const old = lead({ created_at: at(-60).toISOString() });
    assert.equal(dueStep(old, [], at(0))?.key, "day2");
    const s2 = [sent("day2", at(0))];
    assert.equal(dueStep(old, s2, at(2)), null);
    assert.equal(dueStep(old, s2, at(3))?.key, "day5");
    const s5 = [...s2, sent("day5", at(3))];
    assert.equal(dueStep(old, s5, at(7)), null);
    assert.equal(dueStep(old, s5, at(8))?.key, "day10");
  });
  it("ends after day21", () => {
    const all = [sent("day2", at(2)), sent("day5", at(5)), sent("day10", at(10)), sent("day21", at(21))];
    assert.equal(dueStep(lead(), all, at(60)), null);
  });
  it("stops mid-sequence when the lead books", () => {
    assert.equal(dueStep(lead({ discovery_call_booked: true }), [sent("day2", at(2))], at(9)), null);
  });
});

describe("stop token", () => {
  it("round-trips and rejects tampering", () => {
    const t = stopToken("lead-1", "secret");
    assert.equal(verifyStopToken("lead-1", t, "secret"), true);
    assert.equal(verifyStopToken("lead-2", t, "secret"), false);
    assert.equal(verifyStopToken("lead-1", t.slice(0, 10), "secret"), false);
    assert.equal(verifyStopToken("lead-1", t, "other"), false);
  });
});
