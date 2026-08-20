/**
 * PR 3B — canary containment (acceptance 18g).
 *
 * The rule that bounds how much live money the FIRST writing run for a given
 * (livemode, implementation_version) can touch, so it is executed rather than
 * trusted to a comment.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canaryWindowEnd,
  CANARY_MAX_SPAN_MS,
} from "../../../app/api/finance/reconciliation/route.ts";

const at = (iso: string) => new Date(iso);

test("A18g: a canary is capped at 24 hours even when the approved window is longer", () => {
  // The dry run may legitimately have rehearsed 90 days. The canary must not
  // write across all of it on the first attempt.
  const start = at("2026-05-01T00:00:00Z");
  const approvedEnd = at("2026-08-01T00:00:00Z");
  const end = canaryWindowEnd(start, approvedEnd);
  assert.equal(end.toISOString(), "2026-05-02T00:00:00.000Z");
  assert.equal(end.getTime() - start.getTime(), CANARY_MAX_SPAN_MS);
});

test("A18g: a canary never extends beyond the approved window", () => {
  // Containment is the point: a window_end past what the founder approved would
  // write over objects the dry run never examined or reported.
  const start = at("2026-08-01T00:00:00Z");
  const approvedEnd = at("2026-08-01T06:00:00Z");
  const end = canaryWindowEnd(start, approvedEnd);
  assert.equal(end.toISOString(), approvedEnd.toISOString());
  assert.ok(end <= approvedEnd);
});

test("A18g: an exactly-24-hour approved window is preserved intact", () => {
  const start = at("2026-08-01T00:00:00Z");
  const approvedEnd = at("2026-08-02T00:00:00Z");
  assert.equal(canaryWindowEnd(start, approvedEnd).toISOString(), approvedEnd.toISOString());
});

test("the capped window is always non-empty for a valid approved window", () => {
  // start_reconciliation_run rejects window_start >= window_end, so the cap must
  // never invert a window that was valid before it.
  for (const hours of [0.5, 1, 23, 24, 25, 1000]) {
    const start = at("2026-08-01T00:00:00Z");
    const approvedEnd = new Date(start.getTime() + hours * 3_600_000);
    assert.ok(
      canaryWindowEnd(start, approvedEnd) > start,
      `a ${hours}h approved window produced an empty canary window`,
    );
  }
});
