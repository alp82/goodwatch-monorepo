// Offline only. Explicit public-field projection; no control, query, credential or payload I/O.
import fs from 'node:fs';import crypto from 'node:crypto';
import {phaseEvidence,pairedEvidence} from './compare-contract.mjs';
const TAGS=new Set(['coverage-history-080628','coverage-history-083054','heldout-person','heldout-description','heldout-unseen-native','control-native-title','control-low-vote-title']);
const CASES={'coverage-history-080628':[false,true],'coverage-history-083054':[false,true],'heldout-person':[true],'heldout-description':[true],'heldout-unseen-native':[true],'control-native-title':[true],'control-low-vote-title':[true]};
const HASH=/^[a-f0-9]{64}$/;const BUILD='20261011T041503Z';const HIST='000b58ebaf48d6f51d3298665918e1fefd68985226678a1a00f3e1db1b26e8a0';
const DEFAULT_EXPECTED={"helperCodeSha256":"b61022a43ce6d3b3357290a718d4cebb4d3a6cd8c4547e839c501a3c0c4c8a55","helperPolicySha256":"ddb7f2735ab539cbe1138dfbf23397e41fb4db87c320720a970d068686281ec2","controllerCodeSha256":"4cfe85cfeb5a254e227c89fd3b23f221a185090507e4f96033a81e6ecf497a3e","controllerPolicySha256":"44cec00e752a6b7d474cf27bb8074f202761cafab28a3494c60af92a9026f92c"};
const gate=(ok)=>{if(!ok)throw Error('public_result_contract_invalid')};
const metric=x=>({serverMs:x.serverMs,wallMs:x.wallMs,queryMajorFaults:x.queryMajorFaults,baselineServerRed:x.baselineServerRed,transportOrOtherTail:x.transportOrOtherTail});
const hashes=h=>{gate(h&&['resultIdHash','resultIdScoreHash','resultSetHash','resultScoreSetHash'].every(k=>HASH.test(h[k]||'')));return Object.fromEntries(['resultIdHash','resultIdScoreHash','resultSetHash','resultScoreSetHash'].map(k=>[k,h[k]]))};
export function audit(raw,expected=DEFAULT_EXPECTED){
 const out={schema:'search.postcold-offline-audit.v5',status:'unknown',productionAcceptance:false,historicalMechanismOnly:true,baselineEvidence:[],pairedEvidence:[],excludedCaseCount:0,failedFrameCount:0,allLifecycleExitsProven:false};
 if(!raw.length)return {...out,reason:'empty_result'};
 if(raw.length>8*1024**2)return {...out,status:'invalid',reason:'public_result_contract_invalid'};
 try{
 const v=JSON.parse(raw);gate(v.stage==='comparison-finished'&&Array.isArray(v.frames)&&v.frames.length<=64&&v.productionAcceptance===false&&v.historicalIndexReplay===true&&v.historicalManifestSha256===HIST&&v.payloadPersistence===false&&v.ordinarySearches===0&&v.historyWrites===0);
 gate(Array.isArray(v.lifecycleProofs)&&v.lifecycleProofs.length===2&&typeof v.allLifecycleExitsProven==='boolean');
 const [p,b]=v.lifecycleProofs;const gone=p.producerGone===true&&b.consumerAndControllersGone===true&&b.holderExitProven===true&&b.writerLifecycleProof?.recordedWritersGone===true;
 gate(v.allLifecycleExitsProven===gone);out.allLifecycleExitsProven=gone;out.cloneRunning=b.cloneRunning===true;
 const pending=new Map();const completed=new Set(),excluded=new Set();let complete=false,native=false;
 for(const f of v.frames){
  gate(f&&['baseline-batch','paired-batch','failed','excluded','complete'].includes(f.kind)&&!complete);
  if(f.kind==='failed'){out.failedFrameCount++;continue;}
  if(f.kind==='excluded'){gate(CASES[f.tag]?.length===1&&f.tag!=='control-native-title'&&!excluded.has(f.tag)&&!completed.has(f.tag+':true')&&!pending.has(f.tag+':true'));excluded.add(f.tag);out.excludedCaseCount++;continue;}
  if(f.kind==='complete'){gate(f.productionAcceptance===false&&native&&pending.size===0&&Object.entries(CASES).every(([tag,flags])=>flags.every(flag=>completed.has(tag+':'+flag)||excluded.has(tag))));complete=true;continue;}
  gate(TAGS.has(f.tag)&&CASES[f.tag].includes(f.lesserKnown)&&!excluded.has(f.tag)&&typeof f.lesserKnown==='boolean'&&f.indexBuildId===BUILD&&Number.isInteger(f.queryCount)&&f.queryCount>0&&f.queryCount<=12&&f.productionAcceptance===false);
  const key=f.tag+':'+f.lesserKnown;const baseline=phaseEvidence(f.baselineControlEvidence,0,'baseline',expected,f.baseline,{requireRed:f.tag==='control-native-title'});const bh=hashes(f.baselineHashes);
  if(f.kind==='baseline-batch'){
   gate(!pending.has(key)&&!completed.has(key)&&(f.tag==='control-native-title'||native));pending.set(key,{baseline,hashes:bh});
   out.baselineEvidence.push({tag:f.tag,lesserKnown:f.lesserKnown,queryCount:f.queryCount,...metric(baseline),...bh});continue;
  }
  gate(pending.has(key)&&!completed.has(key));const prior=pending.get(key);gate(JSON.stringify(prior.baseline)===JSON.stringify(baseline)&&JSON.stringify(prior.hashes)===JSON.stringify(bh));
  const candidate=phaseEvidence(f.candidateControlEvidence,0,'candidate',expected,f.candidate);const parity=pairedEvidence(baseline,candidate,bh,hashes(f.candidateHashes));
  for(const [k,value] of Object.entries(parity))gate(f[k]===value);
  out.pairedEvidence.push({tag:f.tag,lesserKnown:f.lesserKnown,queryCount:f.queryCount,baseline:metric(baseline),candidate:metric(candidate),...parity});pending.delete(key);completed.add(key);if(f.tag==='control-native-title')native=true;
 }
 out.pendingBaselineCount=pending.size;out.completedPairCount=completed.size;out.completeFrame=complete;
 out.status=complete&&native&&gone&&v.localExitObserved===true&&v.localExitCode===0&&v.timedOut===false&&v.supervisorFailure===null&&out.failedFrameCount===0?'diagnostic-pass':'diagnostic-incomplete-or-failed';return out;
 }catch{return {...out,status:'invalid',reason:'public_result_contract_invalid'};}
}
if(import.meta.url===new URL(process.argv[1],'file:').href){
 const raw=fs.readFileSync(process.argv[2]);const result=audit(raw);console.log(JSON.stringify({...result,inputSha256:crypto.createHash('sha256').update(raw).digest('hex')}));
 process.exitCode=result.status==='diagnostic-pass'?0:1;
}
