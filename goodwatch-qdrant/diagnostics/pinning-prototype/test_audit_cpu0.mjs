import {baselineRow,pairedRow} from './consumer_cpu0.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {auditConsumer} from './audit_cpu0.mjs';import {prior,admission,chainedFrames,expected} from './cpu0_consumer_fixture.mjs';import {canonicalHash,phaseEvidence,pairedEvidence} from './compare-contract-cpu0.mjs';
function fixture(){
 const initial=prior();initial.owner='setup';initial.previousSha256=null;const {sha256,...record}=initial;initial.sha256=canonicalHash(record);
 const next={...record,owner:'preflight',previousSha256:initial.sha256};const receipt={...next,sha256:canonicalHash(next)};
 const sourceFreezeSha256='c'.repeat(64),externalManifestSha256='d'.repeat(64);const a=admission();a.target=initial.snapshot.newRunning;a.sourceIdentity[2]=a.target.qdrant.pid;
 const rows=[{kind:'consumer-admission',schema:'search.clone-cpu0-preflight.v1',variant:'cpu0-owned-lifecycle.v1',birthAdmission:a,handoff:receipt,sourceIdentity:a.sourceIdentity,queries:0,resourceWrites:0,handoffWrites:1,modelsRead:0,productionAcceptance:false,sourceFreezeSha256,externalManifestSha256,consumerBirth:{pid:777,startTicks:888,parentPid:666,exeIdentityHash:'e'.repeat(64),groupHash:'f'.repeat(64),VmLckBytes:0,outsideSourceCgroup:true}}];
 const cases=[['control-native-title',true],['coverage-history-080628',false],['coverage-history-080628',true],['coverage-history-083054',false],['coverage-history-083054',true],['heldout-person',true],['heldout-description',true],['heldout-unseen-native',true],['control-low-vote-title',true]];
 let previous=receipt,pid=101;
 const hashes={resultIdHash:'a'.repeat(64),resultIdScoreHash:'b'.repeat(64),resultSetHash:'c'.repeat(64),resultScoreSetHash:'d'.repeat(64)},controllerExit={code:0,signal:null,observed:true};
 for(const [tag,lesserKnown]of cases){
  const baselineFrames=chainedFrames('baseline',previous,pid);pid+=2;
  const baseline=phaseEvidence(baselineFrames,0,'baseline',expected,{serverMs:1900,wallMs:1920,socketClosed:true},{requireRed:tag==='control-native-title',priorHandoffSha256:previous.sha256,priorHandoff:previous});previous=baselineFrames[4].handoff;
  const packet={tag,lesserKnown,indexBuildId:'20261011T041503Z',queries:[{query:[1]}]};const baselineResult={metrics:baseline,frames:baselineFrames,controllerExit,queryTransport:{socketClosed:true},hashes,counts:[1]};rows.push(baselineRow(packet,baselineResult));
  const candidateFrames=chainedFrames('candidate',previous,pid);pid+=2;
  const candidate=phaseEvidence(candidateFrames,0,'candidate',expected,{serverMs:20,wallMs:25,socketClosed:true},{priorHandoffSha256:previous.sha256,priorHandoff:previous});previous=candidateFrames[4].handoff;
  const candidateResult={metrics:candidate,frames:candidateFrames,controllerExit,queryTransport:{socketClosed:true},hashes,counts:[1]};rows.push(pairedRow(packet,baselineResult,candidateResult,pairedEvidence(baseline,candidate,hashes,hashes)));
 }
 rows.push({kind:'complete',variant:'cpu0-owned-lifecycle.v1',pairs:9,initialHandoffSha256:initial.sha256,finalHandoffSha256:previous.sha256,sourceFreezeSha256,externalManifestSha256,productionAcceptance:false});
 return{rows,context:{expected,initialHandoff:initial,sourceFreezeSha256,externalManifestSha256}};
}
test('offline nine-pair audit validates chain and expressly cannot promote external cleanup or app acceptance',()=>{
 const {rows,context}=fixture();const result=auditConsumer(rows,context);assert.equal(result.consumerPass,true);assert.equal(result.pairs,9);assert.equal(result.experimentPass,false);assert.equal(result.externalCleanupRequired,true);assert.equal(result.productionAcceptance,false);
});
test('offline audit refuses missing exit, native red failure, omitted unpin and cross-phase predecessor drift',()=>{
 for(const mutate of [rows=>rows[1].baselineControllerExit.observed=false,rows=>rows[1].baseline.serverMs=20,rows=>rows[2].candidateControlEvidence.pop(),rows=>rows[2].candidateControlEvidence[4].handoff.previousSha256='f'.repeat(64),rows=>rows[2].resultScoreSetHashParity=false,rows=>rows.at(-1).finalHandoffSha256='f'.repeat(64),rows=>rows[0].sourceFreezeSha256='f'.repeat(64),rows=>delete rows[2].baselineControllerExit,rows=>rows[2].candidateTransport.socketClosed=false,rows=>rows.splice(1,2)]){const {rows,context}=fixture();mutate(rows);assert.throws(()=>auditConsumer(rows,context));}
});
