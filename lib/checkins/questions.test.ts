import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseQuestionsSnapshot,
  validateResponses,
  MAX_TEXT_ANSWER_LENGTH,
} from "./questions.ts";

// The Build 1 seed shape, verbatim — what real snapshots look like today.
const SEED_SNAPSHOT = [
  { key: "overall", type: "scale", label: "How has this week been overall?", min: 1, max: 5, required: true },
  { key: "body", type: "scale", label: "How is your body feeling?", min: 1, max: 5, required: true },
  { key: "notes", type: "text", label: "Anything you would like your care team to know?", required: false },
];

test("parseQuestionsSnapshot accepts the seeded shape verbatim", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  assert.equal(qs.length, 3);
  assert.deepEqual(qs.map((q) => q.key), ["overall", "body", "notes"]);
  assert.equal(qs[0].type, "scale");
  assert.equal(qs[2].type, "text");
  assert.equal(qs[0].required, true);
  assert.equal(qs[2].required, false);
});

test("parseQuestionsSnapshot drops malformed and unknown entries, keeps the rest", () => {
  const qs = parseQuestionsSnapshot([
    ...SEED_SNAPSHOT,
    { key: "future", type: "multiselect", label: "A type this build does not know" },
    { type: "text", label: "no key" },
    { key: "nolabel", type: "text" },
    { key: "badscale", type: "scale", label: "min above max", min: 5, max: 1 },
    "not an object",
    null,
  ]);
  assert.deepEqual(qs.map((q) => q.key), ["overall", "body", "notes"]);
});

test("parseQuestionsSnapshot returns [] for non-array snapshots", () => {
  assert.deepEqual(parseQuestionsSnapshot(null), []);
  assert.deepEqual(parseQuestionsSnapshot({}), []);
  assert.deepEqual(parseQuestionsSnapshot("[]"), []);
});

test("a complete valid submission passes and is returned cleaned", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  const result = validateResponses(qs, { overall: 4, body: 3, notes: "  steadier this week  " });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.responses, { overall: 4, body: 3, notes: "steadier this week" });
  }
});

test("an omitted optional question is simply absent from the stored answers", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  const result = validateResponses(qs, { overall: 5, body: 2 });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.responses, { overall: 5, body: 2 });
});

test("a missing required answer fails with its question named", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  const result = validateResponses(qs, { overall: 4 });
  assert.ok(!result.ok);
  if (!result.ok) {
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /How is your body feeling\?/);
  }
});

test("scale answers must be integers inside the question's own range", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  for (const bad of [0, 6, 3.5, "4", true]) {
    const result = validateResponses(qs, { overall: bad, body: 3 });
    assert.ok(!result.ok, `expected ${JSON.stringify(bad)} to be rejected`);
  }
  // The range comes from the snapshot, so a 1-10 question accepts 10.
  const wide = parseQuestionsSnapshot([
    { key: "wide", type: "scale", label: "Wide", min: 1, max: 10, required: true },
  ]);
  assert.ok(validateResponses(wide, { wide: 10 }).ok);
});

test("unknown keys in the payload are discarded, never stored", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  const result = validateResponses(qs, { overall: 4, body: 3, injected: "surprise" });
  assert.ok(result.ok);
  if (result.ok) assert.equal("injected" in result.responses, false);
});

test("text answers are bounded and must be strings", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  const tooLong = validateResponses(qs, {
    overall: 4,
    body: 3,
    notes: "x".repeat(MAX_TEXT_ANSWER_LENGTH + 1),
  });
  assert.ok(!tooLong.ok);
  const wrongType = validateResponses(qs, { overall: 4, body: 3, notes: 7 });
  assert.ok(!wrongType.ok);
});

test("non-object payloads are rejected outright", () => {
  const qs = parseQuestionsSnapshot(SEED_SNAPSHOT);
  for (const bad of [null, [], "answers", 4]) {
    assert.ok(!validateResponses(qs, bad).ok);
  }
});
