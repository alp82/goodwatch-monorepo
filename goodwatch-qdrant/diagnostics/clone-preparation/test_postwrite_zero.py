"""V5 caller regression: V4 red reproduced separately before this successor, fake inspection/write interfaces, real owned FDs."""
import copy,importlib.util,os,tempfile,types,unittest
from pathlib import Path
from unittest.mock import Mock,patch
SOURCE=Path(__file__).parent/'prepare_clone_reclaim.py'
spec=importlib.util.spec_from_file_location('successor_v5_reclaim',SOURCE);p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
class PostwritePattern(unittest.TestCase):
 def test_one_under_reclaimed_write_then_transient_dirty_must_reach_fresh_strict_fit(self):
  with tempfile.TemporaryDirectory() as name:
   root=Path(name);cg=root/'cg';cg.mkdir();(cg/'cgroup.procs').write_text('123');(cg/'memory.reclaim').write_bytes(b'')
   source=types.SimpleNamespace(cgroup=cg,cgroup_relative='/fixture',pid=123)
   account={'currentBytes':2*1024**3,'cgroupMaxBytes':6*1024**3}
   state={'qdrantPid':123,'sourceStartTicks':456,'sourceProcessFence':'a'*64,'ancestorLimitFence':'b'*64,'memoryEvents':{'max':0,'oom':0,'oom_kill':0},'cpu':{'nr_throttled':0,'throttled_usec':0},'qdrantCounters':{'writeBytes':321},'accounting':account,'memory':{'file_dirty':0,'file_writeback':0}}
   measured={'selectionHash':'c'*64,'pageBytes':4096,'classesMeasured':{k:{'files':1,'dataPages':1,'residentDataPages':0} for k in ('vector','graph','sparse','other')}}
   runtime=types.SimpleNamespace(inspect_source=Mock(return_value=source),measure_source=Mock(return_value=measured),validate_source_locally=Mock())
   c=types.SimpleNamespace(runtime=runtime,daemon=types.SimpleNamespace(public_measure=lambda x:x),ROOT=root,frozen_helper=Mock(),inspect_stopped_or_running=Mock(return_value={'State':{'Pid':123}}),owned_total_budget=Mock(return_value=1),self_cgroup=Mock(return_value='/outside'),host_available=Mock())
   calls=[]
   def snapshot(*args,require_clean=True):
    calls.append(1);value=copy.deepcopy(state)
    if len(calls)==3:value['memory']['file_dirty']=4096
    if require_clean:p.require_zero(value)
    return value
   closed=[]
   def owned_writer(fd,*args):
    os.close(fd);closed.append(fd);return {'writerGone':True,'timedOut':False,'outcome':'under-reclaimed','errno':11,'writeAttempts':1}
   writer=Mock(side_effect=owned_writer)
   policy=types.SimpleNamespace(cap_reserve_bytes=256*1024**2,emergency_bytes=1,reserve_bytes=1)
   with patch.object(p,'require_held_control_lock') as held,patch.object(p,'snapshot',side_effect=snapshot),patch.object(p,'health',return_value={'green':True}),patch.object(p,'bounded_phase_write',writer):
    result=p.under_control_lock(c,{},None,policy,99,quiescence_seconds=60)
   self.assertEqual(result['stage'],'prepared-headroom-measured');self.assertTrue(result['postwriteQuiescence']['zeroDirtyAndWriteback']);self.assertEqual(writer.call_count,1);self.assertEqual((cg/'memory.reclaim').read_bytes(),b'');self.assertEqual(runtime.measure_source.call_count,2);self.assertEqual(len(calls),5 if result['stage']=='prepared-headroom-measured' else 4);self.assertEqual(runtime.validate_source_locally.call_count,2 if result['stage']=='prepared-headroom-measured' else 1)
   with self.assertRaises(OSError):os.fstat(closed[0])
   good=result['stage']=='prepared-headroom-measured'
   self.assertEqual(c.host_available.call_count,3 if good else 1);self.assertEqual(c.self_cgroup.call_count,5 if good else 3);self.assertEqual(c.frozen_helper.call_count,4 if good else 2);self.assertEqual(held.call_count,4 if good else 2)
 def test_zero_observation_then_final_dirty_fails_without_another_wait_or_write(self):
  with tempfile.TemporaryDirectory() as name:
   root=Path(name);cg=root/'cg';cg.mkdir();(cg/'cgroup.procs').write_text('123');(cg/'memory.reclaim').write_bytes(b'')
   source=types.SimpleNamespace(cgroup=cg,cgroup_relative='/fixture',pid=123)
   account={'currentBytes':2*1024**3,'cgroupMaxBytes':6*1024**3}
   state={'qdrantPid':123,'sourceStartTicks':456,'sourceProcessFence':'a'*64,'ancestorLimitFence':'b'*64,'memoryEvents':{'max':0,'oom':0,'oom_kill':0},'cpu':{'nr_throttled':0,'throttled_usec':0},'qdrantCounters':{'writeBytes':321},'accounting':account,'memory':{'file_dirty':0,'file_writeback':0}}
   measured={'selectionHash':'c'*64,'pageBytes':4096,'classesMeasured':{k:{'files':1,'dataPages':1,'residentDataPages':0} for k in ('vector','graph','sparse','other')}}
   runtime=types.SimpleNamespace(inspect_source=Mock(return_value=source),measure_source=Mock(return_value=measured),validate_source_locally=Mock())
   c=types.SimpleNamespace(runtime=runtime,daemon=types.SimpleNamespace(public_measure=lambda x:x),ROOT=root,frozen_helper=Mock(),inspect_stopped_or_running=Mock(return_value={'State':{'Pid':123}}),owned_total_budget=Mock(return_value=1),self_cgroup=Mock(return_value='/outside'),host_available=Mock())
   calls=[]
   def snapshot(*args,require_clean=True):
    calls.append(1);value=copy.deepcopy(state)
    if len(calls)==4:value['memory']['file_dirty']=4096
    if require_clean:p.require_zero(value)
    return value
   closed=[]
   def owned_writer(fd,*args):
    os.close(fd);closed.append(fd);return {'writerGone':True,'timedOut':False,'outcome':'under-reclaimed','errno':11,'writeAttempts':1}
   writer=Mock(side_effect=owned_writer)
   policy=types.SimpleNamespace(cap_reserve_bytes=256*1024**2,emergency_bytes=1,reserve_bytes=1)
   with patch.object(p,'require_held_control_lock') as held,patch.object(p,'snapshot',side_effect=snapshot),patch.object(p,'health',return_value={'green':True}),patch.object(p,'bounded_phase_write',writer):
    with self.assertRaisesRegex(RuntimeError,'dirty_source_pages') as failure:
     p.under_control_lock(c,{},None,policy,99,quiescence_seconds=60)
    result=failure.exception.reclaimEvidence
   self.assertEqual(result['stage'],'failed');self.assertEqual(result['final']['memory']['file_dirty'],4096);self.assertEqual(result['final']['accounting']['currentBytes'],2*1024**3);self.assertTrue(result['postwriteQuiescence']['zeroDirtyAndWriteback']);self.assertEqual(writer.call_count,1);self.assertEqual((cg/'memory.reclaim').read_bytes(),b'');self.assertEqual(runtime.measure_source.call_count,2);self.assertEqual(len(calls),5 if result['stage']=='prepared-headroom-measured' else 4);self.assertEqual(runtime.validate_source_locally.call_count,2 if result['stage']=='prepared-headroom-measured' else 1)
   with self.assertRaises(OSError):os.fstat(closed[0])
   good=result['stage']=='prepared-headroom-measured'
   self.assertEqual(c.host_available.call_count,3 if good else 1);self.assertEqual(c.self_cgroup.call_count,5 if good else 3);self.assertEqual(c.frozen_helper.call_count,4 if good else 2);self.assertEqual(held.call_count,4 if good else 2)

class ObserverBoundaries(unittest.TestCase):
 def state(self,dirty=0):
  return {'qdrantPid':1,'sourceStartTicks':2,'sourceProcessFence':'a','ancestorLimitFence':'b','memoryEvents':{'max':0,'oom':0},'cpu':{'nr_throttled':0},'memory':{'file_dirty':dirty,'file_writeback':0},'accounting':{'currentBytes':123},'qdrantCounters':{'writeBytes':456}}
 def test_full_numeric_dirty_then_zero_is_retained(self):
  now=[0];states=iter([self.state(4096),self.state()]);out={}
  def sleep(n):now[0]+=n
  p.postwrite_zero_observer(lambda:next(states),self.state(),out,0,clock=lambda:now[0],sleep=sleep)
  self.assertEqual(out['samples'],2);self.assertEqual(out['dirtySamples'],1);self.assertEqual(out['initial']['qdrantCounters']['writeBytes'],456);self.assertEqual(out['terminal']['accounting']['currentBytes'],123)
 def test_sample_completing_after_acceptance_deadline_cannot_pass(self):
  now=[0];out={}
  def sample():now[0]=60.01;return self.state()
  with self.assertRaisesRegex(RuntimeError,'postwrite_zero_timeout'):p.postwrite_zero_observer(sample,self.state(),out,0,clock=lambda:now[0])
  self.assertFalse(out['zeroDirtyAndWriteback']);self.assertEqual(out['terminal']['accounting']['currentBytes'],123)
 def test_fence_failure_wins_over_dirty_classification(self):
  bad=self.state(4096);bad['memoryEvents']['max']=1;out={}
  with self.assertRaisesRegex(RuntimeError,'reclaim_resource_event'):p.postwrite_zero_observer(lambda:bad,self.state(),out,0,clock=lambda:0)
  self.assertEqual(out['dirtySamples'],0);self.assertEqual(out['terminal']['memoryEvents']['max'],1)
 def test_completed_snapshot_is_retained_when_each_post_snapshot_guard_fails(self):
  for reason in ('host_emergency_floor','parent_placement_changed','invalid_reclaim_lock','source_freeze_changed','reclaim_fd_changed'):
   out={}
   def guard(state):raise RuntimeError(reason)
   with self.assertRaisesRegex(RuntimeError,reason):p.postwrite_zero_observer(lambda:self.state(4096),self.state(),out,0,clock=lambda:0,guard=guard)
   self.assertEqual(out['samples'],1);self.assertEqual(out['terminal']['qdrantCounters']['writeBytes'],456);self.assertEqual(out['dirtySamples'],0)
 def test_sample_limit_is_distinct_from_timeout(self):
  out={};sample=Mock(return_value=self.state(4096))
  with self.assertRaisesRegex(RuntimeError,'postwrite_sample_bound_exceeded'):p.postwrite_zero_observer(sample,self.state(),out,0,clock=lambda:0,sleep=lambda n:None)
  self.assertEqual(sample.call_count,256)
 def test_sleep_is_clipped_and_never_catches_up(self):
  now=[59.9];slept=[];out={}
  def sleep(n):slept.append(n);now[0]+=n
  with self.assertRaisesRegex(RuntimeError,'postwrite_zero_timeout'):p.postwrite_zero_observer(lambda:self.state(4096),self.state(),out,0,clock=lambda:now[0],sleep=sleep)
  self.assertEqual(len(slept),1);self.assertAlmostEqual(slept[0],.1)

class PriorV4Receipts(unittest.TestCase):
 def test_explicit_v4_eighteen_census_uses_stable_hash_without_mutating_prior_helper(self):
  import hashlib
  with tempfile.TemporaryDirectory() as name:
   folder=Path(name);folder.chmod(0o700);helper=folder/'prepare_clone_reclaim.py';helper.write_bytes(b'frozen prior V4');helper.chmod(0o600)
   raw=helper.read_bytes();sha=hashlib.sha256(raw).hexdigest()
   with patch.object(p,'census_recorded_writers',return_value={'recordedWritersGone':True}) as census:
    p.inspect_prior_receipts(folder,sha,{os.getpid()},max_records=18)
   census.assert_called_once_with(folder,sha,{os.getpid()},cleanup=False,max_records=18)
   self.assertEqual(helper.read_bytes(),raw)

if __name__=='__main__':unittest.main()
