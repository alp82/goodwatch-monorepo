import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_STEP, placeRiders, trackShare } from '../src/features/glow/vote-track';

const size = 26;
const step = size * TRACK_STEP;

test('a share is answered of dealt, 0 with nothing dealt, never past the end', () => {
  assert.equal(trackShare(5, 20), 0.25);
  assert.equal(trackShare(0, 0), 0);
  assert.equal(trackShare(25, 20), 1);
  assert.equal(trackShare(-1, 20), 0);
});

test('faces sit at their share of the track', () => {
  const { at } = placeRiders([{ id: 'me', self: true, answered: 5 }, { id: 'mia', self: false, answered: 10 }], 20, 200, size);
  assert.equal(at.get('me'), 50);
  assert.equal(at.get('mia'), 100);
});

test('faces at the same place overlap by one step, you drawn on top', () => {
  const { at, order } = placeRiders([{ id: 'me', self: true, answered: 4 }, { id: 'mia', self: false, answered: 4 }, { id: 'jon', self: false, answered: 4 }], 20, 200, size);
  assert.deepEqual(order.map((r) => r.id).at(-1), 'me');
  const xs = order.map((r) => at.get(r.id)!);
  assert.equal(xs[0], 40);
  for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - step) < 1e-9);
});

test('a crowd at the finish backs up from the end, keeping the overlap', () => {
  const riders = ['a', 'b', 'c'].map((id) => ({ id, self: false, answered: 20 }));
  const { at, order } = placeRiders(riders, 20, 200, size);
  const xs = order.map((r) => at.get(r.id)!);
  assert.equal(xs.at(-1), 200);
  for (let i = 1; i < xs.length; i++) assert.ok(Math.abs(xs[i] - xs[i - 1] - step) < 1e-9);
  assert.ok(xs.every((x) => x <= 200));
});

test('backing up stops at a face that already has room', () => {
  const { at } = placeRiders([{ id: 'far', self: false, answered: 2 }, { id: 'a', self: false, answered: 20 }, { id: 'b', self: false, answered: 20 }], 20, 200, size);
  assert.equal(at.get('far'), 20);
});

test('a crowd bigger than the track overlaps more and never starts before it', () => {
  const riders = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, self: i === 0, answered: 20 }));
  const { at } = placeRiders(riders, 20, 158, size);
  const xs = [...at.values()];
  assert.ok(xs.every((x) => x >= -1e-9 && x <= 158 + 1e-9));
});
