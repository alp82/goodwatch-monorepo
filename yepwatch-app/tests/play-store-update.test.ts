import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayStoreUpdateState } from '../src/core/play-store-update-state';
import { loadIsolated } from './isolated-module';

test('concurrent headers share one Play check and see only a confirmed available update', async () => {
  let finish!: (available: boolean) => void;
  let calls = 0;
  let notifications = 0;
  const state = createPlayStoreUpdateState(() => { calls++; return new Promise<boolean>(resolve => { finish = resolve; }); });
  const off = state.subscribe(() => { notifications++; });
  assert.equal(state.getSnapshot(), false);
  const first = state.refresh(); const second = state.refresh();
  await Promise.resolve();
  assert.equal(calls, 1); assert.equal(state.getSnapshot(), false);
  finish(true); await Promise.all([first, second]);
  assert.equal(state.getSnapshot(), true); assert.equal(notifications, 1);
  await state.refresh(); assert.equal(calls, 1);
  off();
});

test('resuming checks again after the cache expires and hides the link when Play reports no update', async () => {
  let now = 0; let calls = 0;
  const state = createPlayStoreUpdateState(async () => ++calls === 1, () => now);
  await state.refresh(); assert.equal(state.getSnapshot(), true);
  now = 29 * 60 * 1000; await state.refresh(); assert.equal(calls, 1);
  now = 30 * 60 * 1000; await state.refresh();
  assert.equal(calls, 2); assert.equal(state.getSnapshot(), false);
});

test('offline, unowned and stalled Play checks show no link and allow a later retry', async () => {
  let now = 0; let calls = 0;
  const state = createPlayStoreUpdateState(async () => {
    calls++;
    if (calls === 1) throw Error('App not owned or store offline');
    if (calls === 2) return new Promise<boolean>(() => {});
    return true;
  }, () => now, 5);
  await state.refresh(); assert.equal(state.getSnapshot(), false);
  await state.refresh(); assert.equal(calls, 1);
  now += 5 * 60 * 1000; await state.refresh(); assert.equal(state.getSnapshot(), false);
  now += 5 * 60 * 1000; await state.refresh(); assert.equal(state.getSnapshot(), true);
});

type UpdateModule = { usePlayStoreUpdate(): boolean; openPlayStoreUpdate(): Promise<void> };
function hookHarness(platform: string, modulePresent: boolean, open: (url: string) => Promise<void>) {
  let required = 0; let checked = 0; let watched = 0;
  const hook = loadIsolated<UpdateModule>(new URL('../src/core/usePlayStoreUpdate.ts', import.meta.url), {
    react: { useEffect: (effect: () => void) => effect(), useSyncExternalStore: () => false },
    'react-native': { Platform: { OS: platform }, Linking: { openURL: open }, AppState: { addEventListener: () => { watched++; return { remove() {} }; } } },
    expo: { requireOptionalNativeModule: () => { required++; return modulePresent ? { isUpdateAvailable: async () => { checked++; return true; } } : null; } },
    './play-store-update-state': { createPlayStoreUpdateState },
  });
  return { hook, counts: () => ({ required, checked, watched }) };
}

test('old Android runtimes, web and iOS do not check Play or show an update link', () => {
  for (const platform of ['android', 'ios', 'web']) {
    const h = hookHarness(platform, false, async () => {});
    assert.equal(h.hook.usePlayStoreUpdate(), false);
    assert.deepEqual(h.counts(), { required: platform === 'android' ? 1 : 0, checked: 0, watched: 0 });
  }
});

test('the link opens the Play app and falls back to its HTTPS listing; neither failure disrupts the room', async () => {
  const opened: string[] = [];
  const h = hookHarness('android', false, async (url) => { opened.push(url); throw Error('No handler'); });
  await assert.doesNotReject(h.hook.openPlayStoreUpdate());
  assert.deepEqual(opened, ['market://details?id=com.yepwatch.app', 'https://play.google.com/store/apps/details?id=com.yepwatch.app']);
  const success: string[] = [];
  await hookHarness('android', false, async (url) => { success.push(url); }).hook.openPlayStoreUpdate();
  assert.deepEqual(success, ['market://details?id=com.yepwatch.app']);
});
