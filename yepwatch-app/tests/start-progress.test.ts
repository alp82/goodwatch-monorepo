import test from 'node:test';
import assert from 'node:assert/strict';
import { hostStartLabel, hostStartPhase, startBeat, startWords, startedLive } from '../src/features/room/start-progress';

test('a long start changes its words at 2.6 s and 5 s', () => {
  assert.deepEqual([0, 2599, 2600, 4999, 5000, 60_000].map(startBeat), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual([0, 1, 2].map((b) => startWords(b)), ['Starting…', 'Finding titles…', 'Almost ready…']);
});

test('the host’s Start: a lost answer going out again still works, a failure reads Try again', () => {
  assert.equal(hostStartPhase({ attempt: null, retrying: false }), 'idle');
  assert.equal(hostStartPhase({ attempt: 'starting', retrying: false }), 'starting');
  assert.equal(hostStartPhase({ attempt: 'failed', retrying: true }), 'starting');
  assert.equal(hostStartPhase({ attempt: 'failed', retrying: false }), 'failed');
  assert.deepEqual((['idle', 'starting', 'failed'] as const).map((p) => hostStartLabel(p, 1)), ['Start', 'Finding titles…', 'Try again']);
});

test('only a round that starts while the screen watches plays the first card’s entry; opening a running room doesn’t', () => {
  assert.equal(startedLive('setup', 'choosing'), true);
  assert.equal(startedLive(undefined, 'choosing'), false);
  assert.equal(startedLive('decided', 'choosing'), false);
  assert.equal(startedLive('choosing', 'decided'), false);
  assert.equal(startedLive('setup', 'setup'), false);
});
