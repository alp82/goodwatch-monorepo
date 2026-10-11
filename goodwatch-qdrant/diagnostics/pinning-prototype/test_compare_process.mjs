import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {sha} from './source-freeze.mjs';
import {controlledBatch} from './compare.mjs';
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
 emit({'stage':'phase-failed','reason':'query_lease_timeout'})
 emit({'stage':'released','released':True,'pinChildExited':True})
 raise SystemExit(1)
signal.signal(signal.SIGTERM,stopped)
for frame in frames[:2]:emit(frame)
if sys.stdin.readline()!='{"stage":"query-finished"}\\n':raise SystemExit(1)
for frame in frames[2:]:emit(frame)
`;
async function run(query,phase='baseline'){
 const directory=mkdtempSync(join(tmpdir(),'gw-compare-protocol-'));const code=join(directory,'control.py'),config=join(directory,'config.json');writeFileSync(code,script);writeFileSync(config,'{}');
 const expected={helperCodeSha256:'b'.repeat(64),helperPolicySha256:'c'.repeat(64),controllerCodeSha256:sha(Buffer.from(script)),controllerPolicySha256:sha(Buffer.from('{}'))};
 const spawnControl=(binary,args,options)=>spawn(binary,args,{...options,env:{...process.env,TEST_FRAMES:JSON.stringify(fixture(phase,expected))}});
 try{return await controlledBatch({tag:'heldout-person',collection:'fixture',queries:[]},phase,expected,{code,config},query,{spawnControl});}
 finally{rmSync(directory,{recursive:true,force:true});}
}
test('actual child readiness/ack/completion frames require exit and release before validation',async()=>{
 const result=await run(async()=>({serverMs:10,wallMs:20,results:[[]]}));
 assert.equal(result.frames.length,5);assert.equal(result.metrics.phase,'baseline');
});
test('actual query failure waits for child termination and captures safe reason/release/exit',async()=>{
 await assert.rejects(run(async()=>{throw Error('private query/provider error')}),error=>{
  assert.equal(error.publicEvidence.reason,'query_lease_timeout');assert.equal(error.publicEvidence.exitObserved,true);assert.equal(error.publicEvidence.controllerExitCode,1);assert.equal(error.publicEvidence.cleanupObserved,true);
  assert.equal(JSON.stringify(error.publicEvidence).includes('private query'),false);return true;
 });
});
test('candidate wall tail fails despite actual clean child completion',async()=>{
 await assert.rejects(run(async()=>({serverMs:10,wallMs:1500,results:[[]]}),'candidate'),error=>{assert.equal(error.publicEvidence.controllerExitCode,0);assert.equal(error.publicEvidence.cleanupObserved,true);return true;});
});
