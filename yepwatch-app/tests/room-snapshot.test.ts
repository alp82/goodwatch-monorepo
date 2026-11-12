import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createSnapshotStore, restoredRoom, savedRoom, SAVED_ROOM_MAX_AGE_MS } from '../src/core/continuous/room-snapshot-state';
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

// One browser: localStorage is shared by its tabs, each tab has its own sessionStorage.
class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  keys() { return [...this.m.keys()]; }
}
function browser() {
  const shared = new MemoryStorage();
  let clock = now;
  const tabs: ReturnType<typeof createSnapshotStore>[] = [];
  const tab = (session = new MemoryStorage()) => {
    const store = createSnapshotStore({ session, shared, now: () => clock });
    tabs.push(store);
    return { store, session };
  };
  return { shared, tab, tick: (ms: number) => { clock += ms; }, at: () => clock,
    /** The storage event every other tab of this browser gets. */
    broadcast: (from: ReturnType<typeof createSnapshotStore>) => tabs.filter((t) => t !== from).forEach((t) => t.sharedChanged()) };
}

test('a room is saved only after an authorized read under the current sign-in, with that read\'s time', () => {
  const b = browser();
  const { store } = b.tab();
  const r = room();
  store.save(r.shared.roomId, r);
  assert.equal(store.read(r.shared.roomId), null, 'never confirmed by the server in this page');
  const asked = store.generation();
  store.confirm(r.shared.roomId, asked);
  b.tick(60_000);
  store.save(r.shared.roomId, r);
  b.tick(1000);
  assert.equal(store.read(r.shared.roomId)?.shared.revision, r.shared.revision);
});

test('same-tab Log out: nothing saved before it paints again, and later saves wait for a fresh read', () => {
  const b = browser();
  const { store, session } = b.tab();
  const r = room();
  const asked = store.generation();
  store.confirm(r.shared.roomId, asked);
  store.save(r.shared.roomId, r);
  store.replaceGeneration();
  assert.equal(session.keys().filter((k) => k.includes('room-snapshot')).length, 0, 'saved rooms are gone');
  store.save(r.shared.roomId, r);
  assert.equal(store.read(r.shared.roomId), null, 'the retained room is not saved again under the new sign-in');
  store.confirm(r.shared.roomId, asked);
  store.save(r.shared.roomId, r);
  assert.equal(store.read(r.shared.roomId), null, 'a read asked before Log out doesn\'t count');
  store.confirm(r.shared.roomId, store.generation());
  store.save(r.shared.roomId, r);
  assert.ok(store.read(r.shared.roomId), 'a read after Log out does');
});

test('Log out or a sign-in in another tab: this tab\'s saved rooms never paint and its retained room isn\'t saved', () => {
  const b = browser();
  const one = b.tab();
  const two = b.tab();
  const r = room();
  one.store.confirm(r.shared.roomId, one.store.generation());
  one.store.save(r.shared.roomId, r);
  two.store.replaceGeneration();
  // Before this tab hears of it (or if it never does: closed, restored later), the saved room is refused.
  assert.equal(one.store.read(r.shared.roomId), null);
  b.broadcast(two.store);
  assert.equal(one.session.keys().filter((k) => k.includes('room-snapshot')).length, 0, 'removed on the storage event');
  one.store.save(r.shared.roomId, r);
  assert.equal(one.store.read(r.shared.roomId), null);
});

test('a sign-in redirect: the reloaded page paints nothing saved before it', () => {
  const b = browser();
  const before = b.tab();
  const r = room();
  before.store.confirm(r.shared.roomId, before.store.generation());
  before.store.save(r.shared.roomId, r);
  before.store.replaceGeneration(); // Continue with GoodWatch, before leaving the page
  before.store.save(r.shared.roomId, r); // pagehide flush
  const after = b.tab(before.session); // same tab, new page
  assert.equal(after.store.read(r.shared.roomId), null);
});

test('a restored room keeps its server time: reloads during an outage stop painting it after 15 minutes', () => {
  const b = browser();
  const first = b.tab();
  const r = room();
  first.store.confirm(r.shared.roomId, first.store.generation());
  first.store.save(r.shared.roomId, r);
  let page = first;
  for (let i = 0; i < 6; i++) {
    b.tick(4 * 60_000);
    page = b.tab(page.session); // reload; the server doesn't answer
    const shown = page.store.read(r.shared.roomId);
    page.store.save(r.shared.roomId, shown ?? r); // cache updates, pagehide, unmount
    if (b.at() - now > SAVED_ROOM_MAX_AGE_MS) assert.equal(shown, null, `${(b.at() - now) / 60_000} min`);
    else assert.ok(shown, `${(b.at() - now) / 60_000} min`);
  }
});

test('without shared storage (blocked) nothing is saved or painted', () => {
  const store = createSnapshotStore({ session: new MemoryStorage(), shared: null, now: () => now });
  const r = room();
  store.confirm(r.shared.roomId, store.generation());
  store.save(r.shared.roomId, r);
  assert.equal(store.read(r.shared.roomId), null);
});
