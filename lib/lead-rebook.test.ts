import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDiscoveryCallEvent, shouldSendRebook } from "./lead-rebook.ts";

describe("shouldSendRebook", () => {
  const base = { eventType: "invitee.canceled", eventName: "30 Minute Discovery Call", rescheduled: false, alreadySent: false };
  it("sends for a true cancellation of a discovery call", () => {
    assert.equal(shouldSendRebook(base), true);
  });
  it("stays quiet for a reschedule, a repeat, another event type, or another event", () => {
    assert.equal(shouldSendRebook({ ...base, rescheduled: true }), false);
    assert.equal(shouldSendRebook({ ...base, alreadySent: true }), false);
    assert.equal(shouldSendRebook({ ...base, eventType: "invitee.created" }), false);
    assert.equal(shouldSendRebook({ ...base, eventName: "1 Hour Coaching Call" }), false);
  });
  it("recognises discovery events by name", () => {
    assert.equal(isDiscoveryCallEvent("Discovery Call"), true);
    assert.equal(isDiscoveryCallEvent("Onboarding"), false);
    assert.equal(isDiscoveryCallEvent(null), false);
  });
});
