import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { continuousFixture } from './continuous-fixture';
import { loadIsolated } from './isolated-module';
import type * as OwnYepsModule from '../src/features/room/own-yeps';

const { mergeOwnYeps } = loadIsolated<typeof OwnYepsModule>(new URL('../src/features/room/own-yeps.ts', import.meta.url), {
  react: { useMemo: (f: () => unknown) => f(), useSyncExternalStore: () => null }, 'react-native': { Platform: { OS: 'ios' } },
});

/** A room holding `held` cards with your answers in order: [id, value, revision]. */
function room(held: string[], votes: [string, 'watch' | 'pass' | null, number][], generation = 1): RoomSnapshot {
  const s = continuousFixture() as unknown as RoomSnapshot;
  const base = s.shared.candidates[0];
  s.shared.generation = generation;
  s.shared.candidates = held.map((id) => ({ ...base, id, title: `Title ${id}` }));
  s.own.votes = votes.map(([candidateId, value, revision]) => ({ candidateId, value, revision, activeExposureMs: null, timingSource: 'unavailable' as const }));
  return s;
}
// Built in this realm: the module runs in its own context, whose arrays deepEqual tells apart.
const ids = (y: { yeps: { id: string }[] }) => Array.from(y.yeps, (x) => x.id);

test('lists your Yeps in answer order, not your Nopes', () => {
  const y = mergeOwnYeps(null, room(['a', 'b', 'c'], [['a', 'watch', 1], ['b', 'pass', 1], ['c', 'watch', 1]]));
  assert.deepEqual(ids(y), ['a', 'c']);
});

test('keeps a Yep after the room retires its card', () => {
  const first = mergeOwnYeps(null, room(['a', 'b'], [['a', 'watch', 1], ['b', 'watch', 1]]));
  // Someone said Nope to a: the room drops the card and your answer to it.
  const after = mergeOwnYeps(first, room(['b', 'c'], [['b', 'watch', 1], ['c', 'watch', 1]]));
  assert.deepEqual(ids(after), ['a', 'b', 'c']);
  assert.equal(after.yeps[0].title, 'Title a');
});

test('a Yep changed to Nope or undone leaves; changed back, it is the newest', () => {
  const first = mergeOwnYeps(null, room(['a', 'b'], [['a', 'watch', 1], ['b', 'watch', 1]]));
  const nope = mergeOwnYeps(first, room(['a', 'b'], [['b', 'watch', 1], ['a', 'pass', 2]]));
  assert.deepEqual(ids(nope), ['b']);
  const undone = mergeOwnYeps(nope, room(['a', 'b'], [['a', 'pass', 2], ['b', null, 2]]));
  assert.deepEqual(ids(undone), []);
  const back = mergeOwnYeps(first, room(['a', 'b'], [['b', 'watch', 1], ['a', 'watch', 3]]));
  assert.deepEqual(ids(back), ['b', 'a']);
});

test('a new round starts empty, and an unchanged room keeps the same list', () => {
  const first = mergeOwnYeps(null, room(['a'], [['a', 'watch', 1]]));
  assert.equal(mergeOwnYeps(first, room(['a'], [['a', 'watch', 1]])), first);
  assert.deepEqual(ids(mergeOwnYeps(first, room(['a'], [], 2))), []);
});

test('another participant on this device starts an empty list', () => {
  const first = mergeOwnYeps(null, room(['a', 'b'], [['a', 'watch', 1], ['b', 'watch', 1]]));
  const other = room(['b'], []);
  other.own.participantId = 'linked-member';
  assert.deepEqual(ids(mergeOwnYeps(first, other)), []);
});

test('the kept list only follows confirmed rooms: an unconfirmed Nope laid over it leaves it as it was', () => {
  const kept = mergeOwnYeps(null, room(['a', 'b', 'c'], [['a', 'watch', 1], ['b', 'watch', 1], ['c', 'watch', 1]]));
  const shown = mergeOwnYeps(kept, room(['a', 'b', 'c'], [['a', 'watch', 1], ['c', 'watch', 1], ['b', 'pass', 2]]));
  assert.deepEqual(ids(shown), ['a', 'c']);
  // Refused: the kept list never saw it, and the room as confirmed shows it unchanged.
  assert.equal(mergeOwnYeps(kept, room(['a', 'b', 'c'], [['a', 'watch', 1], ['b', 'watch', 1], ['c', 'watch', 1]])), kept);
});
