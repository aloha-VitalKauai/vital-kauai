/**
 * PR 10B — the public checkout route's browser contract.
 *
 * The browser may submit ONLY the contribution amount, the yes/no processing-
 * support choice and an opaque request id. Everything here is a refusal test:
 * requests that fail validation never reach the checkout service, so no
 * environment or database is involved.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { POST } from "./route.ts";

function post(body: unknown): Request {
  return new Request("https://vitalkauai.com/api/support/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const REQUEST_ID = "3f2b8c1d-4e5a-4b6c-8d7e-9f0a1b2c3d4e";
const valid = { contributionCents: 10000, coverProcessing: true, requestId: REQUEST_ID };

test("a body that tries to do the server's fee math is refused outright", async () => {
  for (const key of [
    "totalCents", "total_cents", "total",
    "supportCents", "support_cents",
    "processingSupportCents", "processing_support_cents",
    "feeCents", "fee_cents",
  ]) {
    const res = await POST(post({ ...valid, [key]: 10330 }));
    assert.equal(res.status, 400, `${key} must be refused`);
    const json = await res.json();
    assert.equal(json.error, "amount_math_not_accepted");
  }
});

test("a request id is required and must be a UUID", async () => {
  for (const requestId of [undefined, "", "not-a-uuid", 42, "vk_ps_evil"]) {
    const res = await POST(post({ ...valid, requestId }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "request_id_required");
  }
});

test("the contribution must be a positive safe integer within the hard ceiling", async () => {
  for (const contributionCents of [undefined, 0, -100, 100.5, "10000", 500_000_001, Number.MAX_SAFE_INTEGER + 1]) {
    const res = await POST(post({ ...valid, contributionCents }));
    assert.equal(res.status, 400, `${String(contributionCents)} must be refused`);
    assert.equal((await res.json()).error, "invalid_amount");
  }
});

test("the coverage choice must be an explicit boolean — nothing is inferred", async () => {
  for (const coverProcessing of [undefined, "yes", 1, null]) {
    const res = await POST(post({ ...valid, coverProcessing }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "cover_processing_required");
  }
});

test("a non-JSON body is a 400, not an exception", async () => {
  const res = await POST(
    new Request("https://vitalkauai.com/api/support/checkout", { method: "POST", body: "not json" }),
  );
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, "invalid_json");
});
