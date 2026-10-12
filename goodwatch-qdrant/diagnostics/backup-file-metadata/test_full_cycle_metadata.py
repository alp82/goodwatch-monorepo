import copy,datetime as dt,io,json,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import full_cycle_metadata as cycle
import audit_full_cycle as audit
import launch_full_cycle_metadata as launch

DATA={'schema':'private-qdrant-file-baseline.v1','files':{'private-path/data':[1,1,10,4096,0,0]},'directories':{},'cohort':['private-path']}
RECEIPT={'endedAt':'2026-10-12T07:50:11+00:00','metadataHash':'a'*64,'sourceIdentityHash':'a'*64,'sourcePid':42,'sourceStartTicks':123}
def pressure():return {'qdrantPid':42,'sourceStartTicks':123,'qdrantMinorFaults':20,'qdrantMajorFaults':3,'qdrantReadBytes':4096,'memoryEvents':{'max':0,'oom':0,'oom_kill':0},'cpuLimitCounters':{'nr_throttled':0,'throttled_usec':0},'reclaim':{'pgscan_file':10,'pgsteal_file':10,'workingset_refault_file':2},'host':{'MemAvailable':9000},'limits':{'memoryMax':'max','memoryHigh':'max','cpuMax':'max 100000'},'memoryOomGroup':0}
def row():return {'event':'private-full-cycle-file-metadata-sample','at':'2026-10-12T08:16:00+00:00','sample':0,'sourceIdentityHash':'a'*64,'sourcePid':42,'sourceStartTicks':123,'scanComplete':True,'completedWithinScheduledWindow':True,'scanReason':None,'private':copy.deepcopy(DATA),'sourceTemp':{'truncated':False,'phaseBytes':{'sourceArchive':100,'shardStaging':10,'other':0}},'snapshotTargets':{'truncated':False,'classes':{'media':{'targetTmpBytes':50}}},'backup':{'complete':True},'pressureBefore':pressure(), 'pressureAfter':pressure(),'sampleDurationSeconds':4}
def rows(sample):return [{'event':'full-cycle-file-metadata-start','scheduledStart':'2026-10-12T07:59:00+00:00','scheduledEnd':'2026-10-12T08:29:00+00:00','intervalSeconds':30,'sourceIdentityHash':'a'*64,'sourcePid':42,'sourceStartTicks':123,'priorBaselineTransported':False},sample,{'event':'full-cycle-file-metadata-summary','at':'2026-10-12T08:29:00+00:00','samples':1,'completeScans':1,'incompleteScans':0,'metadataGrowthCoverageUnknown':False},{'event':'backup-metadata-reader-exit','readerGone':True,'exitCode':0,'termSent':False,'killSent':False}]
class Fixtures(unittest.TestCase):
 def test_complete_scan_reports_positive_growth_without_shrink_offset(self):
  b=copy.deepcopy(DATA);b['files']['other-private-name']=[1,2,100,8192,0,0]
  r=row();r['private']['files']['private-path/data'][2]=25;r['private']['files']['other-private-name']=[1,2,0,0,0,0]
  out=audit.report(b,RECEIPT,rows(r));self.assertEqual(out['observedPositiveGrowthPeakBytes'],15);self.assertFalse(out['growthCoverageUnknown']);self.assertFalse(out['futureCeilingEstablished']);self.assertNotIn('private-path',json.dumps(out))
 def test_any_incomplete_scan_invalidates_whole_observed_growth_peak(self):
  r=row();r.update(scanComplete=False,private=None,scanReason='scan_time_bound')
  out=audit.report(DATA,RECEIPT,rows(r));self.assertTrue(out['growthCoverageUnknown']);self.assertIsNone(out['observedPositiveGrowthPeakBytes']);self.assertEqual(out['observedConcurrentArchiveCopyPeakBytes'],150)
 def test_source_turnover_cannot_compare_prior_baseline(self):
  r=row();r['sourceStartTicks']+=1;out=audit.report(DATA,RECEIPT,rows(r));self.assertTrue(out['growthCoverageUnknown']);self.assertIsNone(out['samples'][0]['positiveFileGrowth'])
 def test_after_window_completed_scan_invalidates_growth_coverage(self):
  r=row();r['completedWithinScheduledWindow']=False;out=audit.report(DATA,RECEIPT,rows(r));self.assertTrue(out['growthCoverageUnknown'])
 def test_no_clean_exit_no_observed_growth_claim(self):
  rr=rows(row());rr[-1].update(readerGone=False,exitCode=None);out=audit.report(DATA,RECEIPT,rr);self.assertFalse(out['readerExitProven']);self.assertTrue(out['growthCoverageUnknown'])
 def test_source_after_scan_failure_does_not_emit_misattributed_sample(self):
  class H:
   def source(self,c):return {'identity':(1,42,123),'pid':42,'ticks':123,'store':Path('/fixture'),'snapshots':Path('/fixture')}
   def backup_paths(self):return set()
   def stamp(self):return '2026-10-12T07:59:00+00:00'
   def digest(self,v):return 'a'*64
   def pressure(self,s):return {'host':{'MemAvailable':9000}}
   def metadata_tree(self,p):return row()['sourceTemp']
   def archive_metadata(self,p):return row()['snapshotTargets']
   def backup_running(self,p):return {'complete':True}
   def sample_source_fence(self,c,s):raise RuntimeError('source_changed')
  class S:
   def scan(self,p):return DATA,{'complete':True}
  emitted=[];now=dt.datetime.fromisoformat(cycle.START).timestamp()
  with self.assertRaisesRegex(RuntimeError,'source_changed'):cycle.run({},H(),S(),emitted.append,wall=lambda:now,clock=lambda:0)
  self.assertEqual(len(emitted),1);self.assertEqual(emitted[0]['event'],'full-cycle-file-metadata-start')
 def test_sequence_jump_and_time_reversal_cannot_establish_growth_peak(self):
  rr=rows(row());rr[1]['sample']=2;out=audit.report(DATA,RECEIPT,rr);self.assertIn('sample_sequence_invalid',out['coverageProblems']);self.assertIsNone(out['observedPositiveGrowthPeakBytes'])
  rr=rows(row());second=copy.deepcopy(rr[1]);second['sample']=1;second['at']='2026-10-12T08:15:00+00:00';rr.insert(2,second);out=audit.report(DATA,RECEIPT,rr);self.assertIn('sample_time_nonmonotonic',out['coverageProblems'])
 def test_incomplete_stage_peak_is_lower_bound_not_complete_peak(self):
  r=row();r['sourceTemp']['truncated']=True;out=audit.report(DATA,RECEIPT,rows(r));self.assertTrue(out['growthCoverageUnknown']);self.assertIsNone(out['observedConcurrentArchiveCopyPeakBytes']);self.assertEqual(out['observedConcurrentArchiveCopyLowerBoundBytes'],150)
 def test_nonterminal_reader_exit_and_early_window_summary_block_claims(self):
  rr=rows(row());rr.append({'event':'unexpected-later-frame'});out=audit.report(DATA,RECEIPT,rr);self.assertFalse(out['readerExitProven'])
  rr=rows(row());rr[2]['at']='2026-10-12T08:16:10+00:00';out=audit.report(DATA,RECEIPT,rr);self.assertIn('window_ended_early',out['coverageProblems'])
 def test_aggregate_fault_and_reclaim_deltas_keep_interval_attribution(self):
  r=row();r['pressureAfter']['qdrantMajorFaults']=10;r['pressureAfter']['qdrantReadBytes']=8192;r['pressureAfter']['reclaim']['pgscan_file']=17
  out=audit.report(DATA,RECEIPT,rows(r));self.assertEqual(out['aggregateProcessAndLimitCounterDeltas']['qdrantMajorFaults'],7);self.assertEqual(out['aggregateProcessAndLimitCounterDeltas']['qdrantReadBytes'],4096);self.assertEqual(out['hostReclaimIntervalDeltas']['pgscan_file'],7);self.assertIn('not-per-query',out['counterAttribution'])
 def test_resource_counter_reset_is_incomparable_never_compensated(self):
  r=row();r['pressureAfter']['qdrantMajorFaults']=0;out=audit.report(DATA,RECEIPT,rows(r));self.assertFalse(out['aggregateResourceIntervalComparable']);self.assertIsNone(out['aggregateProcessAndLimitCounterDeltas']);self.assertTrue(out['growthCoverageUnknown'])
 def test_private_counter_keys_dropped_and_actual_pressure_pid_fenced(self):
  r=row();r['pressureAfter']['reclaim']['pgscan_private-owner']=999;out=audit.report(DATA,RECEIPT,rows(r));self.assertNotIn('private-owner',json.dumps(out))
  r['pressureAfter']['qdrantPid']=43;out=audit.report(DATA,RECEIPT,rows(r));self.assertFalse(out['aggregateResourceIntervalComparable']);self.assertIsNone(out['aggregateProcessAndLimitCounterDeltas'])
 def test_default_launcher_never_inspects_or_ssh(self):
  with patch('sys.argv',['launcher']),patch.object(Path,'read_bytes',side_effect=AssertionError('read')),patch.object(launch.subprocess,'run',side_effect=AssertionError('ssh')),patch('sys.stdout',new_callable=io.StringIO)as out:launch.main()
  self.assertFalse(json.loads(out.getvalue())['ssh'])
 def test_payload_contains_no_prior_baseline_and_compiles(self):
  source=launch.payload('def run(*args):pass',{},'', '');compile(source,'prepared','exec');self.assertNotIn(audit.BASELINE_SHA,source);self.assertNotIn('prior-private-path',source)
if __name__=='__main__':unittest.main()
