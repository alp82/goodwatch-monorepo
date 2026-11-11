import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkedKeyValue, createRegistry, REGISTRY_KEYS } from '../src/core/continuous/room-registry-store';

test('deletion saves history before hiding it, can recover within the window, and removes both chunk banks after expiry', async () => {
  const values = new Map<string, string>();
  const kv = chunkedKeyValue({ read: async k => values.get(k) ?? null, write: async (k, v) => { values.set(k, v); }, remove: async k => { values.delete(k); } }, 40);
  let now = 1000;
  const expired: string[][] = [];
  const registry = createRegistry(kv, async () => null, () => now, async rooms => { expired.push(rooms); });
  await registry.remember({ roomId: 'room-1', nickname: 'Alex', expiresAt: 99999 });
  await registry.recordDecision({ id: 'decision-1', roomId: 'room-1', roomLabel: 'Our room', title: 'A movie', year: 2026, posterUrl: null, decidedAt: 100, people: ['Alex', 'Mia'] });
  await registry.prepareDeletion('guest');
  const state = { requestedAt: now, purgeAfter: 5000, phase: 'pending' as const, recoveryId: 'recovery-1' };
  await registry.confirmDeletion(state);
  assert.deepEqual(await registry.load(), { rooms: [], nickname: null, decisions: [] });
  assert.equal((await registry.recovery())?.snapshot.decisions[0].title, 'A movie');
  await registry.restoreDeletion();
  assert.equal((await registry.load()).nickname, 'Alex');
  await registry.prepareDeletion('guest');
  await registry.confirmDeletion(state);
  now = 5000;
  assert.equal(await registry.recovery(), null);
  assert.deepEqual(expired, [['room-1']]);
  assert.equal([...values.keys()].some(k => k.startsWith(REGISTRY_KEYS.recovery)), false);
  assert.equal((await registry.load()).nickname, null);
});
