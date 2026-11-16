import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { analyticsCommand, analyticsScreen, createAnalytics, type AnalyticsPayload } from '../src/core/analytics-policy';

test('screen tracking redacts room IDs, invitations, queries and fragments; unknown and auth routes are excluded', () => {
  assert.deepEqual(analyticsScreen('/room/private-room/matches?token=secret#grant'), { path: '/room/matches', title: 'Matches' });
  assert.deepEqual(analyticsScreen('/room/private-room'), { path: '/room', title: 'Room' });
  assert.deepEqual(analyticsScreen('/r/private-invitation?code=secret'), { path: '/invite', title: 'Join room' });
  for (const path of ['/auth/callback?code=secret', '/room/id/private-field', '/preview', '/unknown', '/r/secret/extra']) assert.equal(analyticsScreen(path), null);
});

test('events contain only action names and safe screens, with consecutive screen deduplication', () => {
  const sent: AnalyticsPayload[] = [];
  const analytics = createAnalytics(() => true, async (payload) => { sent.push(payload); });
  analytics.screen('/room/private-room?invite=secret');
  analytics.screen('/room/private-room');
  analytics.event('vote_submitted');
  analytics.screen('/room/private-room/matches');
  analytics.screen('/room/private-room');
  assert.equal(sent.length, 4);
  assert.deepEqual(sent[1], { type: 'custom_event', pathname: '/room', page_title: 'Room', event_name: 'vote_submitted' });
  assert.doesNotMatch(JSON.stringify(sent), /private-room|invite|secret/);
  assert.equal(analyticsCommand('vote'), 'vote_submitted');
  assert.equal(analyticsCommand('pick_favorite'), 'favorite_submitted');
  assert.equal(analyticsCommand('confirm_in'), 'match_confirmation_submitted');
  for (const command of ['rename', 'add_idea', 'toString', 'unknown']) assert.equal(analyticsCommand(command), undefined);
});

test('disabled analytics sends nothing; synchronous and asynchronous failures never escape into product flows', async () => {
  let disabledSends = 0;
  const disabled = createAnalytics(() => false, async () => { disabledSends++; });
  disabled.screen('/'); disabled.event('room_created');
  assert.equal(disabledSends, 0);
  const syncFailure = createAnalytics(() => true, () => { throw Error('blocked'); });
  assert.doesNotThrow(() => syncFailure.event('room_created'));
  const asyncFailure = createAnalytics(() => true, async () => { throw Error('offline'); });
  assert.doesNotThrow(() => asyncFailure.screen('/'));
  await new Promise(resolve => setImmediate(resolve));
});

function load<T>(file: URL, deps: Record<string, unknown>, globals: Record<string, unknown> = {}): T {
  const module = { exports: {} };
  const code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module, exports: module.exports, __DEV__: false, process: { env: {} },
    setTimeout, clearTimeout, ...globals, require: (name: string) => {
      if (!(name in deps)) throw Error(`Unexpected dependency ${name}`);
      return deps[name];
    } });
  return module.exports as T;
}
type Transport = { analyticsAllowed(): boolean; sendAnalytics(payload: AnalyticsPayload): Promise<void>; resetAnalyticsIdentity(): Promise<void> };

test('web sends to the web site without a URL, referrer, cookies or stored identifier and honors opt-out and local/fixture exclusions', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const window = { location: { hostname: 'yepwatch.com', href: 'https://yepwatch.com/r/SECRET?code=SECRET' }, __RYBBIT_OPTOUT__: false };
  const env: Record<string, string> = {};
  let optOut: string | null = null;
  const web = load<Transport>(new URL('../src/core/analytics-transport.web.ts', import.meta.url), {
    './analytics-request': { analyticsFetch: async (url: string, init: RequestInit) => { requests.push({ url, init }); return Response.json({ success: true }); } },
  }, { window, navigator: { language: 'en-US' }, localStorage: { getItem: () => optOut }, process: { env } });
  const analytics = createAnalytics(web.analyticsAllowed, web.sendAnalytics);
  analytics.screen('/r/SECRET?code=SECRET');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://a.seen.is/api/track');
  assert.equal(requests[0].init.referrerPolicy, 'no-referrer');
  assert.equal(requests[0].init.credentials, 'omit');
  const body = JSON.parse(requests[0].init.body as string);
  assert.deepEqual(body, { site_id: 'b28bba760aaf', hostname: 'yepwatch.com', type: 'pageview', pathname: '/invite', page_title: 'Join room', querystring: '', referrer: '', language: 'en-US' });
  optOut = 'true'; assert.equal(web.analyticsAllowed(), false);
  optOut = null; window.__RYBBIT_OPTOUT__ = true; assert.equal(web.analyticsAllowed(), false);
  window.__RYBBIT_OPTOUT__ = false; window.location.hostname = 'localhost'; assert.equal(web.analyticsAllowed(), false);
  window.location.hostname = 'yepwatch.com'; env.EXPO_PUBLIC_ENABLE_FIXTURES = 'true'; assert.equal(web.analyticsAllowed(), false);
  delete env.EXPO_PUBLIC_ENABLE_FIXTURES; env.EXPO_PUBLIC_ANALYTICS_ENABLED = 'false'; assert.equal(web.analyticsAllowed(), false);
});

test('native uses the real Rybbit SDK and mobile site with a separate persisted ID, safe context and identity reset', async () => {
  // Exercise the installed SDK, replacing only native platform APIs and the network.
  const sdkModule = { exports: {} };
  runInNewContext(readFileSync(createRequire(import.meta.url).resolve('@rybbit/react-native'), 'utf8'), {
    module: sdkModule, setTimeout, clearTimeout,
    require: (name: string) => {
      assert.equal(name, 'react-native');
      return { Platform: { OS: 'android', Version: 36 }, Dimensions: { get: () => ({ width: 390, height: 844 }) }, NativeModules: {} };
    },
  });
  const stored = new Map<string, string>();
  const requests: { url: string; init: RequestInit }[] = [];
  const env: Record<string, string> = {};
  const native = load<Transport>(new URL('../src/core/analytics-transport.ts', import.meta.url), {
    '@rybbit/react-native': sdkModule.exports,
    'expo-constants': { default: { expoConfig: { version: '1.0.0' } } },
    'expo-secure-store': {
      getItemAsync: async (key: string) => stored.get(key) ?? null,
      setItemAsync: async (key: string, value: string) => { stored.set(key, value); },
      deleteItemAsync: async (key: string) => { stored.delete(key); },
    },
    './analytics-request': { analyticsFetch: async (url: string, init: RequestInit) => {
      requests.push({ url, init }); return Response.json({ trackInitialPageView: true });
    } },
  }, { process: { env } });
  assert.equal(native.analyticsAllowed(), true);
  await native.sendAnalytics({ type: 'pageview', pathname: '/room', page_title: 'Room' });
  await native.sendAnalytics({ type: 'custom_event', pathname: '/room', page_title: 'Room', event_name: 'vote_submitted' });
  const events = requests.filter(r => r.url.endsWith('/track')).map(r => JSON.parse(r.init.body as string));
  assert.equal(events.length, 2);
  for (const event of events) {
    assert.equal(event.site_id, '96d946d8bf70'); assert.equal(event.hostname, 'com.yepwatch.app');
    assert.equal(event.pathname, '/room'); assert.equal(event.querystring, ''); assert.equal(event.referrer, '');
    assert.equal(event.user_id, undefined); assert.equal(event.properties, undefined);
    assert.equal(event.anonymous_id, stored.get('yepwatch.analytics.anonymous-id'));
  }
  assert.match((requests.find(r => r.url.endsWith('/track'))!.init.headers as Record<string, string>)['User-Agent'], /Android/);
  await native.resetAnalyticsIdentity(); assert.equal(stored.size, 0);
  env.EXPO_PUBLIC_ENABLE_FIXTURES = 'true'; assert.equal(native.analyticsAllowed(), false);
  delete env.EXPO_PUBLIC_ENABLE_FIXTURES; env.EXPO_PUBLIC_ANALYTICS_ENABLED = 'false'; assert.equal(native.analyticsAllowed(), false);
});
