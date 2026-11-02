import test from 'node:test';
import assert from 'node:assert/strict';
import { abortableSleep, backoffDelay, retryTransient, serverWait, transientFailure } from '../src/core/continuous/backoff';
import { RoomFailure } from '../src/core/continuous/api-client';

const busy = () => new RoomFailure('busy', 'Service unavailable', 503, undefined, undefined, true, 2);
const offline = () => new RoomFailure('outcome_unknown', 'Your action has not been confirmed.');

test('backoff doubles from 1 s to a 15 s cap, then adds 0-30 % jitter', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 40].map((n) => backoffDelay(n, () => 0)), [1000, 2000, 4000, 8000, 15000, 15000, 15000]);
  assert.equal(backoffDelay(0, () => 0.5), 1150);
  assert.equal(backoffDelay(2, () => 1), 5200);
  assert.equal(backoffDelay(4, () => 1), 19500, 'the jittered wait may pass the cap by up to 30 %');
  // Capped attempts still spread out instead of piling up exactly on 15 s.
  const capped = new Set(Array.from({ length: 50 }, (_, i) => backoffDelay(9, () => i / 50)));
  assert.ok(capped.size > 40);
  for (const ms of capped) assert.ok(ms >= 15000 && ms <= 19500);
});

test('a server floor replaces a shorter step, keeps its jitter, and is never undercut', () => {
  assert.equal(backoffDelay(0, () => 0, 10000), 10000);
  const floored = new Set(Array.from({ length: 50 }, (_, i) => backoffDelay(0, () => i / 50, 10000)));
  assert.ok(floored.size > 40, 'a 10 s floor no longer makes every attempt exactly 10 s');
  for (const ms of floored) assert.ok(ms >= 10000 && ms <= 13000);
  assert.equal(backoffDelay(0, () => 0, 60000), 60000, 'a long Retry-After is honoured, not capped');
  assert.equal(backoffDelay(4, () => 0, 500), 15000, 'a shorter floor leaves the step');
});

test('serverWait reads Retry-After from answered requests, including 429', () => {
  assert.equal(serverWait(new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 30)), 30000);
  assert.equal(serverWait(new RoomFailure('busy', 'Busy', 503, undefined, undefined, true, 2)), 2000);
  assert.equal(serverWait(offline()), 0, 'no answer, no server deadline');
  assert.equal(serverWait(new Error('x')), 0);
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
  }, { retries: 5, retryAt: () => 1000 + 2000, now: () => 1000, random: () => 0, sleep: async (ms) => { waits.push(ms); } });
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
  const controller = new AbortController();
  const result = await retryTransient(async () => { calls++; throw busy(); }, { retries: 3, retryAt: () => 0, sleep: async () => { controller.abort(); }, signal: controller.signal });
  assert.equal(result, false);
  assert.equal(calls, 1);
});

test('aborting ends a pending wait at once, clears its timer, and starts no further attempt', async () => {
  const controller = new AbortController();
  let calls = 0;
  const started = Date.now();
  const run = retryTransient(async (signal) => { calls++; assert.equal(signal, controller.signal); throw offline(); }, { retries: 5, retryAt: () => 0, signal: controller.signal, random: () => 0 });
  await new Promise((r) => setTimeout(r, 20));
  controller.abort();
  assert.equal(await run, false);
  assert.ok(Date.now() - started < 900, 'did not sit out the 1 s wait');
  assert.equal(calls, 1);
  // An attempt that fails because it was aborted is not reported as an error.
  const late = new AbortController();
  assert.equal(await retryTransient(async () => { late.abort(); throw offline(); }, { retries: 5, retryAt: () => 0, signal: late.signal }), false);
  // A signal aborted before the start sends nothing.
  calls = 0;
  assert.equal(await retryTransient(async () => { calls++; }, { retries: 5, retryAt: () => 0, signal: late.signal }), false);
  assert.equal(calls, 0);
  // The sleep itself resolves early and leaves no timer behind.
  const quick = new AbortController();
  const sleeping = abortableSleep(60_000, quick.signal);
  quick.abort();
  await sleeping;
});
