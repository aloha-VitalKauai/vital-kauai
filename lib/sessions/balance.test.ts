import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeSessionBalance,
  getRemainingSessions,
  getSessionBalances,
  type AllowanceRow,
  type CountingBookingRow,
} from "./balance.ts";

const grant = (session_type: string, quantity: number): AllowanceRow => ({
  session_type,
  quantity,
});
const booking = (
  session_type: string,
  counts = true,
): CountingBookingRow => ({
  session_type,
  counts_against_allowance: counts,
});

test("10 granted, 0 bookings → 10 remaining", () => {
  const balance = computeSessionBalance([grant("coaching", 10)], [], "coaching");
  assert.deepEqual(balance, { granted: 10, used: 0, remaining: 10 });
});

test("10 granted, 1 counting booking → 9 remaining", () => {
  const balance = computeSessionBalance(
    [grant("coaching", 10)],
    [booking("coaching")],
    "coaching",
  );
  assert.deepEqual(balance, { granted: 10, used: 1, remaining: 9 });
});

test("10 granted, 3 counting bookings → 7 remaining", () => {
  const balance = computeSessionBalance(
    [grant("coaching", 10)],
    [booking("coaching"), booking("coaching"), booking("coaching")],
    "coaching",
  );
  assert.deepEqual(balance, { granted: 10, used: 3, remaining: 7 });
});

test("canceled (non-counting) bookings do not reduce the balance", () => {
  const balance = computeSessionBalance(
    [grant("coaching", 10)],
    [
      booking("coaching"),
      booking("coaching"),
      booking("coaching", false),
      booking("coaching", false),
    ],
    "coaching",
  );
  assert.deepEqual(balance, { granted: 10, used: 2, remaining: 8 });
});

test("cancellation returns the session: flipping counts_against_allowance restores the balance", () => {
  const allowances = [grant("coaching", 10)];
  const before = computeSessionBalance(
    allowances,
    [booking("coaching"), booking("coaching"), booking("coaching")],
    "coaching",
  );
  assert.equal(before.remaining, 7);
  const after = computeSessionBalance(
    allowances,
    [booking("coaching"), booking("coaching"), booking("coaching", false)],
    "coaching",
  );
  assert.equal(after.remaining, 8);
});

test("coaching and pne balances are fully isolated from each other", () => {
  const allowances = [grant("coaching", 10), grant("pne", 6)];
  const bookings = [
    booking("coaching"),
    booking("coaching"),
    booking("coaching"),
    booking("pne"),
  ];
  assert.deepEqual(computeSessionBalance(allowances, bookings, "coaching"), {
    granted: 10,
    used: 3,
    remaining: 7,
  });
  assert.deepEqual(computeSessionBalance(allowances, bookings, "pne"), {
    granted: 6,
    used: 1,
    remaining: 5,
  });
});

test("+1 founder adjustment is an added ledger row, not an overwrite", () => {
  const balance = computeSessionBalance(
    [grant("coaching", 10), grant("coaching", 1)],
    [booking("coaching"), booking("coaching"), booking("coaching")],
    "coaching",
  );
  assert.deepEqual(balance, { granted: 11, used: 3, remaining: 8 });
});

test("negative compensating adjustment lowers the granted total", () => {
  const balance = computeSessionBalance(
    [grant("coaching", 10), grant("coaching", -1)],
    [],
    "coaching",
  );
  assert.deepEqual(balance, { granted: 9, used: 0, remaining: 9 });
});

test("no grants → zero balance", () => {
  assert.deepEqual(computeSessionBalance([], [], "coaching"), {
    granted: 0,
    used: 0,
    remaining: 0,
  });
});

test("rows of unknown session types are ignored", () => {
  const balance = computeSessionBalance(
    [grant("coaching", 10), grant("massage", 5)],
    [booking("massage")],
    "coaching",
  );
  assert.deepEqual(balance, { granted: 10, used: 0, remaining: 10 });
});

// ── query wrapper, against a stubbed client ─────────────────────────────────

type StubResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

function stubClient(results: {
  allowances: StubResult;
  bookings: StubResult;
}) {
  const table = (result: StubResult) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      then: (
        onFulfilled: (value: StubResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(result).then(onFulfilled, onRejected),
    };
    return chain;
  };
  return {
    from: (name: string) =>
      name === "member_session_allowances"
        ? table(results.allowances)
        : table(results.bookings),
  } as never;
}

test("getSessionBalances computes both balances from the two queries", async () => {
  const supabase = stubClient({
    allowances: {
      data: [grant("coaching", 10), grant("pne", 6)],
      error: null,
    },
    bookings: {
      // Includes a non-counting row: the database query already filters these
      // out, and the compute layer independently ignores them.
      data: [
        booking("coaching"),
        booking("coaching"),
        booking("coaching"),
        booking("pne"),
        booking("coaching", false),
      ],
      error: null,
    },
  });
  const balances = await getSessionBalances(supabase, "member-a");
  assert.deepEqual(balances, {
    coaching: { granted: 10, used: 3, remaining: 7 },
    pne: { granted: 6, used: 1, remaining: 5 },
  });
});

test("getRemainingSessions returns the requested type's remaining count", async () => {
  const supabase = stubClient({
    allowances: { data: [grant("pne", 6)], error: null },
    bookings: { data: [booking("pne"), booking("pne")], error: null },
  });
  assert.equal(await getRemainingSessions(supabase, "member-a", "pne"), 4);
  assert.equal(await getRemainingSessions(supabase, "member-a", "coaching"), 0);
});

test("getSessionBalances surfaces query errors instead of returning zeros", async () => {
  const supabase = stubClient({
    allowances: { data: null, error: { message: "permission denied" } },
    bookings: { data: [], error: null },
  });
  await assert.rejects(
    () => getSessionBalances(supabase, "member-a"),
    /member_session_allowances read failed: permission denied/,
  );
});
