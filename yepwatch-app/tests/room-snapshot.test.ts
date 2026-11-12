import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { restoredRoom, savedRoom, SAVED_ROOM_MAX_AGE_MS } from '../src/core/continuous/room-snapshot-state';
import { continuousFixture } from './continuous-fixture';

const now = Date.now();
function room() {
  const r = continuousFixture();
  return { ...r, shared: { ...r.shared, expiresAt: now + 3_600_000 }, own: { ...r.own, member: { state: 'linked' as const, prefill: { country: 'DE', serviceIds: [8], savedProgressAvailable: true } } } };
}

test('a saved room keeps the room and this device’s place, never the account prefill', () => {
  const saved = savedRoom(room(), 'e1', now);
  assert.ok(saved);
  assert.equal(saved.snapshot.own.member.prefill, null);
  assert.equal(saved.snapshot.own.member.state, 'linked');
  assert.deepEqual(saved.snapshot.shared, room().shared);
});

test('a reload paints the saved room only for the same room, sign-in epoch and within the age limit', () => {
  const r = room();
  const raw = JSON.stringify(savedRoom(r, 'e1', now));
  assert.equal(restoredRoom(raw, r.shared.roomId, 'e1', now + 1000)?.shared.revision, r.shared.revision);
  assert.equal(restoredRoom(raw, r.shared.roomId, 'e2', now + 1000), null, 'another sign-in');
  assert.equal(restoredRoom(raw, 'other-room', 'e1', now + 1000), null, 'another room');
  assert.equal(restoredRoom(raw, r.shared.roomId, 'e1', now + SAVED_ROOM_MAX_AGE_MS + 1), null, 'stale');
  assert.equal(restoredRoom(raw, r.shared.roomId, 'e1', now - 1000), null, 'from the future');
  for (const bad of [null, '', '{', '{}', JSON.stringify({ v: 1, epoch: 'e1', savedAt: now, snapshot: { shared: {} } })])
    assert.equal(restoredRoom(bad, r.shared.roomId, 'e1', now), null);
});

test('nothing is kept for a room this device left or one that ended', () => {
  const r = room();
  assert.equal(savedRoom({ ...r, own: { ...r.own, left: true } }, 'e1', now), null);
  assert.equal(savedRoom({ ...r, shared: { ...r.shared, expiresAt: now - 1 } }, 'e1', now), null);
  const raw = JSON.stringify(savedRoom(r, 'e1', now));
  assert.equal(restoredRoom(raw, r.shared.roomId, 'e1', r.shared.expiresAt + 1), null);
});
