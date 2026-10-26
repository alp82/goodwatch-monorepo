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
