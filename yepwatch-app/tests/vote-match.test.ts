import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { answerYep, matchKey, nextCandidate, settleYeps, undoYeps, yepRecord } from '../src/features/room/vote/match';
import { continuousFixture } from './continuous-fixture';

type Vote = RoomSnapshot['own']['votes'][number];
const vote = (candidateId: string, value: Vote['value'], revision: number) => ({ candidateId, value, revision, activeExposureMs: null, timingSource: 'unavailable' }) as Vote;
/** The room as shown: own votes applied before the server answers. */
const shownWith = (room: RoomSnapshot, ...votes: Vote[]) => ({ ...room, own: { ...room.own, votes: [...room.own.votes.filter((v) => !votes.some((n) => n.candidateId === v.candidateId)), ...votes] } });

test('a Yep that makes the candidate a match plays MATCH once the confirmed room lists it, in its look', () => {
  const room = continuousFixture();
  const yep = yepRecord(1, room, 'c1', 'neon');
  assert.equal(yep.revision, 1);
  // Not yet confirmed: it waits.
  assert.deepEqual(settleYeps([yep], room), { matched: [], pending: [yep], changed: false });
  room.own.votes = [vote('c1', 'watch', 1)];
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  const settled = settleYeps([yep], room);
  assert.deepEqual(settled.matched, [yep]);
  assert.deepEqual(settled.pending, []);
  assert.equal(matchKey(yep), '1:c1:1');
  assert.equal(yep.look, 'neon');
});

test('Yep A then Yep B before A is confirmed: A’s match still plays; B waits for its own answer', () => {
  const room = continuousFixture();
  const a = yepRecord(1, room, 'c1', 'neon');
  const b = yepRecord(2, shownWith(room, vote('c1', 'watch', 1)), 'c2', 'stamp');
  // A confirmed and a match; B not answered yet.
  room.own.votes = [vote('c1', 'watch', 1)];
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  const first = settleYeps([a, b], room);
  assert.deepEqual(first.matched, [a]);
  assert.deepEqual(first.pending, [b]);
  // B confirmed without a match: dropped quietly.
  room.own.votes.push(vote('c2', 'watch', 1));
  assert.deepEqual(settleYeps(first.pending, room), { matched: [], pending: [], changed: true });
});

test('confirmed without a match, already a match before, another round, undone or overwritten: no MATCH, dropped', () => {
  const room = continuousFixture();
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  const already = yepRecord(1, room, 'c1', 'wash');
  assert.equal(already.wasMatch, true);
  room.own.votes = [vote('c1', 'watch', 1)];
  assert.deepEqual(settleYeps([already], room), { matched: [], pending: [], changed: true });
  const undone = yepRecord(2, room, 'c2', 'wash');
  room.own.votes.push(vote('c2', null, 2));
  room.shared.matches.push({ candidateId: 'c2', averageYepMs: null });
  assert.deepEqual(settleYeps([undone], room).matched, [], 'a newer revision (Undo) wins');
  const old = { ...yepRecord(3, room, 'c2', 'wash'), generation: 0 };
  assert.deepEqual(settleYeps([old], room), { matched: [], pending: [], changed: true });
  assert.deepEqual(undoYeps([undone, already], 'c2'), [already]);
});

test('the server refuses a Yep: forgotten; accepts it one revision lower than counted: it settles on that revision', () => {
  const room = continuousFixture();
  // Counted behind an earlier vote on the same card that was then refused.
  const yep = yepRecord(1, shownWith(room, vote('c1', 'pass', 1)), 'c1', 'neon');
  assert.equal(yep.revision, 2);
  assert.deepEqual(answerYep([yep], 1, false, room), []);
  room.own.votes = [vote('c1', 'watch', 1)];
  room.shared.matches = [{ candidateId: 'c1', averageYepMs: null }];
  const answered = answerYep([yep], 1, true, room);
  assert.equal(answered[0].revision, 1);
  assert.deepEqual(settleYeps(answered, room).matched.map((r) => r.serial), [1]);
});

test('a Yep again after Undo celebrates again (a new key)', () => {
  const room = continuousFixture();
  const first = yepRecord(1, room, 'c2', 'stamp');
  const again = yepRecord(2, shownWith(room, vote('c2', null, 2)), 'c2', 'stamp');
  assert.equal(again.revision, 3);
  assert.notEqual(matchKey(first), matchKey(again));
});

test('the card underneath is the next unanswered candidate in deck order', () => {
  const room = continuousFixture();
  assert.equal(nextCandidate(room, 'c1')?.id, 'c2');
  room.own.votes = [{ candidateId: 'c2', value: 'pass', revision: 1 } as (typeof room.own.votes)[number]];
  assert.equal(nextCandidate(room, 'c1'), undefined);
});
