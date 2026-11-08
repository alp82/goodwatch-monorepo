import test from 'node:test';
import assert from 'node:assert/strict';
import { madeMatch, nextCandidate, yepRecord } from '../src/features/room/vote/match';
import { continuousFixture } from './continuous-fixture';

test('a Yep that makes the candidate a match plays MATCH once the room lists it', () => {
  const room = continuousFixture();
  const yep = yepRecord(1, room.shared, 'c1', 'neon');
  assert.equal(madeMatch(yep, room.shared), null, 'not before the room says so');
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  assert.equal(madeMatch(yep, room.shared), '1:c1:1');
  assert.equal(yep.look, 'neon');
});

test('no MATCH for a candidate that was already a match, another candidate, or another round', () => {
  const room = continuousFixture();
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  assert.equal(madeMatch(yepRecord(1, room.shared, 'c1', 'wash'), room.shared), null);
  const other = yepRecord(2, room.shared, 'c2', 'wash');
  assert.equal(madeMatch(other, room.shared), null);
  room.shared.matches.push({ candidateId: 'c2', averageYepMs: null });
  room.shared.generation = 2;
  assert.equal(madeMatch(other, room.shared), null);
  assert.equal(madeMatch(null, room.shared), null);
});

test('a Yep again after Undo celebrates again (a new key)', () => {
  const room = continuousFixture();
  const first = yepRecord(1, room.shared, 'c2', 'stamp');
  const again = yepRecord(2, room.shared, 'c2', 'stamp');
  room.shared.matches = [{ candidateId: 'c2', averageYepMs: null }];
  assert.notEqual(madeMatch(first, room.shared), madeMatch(again, room.shared));
});

test('the card underneath is the next unanswered candidate in deck order', () => {
  const room = continuousFixture();
  assert.equal(nextCandidate(room, 'c1')?.id, 'c2');
  room.own.votes = [{ candidateId: 'c2', value: 'pass', revision: 1 } as (typeof room.own.votes)[number]];
  assert.equal(nextCandidate(room, 'c1'), undefined);
});
