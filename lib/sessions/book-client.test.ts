import { test } from "node:test";
import assert from "node:assert/strict";
import { requestSessionBooking } from "./book-client.ts";

// Every "Book a session" surface funnels through this one translation, so the
// mapping from HTTP status to member-visible outcome is worth pinning: a 503
// must never read as "no sessions left", and a malformed 200 must never send
// the member to `undefined`.

function fakeFetch(res: { status: number; body?: unknown }) {
  const calls: string[] = [];
  const impl = (async (url: string, init?: { method?: string }) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    return {
      status: res.status,
      ok: res.status >= 200 && res.status < 300,
      json: async () => res.body ?? {},
    };
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("a link is returned as-is, from the session type's own endpoint", async () => {
  const { impl, calls } = fakeFetch({
    status: 200,
    body: { booking_url: "https://calendly.com/example/session?email=m%40x.com" },
  });
  const result = await requestSessionBooking("pne", impl);
  assert.deepEqual(result, {
    status: "ok",
    bookingUrl: "https://calendly.com/example/session?email=m%40x.com",
  });
  assert.deepEqual(calls, ["POST /api/sessions/pne/book"]);
});

test("coaching books against the coaching endpoint", async () => {
  const { impl, calls } = fakeFetch({ status: 200, body: { booking_url: "https://x" } });
  await requestSessionBooking("coaching", impl);
  assert.deepEqual(calls, ["POST /api/sessions/coaching/book"]);
});

test("503 is 'not configured yet', distinct from a spent allowance", async () => {
  const { impl } = fakeFetch({ status: 503, body: { error: "booking_not_configured" } });
  assert.deepEqual(await requestSessionBooking("pne", impl), { status: "unavailable" });
});

test("409 is a spent allowance", async () => {
  const { impl } = fakeFetch({ status: 409, body: { error: "no_sessions_remaining" } });
  assert.deepEqual(await requestSessionBooking("pne", impl), { status: "none_remaining" });
});

test("a 200 carrying no link is an error, never a navigation", async () => {
  const { impl } = fakeFetch({ status: 200, body: {} });
  assert.deepEqual(await requestSessionBooking("pne", impl), { status: "error" });
});

test("401, 502 and a thrown fetch all resolve to error rather than rejecting", async () => {
  for (const status of [401, 500, 502]) {
    const { impl } = fakeFetch({ status });
    assert.deepEqual(await requestSessionBooking("coaching", impl), { status: "error" });
  }
  const throwing = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  assert.deepEqual(await requestSessionBooking("coaching", throwing), { status: "error" });
});
