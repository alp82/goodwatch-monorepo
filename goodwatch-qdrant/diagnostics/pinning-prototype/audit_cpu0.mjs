// Offline CPU0 consumer audit. Imports no controller, consumer, query or placement code.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {VARIANT,canonicalHash,recordedHandoff,preflightEvidence,validateAdmissionFrame,phaseEvidence,pairedEvidence,verifyExternalPacket} from './compare-contract-cpu0.mjs';
const HASH=/^[a-f0-9]{64}$/;
const CASES={'coverage-history-080628':[false,true],'coverage-history-083054':[false,true],'heldout-person':[true],'heldout-description':[true],'heldout-unseen-native':[true],'control-native-title':[true],'control-low-vote-title':[true]};
const gate=(ok,reason)=>{if(!ok)throw Error(reason);};
const same=(a,b)=>canonicalHash(a)===canonicalHash(b);
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
// CLI takes only retained public artifacts; it never selects or reads live source identity.
export function main(argv=process.argv.slice(2)){
 if(argv.length!==5)throw Error('cpu0_audit_arguments_invalid');
 const [outputPath,contextPath,manifestPath,manifestSha,stage]=argv;
 const raw=readFileSync(outputPath);gate(raw.length<=32*1024**2,'cpu0_audit_output_bound');
 const rows=raw.toString().trim().split('\n').map(line=>{gate(Buffer.byteLength(line)<=2*1024**2,'cpu0_audit_frame_bound');return JSON.parse(line)});
 const context=JSON.parse(readFileSync(contextPath));const closure=verifyExternalPacket(readFileSync(manifestPath),manifestSha,name=>readFileSync(stage+'/'+name));
 gate(context.externalManifestSha256===manifestSha&&context.sourceFreezeSha256===closure.externalManifest.sourceFreezeSha256,'cpu0_audit_context_changed');
 return auditConsumer(rows,{...context,expected:closure.expected});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){try{process.stdout.write(JSON.stringify(main())+'\n')}catch{process.stdout.write(JSON.stringify({schema:'cpu0-consumer-audit.v1',variant:VARIANT,consumerPass:false,experimentPass:false,reason:'cpu0_audit_refused',productionAcceptance:false})+'\n');process.exitCode=1;}}
