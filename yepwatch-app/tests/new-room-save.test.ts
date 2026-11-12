import test from 'node:test';
import assert from 'node:assert/strict';
import { MutationObserver, QueryClient } from '@tanstack/query-core';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { ResendResume } from '../src/core/continuous/resend-resume';
import { newRoomSave, type NewRoomSaveDeps } from '../src/features/room/new-room-save';
import { RoomFailure } from '../src/core/continuous/api-client';
import * as backoff from '../src/core/continuous/backoff';
import * as network from '../src/core/continuous/network';
import * as retry from '../src/core/continuous/retry';
import * as state from '../src/core/continuous/state';
import { continuousFixture } from './continuous-fixture';
import { admissionServer } from './admission-server';
import { loadIsolated } from './isolated-module';

// The New room page's own save (new-room-save.ts: the mutation options NewRoom.tsx passes to useMutation)
// run by React Query's real MutationObserver, with the page's ResendResume wired as NewRoom wires it. Only
// CreateRoom is fake here (the real one runs further down): each save and each draft refresh waits until the test settles it.
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0)); };

function page() {
  const saves: (Deferred<RoomSnapshot> & { text: string; signal: AbortSignal })[] = [];
  const drafts: Deferred<{ text: string; retryAt: number }>[] = [];
  const opened: string[] = [];
  const troubles: (number | null)[] = [];
  const client = new QueryClient();
  const resume = new ResendResume<string>();
  const attempt = { current: null as AbortController | null };
  const observer = new MutationObserver(client, newRoomSave({
    flow: {
      save: (text, o) => { const d = Object.assign(deferred<RoomSnapshot>(), { text, signal: o.signal }); saves.push(d); return d.promise; },
      draft: () => { const d = deferred<{ text: string; retryAt: number }>(); drafts.push(d); return d.promise; },
      retryAt: 0,
    },
    resume, client, draftKey: ['new-room-draft', 0, 'test'], text: () => 'heist', setText: () => undefined,
    setTroubleSince: (since) => troubles.push(since), attempt,
    identity: async () => ({ nickname: 'Alp', member: false }),
    open: (id) => opened.push(id),
  }));
  // NewRoom: resume.connect({ send: mutation.mutate, abort: () => attempt.current?.abort() }); useMutation's
  // mutate swallows the rejection.
  resume.connect({ send: (text) => { observer.mutate(text).catch(() => undefined); }, abort: () => attempt.current?.abort() });
  return { resume, observer, saves, drafts, opened, troubles, result: () => observer.getCurrentResult() };
}

function withNavigator(onLine: boolean) {
  const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const windowBefore = (globalThis as { window?: unknown }).window;
  const nav = { onLine };
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
  (globalThis as { window?: unknown }).window = { addEventListener() {}, removeEventListener() {} };
  return {
    set online(value: boolean) { nav.onLine = value; },
    restore() {
      if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore);
      else delete (globalThis as { navigator?: unknown }).navigator;
      (globalThis as { window?: unknown }).window = windowBefore;
    },
  };
}

test('back online while the page is still cleaning up an offline failure: the saved create goes again once', async () => {
  const net = withNavigator(false);
  try {
    const p = page();
    p.resume.pick('heist');
    await flush();
    assert.equal(p.saves.length, 1);
    p.saves[0].reject(new RoomFailure('outcome_unknown', 'No answer.'));
    await flush();
    assert.equal(p.drafts.length, 1, 'onError is refreshing the draft');
    // The online event comes while onError still awaits the draft (the phase is still running).
    net.online = true;
    p.resume.online();
    assert.equal(p.saves.length, 1, 'nothing starts over the save still settling');
    p.drafts[0].resolve({ text: 'heist', retryAt: 0 });
    await flush();
    assert.equal(p.saves.length, 2, 'the unanswered create goes again by itself');
    assert.equal(p.result().status, 'pending');
    assert.equal(p.resume.phase, 'running');
    const snapshot = continuousFixture();
    snapshot.shared.roomId = 'room-1';
    p.saves[1].resolve(snapshot);
    await flush();
    assert.deepEqual(p.opened, ['room-1']);
  } finally { net.restore(); }
});

test('still offline when the cleanup settles: it waits for the online event', async () => {
  const net = withNavigator(false);
  try {
    const p = page();
    p.resume.pick('heist');
    await flush();
    p.saves[0].reject(new RoomFailure('outcome_unknown', 'No answer.'));
    await flush();
    p.drafts[0].resolve({ text: 'heist', retryAt: 0 });
    await flush();
    assert.equal(p.resume.phase, 'offline');
    assert.equal(p.saves.length, 1);
    net.online = true;
    p.resume.online();
    await flush();
    assert.equal(p.saves.length, 2);
  } finally { net.restore(); }
});

test('the app goes to the background while a final refusal is being cleaned up: back in front, nothing is sent', async () => {
  const p = page();
  p.resume.pick('heist');
  await flush();
  // The 409 came; clearing the saved admission is still writing when the app leaves the front.
  p.resume.appState('background');
  assert.equal(p.saves[0].signal.aborted, true);
  p.saves[0].reject(new RoomFailure('limit_reached', 'You can create up to 3 rooms at a time.', 409));
  await flush();
  p.drafts[0]?.resolve({ text: 'heist', retryAt: 0 });
  await flush();
  p.resume.appState('active');
  await flush();
  assert.equal(p.saves.length, 1, 'no second create');
  assert.equal(p.resume.phase, 'idle');
  const error = p.result().error;
  assert.ok(error instanceof RoomFailure && error.status === 409, `the refusal stays on the page (${error?.name}: ${error?.message})`);
});

test('the app goes to the background during an unanswered save: back in front, the same create goes again', async () => {
  const p = page();
  p.resume.pick('heist');
  await flush();
  p.resume.appState('background');
  p.saves[0].reject(new RoomFailure('outcome_unknown', 'No answer.'));
  await flush();
  p.drafts[0]?.resolve({ text: 'heist', retryAt: 0 });
  await flush();
  assert.equal(p.result().error?.name, 'AbortError', 'interrupted, not failed');
  p.resume.appState('active');
  await flush();
  assert.equal(p.saves.length, 2);
  assert.equal(p.saves[1].text, 'heist');
});

// The same page code with the real CreateRoom (create-room.ts, on resend.ts) over the real ContinuousApi and
// a fake server (admission-server.ts): only device storage, the clock's waits and the network are fake.
type RealFlow = new () => NewRoomSaveDeps['flow'];
function realPage(server: ReturnType<typeof admissionServer>) {
  let admission: unknown = null;
  const pending = new Map<string, unknown>();
  const waits: number[] = [];
  let uuid = 0;
  const { CreateRoom } = loadIsolated<{ CreateRoom: RealFlow }>(new URL('../src/core/continuous/create-room.ts', import.meta.url), {
    'expo-crypto': { getRandomBytesAsync: async () => new Uint8Array(32).fill(7), randomUUID: () => `uuid-${++uuid}` },
    './api': { continuousApi: server.api, RoomFailure },
    '../credentials': { saveAccess: async () => undefined },
    '../lobby': { deviceCountryHint: () => 'DE' },
    '../providers': { queryClient: { setQueryData: () => undefined } },
    './account-flow': { authEpoch: { current: () => 1, isCurrent: () => true } },
    './backoff': { ...backoff, abortableSleep: async (ms: number) => { waits.push(ms); } },
    './network': network,
    './invite-store': { saveInvite: async () => undefined },
    './room-registry': { roomRegistry: { remember: async () => undefined, setNickname: async () => undefined } },
    './retry': retry,
    './keys': { continuousKey: (id: string) => ['proposal-room', id] },
    './state': state,
    './storage': {
      readAdmission: async () => admission, writeAdmission: async (_: string, value: unknown) => { admission = value; },
      readCommandRecovery: async (id: string) => ({ envelope: pending.get(id) ?? null, retryAt: 0 }),
      writePending: async (id: string, envelope: unknown) => { pending.set(id, envelope); },
    },
  }, { './resend': new URL('../src/core/continuous/resend.ts', import.meta.url) });
  const opened: string[] = [];
  const client = new QueryClient();
  const resume = new ResendResume<string>();
  const attempt = { current: null as AbortController | null };
  let text = 'heist';
  const observer = new MutationObserver(client, newRoomSave({
    flow: new CreateRoom(), resume, client, draftKey: ['new-room-draft', 0, 'real'], text: () => text, setText: (t) => { text = t; },
    setTroubleSince: () => undefined, attempt, identity: async () => ({ nickname: 'Alp', member: false }), open: (id) => opened.push(id),
  }));
  resume.connect({ send: (t) => { observer.mutate(t).catch(() => undefined); }, abort: () => attempt.current?.abort() });
  return { resume, opened, waits, result: () => observer.getCurrentResult(), saved: () => admission };
}

test('real create: a 409 whose renewed session is still being stored when the app goes to the background is not sent again', async () => {
  let storing: Deferred<void> | null = null;
  const server = admissionServer(() => ({ status: 409, code: 'limit_reached', message: 'You can create up to 3 rooms at a time.' }), {
    store: () => { storing = deferred<void>(); return storing.promise; },
  });
  const p = realPage(server);
  p.resume.pick('heist');
  await flush();
  assert.ok(storing, 'the refusal arrived and its session is being stored');
  p.resume.appState('background');
  (storing as Deferred<void> | null)!.resolve();
  await flush();
  p.resume.appState('active');
  await flush();
  assert.equal(server.posts('/rooms').length, 1, 'no second create');
  assert.equal(p.resume.phase, 'idle');
  const error = p.result().error;
  assert.ok(error instanceof RoomFailure && error.status === 409, `the refusal stays on the page (${error?.name}: ${error?.message})`);
  assert.equal(p.saved(), null, 'the refused request is dropped');
});

test('real create: an answer still being processed when the app goes to the background goes again once back (no refusal to keep)', async () => {
  let storing: Deferred<void> | null = null;
  const server = admissionServer((_s, n) => (n === 1 ? { status: 503, code: 'busy', retryable: true } : 'ok'), {
    store: () => { if (storing) return Promise.resolve(); storing = deferred<void>(); return storing.promise; },
  });
  const p = realPage(server);
  p.resume.pick('heist');
  await flush();
  p.resume.appState('background');
  (storing as Deferred<void> | null)!.resolve();
  await flush();
  assert.equal(p.result().error?.name, 'AbortError', 'a busy answer cut off by the background is a pause');
  p.resume.appState('active');
  await flush();
  assert.equal(server.posts('/rooms').length, 2);
  assert.deepEqual(p.opened, ['room-1']);
  assert.equal(server.rooms.size, 1);
});

test('real create: a legacy server\'s configure that times out goes again by itself, as the same command, and the room opens', async () => {
  const server = admissionServer((s, n) => {
    if (s.path.endsWith('/rooms') && s.body.setup) return { status: 400, code: 'invalid_request' };
    if (s.path.endsWith('/commands') && n === 1) return 'lost';
    if (s.path.endsWith('/commands') && n === 2) return { status: 503, code: 'busy', retryable: true, retryAfter: 3 };
    return 'ok';
  });
  const p = realPage(server);
  p.resume.pick('heist');
  await flush();
  assert.deepEqual(p.opened, ['room-1'], `opened by itself (${p.result().error?.message ?? 'no error'})`);
  const commands = server.posts('/commands');
  assert.deepEqual(commands.map((c) => c.body.command?.type), ['configure', 'configure', 'configure', 'add_idea']);
  assert.equal(new Set(commands.slice(0, 3).map((c) => c.body.commandId)).size, 1, 'every resend is the same envelope');
  assert.equal(server.rooms.get('room-1')!.shared.screens[0].country, 'DE');
  assert.equal(server.rooms.get('room-1')!.shared.ideas[0].text, 'heist');
});

test('real create: a recovered create whose mood changed retries its idea edit after a 503 and opens the room', async () => {
  const net = withNavigator(false);
  try {
    const server = admissionServer((s, n) => {
      if (s.path.endsWith('/rooms') && n === 1) return 'lost';
      if (s.path.endsWith('/commands') && n === 1) return { status: 503, code: 'busy', retryable: true };
      return 'ok';
    });
    const p = realPage(server);
    p.resume.pick('heist');
    await flush();
    assert.equal(p.resume.phase, 'offline', 'the first create got no answer while offline (the server made the room)');
    net.online = true;
    p.resume.pick('noir');
    await flush();
    assert.deepEqual(p.opened, ['room-1'], `opened by itself (${p.result().error?.message ?? 'no error'})`);
    const commands = server.posts('/commands');
    assert.deepEqual(commands.map((c) => c.body.command?.type), ['edit_idea', 'edit_idea']);
    assert.equal(commands[0].body.commandId, commands[1].body.commandId);
    assert.equal(server.rooms.size, 1);
    assert.equal(server.rooms.get('room-1')!.shared.ideas[0].text, 'noir');
  } finally { net.restore(); }
});

test('real create: a setup command cut off by the background stops; back in front it goes again as the same command', async () => {
  let p!: ReturnType<typeof realPage>;
  const server = admissionServer((s, n) => {
    if (s.path.endsWith('/rooms') && s.body.setup) return { status: 400, code: 'invalid_request' };
    if (s.path.endsWith('/commands') && n === 1) { p.resume.appState('background'); return 'lost'; }
    return 'ok';
  });
  p = realPage(server);
  p.resume.pick('heist');
  await flush();
  assert.equal(server.posts('/commands').length, 1, 'nothing goes while away');
  assert.equal(p.result().error?.name, 'AbortError');
  p.resume.appState('active');
  await flush();
  assert.deepEqual(p.opened, ['room-1']);
  const commands = server.posts('/commands');
  assert.equal(commands[0].body.commandId, commands[1].body.commandId, 'the pending envelope, not a new configure');
  assert.equal(server.posts('/rooms').filter((s) => !s.body.setup).length, 1, 'the room made stays the one room');
  assert.equal(server.rooms.size, 1);
});

test('real create: a definitive refusal of a setup command is not retried', async () => {
  const server = admissionServer((s) => {
    if (s.path.endsWith('/rooms') && s.body.setup) return { status: 400, code: 'invalid_request' };
    if (s.path.endsWith('/commands')) return { status: 403, code: 'forbidden', message: 'Not allowed.' };
    return 'ok';
  });
  const p = realPage(server);
  p.resume.pick('heist');
  await flush();
  assert.equal(server.posts('/commands').length, 1);
  assert.equal(p.resume.phase, 'idle');
  assert.deepEqual(p.opened, []);
});
