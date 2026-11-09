import test from 'node:test';
import assert from 'node:assert/strict';
import { hostStartLabel, hostStartPhase, startBeat, startWords, startedLive } from '../src/features/room/start-progress';

test('a long start changes its words at 2.6 s and 5 s; a friend first reads who started', () => {
  assert.deepEqual([0, 2599, 2600, 4999, 5000, 60_000].map(startBeat), [0, 0, 1, 1, 2, 2]);
  assert.deepEqual([0, 1, 2].map((b) => startWords(b)), ['Starting…', 'Finding titles…', 'Almost ready…']);
  assert.deepEqual([0, 1, 2].map((b) => startWords(b, 'Alp')), ['Alp started', 'Finding titles…', 'Almost ready…']);
});

test('the host’s Start: the round arriving wins, a lost answer going out again still works, a failure reads Try again', () => {
  assert.equal(hostStartPhase({ attempt: null, retrying: false, ready: false }), 'idle');
  assert.equal(hostStartPhase({ attempt: 'starting', retrying: false, ready: false }), 'starting');
  assert.equal(hostStartPhase({ attempt: 'failed', retrying: true, ready: false }), 'starting');
  assert.equal(hostStartPhase({ attempt: 'failed', retrying: false, ready: false }), 'failed');
  // A saved start that went through by itself after the failure still hands over.
  assert.equal(hostStartPhase({ attempt: 'failed', retrying: false, ready: true }), 'ready');
  assert.equal(hostStartPhase({ attempt: 'starting', retrying: false, ready: true }), 'ready');
  assert.deepEqual((['idle', 'starting', 'ready', 'failed'] as const).map((p) => hostStartLabel(p, 1)), ['Start', 'Finding titles…', 'Ready', 'Try again']);
});

test('only a round that starts while the screen watches hands over; opening a running room doesn’t', () => {
  assert.equal(startedLive('setup', 'choosing'), true);
  assert.equal(startedLive(undefined, 'choosing'), false);
  assert.equal(startedLive('decided', 'choosing'), false);
  assert.equal(startedLive('choosing', 'decided'), false);
  assert.equal(startedLive('setup', 'setup'), false);
});
