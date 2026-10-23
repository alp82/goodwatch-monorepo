import assert from 'node:assert/strict';
import test from 'node:test';
import releaseConfig from '../app.config';
import base from '../app.json';

function configured(variant: string, overrides: Record<string, string> = {}) {
  const previous = { ...process.env };
  Object.assign(process.env, { APP_VARIANT: variant, APP_BUILD_NUMBER: '7',
    EXPO_PUBLIC_API_ORIGIN: 'https://yepwatch.com', EXPO_PUBLIC_APP_ORIGIN: 'https://yepwatch.com',
    EXPO_PUBLIC_WS_ORIGIN: 'wss://yepwatch.com', EXPO_PUBLIC_ENABLE_FIXTURES: 'false',
    EXPO_PUBLIC_GUEST_ONLY: 'true', ...overrides });
  delete process.env.EXPO_PUBLIC_DEVELOPMENT_NOTICE;
  try { return releaseConfig({ config: { name: base.expo.name, slug: base.expo.slug, owner: base.expo.owner, extra: base.expo.extra, android: base.expo.android, ios: base.expo.ios }, projectRoot: '.', staticConfigPath: null, packageJsonPath: null }); }
  finally { process.env = previous; }
}

test('standalone variants coexist with development and use explicit version counters/invite scope', () => {
  assert.equal(configured('development').android?.package, 'dev.yepwatch.foundation');
  const preview = configured('preview'); const production = configured('production');
  assert.equal(preview.android?.package, 'com.yepwatch.preview');
  assert.equal(production.ios?.bundleIdentifier, 'com.yepwatch.app');
  assert.equal(preview.android?.versionCode, 7);
  assert.equal(production.ios?.buildNumber, '7');
  assert.equal(preview.android?.intentFilters?.[0].autoVerify, true);
  assert.deepEqual(preview.android?.intentFilters?.[0].data, [{ scheme: 'https', host: 'yepwatch.com', pathPrefix: '/r/' }]);
  for (const config of [configured('development'), preview, production]) {
    assert.equal(config.owner, 'alperortac');
    assert.equal(config.extra?.eas?.projectId, '0772c2db-91d8-4862-80eb-1d816f243072');
  }
});

test('release config fails closed on local endpoints, fixtures, or unsupported versions', () => {
  assert.throws(() => configured('preview', { EXPO_PUBLIC_API_ORIGIN: 'http://127.0.0.1:15992' }), /https/);
  assert.throws(() => configured('production', { EXPO_PUBLIC_ENABLE_FIXTURES: 'true' }), /fixtures disabled/);
  assert.equal(configured('production', { EXPO_PUBLIC_GUEST_ONLY: 'false' }).scheme, 'yepwatch');
  assert.throws(() => configured('production', { EXPO_PUBLIC_GUEST_ONLY: 'maybe' }), /explicit guest mode/);
  assert.throws(() => configured('production', { APP_BUILD_NUMBER: '0' }), /positive integer/);
});
