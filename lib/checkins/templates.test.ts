import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toEditorQuestions,
  newEditorQuestion,
  buildQuestionsPayload,
  type EditorQuestion,
} from "./templates.ts";
import { parseQuestionsSnapshot, validateResponses } from "./questions.ts";

const SEED = [
  { key: "overall", type: "scale", label: "How has this week been overall?", min: 1, max: 5, required: true },
  { key: "notes", type: "text", label: "Anything you would like your care team to know?", required: false },
];

test("the active template round-trips: load into the editor, publish unchanged", () => {
  const rows = toEditorQuestions(SEED);
  assert.deepEqual(rows, [
    { key: "overall", label: "How has this week been overall?", type: "scale", required: true },
    { key: "notes", label: "Anything you would like your care team to know?", type: "text", required: false },
  ]);
  const payload = buildQuestionsPayload(rows);
  assert.ok(payload.ok);
  if (payload.ok) assert.deepEqual(payload.questions, SEED);
});

test("edited text, type and required flags survive into the payload", () => {
  const rows = toEditorQuestions(SEED);
  rows[0].label = "How are you doing this week?";
  rows[1].type = "scale";
  rows[1].required = true;
  const payload = buildQuestionsPayload(rows);
  assert.ok(payload.ok);
  if (payload.ok) {
    assert.equal(payload.questions[0].label, "How are you doing this week?");
    assert.equal(payload.questions[0].key, "overall", "an edited question keeps its key");
    assert.deepEqual(payload.questions[1], {
      key: "notes", type: "scale", label: "Anything you would like your care team to know?",
      min: 1, max: 5, required: true,
    });
  }
});

test("added questions get unique keys; removal is plain array removal", () => {
  const rows = toEditorQuestions(SEED);
  const added = newEditorQuestion(rows);
  assert.equal(added.type, "text");
  assert.ok(!rows.some((r) => r.key === added.key), "fresh key");
  const twice = newEditorQuestion([...rows, added]);
  assert.notEqual(twice.key, added.key);

  const afterRemove = rows.filter((r) => r.key !== "notes");
  const payload = buildQuestionsPayload(afterRemove);
  assert.ok(payload.ok);
  if (payload.ok) assert.deepEqual(payload.questions.map((q) => q.key), ["overall"]);
});

test("validation: empty set, blank labels, bad types, duplicate keys are all named", () => {
  assert.ok(!buildQuestionsPayload([]).ok);

  const blank: EditorQuestion[] = [{ key: "a", label: "   ", type: "text", required: false }];
  const r1 = buildQuestionsPayload(blank);
  assert.ok(!r1.ok);
  if (!r1.ok) assert.match(r1.errors[0], /Question 1 needs its text/);

  const badType = [{ key: "a", label: "Hi", type: "multiselect" as never, required: false }];
  assert.ok(!buildQuestionsPayload(badType).ok);

  const dupes: EditorQuestion[] = [
    { key: "a", label: "One", type: "text", required: false },
    { key: "a", label: "Two", type: "text", required: false },
  ];
  const r2 = buildQuestionsPayload(dupes);
  assert.ok(!r2.ok);
  if (!r2.ok) assert.match(r2.errors[0], /unique key/);
});

test("what the editor publishes is exactly what the member renderer and validator accept", () => {
  const rows: EditorQuestion[] = [
    { key: "mood", label: "How is your heart today?", type: "scale", required: true },
    { key: "words", label: "Any words for the team?", type: "text", required: false },
  ];
  const payload = buildQuestionsPayload(rows);
  assert.ok(payload.ok);
  if (!payload.ok) return;
  const rendered = parseQuestionsSnapshot(payload.questions);
  assert.equal(rendered.length, 2, "the renderer accepts every published question");
  const submission = validateResponses(rendered, { mood: 3, words: "mahalo" });
  assert.ok(submission.ok, "the submit validator accepts answers to the published set");
});
