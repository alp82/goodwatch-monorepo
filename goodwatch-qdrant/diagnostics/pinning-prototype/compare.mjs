// Prepared private-pipe comparison. Complete producer exit fence precedes all clone I/O.
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import crypto from 'node:crypto';
import {orderedIds,orderedIdsScores,idSets,idScoreSets,signal} from './parity.mjs';
import {phaseEvidence,pairedEvidence} from './compare-contract.mjs';
const ROOT='/root/goodwatch-qdrant-cold-406-20261011';
console.info=()=>{};console.warn=()=>{};console.error=()=>{};
const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');
const TAGS=new Set(['coverage-history-080628','coverage-history-083054','heldout-person','heldout-description','heldout-unseen-native','control-native-title','control-low-vote-title']);
export async function packetsFrom(input){
 let bytes=0,completed=false;const packets=[],seen=new Set();
 for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
  bytes+=Buffer.byteLength(line);if(bytes>32*1024**2||completed)throw Error('private_input_bound');
  const p=JSON.parse(line);
  if(p.kind==='private-producer-complete'){if(p.exitCode!==0)throw Error('producer_not_complete');completed=true;continue;}
  if(!TAGS.has(p.tag)||!['private-batch','private-excluded'].includes(p.kind))throw Error('private_input_shape');
  if(p.kind==='private-batch'){
   if(p.collection!=='media_fingerprint_v1'||typeof p.lesserKnown!=='boolean'||!Array.isArray(p.queries)||p.queries.length<1||p.queries.length>12||!/^\d{8}T\d{6}Z$/.test(p.indexBuildId)||p.queries.some(q=>q.lookup_from))throw Error('private_batch_shape');
   const key=p.tag+':'+p.lesserKnown;if(seen.has(key))throw Error('private_duplicate');seen.add(key);
  }
  packets.push(p);if(packets.length>16)throw Error('private_input_bound');
 }
 if(!completed||!packets.some(p=>p.kind==='private-batch'))throw Error('producer_fence_missing');
 return packets;
}
function digest(path){return crypto.createHash('sha256').update(readFileSync(path)).digest('hex');}
async function controlledBatch(packet,phase,expected,paths,queryBatch){
 if(realpathSync(paths.code)!==paths.code||realpathSync(paths.config)!==paths.config||digest(paths.code)!==expected.controllerCodeSha256||digest(paths.config)!==expected.controllerPolicySha256)throw Error('controller_freeze_changed');
 const child=spawn('/usr/bin/python3',['-I','-B',paths.code,'--execute-reviewed','--config',paths.config,'--policy-sha256',expected.controllerPolicySha256,'--code-sha256',expected.controllerCodeSha256,'--phase',phase,'--case-tag',packet.tag,'--raise-own-memlock'],{stdio:['pipe','pipe','pipe']});
 const frames=[];let readyResolve,readyReject,closedResolve,batch;
 const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j});const closed=new Promise(r=>{closedResolve=r});
 const timer=setTimeout(()=>{readyReject(Error('control_ready_timeout'));child.kill('SIGTERM')},600000);
 child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
 child.on('error',()=>readyReject(Error('control_spawn_failed')));
 child.on('close',code=>{clearTimeout(timer);if(!frames.some(f=>f.stage==='query-ready'))readyReject(Error('control_before_ready_failed'));closedResolve(code)});
 (async()=>{try{for await(const line of readline.createInterface({input:child.stdout,crlfDelay:Infinity})){
  if(line.length>131072||frames.length>=6)throw Error();const f=JSON.parse(line);frames.push(f);
  if(f.stage==='failed')throw Error();if(f.stage==='query-ready')readyResolve();
 }}catch{readyReject(Error('control_frame_failed'));child.kill('SIGTERM')}})();
 try{
  await ready;clearTimeout(timer);
  batch=await queryBatch(packet.collection,packet.queries,{timeoutMs:30000});
  child.stdin.end('{"stage":"query-finished"}\n');
  let cleanupTimer;let exit;try{exit=await Promise.race([closed,new Promise((_,reject)=>{cleanupTimer=setTimeout(()=>reject(Error('control_cleanup_timeout')),15000)})])}finally{clearTimeout(cleanupTimer)}
  const metrics=phaseEvidence(frames,exit,phase,expected,batch,{requireRed:packet.tag==='control-native-title'});
  return {metrics,frames,hashes:{resultIdHash:orderedIds(batch.results),resultIdScoreHash:orderedIdsScores(batch.results),resultSetHash:idSets(batch.results),resultScoreSetHash:idScoreSets(batch.results)},counts:batch.results.map(r=>r.length)};
 }finally{if(child.exitCode===null)child.kill('SIGTERM');}
}
export async function main(){
 if(process.argv[2]!=='--execute-reviewed'){emit({kind:'prepared-only',queries:0,payloadPersistence:false});return;}
 const expected=Object.fromEntries(['helperCodeSha256','helperPolicySha256','controllerCodeSha256','controllerPolicySha256'].map(k=>[k,process.env[k]]));
 if(Object.values(expected).some(x=>!/^[a-f0-9]{64}$/.test(x||'')))throw Error('freeze_missing');
 if(process.env.QDRANT_URL!=='http://127.0.0.1:16333/')throw Error('fixed_clone_endpoint_required');
 const paths={code:ROOT+'/replay/pinning-prototype/controller.py',config:ROOT+'/replay/frozen-control.json'};
 // Retain bounded packets until EOF plus parent exit0 fence. No request starts during producer encoding.
 const packets=await packetsFrom(process.stdin);
 const {queryBatch}=await import('./transport.mjs');
 for(const p of packets){
  if(p.kind==='private-excluded'){emit({kind:'excluded',tag:p.tag,reason:'private source or coverage unavailable'});continue;}
  const baseline=await controlledBatch(p,'baseline',expected,paths,queryBatch);
  const candidate=await controlledBatch(p,'candidate',expected,paths,queryBatch);
  const parity=pairedEvidence(baseline.metrics,candidate.metrics,baseline.hashes,candidate.hashes);
  emit({kind:'paired-batch',tag:p.tag,lesserKnown:p.lesserKnown,indexBuildId:p.indexBuildId,queryCount:p.queries.length,signals:p.queries.map(signal),baseline:baseline.metrics,candidate:candidate.metrics,...parity,baselineControlEvidence:baseline.frames,candidateControlEvidence:candidate.frames,baselineHashes:baseline.hashes,candidateHashes:candidate.hashes,resultCounts:baseline.counts,productionAcceptance:false});
 }
 emit({kind:'complete',productionAcceptance:false});
}
if(import.meta.url===new URL(process.argv[1],'file:').href)main().catch(()=>{emit({kind:'failed',reason:'comparison guard or control failed; private error omitted'});process.exitCode=1});
