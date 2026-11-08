import assert from 'node:assert/strict';
import test from 'node:test';
import { createAccountFlow, accountView } from '../src/core/continuous/account-flow';
import { RoomLinkGate, LINK_TRIES, linkOutcome } from '../src/features/room/link-gate';
import { RoomFailure } from '../src/core/continuous/api-client';

test('a second Continue with GoodWatch while one is starting joins it instead of starting another flow', async () => {
  const flow = createAccountFlow();
  const seen: boolean[] = [];
  flow.subscribe(() => seen.push(flow.snapshot().pending));
  let starts = 0;
  let finish!: (v: string) => void;
  const start = () => { starts++; return new Promise<string>((resolve) => { finish = resolve; }); };
  const first = flow.signIn(start);
  const second = flow.signIn(start);
  assert.equal(starts, 1, 'one OAuth flow, one intent, one verifier');
  assert.equal(flow.snapshot().pending, true);
  finish('done');
  assert.equal(await first, 'done');
  assert.equal(await second, 'done');
  assert.equal(flow.snapshot().pending, false);
  assert.deepEqual(seen, [true, false]);
  // A failed start frees the guard for the next press.
  await assert.rejects(flow.signIn(() => Promise.reject(new Error('nope'))));
  assert.equal(flow.snapshot().pending, false);
  await flow.signIn(async () => 'again');
  assert.equal(starts, 1);
});

test('the session generation moves when the sign-in changes, so rooms try linking again', () => {
  const flow = createAccountFlow();
  const g = flow.snapshot().generation;
  flow.bump();
  assert.equal(flow.snapshot().generation, g + 1);
});

test('a lapsed device sign-in keeps its name and asks to reconnect instead of turning into a guest', () => {
  assert.deepEqual(accountView({ state: 'member', displayName: 'Alper' }, null), { state: 'member', displayName: 'Alper', unavailable: false });
  assert.deepEqual(accountView({ state: 'member', displayName: 'Alper', unavailable: true }, 'Alper'), { state: 'member', displayName: 'Alper', unavailable: true });
  assert.deepEqual(accountView({ state: 'guest', displayName: null }, 'Alper'), { state: 'lapsed', displayName: 'Alper', unavailable: false });
  assert.deepEqual(accountView({ state: 'guest', displayName: null }, null), { state: 'guest', displayName: null, unavailable: false });
});

test('room linking: one request in flight, bounded retries on transient errors, none after a refusal', () => {
  const gate = new RoomLinkGate();
  const key = 'p1:none:1';
  assert.deepEqual(gate.begin(key, 0), { send: true });
  assert.deepEqual(gate.begin(key, 0), { send: false, retryInMs: null }, 'in flight: no duplicate');
  let now = 0;
  for (let i = 1; i < LINK_TRIES; i++) {
    gate.settle(key, 'transient', now);
    const wait = gate.begin(key, now);
    assert.equal(wait.send, false);
    assert.ok(!wait.send && wait.retryInMs !== null && wait.retryInMs > 0);
    now += (wait as { retryInMs: number }).retryInMs;
    assert.deepEqual(gate.begin(key, now), { send: true });
  }
  gate.settle(key, 'transient', now);
  assert.deepEqual(gate.begin(key, now + 60_000), { send: false, retryInMs: null }, 'retries are bounded');
  assert.equal(gate.failed(key), true, 'the room says linking failed');
  gate.retry(key);
  assert.equal(gate.failed(key), false);
  assert.deepEqual(gate.begin(key, now), { send: true }, 'Retry tries again');
  gate.settle(key, 'refused', now);
  assert.deepEqual(gate.begin(key, now + 60_000), { send: false, retryInMs: null });
  assert.equal(gate.failed(key), false, 'a refusal is handled elsewhere (sign in again / other account)');
});

test('room linking starts over when the device session changes (re-auth in the same mounted room)', () => {
  const gate = new RoomLinkGate();
  assert.deepEqual(gate.begin('p1:expired:1', 0), { send: true });
  gate.settle('p1:expired:1', 'refused', 0);
  assert.deepEqual(gate.begin('p1:expired:1', 1), { send: false, retryInMs: null });
  assert.deepEqual(gate.begin('p1:expired:2', 1), { send: true });
  gate.settle('p1:expired:1', 'transient', 2);
  assert.deepEqual(gate.begin('p1:expired:2', 2), { send: false, retryInMs: null }, 'a late answer for the old session changes nothing');
});

test('link failures sort into transient (network, busy) and refused (sign in again, other account)', () => {
  assert.equal(linkOutcome(new TypeError('Network request failed')), 'transient');
  assert.equal(linkOutcome(new RoomFailure('busy', 'GoodWatch is temporarily unavailable', 503, undefined, undefined, true)), 'transient');
  assert.equal(linkOutcome(new RoomFailure('outcome_unknown', 'No answer')), 'transient');
  assert.equal(linkOutcome(new RoomFailure('member_required', 'Sign in with GoodWatch again', 403)), 'refused');
  assert.equal(linkOutcome(new RoomFailure('conflict', 'another account', 409)), 'refused');
});
