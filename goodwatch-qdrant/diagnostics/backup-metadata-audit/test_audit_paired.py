import copy,json,unittest
import audit_paired as audit

def fixture():
 t='2026-10-12T07:15:00+00:00'
 sample={'event':'backup-metadata-sample','at':t,'sourceIdentityHash':'a'*64,'pressure':{'qdrantPid':123,'sourceStartTicks':5,'host':{'MemAvailable':9_000_000_000}},'sourceTemp':{'truncated':False,'phaseBytes':{'sourceArchive':4_000_000_000,'shardStaging':10_000_000,'other':0}},'snapshotTargets':{'truncated':False,'classes':{'media':{'targetTmpBytes':2_000_000_000}}},'segmentDirectories':{'truncated':False,'newCandidateApparentBytes':17},'existingSegmentMetadata':{'truncated':False},'existingSegmentGrowth':{'deltaIsComplete':True,'apparentByteDelta':23,'allocatedStatByteDelta':4096},'backup':{'complete':True,'running':True}}
 meta=[{'event':'backup-metadata-start','baselineSegmentDirectoryCount':12,'baselineExistingSegmentMetadata':{'truncated':False,'retainedDirectories':12}},sample,{'event':'backup-metadata-summary','metadataIncomplete':False},{'event':'backup-metadata-reader-exit','readerGone':True,'exitCode':0}]
 proc={'startTicks':5,'minorFaults':11,'majorFaults':3,'readBytes':4096,'cpuTicks':10}
 supp=[{'event':'qdrant.memory.observation.v1','startedAt':t,'qdrantPid':123,'processBefore':proc,'processAfter':{**proc,'majorFaults':7,'readBytes':8192},'vmstat':{'pgscan_file':5},'meminfoKiB':{'MemAvailable':8_000_000}},{'event':'qdrant.memory.observation.complete.v1'},{'event':'backup-metadata-reader-exit','readerGone':True,'exitCode':0}]
 return meta,supp

class AuditTests(unittest.TestCase):
 def test_copy_overlap_peak_is_paired_not_sum_of_independent_maxima(self):
  m,s=fixture();m[1]['snapshotTargets']['classes']['media']['targetTmpBytes']=0
  second=copy.deepcopy(m[1]);second['at']='2026-10-12T07:15:02+00:00';second['sourceTemp']['phaseBytes']['sourceArchive']=0;second['snapshotTargets']['classes']['media']['targetTmpBytes']=4_000_000_000;m.insert(2,second)
  out=audit.audit(m,s);self.assertEqual(out['metadata']['observedConcurrentArchiveCopyPeakBytes'],4_000_000_000)
  self.assertEqual(out['metadata']['observedPeaksBytes']['sourceArchiveBytes']+out['metadata']['observedPeaksBytes']['targetCopyBytes'],8_000_000_000)
 def test_v3_empty_cohort_overrides_false_complete_zero_growth_claim(self):
  m,s=fixture();m[0]['baselineSegmentDirectoryCount']=0
  out=audit.audit(m,s);self.assertFalse(out['metadata']['existingSegmentCohortCoverageValid']);self.assertFalse(out['metadata']['intrinsicMetadataRecordsComplete']);self.assertEqual(out['metadata']['incompleteSamples'],1);self.assertFalse(out['stagingAllowanceEstablished'])
 def test_incomplete_directory_sample_never_establishes_staging_ceiling(self):
  m,s=fixture();m[1]['sourceTemp']['truncated']=True
  out=audit.audit(m,s);self.assertEqual(out['metadata']['incompleteSamples'],1);self.assertFalse(out['metadata']['intrinsicMetadataRecordsComplete']);self.assertFalse(out['stagingAllowanceEstablished']);self.assertFalse(out['futureWorkloadCeilingEstablished'])
  self.assertEqual(out['metadata']['observedPeaksBytes']['sourceArchiveBytes'],4_000_000_000)
 def test_complete_observation_reports_peaks_not_future_guarantee_or_latency(self):
  m,s=fixture();out=audit.audit(m,s)
  self.assertTrue(out['metadata']['intrinsicMetadataRecordsComplete']);self.assertFalse(out['futureWorkloadCeilingEstablished']);self.assertFalse(out['latencyMeasured']);self.assertFalse(out['productionAcceptance'])
  self.assertEqual(out['supplemental']['aggregateProcessCounterDeltas']['readBytes'],4096)
  self.assertEqual(out['supplemental']['lowestSampledAvailableBytes'],8_192_000_000)
 def test_no_samples_are_unknown_rather_than_zero_peak(self):
  out=audit.audit([],[]);self.assertIsNone(out['metadata']['observedPeaksBytes']);self.assertFalse(out['diagnosticWindowFinished']);self.assertTrue(out['metadataReader']['remoteStateUnknown'])
 def test_reader_still_alive_and_generation_change_block_complete_counter_claim(self):
  m,s=fixture();m[-1].update(readerGone=False,exitCode=None)
  second=copy.deepcopy(s[0]);second.update(startedAt='2026-10-12T07:15:03+00:00',qdrantPid=124);s.insert(1,second)
  out=audit.audit(m,s);self.assertFalse(out['diagnosticWindowFinished']);self.assertIsNone(out['supplemental']['aggregateProcessCounterDeltas']);self.assertTrue(out['metadataReader']['remoteStateUnknown']);self.assertEqual(out['supplemental']['coverage']['maximumInterSampleSeconds'],3)
 def test_unknown_private_fields_and_counter_keys_do_not_escape_report(self):
  m,s=fixture();m[1]['privateQuery']='never-emit-this-title';s[0]['vmstat']['private-owner-key']=123;s[0]['vmstat']['pgscan_private-owner-key']=456
  out=json.dumps(audit.audit(m,s));self.assertNotIn('never-emit',out);self.assertNotIn('private-owner',out)
 def test_incomplete_existing_growth_is_kept_as_qualified_observation(self):
  m,s=fixture();m[1]['existingSegmentGrowth']['deltaIsComplete']=False
  out=audit.audit(m,s);self.assertTrue(out['metadata']['peakMeasurementsIncomplete']);self.assertFalse(out['metadata']['intrinsicMetadataRecordsComplete']);self.assertIsNone(out['metadata']['observedPeaksBytes']['existingSegmentApparentGrowthBytes']);self.assertEqual(out['metadata']['incomparableExistingRawDeltaRanges']['apparentByteDelta']['maximum'],23)

if __name__=='__main__':unittest.main()
