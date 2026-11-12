import test from 'node:test';
import assert from 'node:assert/strict';
import { MutationObserver, QueryClient } from '@tanstack/query-core';
import type { RoomSnapshot } from '@goodwatch/yepwatch-contracts/proposal';
import { ResendResume } from '../src/core/continuous/resend-resume';
import { newRoomSave } from '../src/features/room/new-room-save';
import { RoomFailure } from '../src/core/continuous/api-client';
import { continuousFixture } from './continuous-fixture';

// The New room page's own save (new-room-save.ts: the mutation options NewRoom.tsx passes to useMutation)
// run by React Query's real MutationObserver, with the page's ResendResume wired as NewRoom wires it. Only
// CreateRoom is fake: each save and each draft refresh waits until the test settles it.
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
