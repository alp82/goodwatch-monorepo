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

test('a device sign-in return link carries exactly its state and code, for this app only', async () => {
  const { nativeAccountCallback, isAccountCallback } = await import('../src/core/continuous/member-state');
  const returnUri = 'yepwatch://auth/callback';
  const pending = { expectedState: 'acctn.0.abc', verifier: 'v'.repeat(43), expiresAt: Date.now() + 60000, returnUri };
  assert.deepEqual(nativeAccountCallback(`${returnUri}?state=acctn.0.abc&code=c1`, pending), { state: 'acctn.0.abc', code: 'c1', codeVerifier: pending.verifier });
  assert.equal(isAccountCallback(`${returnUri}?state=acctn.0.abc&code=c1`), true);
  assert.equal(isAccountCallback(`${returnUri}?roomId=r&state=r.abc&code=c1`), false, 'older room links keep their own path');
  assert.throws(() => nativeAccountCallback(`${returnUri}?state=acctn.0.other&code=c1`, pending), /does not match/);
  assert.throws(() => nativeAccountCallback(`${returnUri}?state=acctn.0.abc&code=c1&roomId=r`, pending), /does not match/);
  assert.throws(() => nativeAccountCallback(`yepwatch-preview://auth/callback?state=acctn.0.abc&code=c1`, pending), /Unexpected/);
  assert.throws(() => nativeAccountCallback(`${returnUri}?state=acctn.0.abc&code=c1`, { ...pending, expiresAt: Date.now() - 1 }), /expired/);
});

test('the browser comes back to the screen it signed in from, without one-off arrival markers', async () => {
  const { returnPath } = await import('../src/core/continuous/member-state');
  assert.equal(returnPath('/'), '/');
  assert.equal(returnPath('/room/abc', '?signin=1&fresh=1'), '/room/abc');
  assert.equal(returnPath('/', '?open=profile'), '/?open=profile');
  assert.equal(returnPath('/r/ABC234'), '/r/ABC234');
  assert.equal(returnPath('//evil.example/x'), '/');
});
