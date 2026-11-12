import test from 'node:test';
import assert from 'node:assert/strict';
import { ResendResume, resendOutcome } from '../src/core/continuous/resend-resume';
import { RoomFailure } from '../src/core/continuous/api-client';

// The New room page's wiring (NewRoom.tsx) around ResendResume, with React Query's mutation replaced by a
// fake that keeps its timing: a save runs until answered or aborted, an abort settles only when the test
// lets it (the real save first finishes its storage write), and settlement reaches the page after onError.
function page() {
  const sends: string[] = [];
  const opened: boolean[] = [];
  let current: { controller: AbortController; finish: (error: unknown) => Promise<void> } | null = null;
  const resume: ResendResume<string> = new ResendResume<string>({
    send: (text) => {
      sends.push(text);
      const controller = new AbortController();
      const run = { controller, finish: async (error: unknown) => {
        if (current === run) current = null;
        await Promise.resolve(); // async onError (draft refresh) before onSettled
        opened.push(resume.settled(resendOutcome(error)));
      } };
      current = run;
    },
    abort: () => current?.controller.abort(),
  });
  const cancelled = () => Object.assign(new Error('Room setup was interrupted.'), { name: 'AbortError' });
  return {
    resume, sends, opened,
    get aborted() { return current?.controller.signal.aborted ?? false; },
    /** The aborted save's cancellation settles. */
    settleCancel: () => current!.finish(cancelled()),
    answer: () => current!.finish(null),
    fail: (error: unknown) => current!.finish(error),
  };
}

test('iOS inactive then background with the cancellation settling between them: back in front, the save goes again', async () => {
  const p = page();
  p.resume.pick('heist');
  p.resume.appState('inactive');
  assert.equal(p.aborted, true, 'leaving the front cancels the save going');
  await p.settleCancel();
  p.resume.appState('background');
  assert.equal(p.resume.phase, 'paused', 'the second event keeps the intent to resume');
  p.resume.appState('active');
  assert.deepEqual(p.sends, ['heist', 'heist']);
  assert.equal(p.resume.phase, 'running');
});

test('back in front before the cancellation settled: the save goes again once it has (native and web)', async () => {
  for (const away of [['inactive', 'background'], ['background']]) {
    const p = page();
    p.resume.pick('heist');
    for (const state of away) p.resume.appState(state);
    p.resume.appState('active');
    assert.equal(p.sends.length, 1, 'nothing starts over a save still cancelling');
    await p.settleCancel();
    assert.deepEqual(p.sends, ['heist', 'heist'], `${away.join(' → ')}: the resume was kept until it could start`);
    await p.answer();
    assert.deepEqual(p.opened, [false, true], 'the answer opens the room');
  }
});

test('a cancellation that settles while still away waits for the app to come back', async () => {
  const p = page();
  p.resume.pick('heist');
  p.resume.appState('background');
  await p.settleCancel();
  assert.equal(p.sends.length, 1);
  p.resume.appState('inactive');
  p.resume.appState('active');
  assert.equal(p.sends.length, 2);
});

test('leaving the page during a pause stops for good; picking again after coming back to it starts a save', async () => {
  const p = page();
  p.resume.pick('heist');
  p.resume.appState('background');
  p.resume.leave();
  await p.settleCancel();
  p.resume.appState('active');
  assert.equal(p.sends.length, 1, 'nothing goes after the page left');
  assert.deepEqual(p.opened, [false]);
  p.resume.focus();
  p.resume.pick('heist');
  assert.equal(p.sends.length, 2);
});

test('an answer that lands while away still opens the room; one that lands after leaving does not', async () => {
  const away = page();
  away.resume.pick('heist');
  away.resume.appState('background');
  await away.answer();
  assert.deepEqual(away.opened, [true]);
  away.resume.appState('active');
  assert.equal(away.sends.length, 1, 'answered: nothing goes again');
  const left = page();
  left.resume.pick('heist');
  left.resume.leave();
  await left.answer();
  assert.deepEqual(left.opened, [false]);
});

test('a final refusal stays with the person: coming back to the front sends nothing', async () => {
  const p = page();
  p.resume.pick('heist');
  await p.fail(new RoomFailure('limit_reached', 'You can create up to 3 rooms at a time.', 409));
  p.resume.appState('background');
  p.resume.appState('active');
  assert.equal(p.sends.length, 1);
  assert.equal(p.resume.phase, 'idle');
  p.resume.pick('heist');
  assert.equal(p.sends.length, 2, 'Try again sends');
});

test('offline in a browser: back online sends again; online while away waits for the front', async () => {
  const navigatorBefore = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const windowBefore = (globalThis as { window?: unknown }).window;
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  (globalThis as { window?: unknown }).window = { addEventListener() {}, removeEventListener() {} };
  try {
    const p = page();
    p.resume.pick('heist');
    await p.fail(new RoomFailure('outcome_unknown', 'No answer.'));
    assert.equal(p.resume.phase, 'offline');
    p.resume.online();
    assert.equal(p.sends.length, 2);
    await p.fail(new RoomFailure('outcome_unknown', 'No answer.'));
    p.resume.appState('background');
    p.resume.online();
    assert.equal(p.sends.length, 2, 'not while away');
    p.resume.appState('active');
    assert.equal(p.sends.length, 3);
  } finally {
    if (navigatorBefore) Object.defineProperty(globalThis, 'navigator', navigatorBefore);
    else delete (globalThis as { navigator?: unknown }).navigator;
    (globalThis as { window?: unknown }).window = windowBefore;
  }
});
