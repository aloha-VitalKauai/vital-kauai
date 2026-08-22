/**
 * PR 3B — exhaustive pagination tests (acceptance 6, 7, 8, 11, 18d).
 *
 * Pages are served from deterministic in-memory fixtures and `sleep` is a no-op,
 * so these execute the retry and cursor logic without waiting or network access.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { paginateAll, ReconciliationFatal, type StripePage } from "./paginate.ts";

type Obj = { id: string };

const noSleep = async () => {};
const noJitter = () => 0;

/** Serve `total` objects in pages of `size`, honouring the starting_after cursor. */
function fixture(total: number, size: number) {
  const all: Obj[] = Array.from({ length: total }, (_, i) => ({ id: `ob_${i + 1}` }));
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    fetchPage: async ({ startingAfter, limit }: { startingAfter?: string; limit: number }) => {
      calls += 1;
      const from = startingAfter ? all.findIndex((o) => o.id === startingAfter) + 1 : 0;
      const slice = all.slice(from, from + Math.min(limit, size));
      return { data: slice, has_more: from + slice.length < all.length } as StripePage<Obj>;
    },
  };
}

test("A6: a list longer than one page is walked to exhaustion", () => {
  // The failure this guards against is silent under-reporting: a one-page read
  // looks successful and simply omits the tail.
  return (async () => {
    const f = fixture(250, 100);
    const res = await paginateAll<Obj>({ fetchPage: f.fetchPage, idOf: (o) => o.id });
    assert.equal(res.items.length, 250);
    assert.equal(res.items[0].id, "ob_1");
    assert.equal(res.items[249].id, "ob_250");
    assert.equal(f.calls, 3);
  })();
});

test("A6: a charge with more refunds than one page yields every refund", async () => {
  const f = fixture(7, 2); // the acceptance example, at small scale
  const res = await paginateAll<Obj>({ fetchPage: f.fetchPage, idOf: (o) => o.id, limit: 2 });
  assert.equal(res.items.length, 7);
  assert.deepEqual(
    res.items.map((o) => o.id),
    ["ob_1", "ob_2", "ob_3", "ob_4", "ob_5", "ob_6", "ob_7"],
  );
});

test("an empty list terminates immediately", async () => {
  const f = fixture(0, 100);
  const res = await paginateAll<Obj>({ fetchPage: f.fetchPage, idOf: (o) => o.id });
  assert.equal(res.items.length, 0);
  assert.equal(f.calls, 1);
});

test("termination keys on has_more, not on a short page", async () => {
  // Stripe may return fewer items than requested while more remain; treating a
  // short page as the end would drop the tail.
  let call = 0;
  const pages: StripePage<Obj>[] = [
    { data: [{ id: "a" }], has_more: true },
    { data: [{ id: "b" }, { id: "c" }], has_more: false },
  ];
  const res = await paginateAll<Obj>({
    fetchPage: async () => pages[call++],
    idOf: (o) => o.id,
  });
  assert.deepEqual(res.items.map((o) => o.id), ["a", "b", "c"]);
});

test("the cursor advances to the last id of each page", async () => {
  const seen: (string | undefined)[] = [];
  let call = 0;
  const pages: StripePage<Obj>[] = [
    { data: [{ id: "a" }, { id: "b" }], has_more: true },
    { data: [{ id: "c" }], has_more: false },
  ];
  await paginateAll<Obj>({
    fetchPage: async ({ startingAfter }) => {
      seen.push(startingAfter);
      return pages[call++];
    },
    idOf: (o) => o.id,
  });
  assert.deepEqual(seen, [undefined, "b"]);
});

test("has_more with an empty page is refused rather than looped forever", async () => {
  // The cursor cannot advance, so this would spin indefinitely. A stuck job is
  // harder to notice than a failed one.
  await assert.rejects(
    paginateAll<Obj>({
      fetchPage: async () => ({ data: [], has_more: true }),
      idOf: (o) => o.id,
    }),
    /pagination stalled/,
  );
});

test("A7/A8: a transient failure is retried and then succeeds", async () => {
  let call = 0;
  const res = await paginateAll<Obj>({
    fetchPage: async () => {
      call += 1;
      if (call < 3) throw Object.assign(new Error("boom"), { statusCode: 503 });
      return { data: [{ id: "a" }], has_more: false };
    },
    idOf: (o) => o.id,
    sleep: noSleep,
    random: noJitter,
  });
  assert.equal(res.items.length, 1);
  assert.equal(res.retries, 2);
  assert.equal(res.apiCalls, 3, "every attempt counts as an API call");
});

test("A18d: a 4xx during enumeration is run-fatal, not an object skip", async () => {
  await assert.rejects(
    paginateAll<Obj>({
      fetchPage: async () => {
        throw Object.assign(new Error("bad filter"), { statusCode: 400 });
      },
      idOf: (o) => o.id,
      sleep: noSleep,
    }),
    (err: unknown) =>
      err instanceof ReconciliationFatal && err.errorClass === "run_fatal",
  );
});

test("A18d: a 401 during enumeration is run-fatal and not retried", async () => {
  let calls = 0;
  await assert.rejects(
    paginateAll<Obj>({
      fetchPage: async () => {
        calls += 1;
        throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
      },
      idOf: (o) => o.id,
      sleep: noSleep,
    }),
    ReconciliationFatal,
  );
  assert.equal(calls, 1, "an auth failure must not consume retries");
});

test("A7: retrying gives up after the attempt limit", async () => {
  let calls = 0;
  await assert.rejects(
    paginateAll<Obj>({
      fetchPage: async () => {
        calls += 1;
        throw Object.assign(new Error("always down"), { statusCode: 503 });
      },
      idOf: (o) => o.id,
      sleep: noSleep,
      random: noJitter,
    }),
    /after 8 attempt/,
  );
  assert.equal(calls, 8);
});

test("A11: the run-wide retry budget stops pagination", async () => {
  // The budget is per RUN, so one pathological list cannot spend what the rest of
  // the run still needs.
  await assert.rejects(
    paginateAll<Obj>({
      fetchPage: async () => {
        throw Object.assign(new Error("down"), { statusCode: 503 });
      },
      idOf: (o) => o.id,
      sleep: noSleep,
      random: noJitter,
      retriesSoFar: 99,
    }),
    /retry budget exhausted/,
  );
});

test("A7: Retry-After from the response header is honoured", async () => {
  const delays: number[] = [];
  let call = 0;
  await paginateAll<Obj>({
    fetchPage: async () => {
      call += 1;
      if (call === 1) {
        throw Object.assign(new Error("slow down"), {
          statusCode: 429,
          headers: { "retry-after": "3" },
        });
      }
      return { data: [], has_more: false };
    },
    idOf: (o) => o.id,
    sleep: async (ms) => {
      delays.push(ms);
    },
  });
  assert.deepEqual(delays, [3000]);
});

test("maxItems truncates and says so rather than pretending completeness", async () => {
  const f = fixture(100, 10);
  const res = await paginateAll<Obj>({
    fetchPage: f.fetchPage,
    idOf: (o) => o.id,
    limit: 10,
    maxItems: 25,
  });
  assert.equal(res.items.length, 25);
  assert.equal(res.truncated, true);
});

test("a fully-walked list is not marked truncated", async () => {
  const f = fixture(5, 10);
  const res = await paginateAll<Obj>({ fetchPage: f.fetchPage, idOf: (o) => o.id, limit: 10 });
  assert.equal(res.truncated, false);
});

test("the page limit is bounded by Stripe's own maximum", async () => {
  await assert.rejects(
    paginateAll<Obj>({
      fetchPage: async () => ({ data: [], has_more: false }),
      idOf: (o) => o.id,
      limit: 101,
    }),
    /limit must be 1\.\.100/,
  );
});
