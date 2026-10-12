import {phaseEvidence as numericPhaseEvidence,pairedEvidence,ContractFailure} from './compare-contract.mjs';
export {pairedEvidence};
// CPU0 lifecycle evidence validation. No source inspection, query or control.
import crypto from 'node:crypto';
export const VARIANT='cpu0-owned-lifecycle.v1';
// Exact scalar enum exported from frozen backend58d CONTROL_REASONS; no backend imports.
export const CONTROL_REASONS=new Set(["action_not_in_frozen_policy", "actual_qdrant_comm_changed", "actual_qdrant_pid_ambiguous", "ancestor_cpu_quota_present", "ancestor_cpu_throttled", "ancestor_limits_changed", "archive_checksum_or_identity_changed", "archive_fd_path_identity", "archive_identity_failed", "archive_path_changed_before_advice", "archive_path_scope", "archive_scope", "archive_store_inode_alias", "archive_verification_bound", "archive_verification_failed", "cache_preparation_freeze_changed", "cache_preparation_policy_changed", "candidate_cohort_changed", "clone_control_command_failed", "clone_identity_ambiguous", "clone_identity_changed", "clone_loopback_changed", "clone_mount_changed", "clone_not_stopped", "clone_ownership_changed", "clone_pressure_window_required", "clone_readiness_failed", "clone_resource_or_port_changed", "cold_collection_shape_changed", "cold_eviction_not_complete", "cold_inode_changed", "cold_start_headroom", "control_freeze_changed", "controller_cgroup_missing", "controller_interrupted", "controller_pressure_already_in_clone_cgroup", "counter_pid_reused", "counter_reset", "counter_source_changed", "cpu_ancestor_changed", "cpu_isolation_changed", "cpu_metric_invalid", "cpu_metric_missing", "cpu_phase_source_unavailable", "cpu_policy_required", "dirty_source_pages", "docker_inspection_failed", "duplicate_target_inode", "emergency_headroom_release", "expected_pin_class_coverage_missing", "explicit_actions_required", "explicit_cache_preparation_required", "explicit_cap_and_mapping_reserves_required", "explicit_control_arguments_required", "explicit_control_policy_required", "explicit_frozen_config_required", "explicit_measure_selection_required", "explicit_own_memlock_raise_required", "explicit_own_nofile_raise_required", "explicit_policy_required", "explicit_pressure_floor_required", "explicit_source_required", "extent_inventory_bound_exceeded", "extent_ranges_changed_during_locking", "extent_semantics_invalid", "extent_semantics_unavailable", "fixed_clone_resources_required", "fixed_clone_source_required", "fixed_readonly_archive_required", "four_class_policy_required", "frozen_digests_required", "frozen_input_changed", "gate_freeze_changed", "gate_interrupted", "guard_or_runtime_failure", "helper_accounting_not_joined", "helper_freeze_changed", "helper_timing_policy_changed", "host_cpu_busy", "host_cpu_metrics_missing", "host_emergency_floor", "host_mapped_inode_changed", "initial_cap_fit_inconclusive", "initial_cap_headroom_inconclusive", "initial_cohort_changed", "initial_pin_cpu_limit_event", "initial_pin_memory_limit_event", "invalid_cli_arguments", "invalid_control_lock", "invalid_instance_lock", "invalid_measure_state", "invalid_memory_accounting", "invalid_numeric_policy", "invalid_own_nofile_policy", "invalid_pin_command", "invalid_query_ack", "invalid_reclaim_lock", "invalid_residency_accounting", "invalid_runtime_state", "invalid_selection_digest", "join_source_changed", "lifecycle_clean_receipt_missing", "lifecycle_connection_present", "lifecycle_connection_unknown", "lifecycle_docker_cleanup_failed", "lifecycle_docker_unavailable", "lifecycle_fork_scope_active", "lifecycle_freeze_changed", "lifecycle_guard_or_runtime_failure", "lifecycle_handoff_changed", "lifecycle_handoff_cleanup_failed", "lifecycle_handoff_invalid", "lifecycle_interpreter_unsupported", "lifecycle_lock_close_failed", "lifecycle_lock_unproven", "lifecycle_membership_changed", "lifecycle_pidfd_close_failed", "lifecycle_process_changed", "lifecycle_reader_placement", "lifecycle_recovery_allowed", "lifecycle_stop_timeout", "lifecycle_stop_unclean", "lifecycle_target_refused", "lifecycle_wrapper_unreviewed", "limit_metrics_reset_during_pass", "local_source_identity_changed", "lock_budget_or_rlimit_unavailable", "locked_data_residency_incomplete", "locked_residency_incomplete", "locked_source_pages", "mapped_device_changed", "mapped_file_inventory_bound_exceeded", "mapped_shard_coverage_missing", "mapping_limit_unavailable", "measure_cannot_raise_limits", "metadata_health_changed", "negative_missing_pages_inconclusive", "outside_source_inspector_required", "own_nofile_baseline_bound_exceeded", "own_nofile_hard_limit_insufficient", "own_nofile_raise_failed", "own_nofile_state_changed", "own_nofile_state_unavailable", "owned_inode_alias", "owned_nonregular", "owned_root_changed", "owned_root_nonregular", "owned_root_symlink", "owned_size_guard", "owned_symlink", "owned_total_disk_budget", "parent_already_clone_cgroup", "parent_cgroup_changed", "parent_inspection_inside_clone_cgroup", "parent_placement_changed", "phase_required", "phase_resource_failed", "pin_capability_missing", "pin_child_cleanup", "pin_child_exit_failed", "pin_child_exit_unproven", "pin_child_failed", "pin_child_placement", "pin_child_timeout", "pin_holder_lock_proof_missing", "pin_kernel_operation_failed", "pin_release_failed", "pin_release_unproven", "policy_source_mode_mismatch", "post_cap_fit_inconclusive", "postwrite_sample_bound_exceeded", "postwrite_zero_timeout", "predeclared_negative_control_required", "prepared_input_changed", "pressure_bound_failed", "pressure_cannot_fit_deadline", "pressure_cohort_changed", "pressure_finalization_failed", "pressure_ledger_missing", "pressure_placement_required", "pressure_writer_placement_changed", "production_headroom_guard_cannot_be_relaxed", "projected_headroom_below_reserve", "projected_mapping_limit_exceeded", "query_cohort_changed", "query_lease_eof", "query_lease_timeout", "query_pin_cohort_changed", "query_source_changed", "quiescence_bound_exceeded", "range_identity_missing", "range_outside_file", "readonly_mapping_failed", "reclaim_fd_changed", "reclaim_resource_event", "reclaim_timeout", "reclaim_write_failed", "reclaim_writer_survived", "required_limit_metrics_missing", "residency_measurement_failed", "resource_metrics_unavailable", "resource_scope_invalid", "root_helper_required", "selected_target_descriptor_required", "source_cgroup_changed", "source_changed", "source_changed_after_cache_preparation", "source_changed_before_helper_accounting", "source_changed_during_inventory", "source_changed_during_measurement", "source_changed_during_pressure", "source_children_present", "source_cpu_quota_changed", "source_freeze_changed", "source_identity_changed", "source_image_or_running_changed", "source_limits_changed", "source_mounts_changed", "source_or_emergency_headroom_changed_after_locking", "source_resources_changed", "source_rpc_budget", "source_rpc_failed", "source_rpc_spec_changed", "source_rpc_timeout", "source_spec_changed", "swap_present", "target_anon_kernel_exceeds_cgroup_cap", "target_identity_changed", "target_not_owned_regular_single_link_file", "target_path_scope_changed", "turnover_not_fresh", "turnover_readiness_failed", "turnover_shape_changed", "unreviewed_production_container", "unreviewed_source_spec", "writer_birth_changed", "writer_birth_unavailable", "writer_cleanup_unproven", "writer_interrupted", "writer_parent_changed", "writer_prewrite_timeout", "writer_protocol_failed", "writer_registration_failed", "writer_registration_timeout", "writer_start_failed", "zero_child_cleanup_failed", "zero_child_exit_unproven", "zero_child_lease_failed", "zero_child_timeout", "zero_join_failed", "zero_join_proof_missing", "zero_pin_proof_missing"]);
const HASH=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/;
export const CPU0_CORE_SHA256='4e50f80dbc80cd6b4a197070e01867dbed2d0b9aeb88bda0f97cba1f4f8596c5';
const SCRIPT='f773b9c6df212eb34cfcffaa932b27a713e9d477492d2b5b40eb8f8cc5f2475e';
const gate=(value,reason='cpu0_lifecycle_evidence_invalid')=>{if(!value)throw new ContractFailure(reason);};
const integer=(value,min=0)=>Number.isSafeInteger(value)&&value>=min;
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
const hash=value=>typeof value==='string'&&HASH.test(value);
const utc=value=>typeof value==='string'&&UTC.test(value)&&Number.isFinite(Date.parse(value));
const keys=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join(',')===[...names].sort().join(',');
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));return value;}
export const canonicalHash=value=>crypto.createHash('sha256').update(JSON.stringify(canonical(value))+'\n').digest('hex');
function state(value,running){
 gate(keys(value,['containerIdHash','running','startedAt','finishedAt','restartCount','exitCode','OOMKilled','configurationHash']));
 gate(hash(value.containerIdHash)&&hash(value.configurationHash)&&value.running===running&&value.OOMKilled===false&&integer(value.restartCount)&&value.exitCode===0&&utc(value.startedAt)&&utc(value.finishedAt));
}
function process(value){
 gate(keys(value,['pid','startTicks','parentPid','exeIdentityHash','groupHash','VmLckBytes']));
 gate(integer(value.pid,1)&&integer(value.startTicks,1)&&integer(value.parentPid,1)&&hash(value.exeIdentityHash)&&hash(value.groupHash)&&value.VmLckBytes===0);
}
function target(value){
 gate(keys(value,['state','wrapper','qdrant','scriptSha256','wrapperArgvHash','RecoveryAllowed','activeServiceConnections','connectionCensusComplete','liveMountIdentityHash','readerOutsideSourceSubtree','readerVmLckBytes']));
 state(value.state,true);process(value.wrapper);process(value.qdrant);
 gate(value.qdrant.parentPid===value.wrapper.pid&&value.wrapper.pid!==value.qdrant.pid&&value.wrapper.groupHash===value.qdrant.groupHash&&value.scriptSha256===SCRIPT&&hash(value.wrapperArgvHash)&&hash(value.liveMountIdentityHash)&&value.RecoveryAllowed===false&&value.activeServiceConnections===0&&value.connectionCensusComplete===true&&value.readerOutsideSourceSubtree===true&&value.readerVmLckBytes===0);
}
export function recordedHandoff(value,expectedSha256){
 gate(keys(value,['schema','owner','previousSha256','snapshot','sha256'])&&value.schema==='clone-lifecycle-handoff.cpu0.v1'&&((value.owner==='setup'&&value.previousSha256===null)||(['controller','turnover','preflight','stager','outer'].includes(value.owner)&&hash(value.previousSha256)))&&value.sha256===expectedSha256&&hash(value.sha256));
 const {sha256,...record}=value;gate(canonicalHash(record)===sha256);
 const snapshot=value.snapshot;gate(keys(snapshot,['variant','oldStopped','oldCleanReceiptSha256','newRunning'])&&snapshot.variant===VARIANT&&hash(snapshot.oldCleanReceiptSha256));
 state(snapshot.oldStopped,false);target(snapshot.newRunning);
 gate(snapshot.oldStopped.containerIdHash!==snapshot.newRunning.state.containerIdHash,'cpu0_old_new_source_alias');
 return value;
}
export function handoffEvidence(value,previousSha256){
 recordedHandoff(value,value?.sha256);gate(value.owner==='controller'&&hash(previousSha256)&&value.previousSha256===previousSha256);return value;
}
export function admissionEvidence(value){
 gate(keys(value,['schema','variant','at','sourceIdentity','target','hostCpu','hostMemAvailableBytes','hostMemAvailableFloorBytes','ownedAllocatedBytes','ownedAllocatedCeilingBytes','diskFreeBytes','diskFreeFloorBytes','hostSwapBytes','cpuHierarchy','pointCount','segmentCount','shardCount','clientsClosed'])&&value.schema==='clone-birth-admission.cpu0-owned.v1'&&value.variant===VARIANT&&utc(value.at));
 target(value.target);gate(Array.isArray(value.sourceIdentity)&&value.sourceIdentity.length===4&&hash(value.sourceIdentity[0])&&value.sourceIdentity[1]==='sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'&&crypto.createHash('sha256').update(value.sourceIdentity[0]).digest('hex')===value.target.state.containerIdHash&&value.sourceIdentity[2]===value.target.qdrant.pid&&value.sourceIdentity[3]===value.target.qdrant.startTicks);
 gate(value.hostMemAvailableFloorBytes===5*1024**3&&value.ownedAllocatedCeilingBytes===11*1024**3&&value.diskFreeFloorBytes===3*1024**3&&number(value.ownedAllocatedBytes)&&value.ownedAllocatedBytes<value.ownedAllocatedCeilingBytes&&number(value.diskFreeBytes)&&value.diskFreeBytes>value.diskFreeFloorBytes&&number(value.hostMemAvailableBytes)&&value.hostMemAvailableBytes>value.hostMemAvailableFloorBytes&&value.hostSwapBytes===0&&value.pointCount===244262&&value.segmentCount===12&&value.shardCount===6&&value.clientsClosed===true);
 const host=value.hostCpu;gate(keys(host,['onlineCpus','load1','load5','cpuSomeAvg10','loadCeiling','psiCeilingPercent'])&&integer(host.onlineCpus,1)&&[host.load1,host.load5,host.cpuSomeAvg10].every(number)&&host.loadCeiling===.5*host.onlineCpus&&host.psiCeilingPercent===10&&host.load1<=host.loadCeiling&&host.load5<=host.loadCeiling&&host.cpuSomeAvg10<=10);
 hierarchyEvidence(value.cpuHierarchy);
 return value;
}

export function hierarchyEvidence(cpu){
gate(keys(cpu,['schema','rows','weight','cpusetCpus','cpusetMems','identityUnchangedRequired'])&&cpu.schema==='search.clone-cpu-hierarchy.v1'&&cpu.weight===100&&cpu.cpusetCpus===''&&cpu.cpusetMems===''&&cpu.identityUnchangedRequired===true&&Array.isArray(cpu.rows)&&cpu.rows.length>=2&&cpu.rows.length<=33);
 cpu.rows.forEach((row,index)=>{
  const root=index===cpu.rows.length-1;
  gate(keys(row,['depth','groupIdentitySha256','quotaMicros','periodMicros','nrThrottled','throttledMicros',...(root?['applicability','usageMicros','userMicros','systemMicros']:[])])&&hash(row.groupIdentitySha256)&&row.depth===index&&row.quotaMicros===null);
  if(index===cpu.rows.length-1)gate(row.applicability==='hierarchy-root-no-bandwidth-controller'&&row.periodMicros===null&&row.nrThrottled===null&&row.throttledMicros===null&&[row.usageMicros,row.userMicros,row.systemMicros].every(value=>integer(value)));
  else gate(integer(row.periodMicros,1)&&integer(row.nrThrottled)&&integer(row.throttledMicros)&&row.applicability===undefined);
 });
 gate(cpu.rows[0].periodMicros===100000);
 return cpu;
}

export function readinessEvidence(frames,phase,expected,previous,{requireRed=false}={}){
 recordedHandoff(previous,previous?.sha256);
 const stages=['cache-preparation-complete','pressure-complete','query-ready'];
 gate(Array.isArray(frames)&&frames.length===3&&frames.every((frame,index)=>frame.variant===VARIANT&&frame.schema==='search.clone-mlock-control.v2'&&frame.stage===stages[index]&&frame.phase===phase&&utc(frame.at)),'cpu0_readiness_frames_invalid');
 gate(keys(expected,['helperCodeSha256','helperPolicySha256','controllerCodeSha256','controllerPolicySha256'])&&Object.values(expected).every(hash),'cpu0_freeze_missing');
 for(const frame of frames)for(const [key,value] of Object.entries(expected))gate(frame[key]===value,'cpu0_freeze_changed');
 readinessNumeric(frames,phase);
 if(phase==='baseline'&&requireRed)gate(frames[1].negativePrequeryMissingBytes===64*1024**2&&frames[1].prequeryMissingBytes>=64*1024**2,'negative_insufficient_missing_pages');
 const ready=frames[2],initial=admissionEvidence(ready.initialAdmission),current=admissionEvidence(ready.birthAdmission);
 gate(JSON.stringify(canonical(initial.target))===JSON.stringify(canonical(previous.snapshot.newRunning)),'cpu0_initial_birth_changed');
 const stop=ready.cold?.cleanStop;
 gate(keys(stop,['schema','target','before','after','wallStartedAt','wallFinishedAt','elapsedSeconds','qdrantBirthGone','wrapperBirthGone','childExitStatusObserved','childExitZeroInferredFromWrapperAndDocker','signal','killFallback','clean'])&&stop.schema==='clone-child-term.clean.v1'&&stop.target==='gw-qdrant-cpu0-100-20261012'&&stop.signal==='SIGTERM'&&stop.killFallback===false&&stop.clean===true&&stop.qdrantBirthGone===true&&stop.wrapperBirthGone===true&&stop.childExitStatusObserved===false&&stop.childExitZeroInferredFromWrapperAndDocker===true,'cpu0_clean_stop_unproven');
 target(stop.before);state(stop.after,false);
 gate(JSON.stringify(canonical(stop.before))===JSON.stringify(canonical(initial.target))&&['containerIdHash','configurationHash','startedAt','restartCount'].every(key=>stop.before.state[key]===stop.after[key]),'cpu0_stop_birth_changed');
 gate(utc(stop.wallStartedAt)&&utc(stop.wallFinishedAt)&&Date.parse(stop.wallFinishedAt)>=Date.parse(stop.wallStartedAt)&&Date.parse(stop.after.finishedAt)>=Date.parse(stop.wallStartedAt)&&Date.parse(stop.after.finishedAt)<=Date.parse(stop.wallFinishedAt)&&stop.before.state.finishedAt!==stop.after.finishedAt&&number(stop.elapsedSeconds)&&stop.elapsedSeconds<=20,'cpu0_stop_interval_invalid');
 gate(current.target.state.containerIdHash===initial.target.state.containerIdHash&&current.target.state.configurationHash===initial.target.state.configurationHash&&current.target.state.restartCount===initial.target.state.restartCount&&Date.parse(current.target.state.startedAt)>=Date.parse(stop.after.finishedAt)&&(current.target.qdrant.pid!==initial.target.qdrant.pid||current.target.qdrant.startTicks!==initial.target.qdrant.startTicks)&&(current.target.wrapper.pid!==initial.target.wrapper.pid||current.target.wrapper.startTicks!==initial.target.wrapper.startTicks),'cpu0_cold_birth_not_fresh');
 gate(JSON.stringify(canonical(ready.cold.birthAdmission))===JSON.stringify(canonical(current)),'cpu0_birth_admission_changed');
 const prep=frames[0].cachePreparation;
 gate(prep?.before?.qdrantPid===current.target.qdrant.pid&&prep?.final?.qdrantPid===current.target.qdrant.pid&&prep?.before?.sourceStartTicks===current.target.qdrant.startTicks&&prep?.final?.sourceStartTicks===current.target.qdrant.startTicks,'cpu0_preparation_birth_changed');
 hierarchyEvidence(frames[0].cpuHierarchyBefore);hierarchyEvidence(ready.cpuHierarchyBefore);
 return {initialAdmission:initial,birthAdmission:current};
}

export function phaseEvidence(frames,exitCode,phase,expected,batch,{requireRed=false,priorHandoffSha256,priorHandoff}={}){
 const stages=['cache-preparation-complete','pressure-complete','query-ready','query-finished','handoff-complete','released','unpin-complete'];
 gate(Array.isArray(frames)&&frames.length===7&&frames.every((frame,index)=>frame.variant===VARIANT&&frame.stage===stages[index]&&frame.schema==='search.clone-mlock-control.v2'&&frame.phase===phase),'cpu0_phase_frames_invalid');
 gate(priorHandoff?.sha256===priorHandoffSha256,'cpu0_predecessor_receipt_missing');
 const admission=readinessEvidence(frames.slice(0,3),phase,expected,priorHandoff,{requireRed}).birthAdmission;
 gate(JSON.stringify(canonical(frames[2].cold?.birthAdmission))===JSON.stringify(canonical(admission)),'cpu0_birth_admission_changed');
 const handoff=handoffEvidence(frames[4].handoff,priorHandoffSha256);
 gate(JSON.stringify(canonical(handoff.snapshot.newRunning))===JSON.stringify(canonical(admission.target)),'cpu0_birth_changed_before_handoff');
 gate(utc(frames[4].at)&&Date.parse(frames[4].at)>=Date.parse(frames[3].at)&&Date.parse(frames[4].at)<=Date.parse(frames[5].at),'cpu0_handoff_order_invalid');
 for(const [key,value] of Object.entries(expected))gate(frames[4][key]===value,'cpu0_handoff_freeze_changed');
 const before=hierarchyEvidence(frames[3].cpuHierarchyBefore),after=hierarchyEvidence(frames[3].cpuHierarchyAfter);
 gate(before.rows.length===after.rows.length,'cpu0_cpu_ancestry_changed');
 const delta=frames[3].cpuHierarchyDelta;gate(Array.isArray(delta)&&delta.length===before.rows.length,'cpu0_cpu_delta_missing');
 before.rows.forEach((row,index)=>{
  const later=after.rows[index];gate(['depth','groupIdentitySha256','quotaMicros','periodMicros','applicability'].every(key=>row[key]===later[key]),'cpu0_cpu_ancestry_changed');
  gate(keys(delta[index],['depth','nrThrottled','throttledMicros',...(index===before.rows.length-1?['applicability']:[])])&&delta[index].depth===index,'cpu0_cpu_delta_missing');
  if(index===before.rows.length-1)gate(['usageMicros','userMicros','systemMicros'].every(key=>later[key]>=row[key]),'cpu0_root_cpu_counter_reset');
  if(index===before.rows.length-1)gate(delta[index].applicability==='hierarchy-root-no-bandwidth-controller'&&delta[index].nrThrottled===null&&delta[index].throttledMicros===null,'cpu0_cpu_delta_missing');
  else gate(later.nrThrottled===row.nrThrottled&&later.throttledMicros===row.throttledMicros&&delta[index].nrThrottled===0&&delta[index].throttledMicros===0,'cpu0_cpu_throttle_event');
 });
 for(const frame of [frames[0],frames[2]]){const hierarchy=hierarchyEvidence(frame.cpuHierarchyBefore);gate(JSON.stringify(canonical(hierarchy))===JSON.stringify(canonical(before)),'cpu0_cpu_baseline_changed');}
 const prep=frames[0].cachePreparation;gate(prep.before.qdrantPid===admission.target.qdrant.pid&&prep.final.qdrantPid===admission.target.qdrant.pid&&prep.before.sourceStartTicks===admission.target.qdrant.startTicks&&prep.final.sourceStartTicks===admission.target.qdrant.startTicks,'cpu0_preparation_birth_changed');
 const metrics=numericPhaseEvidence(frames.filter(frame=>frame.stage!=='handoff-complete'),exitCode,phase,expected,batch,{requireRed});
 gate(batch.socketClosed===true,'cpu0_query_client_release_unproven');
 return {...metrics,variant:VARIANT,previousHandoffSha256:priorHandoffSha256,handoffSha256:handoff.sha256,birthAdmission:admission};
}

export const CPU0_SOURCE_FILES=['pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','controller_cpu0.py','cpu0_guards.py','cpu0_preflight.py','turnover_gate_cpu0.py','prepared-helper-policy-cpu0.json','prepared-control-policy-cpu0.json','test_cpu0_guards.py','test_cpu0_controller.py','CPU0.md','lifecycle_cpu0.py','test_lifecycle_cpu0.py'];
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
export function verifyCpu0Freeze(raw,expectedSha256,read){
 gate(Buffer.isBuffer(raw)&&raw.length<=32768&&hash(expectedSha256)&&digest(raw)===expectedSha256,'cpu0_source_manifest_changed');
 let manifest;try{manifest=JSON.parse(raw);}catch{gate(false,'cpu0_source_manifest_invalid');}
 gate(manifest.schema==='search.clone-cpu0-owned-source-freeze.v1'&&manifest.variant===VARIANT&&manifest.preparedOnly===true&&manifest.oldFilesChanged===false&&manifest.benchmarkPacketReady===false&&keys(manifest.files,CPU0_SOURCE_FILES),'cpu0_source_manifest_invalid');
 const bytes={};for(const name of CPU0_SOURCE_FILES){bytes[name]=read(name);gate(Buffer.isBuffer(bytes[name])&&bytes[name].length<=1024**2&&hash(manifest.files[name])&&digest(bytes[name])===manifest.files[name],'cpu0_source_bytes_changed');}
 const core=crypto.createHash('sha256');for(const name of ['pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py'])core.update(Buffer.concat([Buffer.from(name+'\0'),bytes[name],Buffer.from('\0')]));
 gate(manifest.helperCodeSha256===CPU0_CORE_SHA256&&core.digest('hex')===manifest.helperCodeSha256,'cpu0_core_closure_changed');
 let helper,control;try{helper=JSON.parse(bytes['prepared-helper-policy-cpu0.json']);control=JSON.parse(bytes['prepared-control-policy-cpu0.json']);}catch{gate(false,'cpu0_policy_invalid');}
 gate(helper.schema==='mapped-data-pin-config.cpu0.v1'&&helper.source?.mode==='clone'&&helper.source.container==='gw-qdrant-cpu0-100-20261012'&&helper.source.cpuNanos===0&&helper.source.memoryBytes===6*1024**3&&helper.source.swapBytes===6*1024**3&&helper.policy?.maxLockedBytes===2*1024**3&&helper.policy.includePayload===false,'cpu0_policy_invalid');
 gate(control.schema==='clone-pin-control.cpu0-owned.v1'&&control.helperCodeSha256===manifest.helperCodeSha256&&control.helperPolicySha256===manifest.files['prepared-helper-policy-cpu0.json']&&control.lifecycle?.moduleSha256===manifest.files['lifecycle_cpu0.py']&&control.lifecycle.entrypointSha256===SCRIPT&&control.lifecycle.stopSeconds===20&&keys(control.cpuIsolation,['periodMicros','weight','cpusetCpus','cpusetMems'])&&control.cpuIsolation.periodMicros===100000&&control.cpuIsolation.weight===100&&control.cpuIsolation.cpusetCpus===''&&control.cpuIsolation.cpusetMems==='','cpu0_policy_invalid');
 return {manifest,expected:{helperCodeSha256:manifest.helperCodeSha256,helperPolicySha256:manifest.files['prepared-helper-policy-cpu0.json'],controllerCodeSha256:manifest.files['controller_cpu0.py'],controllerPolicySha256:manifest.files['prepared-control-policy-cpu0.json']}};
}

// Completed stop receipts survive a later phase failure; no raw error fields are retained.
export function cleanStopEvidence(stop){
 gate(keys(stop,['schema','target','before','after','wallStartedAt','wallFinishedAt','elapsedSeconds','qdrantBirthGone','wrapperBirthGone','childExitStatusObserved','childExitZeroInferredFromWrapperAndDocker','signal','killFallback','clean'])&&stop.schema==='clone-child-term.clean.v1'&&stop.target==='gw-qdrant-cpu0-100-20261012');
 target(stop.before);state(stop.after,false);
 gate(stop.signal==='SIGTERM'&&stop.killFallback===false&&stop.clean===true&&stop.qdrantBirthGone===true&&stop.wrapperBirthGone===true&&stop.childExitStatusObserved===false&&stop.childExitZeroInferredFromWrapperAndDocker===true);
 gate(['containerIdHash','configurationHash','startedAt','restartCount'].every(key=>stop.before.state[key]===stop.after[key])&&utc(stop.wallStartedAt)&&utc(stop.wallFinishedAt)&&number(stop.elapsedSeconds)&&stop.elapsedSeconds<=20&&Date.parse(stop.wallFinishedAt)>=Date.parse(stop.wallStartedAt)&&Date.parse(stop.after.finishedAt)>=Date.parse(stop.wallStartedAt)&&Date.parse(stop.after.finishedAt)<=Date.parse(stop.wallFinishedAt));return stop;
}
const lifecycleReasons=new Set(['lifecycle_target_refused','lifecycle_freeze_changed','lifecycle_process_changed','lifecycle_wrapper_unreviewed','lifecycle_recovery_allowed','lifecycle_membership_changed','lifecycle_connection_present','lifecycle_connection_unknown','lifecycle_reader_placement','lifecycle_lock_unproven','lifecycle_stop_timeout','lifecycle_stop_unclean','lifecycle_clean_receipt_missing','lifecycle_handoff_changed','lifecycle_handoff_invalid','lifecycle_fork_scope_active','lifecycle_guard_or_runtime_failure','lifecycle_pidfd_close_failed','lifecycle_lock_close_failed','lifecycle_handoff_cleanup_failed','lifecycle_interpreter_unsupported','lifecycle_docker_unavailable','lifecycle_docker_cleanup_failed']);
function observedState(value){
 gate(keys(value,['containerIdHash','running','startedAt','finishedAt','restartCount','exitCode','OOMKilled','configurationHash'])&&hash(value.containerIdHash)&&hash(value.configurationHash)&&typeof value.running==='boolean'&&typeof value.OOMKilled==='boolean'&&integer(value.restartCount)&&Number.isSafeInteger(value.exitCode)&&utc(value.startedAt)&&utc(value.finishedAt));return value;
}
function normalizedAccount(value){
 const names=['availableBytes','anonBytes','fileBytes','kernelBytes','unevictableBytes','currentBytes','cgroupMaxBytes','memoryEvents','cpu'];gate(keys(value,names)&&names.slice(0,6).every(key=>integer(value[key]))&&(value.cgroupMaxBytes===null||integer(value.cgroupMaxBytes))&&keys(value.memoryEvents,['max','oom','oom_kill'])&&keys(value.cpu,['nr_throttled','throttled_usec'])&&[...Object.values(value.memoryEvents),...Object.values(value.cpu)].every(value=>integer(value)));return value;
}
function hostCpuFailure(value){gate(keys(value,['onlineCpus','load1','load5','cpuSomeAvg10','loadCeiling','psiCeilingPercent'])&&integer(value.onlineCpus,1)&&[value.load1,value.load5,value.cpuSomeAvg10].every(number)&&value.loadCeiling===.5*value.onlineCpus&&value.psiCeilingPercent===10);return value;}
export function failureEvidence(frames,depth=0){
 const result={completedCleanStop:null,lifecycleFailure:null,cpuHierarchy:null,resourceFailure:null,cpuFailure:null,hostCpu:null,pressureFinalization:null,lifecycleCleanupFailure:null,lifecycleDockerCleanup:null,backendReasons:[],evidenceRejected:false};
 const scopes=new Set(['turnover-join','held-pin-prior-to-pass','held-pin-pass','pressure-start-continuity','pressure-end-continuity','preparation-to-inventory','inventory-to-pin','baseline-inventory-to-pressure','pressure-interval','pressure-to-inventory','inventory-to-query','query-interval','post-query-inventory']);
 for(const frame of frames){
  if(['failed','phase-failed'].includes(frame.stage)&&frame.reason!==undefined){if(CONTROL_REASONS.has(frame.reason))result.backendReasons.push({stage:frame.stage,reason:frame.reason});else result.evidenceRejected=true;}
  const stop=frame.lifecycleCompletedStopReceipt||frame.cold?.cleanStop;
  if(stop){try{result.completedCleanStop=cleanStopEvidence(stop);}catch{result.evidenceRejected=true;}}
  const failed=frame.lifecycleFailureEvidence;
  if(failed){try{
   const required=['schema','target','reason','before','after','beforeStatus','afterStatus','wallStartedAt','wallFinishedAt','elapsedSeconds','signalSent','signal','qdrantBirthGone','wrapperBirthGone','childExitStatusObserved','killFallback','clean','lateObservationCannotPromoteClean','privateErrorOmitted'];
   gate(keys(failed,required)&&failed.schema==='clone-child-term.failed.v1'&&failed.target==='gw-qdrant-cpu0-100-20261012'&&lifecycleReasons.has(failed.reason)&&utc(failed.wallStartedAt)&&utc(failed.wallFinishedAt)&&number(failed.elapsedSeconds)&&typeof failed.signalSent==='boolean'&&failed.signal===(failed.signalSent?'SIGTERM':null)&&[failed.qdrantBirthGone,failed.wrapperBirthGone].every(value=>value===null||typeof value==='boolean')&&failed.childExitStatusObserved===false&&failed.killFallback===false&&failed.clean===false&&failed.lateObservationCannotPromoteClean===true&&failed.privateErrorOmitted===true);
   for(const key of ['before','after']){gate(failed[key+'Status']===(failed[key]===null?'unavailable':'observed'));if(failed[key]!==null){if(key==='before')target(failed[key]);else observedState(failed[key]);}}
   result.lifecycleFailure=failed;
  }catch{result.evidenceRejected=true;}}
  if(frame.cpuHierarchyBefore){try{result.cpuHierarchy=hierarchyEvidence(frame.cpuHierarchyBefore);}catch{result.evidenceRejected=true;}}
  if(frame.lifecycleCleanupFailure){if(lifecycleReasons.has(frame.lifecycleCleanupFailure))result.lifecycleCleanupFailure=frame.lifecycleCleanupFailure;else result.evidenceRejected=true;}
  if(frame.lifecycleDockerCleanupEvidence){const value=frame.lifecycleDockerCleanupEvidence;if(keys(value,['pid','clientGone','exitCode'])&&integer(value.pid,1)&&typeof value.clientGone==='boolean'&&(value.exitCode===null||Number.isSafeInteger(value.exitCode)))result.lifecycleDockerCleanup=value;else result.evidenceRejected=true;}
  if(frame.cpuHierarchyEvidence){try{result.cpuFailure=cpuFailureEvidence(frame.cpuHierarchyEvidence);}catch{result.evidenceRejected=true;}}
  if(frame.hostCpuEvidence){try{result.hostCpu=hostCpuFailure(frame.hostCpuEvidence);}catch{result.evidenceRejected=true;}}
  const resource=frame.resourceLimitEvidence;
  if(resource){try{
   gate(resource.schema==='search.clone-resource-window.v1'&&scopes.has(resource.scope)&&resource.overlappingNonAdditive===true);
   if(resource.measurementsAvailable===false){gate(keys(resource,['schema','scope','measurementsAvailable','overlappingNonAdditive']));result.resourceFailure=resource;}
   else{
    gate(keys(resource,['schema','scope','checkedAt','before','after','memoryEventDelta','cpuLimitDelta','pressureMaxException','failedChecks','overlappingNonAdditive'])&&utc(resource.checkedAt)&&typeof resource.pressureMaxException==='boolean'&&Array.isArray(resource.failedChecks)&&resource.failedChecks.every(key=>['counter_regression','oom','oom_kill','memory_max','cpu_nr_throttled','cpu_throttled_usec'].includes(key))&&keys(resource.memoryEventDelta,['max','oom','oom_kill'])&&keys(resource.cpuLimitDelta,['nr_throttled','throttled_usec'])&&[...Object.values(resource.memoryEventDelta),...Object.values(resource.cpuLimitDelta)].every(Number.isSafeInteger));
    const before=normalizedAccount(resource.before),after=normalizedAccount(resource.after);for(const [source,delta] of [['memoryEvents','memoryEventDelta'],['cpu','cpuLimitDelta']])for(const key of Object.keys(before[source]))gate(resource[delta][key]===after[source][key]-before[source][key]);result.resourceFailure=resource;
   }
  }catch{result.evidenceRejected=true;}}
  if(frame.pressureFinalizationFailure){const value=frame.pressureFinalizationFailure;if(depth===0&&keys(value,['reason','resourceLimitEvidence','cpuHierarchyEvidence','hostCpuEvidence','pressureFinalizationFailure'])&&['phase_resource_failed','pressure_finalization_failed'].includes(value.reason)){const nested=failureEvidence([value],1);result.pressureFinalization={reason:value.reason,...nested};}else result.evidenceRejected=true;}
 }
 return result;
}
export function preflightEvidence(value,previous){
 recordedHandoff(previous,previous?.sha256);
 gate(keys(value,['schema','variant','birthAdmission','handoff','sourceIdentity','queries','resourceWrites','handoffWrites','modelsRead'])&&value.schema==='search.clone-cpu0-preflight.v1'&&value.variant===VARIANT&&value.queries===0&&value.resourceWrites===0&&value.modelsRead===0&&value.handoffWrites===1,'cpu0_preflight_invalid');
 const admission=admissionEvidence(value.birthAdmission),next=recordedHandoff(value.handoff,value.handoff?.sha256);
 gate(next.owner==='preflight'&&next.previousSha256===previous.sha256&&JSON.stringify(canonical(next.snapshot))===JSON.stringify(canonical(previous.snapshot))&&JSON.stringify(canonical(next.snapshot.newRunning))===JSON.stringify(canonical(admission.target))&&JSON.stringify(value.sourceIdentity)===JSON.stringify(admission.sourceIdentity),'cpu0_preflight_birth_changed');return value;
}

export const FULL_NAMES=Object.freeze([...CPU0_SOURCE_FILES,'cpu0-source-freeze.json','helper-config.json','controller-config.json','prepare_clone_reclaim.py','consumer_cpu0.mjs','compare-contract-cpu0.mjs','audit_cpu0.mjs','transport_cpu0.mjs','compare-contract.mjs','parity.mjs']);
export function verifyExternalPacket(raw,expectedSha256,read){
 if(!Buffer.isBuffer(raw)||raw.length>32768||!HASH.test(expectedSha256||'')||digest(raw)!==expectedSha256)throw Error('cpu0_external_manifest_changed');
 const manifest=JSON.parse(raw);
 if(!keys(manifest,['schema','variant','sourceFreezeSha256','files'])||manifest.schema!=='cpu0-full-public-packet.v6'||manifest.variant!==VARIANT||!HASH.test(manifest.sourceFreezeSha256||'')||Object.keys(manifest.files||{}).sort().join(',')!==[...FULL_NAMES].sort().join(','))throw Error('cpu0_external_manifest_invalid');
 const files={};for(const name of FULL_NAMES){files[name]=read(name);if(!Buffer.isBuffer(files[name])||files[name].length>1024**2||digest(files[name])!==manifest.files[name])throw Error('cpu0_external_file_changed');}
 const source=verifyCpu0Freeze(files['cpu0-source-freeze.json'],manifest.sourceFreezeSha256,name=>files[name]);
 if(digest(files['helper-config.json'])!==source.expected.helperPolicySha256||digest(files['controller-config.json'])!==source.expected.controllerPolicySha256)throw Error('cpu0_policy_alias_changed');
 const control=JSON.parse(files['controller-config.json']);gate(control.cachePreparation?.helperSha256==='f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5'&&digest(files['prepare_clone_reclaim.py'])===control.cachePreparation.helperSha256,'cpu0_reclaim_source_changed');
 return {...source,externalManifest:manifest};
}

function readinessNumeric(frames,phase){
 const [preparation,pressure,ready]=frames;
 const HASH=/^[a-f0-9]{64}$/;
 const limits=value=>gate(value&&['oom','oom_kill','max'].every(key=>value.memoryEventDelta?.[key]===0)&&['nr_throttled','throttled_usec'].every(key=>value.cpuLimitDelta?.[key]===0),'cpu0_readiness_resource_failure');
 gate(ready.diagnosticReadySeconds===1200&&frames.every((frame,index)=>!index||Date.parse(frame.at)>=Date.parse(frames[index-1].at)),'cpu0_readiness_budget_or_order_changed');
 limits(preparation.preparationToInitialLimits);limits(pressure.pressureLimits);
 const prep=preparation.cachePreparation;
 gate(preparation.cachePreparationMode==='post-cold-owned-cgroup-reclaim'&&preparation.cachePreparationHelperSha256==='f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5'&&prep?.schema==='owned-clone-reclaim-preparation.v1'&&prep.stage==='prepared-headroom-measured','cache_preparation_missing');
 gate(prep.writer?.requestedBytes===3*1024**3&&prep.writer.registeredBeforeWrite===true&&prep.writer.writerExitObserved===true&&prep.writer.cleanupUnknown===false&&prep.writer.pidfdRetained===false&&prep.writer.writeAttempts===1&&prep.writer.writerGone===true&&prep.writer.writerExitCode===0&&prep.writer.timedOut===false&&((prep.writer.outcome==='accepted'&&prep.writer.writtenBytes===10)||(prep.writer.outcome==='under-reclaimed'&&prep.writer.errno===11)),'cache_preparation_writer_failed');
 const writerPolicy={registrationSeconds:10,prewriteAcceptanceSeconds:60,prewriteSupervisionSeconds:65,kernelWriteSeconds:60,cleanupSeconds:10,lifecycleSeconds:145,receiptLimit:18,censusLimit:28};
 gate(prep.writerPolicy&&Object.keys(prep.writerPolicy).length===Object.keys(writerPolicy).length&&Object.entries(writerPolicy).every(([k,v])=>prep.writerPolicy[k]===v),'cache_preparation_writer_policy_changed');
 const protocol=prep.writer.phaseProtocol;
 gate(protocol?.valid===true&&protocol.drainedToEof===true&&protocol.writeStartObserved===true&&protocol.zeroAcceptanceSeconds===60&&protocol.zeroSupervisionSeconds===65&&protocol.writeSeconds===60&&protocol.lifecycleSeconds===145&&number(protocol.registrationSeconds)&&protocol.registrationSeconds<=10&&protocol.frames?.length===2&&protocol.frames[0].phase==='zero-wait'&&protocol.frames[1].phase==='write-start'&&protocol.frames.every(f=>number(f.monotonic))&&protocol.frames[1].monotonic>=protocol.frames[0].monotonic&&protocol.frames[1].monotonic-protocol.frames[0].monotonic<=60,'cache_preparation_writer_protocol_failed');
 gate(prep.writer.prewriteQuiescence?.budgetSeconds===60&&prep.writer.prewriteQuiescence.zeroDirtyAndWriteback===true&&prep.writer.prewriteQuiescence.fileDirtyBytes===0&&prep.writer.prewriteQuiescence.fileWritebackBytes===0&&number(prep.writer.prewriteQuiescence.seconds)&&prep.writer.prewriteQuiescence.seconds<=60&&Number.isInteger(prep.writer.prewriteQuiescence.samples)&&prep.writer.prewriteQuiescence.samples>0,'cache_preparation_prewrite_dirty');
 gate(prep.quiescence?.budgetSeconds===60&&prep.quiescence.zeroDirtyAndWriteback===true&&prep.quiescence.fileDirtyBytes===0&&prep.quiescence.fileWritebackBytes===0,'cache_preparation_dirty');
 const post=prep.postwriteQuiescence;
 gate(post?.budgetSeconds===60&&post.sampleLimit===256&&Number.isInteger(post.samples)&&post.samples>0&&post.samples<=256&&number(post.seconds)&&post.seconds<=60&&post.zeroDirtyAndWriteback===true&&post.fileDirtyBytes===0&&post.fileWritebackBytes===0&&Number.isInteger(post.dirtySamples)&&post.dirtySamples>=0&&post.dirtySamples<=post.samples&&number(post.maxFileDirtyBytes)&&number(post.maxFileWritebackBytes),'cache_preparation_postwrite_zero_missing');
 for(const sample of [post.initial,post.terminal,prep.after,prep.final])gate(sample&&number(sample.accounting?.currentBytes)&&number(sample.qdrantCounters?.writeBytes)&&number(sample.memory?.file_dirty)&&number(sample.memory?.file_writeback),'cache_preparation_postwrite_numeric_missing');
 gate(post.terminal.memory.file_dirty===0&&post.terminal.memory.file_writeback===0&&prep.after.memory.file_dirty===0&&prep.after.memory.file_writeback===0&&prep.final.memory.file_dirty===0&&prep.final.memory.file_writeback===0,'cache_preparation_postwrite_dirty');
 const fit=prep.postCapFit;
 gate(fit&&[fit.currentBytes,fit.missingSelectedBytes].every(number)&&fit.reserveBytes===256*1024**2&&fit.capBytes===6*1024**3&&fit.currentBytes+fit.missingSelectedBytes+fit.reserveBytes<=fit.capBytes,'cache_preparation_cap_fit');
 gate(prep.initialMeasurement?.selectionHash===prep.measurement?.selectionHash&&prep.measurement?.selectionHash===ready.selectionHash,'cache_preparation_cohort_changed');
 for(const [field,keys] of [['memoryEvents',['max','oom','oom_kill']],['cpu',['nr_throttled','throttled_usec']]]){
  gate(keys.every(k=>number(prep.before?.[field]?.[k])&&prep.before[field][k]===prep.final?.[field]?.[k]),'cache_preparation_resource_failure');
 }
 for(const health of [prep.healthBefore,prep.healthAfter])gate(health?.green===true&&health.optimizerOk===true&&health.points===244262&&health.segments===12&&health.shards===6,'cache_preparation_health_failure');
 gate(prep.before?.qdrantPid>0&&prep.before.qdrantPid===prep.final?.qdrantPid&&prep.before.sourceStartTicks>0&&prep.before.sourceStartTicks===prep.final?.sourceStartTicks&&HASH.test(prep.before.sourceProcessFence||'')&&prep.before.sourceProcessFence===prep.final?.sourceProcessFence&&HASH.test(prep.before.ancestorLimitFence||'')&&prep.before.ancestorLimitFence===prep.final?.ancestorLimitFence,'cache_preparation_source_failure');
 gate(prep.queries===0&&prep.pinning===false&&prep.archiveBytesRead===0&&prep.fileCacheAdvice===false&&prep.lifecycleChanges===0&&prep.sourceResourceLimitWrites===0&&prep.productionBackupEquivalent===false,'cache_preparation_scope_changed');

 gate(pressure.selectionHash===ready.selectionHash&&hash(ready.selectionHash),'cpu0_readiness_cohort_changed');
 gate(ready.cold?.residentPagesAfterEviction===0&&ready.cold.pointCount===244262&&ready.cold.segmentCount===12&&ready.cold.shardCount===6&&ready.pressureWriterPlacement==='controller-original-cgroup'&&ready.pressure?.mode==='readonly-existing-archive'&&ready.pressure.bytes===4428863488,'cpu0_readiness_scope_changed');
 if(phase==='candidate')for(const state of [ready.initialPinState,ready.pinState]){gate(state?.lockedBytes>0&&state.selectionHash===ready.selectionHash,'cpu0_readiness_pin_missing');for(const kind of ['vector','graph','sparse','other']){const row=state.lockedResidency?.[kind];gate(row?.lockedDataPages>0&&row.residentLockedDataPages===row.lockedDataPages,'cpu0_readiness_pin_residency_missing');}}
}

function cpuFailureEvidence(value){
 const rowCheck=row=>{const root=row?.applicability==='hierarchy-root-no-bandwidth-controller';gate(keys(row,['depth','groupIdentitySha256','quotaMicros','periodMicros','nrThrottled','throttledMicros',...(root?['applicability','usageMicros','userMicros','systemMicros']:[])])&&integer(row.depth)&&hash(row.groupIdentitySha256));if(root)gate(row.quotaMicros===null&&row.periodMicros===null&&row.nrThrottled===null&&row.throttledMicros===null&&[row.usageMicros,row.userMicros,row.systemMicros].every(value=>integer(value)));else gate((row.quotaMicros===null||integer(row.quotaMicros))&&integer(row.periodMicros,1)&&integer(row.nrThrottled)&&integer(row.throttledMicros));};
 if(value?.partial===true){gate((keys(value,['rows','partial','failedDepth'])||keys(value,['rows','partial','failedDepth','measurementUnavailable']))&&integer(value.failedDepth)&&Array.isArray(value.rows)&&value.rows.length<=33&&(value.measurementUnavailable===undefined||value.measurementUnavailable===true));value.rows.forEach(rowCheck);return value;}
 gate(keys(value,['before','after','failedDepth','delta'])&&integer(value.failedDepth)&&keys(value.delta,['nrThrottled','throttledMicros'])&&Object.values(value.delta).every(Number.isSafeInteger));hierarchyEvidence(value.before);hierarchyEvidence(value.after);return value;
}

export function validateAdmissionFrame(frame,previous,{sourceFreezeSha256,externalManifestSha256}){
 gate(keys(frame,['kind','schema','variant','birthAdmission','handoff','sourceIdentity','queries','resourceWrites','handoffWrites','modelsRead','consumerBirth','sourceFreezeSha256','externalManifestSha256','productionAcceptance'])&&frame.kind==='consumer-admission'&&frame.productionAcceptance===false&&hash(sourceFreezeSha256)&&hash(externalManifestSha256)&&frame.sourceFreezeSha256===sourceFreezeSha256&&frame.externalManifestSha256===externalManifestSha256,'cpu0_consumer_admission_invalid');
 const receipt=Object.fromEntries(Object.entries(frame).filter(([key])=>!['kind','consumerBirth','sourceFreezeSha256','externalManifestSha256','productionAcceptance'].includes(key)));preflightEvidence(receipt,previous);
 const birth=frame.consumerBirth;gate(keys(birth,['pid','startTicks','parentPid','exeIdentityHash','groupHash','VmLckBytes','outsideSourceCgroup'])&&integer(birth.pid,1)&&integer(birth.startTicks,1)&&integer(birth.parentPid,1)&&hash(birth.exeIdentityHash)&&hash(birth.groupHash)&&birth.VmLckBytes===0&&birth.outsideSourceCgroup===true&&birth.groupHash!==receipt.birthAdmission.target.qdrant.groupHash,'cpu0_consumer_birth_invalid');return{receipt,consumerBirth:birth};
}
