import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { recipientsFrom, stopReasonFor, verifyResendSignature } from "./resend-webhook.ts";

const secretRaw = Buffer.from("0123456789abcdef0123456789abcdef");
const secret = "whsec_" + secretRaw.toString("base64");

function sign(id: string, ts: string, body: string) {
  return "v1," + createHmac("sha256", secretRaw).update(`${id}.${ts}.${body}`).digest("base64");
}

describe("verifyResendSignature", () => {
  const body = JSON.stringify({ type: "email.bounced", data: { to: ["a@b.co"] } });
  const now = 1_800_000_000_000;
  const ts = String(Math.floor(now / 1000));

  it("accepts a correctly signed, fresh delivery", () => {
    assert.equal(verifyResendSignature({ secret, id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), rawBody: body, now }), true);
  });
  it("accepts when the valid signature is one of several", () => {
    const sig = "v1,AAAA " + sign("msg_1", ts, body);
    assert.equal(verifyResendSignature({ secret, id: "msg_1", timestamp: ts, signature: sig, rawBody: body, now }), true);
  });
  it("rejects a tampered body, wrong id, or stale timestamp", () => {
    assert.equal(verifyResendSignature({ secret, id: "msg_1", timestamp: ts, signature: sign("msg_1", ts, body), rawBody: body + " ", now }), false);
    assert.equal(verifyResendSignature({ secret, id: "msg_2", timestamp: ts, signature: sign("msg_1", ts, body), rawBody: body, now }), false);
    const old = String(Math.floor(now / 1000) - 3600);
    assert.equal(verifyResendSignature({ secret, id: "msg_1", timestamp: old, signature: sign("msg_1", old, body), rawBody: body, now }), false);
  });
  it("rejects missing headers", () => {
    assert.equal(verifyResendSignature({ secret, id: null, timestamp: ts, signature: "v1,x", rawBody: body, now }), false);
  });
});

describe("bounce rule", () => {
  it("stops on bounces and complaints only", () => {
    assert.equal(stopReasonFor("email.bounced"), "bounced");
    assert.equal(stopReasonFor("email.complained"), "complained");
    assert.equal(stopReasonFor("email.delivered"), null);
  });
  it("reads recipients from string or array", () => {
    assert.deepEqual(recipientsFrom({ data: { to: ["A@x.com", " b@y.com "] } }), ["a@x.com", "b@y.com"]);
    assert.deepEqual(recipientsFrom({ data: { to: "C@z.com" } }), ["c@z.com"]);
    assert.deepEqual(recipientsFrom({}), []);
  });
});
