"""Prepared query-free full-scan metadata collector; prior baseline stays local."""
import datetime as dt,time,json,hashlib
START='2026-10-12T07:59:00+00:00'
END='2026-10-12T08:29:00+00:00'
INTERVAL=30
MAX_SAMPLES=64
SAFE={'source_changed','source_limits_changed','private_contract_invalid','backup_schedule_unavailable','sampling_window_closed','empty_collection_cohort','path_invalid','scan_time_bound','scan_entry_bound','alias_excluded','directory_changed','nonregular_excluded','empty_cohort','store_changed','output_bound','scan_depth_bound'}

def run(contract,helpers,scanner,emit,start=START,end=END,wall=time.time,clock=time.monotonic,sleep=time.sleep):
 begin=dt.datetime.fromisoformat(start).timestamp();finish=dt.datetime.fromisoformat(end).timestamp()
 if not 0<finish-begin<=1800 or wall()>=finish:raise RuntimeError('sampling_window_closed')
 while wall()<begin:sleep(min(1,begin-wall()))
 stop=clock()+min(1800,finish-wall());origin=helpers.source(contract);jobs=helpers.backup_paths();samples=complete=failed=0
 emit({'event':'full-cycle-file-metadata-start','at':helpers.stamp(),'scheduledStart':start,'scheduledEnd':end,'intervalSeconds':INTERVAL,'maximumSeconds':1800,'sourceIdentityHash':helpers.digest(origin['identity']),'sourcePid':origin['pid'],'sourceStartTicks':origin['ticks'],'priorBaselineTransported':False,'queries':0,'contentsRead':0,'cacheControls':0,'remoteHostFilesCreated':0})
 while clock()<stop and wall()<finish and samples<MAX_SAMPLES:
  t=clock();current=helpers.source(contract)
  if current['identity']!=origin['identity']:raise RuntimeError('source_changed')
  before=helpers.pressure(current);private=None;summary=None;reason=None
  try:private,summary=scanner.scan(current['store'])
  except Exception as error:reason=str(error)if str(error)in SAFE else 'metadata_scan_incomplete'
  temp=helpers.metadata_tree(current['store']/'tmp');archive=helpers.archive_metadata(current['snapshots']);job=helpers.backup_running(jobs);after=helpers.pressure(current);helpers.sample_source_fence(contract,current)
  iscomplete=private is not None and summary is not None and summary['complete']is True
  if iscomplete:complete+=1
  else:failed+=1
  row={'event':'private-full-cycle-file-metadata-sample','at':helpers.stamp(),'sample':samples,'sourceIdentityHash':helpers.digest(current['identity']),'sourcePid':current['pid'],'sourceStartTicks':current['ticks'],'scanComplete':iscomplete,'scanReason':reason,'fileMetadataSummary':summary,'private':private,'pressureBefore':before,'pressureAfter':after,'sourceTemp':temp,'snapshotTargets':archive,'backup':job,'sampleDurationSeconds':clock()-t,'growthBoundsKnown':False}
  # Completed scans after the boundary are retained as outside-window evidence, not hidden.
  row['completedWithinScheduledWindow']=wall()<=finish and clock()<=stop
  emit(row);samples+=1
  sleep(max(0,min(INTERVAL-(clock()-t),stop-clock(),finish-wall())))
 emit({'event':'full-cycle-file-metadata-summary','at':helpers.stamp(),'samples':samples,'completeScans':complete,'incompleteScans':failed,'metadataGrowthCoverageUnknown':failed>0 or complete==0,'futureCeilingEstablished':False,'latencyMeasured':False,'productionAcceptance':False,'queries':0,'contentsRead':0,'cacheControls':0,'remoteHostFilesCreated':0})
