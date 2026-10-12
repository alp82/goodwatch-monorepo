// Prepared private-pipe comparison. Complete producer exit fence precedes all clone I/O.
import {verifyFrozenSources} from './source-freeze.mjs';
import readline from 'node:readline';
import {spawn} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import crypto from 'node:crypto';
import {orderedIds,orderedIdsScores,idSets,idScoreSets,signal} from './parity.mjs';
import {phaseEvidence,pairedEvidence,ContractFailure,CONTROL_READY_SECONDS} from './compare-contract.mjs';
import {hasLookup} from './producer-guard.mjs';
const ROOT='/root/goodwatch-qdrant-cold-406-20261011';
const STAGE=ROOT+'/pin-control-20261012-406-v4';
console.info=()=>{};console.warn=()=>{};console.error=()=>{};
const emit=x=>process.stdout.write(JSON.stringify(x)+'\n');
const ALLOWED_REASONS=new Set(['source_changed_after_cache_preparation','writer_registration_timeout','writer_protocol_failed','writer_prewrite_timeout','cache_preparation_freeze_changed','cache_preparation_policy_changed','explicit_cache_preparation_required','source_changed','swap_present','locked_source_pages','dirty_source_pages','source_children_present','source_limits_changed','ancestor_limits_changed','parent_placement_changed','reclaim_fd_changed','reclaim_timeout','reclaim_writer_survived','reclaim_write_failed','reclaim_resource_event','post_cap_fit_inconclusive','metadata_health_changed','source_freeze_changed','invalid_reclaim_lock','prepared_input_changed','writer_start_failed','quiescence_bound_exceeded','writer_birth_unavailable','writer_birth_changed','writer_registration_failed','writer_parent_changed','writer_interrupted','writer_cleanup_unproven',"own_nofile_state_unavailable","own_nofile_baseline_bound_exceeded","own_nofile_hard_limit_insufficient","explicit_own_nofile_raise_required","own_nofile_raise_failed","own_nofile_state_changed","invalid_own_nofile_policy","action_not_in_frozen_policy", "actual_qdrant_comm_changed", "actual_qdrant_pid_ambiguous", "archive_checksum_or_identity_changed", "archive_fd_path_identity", "archive_identity_failed", "archive_path_changed_before_advice", "archive_path_scope", "archive_scope", "archive_store_inode_alias", "archive_verification_bound", "archive_verification_failed", "candidate_cohort_changed", "clone_control_command_failed", "clone_identity_ambiguous", "clone_identity_changed", "clone_loopback_changed", "clone_mount_changed", "clone_not_stopped", "clone_ownership_changed", "clone_pressure_window_required", "clone_readiness_failed", "clone_resource_or_port_changed", "cold_collection_shape_changed", "cold_eviction_not_complete", "cold_inode_changed", "cold_start_headroom", "control_freeze_changed", "controller_cgroup_missing", "controller_interrupted", "controller_pressure_already_in_clone_cgroup", "counter_pid_reused", "counter_reset", "counter_source_changed", "docker_inspection_failed", "duplicate_target_inode", "emergency_headroom_release", "expected_pin_class_coverage_missing", "explicit_actions_required", "explicit_cap_and_mapping_reserves_required", "explicit_control_arguments_required", "explicit_control_policy_required", "explicit_frozen_config_required", "explicit_measure_selection_required", "explicit_own_memlock_raise_required", "explicit_policy_required", "explicit_pressure_floor_required", "explicit_source_required", "extent_inventory_bound_exceeded", "extent_ranges_changed_during_locking", "extent_semantics_invalid", "extent_semantics_unavailable", "fixed_clone_resources_required", "fixed_clone_source_required", "fixed_readonly_archive_required", "four_class_policy_required", "frozen_digests_required", "frozen_input_changed", "gate_freeze_changed", "gate_interrupted", "guard_or_runtime_failure", "helper_accounting_not_joined", "helper_freeze_changed", "helper_timing_policy_changed", "host_emergency_floor", "host_mapped_inode_changed", "initial_cap_fit_inconclusive", "initial_cap_headroom_inconclusive", "initial_cohort_changed", "initial_pin_cpu_limit_event", "initial_pin_memory_limit_event", "invalid_cli_arguments", "invalid_control_lock", "invalid_instance_lock", "invalid_measure_state", "invalid_memory_accounting", "invalid_numeric_policy", "invalid_pin_command", "invalid_query_ack", "invalid_residency_accounting", "invalid_runtime_state", "invalid_selection_digest", "join_source_changed", "limit_metrics_reset_during_pass", "local_source_identity_changed", "lock_budget_or_rlimit_unavailable", "locked_data_residency_incomplete", "locked_residency_incomplete", "mapped_device_changed", "mapped_file_inventory_bound_exceeded", "mapped_shard_coverage_missing", "mapping_limit_unavailable", "measure_cannot_raise_limits", "negative_missing_pages_inconclusive", "outside_source_inspector_required", "owned_inode_alias", "owned_nonregular", "owned_root_changed", "owned_root_nonregular", "owned_root_symlink", "owned_size_guard", "owned_symlink", "owned_total_disk_budget", "parent_already_clone_cgroup", "parent_cgroup_changed", "parent_inspection_inside_clone_cgroup", "phase_required", "phase_resource_failed", "pin_capability_missing", "pin_child_cleanup", "pin_child_exit_failed", "pin_child_exit_unproven", "pin_child_failed", "pin_child_placement", "pin_child_timeout", "pin_holder_lock_proof_missing", "pin_kernel_operation_failed", "pin_release_failed", "pin_release_unproven", "policy_source_mode_mismatch", "predeclared_negative_control_required", "pressure_bound_failed", "pressure_cannot_fit_deadline", "pressure_cohort_changed", "pressure_ledger_missing", "pressure_placement_required", "pressure_writer_placement_changed", "production_headroom_guard_cannot_be_relaxed", "projected_headroom_below_reserve", "projected_mapping_limit_exceeded", "query_cohort_changed", "query_lease_eof", "query_lease_timeout", "query_pin_cohort_changed", "query_source_changed", "range_identity_missing", "range_outside_file", "readonly_mapping_failed", "required_limit_metrics_missing", "residency_measurement_failed", "root_helper_required", "selected_target_descriptor_required", "source_cgroup_changed", "source_changed_before_helper_accounting", "source_changed_during_inventory", "source_changed_during_measurement", "source_changed_during_pressure", "source_identity_changed", "source_image_or_running_changed", "source_mounts_changed", "source_or_emergency_headroom_changed_after_locking", "source_resources_changed", "source_rpc_budget", "source_rpc_failed", "source_rpc_spec_changed", "source_rpc_timeout", "source_spec_changed", "target_anon_kernel_exceeds_cgroup_cap", "target_identity_changed", "target_not_owned_regular_single_link_file", "target_path_scope_changed", "turnover_not_fresh", "turnover_readiness_failed", "turnover_shape_changed", "unreviewed_production_container", "unreviewed_source_spec", "zero_child_cleanup_failed", "zero_child_exit_unproven", "zero_child_lease_failed", "zero_child_timeout", "zero_join_failed", "zero_join_proof_missing", "zero_pin_proof_missing"]);
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
 return {maximumPairs:9,maximumWriterReceipts:18,mandatoryPair:'control-native-title:true',ambiguousHistoryExclusions:'refused',singletonExcludedFlag:'unique-true-slot',receiptScope:'fresh-v4-flat-stage'};
}
function digest(path){return crypto.createHash('sha256').update(readFileSync(path)).digest('hex');}
const PUBLIC_PROTOCOL_REASONS=new Set(['control_ready_timeout','control_spawn_failed','control_before_ready_failed','control_phase_failed','control_frame_failed','control_cleanup_timeout','controller_freeze_changed']);
const NETWORK_CODES=new Set(['ETIMEDOUT','EAI_AGAIN','ECONNRESET','ECONNREFUSED','EPIPE','ENETUNREACH','EHOSTUNREACH','ENOTFOUND']);
export function publicFailure(error,operation,batch){
 const metrics=Object.fromEntries(['serverMs','wallMs'].map(key=>[key,typeof batch?.[key]==='number'&&Number.isFinite(batch[key])&&batch[key]>=0?batch[key]:null]));
 if(error instanceof ContractFailure)return{reason:error.reason,failureKind:'contract',...metrics};
 if(PUBLIC_PROTOCOL_REASONS.has(error?.message))return{reason:error.message,failureKind:error.message==='control_cleanup_timeout'?'cleanup':operation,...metrics};
 if(operation==='query')return{reason:error?.name==='BackendTimeoutError'||error?.code==='ETIMEDOUT'?'query_timeout':NETWORK_CODES.has(error?.code)?'query_transport_failure':'query_failed',failureKind:'query',transportCode:NETWORK_CODES.has(error?.code)?error.code:null,...metrics};
 return{reason:'comparison_guard_or_control_failure',failureKind:operation,...metrics};
}
function within(promise,milliseconds,fallback){let timer;return Promise.race([promise,new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),milliseconds)})]).finally(()=>clearTimeout(timer));}
export async function controlledBatch(packet,phase,expected,paths,queryBatch,{spawnControl=spawn,budgets={ready:CONTROL_READY_SECONDS*1000,cleanup:15000,reaped:5000},raiseOwnNofile=false}={}){
 if(realpathSync(paths.code)!==paths.code||realpathSync(paths.config)!==paths.config||digest(paths.code)!==expected.controllerCodeSha256||digest(paths.config)!==expected.controllerPolicySha256)throw Error('controller_freeze_changed');
 const child=spawnControl('/usr/bin/python3',['-I','-B',paths.code,'--execute-reviewed','--config',paths.config,'--policy-sha256',expected.controllerPolicySha256,'--code-sha256',expected.controllerCodeSha256,'--phase',phase,'--case-tag',packet.tag,'--raise-own-memlock',...(raiseOwnNofile?['--raise-own-nofile']:[])],{stdio:['pipe','pipe','pipe']});
 const frames=[];let readyResolve,readyReject,closedResolve,batch,closeObserved=false,terminationSent=false,operation='readiness';
 const ready=new Promise((r,j)=>{readyResolve=r;readyReject=j});const closed=new Promise(r=>{closedResolve=r});
 const cleanupStarted=()=>frames.some(f=>f.stage==='phase-failed'||f.stage==='failed'||f.stage==='released');
 const terminate=()=>{if(!closeObserved&&!cleanupStarted()&&!terminationSent){terminationSent=true;child.kill('SIGTERM')}};
 const timer=setTimeout(()=>{readyReject(Error('control_ready_timeout'));terminate()},budgets.ready);
 child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});
 child.on('error',()=>readyReject(Error('control_spawn_failed')));
 child.on('close',(code,signal)=>{closeObserved=true;clearTimeout(timer);if(!frames.some(f=>f.stage==='query-ready'))readyReject(Error('control_before_ready_failed'));closedResolve({code,signal})});
 const reader=(async()=>{try{for await(const line of readline.createInterface({input:child.stdout,crlfDelay:Infinity})){
  if(line.length>131072||frames.length>=10)throw Error();const f=JSON.parse(line);frames.push(f);
  if(f.stage==='failed'||f.stage==='phase-failed'){readyReject(Error('control_phase_failed'));continue;}if(f.stage==='query-ready')readyResolve();
 }}catch{readyReject(Error('control_frame_failed'));terminate()}})();
 try{
  await ready;clearTimeout(timer);operation='query';
  batch=await queryBatch(packet.collection,packet.queries,{timeoutMs:30000});
  child.stdin.end('{"stage":"query-finished"}\n');operation='cleanup';
  const exit=await within(closed,budgets.cleanup,null);
  if(exit===null)throw Error('control_cleanup_timeout');
  await reader;operation='contract';
  const metrics=phaseEvidence(frames,exit.code,phase,expected,batch,{requireRed:packet.tag==='control-native-title'});
  return {metrics,frames,hashes:{resultIdHash:orderedIds(batch.results),resultIdScoreHash:orderedIdsScores(batch.results),resultSetHash:idSets(batch.results),resultScoreSetHash:idScoreSets(batch.results)},counts:batch.results.map(r=>r.length)};
 }catch(error){
  // Give a controller already reporting failure/release its own bounded cleanup opportunity.
  terminate();let exit=await within(closed,budgets.cleanup,null);
  if(exit===null){child.kill('SIGKILL');exit=await within(closed,budgets.reaped,null)}
  if(closeObserved)await reader;
  const controllerReason=frames.find(f=>(f.stage==='phase-failed'||f.stage==='failed')&&ALLOWED_REASONS.has(f.reason))?.reason||null;
  const failure=Error('comparison_guard_or_control_failure');failure.publicEvidence={...publicFailure(error,operation,batch),controllerReason,controllerFrames:frames,controllerExitCode:exit?.code??null,controllerExitSignal:exit?.signal??null,exitObserved:closeObserved,cleanupObserved:frames.some(f=>f.stage==='released'&&f.released===true&&f.pinChildExited===true),productionAcceptance:false};throw failure;
 }finally{clearTimeout(timer);if(!closeObserved)child.kill('SIGKILL');}
}

export async function comparePair(packet,runPhase,output){
 const baseline=await runPhase('baseline');
 output({kind:'baseline-batch',tag:packet.tag,lesserKnown:packet.lesserKnown,indexBuildId:packet.indexBuildId,queryCount:packet.queries.length,signals:packet.queries.map(signal),baseline:baseline.metrics,baselineControlEvidence:baseline.frames,baselineHashes:baseline.hashes,resultCounts:baseline.counts,productionAcceptance:false});
 const candidate=await runPhase('candidate');
 let parity;try{parity=pairedEvidence(baseline.metrics,candidate.metrics,baseline.hashes,candidate.hashes)}catch(error){error.publicEvidence={...publicFailure(error,'contract'),baseline:baseline.metrics,candidate:candidate.metrics,baselineHashes:baseline.hashes,candidateHashes:candidate.hashes,productionAcceptance:false};throw error;}
 return {baseline,candidate,parity};
}

export async function main(){
 if(process.argv[2]!=='--execute-reviewed'){emit({kind:'prepared-only',queries:0,payloadPersistence:false});return;}
 verifyFrozenSources();
 const expected=Object.fromEntries(['helperCodeSha256','helperPolicySha256','controllerCodeSha256','controllerPolicySha256'].map(k=>[k,process.env[k]]));
 if(Object.values(expected).some(x=>!/^[a-f0-9]{64}$/.test(x||'')))throw Error('freeze_missing');
 if(process.env.QDRANT_URL!=='http://127.0.0.1:16333/')throw Error('fixed_clone_endpoint_required');
 const paths={code:STAGE+'/controller.py',config:STAGE+'/controller-config.json'};
 // Retain bounded packets until EOF plus parent exit0 fence. No request starts during producer encoding.
 const packets=await packetsFrom(process.stdin);
 packets.sort((a,b)=>(a.tag==='control-native-title'?0:1)-(b.tag==='control-native-title'?0:1));
 requireNativeAnchor(packets);requireV4PacketSet(packets);
 const {queryBatch}=await import('./transport.mjs');
 let nativePassed=false;
 for(const p of packets){
  if(p.kind==='private-excluded'){emit({kind:'excluded',tag:p.tag,reason:'private source or coverage unavailable'});continue;}
  if(p.tag!=='control-native-title'&&!nativePassed)throw Error('native_control_not_validated');
  const {baseline,candidate,parity}=await comparePair(p,phase=>controlledBatch(p,phase,expected,paths,queryBatch,{raiseOwnNofile:process.argv.includes('--raise-own-nofile')}),emit);
  if(p.tag==='control-native-title')nativePassed=true;
  emit({kind:'paired-batch',tag:p.tag,lesserKnown:p.lesserKnown,indexBuildId:p.indexBuildId,queryCount:p.queries.length,signals:p.queries.map(signal),baseline:baseline.metrics,candidate:candidate.metrics,...parity,baselineControlEvidence:baseline.frames,candidateControlEvidence:candidate.frames,baselineHashes:baseline.hashes,candidateHashes:candidate.hashes,resultCounts:baseline.counts,productionAcceptance:false});
 }
 emit({kind:'complete',productionAcceptance:false});
}
if(import.meta.url===new URL(process.argv[1],'file:').href)main().catch(error=>{emit({kind:'failed',...(error.publicEvidence||publicFailure(error,'preflight'))});process.exitCode=1});
