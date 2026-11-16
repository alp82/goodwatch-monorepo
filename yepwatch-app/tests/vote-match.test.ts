import test from 'node:test';
import assert from 'node:assert/strict';
import { gainedMatches, matchList, nextCandidate, sameMatches } from '../src/features/room/vote/match';
import { continuousFixture } from './continuous-fixture';

const list = (generation: number, ...ids: string[]) => ({ generation, ids });

test('a match the room gains plays MATCH, whoever said the last Yep', () => {
  assert.deepEqual(gainedMatches(list(1), list(1, 'c1')), ['c1']);
  assert.deepEqual(gainedMatches(list(1, 'c1'), list(1, 'c1', 'c3')), ['c3']);
  // Several at once (an update that was held back): in the room's order, the screen plays the latest.
  assert.deepEqual(gainedMatches(list(1, 'c1'), list(1, 'c1', 'c2', 'c3')), ['c2', 'c3']);
});

test('matches made before the screen saw them never play: the first read and a new round', () => {
  assert.deepEqual(gainedMatches(null, list(1, 'c1')), []);
  assert.deepEqual(gainedMatches(list(1, 'c1'), list(2, 'c1', 'c2')), []);
  assert.deepEqual(gainedMatches(list(1, 'c1', 'c2'), list(1, 'c1')), []);
});

test('a match that left (an Undo) and comes back plays again', () => {
  const undone = list(1, 'c2');
  assert.deepEqual(gainedMatches(list(1, 'c1', 'c2'), undone), []);
  assert.deepEqual(gainedMatches(undone, list(1, 'c2', 'c1')), ['c1']);
});

test('the same matches in the same round are the same list', () => {
  const room = continuousFixture();
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  const seen = matchList(room);
  assert.deepEqual(seen, list(room.shared.generation, 'c1'));
  assert.equal(sameMatches(seen, list(room.shared.generation, 'c1')), true);
  assert.equal(sameMatches(seen, list(room.shared.generation + 1, 'c1')), false);
  assert.equal(sameMatches(null, seen), false);
});

test('the card underneath is the next unanswered candidate in deck order', () => {
  const room = continuousFixture();
  assert.equal(nextCandidate(room, 'c1')?.id, 'c2');
  room.own.votes = [{ candidateId: 'c2', value: 'pass', revision: 1 } as (typeof room.own.votes)[number]];
  assert.equal(nextCandidate(room, 'c1'), undefined);
});
