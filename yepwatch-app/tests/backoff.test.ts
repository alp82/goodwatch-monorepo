import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffDelay, retryTransient, transientFailure } from '../src/core/continuous/backoff';
import { RoomFailure } from '../src/core/continuous/api-client';

const busy = () => new RoomFailure('busy', 'Service unavailable', 503, undefined, undefined, true, 2);
const offline = () => new RoomFailure('outcome_unknown', 'Your action has not been confirmed.');

test('backoff doubles from 1 s to a 15 s cap with ±20 % jitter and honours a server floor', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 40].map((n) => backoffDelay(n, () => 0.5)), [1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  assert.equal(backoffDelay(0, () => 0), 800);
  assert.equal(backoffDelay(2, () => 0.999999), 4800);
  assert.equal(backoffDelay(4, () => 0.999999), 15000, 'jitter never passes the cap');
  assert.equal(backoffDelay(0, () => 0.5, 5000), 5000);
  assert.equal(backoffDelay(0, () => 0.5, 60000), 15000, 'a server floor is capped too');
});

test('transient failures are busy, retryable, and unanswered requests; refusals and rate limits are not', () => {
  assert.equal(transientFailure(busy()), true);
  assert.equal(transientFailure(offline()), true);
  assert.equal(transientFailure(new RoomFailure('outcome_unknown', 'proxy page', 502)), true);
  assert.equal(transientFailure(new RoomFailure('outcome_unknown', 'proxy 404 page', 404)), true);
  assert.equal(transientFailure(new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 2)), false);
  assert.equal(transientFailure(new RoomFailure('invalid_request', 'Bad', 400)), false);
  assert.equal(transientFailure(new RoomFailure('not_found', 'Gone', 404)), false);
  assert.equal(transientFailure(new Error('storage unavailable')), false);
  assert.equal(transientFailure('busy'), false);
});

test('retryTransient sends the same attempt again after two busy answers and waits at least the server delay', async () => {
  const waits: number[] = [];
  let calls = 0;
  const ok = await retryTransient(async () => {
    if (++calls <= 2) throw busy();
  }, { retries: 5, retryAt: () => 1000 + 2000, now: () => 1000, random: () => 0.5, sleep: async (ms) => { waits.push(ms); } });
  assert.equal(ok, true);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [2000, 2000]);
});

test('retryTransient stops after its retries, on a refusal, on a long server pause, and when the screen goes away', async () => {
  const sleep = async () => undefined;
  let calls = 0;
  await assert.rejects(retryTransient(async () => { calls++; throw offline(); }, { retries: 3, retryAt: () => 0, sleep }), /not been confirmed/);
  assert.equal(calls, 4);
  calls = 0;
  await assert.rejects(retryTransient(async () => { calls++; throw new RoomFailure('invalid_request', 'Bad', 400); }, { retries: 3, retryAt: () => 0, sleep }));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(retryTransient(async () => { calls++; throw busy(); }, { retries: 3, retryAt: () => 60_000, now: () => 0, sleep }));
  assert.equal(calls, 1, 'a Retry-After longer than one step is left to the manual countdown');
  calls = 0;
  let alive = true;
  const result = await retryTransient(async () => { calls++; throw busy(); }, { retries: 3, retryAt: () => 0, sleep: async () => { alive = false; }, alive: () => alive });
  assert.equal(result, false);
  assert.equal(calls, 1);
});
