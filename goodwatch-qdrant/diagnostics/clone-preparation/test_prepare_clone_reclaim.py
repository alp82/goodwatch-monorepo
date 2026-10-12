import contextlib,io,json,os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import prepare_clone_reclaim as p

class ReclaimTests(unittest.TestCase):
 def test_default_never_imports_or_opens_runtime(self):
  with patch.object(p.os,'open') as opening,contextlib.redirect_stdout(io.StringIO()) as out:
   self.assertEqual(p.main([]),0)
  opening.assert_not_called();self.assertFalse(json.loads(out.getvalue())['execution'])
 def target(self):
  temp=tempfile.TemporaryDirectory();self.addCleanup(temp.cleanup);path=Path(temp.name)/'target';path.write_bytes(b'');return path,os.open(path,os.O_WRONLY)
 def test_real_owned_writer_writes_bare_bytes_once_and_exits(self):
  path,fd=self.target();result=p.bounded_write(fd,1,receipt_directory=path.parent)
  self.assertEqual(path.read_text(),str(3*1024**3));self.assertEqual(result['writeAttempts'],1)
  self.assertTrue(result['writerGone']);self.assertEqual(result['writerExitCode'],0)
  with self.assertRaises(OSError):os.fstat(fd)
 def test_eagain_is_under_reclaim_not_an_implicit_retry(self):
  path,fd=self.target();original=os.write
  def write(which,data):
   if which==fd:raise BlockingIOError(11,'private path')
   return original(which,data)
  with patch.object(p.os,'write',side_effect=write):result=p.bounded_write(fd,1,receipt_directory=path.parent)
  self.assertEqual(result['outcome'],'under-reclaimed');self.assertTrue(result['writerGone'])
  self.assertEqual(path.read_bytes(),b'');self.assertEqual(result['writeAttempts'],1)
 def test_child_source_guard_blocks_actual_write_and_retains_fixed_cause(self):
  path,fd=self.target()
  def changed():raise RuntimeError('source_changed')
  result=p.bounded_write(fd,1,prewrite=changed,receipt_directory=path.parent)
  self.assertEqual(result['outcome'],'guard-failed');self.assertEqual(result['reason'],'source_changed')
  self.assertTrue(result['writerGone']);self.assertEqual(path.read_bytes(),b'')
 def test_prewrite_eagain_is_guard_failure_with_no_kernel_write_attempt(self):
  path,fd=self.target()
  def unavailable():raise BlockingIOError(11,'private prewrite failure')
  result=p.bounded_write(fd,1,prewrite=unavailable,receipt_directory=path.parent)
  self.assertEqual(result['outcome'],'guard-failed');self.assertEqual(result['writeAttempts'],0);self.assertEqual(path.read_bytes(),b'')
 def test_actual_writer_deadline_reaps_only_own_child(self):
  path,fd=self.target()
  with patch.object(p,'writer',side_effect=lambda *_:time.sleep(20)):
   start=time.monotonic();result=p.bounded_write(fd,.1,receipt_directory=path.parent)
  self.assertLess(time.monotonic()-start,2);self.assertTrue(result['timedOut']);self.assertTrue(result['writerGone']);self.assertEqual(result['writerExitCode'],-15)
  self.assertEqual(path.read_bytes(),b'')
 def test_process_limits_ancestor_limits_and_cap_events_each_block(self):
  before={'qdrantPid':1,'sourceStartTicks':2,'sourceProcessFence':'a','ancestorLimitFence':'b','memoryEvents':{'max':0,'oom':0,'oom_kill':0},'cpu':{'nr_throttled':0,'throttled_usec':0}}
  p.fence(before,before)
  for change,expected in (({'sourceStartTicks':3},'source_changed'),({'sourceProcessFence':'c'},'source_limits_changed'),({'ancestorLimitFence':'c'},'ancestor_limits_changed'),({'memoryEvents':{'max':1,'oom':0,'oom_kill':0}},'reclaim_resource_event')):
   after={**before,**change}
   with self.assertRaisesRegex(RuntimeError,expected):p.fence(before,after)
 def test_reclaimed_current_does_not_override_missing_page_fit(self):
  measured={'pageBytes':4096,'classesMeasured':{kind:{'files':1,'dataPages':105299,'residentDataPages':0} for kind in('vector','graph','sparse','other')}}
  with self.assertRaisesRegex(RuntimeError,'post_cap_fit_inconclusive'):p.cap_fit(measured,{'currentBytes':6346526720,'cgroupMaxBytes':6442450944},268435456)
  good=p.cap_fit(measured,{'currentBytes':3*1024**3,'cgroupMaxBytes':6442450944},268435456)
  self.assertEqual(good['missingSelectedBytes'],1725218816)
  measured['classesMeasured']['graph']['residentDataPages']=105300
  with self.assertRaisesRegex(RuntimeError,'post_cap_fit_inconclusive'):p.cap_fit(measured,{'currentBytes':0,'cgroupMaxBytes':6442450944},268435456)
 def test_unknown_errors_never_emit_private_text(self):
  self.assertEqual(p.reason(OSError('private source file')),'guard_or_runtime_failure')


class HeldLockPreparationTests(unittest.TestCase):
 def test_real_control_fd_must_already_hold_flock(self):
  from types import SimpleNamespace
  import fcntl
  with tempfile.TemporaryDirectory()as td:
   root=Path(td);path=root/'control.lock';path.touch(mode=0o600);fd=os.open(path,os.O_RDWR)
   try:
    with self.assertRaisesRegex(RuntimeError,'invalid_reclaim_lock'):p.require_held_control_lock(SimpleNamespace(ROOT=root),fd)
    fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);p.require_held_control_lock(SimpleNamespace(ROOT=root),fd)
   finally:os.close(fd)
 def test_dirty_quiescence_bounded_without_relaxation_or_write(self):
  clock=[0];sleep=lambda n:clock.__setitem__(0,clock[0]+n)
  def dirty(*_):
   e=RuntimeError('dirty_source_pages');e.dirtyEvidence={'fileDirtyBytes':4096,'fileWritebackBytes':8192};raise e
  with patch.object(p,'snapshot',side_effect=dirty),patch.object(p.os,'write',side_effect=AssertionError('reclaim before clean')):
   with self.assertRaises(RuntimeError)as context:p.quiescent_snapshot(None,None,60,clock=lambda:clock[0],sleep=sleep)
  self.assertEqual(clock[0],60);self.assertEqual(context.exception.quiescenceEvidence['fileWritebackBytes'],8192);self.assertFalse(context.exception.quiescenceEvidence['zeroDirtyAndWriteback'])
 def test_fresh_clean_snapshot_after_dirty_keeps_exact_zero_guard(self):
  e=RuntimeError('dirty_source_pages');e.dirtyEvidence={'fileDirtyBytes':4096,'fileWritebackBytes':0};clock=[0];sleep=lambda n:clock.__setitem__(0,clock[0]+n)
  with patch.object(p,'snapshot',side_effect=[e,{'fresh':True}]):
   snapshot,evidence=p.quiescent_snapshot(None,None,60,clock=lambda:clock[0],sleep=sleep)
  self.assertEqual(snapshot,{'fresh':True});self.assertTrue(evidence['zeroDirtyAndWriteback']);self.assertEqual(evidence['samples'],2);self.assertEqual(clock[0],.25)

 def test_late_clean_snapshot_and_source_failure_never_pass_extended_wait(self):
  clock=[0]
  def late(*_):clock[0]=60.001;return {'clean':True}
  with patch.object(p,'snapshot',side_effect=late):
   with self.assertRaisesRegex(RuntimeError,'quiescence_bound_exceeded'):p.quiescent_snapshot(None,None,60,clock=lambda:clock[0],sleep=lambda _:None)
  with patch.object(p,'snapshot',side_effect=RuntimeError('source_changed')),patch.object(p.time,'sleep')as sleep:
   with self.assertRaisesRegex(RuntimeError,'source_changed'):p.quiescent_snapshot(None,None,60)
   sleep.assert_not_called()
 def test_clean_near_boundary_and_old_five_second_policy_refused(self):
  clock=[0];calls=[0]
  def state(*_):
   calls[0]+=1
   if calls[0]==1:clock[0]=59.75;raise RuntimeError('dirty_source_pages')
   return {'clean':True}
  with patch.object(p,'snapshot',side_effect=state):
   _,e=p.quiescent_snapshot(None,None,60,clock=lambda:clock[0],sleep=lambda n:clock.__setitem__(0,clock[0]+n))
  self.assertEqual(e['seconds'],60);self.assertTrue(e['zeroDirtyAndWriteback'])
  with self.assertRaisesRegex(RuntimeError,'prepared_input_changed'):p.quiescent_snapshot(None,None,5)

if __name__=='__main__':unittest.main()
