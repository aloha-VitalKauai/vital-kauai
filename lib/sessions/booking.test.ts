import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionBookingLink } from "./booking.ts";

// ── scripted fake for the exact chains booking.ts uses ──────────────────────

type FakeState = {
  holdResult: { hold_id: string; hold_expires_at: string }[] | [];
  mapping: { calendly_event_type_uri: string } | null;
  rpcCalls: { fn: string; args: any }[];
  releasedHoldIds: string[];
};

function fakeSupabase(state: FakeState) {
  return {
    rpc: (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: state.holdResult, error: null });
    },
    from: (table: string) => {
      if (table === "session_booking_holds") {
        const chain: any = {
          delete: () => chain,
          eq: (_col: string, id: string) => ((chain._id = id), chain),
          is: () => {
            state.releasedHoldIds.push(chain._id);
            return Promise.resolve({ data: null, error: null });
          },
        };
        return chain;
      }
      // calendly_event_mappings
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        maybeSingle: () => Promise.resolve({ data: state.mapping, error: null }),
      };
      return chain;
    },
  } as never;
}

function fakeFetch(
  calls: { url: string; init: any }[],
  respond: () => any = () => ({
    ok: true,
    json: async () => ({ resource: { booking_url: "https://calendly.com/d/single-use" } }),
  }),
) {
  return ((url: any, init: any) => {
    calls.push({ url: String(url), init });
    return Promise.resolve(respond());
  }) as typeof fetch;
}

const HOLD = [{ hold_id: "hold-1", hold_expires_at: "2026-08-26T00:15:00Z" }];
const MAPPING = {
  calendly_event_type_uri: "https://api.calendly.com/event_types/COACH",
};
const MEMBER = {
  memberId: "profile-a",
  memberEmail: "a@test.local",
  memberName: "Member A",
  sessionType: "coaching" as const,
};

function withToken<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CALENDLY_API_TOKEN;
  if (value === undefined) delete process.env.CALENDLY_API_TOKEN;
  else process.env.CALENDLY_API_TOKEN = value;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.CALENDLY_API_TOKEN;
    else process.env.CALENDLY_API_TOKEN = prev;
  });
}

// ── acceptance: gate before link, atomic hold semantics ─────────────────────

test("no availability → no Calendly call, no link, 'no_sessions_remaining'", async () => {
  await withToken("tok", async () => {
    const state: FakeState = { holdResult: [], mapping: MAPPING, rpcCalls: [], releasedHoldIds: [] };
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "no_sessions_remaining" });
    assert.equal(calls.length, 0);
    assert.equal(state.releasedHoldIds.length, 0);
    assert.deepEqual(state.rpcCalls[0], {
      fn: "acquire_session_hold",
      args: { p_member: "profile-a", p_session_type: "coaching" },
    });
  });
});

test("availability → hold reserved, single-use link created and prefilled", async () => {
  await withToken("tok-coaching", async () => {
    const state: FakeState = { holdResult: HOLD, mapping: MAPPING, rpcCalls: [], releasedHoldIds: [] };
    const calls: { url: string; init: any }[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.bookingUrl,
      "https://calendly.com/d/single-use?email=a%40test.local&name=Member+A",
    );
    assert.equal(result.holdExpiresAt, "2026-08-26T00:15:00Z");

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.calendly.com/scheduling_links");
    assert.equal(calls[0].init.headers.Authorization, "Bearer tok-coaching");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      max_event_count: 1,
      owner: "https://api.calendly.com/event_types/COACH",
      owner_type: "EventType",
    });
    // The hold survives — the webhook will consume it when the booking lands.
    assert.equal(state.releasedHoldIds.length, 0);
  });
});

test("no active mapping → 'not_configured' and the hold is released", async () => {
  await withToken("tok", async () => {
    const state: FakeState = { holdResult: HOLD, mapping: null, rpcCalls: [], releasedHoldIds: [] };
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "not_configured" });
    assert.equal(calls.length, 0);
    assert.deepEqual(state.releasedHoldIds, ["hold-1"]);
  });
});

test("missing API token → 'not_configured' and the hold is released", async () => {
  await withToken(undefined, async () => {
    const state: FakeState = { holdResult: HOLD, mapping: MAPPING, rpcCalls: [], releasedHoldIds: [] };
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "not_configured" });
    assert.equal(calls.length, 0);
    assert.deepEqual(state.releasedHoldIds, ["hold-1"]);
  });
});

test("Calendly API failure → 'calendly_error' and the hold is released", async () => {
  await withToken("tok", async () => {
    const state: FakeState = { holdResult: HOLD, mapping: MAPPING, rpcCalls: [], releasedHoldIds: [] };
    const calls: any[] = [];
    const result = await createSessionBookingLink(
      fakeSupabase(state),
      MEMBER,
      fakeFetch(calls, () => ({ ok: false, status: 500 })),
    );
    assert.deepEqual(result, { ok: false, reason: "calendly_error" });
    assert.deepEqual(state.releasedHoldIds, ["hold-1"]);
  });
});

test("network throw → 'calendly_error' and the hold is released", async () => {
  await withToken("tok", async () => {
    const state: FakeState = { holdResult: HOLD, mapping: MAPPING, rpcCalls: [], releasedHoldIds: [] };
    const throwingFetch = (() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch;
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, throwingFetch);
    assert.deepEqual(result, { ok: false, reason: "calendly_error" });
    assert.deepEqual(state.releasedHoldIds, ["hold-1"]);
  });
});
