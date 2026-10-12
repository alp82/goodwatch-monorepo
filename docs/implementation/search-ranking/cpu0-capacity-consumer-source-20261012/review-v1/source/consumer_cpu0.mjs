// CPU0 owned-lifecycle consumer. Private packets stay in memory; no canonical controller adapter.
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {readFileSync,realpathSync,openSync,closeSync,fstatSync,readdirSync,readSync,statSync,constants} from 'node:fs';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {orderedIds,orderedIdsScores,idSets,idScoreSets,signal} from './parity.mjs';
import {ContractFailure} from './compare-contract.mjs';
import {VARIANT,FIXED_CAPACITY_VARIANT,CPU0_SOURCE_FILES,verifyCpu0Freeze,recordedHandoff,recordedHandoffV2,readinessEvidence,readinessEvidenceV2,phaseEvidence,phaseEvidenceV2,pairedEvidence,failureEvidence,failureEvidenceV2,preflightEvidence,consumerPreflightEvidenceV2,validateAdmissionFrame,validateAdmissionFrameV2,verifyExternalPacket,verifyExternalPacketV2,FULL_NAMES} from './compare-contract-cpu0.mjs';
import {createDirectClient} from './transport_cpu0.mjs';
export const ROOT='/root/goodwatch-qdrant-cold-406-20261011';
export const STAGE=ROOT+'/pin-control-20261012-100-cpu0-v1';
export const FIXED_CAPACITY_STAGE=ROOT+'/pin-control-20261012-100-cpu0-v2';
export const FIXED_CAPACITY_SELECTOR='--execute-reviewed-fixed-capacity-v2';
const HASH=/^[a-f0-9]{64}$/;
export const CONTROL_ENV=Object.freeze({PATH:'/usr/bin:/bin',LANG:'C.UTF-8',LC_ALL:'C.UTF-8',DOCKER_HOST:'unix:///var/run/docker.sock'});
export {FULL_NAMES,verifyExternalPacket,verifyExternalPacketV2};
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const hasLookup=value=>!!value&&typeof value==='object'&&(Object.hasOwn(value,'lookup_from')||Object.values(value).some(hasLookup));
const TAGS=new Set(['coverage-history-080628','coverage-history-083054','heldout-person','heldout-description','heldout-unseen-native','control-native-title','control-low-vote-title']);
export async function packetsFrom(input){
 let bytes=0,completed=false;const packets=[],seen=new Set();
 for await(const line of readline.createInterface({input,crlfDelay:Infinity})){
  bytes+=Buffer.byteLength(line);if(bytes>32*1024**2||completed)throw Error('private_input_bound');
  const p=JSON.parse(line);
  if(p.kind==='private-producer-complete'){if(p.exitCode!==0)throw Error('producer_not_complete');completed=true;continue;}
  if(!TAGS.has(p.tag)||!['private-batch','private-excluded'].includes(p.kind))throw Error('private_input_shape');
  if(p.kind==='private-batch'){
   if(p.collection!=='media_fingerprint_v1'||typeof p.lesserKnown!=='boolean'||!Array.isArray(p.queries)||p.queries.length<1||p.queries.length>12||!/^\d{8}T\d{6}Z$/.test(p.indexBuildId)||hasLookup(p.queries))throw Error('private_batch_shape');
   const key=p.tag+':'+p.lesserKnown;if(seen.has(key))throw Error('private_duplicate');seen.add(key);
  }
  packets.push(p);if(packets.length>16)throw Error('private_input_bound');
 }
 if(!completed||!packets.some(p=>p.kind==='private-batch'))throw Error('producer_fence_missing');
 return packets;
}
export function requireNativeAnchor(packets){if(!packets.some(p=>p.kind==='private-batch'&&p.tag==='control-native-title'))throw Error('required_native_control_missing');}
export const V4_CASES=Object.freeze({'coverage-history-080628':[false,true],'coverage-history-083054':[false,true],'heldout-person':[true],'heldout-description':[true],'heldout-unseen-native':[true],'control-native-title':[true],'control-low-vote-title':[true]});
export function requireV4PacketSet(packets){
 const counts=new Map(),seen=new Set();
 if(packets.length!==9)throw Error('private_v4_packet_set');
 for(const packet of packets){
  const flags=V4_CASES[packet.tag];if(!flags)throw Error('private_v4_packet_set');
  counts.set(packet.tag,(counts.get(packet.tag)||0)+1);
  if(packet.kind==='private-batch'){
   const key=packet.tag+':'+packet.lesserKnown;
   if(!flags.includes(packet.lesserKnown)||seen.has(key))throw Error('private_v4_packet_set');seen.add(key);
  }else if(packet.kind!=='private-excluded'||flags.length!==1||('lesserKnown' in packet&&packet.lesserKnown!==true))throw Error('private_v4_packet_set');
 }
 for(const [tag,flags] of Object.entries(V4_CASES))if(counts.get(tag)!==flags.length)throw Error('private_v4_packet_set');
 if(!seen.has('control-native-title:true'))throw Error('required_native_control_missing');
 return {maximumPairs:9,maximumWriterReceipts:18,mandatoryPair:'control-native-title:true',ambiguousHistoryExclusions:'refused',singletonExcludedFlag:'unique-true-slot',receiptScope:'fresh-v5-flat-stage'};
}

export function requireNineActualPacketSet(packets){
 if(!Array.isArray(packets)||packets.length!==9||packets.some(packet=>packet?.kind!=='private-batch'))throw new ContractFailure('cpu0_fixed_nine_batches_required');
 requireV4PacketSet(packets);
 return {requiredPairs:9,excluded:0,maximumWriterReceipts:18,mandatoryPair:'control-native-title:true'};
}

export function fixedCapacityArguments(argv){
 const names=['--handoff-sha256','--cpu0-source-freeze-sha256','--external-manifest-sha256'];
 if(!Array.isArray(argv)||![7,8].includes(argv.length)||argv[0]!==FIXED_CAPACITY_SELECTOR||(argv.length===8&&argv[7]!=='--raise-own-nofile'))throw new ContractFailure('cpu0_fixed_arguments_invalid');
 const values={};for(let i=0;i<names.length;i++){if(argv[1+2*i]!==names[i]||!HASH.test(argv[2+2*i]||''))throw new ContractFailure('cpu0_fixed_arguments_invalid');values[names[i]]=argv[2+2*i];}
 return {values,raiseOwnNofile:argv.length===8};
}

function within(promise,milliseconds){let timer;return Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(null),milliseconds)})]).finally(()=>clearTimeout(timer));}
export function publicFailure(error,operation='preflight'){
 const allowed=new Set(['cpu0_control_ready_timeout','cpu0_control_spawn_failed','cpu0_control_before_ready_failed','cpu0_control_phase_failed','cpu0_control_frame_failed','cpu0_control_cleanup_timeout','cpu0_query_timeout','cpu0_query_transport_failure','cpu0_query_response_invalid']);
 return {reason:error instanceof ContractFailure?error.reason:allowed.has(error?.message)?error.message:'cpu0_comparison_refused',failureKind:error instanceof ContractFailure?'contract':operation,productionAcceptance:false};
}
export async function controlledBatch(packet,phase,expected,paths,priorHandoff,queryBatch,{spawnControl=spawn,budgets={ready:1200000,cleanup:15000,reaped:5000},raiseOwnNofile=false}={}){
 recordedHandoff(priorHandoff,priorHandoff?.sha256);
 if(!['baseline','candidate'].includes(phase)||realpathSync(paths.code)!==paths.code||realpathSync(paths.config)!==paths.config||digest(readFileSync(paths.code))!==expected.controllerCodeSha256||digest(readFileSync(paths.config))!==expected.controllerPolicySha256)throw Error('cpu0_control_freeze_changed');
 const child=spawnControl('/usr/bin/python3',['-I','-B',paths.code,'--execute-reviewed','--config',paths.config,'--policy-sha256',expected.controllerPolicySha256,'--code-sha256',expected.controllerCodeSha256,'--phase',phase,'--case-tag',packet.tag,'--handoff-sha256',priorHandoff.sha256,'--raise-own-memlock',...(raiseOwnNofile?['--raise-own-nofile']:[])],{stdio:['pipe','pipe','pipe'],env:CONTROL_ENV});
 const frames=[];let readyResolve,readyReject,closedResolve,batch,closeObserved=false,terminationSent=false,protocolError=null,operation='readiness';
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});const closed=new Promise(resolve=>{closedResolve=resolve});
 const terminate=()=>{if(!closeObserved&&!terminationSent){terminationSent=true;child.kill('SIGTERM')}};
 const timer=setTimeout(()=>{readyReject(Error('cpu0_control_ready_timeout'));terminate()},budgets.ready);
 child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
 child.on('error',()=>readyReject(Error('cpu0_control_spawn_failed')));
 child.on('close',(code,signal)=>{closeObserved=true;clearTimeout(timer);if(!frames.some(frame=>frame.stage==='query-ready'))readyReject(Error('cpu0_control_before_ready_failed'));closedResolve({code,signal})});
 let stdoutBytes=0;child.stdout.on('data',part=>{stdoutBytes+=part.length;if(stdoutBytes>7*131072){protocolError=Error('cpu0_control_frame_failed');readyReject(protocolError);terminate();}});
 const reader=(async()=>{try{for await(const line of readline.createInterface({input:child.stdout,crlfDelay:Infinity})){
  if(Buffer.byteLength(line)>131072||frames.length>=7)throw Error('cpu0_control_frame_failed');
  const frame=JSON.parse(line);frames.push(frame);
  if(frame.stage==='failed'||frame.stage==='phase-failed'){protocolError=Error('cpu0_control_phase_failed');readyReject(protocolError);continue;}
  if(frame.stage==='query-ready'){readinessEvidence(frames,phase,expected,priorHandoff,{requireRed:packet.tag==='control-native-title'});readyResolve();}
 }}catch(error){protocolError=error instanceof ContractFailure?error:Error('cpu0_control_frame_failed');readyReject(protocolError);terminate()}})();
 try{
  await ready;clearTimeout(timer);if(protocolError)throw protocolError;operation='query';
  batch=await queryBatch(packet.collection,packet.queries,{timeoutMs:30000});
  if(batch.socketClosed!==true)throw new ContractFailure('cpu0_query_client_release_unproven');
  if(protocolError||closeObserved)throw Error('cpu0_control_phase_failed');
  child.stdin.end('{"stage":"query-finished"}\n');operation='cleanup';
  const exit=await within(closed,budgets.cleanup);if(exit===null)throw Error('cpu0_control_cleanup_timeout');
  await reader;if(protocolError)throw protocolError;operation='contract';
  const metrics=phaseEvidence(frames,exit.code,phase,expected,batch,{requireRed:packet.tag==='control-native-title',priorHandoffSha256:priorHandoff.sha256,priorHandoff});
  return {metrics,frames,queryTransport:{socketClosed:batch.socketClosed},controllerExit:{code:exit.code,signal:exit.signal,observed:closeObserved},handoff:frames[4].handoff,hashes:{resultIdHash:orderedIds(batch.results),resultIdScoreHash:orderedIdsScores(batch.results),resultSetHash:idSets(batch.results),resultScoreSetHash:idScoreSets(batch.results)},counts:batch.results.map(row=>row.length)};
 }catch(error){
  terminate();let exit=await within(closed,budgets.cleanup);if(exit===null){child.kill('SIGKILL');exit=await within(closed,budgets.reaped)}
  if(closeObserved)await reader;
  const failure=Error('cpu0_comparison_refused');
  // Project only validated fixed lifecycle/resource evidence; never retain raw failed frames.
  failure.publicEvidence={...publicFailure(error,operation),variant:VARIANT,previousHandoffSha256:priorHandoff.sha256,controllerExitCode:exit?.code??null,controllerExitSignal:exit?.signal??null,exitObserved:closeObserved,cleanupObserved:frames.some(frame=>frame.stage==='released'&&frame.released===true&&frame.pinChildExited===true),handoffAccepted:false,failureEvidence:failureEvidence(frames)};throw failure;
 }finally{clearTimeout(timer);if(!closeObserved)child.kill('SIGKILL');}
}

export async function controlledBatchV2(packet,phase,expected,paths,priorHandoff,queryBatch,{spawnControl=spawn,budgets={ready:1200000,cleanup:15000,reaped:5000},raiseOwnNofile=false,context}={}){
 recordedHandoffV2(priorHandoff,priorHandoff?.sha256,{adoptionIntentSha256:context?.adoptionIntentSha256,previousSha256:priorHandoff?.previousSha256});
 if(!['baseline','candidate'].includes(phase)||realpathSync(paths.code)!==paths.code||realpathSync(paths.config)!==paths.config||digest(readFileSync(paths.code))!==expected.controllerCodeSha256||digest(readFileSync(paths.config))!==expected.controllerPolicySha256)throw Error('cpu0_control_freeze_changed');
 const child=spawnControl('/usr/bin/python3',['-I','-B',paths.code,'--execute-reviewed','--config',paths.config,'--policy-sha256',expected.controllerPolicySha256,'--code-sha256',expected.controllerCodeSha256,'--phase',phase,'--case-tag',packet.tag,'--handoff-sha256',priorHandoff.sha256,'--raise-own-memlock',...(raiseOwnNofile?['--raise-own-nofile']:[])],{stdio:['pipe','pipe','pipe'],env:CONTROL_ENV});
 const frames=[];let readyResolve,readyReject,closedResolve,batch,closeObserved=false,terminationSent=false,protocolError=null,operation='readiness';
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject});const closed=new Promise(resolve=>{closedResolve=resolve});
 const terminate=()=>{if(!closeObserved&&!terminationSent){terminationSent=true;child.kill('SIGTERM')}};
 const timer=setTimeout(()=>{readyReject(Error('cpu0_control_ready_timeout'));terminate()},budgets.ready);
 child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
 child.on('error',()=>readyReject(Error('cpu0_control_spawn_failed')));
 child.on('close',(code,signal)=>{closeObserved=true;clearTimeout(timer);if(!frames.some(frame=>frame.stage==='query-ready'))readyReject(Error('cpu0_control_before_ready_failed'));closedResolve({code,signal})});
 let stdoutBytes=0;child.stdout.on('data',part=>{stdoutBytes+=part.length;if(stdoutBytes>7*131072){protocolError=Error('cpu0_control_frame_failed');readyReject(protocolError);terminate();}});
 const reader=(async()=>{try{for await(const line of readline.createInterface({input:child.stdout,crlfDelay:Infinity})){
  if(Buffer.byteLength(line)>131072||frames.length>=7)throw Error('cpu0_control_frame_failed');
  const frame=JSON.parse(line);frames.push(frame);
  if(frame.stage==='failed'||frame.stage==='phase-failed'){protocolError=Error('cpu0_control_phase_failed');readyReject(protocolError);continue;}
  if(frame.stage==='query-ready'){readinessEvidenceV2(frames,phase,expected,priorHandoff,{context,requireRed:packet.tag==='control-native-title'});readyResolve();}
 }}catch(error){protocolError=error instanceof ContractFailure?error:Error('cpu0_control_frame_failed');readyReject(protocolError);terminate()}})();
 try{
  await ready;clearTimeout(timer);if(protocolError)throw protocolError;operation='query';
  batch=await queryBatch(packet.collection,packet.queries,{timeoutMs:30000});
  if(batch.socketClosed!==true)throw new ContractFailure('cpu0_query_client_release_unproven');
  if(protocolError||closeObserved)throw Error('cpu0_control_phase_failed');
  child.stdin.end('{"stage":"query-finished"}\n');operation='cleanup';
  const exit=await within(closed,budgets.cleanup);if(exit===null)throw Error('cpu0_control_cleanup_timeout');
  await reader;if(protocolError)throw protocolError;operation='contract';
  const metrics=phaseEvidenceV2(frames,exit.code,phase,expected,batch,{context,requireRed:packet.tag==='control-native-title',priorHandoffSha256:priorHandoff.sha256,priorHandoff});
  return {metrics,frames,queryTransport:{socketClosed:batch.socketClosed},controllerExit:{code:exit.code,signal:exit.signal,observed:closeObserved},handoff:frames[4].handoff,hashes:{resultIdHash:orderedIds(batch.results),resultIdScoreHash:orderedIdsScores(batch.results),resultSetHash:idSets(batch.results),resultScoreSetHash:idScoreSets(batch.results)},counts:batch.results.map(row=>row.length)};
 }catch(error){
  terminate();let exit=await within(closed,budgets.cleanup);if(exit===null){child.kill('SIGKILL');exit=await within(closed,budgets.reaped)}
  if(closeObserved)await reader;
  const failure=Error('cpu0_comparison_refused');
  // Project only validated fixed lifecycle/resource evidence; never retain raw failed frames.
  failure.publicEvidence={...publicFailure(error,operation),variant:FIXED_CAPACITY_VARIANT,previousHandoffSha256:priorHandoff.sha256,controllerExitCode:exit?.code??null,controllerExitSignal:exit?.signal??null,exitObserved:closeObserved,cleanupObserved:frames.some(frame=>frame.stage==='released'&&frame.released===true&&frame.pinChildExited===true),handoffAccepted:false,failureEvidence:failureEvidenceV2(frames,priorHandoff,context)};throw failure;
 }finally{clearTimeout(timer);if(!closeObserved)child.kill('SIGKILL');}
}

function privateRead(path,limit,mode){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const before=fstatSync(fd);if(!before.isFile()||before.uid!==0||before.nlink!==1||(before.mode&0o777)!==mode||before.size>limit)throw Error('cpu0_file_scope_invalid');const bytes=readFileSync(fd);const after=fstatSync(fd);if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||bytes.length!==before.size)throw Error('cpu0_file_changed');return bytes;}finally{closeSync(fd);}}
export function verifyFullStageV2(sourceFreezeSha256,externalManifestSha256,{stage=FIXED_CAPACITY_STAGE}={}){
 if(!HASH.test(sourceFreezeSha256||'')||!HASH.test(externalManifestSha256||'')||realpathSync(stage)!==stage)throw new ContractFailure('cpu0_fixed_stage_scope_invalid');
 if(readdirSync(stage).sort().join(',')!==[...FULL_NAMES,'cpu0-external-manifest.json','node','node-provenance.json'].sort().join(','))throw new ContractFailure('cpu0_fixed_stage_inventory_invalid');
 const closure=verifyExternalPacketV2(privateRead(stage+'/cpu0-external-manifest.json',32768,0o600),externalManifestSha256,name=>privateRead(stage+'/'+name,1024**2,0o600));
 if(closure.externalManifest.sourceFreezeSha256!==sourceFreezeSha256)throw new ContractFailure('cpu0_fixed_source_manifest_changed');
 return closure;
}
export async function runEntryPreflight(expected,prior,{spawnControl=spawn,budgets={operation:120000,cleanup:15000,reaped:5000},stage=STAGE}={}){
 const child=spawnControl('/usr/bin/python3',['-I','-B',stage+'/cpu0_preflight.py',stage+'/helper-config.json',expected.helperPolicySha256,expected.helperCodeSha256,stage+'/controller-config.json',expected.controllerPolicySha256,prior.sha256],{stdio:['ignore','pipe','pipe'],env:CONTROL_ENV});
 let raw='',invalid=false;child.stdout.on('data',part=>{if(Buffer.byteLength(raw)+part.length>131072){invalid=true;child.kill('SIGTERM');}else raw+=part;});child.stderr.on('data',()=>{});
 const closed=new Promise(resolve=>{child.on('error',()=>resolve({code:null,signal:null}));child.on('close',(code,signal)=>resolve({code,signal}));});
 let exit=await within(closed,budgets.operation);
 if(exit===null){child.kill('SIGTERM');exit=await within(closed,budgets.cleanup);if(exit===null){child.kill('SIGKILL');exit=await within(closed,budgets.reaped);}}
 let value;try{const lines=raw.trim().split('\n');if(lines.length!==1||invalid)throw Error();value=JSON.parse(lines[0]);}catch{const error=Error('cpu0_preflight_invalid');error.publicEvidence={...publicFailure(error,'preflight'),exitObserved:exit!==null,controllerExitCode:exit?.code??null,controllerExitSignal:exit?.signal??null,evidenceUnavailable:true};throw error;}
 if(!exit||exit.code!==0){const error=Error('cpu0_preflight_refused');error.publicEvidence={...publicFailure(error,'preflight'),exitObserved:exit!==null,controllerExitCode:exit?.code??null,controllerExitSignal:exit?.signal??null,failureEvidence:failureEvidence([value]),handoffAccepted:false};throw error;}

 return preflightEvidence(value,prior);
}

export async function runEntryPreflightV2(expected,prior,{spawnControl=spawn,budgets={operation:120000,cleanup:15000,reaped:5000},stage=FIXED_CAPACITY_STAGE,procRoot='/proc'}={}){
 const child=spawnControl('/usr/bin/python3',['-I','-B',stage+'/cpu0_preflight.py',stage+'/helper-config.json',expected.helperPolicySha256,expected.helperCodeSha256,stage+'/controller-config.json',expected.controllerPolicySha256,prior.sha256],{stdio:['ignore','pipe','pipe'],env:CONTROL_ENV});
 let birth=null,raw='',invalid=false,closeObserved=false;
 child.once('spawn',()=>{try{const observed=procStat(procRoot+'/'+child.pid+'/stat');if(observed.parentPid!==process.pid)throw Error();birth={pid:child.pid,...observed};}catch{birth=null;}});
 child.stdout.on('data',part=>{if(Buffer.byteLength(raw)+part.length>131072){invalid=true;child.kill('SIGTERM');}else raw+=part;});child.stderr.on('data',()=>{});
 const closed=new Promise(resolve=>{child.on('error',()=>resolve({code:null,signal:null}));child.on('close',(code,signal)=>{closeObserved=true;resolve({code,signal});});});
 let exit=await within(closed,budgets.operation);
 if(exit===null){child.kill('SIGTERM');exit=await within(closed,budgets.cleanup);if(exit===null){child.kill('SIGKILL');exit=await within(closed,budgets.reaped);}}
 let birthGone=null;
 if(birth&&closeObserved){try{birthGone=procStat(procRoot+'/'+birth.pid+'/stat').startTicks!==birth.startTicks;}catch(error){if(error.code==='ENOENT')birthGone=true;}}
 const preflightExit={observed:closeObserved,exitCode:exit?.code??null,signal:exit?.signal??null,birthGone};
 let parsed=null,receipt=null;
 try{
  const lines=raw.trim().split('\n');if(lines.length!==1||invalid)throw new ContractFailure('cpu0_fixed_preflight_output_invalid');
  parsed=JSON.parse(lines[0]);if(parsed?.stage==='failed')throw new ContractFailure('cpu0_fixed_preflight_refused');
  receipt=consumerPreflightEvidenceV2(parsed,prior,expected);
  const identity=receipt.consumerEnrolment.preflight.identity;
  if(!birth||identity.pid!==birth.pid||identity.startTicks!==birth.startTicks||identity.parentPid!==birth.parentPid||receipt.consumerEnrolment.consumer.identity.pid!==process.pid)throw new ContractFailure('cpu0_fixed_preflight_birth_changed');
  if(!closeObserved||exit?.code!==0||exit?.signal!==null||birthGone!==true)throw new ContractFailure('cpu0_fixed_preflight_exit_unproven');
  return {receipt,preflightExit};
 }catch(error){
  const refused=new ContractFailure(error instanceof ContractFailure?error.reason:'cpu0_fixed_preflight_output_invalid');
  refused.publicEvidence={...publicFailure(refused,'preflight'),variant:FIXED_CAPACITY_VARIANT,preflightExit,handoffAccepted:false,preflightReceipt:receipt,failureEvidence:failureEvidenceV2(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?[parsed]:[],prior,expected)};throw refused;
 }
}

export function baselineRow(packet,baseline){return {kind:'baseline-batch',variant:VARIANT,tag:packet.tag,lesserKnown:packet.lesserKnown,indexBuildId:packet.indexBuildId,queryCount:packet.queries.length,signals:packet.queries.map(signal),baseline:baseline.metrics,baselineControlEvidence:baseline.frames,baselineControllerExit:baseline.controllerExit,baselineTransport:baseline.queryTransport,baselineHashes:baseline.hashes,resultCounts:baseline.counts,productionAcceptance:false};}
export function pairedRow(packet,baseline,candidate,parity){return {...baselineRow(packet,baseline),kind:'paired-batch',candidate:candidate.metrics,...parity,candidateControlEvidence:candidate.frames,candidateControllerExit:candidate.controllerExit,candidateTransport:candidate.queryTransport,candidateHashes:candidate.hashes};}
function procBytes(path,limit){const fd=openSync(path,constants.O_RDONLY);try{const bytes=Buffer.alloc(limit+1);const n=readSync(fd,bytes,0,bytes.length,0);if(n>limit)throw Error('cpu0_consumer_birth_invalid');return bytes.subarray(0,n);}finally{closeSync(fd);}}
function procStat(path){const raw=procBytes(path,8192).toString();const fields=raw.slice(raw.lastIndexOf(')')+2).trim().split(/\s+/);const ticks=Number(fields[19]),parentPid=Number(fields[1]);if(!Number.isSafeInteger(ticks)||ticks<=0||!Number.isSafeInteger(parentPid)||parentPid<=0)throw Error('cpu0_consumer_birth_invalid');return{startTicks:ticks,parentPid};}
function procGroup(bytes){const rows=bytes.toString().trim().split('\n');if(rows.length!==1||!rows[0].startsWith('0::/'))throw Error('cpu0_consumer_birth_invalid');const group=rows[0].slice(3);if(group.split('/').some(x=>['.','..'].includes(x))||group.includes('//')||(group!=='/'&&group.endsWith('/'))||/[\x00-\x1f]/.test(group))throw Error('cpu0_consumer_birth_invalid');return group;}
export function consumerBirth(target,{procRoot='/proc',pid=process.pid}={}){
 const own=procRoot+'/'+pid,source=procRoot+'/'+target.qdrant.pid;const first=procStat(own+'/stat'),sourceFirst=procStat(source+'/stat');const ownGroup=procBytes(own+'/cgroup',8192),sourceGroup=procBytes(source+'/cgroup',8192);const ownPath=procGroup(ownGroup),sourcePath=procGroup(sourceGroup);
 const exe=statSync(own+'/exe'),sourceExe=statSync(source+'/exe');const exeHash=info=>digest(Buffer.from(JSON.stringify([info.dev,info.ino,info.size])));const status=procBytes(own+'/status',65536).toString();const rows=status.split('\n').filter(row=>row.startsWith('VmLck:'));const vm=rows.length===1&&/^VmLck:\s+0\s+kB$/.test(rows[0]);
 const final=procStat(own+'/stat'),sourceFinal=procStat(source+'/stat');if(!vm||exeHash(exe)!==exeHash(statSync(own+'/exe'))||exeHash(sourceExe)!==target.qdrant.exeIdentityHash||exeHash(sourceExe)!==exeHash(statSync(source+'/exe'))||sourceFirst.startTicks!==target.qdrant.startTicks||sourceFinal.startTicks!==sourceFirst.startTicks||digest(sourceGroup)!==target.qdrant.groupHash||!sourceGroup.equals(procBytes(source+'/cgroup',8192))||!ownGroup.equals(procBytes(own+'/cgroup',8192))||JSON.stringify(first)!==JSON.stringify(final)||ownPath===sourcePath||ownPath.startsWith(sourcePath+'/'))throw Error('cpu0_consumer_birth_invalid');
 return {pid,startTicks:first.startTicks,parentPid:first.parentPid,exeIdentityHash:exeHash(exe),groupHash:digest(ownGroup),VmLckBytes:0,outsideSourceCgroup:true};
}

export async function mainV2(){
 const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
 const args=fixedCapacityArguments(process.argv.slice(2));
 if(process.getuid()!==0||process.env.QDRANT_URL!=='http://127.0.0.1:16333/'||realpathSync(FIXED_CAPACITY_STAGE)!==FIXED_CAPACITY_STAGE)throw new ContractFailure('cpu0_fixed_execution_scope_invalid');
 const closure=verifyFullStageV2(args.values['--cpu0-source-freeze-sha256'],args.values['--external-manifest-sha256']);
 const raw=privateRead(ROOT+'/cpu0-lifecycle-handoff-v2.json',32768,0o600);
 let prior={...JSON.parse(raw),sha256:digest(raw)};
 const context={...closure.expected,sourceFreezeSha256:args.values['--cpu0-source-freeze-sha256'],externalManifestSha256:args.values['--external-manifest-sha256'],adoptionIntentSha256:prior.adoptionIntentSha256,nodeProvenanceSha256:digest(privateRead(FIXED_CAPACITY_STAGE+'/node-provenance.json',65536,0o600))};
 recordedHandoffV2(prior,args.values['--handoff-sha256'],{adoptionIntentSha256:context.adoptionIntentSha256,previousSha256:prior.previousSha256});
 const {receipt,preflightExit}=await runEntryPreflightV2(context,prior);
 const admissionFrame={kind:'consumer-admission',...receipt,consumerBirth:consumerBirth(receipt.birthAdmission.target),preflightExit,sourceFreezeSha256:args.values['--cpu0-source-freeze-sha256'],externalManifestSha256:args.values['--external-manifest-sha256'],productionAcceptance:false};
 validateAdmissionFrameV2(admissionFrame,prior,context);context.consumerEnrolment=receipt.consumerEnrolment;context.consumerEnrolmentSha256=receipt.consumerEnrolmentSha256;prior=receipt.handoff;emit(admissionFrame);
 const packets=await packetsFrom(process.stdin);requireNineActualPacketSet(packets);packets.sort((a,b)=>(a.tag==='control-native-title'?0:1)-(b.tag==='control-native-title'?0:1));
 const paths={code:FIXED_CAPACITY_STAGE+'/controller_cpu0.py',config:FIXED_CAPACITY_STAGE+'/controller-config.json'};let nativePassed=false,pairs=0;
 for(const packet of packets){
  if(packet.indexBuildId!=='20261011T041503Z'||(packet.tag!=='control-native-title'&&!nativePassed))throw new ContractFailure('cpu0_fixed_private_packet_scope_invalid');
  const run=async phase=>{const client=createDirectClient();const result=await controlledBatchV2(packet,phase,closure.expected,paths,prior,client.queryBatch.bind(client),{raiseOwnNofile:args.raiseOwnNofile,context});if(client.openSockets!==0)throw new ContractFailure('cpu0_client_retained');context.consumerRegistrationSha256=result.metrics.consumerRegistrationSha256;prior=result.handoff;return result;};
  const baseline=await run('baseline');emit({...baselineRow(packet,baseline),variant:FIXED_CAPACITY_VARIANT});
  const candidate=await run('candidate'),parity=pairedEvidence(baseline.metrics,candidate.metrics,baseline.hashes,candidate.hashes);pairs++;if(packet.tag==='control-native-title')nativePassed=true;
  emit({...pairedRow(packet,baseline,candidate,parity),variant:FIXED_CAPACITY_VARIANT});
 }
 if(pairs!==9||!nativePassed)throw new ContractFailure('cpu0_fixed_nine_pairs_required');
 emit({kind:'complete',variant:FIXED_CAPACITY_VARIANT,pairs,excluded:0,initialHandoffSha256:args.values['--handoff-sha256'],finalHandoffSha256:prior.sha256,sourceFreezeSha256:args.values['--cpu0-source-freeze-sha256'],externalManifestSha256:args.values['--external-manifest-sha256'],productionAcceptance:false});
}

export async function main(){
 if(process.argv[2]===FIXED_CAPACITY_SELECTOR)return mainV2();
 const emit=value=>process.stdout.write(JSON.stringify(value)+'\n');
 if(process.argv[2]!=='--execute-reviewed'){emit({kind:'prepared-only',variant:VARIANT,queries:0,payloadPersistence:false,productionAcceptance:false});return;}
 if(process.getuid()!==0||process.env.QDRANT_URL!=='http://127.0.0.1:16333/'||realpathSync(STAGE)!==STAGE)throw Error('cpu0_execution_scope_invalid');
 const names=['--handoff-sha256','--cpu0-source-freeze-sha256','--external-manifest-sha256'];const args=process.argv.slice(3),values={};let raiseOwnNofile=false;
 while(args.length){const name=args.shift();if(name==='--raise-own-nofile'&&!raiseOwnNofile){raiseOwnNofile=true;continue;}if(!names.includes(name)||Object.hasOwn(values,name)||!HASH.test(args[0]||''))throw Error('cpu0_arguments_invalid');values[name]=args.shift();}
 if(Object.keys(values).length!==3)throw Error('cpu0_arguments_invalid');
 const inventory=readdirSync(STAGE).sort();if(inventory.join(',')!==[...FULL_NAMES,'cpu0-external-manifest.json','node','node-provenance.json'].sort().join(','))throw Error('cpu0_stage_inventory_invalid');
 const closure=verifyExternalPacket(privateRead(STAGE+'/cpu0-external-manifest.json',32768,0o600),values['--external-manifest-sha256'],name=>privateRead(STAGE+'/'+name,1024**2,0o600));
 if(closure.externalManifest.sourceFreezeSha256!==values['--cpu0-source-freeze-sha256'])throw Error('cpu0_source_manifest_changed');
 const receiptBytes=privateRead(ROOT+'/cpu0-lifecycle-handoff-v1.json',32768,0o600);let prior={...JSON.parse(receiptBytes),sha256:digest(receiptBytes)};recordedHandoff(prior,values['--handoff-sha256']);
 const admission=await runEntryPreflight(closure.expected,prior);const admissionFrame={kind:'consumer-admission',variant:VARIANT,...admission,consumerBirth:consumerBirth(admission.birthAdmission.target),sourceFreezeSha256:values['--cpu0-source-freeze-sha256'],externalManifestSha256:values['--external-manifest-sha256'],productionAcceptance:false};validateAdmissionFrame(admissionFrame,prior,{sourceFreezeSha256:values['--cpu0-source-freeze-sha256'],externalManifestSha256:values['--external-manifest-sha256']});prior=admission.handoff;emit(admissionFrame);
 const packets=await packetsFrom(process.stdin);requireV4PacketSet(packets);packets.sort((a,b)=>(a.tag==='control-native-title'?0:1)-(b.tag==='control-native-title'?0:1));
 const paths={code:STAGE+'/controller_cpu0.py',config:STAGE+'/controller-config.json'};let nativePassed=false,pairs=0;
 for(const packet of packets){
  if(packet.kind==='private-excluded'){emit({kind:'excluded',variant:VARIANT,tag:packet.tag,reason:'private_source_or_coverage_unavailable',productionAcceptance:false});continue;}
  if(packet.indexBuildId!=='20261011T041503Z'||(packet.tag!=='control-native-title'&&!nativePassed))throw Error('cpu0_private_packet_scope_invalid');
  const run=async phase=>{const client=createDirectClient();const result=await controlledBatch(packet,phase,closure.expected,paths,prior,client.queryBatch.bind(client),{raiseOwnNofile});if(client.openSockets!==0)throw Error('cpu0_client_retained');prior=result.handoff;return result;};
  const baseline=await run('baseline');emit(baselineRow(packet,baseline));
  const candidate=await run('candidate');const parity=pairedEvidence(baseline.metrics,candidate.metrics,baseline.hashes,candidate.hashes);pairs++;if(packet.tag==='control-native-title')nativePassed=true;
  emit(pairedRow(packet,baseline,candidate,parity));
 }
 emit({kind:'complete',variant:VARIANT,pairs,initialHandoffSha256:values['--handoff-sha256'],finalHandoffSha256:prior.sha256,sourceFreezeSha256:values['--cpu0-source-freeze-sha256'],externalManifestSha256:values['--external-manifest-sha256'],productionAcceptance:false});
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===realpathSync(process.argv[1]))main().catch(error=>{process.stdout.write(JSON.stringify({kind:'failed',...(error.publicEvidence||publicFailure(error))})+'\n');process.exitCode=1});
