import { test } from 'node:test';
import assert from 'node:assert/strict';
import { credits, effectLines, gwScore, highlightChips, scoreWord, sourceScores, text, textColorOn, vibeColor } from '../src/features/glow/score-format';
import { sharedSchema } from '../src/core/continuous/wire';
import { continuousFixture } from './continuous-fixture';

test('the GoodWatch score reads like the website: whole points rounded down, colored by its band, with its verdict', () => {
  assert.equal(gwScore(84.9), 84);
  assert.equal(gwScore(0), null);
  assert.equal(gwScore(null), null);
  assert.equal(gwScore(Number.NaN), null);
  assert.equal(vibeColor(84), '#16934a');
  assert.equal(vibeColor(100), '#166534');
  assert.equal(vibeColor(59), '#ca8a04');
  assert.equal(vibeColor(3), '#7f1d1d');
  assert.equal(scoreWord(92), 'Excellent');
  assert.equal(scoreWord(95), 'Masterpiece');
  assert.equal(scoreWord(4), 'Unwatchable');
});

test('source scores print like their sites; unknown ones stay out', () => {
  assert.deepEqual(sourceScores({ imdb: 78, rtCritics: 92.6, rtAudience: 86, metacritic: 88.4 }), { imdb: '7.8', metacritic: '88', rt: '92%', rtAudience: '86%' });
  assert.deepEqual(sourceScores({ imdb: 81, rtCritics: null }), { imdb: '8.1', metacritic: null, rt: null, rtAudience: null });
  assert.equal(sourceScores({ imdb: 0, metacritic: null }), null);
  assert.equal(sourceScores(null), null);
  assert.equal(sourceScores(undefined), null);
});

test('highlights wear their fingerprint colors with readable text; at most three', () => {
  const chips = highlightChips([
    { key: 'wit_wordplay', label: 'Wit & Wordplay' }, { key: 'romance', label: 'Romance' },
    { key: 'unknown_key', label: 'Unknown Key' }, { key: 'tension', label: 'Tension' },
  ]);
  assert.deepEqual(chips.map((c) => c.label), ['Wit & Wordplay', 'Romance', 'Unknown Key']);
  assert.equal(chips[0].background, 'rgba(255, 214, 0, 0.6)');
  assert.equal(chips[0].color, '#030712'); // light yellow chip: dark text
  assert.equal(chips[1].color, '#ffffff');
  assert.equal(chips[2].background, 'rgba(158, 158, 158, 0.6)');
  assert.equal(textColorOn('rgba(183, 28, 28, 0.6)'), '#ffffff');
  assert.deepEqual(highlightChips(null), []);
});

test('credits: directed by or created by, then the top cast; missing parts stay out', () => {
  const movie = { kind: 'movie' as const, tmdbId: 1 };
  const show = { kind: 'show_start' as const, tmdbId: 2, episode: { tmdbId: 3, season: 1, number: 1 } };
  assert.deepEqual(credits({ identity: movie, people: { directors: ['Wes Anderson'], cast: ['A', 'B', 'C', 'D'] } }), [{ label: 'Directed by', names: 'Wes Anderson' }, { label: 'Starring', names: 'A, B, C' }]);
  assert.deepEqual(credits({ identity: movie, people: { directors: ['Joel Coen', 'Ethan Coen'], cast: [] } }), [{ label: 'Directed by', names: 'Joel Coen, Ethan Coen' }]);
  assert.deepEqual(credits({ identity: show, people: { directors: ['Vince Gilligan'], cast: ['Bryan Cranston'] } })[0], { label: 'Created by', names: 'Vince Gilligan' });
  assert.deepEqual(credits({ identity: movie, people: null }), []);
  assert.deepEqual(credits({ identity: movie }), []);
  assert.equal(text('  '), null);
  assert.equal(text(' A tagline '), 'A tagline');
});

test('effect lines end in a full stop, keep their strength in 0-10 and fall back to ink for a color that isn\'t #rrggbb', () => {
  assert.deepEqual(effectLines([
    { line: 'Warms you up', strength: 9.2, color: '#fb7185' },
    { line: 'Lifts you up.', strength: 12, color: 'red' },
    { line: '  ', strength: 8, color: '#38bdf8' },
    { line: 'Feels like real life!', strength: -1, color: '#38BDF8' },
  ]), [
    { line: 'Warms you up.', strength: 9.2, color: '#fb7185' },
    { line: 'Lifts you up.', strength: 10, color: '#fafafa' },
    { line: 'Feels like real life!', strength: 0, color: '#38BDF8' },
  ]);
  assert.equal(effectLines(Array.from({ length: 7 }, (_, i) => ({ line: `Line ${i}`, strength: 7, color: '#a78bfa' }))).length, 5);
  assert.deepEqual(effectLines(null), []);
  assert.deepEqual(effectLines(undefined), []);
});

test('the wire accepts the optional title highlights, absent or null', () => {
  const shared = continuousFixture().shared;
  Object.assign(shared.candidates[0], {
    tagline: 'A tagline', certification: 'FSK 12', scores: { imdb: 81, rtCritics: 92, rtAudience: null, metacritic: 88 },
    highlights: [{ key: 'wit_wordplay', label: 'Wit & Wordplay' }], people: { directors: ['Wes Anderson'], cast: ['Ralph Fiennes'] },
  });
  Object.assign(shared.candidates[1], { tagline: null, certification: null, scores: null, highlights: null, people: null });
  const parsed = sharedSchema.parse(shared);
  assert.equal(parsed.candidates[0].scores?.imdb, 81);
  assert.equal(parsed.candidates[1].people, null);
  assert.equal(sharedSchema.safeParse({ ...shared, candidates: [{ ...shared.candidates[0], surprise: 1 }] }).success, false);
});
