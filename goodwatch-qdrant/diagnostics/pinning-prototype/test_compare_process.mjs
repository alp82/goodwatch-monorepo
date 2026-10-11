import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {sha} from './source-freeze.mjs';
import {controlledBatch,publicFailure} from './compare.mjs';
function fixture(phase,expected){
 const base={schema:'search.clone-mlock-control.v2',phase,at:'2026-10-12T00:00:00Z',...expected};
 const selectionHash='a'.repeat(64),limits={memoryEventDelta:{max:0,oom:0,oom_kill:0},cpuLimitDelta:{nr_throttled:0,throttled_usec:0}};
 const pin={lockedBytes:16384,selectionHash,newLockBytes:0,rangesChanged:false,lockedResidency:Object.fromEntries(['vector','graph','sparse','other'].map(k=>[k,{lockedDataPages:1,residentLockedDataPages:1}]))};
 return [{...base,stage:'pressure-complete',selectionHash,pressureLimits:limits,prequeryMissingBytes:64*1024**2,negativePrequeryMissingBytes:64*1024**2},
 {...base,stage:'query-ready',selectionHash,cold:{residentPagesAfterEviction:0,pointCount:244262,segmentCount:12,shardCount:6},pressureWriterPlacement:'controller-original-cgroup',pressure:{mode:'readonly-existing-archive',bytes:4428863488},initialPinState:pin,pinState:pin},
 {...base,stage:'query-finished',selectionHash,queryLimits:limits,queryProcessDelta:{majorFaults:1},pinStateAfterQuery:pin},
 {...base,stage:'released',released:true,pinChildExited:true},{...base,stage:'unpin-complete',pinChildExited:true}];
}
const script=`import json,os,sys,signal
frames=json.loads(os.environ['TEST_FRAMES'])
def emit(frame):print(json.dumps(frame),flush=True)
def stopped(number,frame):
 emit({'stage':'phase-failed','reason':'controller_interrupted'})
 emit({'stage':'released','released':True,'pinChildExited':True})
 raise SystemExit(1)
signal.signal(signal.SIGTERM,stopped)
for frame in frames[:2]:emit(frame)
if sys.stdin.readline()!='{"stage":"query-finished"}\\n':raise SystemExit(1)
for frame in frames[2:]:emit(frame)
`;
async function run(query,phase='baseline',{scriptText=script,tag='heldout-person',changeFrames=frames=>frames,budgets}={}){
 const directory=mkdtempSync(join(tmpdir(),'gw-compare-protocol-'));const code=join(directory,'control.py'),config=join(directory,'config.json');writeFileSync(code,scriptText);writeFileSync(config,'{}');
 const expected={helperCodeSha256:'b'.repeat(64),helperPolicySha256:'c'.repeat(64),controllerCodeSha256:sha(Buffer.from(scriptText)),controllerPolicySha256:sha(Buffer.from('{}'))};
 const spawnControl=(binary,args,options)=>spawn(binary,args,{...options,env:{...process.env,TEST_FRAMES:JSON.stringify(changeFrames(fixture(phase,expected)))}});
 try{return await controlledBatch({tag,collection:'fixture',queries:[]},phase,expected,{code,config},query,{spawnControl,...(budgets?{budgets}:{})});}
 finally{rmSync(directory,{recursive:true,force:true});}
}
test('actual child readiness/ack/completion frames require exit and release before validation',async()=>{
 const result=await run(async()=>({serverMs:10,wallMs:20,results:[[]]}));
 assert.equal(result.frames.length,5);assert.equal(result.metrics.phase,'baseline');
});
test('actual query failure waits for child termination and captures safe reason/release/exit',async()=>{
 await assert.rejects(run(async()=>{throw Error('private query/provider error')}),error=>{
  assert.equal(error.publicEvidence.reason,'query_failed');assert.equal(error.publicEvidence.controllerReason,'controller_interrupted');assert.equal(error.publicEvidence.exitObserved,true);assert.equal(error.publicEvidence.controllerExitCode,1);assert.equal(error.publicEvidence.cleanupObserved,true);
  assert.equal(JSON.stringify(error.publicEvidence).includes('private query'),false);return true;
 });
});
test('candidate wall tail fails despite actual clean child completion',async()=>{
 await assert.rejects(run(async()=>({serverMs:10,wallMs:1500,results:[[]]}),'candidate'),error=>{assert.equal(error.publicEvidence.reason,'candidate_tail_remains');assert.equal(error.publicEvidence.serverMs,10);assert.equal(error.publicEvidence.wallMs,1500);assert.equal(error.publicEvidence.controllerExitCode,0);assert.equal(error.publicEvidence.cleanupObserved,true);return true;});
});

test('non-red native retains observed timings and distinct contract failure',async()=>{
 await assert.rejects(run(async()=>({serverMs:200,wallMs:210,results:[[]]}),'baseline',{tag:'control-native-title'}),error=>{
  assert.equal(error.publicEvidence.reason,'negative_not_red');assert.equal(error.publicEvidence.failureKind,'contract');assert.equal(error.publicEvidence.serverMs,200);assert.equal(error.publicEvidence.wallMs,210);return true;
 });
});
test('pressure-cap and missing-fault contract failures retain fixed causes',async()=>{
 for(const [reason,changeFrames]of [['pressure_cap_confounded',frames=>{frames[0].pressureLimits.memoryEventDelta.max=1;return frames}],['negative_no_faults',frames=>{frames[2].queryProcessDelta.majorFaults=0;return frames}]]){
  await assert.rejects(run(async()=>({serverMs:1800,wallMs:1810,results:[[]]}),'baseline',{tag:'control-native-title',changeFrames}),error=>{assert.equal(error.publicEvidence.reason,reason);assert.equal(error.publicEvidence.serverMs,1800);return true;});
 }
});
test('query timeout is primary while parent-caused controller interruption is separate',async()=>{
 await assert.rejects(run(async()=>{const error=Error('private query');error.name='BackendTimeoutError';throw error}),error=>{
  assert.equal(error.publicEvidence.reason,'query_timeout');assert.equal(error.publicEvidence.failureKind,'query');assert.equal(error.publicEvidence.controllerReason,'controller_interrupted');assert.equal(error.publicEvidence.serverMs,null);return true;
 });
});
test('controller already reporting phase failure receives bounded cleanup without SIGTERM',async()=>{
 const delayed=`import signal,time,json
signal.signal(signal.SIGTERM,lambda a,b:print(json.dumps({'stage':'failed','reason':'controller_interrupted'}),flush=True))
print(json.dumps({'stage':'phase-failed','reason':'phase_resource_failed'}),flush=True)
time.sleep(.1)
print(json.dumps({'stage':'released','released':True,'pinChildExited':True}),flush=True)
raise SystemExit(1)
`;
 await assert.rejects(run(async()=>{throw Error('must not query')},'baseline',{scriptText:delayed,budgets:{ready:500,cleanup:500,reaped:500}}),error=>{
  assert.equal(error.publicEvidence.controllerReason,'phase_resource_failed');assert.equal(error.publicEvidence.controllerFrames.some(f=>f.reason==='controller_interrupted'),false);assert.equal(error.publicEvidence.controllerExitCode,1);assert.equal(error.publicEvidence.cleanupObserved,true);return true;
 });
});
test('reaped SIGKILL records close event even when exit code is null',async()=>{
 const stubborn=`import json,os,signal,time
signal.signal(signal.SIGTERM,signal.SIG_IGN)
for frame in json.loads(os.environ['TEST_FRAMES'])[:2]:print(json.dumps(frame),flush=True)
while True:time.sleep(.1)
`;
 await assert.rejects(run(async()=>{throw Error('private query')},'baseline',{scriptText:stubborn,budgets:{ready:500,cleanup:30,reaped:500}}),error=>{
  assert.equal(error.publicEvidence.exitObserved,true);assert.equal(error.publicEvidence.controllerExitCode,null);assert.equal(error.publicEvidence.controllerExitSignal,'SIGKILL');assert.equal(error.publicEvidence.cleanupObserved,false);return true;
 });
});
test('public transport classification never includes private exception text',()=>{
 const error=Error('private query/api key');error.code='ECONNRESET';
 assert.equal(publicFailure(error,'query').reason,'query_transport_failure');assert.equal(publicFailure(error,'query').transportCode,'ECONNRESET');assert.equal(JSON.stringify(publicFailure(error,'query')).includes('private'),false);
});

test('ready timeout retains primary deadline and separately records caused interruption',async()=>{
 const scriptText=`import json,signal,time
def stop(number,frame):
 print(json.dumps({'stage':'phase-failed','reason':'controller_interrupted'}),flush=True)
 print(json.dumps({'stage':'released','released':True,'pinChildExited':True}),flush=True)
 raise SystemExit(1)
signal.signal(signal.SIGTERM,stop)
while True:time.sleep(.1)
`;
 await assert.rejects(run(async()=>{throw Error('must not query')},'baseline',{scriptText,budgets:{ready:100,cleanup:500,reaped:500}}),error=>{
  assert.equal(error.publicEvidence.reason,'control_ready_timeout');assert.equal(error.publicEvidence.failureKind,'readiness');assert.equal(error.publicEvidence.controllerReason,'controller_interrupted');assert.equal(error.publicEvidence.controllerFrames.filter(f=>f.reason==='controller_interrupted').length,1);assert.equal(error.publicEvidence.exitObserved,true);return true;
 });
});
