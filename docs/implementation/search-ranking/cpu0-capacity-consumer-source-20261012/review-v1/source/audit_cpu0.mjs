// Offline CPU0 consumer audit. Imports no controller, consumer, query or placement code.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {VARIANT,FIXED_CAPACITY_VARIANT,canonicalHash,recordedHandoff,recordedHandoffV2,preflightEvidence,validateAdmissionFrame,validateAdmissionFrameV2,phaseEvidence,phaseEvidenceV2,pairedEvidence,verifyExternalPacket,verifyExternalPacketV2,requireNineCompletedPairsV2} from './compare-contract-cpu0.mjs';
const HASH=/^[a-f0-9]{64}$/;
const CASES={'coverage-history-080628':[false,true],'coverage-history-083054':[false,true],'heldout-person':[true],'heldout-description':[true],'heldout-unseen-native':[true],'control-native-title':[true],'control-low-vote-title':[true]};
const gate=(ok,reason)=>{if(!ok)throw Error(reason);};
const same=(a,b)=>canonicalHash(a)===canonicalHash(b);
export function fixedCapacityRowAccountingV2(rows){
 // Bookkeeping only. Full phase/ledger and independent cleanup proofs remain
 // mandatory; these counts alone never produce consumerPass or experimentPass.
 gate(Array.isArray(rows)&&rows.length===20&&rows[0].kind==='consumer-admission'&&rows.at(-1).kind==='complete'&&rows.every(row=>row.variant===FIXED_CAPACITY_VARIANT&&row.productionAcceptance===false),'cpu0_fixed_row_scope_invalid');
 const seen=new Set();let pending=null,pairs=0;
 for(const row of rows.slice(1,-1)){
  const flags=CASES[row.tag];gate(flags&&flags.includes(row.lesserKnown),'cpu0_fixed_row_case_invalid');
  const key=row.tag+':'+row.lesserKnown;
  if(row.kind==='baseline-batch'){gate(!pending&&!seen.has(key),'cpu0_fixed_row_pair_invalid');pending=key;}
  else{gate(row.kind==='paired-batch'&&pending===key,'cpu0_fixed_row_pair_invalid');seen.add(key);pairs++;pending=null;}
 }
 gate(!pending&&seen.size===9&&seen.has('control-native-title:true')&&rows.at(-1).pairs===pairs,'cpu0_fixed_row_completion_invalid');
 requireNineCompletedPairsV2({pairs,excluded:rows.at(-1).excluded});
 return {pairs,excluded:0,slots:seen.size,rowAccountingOnly:true};
}
function exit(value){gate(value&&Object.keys(value).sort().join(',')==='code,observed,signal'&&value.code===0&&value.signal===null&&value.observed===true,'cpu0_controller_exit_unproven');return value.code;}
function metrics(frames,controllerExit,transport,phase,expected,reported,previous,requireRed){
 gate(transport&&Object.keys(transport).join(',')==='socketClosed'&&transport.socketClosed===true,'cpu0_audit_socket_release_unproven');
 gate(reported?.variant===VARIANT&&reported.productionAcceptance===false,'cpu0_reported_variant_changed');
 const result=phaseEvidence(frames,exit(controllerExit),phase,expected,{serverMs:reported.serverMs,wallMs:reported.wallMs,socketClosed:true},{requireRed,priorHandoffSha256:previous.sha256,priorHandoff:previous});
 gate(same(result,reported),'cpu0_reported_metrics_changed');return result;
}
export function auditConsumer(rows,{expected,initialHandoff,sourceFreezeSha256,externalManifestSha256}){
 gate(Array.isArray(rows)&&rows.length>=3&&rows.length<=21&&HASH.test(sourceFreezeSha256||'')&&HASH.test(externalManifestSha256||''),'cpu0_audit_scope_invalid');
 recordedHandoff(initialHandoff,initialHandoff?.sha256);let previous=initialHandoff;
 const admission=rows[0];gate(admission.kind==='consumer-admission'&&admission.productionAcceptance===false&&admission.sourceFreezeSha256===sourceFreezeSha256&&admission.externalManifestSha256===externalManifestSha256,'cpu0_consumer_admission_missing');
 const {receipt}=validateAdmissionFrame(admission,previous,{sourceFreezeSha256,externalManifestSha256});previous=receipt.handoff;
 const seen=new Set();let pending=null,pairs=0,excluded=0,nativePassed=false;
 for(const row of rows.slice(1,-1)){
  gate(row.variant===VARIANT&&row.productionAcceptance===false,'cpu0_audit_variant_changed');
  const flags=CASES[row.tag];gate(flags,'cpu0_audit_case_invalid');
  if(row.kind==='excluded'){gate(!pending&&flags.length===1&&row.tag!=='control-native-title'&&row.reason==='private_source_or_coverage_unavailable','cpu0_audit_exclusion_invalid');const key=row.tag+':true';gate(!seen.has(key),'cpu0_audit_duplicate');seen.add(key);excluded++;continue;}
  gate(row.indexBuildId==='20261011T041503Z'&&flags.includes(row.lesserKnown)&&Number.isInteger(row.queryCount)&&row.queryCount>=1&&row.queryCount<=12,'cpu0_audit_batch_scope_invalid');
  const key=row.tag+':'+row.lesserKnown;
  if(row.kind==='baseline-batch'){
   gate(!pending&&!seen.has(key)&&(row.tag==='control-native-title'||nativePassed),'cpu0_audit_pair_order_invalid');
   metrics(row.baselineControlEvidence,row.baselineControllerExit,row.baselineTransport,'baseline',expected,row.baseline,previous,row.tag==='control-native-title');previous=row.baselineControlEvidence[4].handoff;pending=row;continue;
  }
  gate(row.kind==='paired-batch'&&pending&&pending.tag===row.tag&&pending.lesserKnown===row.lesserKnown,'cpu0_audit_pair_missing');
  gate(same(pending.baseline,row.baseline)&&same(pending.baselineControlEvidence,row.baselineControlEvidence)&&same(pending.baselineHashes,row.baselineHashes)&&same(pending.baselineControllerExit,row.baselineControllerExit)&&same(pending.baselineTransport,row.baselineTransport),'cpu0_audit_baseline_changed');
  metrics(row.candidateControlEvidence,row.candidateControllerExit,row.candidateTransport,'candidate',expected,row.candidate,previous,false);
  const parity=pairedEvidence(row.baseline,row.candidate,row.baselineHashes,row.candidateHashes);for(const [name,value] of Object.entries(parity))gate(row[name]===value,'cpu0_audit_parity_changed');
  previous=row.candidateControlEvidence[4].handoff;seen.add(key);pairs++;if(row.tag==='control-native-title')nativePassed=true;pending=null;
 }
 const final=rows.at(-1);gate(!pending&&nativePassed&&seen.size===9&&pairs<=9&&pairs+excluded===9&&final.kind==='complete'&&final.variant===VARIANT&&final.productionAcceptance===false&&final.pairs===pairs&&final.initialHandoffSha256===initialHandoff.sha256&&final.finalHandoffSha256===previous.sha256&&final.sourceFreezeSha256===sourceFreezeSha256&&final.externalManifestSha256===externalManifestSha256,'cpu0_audit_completion_invalid');
 return {schema:'cpu0-consumer-audit.v1',variant:VARIANT,consumerPass:true,pairs,excluded,maximumWriterReceipts:18,initialHandoffSha256:initialHandoff.sha256,finalHandoffSha256:previous.sha256,sourceFreezeSha256,externalManifestSha256,externalCleanupRequired:true,experimentPass:false,productionAcceptance:false};
}
function metricsV2(frames,controllerExit,transport,phase,expected,reported,previous,requireRed,context){
 gate(transport&&Object.keys(transport).join(',')==='socketClosed'&&transport.socketClosed===true,'cpu0_audit_socket_release_unproven');
 gate(reported?.variant===FIXED_CAPACITY_VARIANT&&reported.productionAcceptance===false,'cpu0_reported_variant_changed');
 const result=phaseEvidenceV2(frames,exit(controllerExit),phase,expected,{serverMs:reported.serverMs,wallMs:reported.wallMs,socketClosed:true},{context,requireRed,priorHandoffSha256:previous.sha256,priorHandoff:previous});
 gate(same(result,reported),'cpu0_reported_metrics_changed');return result;
}
export function auditConsumerV2(rows,{expected,initialHandoff,sourceFreezeSha256,externalManifestSha256,nodeProvenanceSha256,adoptionIntentSha256}){
 gate(Array.isArray(rows)&&rows.length>=3&&rows.length<=21&&HASH.test(sourceFreezeSha256||'')&&HASH.test(externalManifestSha256||''),'cpu0_audit_scope_invalid');
 fixedCapacityRowAccountingV2(rows);
 const context={...expected,sourceFreezeSha256,externalManifestSha256,nodeProvenanceSha256,adoptionIntentSha256};
 recordedHandoffV2(initialHandoff,initialHandoff?.sha256,{adoptionIntentSha256,previousSha256:initialHandoff?.previousSha256});let previous=initialHandoff;
 const admission=rows[0];gate(admission.kind==='consumer-admission'&&admission.productionAcceptance===false&&admission.sourceFreezeSha256===sourceFreezeSha256&&admission.externalManifestSha256===externalManifestSha256,'cpu0_consumer_admission_missing');
 const {receipt}=validateAdmissionFrameV2(admission,previous,context);context.consumerEnrolment=receipt.consumerEnrolment;context.consumerEnrolmentSha256=receipt.consumerEnrolmentSha256;previous=receipt.handoff;
 const seen=new Set();let pending=null,pairs=0,excluded=0,nativePassed=false;
 for(const row of rows.slice(1,-1)){
  gate(row.variant===FIXED_CAPACITY_VARIANT&&row.productionAcceptance===false,'cpu0_audit_variant_changed');
  const flags=CASES[row.tag];gate(flags,'cpu0_audit_case_invalid');
  if(row.kind==='excluded'){gate(!pending&&flags.length===1&&row.tag!=='control-native-title'&&row.reason==='private_source_or_coverage_unavailable','cpu0_audit_exclusion_invalid');const key=row.tag+':true';gate(!seen.has(key),'cpu0_audit_duplicate');seen.add(key);excluded++;continue;}
  gate(row.indexBuildId==='20261011T041503Z'&&flags.includes(row.lesserKnown)&&Number.isInteger(row.queryCount)&&row.queryCount>=1&&row.queryCount<=12,'cpu0_audit_batch_scope_invalid');
  const key=row.tag+':'+row.lesserKnown;
  if(row.kind==='baseline-batch'){
   gate(!pending&&!seen.has(key)&&(row.tag==='control-native-title'||nativePassed),'cpu0_audit_pair_order_invalid');
   metricsV2(row.baselineControlEvidence,row.baselineControllerExit,row.baselineTransport,'baseline',expected,row.baseline,previous,row.tag==='control-native-title',context);context.consumerRegistrationSha256=row.baseline.consumerRegistrationSha256;previous=row.baselineControlEvidence[4].handoff;pending=row;continue;
  }
  gate(row.kind==='paired-batch'&&pending&&pending.tag===row.tag&&pending.lesserKnown===row.lesserKnown,'cpu0_audit_pair_missing');
  gate(same(pending.baseline,row.baseline)&&same(pending.baselineControlEvidence,row.baselineControlEvidence)&&same(pending.baselineHashes,row.baselineHashes)&&same(pending.baselineControllerExit,row.baselineControllerExit)&&same(pending.baselineTransport,row.baselineTransport),'cpu0_audit_baseline_changed');
  metricsV2(row.candidateControlEvidence,row.candidateControllerExit,row.candidateTransport,'candidate',expected,row.candidate,previous,false,context);
  const parity=pairedEvidence(row.baseline,row.candidate,row.baselineHashes,row.candidateHashes);for(const [name,value] of Object.entries(parity))gate(row[name]===value,'cpu0_audit_parity_changed');
  previous=row.candidateControlEvidence[4].handoff;seen.add(key);pairs++;if(row.tag==='control-native-title')nativePassed=true;pending=null;
 }
 const final=rows.at(-1);gate(!pending&&nativePassed&&seen.size===9&&pairs<=9&&pairs+excluded===9&&final.kind==='complete'&&final.variant===FIXED_CAPACITY_VARIANT&&final.productionAcceptance===false&&final.pairs===pairs&&final.initialHandoffSha256===initialHandoff.sha256&&final.finalHandoffSha256===previous.sha256&&final.sourceFreezeSha256===sourceFreezeSha256&&final.externalManifestSha256===externalManifestSha256,'cpu0_audit_completion_invalid');
 return {schema:'cpu0-consumer-audit.v2',variant:FIXED_CAPACITY_VARIANT,consumerPass:true,pairs,excluded,maximumWriterReceipts:18,initialHandoffSha256:initialHandoff.sha256,finalHandoffSha256:previous.sha256,sourceFreezeSha256,externalManifestSha256,externalCleanupRequired:true,experimentPass:false,productionAcceptance:false};
}
// CLI takes only retained public artifacts; it never selects or reads live source identity.
export function main(argv=process.argv.slice(2)){
 if(argv.length!==5)throw Error('cpu0_audit_arguments_invalid');
 const [outputPath,contextPath,manifestPath,manifestSha,stage]=argv;
 const raw=readFileSync(outputPath);gate(raw.length<=32*1024**2,'cpu0_audit_output_bound');
 const rows=raw.toString().trim().split('\n').map(line=>{gate(Buffer.byteLength(line)<=2*1024**2,'cpu0_audit_frame_bound');return JSON.parse(line)});
 const context=JSON.parse(readFileSync(contextPath));const manifestRaw=readFileSync(manifestPath);const fixed=JSON.parse(manifestRaw).schema==='cpu0-full-public-packet.v7';const closure=(fixed?verifyExternalPacketV2:verifyExternalPacket)(manifestRaw,manifestSha,name=>readFileSync(stage+'/'+name));
 gate(context.externalManifestSha256===manifestSha&&context.sourceFreezeSha256===closure.externalManifest.sourceFreezeSha256,'cpu0_audit_context_changed');
 return (fixed?auditConsumerV2:auditConsumer)(rows,{...context,expected:closure.expected});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){try{process.stdout.write(JSON.stringify(main())+'\n')}catch{process.stdout.write(JSON.stringify({schema:'cpu0-consumer-audit.v1',variant:VARIANT,consumerPass:false,experimentPass:false,reason:'cpu0_audit_refused',productionAcceptance:false})+'\n');process.exitCode=1;}}
