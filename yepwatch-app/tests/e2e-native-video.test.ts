import test from 'node:test';
import assert from 'node:assert/strict';
import { arrivalFrame, flashes, W, H } from '../e2e/native/lib/video.mjs';

const frame = (level: number, i: number) => ({ i, t: i * 17, px: Uint8Array.from({ length: W * H }, (_, p) => level + (p % 2 ? 15 : 0)) });
const video = (levels: number[]) => ({ frames: levels.map(frame) });

test('native arrival accepts the final complete three-frame hold', () => {
  assert.equal(arrivalFrame(video([0, 0, 60, 60, 60]), [0, 0, 1080, 2400], 0), 2);
});

test('continuous slow motion is not a stable intermediate screen', () => {
  const moving = video(Array.from({ length: 80 }, (_, i) => i));
  assert.deepEqual(flashes(moving, 1, 79, { allowIntermediate: 0 }).plateaus, []);
});

test('a static intermediate screen still fails the native flash gate', () => {
  const intermediate = video([0, 0, 60, 60, 60, 60, 60, 120, 120, 120, 120]);
  const result = flashes(intermediate, 1, 10, { allowIntermediate: 0 });
  assert.equal(result.failed, true);
  assert.equal(result.plateaus.length, 1);
  assert.equal(result.plateaus[0].from, 2);
});

test('an explicitly animated region does not hide a static intermediate outside that region', () => {
  const frames = [0, 0, 60, 60, 60, 60, 120, 120, 120].map(frame);
  const result = flashes({ frames }, 1, 8, { allowIntermediate: 0, animatedRegions: [[540, 80, 1080, 2400]] });
  assert.equal(result.failed, true);
  assert.equal(result.plateaus.length, 1);
});

test('intentional motion is excluded only inside its declared region', () => {
  const frames = [0, 0, 60, 60, 60, 60, 120, 120, 120].map((level, i) => {
    const f = frame(0, i);
    for (let p = 0; p < f.px.length; p++) if (p % W >= 68) f.px[p] += level;
    return f;
  });
  assert.equal(flashes({ frames }, 1, 8, { allowIntermediate: 0 }).failed, true);
  assert.equal(flashes({ frames }, 1, 8, { allowIntermediate: 0, animatedRegions: [[540, 0, 1080, 2400]] }).failed, false);
});

test('blank-screen detection always inspects the full screen, including animation regions', () => {
  const frames = [frame(0, 0), frame(0, 1), { ...frame(0, 2), px: new Uint8Array(W * H) }, frame(120, 3), frame(120, 4)];
  const result = flashes({ frames }, 1, 4, { animatedRegions: [[0, 0, 1080, 2400]] });
  assert.deepEqual(result.blank, [2]);
  assert.equal(result.failed, true);
});
