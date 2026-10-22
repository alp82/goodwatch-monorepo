import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomRealtime, type Connection, type SocketLike } from '../src/core/realtime';
import { ApiFailure } from '../src/core/errors';
import { fixtureSnapshot } from '../src/dev/fixtures';

class Socket implements SocketLike {
  onopen: SocketLike['onopen'] = null; onmessage: SocketLike['onmessage'] = null; onclose: SocketLike['onclose'] = null; onerror: SocketLike['onerror'] = null;
  sent: string[] = []; closed = false; send(data: string) { this.sent.push(data); } close() { this.closed = true; }
  open() { this.onopen?.(new Event('open')); }
  frame(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent); }
}
const tick = () => new Promise(resolve => setImmediate(() => resolve(undefined)));
test('new ticket first frame, no live badge before snapshot, stale frames ignored, backoff reconnect and resume', async () => {
  const sockets: Socket[] = []; const statuses: Connection[] = []; let tickets = 0; let ownReads = 0; let revision = 1;
  const scheduled = new Map<number, { fn: () => void; ms: number }>(); let counter = 0;
  const client = new RoomRealtime({ roomId: 'fixture-room', ticket: async () => ({ ticket: `one-use-${++tickets}`, expiresAt: Date.now() + 30000, websocketPath: '/api/yepwatch/v1/realtime' }), socket: path => { assert.equal(path, '/api/yepwatch/v1/realtime'); const socket = new Socket(); sockets.push(socket); return socket; }, revision: () => revision,
    status: status => statuses.push(status), snapshot: snapshot => { revision = snapshot.revision; }, refetchPrivate: async () => { ownReads++; }, random: () => 0.5,
    later: (fn, ms) => { const id = ++counter; scheduled.set(id, { fn, ms }); return id as unknown as ReturnType<typeof setTimeout>; }, cancel: id => { scheduled.delete(id as unknown as number); } });
  client.start(); await tick(); sockets[0].open();
  assert.deepEqual(JSON.parse(sockets[0].sent[0]), { type: 'authenticate', ticket: 'one-use-1', roomId: 'fixture-room', lastRevision: 1 });
  assert.equal(statuses.includes('live'), false);
  const shared = fixtureSnapshot().shared; shared.revision = 2;
  sockets[0].frame({ type: 'room.snapshot', snapshot: shared }); await tick();
  assert.equal(statuses.at(-1), 'live'); assert.equal(ownReads, 1);
  sockets[0].frame({ type: 'room.updated', snapshot: { ...shared, revision: 1 } }); assert.equal(revision, 2);
  sockets[0].onclose?.({} as CloseEvent);
  assert.equal(statuses.at(-1), 'reconnecting'); assert.equal(sockets[0].closed, true);
  const retry = [...scheduled.values()].find(t => t.ms === 500)!; assert.ok(retry); retry.fn(); await tick(); sockets[1].open();
  assert.equal(tickets, 2); assert.equal(JSON.parse(sockets[1].sent[0]).ticket, 'one-use-2');
  client.pause(); const before = tickets; await tick(); assert.equal(tickets, before); assert.equal(statuses.at(-1), 'background');
  client.start(); await tick(); assert.equal(tickets, 3); client.stop();
});
test('missing transport stays unavailable, does not poll or repeatedly request unsupported tickets', async () => {
  const statuses: Connection[] = []; let tickets = 0;
  const client = new RoomRealtime({ roomId: 'fixture-room', ticket: async () => { tickets++; throw new ApiFailure('not_implemented', 'Unavailable'); }, socket: () => { throw new Error('Must not open'); }, snapshot: () => assert.fail('No snapshot'), revision: () => null, refetchPrivate: async () => assert.fail('No polling'), status: value => statuses.push(value), later: () => { throw new Error('No retries'); } });
  client.start(); await tick(); assert.equal(tickets, 1); assert.equal(statuses.at(-1), 'unavailable'); client.stop();
});
test('backgrounding while ticket is loading never opens a late socket', async () => {
  let resolve!: (ticket: { ticket: string; expiresAt: number; websocketPath: string }) => void;
  const client = new RoomRealtime({ roomId: 'r', ticket: () => new Promise(r => { resolve = r; }), socket: () => { throw new Error('Late socket'); }, snapshot: () => undefined, revision: () => null, status: () => undefined, refetchPrivate: async () => undefined });
  client.start(); client.pause(); resolve({ ticket: 'one', expiresAt: 100, websocketPath: '/api/yepwatch/v1/realtime' }); await tick(); client.stop();
});
test('rising shared revisions during an in-flight own repair cause a follow-up repair', async () => {
  let socket!: Socket; let reads = 0; const releases: (() => void)[] = [];
  const client = new RoomRealtime({ roomId: 'fixture-room', ticket: async () => ({ ticket: 't', expiresAt: Date.now() + 30000, websocketPath: '/api/yepwatch/v1/realtime' }), socket: () => (socket = new Socket()), snapshot: () => undefined, revision: () => 0, status: () => undefined,
    refetchPrivate: () => { reads++; return new Promise<void>(resolve => releases.push(resolve)); } });
  client.start(); await tick();
  socket.frame({ type: 'room.snapshot', snapshot: { ...fixtureSnapshot().shared, revision: 2 } });
  socket.frame({ type: 'room.updated', snapshot: { ...fixtureSnapshot().shared, revision: 3 } });
  releases[0](); await tick();
  const observed = reads; client.stop(); releases[1]?.();
  assert.equal(observed, 2);
});
test('ambiguous subscription expiry repairs and reconnects; only confirmed deadline is terminal', async () => {
  let socket!: Socket; let reads = 0; let deadline = Date.now() + 60000;
  const statuses: Connection[] = []; const retries: (() => void)[] = [];
  const client = new RoomRealtime({ roomId: 'fixture-room', ticket: async () => ({ ticket: 't', expiresAt: Date.now() + 30000, websocketPath: '/api/yepwatch/v1/realtime' }), socket: () => (socket = new Socket()), snapshot: () => undefined, revision: () => 0, status: s => statuses.push(s), refetchPrivate: async () => { reads++; }, roomExpiresAt: () => deadline, later: (fn, ms) => { if (ms < 10000) retries.push(fn); return 1; }, cancel: () => undefined });
  client.start(); await tick(); socket.frame({ type: 'error', code: 'expired', message: 'Expired' }); await tick();
  assert.equal(reads, 1); assert.equal(statuses.at(-1), 'reconnecting'); retries[0](); await tick();
  deadline = Date.now() - 1; socket.frame({ type: 'error', code: 'expired', message: 'Expired' });
  assert.equal(statuses.at(-1), 'expired'); assert.equal(socket.closed, true); client.stop();
});
test('HTTP410 while requesting ticket is authoritative expiry even without JSON error code', async () => {
  const statuses: Connection[] = [];
  const client = new RoomRealtime({ roomId: 'fixture-room', ticket: async () => { throw new ApiFailure('outcome_unknown', 'Gone', undefined, 410); }, socket: () => { throw new Error('No socket'); }, snapshot: () => undefined, revision: () => null, status: s => statuses.push(s), refetchPrivate: async () => undefined });
  client.start(); await tick(); assert.equal(statuses.at(-1), 'expired'); client.stop();
});
