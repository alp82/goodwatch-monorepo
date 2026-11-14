import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { ContinuousRealtime, FIRST_SNAPSHOT_MS, OPEN_TIMEOUT_MS, POLL_MS, SPARE_TICKET_MARGIN_MS, type RealtimeOptions } from '../src/core/continuous/realtime';
import { PLANNED_RESTART_QUIET_MS } from '../src/core/continuous/backoff';
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
// The client computes what is left of a deadline from the clock (Date.now) and hands it to `later`. The
// scheduler here is fake, so the clock is too: a real one ticking between setting a deadline and arming its
// timer turned a 1000 ms wait into 999 ms under load ("Missing 1000ms timer").
mock.timers.enable({ apis: ['Date'], now: Date.now() });
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
    random: () => 0,
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
    cheers: true,
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
test('a restarting gateway clears peer activity; reconnect rotates one-use ticket and session sequence', async () => {
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
  s.frame({ type: 'restarting', retryAfterMs: 500 });
  assert.equal(s.closed, true);
  // An announced restart of a live channel (connection-words.ts keeps it quiet for longer).
  assert.equal(h.statuses.at(-1), 'restarting');
  const count = s.sent.length;
  h.client.sendActivity('trailer');
  assert.equal(s.sent.length, count);
  // The server's 500 ms replaces the shorter first step (250 ms): back within a second of the restart.
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
function liveSocket(h: ReturnType<typeof harness>, n: number) {
  const s = h.sockets[n];
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  return s;
}
test('an announced restart stays "restarting" for PLANNED_RESTART_QUIET_MS at most, never renewed until live again', async () => {
  const h = harness();
  h.client.start();
  await tick();
  liveSocket(h, 0).frame({ type: 'restarting', retryAfterMs: 500 });
  assert.equal(h.statuses.at(-1), 'restarting');
  h.run(500);
  await tick();
  // The next socket is refused (front gone): still the announced restart.
  h.sockets[1].onerror?.(new Event('error'));
  assert.equal(h.statuses.at(-1), 'restarting');
  // A dial that isn't live yet gets another "restarting": it never extends the quiet period.
  mock.timers.tick(PLANNED_RESTART_QUIET_MS - 100);
  h.run(500);
  await tick();
  h.sockets[2].open();
  h.sockets[2].frame({ type: 'restarting', retryAfterMs: 500 });
  assert.equal(h.statuses.at(-1), 'restarting');
  mock.timers.tick(200);
  const next = [...h.jobs.values()].at(-1)!.ms;
  h.run(next);
  await tick();
  assert.equal(h.statuses.at(-1), 'reconnecting', 'past the quiet period it is an ordinary outage');
  // Live again ends it; the next drop without an announcement is an ordinary outage at once.
  liveSocket(h, 3);
  assert.equal(h.statuses.at(-1), 'live');
  h.sockets[3].onclose?.({ code: 1006 } as CloseEvent);
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.client.stop();
});
test('room reads that work end an announced restart: a later failed read is an ordinary outage', async () => {
  let ok = false;
  const h = harness({ privateRead: async () => { if (!ok) throw new RoomFailure('outcome_unknown', 'no answer'); } });
  h.client.start();
  await tick();
  liveSocket(h, 0).frame({ type: 'restarting', retryAfterMs: 500 });
  assert.equal(h.statuses.at(-1), 'restarting');
  // Dials keep failing; after two the room is read over HTTP.
  h.run(500);
  await tick();
  h.sockets[1].onerror?.(new Event('error'));
  ok = true;
  h.run(POLL_MS);
  await tick();
  await tick();
  assert.equal(h.statuses.at(-1), 'polling');
  ok = false;
  const pollJob = [...h.jobs.values()].find((j) => j.ms === POLL_MS);
  assert.ok(pollJob);
  h.run(POLL_MS);
  await tick();
  await tick();
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.client.stop();
});
test('a resumed attempt during an outage (focus, back online) keeps reporting the outage, not connecting', async () => {
  const h = harness({ privateRead: async () => { throw new RoomFailure('outcome_unknown', 'no answer'); } });
  h.client.start();
  await tick();
  liveSocket(h, 0).frame({ type: 'restarting', retryAfterMs: 500 });
  assert.equal(h.statuses.at(-1), 'restarting');
  // Past the gateway's named wait, still in backoff: the page comes back to the front.
  mock.timers.tick(600);
  h.client.resume();
  await tick();
  assert.equal(h.statuses.slice(2).includes('connecting'), false, 'the outage never looked over');
  assert.equal(h.statuses.at(-1), 'restarting');
  // The resumed dial fails after the announcement ran out: an ordinary outage from then on.
  assert.equal(h.sockets.length, 2);
  mock.timers.tick(PLANNED_RESTART_QUIET_MS);
  h.sockets[1].onerror?.(new Event('error'));
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.client.stop();
});
test('close 1012 from a live socket is an announced restart too; from a socket that never went live it is not', async () => {
  const h = harness();
  h.client.start();
  await tick();
  liveSocket(h, 0).onclose?.({ code: 1012 } as CloseEvent);
  assert.equal(h.statuses.at(-1), 'restarting');
  h.client.stop();
  const fresh = harness();
  fresh.client.start();
  await tick();
  fresh.sockets[0].open();
  fresh.sockets[0].onclose?.({ code: 1012 } as CloseEvent);
  assert.equal(fresh.statuses.at(-1), 'reconnecting');
  fresh.sockets.length = 0;
  fresh.client.stop();
  // A "restarting" frame before the first snapshot (the gateway stopping during the handshake) is not either.
  const early = harness();
  early.client.start();
  await tick();
  early.sockets[0].open();
  early.sockets[0].frame({ type: 'restarting', retryAfterMs: 500 });
  assert.equal(early.statuses.at(-1), 'reconnecting');
  early.client.stop();
});
test('rising revisions during own refresh are repaired again; a failed refresh retries with backoff until it succeeds, without polling', async () => {
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
  retry.run(1000);
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
test('decision cheers go out as one matches frame, are rate limited, and the 3 s view renewal never replays them', async () => {
  const h = harness();
  h.client.setView('matches');
  assert.equal(h.client.sendCheer({ kind: 'tap', generation: 2, seed: 7 }), false);
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.open();
  assert.equal(JSON.parse(s.sent[0]).cheers, true);
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({ type: 'activity.session', roomId: 'test-room', sessionId: 'live', serverTime: Date.now() });
  const before = s.sent.length;
  assert.equal(h.client.sendCheer({ kind: 'hold', generation: 2, seed: 99 }), true);
  assert.deepEqual(JSON.parse(s.sent.at(-1)!), { type: 'activity', sessionId: 'live', sequence: 2, view: 'matches', cheer: { kind: 'hold', generation: 2, seed: 99 } });
  h.run(3000);
  const renewal = JSON.parse(s.sent.at(-1)!);
  assert.equal(renewal.cheer, undefined);
  assert.equal(renewal.view, 'matches');
  // At most four cheer frames per second, but a release always goes out.
  for (let i = 0; i < 6; i++) h.client.sendCheer({ kind: 'hold', generation: 2, seed: 99 });
  const cheers = s.sent.slice(before).map((x) => JSON.parse(x)).filter((f) => f.cheer);
  assert.equal(cheers.length, 4);
  assert.equal(h.client.sendCheer({ kind: 'release', generation: 2, seed: 99 }), true);
  assert.equal(JSON.parse(s.sent.at(-1)!).cheer.kind, 'release');
});

test('server restart: busy and network ticket failures back off 0.25-0.5-1-2-4-8-15 s, report each wait, and reconnect with a resync read', async () => {
  let reads = 0;
  let failing = 8;
  const states: { attempting: boolean; retryAt: number }[] = [];
  const h = harness({
    ticket: async () => {
      if (failing-- > 0)
        throw failing % 2 ? new RoomFailure('busy', 'Service unavailable', 503, undefined, undefined, true) : new RoomFailure('outcome_unknown', 'offline');
      return { ticket: 'fresh', expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' };
    },
    // The API is down with the channel: the HTTP fallback reads fail too, so the banner stays.
    privateRead: async () => {
      if (failing >= 0) throw new RoomFailure('outcome_unknown', 'offline');
      reads++;
    },
    attempt: (s) => states.push(s),
  });
  h.client.start();
  await tick();
  for (const ms of [250, 500, 1000, 2000, 4000, 8000, 15000, 15000]) {
    assert.equal(h.statuses.at(-1), 'reconnecting');
    assert.equal(states.at(-1)?.attempting, false);
    assert.ok(states.at(-1)!.retryAt > Date.now(), 'the wait is announced');
    h.run(ms);
    await tick();
  }
  const s = h.sockets[0];
  assert.ok(s, 'reconnected after eight failures');
  assert.equal(states.at(-1)?.attempting, true);
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  await tick();
  assert.equal(h.statuses.at(-1), 'live');
  assert.deepEqual(states.at(-1), { attempting: false, retryAt: 0 });
  assert.equal(reads, 1, 'the snapshot is read again after reconnecting');
  // Success resets the backoff: the next drop waits 250 ms again.
  s.onclose?.(new Event('close') as CloseEvent);
  assert.ok([...h.jobs.values()].some((j) => j.ms === 250));
  h.client.stop();
});
test('never gives up: after many failures it keeps trying every 15 s at most', async () => {
  const h = harness({
    ticket: async () => {
      throw new RoomFailure('outcome_unknown', 'offline');
    },
  });
  h.client.start();
  await tick();
  for (let i = 0; i < 30; i++) {
    const waits = [...h.jobs.values()].map((j) => j.ms).filter((ms) => ms !== POLL_MS);
    assert.equal(waits.length, 1);
    assert.ok(waits[0] <= 19500);
    h.run(waits[0]);
    await tick();
  }
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.client.stop();
  assert.equal(h.jobs.size, 0);
});
test('Refresh (reconnectNow) skips the wait, keeps a live socket, and restarts a stopped channel', async () => {
  let tickets = 0;
  const states: { attempting: boolean; retryAt: number }[] = [];
  const h = harness({
    ticket: async () => {
      if (++tickets === 1) throw new RoomFailure('busy', 'Service unavailable', 503, undefined, undefined, true);
      return { ticket: `t${tickets}`, expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' };
    },
    attempt: (s) => states.push(s),
  });
  h.client.start();
  await tick();
  assert.equal(h.jobs.size, 1);
  h.client.reconnectNow();
  assert.equal(states.at(-1)?.attempting, true, 'Refresh shows an attempt at once');
  assert.equal([...h.jobs.values()].some((j) => j.ms === 1000), false, 'the waiting timer is cancelled');
  await tick();
  assert.equal(tickets, 2);
  const s = h.sockets[0];
  h.client.reconnectNow();
  await tick();
  assert.equal(tickets, 2, 'a running attempt is not doubled');
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  h.client.reconnectNow();
  await tick();
  assert.equal(tickets, 2, 'a live socket is kept');
  assert.equal(s.closed, false);
  h.client.stop();
  h.client.reconnectNow();
  await tick();
  assert.equal(tickets, 3, 'a stopped channel starts again');
  h.client.stop();
});

test('the resync read backs off with jitter and never reads before a server Retry-After, including 429', async () => {
  let reads = 0;
  const failures = [
    new RoomFailure('limit_reached', 'Slow down', 429, undefined, undefined, true, 30),
    new RoomFailure('busy', 'Service unavailable', 503, undefined, undefined, true, 2),
  ];
  let random = 0.5;
  const h = harness({
    random: () => random,
    privateRead: async () => {
      reads++;
      const e = failures.shift();
      if (e) throw e;
    },
  });
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  await tick();
  assert.equal(reads, 1);
  // 429 Retry-After 30 s is the floor, with jitter on top (×1.15 at random 0.5).
  const repairWait = () => [...h.jobs.values()].map((j) => j.ms).filter((ms) => ms !== 3000 && ms !== 20000 && ms !== 35000 && ms !== 10000);
  assert.deepEqual(repairWait(), [34500]);
  // A newer revision during the wait does not read early.
  s.frame({ type: 'room.updated', snapshot: { ...continuousFixture().shared, revision: 2 } });
  await tick();
  assert.equal(reads, 1);
  assert.deepEqual(repairWait(), [34500]);
  random = 0.2;
  h.run(34500);
  await tick();
  assert.equal(reads, 2);
  // 503 Retry-After 2 s beats the 2 s second step; jitter still applies (×1.06).
  assert.deepEqual(repairWait(), [2120]);
  h.run(2120);
  await tick();
  assert.equal(reads, 3);
  assert.deepEqual(repairWait(), []);
  h.client.stop();
});
test('a busy ticket answer with Retry-After is a floor for the reconnect wait', async () => {
  let tickets = 0;
  const h = harness({
    ticket: async () => {
      if (++tickets === 1) throw new RoomFailure('limit_reached', 'Slow down', 429, undefined, undefined, true, 8);
      return { ticket: 'fresh', expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' };
    },
  });
  h.client.start();
  await tick();
  assert.deepEqual([...h.jobs.values()].map((j) => j.ms), [8000]);
  h.run(8000);
  await tick();
  assert.equal(tickets, 2);
  h.client.stop();
});
test('a channel that keeps failing falls back to room reads over HTTP until it connects', async () => {
  let reads = 0;
  let readFails = false;
  const h = harness({ privateRead: async () => { reads++; if (readFails) throw new Error('offline'); } });
  const retryJob = () => {
    const job = [...h.jobs].find(([, j]) => j.ms !== POLL_MS && j.ms !== 10000);
    assert.ok(job, 'Missing retry timer');
    h.jobs.delete(job[0]);
    job[1].fn();
  };
  h.client.start();
  await tick();
  h.sockets[0].onclose?.(new Event('close') as CloseEvent);
  assert.ok(![...h.jobs.values()].some((j) => j.ms === POLL_MS), 'one failure does not poll yet');
  retryJob();
  await tick();
  h.sockets[1].onerror?.(new Event('error'));
  assert.equal([...h.jobs.values()].filter((j) => j.ms === POLL_MS).length, 1);
  h.run(POLL_MS);
  await tick();
  assert.equal(reads, 1);
  assert.equal(h.statuses.at(-1), 'polling');
  // A failed attempt doesn't bring the banner back while reads work, and only one read loop runs.
  retryJob();
  await tick();
  assert.equal(h.statuses.at(-1), 'polling');
  h.sockets[2].onclose?.(new Event('close') as CloseEvent);
  assert.equal(h.statuses.at(-1), 'polling');
  assert.equal([...h.jobs.values()].filter((j) => j.ms === POLL_MS).length, 1);
  readFails = true;
  h.run(POLL_MS);
  await tick();
  assert.equal(h.statuses.at(-1), 'reconnecting');
  readFails = false;
  retryJob();
  await tick();
  const s = h.sockets[3];
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  assert.equal(h.statuses.at(-1), 'live');
  await tick();
  assert.ok(![...h.jobs.values()].some((j) => j.ms === POLL_MS), 'live stops the reads');
  h.client.stop();
});
test('the HTTP fallback honors a server Retry-After instead of reading every few seconds', async () => {
  const h = harness({
    privateRead: async () => { throw new RoomFailure('busy', 'Service unavailable', 503, undefined, undefined, true, 30); },
    ticket: async () => { throw new RoomFailure('outcome_unknown', 'offline'); },
  });
  h.client.start();
  await tick();
  h.run([...h.jobs.values()].find((j) => j.ms !== POLL_MS)!.ms);
  await tick();
  h.run(POLL_MS);
  await tick();
  await tick();
  const polls = [...h.jobs.values()].map((j) => j.ms).filter((ms) => ms >= 30000);
  assert.equal(polls.length, 1, `next read waits for Retry-After: ${[...h.jobs.values()].map((j) => j.ms)}`);
  h.client.stop();
  assert.equal(h.jobs.size, 0);
});
test('a refused authenticate frame reconnects with a fresh ticket; only the ticket answer can end access', async () => {
  const errors: RoomFailure[] = [];
  let refuse = false;
  const h = harness({
    authorityError: (e) => errors.push(e),
    ticket: async () => {
      if (refuse) throw new RoomFailure('unauthorized', 'Room credential required', 401);
      return { ticket: 'fresh', expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' };
    },
  });
  h.client.start();
  await tick();
  // The gateway's authentication timeout (the authenticate frame was held up offline) says "unauthorized".
  h.sockets[0].open();
  h.sockets[0].frame({ type: 'error', code: 'unauthorized' });
  await tick();
  assert.equal(errors.length, 0, 'a refused socket is not lost access');
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.run(250);
  await tick();
  assert.equal(h.sockets.length, 2, 'reconnected with a fresh ticket');
  refuse = true;
  h.sockets[1].frame({ type: 'error', code: 'forbidden' });
  h.run(500);
  await tick();
  assert.equal(errors[0]?.code, 'unauthorized', 'the ticket endpoint decides');
  assert.equal(h.statuses.at(-1), 'unavailable');
  assert.equal(h.jobs.size, 0);
});
test('resume (back online, back in front) connects at once with a fresh backoff and keeps a live socket', async () => {
  let failing = 3;
  const h = harness({
    ticket: async () => {
      if (failing-- > 0) throw new RoomFailure('outcome_unknown', 'offline');
      return { ticket: 'fresh', expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' };
    },
  });
  h.client.start();
  await tick();
  h.run(250);
  await tick();
  h.run(500);
  await tick();
  assert.ok([...h.jobs.values()].some((j) => j.ms === 1000), 'offline attempts back off');
  h.client.resume();
  await tick();
  assert.equal([...h.jobs.values()].some((j) => j.ms === 1000), false, 'the long wait is dropped');
  assert.equal(h.sockets.length, 1, 'connected right away');
  h.sockets[0].frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  assert.equal(h.statuses.at(-1), 'live');
  h.client.resume();
  await tick();
  assert.equal(h.sockets[0].closed, false, 'a live socket is kept');
  assert.equal(h.sockets.length, 1);
  h.client.stop();
});
test('degraded keeps the socket: the room is read over HTTP until the gateway sends a fresh snapshot', async () => {
  let reads = 0;
  let cleared = 0;
  const h = harness({ privateRead: async () => { reads++; }, clearActivity: () => { cleared++; } });
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({ type: 'activity.session', roomId: 'test-room', sessionId: 's1', serverTime: Date.now() });
  await tick();
  const before = reads;
  const clearedBefore = cleared;
  s.frame({ type: 'degraded', retryAfterMs: 10000 });
  await tick();
  assert.equal(s.closed, false, 'no 10 s reconnect wait');
  assert.equal(h.sockets.length, 1);
  assert.equal(reads, before + 1, 'read over HTTP at once');
  assert.ok(cleared > clearedBefore, 'peer activity is cleared while updates may be stale');
  const count = s.sent.length;
  h.client.sendActivity('trailer');
  assert.equal(s.sent.length, count, 'no activity while degraded');
  h.run(POLL_MS);
  await tick();
  assert.equal(reads, before + 2, 'and keeps reading until the gateway recovers');
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  assert.equal(h.statuses.at(-1), 'live');
  assert.equal([...h.jobs.values()].some((j) => j.ms === POLL_MS), false, 'polling stops');
  assert.equal(s.sent.length, count + 1, 'recovery tells the others at once');
  assert.equal(JSON.parse(s.sent.at(-1)!).type, 'activity');
  h.client.sendActivity('trailer');
  assert.equal(s.sent.length, count + 2, 'the activity session carries on');
  h.client.stop();
});
test('a renewal that comes due while degraded keeps the presence going after recovery', async () => {
  const h = harness();
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.frame({ type: 'activity.session', roomId: 'test-room', sessionId: 's1', serverTime: Date.now() });
  s.frame({ type: 'degraded', retryAfterMs: 10000 });
  await tick();
  const count = s.sent.length;
  h.run(3000);
  assert.equal(s.sent.length, count, 'nothing goes out while degraded');
  assert.ok([...h.jobs.values()].some((j) => j.ms === 3000), 'the renewal keeps ticking');
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  assert.equal(s.sent.length, count + 1);
  h.run(3000);
  assert.equal(s.sent.length, count + 2, 'renewals resume');
  h.client.stop();
});
test('degraded: a 429 on the resync read holds the HTTP fallback too, and the two never read at once', async () => {
  let reads = 0;
  let inFlight = 0;
  let most = 0;
  const releases: (() => void)[] = [];
  let fail: RoomFailure | null = new RoomFailure('limit_reached', 'Slow down', 429, undefined, undefined, true, 30);
  const h = harness({
    privateRead: () => {
      reads++;
      most = Math.max(most, ++inFlight);
      return new Promise<void>((resolve, reject) => releases.push(() => {
        inFlight--;
        const e = fail;
        fail = null;
        if (e) reject(e); else resolve();
      }));
    },
  });
  h.client.start();
  await tick();
  const s = h.sockets[0];
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  await tick();
  releases.shift()!(); // the first resync read answers 429, Retry-After 30 s
  await tick();
  await tick();
  assert.equal(reads, 1);
  // Live again before degrading, so the 30 s deadline stands.
  s.frame({ type: 'degraded', retryAfterMs: 10000 });
  await tick();
  assert.equal(reads, 1, 'degraded does not read before the Retry-After');
  const waits = [...h.jobs.values()].map((j) => j.ms).filter((ms) => ms >= 30000 && ms < 35000);
  assert.ok(waits.length >= 1, `both readers wait for the deadline: ${[...h.jobs.values()].map((j) => j.ms)}`);
  assert.equal([...h.jobs.values()].some((j) => j.ms === POLL_MS), false, 'no poll 5 s later');
  for (const ms of waits) h.run(ms);
  await tick();
  assert.equal(reads, 2, 'one read when the deadline passes');
  assert.equal(most, 1, 'never two reads at once');
  releases.shift()!();
  await tick();
  await tick();
  h.client.stop();
});
test('resume keeps a running attempt and a server-named wait', async () => {
  let tickets = 0;
  let hold: (() => void) | null = null;
  const h = harness({
    ticket: () => {
      tickets++;
      if (tickets === 1) return Promise.reject(new RoomFailure('limit_reached', 'Slow down', 429, undefined, undefined, true, 8));
      return new Promise((r) => { hold = () => r({ ticket: 'fresh', expiresAt: Date.now() + 10000, websocketPath: '/api/yepwatch/v1/proposal/realtime' }); });
    },
  });
  h.client.start();
  await tick();
  assert.deepEqual([...h.jobs.values()].map((j) => j.ms), [8000]);
  h.client.resume();
  await tick();
  assert.equal(tickets, 1, 'no new ticket before the Retry-After');
  assert.deepEqual([...h.jobs.values()].map((j) => j.ms), [8000]);
  h.run(8000);
  await tick();
  assert.equal(tickets, 2);
  h.client.resume();
  await tick();
  assert.equal(tickets, 2, 'a running attempt is kept');
  (hold as unknown as () => void)();
  await tick();
  assert.equal(h.sockets.length, 1);
  h.client.stop();
});
test('a handshake that never opens is dropped after 1.5 s and redialed at once with its unused ticket', async () => {
  const h = harness();
  h.client.start();
  await tick();
  const hung = h.sockets[0];
  // No open, no error, no close: a connection lost on the way. The 10 s wait was for the gateway's answer.
  assert.deepEqual([...h.jobs.values()].map((j) => j.ms), [OPEN_TIMEOUT_MS]);
  h.run(OPEN_TIMEOUT_MS);
  assert.equal(hung.closed, true, 'the hung socket is abandoned');
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.run(250);
  await tick();
  // The ticket only goes out after the open: the hung socket never sent it, so the redial takes it.
  assert.equal(h.tickets(), 1, 'no second ticket');
  const next = h.sockets[1];
  next.open();
  assert.equal(JSON.parse(next.sent[0]).ticket, 'ticket-1');
  assert.deepEqual(hung.sent, [], 'the abandoned socket said nothing');
  // Open: the gateway now has FIRST_SNAPSHOT_MS to authenticate and send the room.
  assert.deepEqual([...h.jobs.values()].map((j) => j.ms), [FIRST_SNAPSHOT_MS]);
  next.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  assert.equal(h.statuses.at(-1), 'live');
  // Once used, a ticket is never offered again: the next drop asks for a fresh one.
  next.onclose?.(new Event('close') as CloseEvent);
  h.run(250);
  await tick();
  assert.equal(h.tickets(), 2);
  h.client.stop();
});
test('a socket that cannot be cancelled while connecting (React Native on Android) is closed the moment it opens late', async () => {
  class Uncancellable extends Socket {
    isOpen = false;
    override close() {
      if (this.isOpen) this.closed = true;
    }
  }
  const sockets: Uncancellable[] = [];
  const h = harness({
    socket: () => {
      const s = new Uncancellable();
      sockets.push(s);
      return s;
    },
  });
  h.client.start();
  await tick();
  h.run(OPEN_TIMEOUT_MS);
  assert.equal(sockets[0].closed, false, 'the close while connecting did nothing');
  sockets[0].isOpen = true;
  sockets[0].open();
  assert.equal(sockets[0].closed, true, 'closed as soon as it opened');
  assert.deepEqual(sockets[0].sent, [], 'and never authenticated');
  h.client.stop();
});
test('a channel stopped or replaced while its socket connects closes that socket once it opens, not while it connects', async () => {
  class Connecting extends Socket {
    readyState = 0;
    override open() {
      this.readyState = 1;
      super.open();
    }
    hangs = false;
    override close() {
      // A browser reports "closed before the connection is established" for this: only for a hung handshake.
      if (!this.hangs) assert.notEqual(this.readyState, 0, 'closed while still connecting');
      this.readyState = 3;
      super.close();
    }
  }
  const sockets: Connecting[] = [];
  const h = harness({
    socket: () => {
      const s = new Connecting();
      sockets.push(s);
      return s;
    },
  });
  h.client.start();
  await tick();
  // Started again (back in front) while the first socket still connects: a new socket, the old one left to open.
  h.client.start();
  await tick();
  assert.equal(sockets.length, 2);
  assert.equal(sockets[0].closed, false);
  sockets[0].open();
  assert.equal(sockets[0].closed, true, 'closed the moment it opened');
  assert.deepEqual(sockets[0].sent, [], 'without a word');
  h.client.stop();
  sockets[1].open();
  assert.equal(sockets[1].closed, true);
  assert.deepEqual(sockets[1].sent, []);
  // A replaced socket that never opens still gives up at its own open timeout: later dials would wait behind it.
  const stuck = harness({
    socket: () => {
      const s = new Connecting();
      s.hangs = true;
      sockets.push(s);
      return s;
    },
  });
  stuck.client.start();
  await tick();
  const first = sockets.at(-1)!;
  stuck.client.start();
  await tick();
  assert.equal(first.closed, false);
  stuck.run(OPEN_TIMEOUT_MS); // the first socket's deadline
  assert.equal(first.closed, true, 'closed at its open timeout');
  stuck.client.stop();
  // A hung handshake is still cut off at once: the browser would make the redial wait behind it.
  const hung = harness();
  hung.client.start();
  await tick();
  hung.run(OPEN_TIMEOUT_MS);
  assert.equal(hung.sockets[0].closed, true);
  hung.client.stop();
});
test('a refused handshake keeps its ticket for the next dial; a spare close to expiry or after stop is not used', async () => {
  const life = 10000;
  let tickets = 0;
  const sockets: Socket[] = [];
  const h = harness({
    ticket: async () => ({ ticket: `t${++tickets}`, expiresAt: Date.now() + life, websocketPath: '/api/yepwatch/v1/proposal/realtime' }),
    socket: () => {
      const s = new Socket();
      sockets.push(s);
      return s;
    },
  });
  h.client.start();
  await tick();
  // A browser or network that refuses WebSockets: error + close before any open.
  sockets[0].onerror?.(new Event('error'));
  h.run(250);
  await tick();
  sockets[1].onerror?.(new Event('error'));
  h.run(500);
  await tick();
  assert.equal(tickets, 1, 'one ticket for three refused dials');
  // Under SPARE_TICKET_MARGIN_MS of life left: a fresh one.
  mock.timers.tick(10000 - SPARE_TICKET_MARGIN_MS + 1);
  sockets[2].onerror?.(new Event('error'));
  h.run(1000);
  await tick();
  assert.equal(tickets, 2, 'the spare had too little life left');
  sockets[3].onerror?.(new Event('error'));
  h.run(2000);
  await tick();
  assert.equal(tickets, 2, 'the fresh one is kept in turn');
  sockets[4].onerror?.(new Event('error'));
  h.client.stop();
  h.client.start();
  await tick();
  assert.equal(tickets, 3, 'stop drops the spare');
  h.client.stop();
});
test('handshakes that keep timing out wait longer each time (1.5-3-6-10 s), and an open starts over', async () => {
  const h = harness();
  h.client.start();
  await tick();
  for (const [open, wait] of [[1500, 250], [3000, 500], [6000, 1000], [10000, 2000], [10000, 4000]]) {
    h.run(open);
    h.run(wait);
    await tick();
  }
  const s = h.sockets.at(-1)!;
  s.open();
  s.frame({ type: 'room.snapshot', snapshot: continuousFixture().shared });
  s.onclose?.(new Event('close') as CloseEvent);
  h.run(250);
  await tick();
  assert.ok([...h.jobs.values()].some((j) => j.ms === OPEN_TIMEOUT_MS), 'after an open the next handshake gets 1.5 s again');
  h.client.stop();
});
test('a socket that opened but sends nothing is given up after FIRST_SNAPSHOT_MS, not the open timeout', async () => {
  const h = harness();
  h.client.start();
  await tick();
  h.sockets[0].open();
  assert.equal([...h.jobs.values()].some((j) => j.ms === OPEN_TIMEOUT_MS), false);
  h.run(FIRST_SNAPSHOT_MS);
  assert.equal(h.sockets[0].closed, true);
  assert.equal(h.statuses.at(-1), 'reconnecting');
  h.client.stop();
});
