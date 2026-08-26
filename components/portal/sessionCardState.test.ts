import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeError, sessionRowState, shouldShowRow } from './sessionCardState.ts';

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

// ── console diagnostics must be structurally unable to leak ─────────────────

test('describeError keeps name, code, and message', () => {
  const err = Object.assign(new Error('permission denied for table x'), { code: 'PGRST301' });
  assert.equal(describeError(err), 'Error PGRST301: permission denied for table x');
});

test('describeError uses status when code is absent, and handles strings', () => {
  assert.equal(
    describeError({ name: 'AuthApiError', status: 401, message: 'Invalid token' }),
    'AuthApiError 401: Invalid token',
  );
  assert.equal(describeError('boom'), 'Error: boom');
  assert.equal(describeError(undefined), 'Error: unknown error');
});

test('describeError NEVER emits emails, ids, tokens, URLs, or response payloads carried on the error', () => {
  const hostile = {
    name: 'FetchError',
    message: 'request failed',
    email: 'member@example.com',
    member_id: '9545409f-82f9-42a4-9941-9d4b0d26cb64',
    access_token: 'eyJhbGciOi.SECRET.TOKEN',
    booking_url: 'https://calendly.com/d/secret-single-use',
    response: { data: [{ email: 'member@example.com', quantity: 10 }] },
    stack: 'at getSessionBalances (eyJSECRET)',
  };
  const out = describeError(hostile);
  assert.equal(out, 'FetchError: request failed');
  for (const leak of ['member@example.com', '9545409f', 'eyJ', 'calendly.com', 'quantity']) {
    assert.doesNotMatch(out, new RegExp(leak));
  }
});

test('describeError caps runaway messages at 300 characters', () => {
  const out = describeError(new Error('x'.repeat(2000)));
  assert.equal(out.length, 300);
});
