import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutFor } from '../src/features/shell/scale';
import { deckPosters, posterAt, timeAgo } from '../src/features/rooms/home-model';
import { continuousFixture } from './continuous-fixture';

test('phones use the full width with 16 px gutters and no scaling', () => {
  const l = layoutFor(390, 844);
  assert.equal(l.phone, true);
  assert.equal(l.wide, false);
  assert.equal(l.k, 1);
  assert.equal(l.gutter, 16);
  assert.equal(l.max, 358);
  assert.equal(l.z(17), 17);
  assert.equal(l.header, 60);
});

test('big windows scale with k = clamp(width / 1300, 1, 1.45) and cap the container at 1100 k', () => {
  const desk = layoutFor(1280, 900);
  assert.equal(desk.phone, false);
  assert.equal(desk.wide, true);
  assert.equal(desk.k, 1);
  assert.equal(desk.max, 1100);
  const big = layoutFor(2000, 1200);
  assert.equal(big.k, 1.45);
  assert.equal(big.max, 1595);
  assert.equal(big.z(20), 29);
  assert.equal(big.header, 72);
  // Between phone and the cap the container follows the window.
  const tablet = layoutFor(800, 1000);
  assert.equal(tablet.max, 736);
  assert.equal(tablet.wide, false);
});

test('two columns from 900 px; short windows get the compact header', () => {
  assert.equal(layoutFor(899, 800).wide, false);
  assert.equal(layoutFor(900, 800).wide, true);
  assert.equal(layoutFor(844, 390).header, 48);
  assert.equal(layoutFor(844, 390).short, true);
  assert.equal(layoutFor(1280, 900).short, false);
});

test('the poster fan shows your next cards first and skips titles without a poster', () => {
  const s = continuousFixture();
  const base = s.shared.candidates[0];
  s.shared.candidates = ['c1', 'c2', 'c3', 'c4'].map((id, i) => ({ ...base, id, posterUrl: i === 1 ? null : `https://image.tmdb.org/t/p/w500/${id}.jpg` }));
  const [first, , third, fourth] = s.shared.candidates;
  s.own.votes = [{ candidateId: first.id, value: 'watch', revision: 1, activeExposureMs: null, timingSource: 'unavailable' }];
  assert.deepEqual(deckPosters(s), [third.posterUrl, fourth.posterUrl, first.posterUrl]);
  s.shared.candidates = [];
  assert.deepEqual(deckPosters(s), []);
});

test('poster renditions and relative times', () => {
  assert.equal(posterAt('https://image.tmdb.org/t/p/w500/a.jpg', 185), 'https://image.tmdb.org/t/p/w185/a.jpg');
  const now = 1_800_000_000_000;
  assert.equal(timeAgo(now - 30_000, now), 'now');
  assert.equal(timeAgo(now - 12 * 60_000, now), '12 min ago');
  assert.equal(timeAgo(now - 3 * 3_600_000, now), '3 h ago');
  assert.equal(timeAgo(now - 26 * 3_600_000, now), 'yesterday');
  assert.equal(timeAgo(now - 4 * 86_400_000, now), '4 days ago');
});
