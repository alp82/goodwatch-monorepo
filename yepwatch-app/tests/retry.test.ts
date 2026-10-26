import test from 'node:test';
import assert from 'node:assert/strict';
import { ContinuousApi, RoomFailure } from '../src/core/continuous/api-client';
import { parseRetryAfter, retainRequest, retryDeadline, restoredRetryAt } from '../src/core/continuous/retry';
import { decodeCommandRecovery, decodeAdmissionRecovery } from '../src/core/continuous/recovery-state';
import { PersistentCommands } from '../src/core/continuous/state';
import { continuousFixture } from './continuous-fixture';
import type { CommandEnvelope } from '@goodwatch/yepwatch-contracts/proposal';

test('Retry-After accepts bounded integer seconds only; malformed/huge/missing/date values use two seconds', () => {
  for (const [header, expected] of [['1',1],['60',60],['21600',21600],[' 003 ',3]] as const)
    assert.equal(parseRetryAfter(header), expected);
  for (const header of [null, undefined, '', '0', '-1', '+2', '2.5', '1e3', 'Infinity', '21601', '999999999999999999999999999', 'Wed, 21 Oct 2015 07:28:00 GMT', '1, 2'])
    assert.equal(parseRetryAfter(header), 2);
  assert.equal(restoredRetryAt(1100, 1000), 1100);
  assert.equal(restoredRetryAt(1000, 1000), 0);
  assert.equal(restoredRetryAt(99999999999999, 1000), 3000);
});

test('HTTP failure carries strict retryable and Retry-After without inventing receipts or snapshots', async () => {
  const api = new ContinuousApi(async () => Response.json({error:{code:'limit_reached',message:'Wait',retryable:true}}, {status:429,headers:{'Retry-After':'60'}}));
  await assert.rejects(api.request('/api/yepwatch/v1/proposal/rooms', {}), (e: unknown) => {
    assert.ok(e instanceof RoomFailure); assert.equal(e.retryable,true); assert.equal(e.retryAfterSeconds,60);
    assert.equal(e.snapshot,undefined); assert.equal(e.status,429); return true;
  });
  const nonJson = new ContinuousApi(async () => new Response('Temporary upstream error', {status:429,headers:{'Retry-After':'60'}}));
  await assert.rejects(nonJson.request('/api/yepwatch/v1/proposal/rooms', {}), (e: unknown) => {
    assert.ok(e instanceof RoomFailure); assert.equal(e.code,'outcome_unknown'); assert.equal(e.retryAfterSeconds,60); return true;
  });
  const bad = new ContinuousApi(async () => Response.json({error:{code:'limit_reached',message:'Wait',retryable:'true'}}, {status:429,headers:{'Retry-After':'99999999999999'}}));
  await assert.rejects(bad.request('/api/yepwatch/v1/proposal/rooms', {}), (e: unknown) => {
    assert.ok(e instanceof RoomFailure); assert.equal(e.retryable,false); assert.equal(e.retryAfterSeconds,2); return true;
  });
});

test('retryable errors preserve exact commands and cooldown across reload; expiry never submits until manual retry', async () => {
  const room = continuousFixture(); let raw: string | null = null; let calls = 0;
  const storage = {write: async (envelope: CommandEnvelope | null, retryAt = 0) => { raw = envelope ? JSON.stringify({envelope,retryAt}) : null; }};
  const queue = new PersistentCommands(()=>'one-command',storage);
  const vote = {type:'vote',generation:1,candidateId:'c1',expectedVoteRevision:0,value:'watch'} as const;
  await assert.rejects(queue.send(vote,room,async ()=>{calls++;throw new RoomFailure('limit_reached','Wait',429,undefined,undefined,true,1);}));
  const recovery = decodeCommandRecovery(raw); assert.deepEqual(recovery.envelope,queue.pending); assert.ok(recovery.retryAt>Date.now());
  const reload = new PersistentCommands(()=>'never-use-new-id',storage); reload.pending=recovery.envelope; reload.retryAt=recovery.retryAt;
  await assert.rejects(reload.send(undefined,room,async ()=>{calls++;return {snapshot:room};}), /Wait before retrying/);
  assert.equal(calls,1);
  // Advancing the local deadline does not execute anything; only explicit send(undefined) replays.
  reload.retryAt=Date.now()-1; room.own.nextSequence=77; assert.equal(calls,1);
  await reload.send(undefined,room,async body=>{calls++;assert.deepEqual(body,recovery.envelope);return {snapshot:room};});
  assert.equal(calls,2); assert.equal(raw,null); assert.equal(reload.pending,null); assert.equal(reload.retryAt,0);
});

test('terminal statuses override retryable while legacy busy/unknown remain compatible and nonretryable fails clear', async () => {
  for (const status of [401,403,404,410]) {
    const e=new RoomFailure('busy','Access ended',status,undefined,undefined,true,60);
    assert.equal(retainRequest(e),false); assert.equal(retryDeadline(e,1000),0);
  }
  for (const code of ['busy','outcome_unknown']) assert.equal(retainRequest(new RoomFailure(code,'Legacy')),true);
  for (const retryable of [false,true]) {
    let saved: CommandEnvelope|null=null;
    const q=new PersistentCommands(()=> 'id',{write:async e=>{saved=e;}});
    await assert.rejects(q.send({type:'refill',generation:1,expectedStreamVersion:1},continuousFixture(),async()=>{throw new RoomFailure('catalog_unavailable','No',503,undefined,undefined,retryable,2);}));
    assert.equal(Boolean(saved),retryable); assert.equal(Boolean(q.pending),retryable);
  }
});

test('admission recovery preserves exact bootstrap secret/nickname/invite and bounded cooldown for this intent', () => {
  const saved={intent:'',code:'full-invite',retryAt:Date.now()+1000,request:{contractVersion:3,commandId:'stable',admissionSecret:'private-bootstrap',nickname:'Guest'}};
  const loaded=decodeAdmissionRecovery(JSON.stringify(saved),''); assert.deepEqual(loaded,saved);
  assert.throws(()=>decodeAdmissionRecovery(JSON.stringify(saved),'different-invite'));
  assert.deepEqual(decodeCommandRecovery(JSON.stringify({commandId:'legacy',sequence:3,command:{type:'ready',ready:true,expectedContextVersion:1}})).envelope?.commandId,'legacy');
});

test('native SecureStore admission write failures propagate on every attempt, with unchanged bootstrap when storage recovers', async () => {
  const { readFileSync } = await import('node:fs');
  const { runInNewContext } = await import('node:vm');
  const ts = await import('typescript');
  const source = readFileSync(new URL('../src/core/continuous/storage.ts', import.meta.url), 'utf8');
  const exports: {writeAdmission?: (intent: string, saved: unknown) => Promise<void>} = {};
  const writes: {key:string;value:string}[] = []; let allow = false;
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code,{exports,require:(name: string) => {
    if(name==='expo-secure-store') return {WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device',setItemAsync:async(key:string,value:string)=>{writes.push({key,value});if(!allow)throw new Error('Injected SecureStore failure');}};
    if(name==='expo-crypto') return {CryptoDigestAlgorithm:{SHA256:'SHA256'},digestStringAsync:async()=> 'stable-intent-hash'};
    if(name==='./recovery-state') return {};
    throw new Error('Unexpected native storage dependency');
  }});
  const saved={intent:'',code:'',retryAt:0,request:{contractVersion:3,commandId:'same-id',admissionSecret:'isolated-test-bootstrap',nickname:'Guest'}};
  await assert.rejects(exports.writeAdmission!('',saved),/Injected SecureStore failure/);
  await assert.rejects(exports.writeAdmission!('',saved),/Injected SecureStore failure/);
  allow=true;await exports.writeAdmission!('',saved);
  assert.equal(writes.length,3);assert.ok(writes.every(w=>w.key==='yepwatch.v3.admission.stable-intent-hash' && w.value===JSON.stringify(saved)));
});

test('admission recovery retains sign-in intent and rejects corrupt intent flags', () => {
  const saved = { intent: '', code: '', retryAt: 0, member: true, request: { contractVersion: 3, commandId: 'same', admissionSecret: 'same-secret', nickname: 'Guest' } };
  assert.deepEqual(decodeAdmissionRecovery(JSON.stringify(saved), ''), saved);
  assert.throws(() => decodeAdmissionRecovery(JSON.stringify({ ...saved, member: 'true' }), ''));
});
