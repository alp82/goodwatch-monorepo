import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decisionGrid,
  bestDecisionItem,
  lensFact,
  titleYear,
  type DecisionItem,
} from '../src/features/glow/decision-model';
const item = (
  id: string,
  patch: Partial<DecisionItem['title']> = {},
  averageYepMs: number | null = null
): DecisionItem => ({
  title: {
    id,
    title: id,
    kind: 'movie',
    year: 2024,
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    trailerUrl: null,
    runtimeMinutes: null,
    episodeLabel: null,
    score: null,
    genres: [],
    ...patch,
  },
  averageYepMs,
});
test('decision lenses label episode/movie runtime honestly and never rank absent observations first', () => {
  const items = [
    item('unknown'),
    item('movie', { runtimeMinutes: 95, score: 90 }, 3000),
    item('episode', { kind: 'show_start', runtimeMinutes: 30, score: 80 }, 2000),
  ];
  assert.equal(bestDecisionItem(items, 'score'), 'movie');
  assert.equal(bestDecisionItem(items, 'runtime'), 'movie');
  assert.equal(bestDecisionItem(items, 'quick'), 'episode');
  assert.equal(lensFact(items[2], 'runtime'), '30 min / episode');
  assert.equal(lensFact(items[0], 'runtime'), 'Runtime unknown');
  assert.equal(lensFact(items[0], 'quick'), 'Unavailable');
  assert.equal(lensFact(items[2], 'quick'), '2.0s avg');
  assert.equal(titleYear(items[1].title), 'movie (2024)');
  assert.equal(bestDecisionItem([items[0]], 'quick'), null);
});
test('decision wall fits all retained posters without page scroll on phone and desktop', () => {
  for (const [width, height] of [
    [355, 230],
    [370, 380],
    [1300, 500],
    [300, 130],
  ]) {
    for (const n of [1, 2, 3, 7, 12, 32, 64]) {
      const g = decisionGrid(n, width, height);
      const rows = Math.ceil(n / g.columns);
      assert.ok(g.width > 0);
      assert.ok(g.columns * g.width + (g.columns - 1) * 8 <= width);
      assert.ok(rows * g.height + (rows - 1) * 8 <= height);
    }
  }
});

import { ActiveCardClock } from '../src/features/glow/active-time';
test('Yep latency counts only the visible own card, excluding trailer/detail/inspection/background and other cards', () => {
  let now = 0;
  const clock = new ActiveCardClock(() => now);
  clock.observe('g1:c1:r0', true);
  now = 200;
  clock.observe('g1:c1:r0', false); // Trailer or detail opens.
  now = 5000;
  assert.equal(clock.read('g1:c1:r0'), 200);
  clock.observe('g1:c1:r0', true);
  now = 5300;
  clock.pause(); // Background.
  now = 9000;
  assert.equal(clock.read('g1:c1:r0'), 500);
  clock.observe('g1:c2:r0', true);
  now = 9500;
  assert.equal(clock.read('g1:c1:r0'), 500);
  assert.equal(clock.read('g1:c2:r0'), 500);
  clock.observe('g1:c1:r2', true); // Undo/reanswer has a new observation, no invented carryover.
  assert.equal(clock.read('g1:c1:r2'), null);
  clock.reset();
  assert.equal(clock.read('g1:c1:r0'), null);
});
