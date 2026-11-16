import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadIsolated } from './isolated-module';
const { nativeInviteUrl } = loadIsolated<{ nativeInviteUrl: (code: string, preview?: boolean) => string }>(new URL('../src/core/invites.ts', import.meta.url), { './config': { appOrigin: 'https://yepwatch.com' } });
test('handoff keeps the invitation in the router path for both install identities', () => {
  for (const preview of [false, true]) {
    const url = new URL(nativeInviteUrl('ABCD12', preview));
    assert.equal(url.protocol, preview ? 'yepwatch-preview:' : 'yepwatch:');
    assert.equal(url.host, '');
    assert.equal(url.pathname, '/r/ABCD12');
    assert.equal(url.search, '');
  }
  assert.equal(new URL(nativeInviteUrl('a/b?c#d')).pathname, '/r/a%2Fb%3Fc%23d');
});
