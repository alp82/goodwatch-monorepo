import test from 'node:test';
import assert from 'node:assert/strict';
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
