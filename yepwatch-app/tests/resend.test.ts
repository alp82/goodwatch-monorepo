import test from 'node:test';
import assert from 'node:assert/strict';
import { QUIET_OUTAGE_MS } from '../src/core/continuous/backoff';
import { RoomFailure } from '../src/core/continuous/api-client';
import { definitiveRefusal, incompleteAnswer, resendable, resendUntilAnswered } from '../src/core/continuous/resend';

const diagnostic = (reason: 'timeout' | 'response', status: number) => ({ stage: 'response' as const, reason, status, elapsedMs: 6000 });
const unread = (status: number, reason: 'timeout' | 'response') =>
  new RoomFailure('outcome_unknown', 'Your action has not been confirmed.', status, undefined, undefined, false, undefined, diagnostic(reason, status));

test('200 headers whose body stalled or dropped: uncertain and sent again, never a refusal', () => {
  for (const error of [unread(200, 'timeout'), unread(200, 'response'), unread(201, 'response')]) {
    assert.equal(incompleteAnswer(error), true);
    assert.equal(resendable(error), true);
    assert.equal(definitiveRefusal(error), false);
  }
  // Any status whose body stalled past the wait: no API answer was read.
  assert.equal(resendable(unread(409, 'timeout')), true);
  assert.equal(definitiveRefusal(unread(409, 'timeout')), false);
});

test('only a parsed API refusal is definitive; an unreadable 4xx page is neither final nor resent by itself', () => {
  assert.equal(definitiveRefusal(new RoomFailure('limit_reached', 'Room is full', 409)), true);
  assert.equal(definitiveRefusal(new RoomFailure('rate_limited', 'Slow down', 429, undefined, undefined, false, 30)), true);
  const proxyPage = unread(403, 'response');
  assert.equal(definitiveRefusal(proxyPage), false);
  assert.equal(resendable(proxyPage), false);
});

test('a request still unanswered after the quiet period is trouble from when it began; the answer comes later', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1000 });
  const troubles: number[] = [];
  let answer!: () => void;
  const running = resendUntilAnswered(() => new Promise<void>((resolve) => { answer = resolve; }), {
    signal: new AbortController().signal, onTrouble: (since) => troubles.push(since),
  });
  t.mock.timers.tick(QUIET_OUTAGE_MS - 1);
  assert.deepEqual(troubles, [], 'nothing under 3 s');
  t.mock.timers.tick(1);
  assert.deepEqual(troubles, [1000], 'at 3 s, while the request still hangs, from when it began');
  answer();
  assert.equal(await running, true);
  t.mock.timers.tick(60000);
  assert.deepEqual(troubles, [1000], 'heard once');
});

test('a prompt answer is no trouble at all', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const troubles: number[] = [];
  let answer!: () => void;
  const running = resendUntilAnswered(() => new Promise<void>((resolve) => { answer = resolve; }), {
    signal: new AbortController().signal, onTrouble: (since) => troubles.push(since),
  });
  t.mock.timers.tick(QUIET_OUTAGE_MS - 100);
  answer();
  assert.equal(await running, true);
  t.mock.timers.tick(60000);
  assert.deepEqual(troubles, []);
});

test('a hanging request cut off by the background before 3 s tells the page nothing', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const troubles: number[] = [];
  const controller = new AbortController();
  const running = resendUntilAnswered(() => new Promise<void>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
  }), { signal: controller.signal, onTrouble: (since) => troubles.push(since) });
  t.mock.timers.tick(1000);
  controller.abort();
  assert.equal(await running, false);
  t.mock.timers.tick(60000);
  assert.deepEqual(troubles, []);
});

test('a Retry-After that lands as the app leaves the front is kept before the send stops', async () => {
  const controller = new AbortController();
  const waits: number[] = [];
  const before = Date.now();
  const answered = await resendUntilAnswered(async () => {
    controller.abort();
    throw new RoomFailure('busy', 'Busy', 503, undefined, undefined, true, 60);
  }, { signal: controller.signal, onServerWait: async (until) => { waits.push(until); } });
  assert.equal(answered, false);
  assert.equal(waits.length, 1);
  assert.ok(waits[0] >= before + 60000 && waits[0] <= Date.now() + 60000, `the deadline is the server's (${waits[0] - before} ms)`);
});
