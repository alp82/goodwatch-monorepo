import assert from 'node:assert/strict';
import test from 'node:test';
import { memberReturnUri, nativeMemberCallback } from '../src/core/continuous/member-state';

test('preview and production returns retain the callback of the originating app', () => {
  for (const scheme of ['yepwatch', 'yepwatch-preview']) {
    const returnUri = memberReturnUri(scheme);
    const pending = { roomId: 'room', expectedState: 'state', verifier: 'verifier', expiresAt: Date.now() + 60000, returnUri };
    const result = nativeMemberCallback(`${returnUri}?roomId=room&state=state&code=code`, pending);
    assert.equal(result.codeVerifier, 'verifier');
    const other = scheme === 'yepwatch' ? 'yepwatch-preview' : 'yepwatch';
    assert.throws(() => nativeMemberCallback(`${other}://auth/callback?roomId=room&state=state&code=code`, pending), /Unexpected/);
  }
  assert.throws(() => memberReturnUri('exp'), /configured/);
});
