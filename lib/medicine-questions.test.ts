import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMedicineQuestions,
  QFTM_PREFIX,
  MEDICINE_QUESTION_SECTIONS,
} from "./medicine-questions.ts";

test("extractMedicineQuestions groups non-empty answers by section, drops empties", () => {
  const responses = {
    "qftm-s0-q0": "How do I heal my back?",
    "qftm-s0-q1": "   ", // whitespace only → dropped
    "qftm-s1-q0": "What am I not seeing?",
    "other-key": "not a medicine question",
    "pre-pne-reflection-w0": "unrelated journal text",
  };
  const groups = extractMedicineQuestions(responses);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, MEDICINE_QUESTION_SECTIONS[0].label);
  assert.deepEqual(groups[0].questions, ["How do I heal my back?"]);
  assert.equal(groups[1].label, MEDICINE_QUESTION_SECTIONS[1].label);
  assert.deepEqual(groups[1].questions, ["What am I not seeing?"]);
});

test("extractMedicineQuestions returns [] for empty/null/undefined", () => {
  assert.deepEqual(extractMedicineQuestions(null), []);
  assert.deepEqual(extractMedicineQuestions(undefined), []);
  assert.deepEqual(extractMedicineQuestions({}), []);
});

test("extractMedicineQuestions ignores non-qftm keys entirely (no leakage)", () => {
  const groups = extractMedicineQuestions({
    "w0-p1": "journal answer",
    "post-pne-reflection-w1": "pne answer",
  });
  assert.deepEqual(groups, []);
});

test("QFTM prefix and section shape are stable", () => {
  assert.equal(QFTM_PREFIX, "qftm-");
  assert.equal(MEDICINE_QUESTION_SECTIONS.length, 5);
  for (const s of MEDICINE_QUESTION_SECTIONS) {
    assert.equal(typeof s.label, "string");
    assert.equal(typeof s.count, "number");
  }
});
