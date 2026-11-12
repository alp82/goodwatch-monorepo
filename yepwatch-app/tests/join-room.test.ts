import test from 'node:test';
import assert from 'node:assert/strict';
import * as backoff from '../src/core/continuous/backoff';
import * as state from '../src/core/continuous/state';
import { ADMISSION_TIMEOUT_MS, RoomFailure } from '../src/core/continuous/api-client';
import { ResendResume, resendOutcome, sendFailure } from '../src/core/continuous/resend-resume';
import { admissionServer } from './admission-server';
import { continuousFixture } from './continuous-fixture';
import { loadIsolated } from './isolated-module';

// The real join (join-room.ts, on resend.ts) with its device and network edges replaced: a fake server that
// seats one participant per command id + secret and checks the 12-person limit only for a new one (the real
// one's contract, proposal-service.server.ts joinRoom), in-memory storage, instant waits.
const noAnswer = () => new RoomFailure('outcome_unknown', 'Your action has not been confirmed.');
const LIMIT = 12;
type Request = { commandId: string; admissionSecret: string; nickname: string; inviteCode: string };
type Saved = { request: { contractVersion: 3; commandId: string; admissionSecret: string; nickname: string }; code: string; intent: string; member: boolean; retryAt: number };
type Attempt = (request: Request, signal: AbortSignal | undefined, n: number) => Promise<'answer' | 'lost'> | 'answer' | 'lost';
type Join = (saved: Saved, o: { intent: string; signal: AbortSignal; onTrouble?: (since: number) => void; onSaved?: (saved: Saved | null) => void }) => Promise<string>;

function harness(script: Attempt, o: { offline?: boolean; seated?: number; onSleep?: (ms: number) => void } = {}) {
  const participants = new Set<string>(Array.from({ length: o.seated ?? 1 }, (_, i) => `existing-${i}`));
  const sent: Request[] = [];
  const waits: number[] = [];
  const log: string[] = [];
  let admission: unknown = null;
  const join = async (roomId: string, request: Request, _access: unknown, signal?: AbortSignal) => {
    sent.push(request);
    log.push('post');
    const outcome = await script(request, signal, sent.length);
    // The server seats the friend whether or not its answer reaches the phone.
    const id = `p:${request.commandId}:${request.admissionSecret}`;
    if (!participants.has(id)) {
      if (participants.size >= LIMIT) throw new RoomFailure('limit_reached', 'Room is full', 409);
      participants.add(id);
    }
    if (outcome === 'lost') throw noAnswer();
    const snapshot = continuousFixture();
    snapshot.shared.roomId = roomId;
    return { credential: { roomId, participantId: id, token: 't', expiresAt: Date.now() + 3600000, sessionKey: 'k' }, invite: { code: request.inviteCode, path: `/r/${request.inviteCode}` }, snapshot };
  };
  const { joinUntilAnswered } = loadIsolated<{ joinUntilAnswered: Join }>(new URL('../src/core/continuous/join-room.ts', import.meta.url), {
    './api': { continuousApi: { resolve: async () => ({ roomId: 'room-1', credential: false }), snapshot: async () => { throw new Error('no membership read expected'); }, join }, RoomFailure },
    '../credentials': { loadAccess: async () => null, nativeClient: true, saveAccess: async () => undefined },
    '../invites': { inviteIntent: (code: string) => `/r/${code}` },
    '../providers': { queryClient: { setQueryData: () => undefined } },
    './backoff': { ...backoff, abortableSleep: async (ms: number) => { waits.push(ms); log.push(`wait ${ms}`); o.onSleep?.(ms); } },
    './network': { browserOffline: () => o.offline === true },
    './invite-store': { saveInvite: async () => undefined },
    './keys': { continuousKey: (id: string) => ['proposal-room', id] },
    './room-registry': { roomRegistry: { setNickname: async () => undefined, restore: async () => undefined } },
    './state': state,
    './storage': { writeAdmission: async (_: string, value: unknown) => { admission = value; } },
  }, { './resend': new URL('../src/core/continuous/resend.ts', import.meta.url) });
  return { joinUntilAnswered, participants, sent, waits, log, saved: () => admission as Saved | null };
}

const fresh = (): Saved => ({ request: { contractVersion: 3, commandId: 'cmd-1', admissionSecret: 'secret-1', nickname: 'Sam' }, code: 'INVITE1', intent: 'INVITE1', member: false, retryAt: 0 });
const options = (controller = new AbortController(), onTrouble?: (since: number) => void) => ({ intent: 'INVITE1', signal: controller.signal, onTrouble });
const seatsFor = (h: ReturnType<typeof harness>) => [...h.participants].filter((p) => p.startsWith('p:')).length;

test('a join that gets no answer twice while online goes again by itself and opens the room with one seat', async () => {
  const h = harness((_r, _s, n) => (n <= 2 ? 'lost' : 'answer'));
  const troubles: number[] = [];
  const roomId = await h.joinUntilAnswered(fresh(), options(undefined, (since) => troubles.push(since)));
  assert.equal(roomId, 'room-1');
  assert.equal(h.sent.length, 3);
  assert.equal(new Set(h.sent.map((r) => `${r.commandId}:${r.admissionSecret}`)).size, 1, 'every resend is the same command id and secret');
  assert.equal(seatsFor(h), 1, 'one participant although the server seated the friend on the first (unanswered) try');
  assert.equal(troubles.length, 1, 'the page hears once that the join is going again');
  assert.equal(h.saved(), null, 'the saved request is cleared once admitted');
});

test('the seat a lost answer made is not counted again: a resend into a room that is now full still gets in', async () => {
  // 11 people; the friend's first try takes the 12th seat but its answer is lost.
  const h = harness((_r, _s, n) => (n === 1 ? 'lost' : 'answer'), { seated: LIMIT - 1 });
  assert.equal(await h.joinUntilAnswered(fresh(), options()), 'room-1');
  assert.equal(h.participants.size, LIMIT);
  assert.equal(seatsFor(h), 1);
});

test('resends never wait longer than about 5 s, however long the server stays quiet', async () => {
  const h = harness((_r, _s, n) => (n <= 12 ? 'lost' : 'answer'));
  await h.joinUntilAnswered(fresh(), options());
  assert.equal(h.sent.length, 13);
  for (const ms of h.waits) assert.ok(ms <= 5000, `wait ${ms} ms`);
  assert.equal(seatsFor(h), 1);
});

test('final refusals stop at once with the server’s words: full, expired, removed, not found', async () => {
  const refusals = [
    new RoomFailure('limit_reached', 'Room is full', 409),
    new RoomFailure('expired', 'This room has ended', 410),
    new RoomFailure('forbidden', 'You were removed from this room', 403),
    new RoomFailure('not_found', 'Invite unavailable', 404),
  ];
  for (const refusal of refusals) {
    const h = harness(() => { throw refusal; });
    await assert.rejects(h.joinUntilAnswered(fresh(), options()), (e: unknown) => e === refusal);
    assert.equal(h.sent.length, 1, `${refusal.code}: no resend`);
    assert.equal(h.waits.length, 0);
  }
  // Full for real (12 others): no seat is taken and nothing goes again.
  const full = harness(() => 'answer', { seated: LIMIT });
  await assert.rejects(full.joinUntilAnswered(fresh(), options()), /Room is full/);
  assert.equal(full.sent.length, 1);
  assert.equal(seatsFor(full), 0);
});

test('offline in a browser: says so at once (the page resends on the online event)', async () => {
  const h = harness(() => 'lost', { offline: true });
  await assert.rejects(h.joinUntilAnswered(fresh(), options()), (e: unknown) => backoff.unanswered(e));
  assert.equal(h.sent.length, 1);
  assert.ok(h.saved(), 'the request is kept');
});

test('a busy server is waited out for its Retry-After, then the same request goes again', async () => {
  const h = harness((_r, _s, n) => {
    if (n === 1) throw new RoomFailure('busy', 'Busy', 503, undefined, undefined, true, 3);
    return 'answer';
  });
  await h.joinUntilAnswered(fresh(), options());
  assert.equal(h.sent.length, 2);
  assert.ok(h.waits[0] >= 3000, `503 waited ${h.waits[0]} ms`);
});

test('a Retry-After interrupted by the background or a relaunch is still waited out before the join goes again', async () => {
  const controller = new AbortController();
  let interrupted = false;
  const h = harness((_r, _s, n) => {
    if (n === 1) throw new RoomFailure('busy', 'Busy', 503, undefined, undefined, true, 30);
    return 'answer';
  }, { onSleep: () => { if (!interrupted) { interrupted = true; controller.abort(); } } });
  const before = Date.now();
  await assert.rejects(h.joinUntilAnswered(fresh(), options(controller)), (e: unknown) => (e as Error).name === 'AbortError');
  assert.equal(h.sent.length, 1);
  const saved = h.saved();
  assert.ok(saved && saved.retryAt >= before + 30000 && saved.retryAt <= Date.now() + 31000, `the server's deadline is saved before waiting (${(saved?.retryAt ?? 0) - before} ms)`);
  // A relaunch: the page reads the saved request back and sends it.
  h.log.length = 0;
  assert.equal(await h.joinUntilAnswered(structuredClone(saved!), options()), 'room-1');
  assert.equal(h.log[0]?.startsWith('wait '), true, `waits before posting (${h.log.join(', ')})`);
  assert.ok(Number(h.log[0].slice(5)) >= 29000, `waits the rest of the server's wait (${h.log[0]})`);
  assert.deepEqual(h.log.slice(1), ['post']);
  assert.equal(h.sent[1].commandId, 'cmd-1');
  assert.equal(seatsFor(h), 1);
});

test('a server wait over a minute saved earlier stays a manual gate', async () => {
  const h = harness(() => 'answer');
  await assert.rejects(h.joinUntilAnswered({ ...fresh(), retryAt: Date.now() + 120000 }, options()), /Wait before retrying/);
  assert.equal(h.sent.length, 0);
});

// The join page's wiring (Entrance.tsx runJoin) around ResendResume, with the real join underneath.
test('the app leaving the front pauses the join; back in front the same request goes again and the friend gets in', async () => {
  let released: (() => void) | null = null;
  const h = harness((_r, signal, n) => {
    if (n === 1) return 'lost';
    if (n === 2) return new Promise((resolve) => { signal?.addEventListener('abort', () => resolve('lost')); });
    return new Promise((resolve) => { released = () => resolve('answer'); });
  });
  const opened: string[] = [];
  let controller = new AbortController();
  let running: Promise<void> = Promise.resolve();
  const resume: ResendResume<string> = new ResendResume<string>({
    send: () => {
      controller = new AbortController();
      const signal = controller.signal;
      running = (async () => {
        let roomId: string | null = null;
        let error: unknown = null;
        try { roomId = await h.joinUntilAnswered(h.saved() ?? fresh(), { intent: 'INVITE1', signal }); }
        catch (e) { error = signal.aborted ? Object.assign(new Error('interrupted'), { name: 'AbortError' }) : e; }
        if (resume.settled(resendOutcome(error)) && roomId) opened.push(roomId);
      })();
    },
    abort: () => controller.abort(),
  });
  resume.pick('INVITE1');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.sent.length, 2, 'the second try is on its way');
  resume.appState('inactive');
  resume.appState('background');
  await running;
  assert.equal(resume.phase, 'paused');
  assert.equal(h.sent.length, 2, 'nothing goes while away');
  resume.appState('active');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.sent.length, 3, 'back in front: the join goes again by itself');
  released!();
  await running;
  assert.deepEqual(opened, ['room-1'], 'the room opens without a tap');
  assert.equal(new Set(h.sent.map((r) => r.commandId)).size, 1);
  assert.equal(seatsFor(h), 1);
});

// The real join over the real ContinuousApi and a fake server (admission-server.ts), with the join page's own
// failure classification (Entrance.tsx runJoin: sendFailure, then ResendResume.settled).
function realJoin(server: ReturnType<typeof admissionServer>) {
  let admission: unknown = null;
  const { joinUntilAnswered } = loadIsolated<{ joinUntilAnswered: Join }>(new URL('../src/core/continuous/join-room.ts', import.meta.url), {
    './api': { continuousApi: server.api, RoomFailure },
    '../credentials': { loadAccess: async () => null, nativeClient: true, saveAccess: async () => undefined },
    '../invites': { inviteIntent: (code: string) => `/r/${code}` },
    '../providers': { queryClient: { setQueryData: () => undefined } },
    './backoff': { ...backoff, abortableSleep: async () => undefined },
    './network': { browserOffline: () => false },
    './invite-store': { saveInvite: async () => undefined },
    './keys': { continuousKey: (id: string) => ['proposal-room', id] },
    './room-registry': { roomRegistry: { setNickname: async () => undefined, restore: async () => undefined } },
    './state': state,
    './storage': { writeAdmission: async (_: string, value: unknown) => { admission = value; } },
  }, { './resend': new URL('../src/core/continuous/resend.ts', import.meta.url) });
  const sends: number[] = [];
  let controller = new AbortController();
  const resume: ResendResume<string> = new ResendResume<string>({
    send: () => {
      sends.push(sends.length + 1);
      controller = new AbortController();
      const signal = controller.signal;
      void joinUntilAnswered((admission as Saved | null) ?? fresh(), { intent: 'INVITE1', signal }).then(
        () => resume.settled('answered'),
        (e) => resume.settled(resendOutcome(sendFailure(e, signal.aborted, 'Joining was interrupted.'))),
      );
    },
    abort: () => controller.abort(),
  });
  return { resume, sends };
}

test('real join: a full room\'s 409 whose renewed session is still being stored when the app goes to the background is not sent again', async () => {
  let storing: { resolve: () => void } | null = null;
  let last = '';
  const server = admissionServer((s) => { last = s.path; return s.path.endsWith('/join') ? { status: 409, code: 'limit_reached', message: 'Room is full' } : 'ok'; }, {
    // Only the join's answer is slow to store (the invitation's resolve before it isn't).
    store: () => new Promise<void>((resolve) => { if (storing || !last.endsWith('/join')) return resolve(); storing = { resolve }; }),
  });
  const p = realJoin(server);
  p.resume.pick('INVITE1');
  for (let i = 0; i < 10 && !storing; i++) await new Promise((r) => setTimeout(r, 0));
  assert.ok(storing, 'the refusal arrived and its session is being stored');
  p.resume.appState('background');
  (storing as { resolve: () => void } | null)!.resolve();
  await new Promise((r) => setTimeout(r, 10));
  p.resume.appState('active');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(server.posts('/join').length, 1, 'no second join');
  assert.deepEqual(p.sends, [1]);
  assert.equal(p.resume.phase, 'idle');
});

test('real join: 200 headers whose body never comes before the 6 s wait: the same join goes again and the friend gets in', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const settle = async () => { for (let i = 0; i < 30; i++) { t.mock.timers.tick(0); await new Promise((r) => setImmediate(r)); } };
  const server = admissionServer((s, n) => (s.path.endsWith('/join') && n === 1 ? 'stalled' : 'ok'));
  const p = realJoin(server);
  p.resume.pick('INVITE1');
  await settle();
  assert.equal(server.posts('/join').length, 1, 'the first join hangs on its body');
  t.mock.timers.tick(ADMISSION_TIMEOUT_MS);
  await settle();
  assert.equal(server.posts('/join').length, 2, 'sent again by itself');
  assert.equal(new Set(server.posts('/join').map((s) => s.body.commandId)).size, 1, 'the same seat');
  assert.equal(p.resume.phase, 'done');
});

test('real join: 200 headers whose body is lost: the same join goes again and the friend gets in', async () => {
  const server = admissionServer((s, n) => (s.path.endsWith('/join') && n === 1 ? 'body-lost' : 'ok'));
  const p = realJoin(server);
  p.resume.pick('INVITE1');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(server.posts('/join').length, 2, 'sent again by itself');
  assert.equal(p.resume.phase, 'done');
});
