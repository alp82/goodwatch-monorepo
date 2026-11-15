import test from 'node:test';
import assert from 'node:assert/strict';
import { everyoneIn, inRows, SPIN_STEPS, spinPath, tiebreakView } from '../src/features/room/matches-in';

test('rows come from the room’s counts and your own I’m ins, in the matches’ order', () => {
  const rows = inRows(['a', 'b', 'c'], [{ candidateId: 'b', count: 2 }, { candidateId: 'a', count: 1 }], { candidateIds: ['b'], revision: 4 });
  assert.deepEqual(rows, [{ id: 'a', count: 1, mine: false }, { id: 'b', count: 2, mine: true }, { id: 'c', count: 0, mine: false }]);
});

test('a room without counts yet: nobody in; your own I’m in counts at least you', () => {
  assert.deepEqual(inRows(['a'], undefined, undefined), [{ id: 'a', count: 0, mine: false }]);
  assert.deepEqual(inRows(['a'], [], { candidateIds: ['a'], revision: 1 }), [{ id: 'a', count: 1, mine: true }]);
});

test('everyone in: the titles whose count reaches everyone in the round', () => {
  const rows = inRows(['a', 'b', 'c'], [{ candidateId: 'a', count: 3 }, { candidateId: 'b', count: 2 }, { candidateId: 'c', count: 3 }], undefined);
  assert.deepEqual(everyoneIn(rows, 3), ['a', 'c']);
  assert.deepEqual(everyoneIn(rows, 0), []);
});

test('tiebreak: favorites as counts, your pick only in this tiebreak, the server’s outcome as is', () => {
  const shared = { tiebreak: { version: 5, candidateIds: ['a', 'b'], favorites: [{ candidateId: 'a', count: 1 }, { candidateId: 'b', count: 1 }], seed: '0123456789abcdef', outcome: { candidateId: 'b', spun: true, among: ['a', 'b'] } } };
  assert.deepEqual(tiebreakView(shared, { favorite: { tiebreakVersion: 5, candidateId: 'a' } }), {
    version: 5, candidateIds: ['a', 'b'], favorites: { a: 1, b: 1 }, mine: 'a', outcome: { winner: 'b', spun: true, among: ['a', 'b'] },
  });
  // A pick from an earlier tiebreak is not yours in this one.
  assert.equal(tiebreakView(shared, { favorite: { tiebreakVersion: 4, candidateId: 'a' } })?.mine, null);
  assert.equal(tiebreakView({ tiebreak: { ...shared.tiebreak, outcome: null } }, { favorite: null })?.outcome, null);
  assert.equal(tiebreakView({ tiebreak: null }, { favorite: null }), null);
  assert.equal(tiebreakView({}, {}), null);
});

test('the spin lights one title per step and lands on the winner', () => {
  const path = spinPath(['a', 'b', 'c'], 'b');
  assert.equal(path.length, SPIN_STEPS.length);
  assert.equal(path.at(-1), 'b');
  assert.equal(path.at(-2), 'a');
});
