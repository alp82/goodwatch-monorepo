import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuousRealtime, type RealtimeOptions } from '../src/core/continuous/realtime';
import type { SocketLike } from '../src/core/realtime';
import { continuousFixture, activityFixture } from './continuous-fixture';
import { RoomFailure } from '../src/core/continuous/api-client';
class Socket implements SocketLike {
  onopen: SocketLike['onopen'] = null;
  onmessage: SocketLike['onmessage'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  sent: string[] = [];
  closed = false;
  send(s: string) {
    this.sent.push(s);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event('open'));
  }
  frame(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) } as MessageEvent);
  }
}
const tick = () => new Promise<void>((r) => setImmediate(r));
function harness(overrides: Partial<RealtimeOptions> = {}) {
  const sockets: Socket[] = [];
  const statuses: string[] = [];
  let tickets = 0;
  let cleared = 0;
  const jobs = new Map<number, { fn: () => void; ms: number }>();
  let counter = 0;
  const client = new ContinuousRealtime({
    roomId: 'test-room',
    ticket: async () => ({
      ticket: `ticket-${++tickets}`,
      expiresAt: Date.now() + 10000,
      websocketPath: '/api/yepwatch/v1/proposal/realtime',
    }),
    socket: () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    },
    snapshot: () => undefined,
    privateRead: async () => undefined,
    revision: () => 1,
    expiresAt: () => Date.now() + 100000,
    status: (s) => statuses.push(s),
    activity: () => undefined,
    clearActivity: () => {
      cleared++;
    },
    serverClock: () => undefined,
    authorityError: () => undefined,
    random: () => 0.5,
    later: (fn, ms) => {
      const id = ++counter;
      jobs.set(id, { fn, ms });
      return id;
    },
    cancel: (id) => {
      jobs.delete(Number(id));
    },
    ...overrides,
  });
  const run = (ms: number) => {
    const job = [...jobs].find(([, j]) => j.ms === ms);
    assert.ok(job, `Missing ${ms}ms timer`);
    jobs.delete(job[0]);
    job[1].fn();
  };
  return { client, sockets, statuses, jobs, run, tickets: () => tickets, cleared: () => cleared };
}
test('activity requires authenticated live snapshot and a fresh session; background sends away then suppresses', async () => {
  const h = harness();
  h.client.setView('matches');
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.open();
  assert.deepEqual(JSON.parse(s.sent[0]), {
    type: 'authenticate',
    ticket: 'ticket-1',
    roomId: 'test-room',
    lastRevision: 1,
    pointers: true,
    roomDetails: true,
  });
  h.client.sendActivity('matches', 'handle');
  assert.equal(s.sent.length, 1);
  s.frame({
    type: 'activity.session',
    roomId: 'test-room',
    sessionId: 'too-early',
    serverTime: Date.now(),
  });
  h.client.sendActivity();
  assert.equal(s.sent.length, 1);
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({
    type: 'activity.session',
    roomId: 'test-room',
    sessionId: 'authorized',
    serverTime: Date.now(),
  });
  assert.equal(h.statuses.at(-1), 'live');
  assert.deepEqual(JSON.parse(s.sent[1]), {
    type: 'activity',
    sessionId: 'authorized',
    sequence: 1,
    view: 'matches',
  });
  h.client.sendActivity('matches', 'release', 'answer');
  assert.deepEqual(JSON.parse(s.sent[2]), {
    type: 'activity',
    sessionId: 'authorized',
    sequence: 2,
    view: 'matches',
    gesture: 'release',
  });
  h.client.sendActivity('matches', undefined, undefined, { kind: 'lens' });
  assert.deepEqual(JSON.parse(s.sent[3]).inspection, { kind: 'lens' });
  h.run(3000);
  assert.equal(JSON.parse(s.sent.at(-1)!).inspection, undefined);
  h.client.setView('voting');
  h.client.sendActivity('voting', undefined, 'answer', { kind: 'dice' });
  assert.equal(JSON.parse(s.sent.at(-1)!).beat, 'answer');
  assert.equal(JSON.parse(s.sent.at(-1)!).inspection, undefined);
  assert.equal(JSON.parse(s.sent.at(-1)!).gesture, undefined);
  h.client.pause();
  assert.equal(JSON.parse(s.sent.at(-1)!).view, 'away');
  const count = s.sent.length;
  h.client.sendActivity('voting', 'handle');
  assert.equal(s.sent.length, count);
  assert.equal(h.statuses.at(-1), 'background');
  assert.ok(h.cleared() >= 2);
});
test('degraded transport clears peer activity; reconnect rotates one-use ticket and session sequence', async () => {
  const h = harness();
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({
    type: 'activity.session',
    roomId: 'test-room',
    sessionId: 's1',
    serverTime: Date.now(),
  });
  s.frame({ type: 'degraded', retryAfterMs: 500 });
  assert.equal(s.closed, true);
  assert.equal(h.statuses.at(-1), 'reconnecting');
  const count = s.sent.length;
  h.client.sendActivity('trailer');
  assert.equal(s.sent.length, count);
  h.run(500);
  await tick();
  const next = h.sockets[1];
  next.open();
  assert.equal(JSON.parse(next.sent[0]).ticket, 'ticket-2');
  next.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  next.frame({
    type: 'activity.session',
    roomId: 'test-room',
    sessionId: 's2',
    serverTime: Date.now(),
  });
  assert.equal(JSON.parse(next.sent[1]).sequence, 1);
  assert.equal(JSON.parse(next.sent[1]).sessionId, 's2');
  h.client.stop();
});
test('rising revisions during own refresh are repaired again; a single failed refresh gets bounded retry without polling', async () => {
  let reads = 0;
  const releases: (() => void)[] = [];
  const h = harness({
    privateRead: () => {
      reads++;
      return new Promise<void>((r) => releases.push(r));
    },
  });
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({ type: 'room.updated', snapshot: { ...continuousFixture().shared, revision: 2 } });
  releases[0]();
  await tick();
  assert.equal(reads, 2);
  h.client.stop();
  releases[1]();
  await tick();
  let attempts = 0;
  const retry = harness({
    privateRead: async () => {
      if (++attempts === 1) throw new Error('offline');
    },
  });
  retry.client.start();
  await tick();
  retry.sockets[0].frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  await tick();
  retry.run(500);
  await tick();
  assert.equal(attempts, 2);
  assert.equal(
    [...retry.jobs.values()].some((j) => j.ms < 10000 && j.ms !== 3000),
    false
  );
  retry.client.stop();
});
test('lease expiry stays reconnectable; authoritative deadline and410 stop terminally, late tickets after pause cannot open', async () => {
  const h = harness();
  h.client.start();
  await tick();
  h.sockets[0].frame({ type: 'error', code: 'expired' });
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.client.stop();
  const expired = harness({ expiresAt: () => Date.now() - 1 });
  expired.client.start();
  await tick();
  expired.sockets[0].frame({ type: 'error', code: 'expired' });
  assert.equal(expired.statuses.at(-1), 'expired');
  assert.equal(expired.jobs.size, 0);
  const gone = harness({
    ticket: async () => {
      throw new RoomFailure('outcome_unknown', 'gone', 410);
    },
  });
  gone.client.start();
  await tick();
  assert.equal(gone.statuses.at(-1), 'expired');
  let release!: (t: { ticket: string; expiresAt: number; websocketPath: string }) => void;
  const late = harness({
    ticket: () =>
      new Promise((r) => {
        release = r;
      }),
  });
  late.client.start();
  late.client.pause();
  release({ ticket: 'late', expiresAt: 1, websocketPath: '/api/yepwatch/v1/proposal/realtime' });
  await tick();
  assert.equal(late.sockets.length, 0);
});
test('malformed public activity is never delivered; unknown frame triggers repair rather than rendering private fields', async () => {
  let delivered = 0;
  const h = harness({
    activity: () => {
      delivered++;
    },
  });
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({ ...activityFixture(), title: 'private' });
  assert.equal(delivered, 0);
  assert.equal(s.closed, true);
  h.client.stop();
});
