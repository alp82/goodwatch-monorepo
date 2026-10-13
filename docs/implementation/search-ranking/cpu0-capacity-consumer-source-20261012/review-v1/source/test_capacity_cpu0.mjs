// Pure ABI2 fixtures. These do not observe or authorize a host.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import * as contract from './compare-contract-cpu0.mjs';
import * as consumer from './consumer_cpu0.mjs';
import * as auditor from './audit_cpu0.mjs';
import {admission,prior,packet as oldFrames,expected as phaseFreeze} from './cpu0_consumer_fixture.mjs';
const GiB=1024**3,intent='1'.repeat(64);
function v2Admission(){return {...admission(),schema:'clone-birth-admission.cpu0-fixed.v2',variant:'cpu0-fixed-capacity.v2',admissionBasis:'frozen-max-lock-plus-reserve',observedPhase:'running-unheld',pinAdmission:false,strictGreaterThan:true,maxLockedBytes:2*GiB,reserveBytes:2*GiB,emergencyBytes:1.5*GiB,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:4*GiB+4096,hostMemAvailableFloorBytes:4*GiB,hostDirtyBytes:0,hostWritebackBytes:0};}
function v2Handoff(owner='adoption',previousSha256=null){const legacy=prior();const record={schema:'clone-lifecycle-handoff.cpu0.v2',owner,previousSha256,adoptionIntentSha256:intent,snapshot:{...legacy.snapshot,variant:'cpu0-fixed-capacity.v2'}};return {...record,sha256:contract.canonicalHash(record)};}
const allPackets=()=>Object.entries(consumer.V4_CASES).flatMap(([tag,flags])=>flags.map(lesserKnown=>({kind:'private-batch',tag,lesserKnown})));
function enrolmentFixture(context,source){
 const nodeIdentity={device:1,inode:2,size:126595440,mtimeNs:'1760270400000000001',ctimeNs:'1760270400000000002'};
 const row=(pid,parentPid)=>({identity:{pid,startTicks:99,parentPid,exeIdentityHash:'2'.repeat(64),groupHash:'3'.repeat(64),VmLckBytes:0,outsideSourceCgroup:true},metrics:{RssAnonBytes:4096,VmPTEBytes:4096}});
 const node=row(301,300);node.identity.exeIdentityHash=crypto.createHash('sha256').update(JSON.stringify([nodeIdentity.device,nodeIdentity.inode,nodeIdentity.size])).digest('hex');
 return {schema:'cpu0-consumer-enrolment.v2',variant:'cpu0-fixed-capacity.v2',...context,source,consumer:node,transportParent:row(300,1),preflight:row(302,301),consumerArgvHash:'4'.repeat(64),raiseOwnNofile:false,nodeIdentity,sharedControlIdentity:{device:1,inode:5},registeredBeforeEntrySample:true,productionAcceptance:false};
}
test('ABI2 running admission derives exact strict floor without reinterpreting v1',()=>{
 const sample=v2Admission();assert.equal(contract.admissionEvidenceV2(sample),sample);
 for(const available of [4*GiB-4096,4*GiB])assert.throws(()=>contract.admissionEvidenceV2({...sample,hostMemAvailableBytes:available}));
 for(const patch of [{hostMemAvailableFloorBytes:4*GiB-4096},{maxLockedBytes:2*GiB-4096},{reserveBytes:2*GiB-4096},{emergencyBytes:1.5*GiB-4096},{hostMemTotalBytes:null},{hostMemAvailableBytes:9*GiB},{observedPhase:'running-held'},{admissionBasis:'literal-floor'},{variant:'cpu0-owned-lifecycle.v1'},{schema:'clone-birth-admission.cpu0-owned.v1'}])assert.throws(()=>contract.admissionEvidenceV2({...sample,...patch}));
 assert.throws(()=>contract.admissionEvidenceV2(admission()));assert.throws(()=>contract.admissionEvidence(sample));
 assert.equal(sample.hostMemAvailableBytes,4*GiB+4096);
});
test('ABI2 retains source, swap, disk, host CPU and observed running fences',()=>{
 for(const mutate of [x=>x.target.state.running=false,x=>x.sourceIdentity[2]++,x=>x.hostSwapBytes=4096,x=>x.diskFreeBytes=x.diskFreeFloorBytes,x=>x.ownedAllocatedBytes=x.ownedAllocatedCeilingBytes,x=>x.hostCpu.load1=x.hostCpu.loadCeiling+1,x=>x.clientsClosed=false]){const value=v2Admission();mutate(value);assert.throws(()=>contract.admissionEvidenceV2(value));}
});
test('ABI2 adoption chain binds intent and exact predecessor at every ownership transfer',()=>{
 const initial=v2Handoff();assert.equal(contract.recordedHandoffV2(initial,initial.sha256,{adoptionIntentSha256:intent,previousSha256:null}),initial);
 for(const owner of ['preflight','stager','turnover','outer','controller']){const next=v2Handoff(owner,initial.sha256);assert.equal(contract.recordedHandoffV2(next,next.sha256,{adoptionIntentSha256:intent,previousSha256:initial.sha256}),next);}
 for(const patch of [{owner:'setup'},{adoptionIntentSha256:'2'.repeat(64)},{previousSha256:'3'.repeat(64)},{schema:'clone-lifecycle-handoff.cpu0.v1'}]){const {sha256,...record}=initial;Object.assign(record,patch);const value={...record,sha256:contract.canonicalHash(record)};assert.throws(()=>contract.recordedHandoffV2(value,value.sha256,{adoptionIntentSha256:intent,previousSha256:null}));}
 assert.throws(()=>contract.recordedHandoff(initial,initial.sha256));assert.throws(()=>contract.recordedHandoffV2(prior(),prior().sha256,{adoptionIntentSha256:intent,previousSha256:null}));
});
test('ABI2 requires all nine real batch slots and rejects exclusions or fewer cases',()=>{
 assert.equal(consumer.requireNineActualPacketSet(allPackets()).requiredPairs,9);
 const excluded=allPackets();excluded[5]={kind:'private-excluded',tag:'heldout-person'};assert.throws(()=>consumer.requireNineActualPacketSet(excluded));
 assert.throws(()=>consumer.requireNineActualPacketSet(allPackets().slice(1)));
 const duplicate=allPackets();duplicate[8]=duplicate[0];assert.throws(()=>consumer.requireNineActualPacketSet(duplicate));
});
test('ABI2 cannot pass incomplete pair accounting or a missing C6 ledger',()=>{
 assert.equal(contract.requireNineCompletedPairsV2({pairs:9,excluded:0}),true);
 for(const value of [{pairs:8,excluded:1},{pairs:8,excluded:0},{pairs:9,excluded:1},{pairs:10,excluded:0},{pairs:'9',excluded:0}])assert.throws(()=>contract.requireNineCompletedPairsV2(value));
 assert.throws(()=>contract.fixedCapacityOverheadEvidenceV2({}),/cpu0_fixed_overhead_growth_invalid/);
});
test('ABI2 query endpoints use actual fixed memory samples and inclusive emergency boundary',()=>{
 const sample={schema:'clone-host-memory.cpu0.v2',scope:'before-query',sampledAt:'2026-10-12T20:00:00Z',sampleMonotonicSeconds:25,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:1.5*GiB,hostDirtyBytes:4096,hostWritebackBytes:8192,hostSwapBytes:0,hostMemAvailableFloorBytes:1.5*GiB};
 assert.equal(contract.queryMemoryEvidenceV2(sample,'before-query'),sample);
 for(const patch of [{hostMemAvailableBytes:1.5*GiB-4096},{hostMemAvailableFloorBytes:1.5*GiB-4096},{hostMemAvailableBytes:null},{hostMemTotalBytes:0},{hostSwapBytes:4096},{scope:'after-query'},{sampleMonotonicSeconds:0},{sampledAt:null}])assert.throws(()=>contract.queryMemoryEvidenceV2({...sample,...patch},'before-query'));
 assert.throws(()=>contract.queryMemoryEvidenceV2({...sample,lateSample:true},'before-query'));
 assert.equal(sample.hostMemAvailableBytes,1.5*GiB);
});
test('ABI2 pre-capture admission binds actual source, intent and fresh preflight successor',()=>{
 const initial=v2Handoff(),next=v2Handoff('preflight',initial.sha256),sample=v2Admission();sample.target=initial.snapshot.newRunning;sample.sourceIdentity[2]=sample.target.qdrant.pid;sample.sourceIdentity[3]=sample.target.qdrant.startTicks;
 const context={adoptionIntentSha256:intent,sourceFreezeSha256:'4'.repeat(64),externalManifestSha256:'5'.repeat(64),helperCodeSha256:intent,helperPolicySha256:intent,controllerPolicySha256:intent,nodeProvenanceSha256:intent};
 const enrolment=enrolmentFixture({...context,consumerPredecessorSha256:initial.sha256},sample.target);
 const frame={kind:'consumer-admission',schema:'search.clone-cpu0-preflight.v2',variant:'cpu0-fixed-capacity.v2',birthAdmission:sample,handoff:next,sourceIdentity:sample.sourceIdentity,queries:0,resourceWrites:0,handoffWrites:1,modelsRead:0,consumerBirth:enrolment.consumer.identity,consumerEnrolment:enrolment,consumerEnrolmentSha256:contract.canonicalHash(enrolment),preflightExit:{observed:true,exitCode:0,signal:null,birthGone:true},sourceFreezeSha256:context.sourceFreezeSha256,externalManifestSha256:context.externalManifestSha256,productionAcceptance:false};
 assert.equal(contract.validateAdmissionFrameV2(frame,initial,context).receipt.handoff,next);
 for(const mutate of [x=>x.handoff=initial,x=>x.birthAdmission.hostMemAvailableBytes=4*GiB,x=>x.consumerBirth.groupHash=x.birthAdmission.target.qdrant.groupHash,x=>x.consumerBirth.VmLckBytes=4096,x=>x.schema='search.clone-cpu0-preflight.v1',x=>x.sourceFreezeSha256='6'.repeat(64),x=>x.queries=1,x=>delete x.consumerEnrolment,x=>x.consumerEnrolmentSha256='7'.repeat(64),x=>x.preflightExit.birthGone=null,x=>x.preflightExit.exitCode=1,x=>x.preflightExit.signal='SIGTERM',x=>x.consumerBirth={...x.consumerBirth,startTicks:100}]){const value=structuredClone(frame);mutate(value);assert.throws(()=>contract.validateAdmissionFrameV2(value,initial,context));}
 assert.throws(()=>contract.validateAdmissionFrameV2(frame,initial,{...context,adoptionIntentSha256:'7'.repeat(64)}));
});
test('ABI2 stopped admission keeps strict five-GiB boundary and distinct basis',()=>{
 const sample={schema:'clone-stopped-headroom.cpu0.v2',admissionBasis:'unchanged-prestart-five-gib',observedPhase:'stopped',pinAdmission:false,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:5*GiB+4096,hostMemAvailableFloorBytes:5*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,strictGreaterThan:true};
 assert.equal(contract.stoppedAdmissionEvidenceV2(sample),sample);
 for(const patch of [{hostMemAvailableBytes:5*GiB},{hostMemAvailableBytes:5*GiB-4096},{hostMemAvailableFloorBytes:4*GiB},{observedPhase:'running-unheld'},{hostSwapBytes:4096}])assert.throws(()=>contract.stoppedAdmissionEvidenceV2({...sample,...patch}));
});
test('ABI2 numeric refusal preserves the low same-read value rather than accepting a later passing sample',()=>{
 const {schema,variant,at,sourceIdentity,target,hostCpu,ownedAllocatedBytes,ownedAllocatedCeilingBytes,diskFreeBytes,diskFreeFloorBytes,cpuHierarchy,pointCount,segmentCount,shardCount,clientsClosed,...measured}=v2Admission();
 const sample={schema:'clone-running-headroom.cpu0-fixed.v2',...measured,hostMemAvailableBytes:4*GiB};
 const failure={reason:'host_emergency_floor',admissionFailureEvidence:sample};
 assert.equal(contract.fixedCapacityRefusalEvidenceV2(failure).admissionFailureEvidence.hostMemAvailableBytes,4*GiB);
 for(const patch of [{hostMemAvailableBytes:4*GiB+4096},{hostMemAvailableBytes:null},{hostMemTotalBytes:0},{hostMemAvailableFloorBytes:4*GiB-4096}])assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({...failure,admissionFailureEvidence:{...sample,...patch}}));
 assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({reason:'raw private error',admissionFailureEvidence:sample}));
});
test('ABI2 query refusal preserves actual emergency read and rejects equality as a refusal',()=>{
 const proof={schema:'clone-host-memory.cpu0.v2',scope:'after-query',sampledAt:'2026-10-12T20:00:00Z',sampleMonotonicSeconds:25,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:1.5*GiB-4096,hostDirtyBytes:4096,hostWritebackBytes:8192,hostSwapBytes:0,hostMemAvailableFloorBytes:1.5*GiB};
 const frame={reason:'host_emergency_floor',queryMemoryFailureEvidence:proof};
 assert.equal(contract.fixedCapacityRefusalEvidenceV2(frame),frame);
 for(const patch of [{hostMemAvailableBytes:1.5*GiB},{sampledAt:null},{hostMemTotalBytes:0},{hostMemAvailableFloorBytes:4*GiB}])assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({...frame,queryMemoryFailureEvidence:{...proof,...patch}}));
 assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({...frame,admissionFailureEvidence:{}}));
});
test('ABI2 query endpoint pair is ordered within the actual ready and finished frames',()=>{
 const before={schema:'clone-host-memory.cpu0.v2',scope:'before-query',sampledAt:'2026-10-12T20:00:00Z',sampleMonotonicSeconds:25,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:2*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,hostMemAvailableFloorBytes:1.5*GiB};
 const after={...before,scope:'after-query',sampledAt:'2026-10-12T20:00:02Z',sampleMonotonicSeconds:27};
 const context={readyAt:'2026-10-12T20:00:01Z',finishedAt:'2026-10-12T20:00:03Z'};
 assert.equal(contract.queryMemoryPairEvidenceV2(before,after,context).before,before);
 for(const patch of [{sampledAt:'2026-10-12T19:59:59Z'},{sampledAt:'2026-10-12T20:00:04Z'},{sampleMonotonicSeconds:24},{hostMemTotalBytes:9*GiB},{hostMemAvailableBytes:1.5*GiB-4096}])assert.throws(()=>contract.queryMemoryPairEvidenceV2(before,{...after,...patch},context));
 assert.throws(()=>contract.queryMemoryPairEvidenceV2({...before,sampledAt:'2026-10-12T20:00:02Z'},after,context));
});
test('ABI2 offline accounting requires nine actual baseline/candidate rows, not a reported count',()=>{
 const meta={variant:'cpu0-fixed-capacity.v2',productionAcceptance:false};
 const rows=[{kind:'consumer-admission',...meta},...allPackets().flatMap(({tag,lesserKnown})=>[{kind:'baseline-batch',tag,lesserKnown,...meta},{kind:'paired-batch',tag,lesserKnown,...meta}]),{kind:'complete',pairs:9,excluded:0,...meta}];
 assert.equal(auditor.fixedCapacityRowAccountingV2(rows).pairs,9);
 for(const mutate of [x=>x.splice(1,2),x=>x[2].kind='excluded',x=>x[2].tag='unknown',x=>{for(const i of [3,4]){x[i].tag=x[1].tag;x[i].lesserKnown=x[1].lesserKnown;}},x=>x.at(-1).pairs=8,x=>x.at(-1).excluded=1,x=>delete x.at(-1).excluded,x=>x[1].variant='cpu0-owned-lifecycle.v1',x=>x[2].lesserKnown=!x[1].lesserKnown]){const value=structuredClone(rows);mutate(value);assert.throws(()=>auditor.fixedCapacityRowAccountingV2(value));}
});
test('ABI2 selected working-set guard debits the full selection with the original inclusive reserve boundary',()=>{
 const selected=GiB,resident=GiB/2;
 const sample={schema:'clone-working-set-admission.cpu0.v2',observedPhase:'running-unheld',admissionBasis:'full-selected-lock-debit-plus-reserve',selectionHash:'2'.repeat(64),selectedBytes:selected,selectedResidentBytes:resident,selectedMissingBytes:selected-resident,maxLockedBytes:2*GiB,reserveBytes:2*GiB,hostMemAvailableFloorBytes:selected+2*GiB,hostMemAvailableBytes:selected+2*GiB,hostMemTotalBytes:8*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,sampledAt:'2026-10-12T20:00:00Z',sampleMonotonicSeconds:25,greaterThanOrEqual:true};
 assert.equal(contract.workingSetAdmissionEvidenceV2(sample,{selectionHash:sample.selectionHash,selectedBytes:selected}),sample);
 for(const patch of [{hostMemAvailableBytes:sample.hostMemAvailableBytes-1},{hostMemAvailableFloorBytes:resident+2*GiB},{selectedMissingBytes:selected},{selectedBytes:2*GiB+1},{selectedResidentBytes:selected+1},{greaterThanOrEqual:false},{hostSwapBytes:4096},{selectionHash:'3'.repeat(64)},{observedPhase:'running-held'},{sampleMonotonicSeconds:null}])assert.throws(()=>contract.workingSetAdmissionEvidenceV2({...sample,...patch},{selectionHash:sample.selectionHash,selectedBytes:selected}));
 assert.throws(()=>contract.workingSetAdmissionEvidenceV2(sample,{selectionHash:sample.selectionHash,selectedBytes:resident}));
 const low={reason:'projected_headroom_below_reserve',workingSetFailureEvidence:{...sample,hostMemAvailableBytes:sample.hostMemAvailableBytes-1}};
 assert.equal(contract.fixedCapacityRefusalEvidenceV2(low),low);
 assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({reason:low.reason,workingSetFailureEvidence:sample}));
 const cap={reason:'initial_cap_fit_inconclusive',workingSetFailureEvidence:{...sample,sourceCurrentBytes:6*GiB,sourceCapBytes:6*GiB,capReserveBytes:256*1024**2}};
 assert.equal(contract.fixedCapacityRefusalEvidenceV2(cap),cap);
 assert.equal(contract.fixedCapacityRefusalEvidenceV2({reason:cap.reason,workingSetFailureEvidence:{...cap.workingSetFailureEvidence,sourceCapBytes:null}}).workingSetFailureEvidence.sourceCapBytes,null);
 for(const patch of [{sourceCurrentBytes:GiB},{sourceCapBytes:0},{capReserveBytes:0},{sourceCurrentBytes:null}])assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({reason:cap.reason,workingSetFailureEvidence:{...cap.workingSetFailureEvidence,...patch}}));
});
test('ABI2 archive failure keeps actual emergency sample with its distinct phase scope',()=>{
 const proof={schema:'clone-pressure-memory.cpu0.v2',scope:'archive-verification',sampledAt:'2026-10-12T20:00:00Z',sampleMonotonicSeconds:25,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:1.5*GiB-4096,hostMemAvailableFloorBytes:1.5*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0};
 for(const scope of ['archive-verification','archive-pressure']){const evidence={reason:'host_emergency_floor',pressureMemoryFailureEvidence:{...proof,scope}};assert.equal(contract.fixedCapacityRefusalEvidenceV2(evidence),evidence);}
 const changedSwap={reason:'host_emergency_floor',pressureMemoryFailureEvidence:{...proof,hostSwapBytes:4096}};assert.equal(contract.fixedCapacityRefusalEvidenceV2(changedSwap).pressureMemoryFailureEvidence.hostSwapBytes,4096);
 for(const patch of [{scope:'before-query'},{hostMemAvailableBytes:1.5*GiB},{hostMemAvailableFloorBytes:4*GiB},{hostMemTotalBytes:null},{sampledAt:null},{hostSwapBytes:null}])assert.throws(()=>contract.fixedCapacityRefusalEvidenceV2({reason:'host_emergency_floor',pressureMemoryFailureEvidence:{...proof,...patch}}));
});
test('ABI2 enrolment binds immutable births separately from endpoint metrics and exact nanosecond strings',()=>{
 const names=['sourceFreezeSha256','externalManifestSha256','helperCodeSha256','helperPolicySha256','controllerPolicySha256','adoptionIntentSha256','consumerPredecessorSha256','nodeProvenanceSha256'];
 const expected=Object.fromEntries(names.map(name=>[name,intent]));expected.source=admission().target;
 const nodeIdentity={device:1,inode:2,size:126595440,mtimeNs:'1760270400000000001',ctimeNs:'1760270400000000002'};
 const exe=crypto.createHash('sha256').update(JSON.stringify([nodeIdentity.device,nodeIdentity.inode,nodeIdentity.size])).digest('hex');
 const row=(pid,parentPid)=>({identity:{pid,startTicks:99,parentPid,exeIdentityHash:'2'.repeat(64),groupHash:'3'.repeat(64),VmLckBytes:0,outsideSourceCgroup:true},metrics:{RssAnonBytes:4096,VmPTEBytes:4096}});
 const consumer=row(301,300);consumer.identity.exeIdentityHash=exe;
 const value={schema:'cpu0-consumer-enrolment.v2',variant:'cpu0-fixed-capacity.v2',...Object.fromEntries(names.map(name=>[name,intent])),source:expected.source,consumer,transportParent:row(300,1),preflight:row(302,301),consumerArgvHash:'4'.repeat(64),raiseOwnNofile:false,nodeIdentity,sharedControlIdentity:{device:1,inode:5},registeredBeforeEntrySample:true,productionAcceptance:false};
 assert.equal(contract.consumerEnrolmentEvidenceV2(value,expected),value);
 for(const mutate of [x=>x.consumer.identity.parentPid=1,x=>x.preflight.identity.parentPid=300,x=>x.consumer.identity.VmLckBytes=4096,x=>x.transportParent.identity.groupHash=x.source.qdrant.groupHash,x=>x.nodeIdentity.mtimeNs=1760270400000000001,x=>x.nodeIdentity.ctimeNs='01',x=>x.consumer.metrics.RssAnonBytes=null,x=>x.variant='cpu0-owned-lifecycle.v2',x=>x.adoptionIntentSha256='5'.repeat(64),x=>x.registeredBeforeEntrySample=false,x=>x.consumer.identity.pid=x.source.qdrant.pid]){const changed=structuredClone(value);mutate(changed);assert.throws(()=>contract.consumerEnrolmentEvidenceV2(changed,expected));}
});
test('ABI2 full-stage closure uses exact new schemas and preserves immutable core and policy bytes',()=>{
 const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),json=value=>Buffer.from(JSON.stringify(value)+'\n');
 const files=Object.fromEntries(contract.FULL_NAMES.filter(name=>!['cpu0-source-freeze.json','helper-config.json','controller-config.json'].includes(name)).map(name=>[name,readFileSync(new URL(name==='prepare_clone_reclaim.py'?'../clone-preparation/'+name:name,import.meta.url))]));
 const control=JSON.parse(files['prepared-control-policy-cpu0.json']);control.schema='clone-pin-control.cpu0-fixed.v2';files['prepared-control-policy-cpu0.json']=json(control);
 const source={schema:'search.clone-cpu0-fixed-source-freeze.v2',variant:'cpu0-fixed-capacity.v2',preparedOnly:true,files:Object.fromEntries(contract.CPU0_SOURCE_FILES.map(name=>[name,sha(files[name])]))};
 files['cpu0-source-freeze.json']=json(source);files['helper-config.json']=files['prepared-helper-policy-cpu0.json'];files['controller-config.json']=files['prepared-control-policy-cpu0.json'];
 const full={schema:'cpu0-full-public-packet.v7',variant:'cpu0-fixed-capacity.v2',sourceFreezeSha256:sha(files['cpu0-source-freeze.json']),files:Object.fromEntries(contract.FULL_NAMES.map(name=>[name,sha(files[name])]))};
 const raw=json(full),read=name=>files[name];assert.equal(contract.verifyExternalPacketV2(raw,sha(raw),read).expected.helperCodeSha256,contract.CPU0_CORE_SHA256);
 for(const patch of [{schema:'cpu0-full-public-packet.v6'},{variant:'cpu0-owned-lifecycle.v1'},{preparedOnly:true},{sourceFreezeSha256:intent},{files:{...full.files,node:intent}}]){const bad=json({...full,...patch});assert.throws(()=>contract.verifyExternalPacketV2(bad,sha(bad),read));}
 assert.throws(()=>contract.verifyExternalPacket(raw,sha(raw),read));
 for(const patch of [{schema:'search.clone-cpu0-owned-source-freeze.v1'},{variant:'cpu0-owned-lifecycle.v1'},{oldFilesChanged:false},{preparedOnly:false},{files:{...source.files,sidecar:intent}}]){const bad=json({...source,...patch});assert.throws(()=>contract.verifyCpu0FreezeV2(bad,sha(bad),read));}
 const changed={...files,'pin_cpu0.py':Buffer.concat([files['pin_cpu0.py'],Buffer.from('\n# drift\n')])};const drift=json({...source,files:{...source.files,'pin_cpu0.py':sha(changed['pin_cpu0.py'])}});assert.throws(()=>contract.verifyCpu0FreezeV2(drift,sha(drift),name=>changed[name]));
 assert.throws(()=>contract.verifyExternalPacketV2(raw,sha(raw),name=>name==='helper-config.json'?Buffer.from('{}'):files[name]));
});
test('ABI2 actual direct preflight child birth and close are required independently from its receipt',async()=>{
 // Source/placement interfaces are public stand-ins. Only this owned child's
 // actual Linux birth, parent relation, close event and disappearance are tested.
 const initial=v2Handoff(),sample=v2Admission();sample.target=initial.snapshot.newRunning;sample.sourceIdentity[2]=sample.target.qdrant.pid;sample.sourceIdentity[3]=sample.target.qdrant.startTicks;
 const expected={adoptionIntentSha256:intent,sourceFreezeSha256:intent,externalManifestSha256:intent,helperCodeSha256:intent,helperPolicySha256:intent,controllerPolicySha256:intent,nodeProvenanceSha256:intent};
 const enrolment=enrolmentFixture({...expected,consumerPredecessorSha256:initial.sha256},sample.target);enrolment.consumer.identity.pid=process.pid;enrolment.consumer.identity.parentPid=process.ppid;enrolment.transportParent.identity.pid=process.ppid;enrolment.preflight.identity.parentPid=process.pid;
 const value={schema:'search.clone-cpu0-preflight.v2',variant:'cpu0-fixed-capacity.v2',birthAdmission:sample,handoff:v2Handoff('preflight',initial.sha256),sourceIdentity:sample.sourceIdentity,queries:0,resourceWrites:0,handoffWrites:1,modelsRead:0,consumerEnrolment:enrolment,consumerEnrolmentSha256:intent};
 const measured={schema:'clone-running-headroom.cpu0-fixed.v2',admissionBasis:'frozen-max-lock-plus-reserve',observedPhase:'running-unheld',pinAdmission:false,maxLockedBytes:2*GiB,reserveBytes:2*GiB,emergencyBytes:1.5*GiB,hostMemAvailableBytes:4*GiB,hostMemTotalBytes:8*GiB,hostMemAvailableFloorBytes:4*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,strictGreaterThan:true};
 const launch=(mode='clean')=>(command,args,options)=>{
  assert.equal(command,'/usr/bin/python3');assert.equal(args.length,9);assert.equal(args.at(-1),initial.sha256);assert.deepEqual(options.env,consumer.CONTROL_ENV);
  const failed=`v={'schema':'search.clone-cpu0-preflight.v2','stage':'failed','reason':'host_emergency_floor','consumerEnrolmentFailureEvidence':{'schema':'cpu0-consumer-enrolment-failure.v2','publicationState':'published-verified','expectedReceiptSha256':v['consumerEnrolmentSha256'],'consumerEnrolment':v['consumerEnrolment'],'cleanupAddressableByFixedReceipt':True,'continuationAllowed':False},'admissionFailureEvidence':json.loads(${JSON.stringify(JSON.stringify(measured))}),'queries':0,'resourceWrites':0,'rawPrivateError':'secret-query-value'}`;
  const script=`import json,os,hashlib,sys,signal\nv=json.loads(${JSON.stringify(JSON.stringify(value))})\nx=v['consumerEnrolment']['preflight']['identity']\nf=open('/proc/self/stat').read().rsplit(')',1)[1].split()\nx['pid']=os.getpid();x['startTicks']=int(f[19]);x['parentPid']=os.getppid()\n${mode==='wrong-birth'?"x['startTicks']+=1":""}\nv['consumerEnrolmentSha256']=hashlib.sha256((json.dumps(v['consumerEnrolment'],sort_keys=True,separators=(',',':'))+'\\n').encode()).hexdigest()\n${mode==='enrolled-failure'?failed:''}\nprint(json.dumps(v),flush=True)\n${mode==='signal'?"os.kill(os.getpid(),signal.SIGTERM)":`sys.exit(${['nonzero','enrolled-failure'].includes(mode)?1:0})`}\n`;
  return spawn(command,['-I','-B','-c',script],options);
 };
 const result=await consumer.runEntryPreflightV2(expected,initial,{spawnControl:launch()});assert.deepEqual(result.preflightExit,{observed:true,exitCode:0,signal:null,birthGone:true});
 for(const mode of ['wrong-birth','nonzero','signal'])await assert.rejects(consumer.runEntryPreflightV2(expected,initial,{spawnControl:launch(mode)}),error=>{assert.equal(error.publicEvidence.handoffAccepted,false);assert.equal(error.publicEvidence.preflightExit.observed,true);assert.equal(error.publicEvidence.preflightExit.birthGone,true);if(mode==='nonzero')assert.equal(error.publicEvidence.preflightExit.exitCode,1);if(mode==='signal')assert.equal(error.publicEvidence.preflightExit.signal,'SIGTERM');return true;});
 await assert.rejects(consumer.runEntryPreflightV2(expected,initial,{spawnControl:launch(),procRoot:new URL('./absent-fixture-proc',import.meta.url).pathname}),error=>{assert.deepEqual(error.publicEvidence.preflightExit,{observed:true,exitCode:0,signal:null,birthGone:null});assert.equal(error.publicEvidence.handoffAccepted,false);return true;});
 await assert.rejects(consumer.runEntryPreflightV2(expected,initial,{spawnControl:launch('enrolled-failure')}),error=>{const evidence=error.publicEvidence.failureEvidence;assert.equal(evidence.evidenceRejected,false);assert.equal(evidence.consumerEnrolmentFailure.publicationState,'published-verified');assert.equal(evidence.consumerEnrolmentFailure.continuationAllowed,false);assert.equal(evidence.measuredFailures[0].proof.hostMemAvailableBytes,4*GiB);assert.deepEqual(evidence.backendReasons,[{stage:'failed',reason:'host_emergency_floor'}]);assert.equal(JSON.stringify(error.publicEvidence).includes('secret-query-value'),false);assert.equal(error.publicEvidence.handoffAccepted,false);return true;});
});
test('ABI2 executable invocation requires the exact explicit selector and fixed SHA argument order',()=>{
 const args=[consumer.FIXED_CAPACITY_SELECTOR,'--handoff-sha256',intent,'--cpu0-source-freeze-sha256','2'.repeat(64),'--external-manifest-sha256','3'.repeat(64)];
 assert.equal(consumer.fixedCapacityArguments(args).raiseOwnNofile,false);assert.equal(consumer.fixedCapacityArguments([...args,'--raise-own-nofile']).raiseOwnNofile,true);
 for(const changed of [['--execute-reviewed',...args.slice(1)],[...args,'--variant','cpu0-fixed-capacity.v2'],[args[0],...args.slice(3,5),...args.slice(1,3),...args.slice(5)],[...args.slice(0,3),'--raise-own-nofile',...args.slice(3)],args.slice(0,-1),[...args,'--raise-own-nofile','--raise-own-nofile']])assert.throws(()=>consumer.fixedCapacityArguments(changed));
});

function overheadFixture(){
 const source=v2Admission(),context={sourceFreezeSha256:intent,externalManifestSha256:intent,helperCodeSha256:intent,helperPolicySha256:intent,controllerPolicySha256:intent,adoptionIntentSha256:intent,consumerPredecessorSha256:intent,nodeProvenanceSha256:intent};
 const enrolled=enrolmentFixture(context,source.target),own={identity:{...enrolled.preflight.identity,pid:303,parentPid:301},metrics:{RssAnonBytes:8192,VmPTEBytes:4096}};
 const inspector={ownerPid:303,ownerStartTicks:99,runtimeDockerCalls:2,totalElapsedSeconds:.02,maxElapsedSeconds:.01,callTimeoutSeconds:5,parentOnly:true,unsampledPeakBytes:null,liveUnregisteredDirectChildren:0};
 const baseline={schema:'clone-overhead-endpoint.cpu0.v2',sourceIdentity:source.sourceIdentity,source:{anonBytes:10000,kernelBytes:8000,pageTablesBytes:4000},outside:{consumer:enrolled.consumer,transportParent:enrolled.transportParent},sourceHelper:null,consumerEnrolmentSha256:contract.canonicalHash(enrolled),consumerRegistrationSha256:'7'.repeat(64),inspector,sampledAt:'2026-10-12T20:00:00Z',sampleMonotonicSeconds:25};
 const current=structuredClone(baseline);current.source={anonBytes:14096,kernelBytes:10048,pageTablesBytes:5024};current.outside.controller=own;current.outside.consumer.metrics.RssAnonBytes-=1024;current.inspector.runtimeDockerCalls=3;current.inspector.totalElapsedSeconds=.03;current.sampledAt='2026-10-12T20:00:01Z';current.sampleMonotonicSeconds=26;
 const ledger={schema:'clone-overhead-growth.cpu0.v2',baseline,current,sourceDelta:{anonBytes:4096,kernelBytes:2048,pageTablesBytes:1024},outsideDelta:{consumer:{RssAnonBytes:-1024,VmPTEBytes:0},transportParent:{RssAnonBytes:0,VmPTEBytes:0},controller:{RssAnonBytes:8192,VmPTEBytes:4096}},newOutsideRoles:['controller'],retiredOutsideRoles:[],chargedGrowthBytes:18432,growthAllowanceBytes:512*1024**2,pageTablesIncludedInKernel:true,fileRssCredited:false,exclusiveMemorySum:false,unsampledPeakBytes:null};
 return {ledger,expected:{sourceIdentity:source.sourceIdentity,sourceGroupHash:source.target.qdrant.groupHash,consumerEnrolment:enrolled,consumerEnrolmentSha256:baseline.consumerEnrolmentSha256}};
}
test('ABI2 overhead charges fresh controller fully, positive classes only, and page tables once',()=>{
 const {ledger,expected}=overheadFixture();assert.equal(contract.fixedCapacityOverheadEvidenceV2(ledger,expected),ledger);
 for(const mutate of [x=>x.chargedGrowthBytes-=1024,x=>x.chargedGrowthBytes+=1024,x=>x.outsideDelta.controller.RssAnonBytes=0,x=>x.newOutsideRoles=[],x=>x.current.consumerRegistrationSha256='8'.repeat(64),x=>x.current.sourceIdentity[3]++,x=>x.current.outside.consumer.identity.startTicks++,x=>x.baseline.outside.consumer.metrics.RssAnonBytes++,x=>x.current.inspector.ownerPid++,x=>x.current.inspector.liveUnregisteredDirectChildren=1,x=>x.current.inspector.runtimeDockerCalls=1]){
  const copy=structuredClone(ledger);mutate(copy);assert.throws(()=>contract.fixedCapacityOverheadEvidenceV2(copy,expected));
 }
 assert.throws(()=>contract.fixedCapacityOverheadEvidenceV2(ledger,{...expected,consumerEnrolmentSha256:'8'.repeat(64)}));
});
test('ABI2 overhead enforces inclusive 512MiB and retains exceeded arithmetic only as failure',()=>{
 const {ledger,expected}=overheadFixture();const fixed=ledger.chargedGrowthBytes-ledger.current.outside.controller.metrics.RssAnonBytes;
 ledger.current.outside.controller.metrics.RssAnonBytes=512*1024**2-fixed;ledger.outsideDelta.controller.RssAnonBytes=ledger.current.outside.controller.metrics.RssAnonBytes;ledger.chargedGrowthBytes=512*1024**2;
 assert.equal(contract.fixedCapacityOverheadEvidenceV2(ledger,expected),ledger);
 ledger.current.outside.controller.metrics.RssAnonBytes++;ledger.outsideDelta.controller.RssAnonBytes++;ledger.chargedGrowthBytes++;
 assert.throws(()=>contract.fixedCapacityOverheadEvidenceV2(ledger,expected));
 assert.equal(contract.fixedCapacityOverheadEvidenceV2(ledger,expected,{allowExceeded:true}),ledger);
});
test('ABI2 overhead reports joined helper without adding its source-accounted memory twice',()=>{
 const {ledger,expected}=overheadFixture();ledger.current.sourceHelper={identity:{...ledger.current.outside.controller.identity,pid:304,parentPid:303,groupHash:expected.sourceGroupHash,VmLckBytes:GiB,outsideSourceCgroup:false},metrics:{RssAnonBytes:GiB,VmPTEBytes:4096},preJoinChargeUnattributed:true,chargedSeparately:false};
 assert.equal(contract.fixedCapacityOverheadEvidenceV2(ledger,expected),ledger);
 for(const patch of [{chargedSeparately:true},{preJoinChargeUnattributed:false}])assert.throws(()=>contract.fixedCapacityOverheadEvidenceV2({...ledger,current:{...ledger.current,sourceHelper:{...ledger.current.sourceHelper,...patch}}},expected));
});

function phaseFixtureV2(phase='baseline'){
 const frames=oldFrames(phase),previous=v2Handoff('preflight','9'.repeat(64));
 const initial={...v2Admission(),target:previous.snapshot.newRunning};initial.sourceIdentity[2]=initial.target.qdrant.pid;initial.sourceIdentity[3]=initial.target.qdrant.startTicks;
 const convert=value=>({...value,...Object.fromEntries(Object.entries(v2Admission()).filter(([key])=>!['target','sourceIdentity','hostCpu','cpuHierarchy','at'].includes(key)))});
 const ready=frames[2];ready.initialAdmission=initial;ready.birthAdmission=convert(ready.birthAdmission);ready.cold.birthAdmission=ready.birthAdmission;ready.cold.cleanStop.before=initial.target;ready.cold.cleanStop.after={...initial.target.state,running:false,finishedAt:frames[2].at};
 ready.cold.stoppedAdmission={schema:'clone-stopped-headroom.cpu0.v2',admissionBasis:'unchanged-prestart-five-gib',observedPhase:'stopped',pinAdmission:false,hostMemAvailableBytes:5*GiB+4096,hostMemTotalBytes:8*GiB,hostMemAvailableFloorBytes:5*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,strictGreaterThan:true};
 for(const frame of frames){frame.schema='search.clone-mlock-control.v3';frame.variant='cpu0-fixed-capacity.v2';}
 const next={schema:'clone-lifecycle-handoff.cpu0.v2',owner:'controller',previousSha256:previous.sha256,snapshot:{...previous.snapshot,newRunning:ready.birthAdmission.target},adoptionIntentSha256:intent};frames[4].handoff={...next,sha256:contract.canonicalHash(next)};
 const {ledger,expected}=overheadFixture();const context={...expected,adoptionIntentSha256:intent};
 function growth(sourceIdentity){const value=structuredClone(ledger);for(const endpoint of [value.baseline,value.current]){endpoint.sourceIdentity=sourceIdentity;endpoint.sampledAt=ready.at;endpoint.sampleMonotonicSeconds=25;}return value;}
 ready.entryOverheadEvidence=growth(initial.sourceIdentity);frames[0].overheadEvidence=growth(ready.birthAdmission.sourceIdentity);ready.overheadEvidence=growth(ready.birthAdmission.sourceIdentity);frames[3].overheadEvidence=growth(ready.birthAdmission.sourceIdentity);
 frames[0].cachePreparation.measurement.pageBytes=4096;frames[0].cachePreparation.measurement.classesMeasured=Object.fromEntries(['vector','graph','sparse','other'].map(kind=>[kind,{dataPages:GiB/4096/4}]));frames[0].cachePreparation.measurement.classesMeasured.payload={dataPages:2*GiB/4096};
 const memory={schema:'clone-host-memory.cpu0.v2',scope:'before-query',sampledAt:ready.at,sampleMonotonicSeconds:25,hostMemTotalBytes:8*GiB,hostMemAvailableBytes:2*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,hostMemAvailableFloorBytes:1.5*GiB};ready.queryMemoryBefore=memory;frames[3].queryMemoryAfter={...memory,scope:'after-query'};
 frames[0].workingSetAdmission={schema:'clone-working-set-admission.cpu0.v2',observedPhase:'running-unheld',admissionBasis:'full-selected-lock-debit-plus-reserve',selectionHash:ready.selectionHash,selectedBytes:GiB,selectedResidentBytes:GiB,selectedMissingBytes:0,maxLockedBytes:2*GiB,reserveBytes:2*GiB,hostMemAvailableFloorBytes:3*GiB,hostMemAvailableBytes:4*GiB,hostMemTotalBytes:8*GiB,hostDirtyBytes:0,hostWritebackBytes:0,hostSwapBytes:0,sampledAt:ready.at,sampleMonotonicSeconds:25,greaterThanOrEqual:true};
 if(phase==='candidate')for(const state of [ready.initialPinState,ready.pinState,frames[3].pinStateAfterQuery]){state.lockedBytes=GiB;state.lockedResidency=Object.fromEntries(['vector','graph','sparse','other'].map(kind=>[kind,{lockedDataPages:GiB/4096/4,residentLockedDataPages:GiB/4096/4}]));}
 return {frames,previous,context};
}
test('ABI2 complete phase validates actual new measurements before unchanged numeric latency gates',()=>{
 for(const phase of ['baseline','candidate']){
  const {frames,previous,context}=phaseFixtureV2(phase),batch={serverMs:phase==='baseline'?1600:100,wallMs:phase==='baseline'?1700:110,socketClosed:true};
  const options={context,requireRed:phase==='baseline',priorHandoff:previous,priorHandoffSha256:previous.sha256};
  assert.equal(contract.phaseEvidenceV2(frames,0,phase,phaseFreeze,batch,options).variant,'cpu0-fixed-capacity.v2');
  for(const mutate of [x=>x[2].birthAdmission.hostMemAvailableBytes=4*GiB,x=>x[2].cold.stoppedAdmission.hostMemAvailableBytes=5*GiB,x=>x[3].queryMemoryAfter.hostMemAvailableBytes=1.5*GiB-4096,x=>x[2].overheadEvidence.chargedGrowthBytes=0,x=>x[3].overheadEvidence.current.consumerRegistrationSha256='8'.repeat(64),x=>delete x[2].entryOverheadEvidence,x=>x[3].overheadEvidence.current.sampledAt='2026-10-12T23:59:00Z',x=>x[0].workingSetAdmission.hostMemAvailableBytes=3*GiB-4096]){const copy=structuredClone(frames);mutate(copy);assert.throws(()=>contract.phaseEvidenceV2(copy,0,phase,phaseFreeze,batch,options));}
  if(phase==='candidate'){const missing=structuredClone(frames);missing[2].pinState.lockedBytes-=4096;assert.throws(()=>contract.phaseEvidenceV2(missing,0,phase,phaseFreeze,batch,options));}
  if(phase==='candidate')for(const patch of [{serverMs:1500},{wallMs:1500}])assert.throws(()=>contract.phaseEvidenceV2(frames,0,phase,phaseFreeze,{...batch,...patch},options));
 }
});

test('ABI2 actual owned controller pipe validates C6 before query and retains full release order',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'gw-capacity-pipe-'));try{
 const {frames,previous,context}=phaseFixtureV2('baseline'),code=join(dir,'control.py'),config=join(dir,'config.json');writeFileSync(code,'public fixture');writeFileSync(config,'{}');
 const expected={...phaseFreeze,controllerCodeSha256:crypto.createHash('sha256').update(readFileSync(code)).digest('hex'),controllerPolicySha256:crypto.createHash('sha256').update(readFileSync(config)).digest('hex')};for(const frame of frames)Object.assign(frame,expected);
 const harness=join(dir,'fixture.mjs');writeFileSync(harness,`import readline from 'node:readline';const frames=${JSON.stringify(frames)};for(const frame of frames.slice(0,3))console.log(JSON.stringify(frame));for await(const line of readline.createInterface({input:process.stdin})){if(JSON.parse(line).stage!=='query-finished')process.exit(2);for(const frame of frames.slice(3))console.log(JSON.stringify(frame));break;}`);
 let queried=0;const result=await consumer.controlledBatchV2({tag:'control-native-title'},'baseline',expected,{code,config},previous,async()=>{queried++;return {serverMs:1600,wallMs:1700,socketClosed:true,results:[[]]};},{context,spawnControl:()=>spawn(process.execPath,[harness],{stdio:['pipe','pipe','pipe']}),budgets:{ready:5000,cleanup:15000,reaped:5000}});
 assert.equal(queried,1);assert.equal(result.metrics.variant,'cpu0-fixed-capacity.v2');assert.equal(result.controllerExit.code,0);assert.equal(result.frames.length,7);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('ABI2 composed nine-pair output is independently audited and refuses missing C6 or exclusions',()=>{
 const initial=v2Handoff('adoption'),context={...phaseFreeze,sourceFreezeSha256:'4'.repeat(64),externalManifestSha256:'5'.repeat(64),adoptionIntentSha256:intent,nodeProvenanceSha256:intent};
 const {controllerCodeSha256:unused,...enrolmentContext}=context;const enrolled=enrolmentFixture({...enrolmentContext,consumerPredecessorSha256:initial.sha256},initial.snapshot.newRunning),enrolledSha=contract.canonicalHash(enrolled);
 const entry=v2Admission();entry.target=initial.snapshot.newRunning;entry.sourceIdentity[2]=entry.target.qdrant.pid;entry.sourceIdentity[3]=entry.target.qdrant.startTicks;
 const preflightRecord={...initial,owner:'preflight',previousSha256:initial.sha256};delete preflightRecord.sha256;const preflight={...preflightRecord,sha256:contract.canonicalHash(preflightRecord)};
 const admissionFrame={kind:'consumer-admission',schema:'search.clone-cpu0-preflight.v2',variant:'cpu0-fixed-capacity.v2',birthAdmission:entry,handoff:preflight,sourceIdentity:entry.sourceIdentity,queries:0,resourceWrites:0,handoffWrites:1,modelsRead:0,consumerBirth:enrolled.consumer.identity,consumerEnrolment:enrolled,consumerEnrolmentSha256:enrolledSha,preflightExit:{observed:true,exitCode:0,signal:null,birthGone:true},sourceFreezeSha256:context.sourceFreezeSha256,externalManifestSha256:context.externalManifestSha256,productionAcceptance:false};
 const rows=[admissionFrame];let previous=preflight,pid=500;
 const proofContext={...context,consumerEnrolment:enrolled,consumerEnrolmentSha256:enrolledSha};
 function run(phase){
  const {frames}=phaseFixtureV2(phase),ready=frames[2];ready.initialAdmission.target=structuredClone(previous.snapshot.newRunning);ready.initialAdmission.sourceIdentity[2]=ready.initialAdmission.target.qdrant.pid;ready.initialAdmission.sourceIdentity[3]=ready.initialAdmission.target.qdrant.startTicks;
  ready.birthAdmission.target.wrapper.pid=pid++;ready.birthAdmission.target.qdrant.pid=pid++;ready.birthAdmission.target.qdrant.parentPid=ready.birthAdmission.target.wrapper.pid;ready.birthAdmission.sourceIdentity[2]=ready.birthAdmission.target.qdrant.pid;
  ready.cold.cleanStop.before=ready.initialAdmission.target;ready.cold.cleanStop.after={...ready.initialAdmission.target.state,running:false,finishedAt:ready.at};ready.cold.birthAdmission=ready.birthAdmission;
  for(const key of ['before','final'])frames[0].cachePreparation[key].qdrantPid=ready.birthAdmission.target.qdrant.pid;
  for(const [growth,sourceIdentity] of [[ready.entryOverheadEvidence,ready.initialAdmission.sourceIdentity],[frames[0].overheadEvidence,ready.birthAdmission.sourceIdentity],[ready.overheadEvidence,ready.birthAdmission.sourceIdentity],[frames[3].overheadEvidence,ready.birthAdmission.sourceIdentity]])for(const endpoint of [growth.baseline,growth.current]){endpoint.sourceIdentity=sourceIdentity;endpoint.consumerEnrolmentSha256=enrolledSha;for(const role of ['consumer','transportParent']){endpoint.outside[role].identity=structuredClone(enrolled[role].identity);if(endpoint===growth.baseline)endpoint.outside[role].metrics=structuredClone(enrolled[role].metrics);}}
  const record={schema:'clone-lifecycle-handoff.cpu0.v2',owner:'controller',previousSha256:previous.sha256,snapshot:{...previous.snapshot,newRunning:ready.birthAdmission.target},adoptionIntentSha256:intent};frames[4].handoff={...record,sha256:contract.canonicalHash(record)};
  const batch={serverMs:phase==='baseline'?1600:100,wallMs:phase==='baseline'?1700:110,socketClosed:true};
  const metrics=contract.phaseEvidenceV2(frames,0,phase,phaseFreeze,batch,{context:proofContext,requireRed:phase==='baseline',priorHandoff:previous,priorHandoffSha256:previous.sha256});previous=frames[4].handoff;
  return {metrics,frames,controllerExit:{code:0,signal:null,observed:true},queryTransport:{socketClosed:true},hashes:{resultIdHash:'1'.repeat(64),resultIdScoreHash:'2'.repeat(64),resultSetHash:'3'.repeat(64),resultScoreSetHash:'4'.repeat(64)},counts:[0]};
 }
 const cases=allPackets().sort((a,b)=>(a.tag==='control-native-title'?0:1)-(b.tag==='control-native-title'?0:1));
 for(const item of cases){const packet={...item,indexBuildId:'20261011T041503Z',queries:[{query:[0],using:'text_en',limit:1}]};const baseline=run('baseline');rows.push({...consumer.baselineRow(packet,baseline),variant:'cpu0-fixed-capacity.v2'});const candidate=run('candidate');rows.push({...consumer.pairedRow(packet,baseline,candidate,contract.pairedEvidence(baseline.metrics,candidate.metrics,baseline.hashes,candidate.hashes)),variant:'cpu0-fixed-capacity.v2'});}
 rows.push({kind:'complete',variant:'cpu0-fixed-capacity.v2',pairs:9,excluded:0,initialHandoffSha256:initial.sha256,finalHandoffSha256:previous.sha256,sourceFreezeSha256:context.sourceFreezeSha256,externalManifestSha256:context.externalManifestSha256,productionAcceptance:false});
 const options={...context,expected:phaseFreeze,initialHandoff:initial};const result=auditor.auditConsumerV2(rows,options);assert.equal(result.consumerPass,true);assert.equal(result.pairs,9);assert.equal(result.experimentPass,false);assert.equal(result.productionAcceptance,false);
 for(const mutate of [x=>delete x[1].baselineControlEvidence[2].entryOverheadEvidence,x=>x.at(-1).excluded=1,x=>x[2].candidate.wallMs=1500,x=>x[1].baselineControlEvidence[3].overheadEvidence.current.consumerRegistrationSha256='8'.repeat(64)]){const copy=structuredClone(rows);mutate(copy);assert.throws(()=>auditor.auditConsumerV2(copy,options));}
});

test('ABI2 selected cohort uses actual immutable Python public_measure/public_state ABI',()=>{
 const moduleDir=fileURLToPath(new URL('.',import.meta.url));
 const script=`import sys,json
sys.path.insert(0,${JSON.stringify(moduleDir)})
import daemon_cpu0 as d
n=d.runtime.MAX_MAPPED_FILES+d.runtime.NOFILE_RESERVE+4
f={'openFdCount':4,'mappedFileBound':d.runtime.MAX_MAPPED_FILES,'reserveFds':d.runtime.NOFILE_RESERVE,'requiredSoft':n,'softBefore':n,'softAfter':n,'hardLimit':n,'raised':False,'hardChanged':False}
a={key:0 for key in ('availableBytes','anonBytes','fileBytes','kernelBytes','unevictableBytes','currentBytes')}
a.update(cgroupMaxBytes=6*1024**3,memoryEvents={key:0 for key in ('max','oom','oom_kill')},cpu={key:0 for key in ('nr_throttled','throttled_usec')})
v={'event':'mapped-data-pin-state.v1','mode':'clone','lockedBytes':1024**3,'newLockBytes':0,'selectionHash':'e'*64,'extentRangesHashed':True,'queries':0,'storageWrites':0,'qdrantPid':101,'sourceStartTicks':99,'nofileLimits':f,'accounting':a,'accountingBefore':a,'accountingAfter':a,'deletedMappingsExcluded':0,'memoryEventDelta':a['memoryEvents'],'cpuLimitDelta':a['cpu'],'clonePressureMaxAllowed':False,'mappingBounds':{key:1 for key in ('currentVmas','maxMapCount','projectedAdditionalVmas','reservedVmas','projectedTotalVmas')},'nonresidentSelectedBytes':0,'projectedCurrentBytes':1024**3,'capReserveBytes':256*1024**2,'capHeadroomRequired':True,'pageBytes':4096,'rangesChanged':False,'helperVmas':1,'maxMapCount':262144}
v['classesMeasured']={kind:{'files':1,'dataLockBytes':0 if kind=='payload' else 1024**3//4,'dataPages':2*1024**3//4096 if kind=='payload' else 1024**3//4096//4,'residentDataPages':2*1024**3//4096 if kind=='payload' else 1024**3//4096//4,'rawExtentCount':1,'dataRangeCount':1} for kind in d.KINDS}
v['lockedResidency']={kind:{'lockedDataPages':0 if kind=='payload' else 1024**3//4096//4,'residentLockedDataPages':0 if kind=='payload' else 1024**3//4096//4} for kind in d.KINDS}
held=d.public_state(v)
v.update(event='mapped-data-measure-state.v1',lockedBytes=0)
print(json.dumps({'measurement':d.public_measure(v),'held':held}))
`;
 const emitted=JSON.parse(execFileSync('/usr/bin/python3',['-I','-B','-c',script],{maxBuffer:131072,timeout:5000}).toString());
 assert.deepEqual(Object.keys(emitted.measurement.classesMeasured).sort(),['graph','other','payload','sparse','vector']);assert.deepEqual(Object.keys(emitted.held.lockedResidency).sort(),['graph','other','sparse','vector']);
 const {frames,previous,context}=phaseFixtureV2('candidate');frames[0].cachePreparation.measurement=emitted.measurement;for(const name of ['initialPinState','pinState'])frames[2][name]=emitted.held;frames[3].pinStateAfterQuery=emitted.held;
 assert.equal(contract.phaseEvidenceV2(frames,0,'candidate',phaseFreeze,{serverMs:100,wallMs:110,socketClosed:true},{context,priorHandoff:previous,priorHandoffSha256:previous.sha256}).variant,'cpu0-fixed-capacity.v2');
});
test('ABI2 failed C6 interval retains measured endpoints and fixed reason without private fields',()=>{
 const {ledger,expected}=overheadFixture(),previous=v2Handoff();const fixed=ledger.chargedGrowthBytes-ledger.current.outside.controller.metrics.RssAnonBytes;
 ledger.current.outside.controller.metrics.RssAnonBytes=512*1024**2-fixed+4096;ledger.outsideDelta.controller.RssAnonBytes=ledger.current.outside.controller.metrics.RssAnonBytes;ledger.chargedGrowthBytes=512*1024**2+4096;
 const frame={schema:'search.clone-mlock-control.v3',stage:'phase-failed',reason:'overhead_growth_exceeded',overheadFailureEvidence:ledger,rawPrivateError:'query/account/secret'};
 const projected=contract.failureEvidenceV2([frame],previous,expected);assert.equal(projected.overheadFailures.length,1);assert.equal(projected.overheadFailures[0].proof.current.source.kernelBytes,ledger.current.source.kernelBytes);assert.equal(projected.overheadFailures[0].reason,'overhead_growth_exceeded');assert.equal(JSON.stringify(projected).includes('query/account/secret'),false);
 const bad=structuredClone(frame);bad.overheadFailureEvidence.chargedGrowthBytes=0;assert.equal(contract.failureEvidenceV2([bad],previous,expected).evidenceRejected,true);
});
