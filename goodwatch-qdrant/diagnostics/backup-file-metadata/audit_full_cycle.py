"""Local offline public totals from private complete file metadata; never emit paths."""
import argparse,datetime as dt,hashlib,json,os,stat,math
from pathlib import Path
import complete_baseline as scan

BASELINE_SHA='19290005b68cf49d40d8e0860c203afb6d50e9c14d7f956c702c9450f2041126'
MAX_JOURNAL=1024*1024*1024
RECLAIM_NAMES=frozenset(('pgscan_kswapd','pgscan_direct','pgscan_khugepaged','pgscan_anon','pgscan_file','pgsteal_kswapd','pgsteal_direct','pgsteal_khugepaged','pgsteal_anon','pgsteal_file','workingset_refault_anon','workingset_refault_file','pswpin','pswpout')) | frozenset(prefix+zone for prefix in ('allocstall_','pgscan_','pgsteal_') for zone in ('dma','dma32','normal','movable','device'))

def validate(data):
 if type(data)is not dict or set(data)!={'schema','files','directories','cohort'} or data['schema']!='private-qdrant-file-baseline.v1':raise ValueError('invalid_private_metadata')
 if not data['files']or not data['cohort']or len(data['files'])>100000:raise ValueError('invalid_private_metadata')
 for key,v in data['files'].items():
  if type(key)is not str or type(v)is not list or len(v)!=6 or any(type(n)is not int or n<0 for n in v):raise ValueError('invalid_private_metadata')
 return data

def private_rows(path,limit):
 info=path.lstat()
 if not stat.S_ISREG(info.st_mode)or info.st_uid!=os.getuid()or stat.S_IMODE(info.st_mode)!=0o600 or info.st_size>limit:raise ValueError('private_artifact_guard')
 with path.open('rb')as f:
  for line in f:
   if len(line)>17*1024*1024 or not line.endswith(b'\n'):raise ValueError('row_bound')
   yield json.loads(line)

def baseline(path):
 if hashlib.sha256(path.read_bytes()).hexdigest()!=BASELINE_SHA:raise ValueError('baseline_hash')
 rows=list(private_rows(path,32*1024*1024));matches=[r for r in rows if r.get('event')=='private-complete-file-baseline']
 if len(matches)!=1 or matches[0]['public']['complete']is not True:raise ValueError('baseline_incomplete')
 r=matches[0];return validate(r['private']),r['public']

def instant(value):
 if type(value)is not str:raise ValueError('invalid_timestamp')
 x=dt.datetime.fromisoformat(value)
 if x.tzinfo is None or x.utcoffset()!=dt.timedelta(0):raise ValueError('invalid_timestamp')
 return x

def report(base,receipt,rows):
 records=[];unknown=False;starts=[];ends=[];reader=None;last_event=None;reasons=[];times=[];sample_numbers=[];stage_incomplete=False;failures=0;reader_count=0;resource_edges=[];resource_valid=True
 reason_allow={'empty_collection_cohort','scan_depth_bound','path_invalid','scan_time_bound','scan_entry_bound','alias_excluded','directory_changed','nonregular_excluded','empty_cohort','store_changed','output_bound','metadata_scan_incomplete'}
 def mark(reason):
  nonlocal unknown
  unknown=True
  if reason not in reasons:reasons.append(reason)
 for row in rows:
  event=row.get('event');last_event=event
  if event=='full-cycle-file-metadata-start':starts.append(row)
  elif event=='full-cycle-file-metadata-summary':ends.append(row)
  elif event=='backup-metadata-reader-exit':reader=row;reader_count+=1
  elif event=='full-cycle-file-metadata-failed':failures+=1;mark('collector_failed')
  elif event=='private-full-cycle-file-metadata-sample':
   same=row['sourceIdentityHash']==receipt['sourceIdentityHash'] and row['sourcePid']==receipt['sourcePid']and row['sourceStartTicks']==receipt['sourceStartTicks']
   complete=row['scanComplete']is True and row['completedWithinScheduledWindow']is True and same
   if not complete:mark('incomplete_or_incomparable_scan')
   change=None
   if complete:change=scan.growth(base,validate(row['private']))
   stage_complete=row['sourceTemp']['truncated']is False and row['snapshotTargets']['truncated']is False and row['backup']['complete']is True
   if not stage_complete:stage_incomplete=True;mark('stage_metadata_incomplete')
   archive=row['sourceTemp']['phaseBytes']['sourceArchive']+sum(v['targetTmpBytes']for v in row['snapshotTargets']['classes'].values())
   edge=[]
   for label in ('pressureBefore','pressureAfter'):
    pressure=row[label]
    if (pressure.get('qdrantPid'),pressure.get('sourceStartTicks'))!=(receipt['sourcePid'],receipt['sourceStartTicks']):resource_valid=False;mark('resource_process_generation_incomparable')
    if pressure.get('limits')!={'memoryMax':'max','memoryHigh':'max','cpuMax':'max 100000'}or pressure.get('memoryOomGroup')!=0:resource_valid=False;mark('resource_limits_changed')
    fixed={k:pressure[k]for k in ('qdrantMinorFaults','qdrantMajorFaults','qdrantReadBytes')}
    for k in ('max','oom','oom_kill'):fixed['memory_'+k]=pressure['memoryEvents'][k]
    for k in ('nr_throttled','throttled_usec'):fixed['cpu_'+k]=pressure['cpuLimitCounters'][k]
    for k,v in fixed.items():
     if type(v)is not int or v<0:raise ValueError('invalid_resource_numeric')
    reclaim={k:v for k,v in pressure['reclaim'].items()if k in RECLAIM_NAMES}
    if any(type(v)is not int or v<0 for v in reclaim.values()):raise ValueError('invalid_resource_numeric')
    edge.append((fixed,reclaim))
   resource_edges.append(edge)
   at=instant(row['at']);times.append(at);sample_numbers.append(row['sample'])
   if type(row['sample'])is not int or row['sample']<0:mark('sample_sequence_invalid')
   duration=row['sampleDurationSeconds']
   if type(duration)not in(int,float)or not math.isfinite(duration)or duration<0:raise ValueError('invalid_duration')
   reason=row['scanReason']if row['scanReason']in reason_allow or row['scanReason']is None else 'unknown_scan_reason'
   for numeric in (archive,row['sourceTemp']['phaseBytes']['shardStaging'],row['sourceTemp']['phaseBytes']['other'],row['pressureAfter']['host']['MemAvailable']):
    if type(numeric)is not int or numeric<0:raise ValueError('invalid_numeric')
   records.append({'at':row['at'],'sample':row['sample'],'scanComplete':complete,'stageMetadataComplete':stage_complete,'scanReason':reason,'positiveFileGrowth':change,'concurrentArchiveCopyBytes':archive,'sourceShardStagingBytes':row['sourceTemp']['phaseBytes']['shardStaging'],'sourceOtherTempBytes':row['sourceTemp']['phaseBytes']['other'],'availableBytes':row['pressureAfter']['host']['MemAvailable'],'sampleDurationSeconds':duration,'completedWithinScheduledWindow':row['completedWithinScheduledWindow']})
 if len(starts)!=1 or len(ends)!=1:mark('missing_or_duplicate_window_frames')
 scheduled_start=scheduled_end=None
 if len(starts)==1:
  start=starts[0];scheduled_start=instant(start['scheduledStart']);scheduled_end=instant(start['scheduledEnd'])
  if not 0<(scheduled_end-scheduled_start).total_seconds()<=1800 or start['intervalSeconds']!=30:mark('window_contract_invalid')
  if (start['sourceIdentityHash'],start['sourcePid'],start['sourceStartTicks'])!=(receipt['sourceIdentityHash'],receipt['sourcePid'],receipt['sourceStartTicks']):mark('start_source_incomparable')
  if start['priorBaselineTransported']is not False:mark('baseline_transport_contract_invalid')
  if any(t<scheduled_start or t>scheduled_end for t in times):mark('samples_outside_window')
 if sample_numbers!=list(range(len(records))):mark('sample_sequence_invalid')
 if any(b<=a for a,b in zip(times,times[1:])):mark('sample_time_nonmonotonic')
 if len(ends)==1:
  end=ends[0]
  if end['samples']!=len(records)or end['completeScans']+end['incompleteScans']!=len(records):mark('summary_count_mismatch')
  if end['incompleteScans']>0 or end['metadataGrowthCoverageUnknown']is not False:mark('summary_incomplete')
  if scheduled_end is not None and instant(end['at'])<scheduled_end:mark('window_ended_early')
 gone=(reader_count==1 and reader is not None and last_event=='backup-metadata-reader-exit'and reader.get('readerGone')is True and type(reader.get('exitCode'))is int and reader['exitCode']==0 and reader.get('termSent')is False and reader.get('killSent')is False)
 if not gone:mark('clean_terminal_reader_exit_unproven')
 if not records:mark('no_samples')
 resource_delta=reclaim_delta=None
 if resource_edges and resource_valid:
  first,reclaim_first=resource_edges[0][0];last,reclaim_last=resource_edges[-1][1]
  fixed_sequence=[edge[0]for pair in resource_edges for edge in pair]
  if any(b[k]<a[k]for a,b in zip(fixed_sequence,fixed_sequence[1:])for k in first):resource_valid=False;mark('resource_counter_reset')
  if resource_valid:
   resource_delta={k:last[k]-v for k,v in first.items()}
   reclaim_sequence=[edge[1]for pair in resource_edges for edge in pair]
   shared=set.intersection(*(set(v)for v in reclaim_sequence));candidate={k:reclaim_last[k]-reclaim_first[k]for k in sorted(shared)}
   reset=any(b[k]<a[k]for a,b in zip(reclaim_sequence,reclaim_sequence[1:])for k in set(a)&set(b))
   if reset or any(v<0 for v in candidate.values()):resource_valid=False;resource_delta=None;mark('host_reclaim_counter_reset')
   else:reclaim_delta=candidate
 positive=[r['positiveFileGrowth']for r in records if r['positiveFileGrowth']is not None];observed_copy=max((r['concurrentArchiveCopyBytes']for r in records),default=None)
 return {'schema':'complete-backup-cycle-metadata-audit.v2','priorBaselineAt':receipt['endedAt'],'priorBaselineHash':receipt['metadataHash'],'samples':records,'readerExitProven':gone,'growthCoverageUnknown':bool(unknown),'aggregateResourceIntervalComparable':resource_valid and bool(resource_edges),'aggregateProcessAndLimitCounterDeltas':resource_delta,'hostReclaimIntervalDeltas':reclaim_delta,'counterAttribution':'aggregate-including-background-and-metadata-observer-footprint-not-per-query','coverageProblems':reasons,'firstSampleAt':None if not times else times[0].isoformat(),'lastSampleAt':None if not times else times[-1].isoformat(),'maximumInterSampleSeconds':None if len(times)<2 else max((b-a).total_seconds()for a,b in zip(times,times[1:])),'continuousCoverage':False,'scanAtomicityProven':False,'observedPositiveGrowthPeakBytes':None if unknown else max(v['positiveApparentGrowthBytes']for v in positive),'observedStatAllocatedPositiveGrowthPeakBytes':None if unknown else max(v['positiveAllocatedStatGrowthBytes']for v in positive),'observedConcurrentArchiveCopyPeakBytes':None if stage_incomplete else observed_copy,'observedConcurrentArchiveCopyLowerBoundBytes':observed_copy if stage_incomplete else None,'archiveCopyPeakIncomplete':stage_incomplete,'futureCeilingEstablished':False,'snapshotAttributionProven':False,'contentChangesExcluded':False,'preallocatedOverwriteGrowthMeasured':False,'latencyMeasured':False,'productionAcceptance':False}

def main():
 p=argparse.ArgumentParser();p.add_argument('--baseline',required=True,type=Path);p.add_argument('--journal',required=True,type=Path);a=p.parse_args()
 try:
  data,receipt=baseline(a.baseline);out=report(data,receipt,private_rows(a.journal,MAX_JOURNAL));print(json.dumps(out,allow_nan=False,indent=2))
 except Exception:print(json.dumps({'schema':'complete-backup-cycle-metadata-audit.v1','auditFailed':True,'reason':'invalid_private_metadata_or_coverage','growthCoverageUnknown':True,'productionAcceptance':False}));raise SystemExit(1)
if __name__=='__main__':main()
