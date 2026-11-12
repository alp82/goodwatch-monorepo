import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_ARRIVALS, claimLiveBeat, releaseLiveBeat, someoneJoined, trackArrivals } from '../src/features/shell/live-beat';
import { loadIsolated } from './isolated-module';

type End = (result: { finished: boolean }) => void;
/** A stand-in for react-native's Animated that records the loop it's asked for. */
function fakeAnimated() {
  const calls: { loop?: { iterations?: number }; timing?: { toValue: number; useNativeDriver: boolean }; values: number[]; end?: End; stopped: number } = { values: [], stopped: 0 };
  const Animated = {
    timing: (_value: unknown, config: { toValue: number; useNativeDriver: boolean }) => { calls.timing = config; return {}; },
    loop: (_animation: unknown, config: { iterations?: number }) => {
      calls.loop = config;
      return { start: (end: End) => { calls.end = end; }, stop: () => { calls.stopped++; } };
    },
  };
  const Easing = { out: (f: unknown) => f, quad: () => 0 };
  const { playLivePulse, LIVE_PULSE } = loadIsolated<typeof import('../src/features/shell/live-pulse')>(
    new URL('../src/features/shell/live-pulse.ts', import.meta.url), { 'react-native': { Animated, Easing } });
  const ring = { setValue: (v: number) => calls.values.push(v) };
  return { calls, playLivePulse, LIVE_PULSE, ring: ring as never };
}

test('the live dot rings exactly three times as one finite native loop, then ends', () => {
  const { calls, playLivePulse, LIVE_PULSE, ring } = fakeAnimated();
  let done = 0;
  playLivePulse(ring, true, () => done++);
  assert.equal(LIVE_PULSE.rings, 3);
  assert.equal(calls.loop?.iterations, 3, 'a finite loop: no iterations means forever');
  assert.equal(calls.timing?.useNativeDriver, true);
  assert.equal(calls.timing?.toValue, 1);
  assert.deepEqual([...calls.values], [0], 'each start begins from the first ring');
  calls.end?.({ finished: true });
  assert.equal(done, 1);
});

test('a stopped ring (a join restarting it, the header leaving) does not count as ended', () => {
  const { calls, playLivePulse, ring } = fakeAnimated();
  let done = 0;
  const stop = playLivePulse(ring, false, () => done++);
  stop();
  calls.end?.({ finished: false });
  assert.equal(calls.stopped, 1);
  assert.equal(done, 0);
});

test('the room opening is not a join; someone new, or someone coming back, is', () => {
  assert.equal(someoneJoined(null, ['a']), false);
  assert.equal(someoneJoined(new Set(['a']), ['a']), false);
  assert.equal(someoneJoined(new Set(['a', 'b']), ['a']), false, 'leaving is not joining');
  assert.equal(someoneJoined(new Set(['a']), ['a', 'b']), true);
});

test('arrivals count joins and keep the same state while nobody comes or goes', () => {
  const opened = trackArrivals(NO_ARRIVALS, ['me']);
  assert.equal(opened.joins, 0);
  assert.equal(trackArrivals(opened, ['me']), opened, 'unchanged people: the same object (no re-render)');
  const joined = trackArrivals(opened, ['me', 'b']);
  assert.equal(joined.joins, 1);
  assert.equal(trackArrivals(joined, ['b', 'me']), joined, 'order does not matter');
  const left = trackArrivals(joined, ['me']);
  assert.equal(left.joins, 1, 'leaving rings nothing');
  assert.equal(trackArrivals(left, ['me', 'b']).joins, 2, 'coming back rings again');
});

test('a beat rings once across headers; a beat cut short may ring in the next header', () => {
  const beat = `room-test:${Math.random()}`;
  assert.equal(claimLiveBeat(beat), true);
  assert.equal(claimLiveBeat(beat), false, 'the next room page shows a solid dot');
  releaseLiveBeat(beat);
  assert.equal(claimLiveBeat(beat), true);
});
