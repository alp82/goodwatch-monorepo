import test from 'node:test';
import assert from 'node:assert/strict';
import { everyoneIn, inRows, inTap, localAfter, spinPath, tieOutcome, SPIN_STEPS } from '../src/features/room/matches-in';

const none = new Set<string>();

test('no proposal: every match starts with nobody in; a tap proposes it', () => {
  assert.deepEqual(inRows(['a', 'b'], null, none), [{ id: 'a', count: 0, mine: false }, { id: 'b', count: 0, mine: false }]);
  assert.deepEqual(inTap('a', null, none), { kind: 'propose' });
});

test('the proposal title counts its agreements; tapping it agrees or takes the agreement back', () => {
  const theirs = { candidateId: 'a', agreeCount: 2, mine: false };
  assert.deepEqual(inRows(['a', 'b'], theirs, none)[0], { id: 'a', count: 2, mine: false });
  assert.deepEqual(inTap('a', theirs, none), { kind: 'agree', agreed: true });
  assert.deepEqual(inTap('a', { ...theirs, mine: true, agreeCount: 3 }, none), { kind: 'agree', agreed: false });
});

test('your own Propose on its way counts you in at once', () => {
  assert.deepEqual(inRows(['a'], { candidateId: 'a', agreeCount: 0, mine: true }, none)[0], { id: 'a', count: 1, mine: true });
});

test('another title while friends are in on the proposal: marked on this device only, never wiping their I’m in', () => {
  const theirs = { candidateId: 'a', agreeCount: 1, mine: false };
  const tap = inTap('b', theirs, none);
  assert.deepEqual(tap, { kind: 'mark', on: true });
  const local = localAfter(none, 'b', tap, theirs);
  assert.deepEqual([...local], ['b']);
  assert.deepEqual(inRows(['a', 'b'], theirs, local)[1], { id: 'b', count: 1, mine: true });
  assert.deepEqual(inTap('b', theirs, local), { kind: 'mark', on: false });
  assert.deepEqual([...localAfter(local, 'b', { kind: 'mark', on: false }, theirs)], []);
});

test('another title while only you are in on the proposal: it is proposed, and the old one stays marked here', () => {
  const mine = { candidateId: 'a', agreeCount: 1, mine: true };
  const tap = inTap('b', mine, none);
  assert.deepEqual(tap, { kind: 'propose' });
  assert.deepEqual([...localAfter(none, 'b', tap, mine)].sort(), ['a', 'b']);
  // Yours from the tap, before the room's answer.
  assert.deepEqual(inRows(['b'], mine, localAfter(none, 'b', tap, mine))[0], { id: 'b', count: 1, mine: true });
});

test('agreeing to a title clears its local mark', () => {
  assert.deepEqual([...localAfter(new Set(['a']), 'a', { kind: 'agree', agreed: true }, null)], []);
});

test('everyone in: titles whose count reaches the people in the round', () => {
  const rows = [{ id: 'a', count: 3, mine: true }, { id: 'b', count: 2, mine: false }, { id: 'c', count: 3, mine: true }];
  assert.deepEqual(everyoneIn(rows, 3), ['a', 'c']);
  assert.deepEqual(everyoneIn(rows, 0), []);
});

test('tiebreak: most favorites wins; nothing until every favorite is in', () => {
  assert.equal(tieOutcome(['a', 'b'], { a: 1 }, 3, 's'), null);
  assert.deepEqual(tieOutcome(['a', 'b'], { a: 2, b: 1 }, 3, 's'), { winner: 'a', spun: false, among: ['a'] });
});

test('tiebreak: favorites tied too, a spin decides among the most-picked, the same on every phone', () => {
  const one = tieOutcome(['a', 'b', 'c'], { a: 1, b: 1, c: 1 }, 3, 'room:2:7');
  const two = tieOutcome(['a', 'b', 'c'], { c: 1, a: 1, b: 1 }, 3, 'room:2:7');
  assert.ok(one?.spun);
  assert.deepEqual(one, two);
  assert.deepEqual(one?.among, ['a', 'b', 'c']);
  // Only the most-picked are in the spin.
  const narrowed = tieOutcome(['a', 'b', 'c'], { a: 2, b: 2, c: 0 }, 4, 'x');
  assert.deepEqual(narrowed?.among, ['a', 'b']);
  // Different seeds reach both titles.
  const winners = new Set(Array.from({ length: 40 }, (_, i) => tieOutcome(['a', 'b'], { a: 1, b: 1 }, 2, `s${i}`)?.winner));
  assert.deepEqual([...winners].sort(), ['a', 'b']);
});

test('the spin lights one title per step and lands on the winner', () => {
  const path = spinPath(['a', 'b', 'c'], 'b');
  assert.equal(path.length, SPIN_STEPS.length);
  assert.equal(path.at(-1), 'b');
  assert.equal(path.at(-2), 'a');
});
