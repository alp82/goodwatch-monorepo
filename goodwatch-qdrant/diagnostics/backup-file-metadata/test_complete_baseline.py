import os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import complete_baseline as baseline

class BaselineTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  for name in ('media_fingerprint_v1','search_reference_profiles'):
   p=self.root/'collections'/name/'0'/'segments'/'segment-one';p.mkdir(parents=True);(p/'data').write_bytes(b'abc')
 def tearDown(self):self.temp.cleanup()
 def test_complete_direct_shard_and_optional_replica_layout(self):
  p=self.root/'collections/media_fingerprint_v1/1/0/segments/segment-two';p.mkdir(parents=True);(p/'index').write_bytes(b'xy')
  data,out=baseline.scan(self.root);self.assertTrue(out['complete']);self.assertEqual(out['segmentDirectories'],3);self.assertEqual(out['apparentBytes'],8);self.assertEqual(len(data['files']),3)
 def test_complete_scan_can_exceed_old_one_second_budget(self):
  tick=[0]
  def clock():tick[0]+=.2;return tick[0]
  data,out=baseline.scan(self.root,clock=clock);self.assertGreater(out['durationSeconds'],1);self.assertTrue(out['complete']);self.assertEqual(len(data['files']),2)
 def test_empty_cohort_and_truncated_scan_fail_instead_of_complete(self):
  with self.assertRaisesRegex(baseline.Incomplete,'scan_entry_bound'):baseline.scan(self.root,max_entries=1)
  with tempfile.TemporaryDirectory()as t:
   for n in ('media_fingerprint_v1','search_reference_profiles'):(Path(t)/'collections'/n).mkdir(parents=True)
   with self.assertRaisesRegex(baseline.Incomplete,'empty_collection_cohort'):baseline.scan(Path(t))
 def test_one_empty_collection_cannot_hide_behind_other_collection_files(self):
  import shutil
  before=len(os.listdir('/proc/self/fd'))
  shutil.rmtree(self.root/'collections/search_reference_profiles/0/segments/segment-one')
  with self.assertRaisesRegex(baseline.Incomplete,'empty_collection_cohort'):baseline.scan(self.root)
  self.assertEqual(len(os.listdir('/proc/self/fd')),before)
 def test_symlink_alias_is_not_followed_and_fds_return_to_baseline(self):
  before=len(os.listdir('/proc/self/fd'));p=self.root/'collections/media_fingerprint_v1/0/segments/segment-one'
  (p/'outside').symlink_to('/etc')
  with self.assertRaisesRegex(baseline.Incomplete,'alias_excluded'):baseline.scan(self.root)
  self.assertEqual(len(os.listdir('/proc/self/fd')),before)
 def test_positive_file_growth_not_canceled_by_other_file_shrink(self):
  a={'files':{'grow':[1,1,10,4096,0,0],'shrink':[1,2,100,8192,0,0]}}
  b={'files':{'grow':[1,1,20,8192,0,0],'shrink':[1,2,1,4096,0,0]}}
  out=baseline.growth(a,b);self.assertEqual(out['positiveApparentGrowthBytes'],10);self.assertEqual(out['positiveAllocatedStatGrowthBytes'],4096)
 def test_replaced_path_is_new_identity_not_size_delta(self):
  a={'files':{'same-name':[1,1,100,8192,0,0]}};b={'files':{'same-name':[1,2,5,4096,0,0]}}
  out=baseline.growth(a,b);self.assertEqual(out['positiveApparentGrowthBytes'],5);self.assertEqual(out['newFileIdentities'],1);self.assertEqual(out['retiredFileIdentities'],1)
 def test_changed_directory_fence_blocks_complete(self):
  real=baseline.open_relative;calls=[0]
  def opened(rootfd,parts):
   fd=real(rootfd,parts)
   if parts[-1]=='segment-one':
    calls[0]+=1
    if calls[0]==3:(self.root/'collections/media_fingerprint_v1/0/segments/segment-one/new').write_bytes(b'x')
   return fd
  with patch.object(baseline,'open_relative',opened):
   with self.assertRaisesRegex(baseline.Incomplete,'directory_changed'):baseline.scan(self.root)
 def test_source_turnover_after_scan_blocks_receipt(self):
  class Helper:
   def source(self,c):return {'store':selfroot,'identity':(1,2,3),'pid':2,'ticks':3}
   def backup_paths(self):return set()
   def backup_running(self,p):return {'running':False,'complete':True}
   def pressure(self,s):return {'host':{'MemAvailable':123}}
   def stamp(self):return '2026-10-12T07:40:00+00:00'
   def sample_source_fence(self,c,s):raise RuntimeError('source_changed')
  selfroot=self.root
  with self.assertRaisesRegex(RuntimeError,'source_changed'):baseline.capture({},Helper())
if __name__=='__main__':unittest.main()
