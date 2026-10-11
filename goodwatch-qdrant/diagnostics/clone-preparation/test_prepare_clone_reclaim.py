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
  path,fd=self.target();result=p.bounded_write(fd,1)
  self.assertEqual(path.read_text(),str(3*1024**3));self.assertEqual(result['writeAttempts'],1)
  self.assertTrue(result['writerGone']);self.assertEqual(result['writerExitCode'],0)
  with self.assertRaises(OSError):os.fstat(fd)
 def test_eagain_is_under_reclaim_not_an_implicit_retry(self):
  path,fd=self.target();original=os.write
  def write(which,data):
   if which==fd:raise BlockingIOError(11,'private path')
   return original(which,data)
  with patch.object(p.os,'write',side_effect=write):result=p.bounded_write(fd,1)
  self.assertEqual(result['outcome'],'under-reclaimed');self.assertTrue(result['writerGone'])
  self.assertEqual(path.read_bytes(),b'');self.assertEqual(result['writeAttempts'],1)
 def test_child_source_guard_blocks_actual_write_and_retains_fixed_cause(self):
  path,fd=self.target()
  def changed():raise RuntimeError('source_changed')
  result=p.bounded_write(fd,1,prewrite=changed)
  self.assertEqual(result['outcome'],'guard-failed');self.assertEqual(result['reason'],'source_changed')
  self.assertTrue(result['writerGone']);self.assertEqual(path.read_bytes(),b'')
 def test_actual_writer_deadline_reaps_only_own_child(self):
  path,fd=self.target()
  with patch.object(p,'writer',side_effect=lambda *_:time.sleep(20)):
   start=time.monotonic();result=p.bounded_write(fd,.1)
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

if __name__=='__main__':unittest.main()
