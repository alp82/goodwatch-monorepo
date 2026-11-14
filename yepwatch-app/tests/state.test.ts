import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureSnapshot } from '../src/dev/fixtures';
import { CommandQueue, mergeShared, mergeSnapshot, nextCandidate } from '../src/core/room-state';
import { ApiFailure } from '../src/core/errors';
import { inviteIntent, parseInvite, safeReturnTo } from '../src/core/invites';
import { parseRealtimeFrame } from '../src/core/wire';

test('HTTP/private sequence and shared push revision never regress each other', () => {
  const current = fixtureSnapshot(); current.shared.revision = 10; current.own.nextSequence = 3;
  const response = fixtureSnapshot(); response.shared.revision = 9; response.own.nextSequence = 4;
  const merged = mergeSnapshot(current, response);
  assert.equal(merged.shared.revision, 10); assert.equal(merged.own.nextSequence, 4);
  assert.equal(mergeSnapshot(merged, current).own.nextSequence, 4);
  assert.equal(mergeShared(merged, response.shared), merged);
  assert.equal(mergeShared(merged, { ...response.shared, roomId: 'wrong' }), merged);
});
test('another actor new_round clears own state and a delayed equal-sequence response cannot restore it', () => {
  const old = fixtureSnapshot(); old.shared.revision = 5; old.shared.phase = 'voting'; old.own.nextSequence = 3; old.own.roundCompleted = true; old.own.votes = [{ candidateId: 'fixture-movie', value: 'watch', revision: 1 }];
  const fresh = fixtureSnapshot(); fresh.shared.revision = 6; fresh.own.nextSequence = 3;
  const merged = mergeSnapshot(fresh, old);
  assert.equal(merged.shared.phase, 'setup'); assert.deepEqual(merged.own.votes, []); assert.equal(merged.own.roundCompleted, false);
});
test('a newer shared push does not prevent an intermediate HTTP repair of older private state', () => {
  const before = fixtureSnapshot(); before.shared.revision = 5; before.own.nextSequence = 3; before.own.roundCompleted = true;
  const pushed = mergeShared(before, { ...before.shared, revision: 7, phase: 'setup' })!;
  const repair = fixtureSnapshot(); repair.shared.revision = 6; repair.own.nextSequence = 3;
  const merged = mergeSnapshot(pushed, repair);
  assert.equal(merged.shared.revision, 7); assert.equal(merged.own.roundCompleted, false);
  assert.equal(mergeSnapshot(merged, before).own.roundCompleted, false);
});
test('uncertain command retries preserve complete envelope and block new actions', async () => {
  const queue = new CommandQueue(() => 'command-one'); const snapshot = fixtureSnapshot();
  let first: unknown; const command = { type: 'ready' as const, expectedContextVersion: 1, ready: true };
  await assert.rejects(queue.send(command, snapshot, async body => { first = body; throw new ApiFailure('outcome_unknown', 'Unknown'); }));
  await assert.rejects(queue.send(command, snapshot, async () => ({ snapshot })), /Reconcile/);
  let retried: unknown;
  await queue.send(undefined, snapshot, async body => { retried = body; return { snapshot }; });
  assert.deepEqual(retried, first); assert.equal(queue.pending, null);
});
test('only one command is in flight and definitive conflict does not masquerade as success', async () => {
  const queue = new CommandQueue(() => 'one'); const snapshot = fixtureSnapshot();
  let release!: () => void;
  const first = queue.send({ type: 'ready', expectedContextVersion: 1, ready: true }, snapshot, () => new Promise(resolve => { release = () => resolve({ snapshot }); }));
  await assert.rejects(queue.send(undefined, snapshot, async () => ({ snapshot })), /Wait/); release(); await first;
  await assert.rejects(queue.send({ type: 'ready', expectedContextVersion: 1, ready: true }, snapshot, async () => { throw new ApiFailure('conflict', 'Changed'); }), /Changed/);
  assert.equal(queue.pending, null);
});
test('own pending vote advances only own deck; no speculative shortlist appears', () => {
  const snapshot = fixtureSnapshot(); snapshot.shared.phase = 'voting';
  assert.equal(nextCandidate(snapshot, 'fixture-movie')?.id, 'fixture-start'); assert.equal(snapshot.shared.shortlist, null);
  snapshot.own.votes.push({ candidateId: 'fixture-movie', value: 'watch', revision: 1 });
  assert.equal(nextCandidate(snapshot)?.identity.kind, 'show_start');
});
test('invitation roundtrip survives sign-in and rejects open return redirects', () => {
  assert.equal(inviteIntent('ROOM-code'), '/r/ROOM-code'); assert.equal(parseInvite('https://yepwatch.com/r/ROOM-code'), 'ROOM-code');
  assert.equal(parseInvite('https://evil.example/r/code'), ''); assert.equal(safeReturnTo('//evil.example'), '/');
  assert.equal(safeReturnTo('/r/ROOM-code'), '/r/ROOM-code'); assert.equal(safeReturnTo('/room/a'), '/room/a');
});
test('public wire parser rejects private votes/current-title extensions and malformed frames', () => {
  const snapshot = fixtureSnapshot().shared;
  assert.equal(parseRealtimeFrame(JSON.stringify({ type: 'room.snapshot', snapshot }))?.type, 'room.snapshot');
  assert.equal(parseRealtimeFrame(JSON.stringify({ type: 'room.snapshot', snapshot: { ...snapshot, own: {} } })), null);
  snapshot.participants[0] = { ...snapshot.participants[0], currentCardId: 'private' } as typeof snapshot.participants[0];
  assert.equal(parseRealtimeFrame(JSON.stringify({ type: 'room.updated', snapshot })), null);
  for (const value of ['null', '{}', '[]', 'garbage']) assert.equal(parseRealtimeFrame(value), null);
});

test('a room read answered with only its own part takes the shared room this phone holds, at that revision only', async () => {
  const { withShared } = await import('../src/core/continuous/state');
  const shared = { revision: 7 } as never as import('@goodwatch/yepwatch-contracts/proposal').SharedRoomSnapshot;
  const own = { participantId: 'p', nextSequence: 3 } as never as import('@goodwatch/yepwatch-contracts/proposal').OwnPrivateSnapshot;
  const held = { shared, own, ownRevision: 7 } as never as import('../src/core/continuous/state').CachedRoom;
  const whole = { shared: { revision: 8 }, own } as never as import('@goodwatch/yepwatch-contracts/proposal').RoomSnapshot;
  assert.equal(withShared(whole, held), whole);
  const answer = withShared({ own, sharedRevision: 7 }, held);
  assert.equal(answer?.shared, shared);
  assert.equal(answer?.own, own);
  // The phone holds another revision by now (or nothing): read the whole room.
  assert.equal(withShared({ own, sharedRevision: 6 }, held), null);
  assert.equal(withShared({ own, sharedRevision: 7 }, undefined), null);
});

test('a room seeded from the account\'s rooms shows at once, and the room\'s own read replaces its own part whatever its sequence', async () => {
  const { mergeRoom, seedRoom, SEEDED_SEQUENCE } = await import('../src/core/continuous/state');
  const { continuousFixture } = await import('./continuous-fixture');
  // The account read counts commands per participant (5); this session's own read counts its own (1).
  const listed = continuousFixture(); listed.shared.revision = 10; listed.own.nextSequence = 5;
  const seeded = seedRoom(undefined, listed)!;
  assert.equal(seeded.shared, listed.shared);
  assert.equal(seeded.own.nextSequence, SEEDED_SEQUENCE);
  const read = structuredClone(listed); read.own.nextSequence = 1;
  const opened = mergeRoom(seeded, read);
  assert.equal(opened.own.nextSequence, 1, 'the room read\'s sequence wins over the seed');
  // The account's next read refreshes an unopened seed, but never goes over a room read.
  const later = structuredClone(listed); later.shared.revision = 11;
  assert.equal(seedRoom(seeded, later)!.shared.revision, 11);
  assert.equal(seedRoom(opened, later), opened);
});
