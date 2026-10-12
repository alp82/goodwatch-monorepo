// Pure validation for the held-child v2 protocol. Performs no capture, queries or control.
export const CONTROL_READY_SECONDS=1200;
const HASH=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/;
export class ContractFailure extends Error{constructor(reason){super(reason);this.reason=reason;this.failureKind='contract';}}
function requireGate(ok,reason){if(!ok)throw new ContractFailure(reason);}
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
function cleanLimits(value){requireGate(value&&['oom','oom_kill','max'].every(k=>value.memoryEventDelta?.[k]===0)&&['nr_throttled','throttled_usec'].every(k=>value.cpuLimitDelta?.[k]===0),'query_resource_failure');}
const kinds=['vector','graph','sparse','other'];
export function phaseEvidence(frames,exitCode,phase,expected,batch,{requireRed=false}={}){
 requireGate(exitCode===0&&Array.isArray(frames),'control_exit_failure');
 requireGate(Object.keys(expected).sort().join(',')===['helperCodeSha256','helperPolicySha256','controllerCodeSha256','controllerPolicySha256'].sort().join(','),'freeze_missing');
 requireGate(Object.values(expected).every(x=>typeof x==='string'&&HASH.test(x)),'freeze_missing');
 const stages=['cache-preparation-complete','pressure-complete','query-ready','query-finished','released','unpin-complete'];
 requireGate(frames.length===6&&frames.every((f,i)=>f.schema==='search.clone-mlock-control.v2'&&f.stage===stages[i]&&f.phase===phase),'control_frames_missing');
 for(const f of frames){requireGate(typeof f.at==='string'&&UTC.test(f.at)&&Number.isFinite(Date.parse(f.at)),'timestamp_invalid');for(const [k,v]of Object.entries(expected))requireGate(f[k]===v,'freeze_changed');}
 requireGate(frames.every((f,i)=>!i||Date.parse(f.at)>=Date.parse(frames[i-1].at)),'phase_order_invalid');
 const [preparation,pressure,ready,finished,released,cleanup]=frames;
 requireGate(ready.diagnosticReadySeconds===CONTROL_READY_SECONDS,'diagnostic_ready_budget_changed');
 cleanLimits(preparation.preparationToInitialLimits);
 const prep=preparation.cachePreparation;
 requireGate(preparation.cachePreparationMode==='post-cold-owned-cgroup-reclaim'&&HASH.test(preparation.cachePreparationHelperSha256||'')&&prep?.schema==='owned-clone-reclaim-preparation.v1'&&prep.stage==='prepared-headroom-measured','cache_preparation_missing');
 requireGate(prep.writer?.requestedBytes===3*1024**3&&prep.writer.registeredBeforeWrite===true&&prep.writer.writerExitObserved===true&&prep.writer.cleanupUnknown===false&&prep.writer.pidfdRetained===false&&prep.writer.writeAttempts===1&&prep.writer.writerGone===true&&prep.writer.writerExitCode===0&&prep.writer.timedOut===false&&((prep.writer.outcome==='accepted'&&prep.writer.writtenBytes===10)||(prep.writer.outcome==='under-reclaimed'&&prep.writer.errno===11)),'cache_preparation_writer_failed');
 const writerPolicy={registrationSeconds:10,prewriteAcceptanceSeconds:60,prewriteSupervisionSeconds:65,kernelWriteSeconds:60,cleanupSeconds:10,lifecycleSeconds:145,receiptLimit:18,censusLimit:28};
 requireGate(prep.writerPolicy&&Object.keys(prep.writerPolicy).length===Object.keys(writerPolicy).length&&Object.entries(writerPolicy).every(([k,v])=>prep.writerPolicy[k]===v),'cache_preparation_writer_policy_changed');
 const protocol=prep.writer.phaseProtocol;
 requireGate(protocol?.valid===true&&protocol.drainedToEof===true&&protocol.writeStartObserved===true&&protocol.zeroAcceptanceSeconds===60&&protocol.zeroSupervisionSeconds===65&&protocol.writeSeconds===60&&protocol.lifecycleSeconds===145&&number(protocol.registrationSeconds)&&protocol.registrationSeconds<=10&&protocol.frames?.length===2&&protocol.frames[0].phase==='zero-wait'&&protocol.frames[1].phase==='write-start'&&protocol.frames.every(f=>number(f.monotonic))&&protocol.frames[1].monotonic>=protocol.frames[0].monotonic&&protocol.frames[1].monotonic-protocol.frames[0].monotonic<=60,'cache_preparation_writer_protocol_failed');
 requireGate(prep.writer.prewriteQuiescence?.budgetSeconds===60&&prep.writer.prewriteQuiescence.zeroDirtyAndWriteback===true&&prep.writer.prewriteQuiescence.fileDirtyBytes===0&&prep.writer.prewriteQuiescence.fileWritebackBytes===0&&number(prep.writer.prewriteQuiescence.seconds)&&prep.writer.prewriteQuiescence.seconds<=60&&Number.isInteger(prep.writer.prewriteQuiescence.samples)&&prep.writer.prewriteQuiescence.samples>0,'cache_preparation_prewrite_dirty');
 requireGate(prep.quiescence?.budgetSeconds===60&&prep.quiescence.zeroDirtyAndWriteback===true&&prep.quiescence.fileDirtyBytes===0&&prep.quiescence.fileWritebackBytes===0,'cache_preparation_dirty');
 const fit=prep.postCapFit;
 requireGate(fit&&[fit.currentBytes,fit.missingSelectedBytes].every(number)&&fit.reserveBytes===256*1024**2&&fit.capBytes===6*1024**3&&fit.currentBytes+fit.missingSelectedBytes+fit.reserveBytes<=fit.capBytes,'cache_preparation_cap_fit');
 requireGate(prep.initialMeasurement?.selectionHash===prep.measurement?.selectionHash&&prep.measurement?.selectionHash===ready.selectionHash,'cache_preparation_cohort_changed');
 for(const [field,keys] of [['memoryEvents',['max','oom','oom_kill']],['cpu',['nr_throttled','throttled_usec']]]){
  requireGate(keys.every(k=>number(prep.before?.[field]?.[k])&&prep.before[field][k]===prep.final?.[field]?.[k]),'cache_preparation_resource_failure');
 }
 for(const health of [prep.healthBefore,prep.healthAfter])requireGate(health?.green===true&&health.optimizerOk===true&&health.points===244262&&health.segments===12&&health.shards===6,'cache_preparation_health_failure');
 requireGate(prep.before?.qdrantPid>0&&prep.before.qdrantPid===prep.final?.qdrantPid&&prep.before.sourceStartTicks>0&&prep.before.sourceStartTicks===prep.final?.sourceStartTicks&&HASH.test(prep.before.sourceProcessFence||'')&&prep.before.sourceProcessFence===prep.final?.sourceProcessFence&&HASH.test(prep.before.ancestorLimitFence||'')&&prep.before.ancestorLimitFence===prep.final?.ancestorLimitFence,'cache_preparation_source_failure');
 requireGate(prep.queries===0&&prep.pinning===false&&prep.archiveBytesRead===0&&prep.fileCacheAdvice===false&&prep.lifecycleChanges===0&&prep.sourceResourceLimitWrites===0&&prep.productionBackupEquivalent===false,'cache_preparation_scope_changed');
 requireGate(pressure.selectionHash===ready.selectionHash&&ready.selectionHash===finished.selectionHash&&HASH.test(ready.selectionHash),'range_cohort_changed');
 requireGate(released.released===true&&released.pinChildExited===true&&cleanup.pinChildExited===true,'pin_cleanup_unproven');
 requireGate(ready.cold?.residentPagesAfterEviction===0&&ready.cold.pointCount===244262&&ready.cold.segmentCount===12&&ready.cold.shardCount===6,'cold_control_incomplete');
 requireGate(ready.pressureWriterPlacement==='controller-original-cgroup'&&ready.pressure?.mode==='readonly-existing-archive'&&ready.pressure.bytes===4428863488,'pressure_protocol_changed');
 try{cleanLimits(pressure.pressureLimits)}catch{throw new ContractFailure('pressure_cap_confounded')};
 cleanLimits(finished.queryLimits);
 requireGate(number(batch.serverMs)&&number(batch.wallMs)&&number(finished.queryProcessDelta?.majorFaults),'batch_metrics_missing');
 if(phase==='baseline'&&requireRed){
  requireGate(pressure.negativePrequeryMissingBytes===64*1024**2&&pressure.prequeryMissingBytes>=pressure.negativePrequeryMissingBytes,'negative_insufficient_missing_pages');
  requireGate(finished.queryProcessDelta.majorFaults>0,'negative_no_faults');
  requireGate(batch.serverMs>=1500,'negative_not_red');
 }else if(phase==='candidate'){
  requireGate(batch.serverMs<1500&&batch.wallMs<1500,'candidate_tail_remains');
  for(const state of [ready.initialPinState,ready.pinState,finished.pinStateAfterQuery]){
   requireGate(state&&state.lockedBytes>0,'pin_holder_missing');
   for(const k of kinds){const r=state.lockedResidency?.[k];requireGate(r&&r.lockedDataPages>0&&r.residentLockedDataPages===r.lockedDataPages,'pin_residency_missing');}
   requireGate(state.selectionHash===ready.selectionHash,'pin_range_cohort_changed');
  }
  requireGate(ready.pinState.newLockBytes===0&&finished.pinStateAfterQuery.newLockBytes===0&&!ready.pinState.rangesChanged&&!finished.pinStateAfterQuery.rangesChanged,'pin_turnover_during_case');
 }
 return {phase,selectionHash:ready.selectionHash,serverMs:batch.serverMs,wallMs:batch.wallMs,queryMajorFaults:finished.queryProcessDelta.majorFaults,baselineServerRed:phase==='baseline'&&batch.serverMs>=1500,transportOrOtherTail:batch.wallMs>=1500&&batch.serverMs<1500,productionAcceptance:false};
}
export function pairedEvidence(baseline,candidate,baselineHashes,candidateHashes){
 requireGate(baseline.selectionHash===candidate.selectionHash,'paired_cohort_incomparable');
 const keys=['resultIdHash','resultIdScoreHash','resultSetHash','resultScoreSetHash'];
 requireGate(keys.every(k=>HASH.test(baselineHashes[k]||'')&&HASH.test(candidateHashes[k]||'')),'parity_hash_missing');
 const parity=Object.fromEntries(keys.map(k=>[k+'Parity',baselineHashes[k]===candidateHashes[k]]));
 requireGate(parity.resultScoreSetHashParity,'per_id_scores_changed');
 return {...parity,productionAcceptance:false};
}
