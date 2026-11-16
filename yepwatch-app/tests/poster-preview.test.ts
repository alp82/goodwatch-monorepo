import test from 'node:test';
import assert from 'node:assert/strict';
import { paths, type RoomPosterPreview } from '@goodwatch/yepwatch-contracts/proposal';
import { ContinuousApi } from '../src/core/continuous/api-client';
import { roomPosterPreviewSchema } from '../src/core/continuous/wire';
import { continuousFixture } from './continuous-fixture';

test('poster preview GET contract and parser preserve deck presentation fields', async () => {
  const card = { ...continuousFixture().shared.candidates[0], posterUrl: 'https://posters.invalid/p.jpg',
    backdropUrl: 'https://posters.invalid/b.jpg', genres: ['Comedy'], goodwatchScore: 82,
    reason: { code: 'fits_idea' as const, text: 'Fits your idea' },
    viewingDuration: { minutes: 90, scope: 'movie' as const } };
  const payload: RoomPosterPreview = { candidates: [card] };
  const access = { roomId: 'r', participantId: 'p', token: 'secret', expiresAt: 999 };
  const api = new ContinuousApi(async (input, init) => {
    assert.ok(String(input).endsWith(paths.roomPreview('r')));
    assert.equal(init?.method, 'GET'); assert.equal(init?.body, undefined);
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer secret');
    return Response.json({ ...payload, unknownEnvelopeField: true });
  }, true);
  assert.deepEqual(await api.roomPreview(access), payload);
  assert.deepEqual(roomPosterPreviewSchema.parse({ candidates: [] }), { candidates: [] });
  assert.equal(roomPosterPreviewSchema.safeParse({ candidates: [{ ...card, posterUrl: 42 }] }).success, false);
});

import { build } from 'esbuild';
import { Window } from '../../goodwatch-webapp/node_modules/happy-dom/lib/index.js';
import { onYepwatchAnswer, unansweredFor } from '../src/core/continuous/network';

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('preview requests have a short timeout and never affect room connection signals', async () => {
  const access = { roomId: 'r', participantId: 'p', token: 'secret', expiresAt: 999 };
  let answers = 0;
  const off = onYepwatchAnswer(() => { answers++; });
  const api = new ContinuousApi(async (_input, init) => {
    assert.equal(unansweredFor(Date.now() + 60_000), 0);
    return await new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(Error('aborted'))));
  }, true);
  const started = Date.now();
  try {
    await assert.rejects(api.roomPreview(access));
    assert.ok(Date.now() - started < 4500);
    assert.equal(answers, 0);
    assert.equal(unansweredFor(), 0);
    const failed = new ContinuousApi(async () => Response.json({ error: { code: 'catalog_unavailable', retryable: true } }, { status: 503 }), true);
    await assert.rejects(failed.roomPreview(access));
    assert.equal(answers, 0);
  } finally { off(); }
});

test('hook debounces, retains cards across inputs/errors, stops at Start, and bounds empty polling', async () => {
  const bundle = await build({
    stdin: { contents: `
      import React, {useState} from 'react';
      import {createRoot} from 'react-dom/client';
      import {QueryClient, QueryClientProvider, focusManager} from '@tanstack/react-query';
      import {usePosterPreview, posterPreviewInputs} from './src/features/room/poster-preview';
      const client = new QueryClient();
      const access = {roomId:'r', participantId:'p', token:'t', expiresAt:999};
      window.inputs = posterPreviewInputs;
      function Probe() {
        const [shared, setShared] = useState(window.initial);
        window.update = setShared;
        const cards = usePosterPreview(access, shared);
        return <div id="cards">{cards.map(c => c.id).join(',')}</div>;
      }
      const root = createRoot(document.getElementById('root'));
      root.render(<QueryClientProvider client={client}><Probe/></QueryClientProvider>);
      window.setFocus = value => focusManager.setFocused(value);
      window.dispose = () => {root.unmount(); client.clear();};
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'preview-api', setup(builder) {
      builder.onResolve({ filter: /core\/continuous\/api$/ }, () => ({ path: 'api', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export const continuousApi = {roomPreview: async () => {window.calls++; if(window.fail) throw Error('busy'); return window.answer;}};` }));
    } }],
  });
  const dom = new Window({ console, settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
  const w = dom as unknown as Window & Record<string, any>;
  const initial = continuousFixture().shared;
  initial.phase = 'setup'; initial.candidates = [];
  initial.screens[0].country = 'DE'; initial.screens[0].confirmed = true; initial.screens[0].serviceIds = [1];
  const card = continuousFixture().shared.candidates[0];
  w.initial = initial; w.calls = 0; w.answer = { candidates: [card] }; w.fail = true;
  // Keep the real debounce, but accelerate the poll clock for this isolated hook test.
  const interval = dom.setInterval.bind(dom);
  dom.setInterval = ((fn: any, ms: number, ...args: any[]) => interval(fn, ms === 10_000 ? 50 : ms, ...args)) as typeof dom.setInterval;
  dom.document.body.innerHTML = '<div id="root"></div>';
  const until = async (check: () => boolean) => {
    for (let i = 0; i < 150; i++) { if (check()) return; await pause(10); }
    assert.ok(check(), 'hook state settled');
  };
  const shown = () => dom.document.getElementById('cards')?.textContent;
  try {
    dom.eval(bundle.outputFiles[0].text);
    await until(() => Boolean(w.update));
    await pause(150); assert.equal(w.calls, 0);
    await until(() => w.calls === 1);
    assert.equal(shown(), '', 'an initial error keeps card backs');
    w.fail = false;
    const retry = structuredClone(initial); retry.constraints.maxMinutes = 120;
    w.update(retry);
    await until(() => shown() === card.id);
    await pause(200); assert.equal(w.calls, 2, 'nonempty response stops polling');
    const changed = structuredClone(retry); changed.participants[0].serviceIds = [337];
    assert.notEqual(w.inputs(initial), w.inputs(changed));
    w.fail = true; w.update(changed);
    await pause(150); assert.equal(shown(), card.id, 'cards survive debounce');
    await until(() => w.calls === 3);
    assert.equal(shown(), card.id, 'errors retain successful cards');
    const started = { ...changed, phase: 'choosing' };
    w.update(started); await until(() => shown() === '');
    const stopped = w.calls; await pause(200); assert.equal(w.calls, stopped);
    w.fail = false; w.answer = { candidates: [] };
    const empty = structuredClone(initial); empty.constraints.maxMinutes = 123;
    w.update(empty); await until(() => w.calls >= stopped + 3);
    const bounded = w.calls; await pause(250); assert.equal(w.calls, bounded, 'three identical empty answers stop');
    w.setFocus(false);
    const background = structuredClone(empty); background.constraints.maxMinutes = 124;
    w.update(background); await pause(650);
    const backgroundCalls = w.calls; await pause(200); assert.equal(w.calls, backgroundCalls, 'background pauses polls');
    w.update({ ...background, phase: 'choosing' }); await pause(50);
    w.dispose();
  } finally { w.dispose?.(); await dom.happyDOM.abort(); }
});

test('providers connect native AppState to focusManager and leave web focus listeners alone', async () => {
  const bundle = await build({
    stdin: { contents: `
      import './src/core/providers';
      import {focusManager} from '@tanstack/react-query';
      window.manager = focusManager;
    `, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'native-state', setup(builder) {
      builder.onResolve({ filter: /^react-native$/ }, () => ({ path: 'native', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
        export const Platform = {OS:window.testOS};
        export const AppState = {currentState:'active', addEventListener: (event, listener) => {
          window.subscriptions++; window.appState = listener;
          return {remove: () => {window.removed = true;}};
        }};
      ` }));
    } }],
  });
  for (const os of ['android', 'web']) {
    const dom = new Window({ console, settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
    const w = dom as unknown as Record<string, any>;
    w.testOS = os; w.subscriptions = 0;
    try {
      dom.eval(bundle.outputFiles[0].text);
      assert.equal(w.subscriptions, os === 'web' ? 0 : 1);
      if (os !== 'web') {
        w.appState('background'); assert.equal(w.manager.isFocused(), false);
        w.appState('active'); assert.equal(w.manager.isFocused(), true);
        w.manager.setEventListener(() => () => undefined);
        assert.equal(w.removed, true);
      }
    } finally { await dom.happyDOM.abort(); }
  }
});
