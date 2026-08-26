import { test } from "node:test";
import assert from "node:assert/strict";
import { createSessionBookingLink } from "./booking.ts";

// ── stateful fake for the exact chains booking.ts uses ──────────────────────

type HoldRow = {
  id: string;
  member_id: string;
  session_type: string;
  expires_at: string;
  booking_url: string | null;
  consumed_at: string | null;
  created_at: string;
};

type FakeState = {
  holds: HoldRow[];
  mapping: { calendly_event_type_uri: string } | null;
  grantNext: boolean; // whether acquire_session_hold grants a fresh hold
  attachError: boolean; // simulate the attach UPDATE failing
  rpcCalls: { fn: string; args: any }[];
};

function fakeSupabase(state: FakeState) {
  let nextId = 1;
  const holdsBuilder = () => {
    const s = {
      op: "select" as "select" | "update" | "delete",
      patch: null as Record<string, any> | null,
      filters: [] as ((r: HoldRow) => boolean)[],
      orderDesc: false,
    };
    const run = () => {
      const rows = state.holds.filter((r) => s.filters.every((f) => f(r)));
      if (s.op === "delete") {
        state.holds = state.holds.filter((r) => !rows.includes(r));
        return { data: null, error: null };
      }
      if (s.op === "update") {
        if (state.attachError) {
          return { data: null, error: { message: "attach failed" } };
        }
        rows.forEach((r) => Object.assign(r, s.patch));
        return { data: rows, error: null };
      }
      const sorted = [...rows].sort((a, b) =>
        s.orderDesc
          ? b.created_at.localeCompare(a.created_at)
          : a.created_at.localeCompare(b.created_at),
      );
      return { data: sorted, error: null };
    };
    const chain: any = {
      select: () => chain,
      update: (patch: Record<string, any>) => ((s.op = "update"), (s.patch = patch), chain),
      delete: () => ((s.op = "delete"), chain),
      eq: (col: string, v: any) => (s.filters.push((r: any) => r[col] === v), chain),
      is: (col: string, v: any) => (s.filters.push((r: any) => r[col] === v), chain),
      not: (col: string, _op: string, v: any) =>
        (s.filters.push((r: any) => r[col] !== v), chain),
      gt: (col: string, v: any) => (s.filters.push((r: any) => r[col] > v), chain),
      order: (_col: string, opts: { ascending: boolean }) =>
        ((s.orderDesc = !opts.ascending), chain),
      limit: () => chain,
      maybeSingle: () => {
        const { data, error } = run();
        return Promise.resolve({ data: (data as HoldRow[])?.[0] ?? null, error });
      },
      then: (ok: any, err: any) => Promise.resolve(run()).then(ok, err),
    };
    return chain;
  };
  return {
    rpc: (fn: string, args: any) => {
      state.rpcCalls.push({ fn, args });
      if (!state.grantNext) return Promise.resolve({ data: [], error: null });
      const hold: HoldRow = {
        id: `hold-${nextId++}`,
        member_id: args.p_member,
        session_type: args.p_session_type,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        booking_url: null,
        consumed_at: null,
        created_at: new Date().toISOString(),
      };
      state.holds.push(hold);
      return Promise.resolve({
        data: [{ hold_id: hold.id, hold_expires_at: hold.expires_at }],
        error: null,
      });
    },
    from: (table: string) => {
      if (table === "session_booking_holds") return holdsBuilder();
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

function makeState(overrides: Partial<FakeState> = {}): FakeState {
  return {
    holds: [],
    mapping: { calendly_event_type_uri: "https://api.calendly.com/event_types/COACH" },
    grantNext: true,
    attachError: false,
    rpcCalls: [],
    ...overrides,
  };
}

const MEMBER = {
  memberId: "profile-a",
  memberEmail: "a@test.local",
  memberName: "Member A",
  sessionType: "coaching" as const,
};

const EXPECTED_URL =
  "https://calendly.com/d/single-use?email=a%40test.local&name=Member+A";

function withToken<T>(value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const prev = process.env.CALENDLY_API_TOKEN;
  if (value === undefined) delete process.env.CALENDLY_API_TOKEN;
  else process.env.CALENDLY_API_TOKEN = value;
  return fn().finally(() => {
    if (prev === undefined) delete process.env.CALENDLY_API_TOKEN;
    else process.env.CALENDLY_API_TOKEN = prev;
  });
}

// ── acceptance: gate before link, authorization lifecycle ───────────────────

test("no availability → no Calendly call, no link, 'no_sessions_remaining'", async () => {
  await withToken("tok", async () => {
    const state = makeState({ grantNext: false });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "no_sessions_remaining" });
    assert.equal(calls.length, 0);
    assert.equal(state.holds.length, 0);
    assert.deepEqual(state.rpcCalls[0], {
      fn: "acquire_session_hold",
      args: { p_member: "profile-a", p_session_type: "coaching" },
    });
  });
});

test("issued link is ATTACHED to its hold and the authorization extends to the link's ~90-day validity, not 15 minutes", async () => {
  await withToken("tok-coaching", async () => {
    const state = makeState();
    const calls: { url: string; init: any }[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.bookingUrl, EXPECTED_URL);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://api.calendly.com/scheduling_links");
    assert.equal(calls[0].init.headers.Authorization, "Bearer tok-coaching");
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      max_event_count: 1,
      owner: "https://api.calendly.com/event_types/COACH",
      owner_type: "EventType",
    });

    // The hold now carries its link and outlives the short pending window:
    // the entitlement stays reserved for as long as the link stays bookable.
    assert.equal(state.holds.length, 1);
    assert.equal(state.holds[0].booking_url, EXPECTED_URL);
    const oneDayOut = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    assert.ok(
      state.holds[0].expires_at > oneDayOut,
      "authorization must extend far beyond the 15-minute pending window",
    );
    assert.equal(result.holdExpiresAt, state.holds[0].expires_at);
  });
});

test("repeated Book clicks return the SAME link — one authorization, never a second entitlement", async () => {
  await withToken("tok", async () => {
    const state = makeState();
    const calls: any[] = [];
    const first = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    const second = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.bookingUrl, first.bookingUrl);
    assert.equal(second.holdExpiresAt, first.holdExpiresAt);
    assert.equal(calls.length, 1, "Calendly must be called exactly once");
    assert.equal(state.rpcCalls.length, 1, "no second hold may be acquired");
    assert.equal(state.holds.length, 1, "exactly one authorization exists");
  });
});

test("a consumed authorization does not resurrect: the next Book acquires fresh", async () => {
  await withToken("tok", async () => {
    const state = makeState();
    state.holds.push({
      id: "hold-used",
      member_id: "profile-a",
      session_type: "coaching",
      expires_at: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000).toISOString(),
      booking_url: "https://calendly.com/d/already-used?email=a%40test.local",
      consumed_at: new Date().toISOString(),
      created_at: "2026-08-01T00:00:00Z",
    });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.notEqual(result.bookingUrl, "https://calendly.com/d/already-used?email=a%40test.local");
    assert.equal(state.rpcCalls.length, 1);
  });
});

test("no active mapping → 'not_configured' and the hold is released", async () => {
  await withToken("tok", async () => {
    const state = makeState({ mapping: null });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "not_configured" });
    assert.equal(calls.length, 0);
    assert.equal(state.holds.length, 0, "the hold must be released");
  });
});

test("missing API token → 'not_configured' and the hold is released", async () => {
  await withToken(undefined, async () => {
    const state = makeState();
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "not_configured" });
    assert.equal(calls.length, 0);
    assert.equal(state.holds.length, 0);
  });
});

test("Calendly API failure → 'calendly_error' and the hold is released", async () => {
  await withToken("tok", async () => {
    const state = makeState();
    const result = await createSessionBookingLink(
      fakeSupabase(state),
      MEMBER,
      fakeFetch([], () => ({ ok: false, status: 500 })),
    );
    assert.deepEqual(result, { ok: false, reason: "calendly_error" });
    assert.equal(state.holds.length, 0);
  });
});

test("network throw → 'calendly_error' and the hold is released", async () => {
  await withToken("tok", async () => {
    const state = makeState();
    const throwingFetch = (() => Promise.reject(new Error("ECONNRESET"))) as unknown as typeof fetch;
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, throwingFetch);
    assert.deepEqual(result, { ok: false, reason: "calendly_error" });
    assert.equal(state.holds.length, 0);
  });
});

// ── practitioner-hosted calendars we hold no token for (PNE today) ──────────

const URL_ONLY_MAPPING = {
  calendly_event_type_uri: null,
  scheduling_url: "https://calendly.com/practitioner/private-session",
} as never;

test("a URL-only mapping books on the practitioner's own link, with no Calendly API call", async () => {
  await withToken(undefined, async () => {
    const state = makeState({ mapping: URL_ONLY_MAPPING });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(
      result.bookingUrl,
      "https://calendly.com/practitioner/private-session?email=a%40test.local&name=Member+A",
    );
    assert.equal(calls.length, 0, "no token, so no scheduling_links call is attempted");
    assert.equal(state.holds.length, 1, "the session is still reserved");
    assert.equal(state.holds[0].booking_url, result.bookingUrl);
  });
});

test("availability is still gated for URL-only mappings", async () => {
  await withToken(undefined, async () => {
    const state = makeState({ mapping: URL_ONLY_MAPPING, grantNext: false });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "no_sessions_remaining" });
    assert.equal(calls.length, 0);
  });
});

test("repeat clicks reuse the practitioner link too — one authorization", async () => {
  await withToken(undefined, async () => {
    const state = makeState({ mapping: URL_ONLY_MAPPING });
    const first = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch([]));
    const second = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch([]));
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.bookingUrl, first.bookingUrl);
    assert.equal(state.holds.length, 1);
    assert.equal(state.rpcCalls.length, 1);
  });
});

test("a token plus an event type still prefers a single-use link over any URL", async () => {
  await withToken("tok", async () => {
    const state = makeState({
      mapping: {
        calendly_event_type_uri: "https://api.calendly.com/event_types/COACH",
        scheduling_url: "https://calendly.com/practitioner/should-not-be-used",
      } as never,
    });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.match(result.bookingUrl, /calendly\.com\/d\/single-use/);
    assert.doesNotMatch(result.bookingUrl, /should-not-be-used/);
    assert.equal(calls.length, 1);
  });
});

test("a mapping with neither a mintable link nor a URL stays not_configured", async () => {
  await withToken(undefined, async () => {
    const state = makeState({
      mapping: { calendly_event_type_uri: null, scheduling_url: null } as never,
    });
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch([]));
    assert.deepEqual(result, { ok: false, reason: "not_configured" });
    assert.equal(state.holds.length, 0, "the hold is released");
  });
});

test("attach failure → link withheld, hold released — fail closed", async () => {
  await withToken("tok", async () => {
    const state = makeState({ attachError: true });
    const calls: any[] = [];
    const result = await createSessionBookingLink(fakeSupabase(state), MEMBER, fakeFetch(calls));
    assert.deepEqual(result, { ok: false, reason: "calendly_error" });
    assert.equal(calls.length, 1, "the link was created at Calendly");
    assert.equal(state.holds.length, 0, "but its untracked authorization is released");
  });
});
