import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as backoff from '../src/core/continuous/backoff';
import * as retry from '../src/core/continuous/retry';
import * as state from '../src/core/continuous/state';
import { RoomFailure } from '../src/core/continuous/api-client';
import { continuousFixture } from './continuous-fixture';

// The real CreateRoom (create-room.ts) with its device and network edges replaced: a fake server that
// creates one room per command id + secret (the real one's idempotency), in-memory storage, instant waits.
const noAnswer = () => new RoomFailure('outcome_unknown', 'Your action has not been confirmed.');
type Request = { commandId: string; admissionSecret: string };
type Attempt = (request: Request, signal: AbortSignal | undefined, n: number) => Promise<'answer' | 'lost'> | 'answer' | 'lost';

function harness(script: Attempt, o: { offline?: boolean; onSleep?: (ms: number) => void } = {}) {
  const rooms = new Map<string, string>();
  const sent: Request[] = [];
  const waits: number[] = [];
  const log: string[] = [];
  let admission: unknown = null;
  const create = async (request: Request, signal?: AbortSignal) => {
    sent.push({ commandId: request.commandId, admissionSecret: request.admissionSecret });
    log.push('post');
    const outcome = await script(request, signal, sent.length);
    // The server makes the room whether or not its answer reaches the phone.
    const key = `${request.commandId}:${request.admissionSecret}`;
    if (!rooms.has(key)) rooms.set(key, `room-${rooms.size + 1}`);
    if (outcome === 'lost') throw noAnswer();
    const roomId = rooms.get(key)!;
    const snapshot = continuousFixture();
    snapshot.shared.roomId = roomId;
    return { credential: { roomId, participantId: 'host', token: 't', expiresAt: Date.now() + 3600000, sessionKey: 'k' }, invite: { code: 'c', url: 'u' }, snapshot };
  };
  const source = readFileSync(new URL('../src/core/continuous/create-room.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: { CreateRoom?: new () => { save(text: string, options: { nickname: string; member: boolean; signal: AbortSignal; onTrouble?: (since: number) => void }): Promise<{ shared: { roomId: string } }> } } = {};
  let uuid = 0;
  runInNewContext(code, { exports, Date, Math, Promise, Error, Array, console, setTimeout, clearTimeout, require: (name: string) => {
    switch (name) {
      case 'expo-crypto': return { getRandomBytesAsync: async () => new Uint8Array(32).fill(7), randomUUID: () => `uuid-${++uuid}` };
      case './api': return { continuousApi: { create, command: async () => { throw new Error('no commands expected'); } }, RoomFailure };
      case '../credentials': return { saveAccess: async () => undefined };
      case '../lobby': return { deviceCountryHint: () => 'DE' };
      case '../providers': return { queryClient: { setQueryData: () => undefined } };
      case './account-flow': return { authEpoch: { current: () => 1, isCurrent: () => true } };
      case './backoff': return { ...backoff, abortableSleep: async (ms: number) => { waits.push(ms); log.push(`wait ${ms}`); o.onSleep?.(ms); } };
      case './network': return { browserOffline: () => o.offline === true };
      case './invite-store': return { saveInvite: async () => undefined };
      case './room-registry': return { roomRegistry: { remember: async () => undefined, setNickname: async () => undefined } };
      case './retry': return retry;
      case './keys': return { continuousKey: (id: string) => ['proposal-room', id] };
      case './state': return state;
      case './storage': return {
        readAdmission: async () => admission, writeAdmission: async (_: string, value: unknown) => { admission = value; },
        readCommandRecovery: async () => ({ envelope: null, retryAt: 0 }), writePending: async () => undefined,
      };
      default: throw new Error(`Unexpected dependency ${name}`);
    }
  } });
  // A relaunch: a new CreateRoom over the same storage and server.
  return { flow: new exports.CreateRoom!(), relaunch: () => new exports.CreateRoom!(), rooms, sent, waits, log, saved: () => admission as { retryAt: number } | null };
}
const options = (controller = new AbortController(), onTrouble?: (since: number) => void) => ({ nickname: '', member: false, signal: controller.signal, onTrouble });

test('a create that gets no answer twice while online goes again by itself and opens the one room', async () => {
  const h = harness((_r, _s, n) => (n <= 2 ? 'lost' : 'answer'));
  const troubles: number[] = [];
  const snapshot = await h.flow.save('', options(undefined, (since) => troubles.push(since)));
  assert.equal(snapshot.shared.roomId, 'room-1');
  assert.equal(h.sent.length, 3);
  assert.equal(new Set(h.sent.map((r) => `${r.commandId}:${r.admissionSecret}`)).size, 1, 'every resend is the same command id and secret');
  assert.equal(h.rooms.size, 1, 'no second room although the server made it on the first (unanswered) try');
  assert.equal(troubles.length, 1, 'the page hears once that the create is going again');
  assert.equal(h.saved(), null, 'the saved request is cleared once the room is confirmed');
});

test('resends never wait longer than about 5 s, however long the server stays quiet', async () => {
  const h = harness((_r, _s, n) => (n <= 12 ? 'lost' : 'answer'));
  await h.flow.save('', options());
  assert.equal(h.sent.length, 13);
  assert.equal(h.waits.length, 12);
  for (const ms of h.waits) assert.ok(ms <= 5000, `wait ${ms} ms`);
  assert.ok(h.waits.slice(3).every((ms) => ms >= 3500), 'steps climb to the 5 s cap (minus jitter)');
  assert.equal(h.rooms.size, 1);
});

test('leaving the page stops the resends; the saved request stays and a later save makes no second room', async () => {
  const controller = new AbortController();
  const h = harness((_r, _s, n) => (n <= 2 ? 'lost' : 'answer'), { onSleep: () => controller.abort() });
  await assert.rejects(h.flow.save('', options(controller)), /interrupted/);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(h.sent.length, 1, 'nothing goes after the page left');
  assert.ok(h.saved(), 'the request is kept');
  const snapshot = await h.flow.save('', options());
  assert.equal(snapshot.shared.roomId, 'room-1');
  assert.equal(h.rooms.size, 1);
  assert.equal(new Set(h.sent.map((r) => r.commandId)).size, 1);
});

test('an in-flight create aborted by leaving (or the app going to the background) does not resend', async () => {
  const controller = new AbortController();
  const h = harness((_r, signal) => new Promise((_, reject) => signal?.addEventListener('abort', () => reject(noAnswer()))));
  const saving = h.flow.save('', options(controller));
  await new Promise((r) => setTimeout(r, 5));
  controller.abort();
  await assert.rejects(saving, /interrupted/);
  assert.equal(h.sent.length, 1);
  assert.equal(h.waits.length, 0);
});

test('a final refusal stops at once and drops the request', async () => {
  const h = harness(() => { throw new RoomFailure('limit_reached', 'You can create up to 3 rooms at a time.', 409); });
  await assert.rejects(h.flow.save('', options()), /up to 3 rooms/);
  assert.equal(h.sent.length, 1);
  assert.equal(h.saved(), null);
});

test('a rate limit or busy server is waited out for its Retry-After, then the same request goes again', async () => {
  const h = harness((_r, _s, n) => {
    if (n === 1) throw new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 8);
    if (n === 2) throw new RoomFailure('busy', 'Busy', 503, undefined, undefined, true, 3);
    return 'answer';
  });
  await h.flow.save('', options());
  assert.equal(h.sent.length, 3);
  assert.ok(h.waits[0] >= 8000, `429 waited ${h.waits[0]} ms`);
  assert.ok(h.waits[1] >= 3000, `503 waited ${h.waits[1]} ms`);
});

test('a Retry-After past a minute is left to the person (the request stays, with its gate)', async () => {
  const h = harness(() => { throw new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 120); });
  await assert.rejects(h.flow.save('', options()), /Wait/);
  assert.equal(h.sent.length, 1);
  assert.ok(h.saved(), 'kept for later');
});

test('offline in a browser: says so at once (the page resends on the online event)', async () => {
  const h = harness(() => 'lost', { offline: true });
  await assert.rejects(h.flow.save('', options()), (e: unknown) => backoff.unanswered(e));
  assert.equal(h.sent.length, 1);
  assert.ok(h.saved());
});

test('a Retry-After interrupted by the background or a relaunch is still waited out before the create goes again', async () => {
  for (const again of ['resume', 'relaunch'] as const) {
    const controller = new AbortController();
    let interrupted = false;
    const h = harness((_r, _s, n) => {
      if (n === 1) throw new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 60);
      return 'answer';
    }, { onSleep: () => { if (!interrupted) { interrupted = true; controller.abort(); } } });
    const before = Date.now();
    await assert.rejects(h.flow.save('', options(controller)), /interrupted/);
    assert.equal(h.sent.length, 1);
    const deadline = h.saved()?.retryAt ?? 0;
    assert.ok(deadline >= before + 60000 && deadline <= Date.now() + 61000, `${again}: the server's deadline is saved before waiting (${deadline - before} ms)`);
    const flow = again === 'resume' ? h.flow : h.relaunch();
    h.log.length = 0;
    const snapshot = await flow.save('', options());
    assert.equal(snapshot.shared.roomId, 'room-1');
    assert.equal(h.log[0]?.startsWith('wait '), true, `${again}: waits before posting (${h.log.join(', ')})`);
    assert.ok(Number(h.log[0].slice(5)) >= 59000, `${again}: waits the rest of the minute (${h.log[0]})`);
    assert.deepEqual(h.log.slice(1), ['post']);
    assert.equal(h.rooms.size, 1);
  }
});

test('a server wait over a minute saved earlier stays a manual gate after a relaunch', async () => {
  const h = harness(() => { throw new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 120); });
  await assert.rejects(h.flow.save('', options()), /Wait/);
  await assert.rejects(h.relaunch().save('', options()), /Wait before retrying/);
  assert.equal(h.sent.length, 1);
});

test('resuming a saved Retry-After tells the page the trouble began, once, as the wait starts', async () => {
  for (const after of ['answer', 'lost'] as const) {
    const controller = new AbortController();
    let interrupted = false;
    const h = harness((_r, _s, n) => {
      if (n === 1) throw new RoomFailure('limit_reached', 'Wait', 429, undefined, undefined, true, 30);
      return after === 'lost' && n === 2 ? 'lost' : 'answer';
    }, { onSleep: () => { if (!interrupted) { interrupted = true; controller.abort(); } } });
    await assert.rejects(h.flow.save('', options(controller)), /interrupted/);
    const troubles: { since: number; waitsBefore: number }[] = [];
    const before = Date.now();
    h.log.length = 0;
    await h.flow.save('', options(undefined, (since) => troubles.push({ since, waitsBefore: h.log.filter((l) => l.startsWith('wait')).length })));
    assert.equal(troubles.length, 1, `${after}: heard once (a failed resend after the wait is the same outage)`);
    assert.ok(troubles[0].since >= before && troubles[0].since <= Date.now(), `${after}: the resumed wait begins the trouble now`);
    assert.equal(troubles[0].waitsBefore, 0, `${after}: heard as the saved wait starts, not after it`);
  }
});
