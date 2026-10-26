import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, between, newCheerSeed } from '../src/features/glow/cheer/random';
import { kernelPath, KERNEL } from '../src/features/glow/cheer/popcorn-path';
import { marqueeBulbs, chaseRange } from '../src/features/glow/cheer/marquee-geometry';
import {
  CHEER_TIMING,
  bonusVisible,
  idleGesture,
  nextTickDelay,
  pressGesture,
  releaseGesture,
  tickGesture,
} from '../src/features/glow/cheer/timing';

const poster = { x: 80, y: 120, width: 220, height: 330 };

test('mulberry32 is deterministic per seed and differs across seeds', () => {
  const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
  const sa = Array.from({ length: 20 }, a), sb = Array.from({ length: 20 }, b), sc = Array.from({ length: 20 }, c);
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  assert.ok(sa.every((v) => v >= 0 && v < 1));
  const r = mulberry32(7);
  for (let i = 0; i < 100; i++) { const v = between(r, 3, 5); assert.ok(v >= 3 && v <= 5); }
});

test('cheer seeds stay inside the protocol range', () => {
  for (let i = 0; i < 200; i++) { const s = newCheerSeed(); assert.ok(Number.isInteger(s) && s >= 0 && s <= 2147483647); }
});

test('kernels fall past the poster lower edge, fade out and never rest', () => {
  for (let seed = 1; seed < 400; seed++) {
    const p = kernelPath(mulberry32(seed), poster);
    const bottom = poster.y + poster.height;
    const last = p.frames.at(-1)!;
    assert.ok(p.size >= KERNEL.minSize && p.size <= KERNEL.maxSize, 'size bounds');
    assert.ok(p.y0 + last.y > bottom + 40, `seed ${seed} ends below the poster edge`);
    assert.equal(last.opacity, 0);
    assert.ok(p.duration > 0);
    for (let i = 1; i < p.frames.length; i++) {
      const a = p.frames[i - 1], b = p.frames[i];
      assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 0.5, 'no resting between samples');
      assert.ok(b.t > a.t, 'ordered input range');
    }
    assert.ok(p.x0 >= poster.x - p.size && p.x0 <= poster.x + poster.width, 'starts over the poster');
  }
});

test('the same seed draws the same burst on every device; another seed draws a different one', () => {
  const draw = (seed: number) => { const r = mulberry32(seed); return [kernelPath(r, poster), kernelPath(r, poster)]; };
  assert.deepEqual(draw(9001), draw(9001));
  assert.notDeepEqual(draw(9001)[0].x0, draw(9002)[0].x0);
});

test('marquee bulbs ring the poster outside its frame with ordered chase ranges', () => {
  const bulbs = marqueeBulbs(poster);
  assert.ok(bulbs.length >= 16);
  for (const b of bulbs) {
    const inside = b.x > poster.x && b.x < poster.x + poster.width && b.y > poster.y && b.y < poster.y + poster.height;
    assert.ok(!inside, 'bulbs sit outside the poster');
  }
  bulbs.forEach((_, k) => {
    const { inputRange } = chaseRange(k, bulbs.length);
    for (let i = 1; i < inputRange.length; i++) assert.ok(inputRange[i] > inputRange[i - 1]);
  });
});

test('all-hold bonus needs the 350 ms dwell and drops at once', () => {
  assert.equal(bonusVisible(null, 1000), false);
  assert.equal(bonusVisible(1000, 1349), false);
  assert.equal(bonusVisible(1000, 1350), true);
  assert.equal(CHEER_TIMING.bonusDwellMs, 350);
});

test('press taps at once, becomes a hold after 300 ms, renews every 500 ms with the same seed, releases', () => {
  let r = pressGesture(idleGesture, 0, 77);
  assert.deepEqual(r.emit, [{ kind: 'tap', seed: 77 }]);
  assert.equal(nextTickDelay(r.state, 0), 300);
  r = tickGesture(r.state, 299);
  assert.deepEqual(r.emit, []);
  r = tickGesture(r.state, 300);
  assert.deepEqual(r.emit, [{ kind: 'hold', seed: 77 }]);
  assert.equal(nextTickDelay(r.state, 300), 500);
  r = tickGesture(r.state, 700);
  assert.deepEqual(r.emit, []);
  r = tickGesture(r.state, 800);
  assert.deepEqual(r.emit, [{ kind: 'hold', seed: 77 }]);
  const out = releaseGesture(r.state);
  assert.deepEqual(out.emit, [{ kind: 'release', seed: 77 }]);
  assert.equal(nextTickDelay(out.state, 900), null);
});

test('a short tap never sends hold or release, and a second press while pressed is ignored', () => {
  let r = pressGesture(idleGesture, 0, 5);
  assert.deepEqual(pressGesture(r.state, 10, 6).emit, []);
  r = tickGesture(r.state, 120);
  assert.deepEqual(releaseGesture(r.state).emit, []);
});
