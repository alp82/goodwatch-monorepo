// Pure validation for the held-child v2 protocol. Performs no capture, queries or control.
const HASH=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|\+00:00)$/;
function requireGate(ok,reason){if(!ok)throw new Error(reason);}
const number=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
function cleanLimits(value){requireGate(value&&['oom','oom_kill','max'].every(k=>value.memoryEventDelta?.[k]===0)&&['nr_throttled','throttled_usec'].every(k=>value.cpuLimitDelta?.[k]===0),'query_resource_failure');}
const kinds=['vector','graph','sparse','other'];
export function phaseEvidence(frames,exitCode,phase,expected,batch,{requireRed=false}={}){
 requireGate(exitCode===0&&Array.isArray(frames),'control_exit_failure');
 requireGate(Object.keys(expected).sort().join(',')===['helperCodeSha256','helperPolicySha256','controllerCodeSha256','controllerPolicySha256'].sort().join(','),'freeze_missing');
 requireGate(Object.values(expected).every(x=>typeof x==='string'&&HASH.test(x)),'freeze_missing');
 const stages=['pressure-complete','query-ready','query-finished','released','unpin-complete'];
 requireGate(frames.length===5&&frames.every((f,i)=>f.schema==='search.clone-mlock-control.v2'&&f.stage===stages[i]&&f.phase===phase),'control_frames_missing');
 for(const f of frames){requireGate(typeof f.at==='string'&&UTC.test(f.at)&&Number.isFinite(Date.parse(f.at)),'timestamp_invalid');for(const [k,v]of Object.entries(expected))requireGate(f[k]===v,'freeze_changed');}
 requireGate(frames.every((f,i)=>!i||Date.parse(f.at)>=Date.parse(frames[i-1].at)),'phase_order_invalid');
 const [pressure,ready,finished,released,cleanup]=frames;
 requireGate(pressure.selectionHash===ready.selectionHash&&ready.selectionHash===finished.selectionHash&&HASH.test(ready.selectionHash),'range_cohort_changed');
 requireGate(released.released===true&&released.pinChildExited===true&&cleanup.pinChildExited===true,'pin_cleanup_unproven');
 requireGate(ready.cold?.residentPagesAfterEviction===0&&ready.cold.pointCount===244262&&ready.cold.segmentCount===12&&ready.cold.shardCount===6,'cold_control_incomplete');
 requireGate(ready.pressureWriterPlacement==='controller-original-cgroup'&&ready.pressure?.mode==='readonly-existing-archive'&&ready.pressure.bytes===4428863488,'pressure_protocol_changed');
 try{cleanLimits(pressure.pressureLimits)}catch{throw Error('pressure_cap_confounded')};
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
