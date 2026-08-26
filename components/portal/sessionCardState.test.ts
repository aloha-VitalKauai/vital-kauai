import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionRowState, shouldShowRow } from './sessionCardState.ts';

test('sessions remaining reads plainly and allows booking', () => {
  assert.deepEqual(sessionRowState({ remaining: 7 }), {
    label: '7 sessions left',
    canBook: true,
  });
});

test('a single remaining session is singular', () => {
  assert.deepEqual(sessionRowState({ remaining: 1 }), {
    label: '1 session left',
    canBook: true,
  });
});

test('none remaining disables booking without an error tone', () => {
  assert.deepEqual(sessionRowState({ remaining: 0 }), {
    label: '0 sessions left',
    canBook: false,
  });
});

test('a negative balance can never present as bookable', () => {
  assert.deepEqual(sessionRowState({ remaining: -2 }), {
    label: '0 sessions left',
    canBook: false,
  });
});

test('an unconfigured session type reads as coming soon, never as an error', () => {
  const state = sessionRowState({ remaining: 4, unavailable: true });
  assert.deepEqual(state, { label: 'Scheduling coming soon', canBook: false });
  assert.doesNotMatch(state.label, /error|503|fail|unavailable/i);
});

test('unavailable outranks a zero balance', () => {
  assert.equal(
    sessionRowState({ remaining: 0, unavailable: true }).label,
    'Scheduling coming soon',
  );
});

test('a row is shown only for session types the member was actually granted', () => {
  assert.equal(shouldShowRow(6), true);
  assert.equal(shouldShowRow(0), false);
});

test('a member who used every session still sees their row', () => {
  // granted 10, all booked → remaining 0, but the row belongs to them.
  assert.equal(shouldShowRow(10), true);
  assert.equal(sessionRowState({ remaining: 0 }).label, '0 sessions left');
});
