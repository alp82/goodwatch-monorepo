import test from 'node:test';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import crypto from 'node:crypto';
import {controlledBatch,packetsFrom,requireV4PacketSet} from './consumer_cpu0.mjs';
import {packet,prior,expected as fixtureExpected} from './cpu0_consumer_fixture.mjs';
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(mutate=()=>{},mode='normal'){
 const directory=mkdtempSync(path.join(tmpdir(),'cpu0-consumer-'));const code=directory+'/controller_cpu0.py',config=directory+'/controller-config.json';writeFileSync(code,'public fixture controller');writeFileSync(config,'{}');
 const expected={...fixtureExpected,controllerCodeSha256:digest('public fixture controller'),controllerPolicySha256:digest('{}')};const frames=packet();for(const frame of frames)Object.assign(frame,expected);mutate(frames);
 let child,args;const spawnControl=(_executable,argv,options)=>{assert.deepEqual(options.env,{PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',DOCKER_HOST:'unix:///var/run/docker.sock'});args=argv;child=spawn(process.execPath,['-e',`
 const frames=JSON.parse(process.env.PUBLIC_FRAMES);const emit=f=>process.stdout.write(JSON.stringify(f)+'\\n');
 if(process.env.FIXTURE_MODE==='stall'){process.stdout.write(JSON.stringify({fixtureReady:true})+'\\n');setInterval(()=>{},1000);}
 else {for(const frame of frames.slice(0,3))emit(frame);let input='';process.stdin.on('data',part=>input+=part);process.stdin.on('end',()=>{if(input!=='{"stage":"query-finished"}\\n')process.exit(8);for(const frame of frames.slice(3))emit(frame);});}
 `],{stdio:['pipe','pipe','pipe'],env:{PUBLIC_FRAMES:JSON.stringify(frames),FIXTURE_MODE:mode}});return child;};
 return {expected,paths:{code,config},spawnControl,get child(){return child},get args(){return args},cleanup:()=>rmSync(directory,{recursive:true,force:true})};
}
const input={tag:'control-native-title',collection:'media_fingerprint_v1',queries:[{query:[1]}]};
test('real controller pipe waits for admission, actual socket closure and all seven lifecycle stages',async()=>{
 const f=fixture();let queries=0;try{const result=await controlledBatch(input,'baseline',f.expected,f.paths,prior(),async()=>{queries++;assert.equal(f.child.exitCode,null);return{serverMs:1900,wallMs:1920,socketClosed:true,results:[[{id:1,score:.2}]]};},{spawnControl:f.spawnControl});assert.equal(queries,1);assert.equal(result.frames.length,7);assert.equal(result.handoff.previousSha256,prior().sha256);assert.equal(f.args[f.args.indexOf('--handoff-sha256')+1],prior().sha256);assert.equal(f.child.exitCode,0);}finally{f.cleanup();}
});
test('invalid actual ready birth refuses before query and proves owned child exit',async()=>{
 const f=fixture(frames=>frames[2].initialAdmission.target.qdrant.pid=999);let queries=0;try{await assert.rejects(controlledBatch(input,'baseline',f.expected,f.paths,prior(),async()=>{queries++;},{spawnControl:f.spawnControl}),error=>error.publicEvidence.exitObserved===true&&error.publicEvidence.handoffAccepted===false);assert.equal(queries,0);assert.equal(f.child.signalCode,'SIGTERM');}finally{f.cleanup();}
});
test('handoff alone cannot resume when actual release or unpin is missing',async()=>{
 const f=fixture(frames=>frames.pop());try{await assert.rejects(controlledBatch(input,'baseline',f.expected,f.paths,prior(),async()=>({serverMs:1900,wallMs:1920,socketClosed:true,results:[[]]}),{spawnControl:f.spawnControl}),error=>error.publicEvidence.reason==='cpu0_phase_frames_invalid'&&error.publicEvidence.handoffAccepted===false);}finally{f.cleanup();}
});
test('unclosed client is rejected before controller acknowledgement',async()=>{
 const f=fixture();try{await assert.rejects(controlledBatch(input,'baseline',f.expected,f.paths,prior(),async()=>({serverMs:1900,wallMs:1920,socketClosed:false,results:[[]]}),{spawnControl:f.spawnControl}),error=>error.publicEvidence.reason==='cpu0_query_client_release_unproven'&&error.publicEvidence.exitObserved===true);}finally{f.cleanup();}
});

test('producer fence rejects truncated, missing, failed or extra post-completion input',async()=>{
 const {Readable}=await import('node:stream');const p={kind:'private-batch',tag:'control-native-title',lesserKnown:true,collection:'media_fingerprint_v1',indexBuildId:'20261011T041503Z',queries:[{query:[1]}]};const complete={kind:'private-producer-complete',exitCode:0};
 for(const input of [JSON.stringify(p)+'\n',JSON.stringify(p)+'\n{"kind":',JSON.stringify(p)+'\n'+JSON.stringify({...complete,exitCode:1})+'\n',JSON.stringify(p)+'\n'+JSON.stringify(complete)+'\n'+JSON.stringify(p)+'\n'])await assert.rejects(packetsFrom(Readable.from([input])));
 const packets=await packetsFrom(Readable.from([JSON.stringify(p)+'\n'+JSON.stringify(complete)+'\n']));assert.equal(packets.length,1);
});
test('nine slots require native anchor and reject ambiguous excluded historical slots',()=>{
 const tags={'coverage-history-080628':[false,true],'coverage-history-083054':[false,true],'heldout-person':[true],'heldout-description':[true],'heldout-unseen-native':[true],'control-native-title':[true],'control-low-vote-title':[true]};
 const all=Object.entries(tags).flatMap(([tag,flags])=>flags.map(lesserKnown=>({kind:'private-batch',tag,lesserKnown})));assert.equal(requireV4PacketSet(all).maximumWriterReceipts,18);
 for(const mutate of [rows=>rows.find(p=>p.tag==='control-native-title').kind='private-excluded',rows=>rows[0].kind='private-excluded',rows=>rows[1]={...rows[0]},rows=>rows.pop()]){const rows=structuredClone(all);mutate(rows);assert.throws(()=>requireV4PacketSet(rows));}
});
test('completed clean-stop evidence survives later refusal without raw private failures',async()=>{
 const stop=packet()[2].cold.cleanStop;const f=fixture(frames=>{frames.splice(0,frames.length,{stage:'phase-failed',reason:'private raw query',lifecycleCompletedStopReceipt:stop,rawError:'credential and vector'});});
 try{await assert.rejects(controlledBatch(input,'baseline',f.expected,f.paths,prior(),async()=>{throw Error('must not query')},{spawnControl:f.spawnControl}),error=>{assert.deepEqual(error.publicEvidence.failureEvidence.completedCleanStop,stop);assert.equal(JSON.stringify(error.publicEvidence).includes('credential'),false);assert.equal(JSON.stringify(error.publicEvidence).includes('private raw query'),false);return true;});}finally{f.cleanup();}
});
test('actual entry preflight process validates its successor before private producer selection',async()=>{
 const {runEntryPreflight}=await import('./consumer_cpu0.mjs');const {admission}=await import('./cpu0_consumer_fixture.mjs');const {canonicalHash}=await import('./compare-contract-cpu0.mjs');
 const a=admission();a.target=prior().snapshot.newRunning;a.sourceIdentity[2]=a.target.qdrant.pid;const record={...prior(),owner:'preflight',previousSha256:prior().sha256};delete record.sha256;const h={...record,sha256:canonicalHash(record)};
 const frame={schema:'search.clone-cpu0-preflight.v1',variant:'cpu0-owned-lifecycle.v1',birthAdmission:a,handoff:h,sourceIdentity:a.sourceIdentity,queries:0,resourceWrites:0,handoffWrites:1,modelsRead:0};
 let child;const spawnControl=(_executable,args,options)=>{assert.equal(options.env.DOCKER_HOST,'unix:///var/run/docker.sock');assert.equal(Object.hasOwn(options.env,'DOCKER_CONTEXT'),false);assert.equal(args.at(-1),prior().sha256);child=spawn(process.execPath,['-e','process.stdout.write(process.env.PUBLIC_RECEIPT+"\\n")'],{stdio:['ignore','pipe','pipe'],env:{PUBLIC_RECEIPT:JSON.stringify(frame)}});return child;};
 assert.equal((await runEntryPreflight(fixtureExpected,prior(),{spawnControl})).handoff.sha256,h.sha256);assert.equal(child.exitCode,0);
 frame.handoff.previousSha256='f'.repeat(64);await assert.rejects(runEntryPreflight(fixtureExpected,prior(),{spawnControl}));
});

test('actual reader preserves prequery ContractFailure reason instead of classifying it as malformed JSON',async()=>{
 const f=fixture(frames=>frames[2].cold.cleanStop.killFallback=true);try{await assert.rejects(controlledBatch(input,'baseline',f.expected,f.paths,prior(),async()=>{throw Error('must not query')},{spawnControl:f.spawnControl}),error=>error.publicEvidence.reason==='cpu0_clean_stop_unproven'&&error.publicEvidence.failureKind==='contract'&&error.publicEvidence.exitObserved===true);}finally{f.cleanup();}
});
test('actual preflight refusal retains allowlisted resource-unavailable evidence and observed exit',async()=>{
 const {runEntryPreflight}=await import('./consumer_cpu0.mjs');const frame={schema:'search.clone-cpu0-preflight.v1',stage:'failed',reason:'resource_metrics_unavailable',resourceLimitEvidence:{schema:'search.clone-resource-window.v1',scope:'turnover-join',measurementsAvailable:false,overlappingNonAdditive:true}};
 const spawnControl=()=>spawn(process.execPath,['-e','process.stdout.write(process.env.PUBLIC_RECEIPT+"\\n");process.exitCode=1'],{stdio:['ignore','pipe','pipe'],env:{PUBLIC_RECEIPT:JSON.stringify(frame)}});
 await assert.rejects(runEntryPreflight(fixtureExpected,prior(),{spawnControl}),error=>error.publicEvidence.exitObserved===true&&error.publicEvidence.controllerExitCode===1&&error.publicEvidence.failureEvidence.resourceFailure.measurementsAvailable===false&&error.publicEvidence.failureEvidence.backendReasons[0].reason==='resource_metrics_unavailable');
});
