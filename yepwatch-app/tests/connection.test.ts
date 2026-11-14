import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuousApi, RoomFailure } from '../src/core/continuous/api-client';

for (const [message, reason] of [
  ['fetch failed: An SSL error has occurred and a secure connection cannot be made.', 'tls'],
  ['fetch failed: A server with the specified hostname could not be found.', 'dns'],
  ['fetch failed: The Internet connection appears to be offline.', 'offline'],
  ['fetch failed: native failure for https://private.example/room/secret?token=private', 'network'],
] as const) test(`native ${reason} failure keeps a safe diagnostic without losing retry semantics`, async () => {
  const api=new ContinuousApi(async()=>{throw new Error(message);},true);
  await assert.rejects(api.request('/api/yepwatch/v1/proposal/rooms',{nickname:'Private name',admissionSecret:'private'}),error=>{
    assert.ok(error instanceof RoomFailure);assert.equal(error.code,'outcome_unknown');
    const diagnostic=(error as RoomFailure & {diagnostic?:{reason:string;stage:string;status:number|null;elapsedMs:number}}).diagnostic;
    assert.equal(diagnostic?.reason,reason);assert.equal(diagnostic?.stage,'request');assert.equal(diagnostic?.status,null);
    assert.equal(JSON.stringify(diagnostic).includes('private'),false);assert.equal(JSON.stringify(diagnostic).includes('Private name'),false);
    return true;
  });
});

test('non-JSON response reports its HTTP status, not a network outage',async()=>{
  const api=new ContinuousApi(async()=>new Response('<html>Gateway error</html>',{status:502}),true);
  await assert.rejects(api.request('/api/yepwatch/v1/proposal/rooms',{}),error=>{
    assert.ok(error instanceof RoomFailure);
    const diagnostic=(error as RoomFailure & {diagnostic?:{reason:string;stage:string;status:number|null}}).diagnostic;
    assert.equal(diagnostic?.reason,'response');assert.equal(diagnostic?.stage,'response');assert.equal(diagnostic?.status,502);return true;
  });
});

test('every YepWatch answer is reported to the live channel (network evidence); a request that got none is not', async () => {
  const { onYepwatchAnswer } = await import('../src/core/continuous/network');
  const heard: [number, boolean][] = [];
  const off = onYepwatchAnswer((status, ticket) => heard.push([status, ticket]));
  const access = { roomId: 'r1', participantId: 'p', token: 't', expiresAt: 999 };
  try {
    await new ContinuousApi(async () => Response.json({ ok: true })).snapshot(access);
    await assert.rejects(new ContinuousApi(async () => Response.json({ error: { code: 'busy' } }, { status: 503 })).snapshot(access));
    await new ContinuousApi(async () => Response.json({ ticket: 'x' })).ticket(access);
    await assert.rejects(new ContinuousApi(async () => { throw new Error('fetch failed'); }).snapshot(access));
    assert.deepEqual(heard, [[200, false], [503, false], [200, true]]);
  } finally {
    off();
  }
});
