import test from 'node:test';
import assert from 'node:assert/strict';
import type { RoomCommand, RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { REGISTRY_LIMITS, decodeDecisions, decodeRooms, markLeft, migrateRecent, upsertRoom, type DecisionRecord } from '../src/core/continuous/room-registry-state';
import { CHUNK_CHARS, REGISTRY_KEYS, chunkedKeyValue, createRegistry, type KeyValue } from '../src/core/continuous/room-registry-store';
import { classify, decisionRecord, roomLabel } from '../src/features/rooms/home-model';
import { changedSettings, showShuffle, startAgain, type RoomSettingsValue } from '../src/features/rooms/round';
import { continuousFixture } from './continuous-fixture';

const NOW = 1_800_000_000_000;
function memory() {
  const items = new Map<string, string>();
  const store: KeyValue & { items: Map<string, string> } = {
    items,
    read: async (k) => items.get(k) ?? null,
    write: async (k, v) => { items.set(k, v); },
    remove: async (k) => { items.delete(k); },
  };
  return store;
}
const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

test('registry keeps several rooms independently, newest first, and drops expired or damaged entries', () => {
  let rooms = upsertRoom([], { roomId: 'a', nickname: 'Mika', expiresAt: NOW + 1000 }, NOW);
  rooms = upsertRoom(rooms, { roomId: 'b', nickname: 'Mika', expiresAt: NOW + 1000 }, NOW + 1);
  rooms = upsertRoom(rooms, { roomId: 'a', nickname: 'Mika', expiresAt: NOW + 2000 }, NOW + 2);
  assert.deepEqual(rooms.map((r) => r.roomId), ['a', 'b']);
  assert.equal(rooms[0].joinedAt, NOW, 'reopening keeps the first join time');
  const raw = JSON.stringify([...rooms, { roomId: 'old', nickname: 'x', expiresAt: NOW - 1 }, { roomId: 'a', nickname: 'dupe', expiresAt: NOW + 5 }, { nope: true }, 'junk']);
  assert.deepEqual(decodeRooms(raw, NOW).map((r) => r.roomId), ['a', 'b']);
  assert.deepEqual(decodeRooms('{', NOW), []);
  const many = Array.from({ length: 20 }, (_, i) => ({ roomId: `r${i}`, nickname: 'n', expiresAt: NOW + 1000 })).reduce((list, e, i) => upsertRoom(list, e, NOW + i), [] as ReturnType<typeof upsertRoom>);
  assert.equal(many.length, REGISTRY_LIMITS.rooms);
  assert.equal(many[0].roomId, 'r19');
});

test('the single recent room of earlier builds migrates once and never duplicates', () => {
  const recent = { roomId: 'legacy', nickname: 'Ana', expiresAt: NOW + 1000 };
  const migrated = migrateRecent([], recent, NOW);
  assert.deepEqual(migrated.map((r) => r.roomId), ['legacy']);
  assert.equal(migrateRecent(migrated, recent, NOW), migrated);
  assert.deepEqual(migrateRecent([], { ...recent, expiresAt: NOW - 1 }, NOW), []);
});

test('registry store migrates, remembers the nickname, forgets ended rooms and dedupes decisions', async () => {
  const store = memory();
  const registry = createRegistry(store, async () => ({ roomId: 'legacy', nickname: 'Ana', expiresAt: NOW + 1000 }), () => NOW);
  const first = await registry.load();
  assert.deepEqual(first.rooms.map((r) => r.roomId), ['legacy']);
  assert.equal(first.nickname, 'Ana', 'the old room nickname seeds the remembered name');
  // Concurrent writers (home, room, sign-in callback) do not lose each other's changes.
  await Promise.all([
    registry.remember({ roomId: 'one', nickname: 'Ana B', expiresAt: NOW + 1000 }),
    registry.remember({ roomId: 'two', nickname: 'Ana B', expiresAt: NOW + 1000 }),
    registry.forget('legacy'),
  ]);
  const after = await registry.load();
  assert.deepEqual(after.rooms.map((r) => r.roomId), ['two', 'one'], 'a forgotten migrated room does not come back');
  assert.equal(after.nickname, 'Ana B');
  await registry.setNickname('  Bo ');
  assert.equal((await registry.load()).nickname, 'Bo');
  const record: DecisionRecord = { id: 'one:2:5', roomId: 'one', roomLabel: 'Cosy', title: 'Heat', year: 1995, posterUrl: 'https://image.tmdb.org/t/p/w500/x.jpg', decidedAt: 5, people: ['Bo', 'Ana'] };
  await registry.recordDecision(record);
  await registry.recordDecision(record);
  assert.equal((await registry.load()).decisions.length, 1);
  // Credentials never enter the registry.
  for (const value of store.items.values()) assert.doesNotMatch(value, /token|invite|secret/i);
});

test('registry never lists a room whose stored credential is missing (the home forgets it as ended)', () => {
  const entry = { roomId: 'gone', nickname: 'Bo', expiresAt: NOW + 1000, joinedAt: NOW, openedAt: NOW };
  assert.equal(classify(entry, { error: { code: 'unauthorized', status: 401 } }, NOW).kind, 'gone');
  assert.equal(classify(entry, { error: { code: 'not_found', status: 404 } }, NOW).kind, 'gone');
  assert.equal(classify(entry, { error: { status: 410 } }, NOW).kind, 'gone');
  assert.equal(classify(entry, { error: { code: 'network' } }, NOW).kind, 'unavailable', 'offline keeps the room');
});

test('home classifies active, left and decided rooms from the room’s own snapshot', () => {
  const entry = { roomId: 'test-room', nickname: 'Host', expiresAt: NOW + 1000, joinedAt: NOW, openedAt: NOW };
  const s = continuousFixture();
  s.shared.expiresAt = NOW + 1000;
  const active = classify(entry, { snapshot: s }, NOW);
  assert.equal(active.kind, 'active');
  assert.equal(active.kind === 'active' && active.room.label, 'Host’s room');
  const left = structuredClone(s);
  (left.own as { left?: boolean }).left = true;
  assert.equal(classify(entry, { snapshot: left }, NOW).kind, 'left');
  const decided = structuredClone(s);
  decided.shared.phase = 'decided';
  decided.shared.decision = { candidateId: 'c2', decidedAt: 77, availability: [] } as unknown as RoomSnapshot['shared']['decision'];
  const c = classify(entry, { snapshot: decided }, NOW);
  assert.equal(c.kind, 'decided');
  assert.equal(c.kind === 'decided' && c.record.id, 'test-room:1:77');
  assert.equal(decisionRecord(decided)?.title, 'Isolated test c2');
  s.shared.description = { prompt: 'a twisty thriller', attributes: [] } as unknown as RoomSnapshot['shared']['description'];
  assert.equal(roomLabel(s), 'A twisty thriller');
});

test('chunked device store keeps every item under 2048 bytes for a worst-case registry and reads it back', async () => {
  const base = memory();
  const kv = chunkedKeyValue(base);
  const registry = createRegistry(kv, async () => null, () => NOW);
  const long = (n: number) => '漢'.repeat(n);
  for (let i = 0; i < REGISTRY_LIMITS.rooms; i++) await registry.remember({ roomId: `${'r'.repeat(190)}${i}`, nickname: long(40), expiresAt: NOW + 1000 });
  for (let i = 0; i < REGISTRY_LIMITS.decisions; i++)
    await registry.recordDecision({ id: `${'d'.repeat(280)}${i}`, roomId: 'r'.repeat(200), roomLabel: long(60), title: long(80), year: 2000, posterUrl: `https://${'p'.repeat(290)}`, decidedAt: i, people: [long(40), long(40), long(40), long(40)] });
  const loaded = await registry.load();
  assert.equal(loaded.rooms.length, REGISTRY_LIMITS.rooms);
  assert.equal(loaded.decisions.length, REGISTRY_LIMITS.decisions);
  assert.ok(base.items.size > 3, 'large lists span several items');
  for (const [key, value] of base.items) assert.ok(bytes(value) <= 2048, `${key} is ${bytes(value)} bytes`);
  for (const key of base.items.keys()) assert.match(key, /^[\w.-]+$/, 'SecureStore key characters only');
});

test('chunked store switches banks atomically: a failure part-way keeps the previous value, a retry succeeds', async () => {
  const base = memory();
  const kv = chunkedKeyValue(base, 10);
  await kv.write('k', 'x'.repeat(35));
  assert.equal(await kv.read('k'), 'x'.repeat(35));
  assert.deepEqual([...base.items.keys()].sort(), ['k', 'k.a.0', 'k.a.1', 'k.a.2', 'k.a.3']);
  // Fail on the third chunk of the replacement.
  let writes = 0;
  const flaky: KeyValue = { ...base, write: async (k, v) => { if (k.startsWith('k.b.') && ++writes === 3) throw new Error('device store busy'); return base.write(k, v); } };
  await assert.rejects(chunkedKeyValue(flaky, 10).write('k', 'y'.repeat(45)));
  assert.equal(await kv.read('k'), 'x'.repeat(35), 'old value still whole');
  await kv.write('k', 'y'.repeat(45));
  assert.equal(await kv.read('k'), 'y'.repeat(45));
  assert.ok(![...base.items.keys()].some((key) => key.startsWith('k.a.')), 'old bank tidied');
  await kv.write('k', 'short');
  assert.equal(await kv.read('k'), 'short');
  assert.deepEqual([...base.items.keys()], ['k']);
  await kv.write('k', '~literal');
  assert.equal(await kv.read('k'), '~literal');
  assert.equal(CHUNK_CHARS * 4 <= 2048, true);
  assert.equal(REGISTRY_KEYS.rooms, 'yepwatch.v3.rooms');
});

test('decoded decisions reject non-https posters and cap people', () => {
  const raw = JSON.stringify([{ id: 'a', roomId: 'r', title: 'T', decidedAt: 1, posterUrl: 'javascript:alert(1)', people: ['a', 'b', 'c', 'd', 'e', 7] }]);
  const [d] = decodeDecisions(raw);
  assert.equal(d.posterUrl, null);
  assert.deepEqual(d.people, ['a', 'b', 'c', 'd']);
});

function roomDriver(start: RoomSnapshot, fail?: RoomCommand['type']) {
  let current = structuredClone(start);
  const sent: RoomCommand[] = [];
  return {
    sent,
    latest: () => current,
    send: async (c: RoomCommand) => {
      sent.push(c);
      if (c.type === fail) return false;
      current = structuredClone(current);
      if (c.type === 'restart') { current.shared.phase = 'setup'; current.shared.generation++; current.shared.revision++; current.shared.contextVersion++; current.shared.rosterVersion++; current.shared.decision = null; }
      if (c.type === 'configure') { current.shared.contextVersion++; current.shared.screens[0].serviceIds = c.serviceIds; }
      if (c.type === 'start') current.shared.phase = 'choosing';
      return true;
    },
  };
}
const decidedRoom = () => {
  const s = continuousFixture();
  s.shared.phase = 'decided';
  s.shared.revision = 9;
  s.shared.decision = { candidateId: 'c1', decidedAt: 5, availability: [] } as unknown as RoomSnapshot['shared']['decision'];
  return s;
};
const same = (s: RoomSnapshot): RoomSettingsValue => ({ country: s.shared.screens[0].country!, serviceIds: [...s.shared.screens[0].serviceIds], constraints: s.shared.constraints, prompt: s.shared.description?.prompt ?? '' });

test('Start again restarts, then starts with the latest versions; unchanged settings are not re-sent', async () => {
  const room = roomDriver(decidedRoom());
  assert.equal(await startAgain(room, same(room.latest())), true);
  assert.deepEqual(room.sent.map((c) => c.type), ['restart', 'start']);
  assert.deepEqual(room.sent[0], { type: 'restart', expectedRevision: 9 });
  assert.deepEqual(room.sent[1], { type: 'start', expectedRosterVersion: 2, expectedContextVersion: 2, hostReady: true });
});

test('Start again saves changed settings between restart and start', async () => {
  const room = roomDriver(decidedRoom());
  const value = { ...same(room.latest()), serviceIds: [8, 9] };
  assert.ok(changedSettings(room.latest(), value));
  assert.equal(await startAgain(room, value), true);
  assert.deepEqual(room.sent.map((c) => c.type), ['restart', 'configure', 'start']);
  assert.equal((room.sent[1] as { expectedContextVersion: number }).expectedContextVersion, 2);
  assert.equal((room.sent[2] as { expectedContextVersion: number }).expectedContextVersion, 3);
});

test('a failed restart keeps the decision and sends nothing else', async () => {
  const room = roomDriver(decidedRoom(), 'restart');
  assert.equal(await startAgain(room, same(room.latest())), false);
  assert.deepEqual(room.sent.map((c) => c.type), ['restart']);
  assert.equal(room.latest().shared.phase, 'decided');
});

test('readiness shuffle shows only while cards are on their way', () => {
  const stream = { version: 1, state: 'ready', reason: null } as RoomSnapshot['shared']['stream'];
  const base = { starting: false, phase: 'choosing' as const, hasCard: false, voting: true, stream, failed: false };
  assert.equal(showShuffle({ ...base, starting: true, phase: 'setup' }), true);
  assert.equal(showShuffle(base), true);
  assert.equal(showShuffle({ ...base, hasCard: true }), false, 'a ready card shows at once');
  assert.equal(showShuffle({ ...base, stream: { ...stream, reason: 'awaiting_answers' } }), false);
  assert.equal(showShuffle({ ...base, stream: { ...stream, state: 'exhausted' } }), false);
  assert.equal(showShuffle({ ...base, failed: true }), false, 'an error offers Try again instead');
  assert.equal(showShuffle({ ...base, voting: false }), false);
});

test('explicit Leave keeps the room in History with Return; reopening clears it; Back never marks it', async () => {
  const store = memory();
  const registry = createRegistry(store, async () => null, () => NOW);
  await registry.remember({ roomId: 'r', nickname: 'Bo', expiresAt: NOW + 1000 });
  await registry.markLeft('r', 'Cosy mystery');
  const [entry] = (await registry.load()).rooms;
  assert.deepEqual(entry.left, { at: NOW, label: 'Cosy mystery' });
  // The server stops showing the room to someone who left (403 forbidden).
  const c = classify(entry, { error: { code: 'forbidden', status: 403 } }, NOW);
  assert.equal(c.kind, 'left');
  assert.equal(c.kind === 'left' && c.room.label, 'Cosy mystery');
  // Without an explicit Leave on this device, forbidden means the access ended.
  assert.equal(classify({ ...entry, left: undefined }, { error: { code: 'forbidden', status: 403 } }, NOW).kind, 'gone');
  await registry.remember({ roomId: 'r', nickname: 'Bo', expiresAt: NOW + 1000 });
  assert.equal((await registry.load()).rooms[0].left, undefined, 'returning clears Left');
  assert.deepEqual(markLeft([], 'x', 'y', NOW), []);
});
