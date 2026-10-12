import hashlib,json,os,select,signal,subprocess,sys,tempfile,time,unittest
from pathlib import Path
import prepare_clone_reclaim as guard
class WriterOwnership(unittest.TestCase):
 def test_registration_receipt_exists_before_actual_operation(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);target=root/'target';fd=os.open(target,os.O_CREAT|os.O_RDWR,0o600)
   def operation(fd):
    records=list(root.glob('reclaim-writer-*.json'))
    if len(records)!=1 or json.loads(records[0].read_text())['writer']['pid']!=os.getpid():os._exit(127)
    os.write(fd,b'1')
   try:result=guard.bounded_owned_writer(fd,operation,root,'a'*64,timeout=1)
   finally:os.close(fd)
   self.assertTrue(result['registeredBeforeWrite']);self.assertTrue(result['writerGone']);self.assertEqual(result['writerExitCode'],0);self.assertEqual(target.read_bytes(),b'1')
 def test_parent_interrupt_uses_pidfd_and_reaps_its_writer(self):
  with tempfile.TemporaryDirectory() as directory:
   fd=os.open(Path(directory)/'target',os.O_CREAT|os.O_RDWR,0o600)
   previous=signal.signal(signal.SIGALRM,lambda _s,_f:(_ for _ in ()).throw(RuntimeError('writer_interrupted')))
   signal.setitimer(signal.ITIMER_REAL,.1)
   try:
    with self.assertRaises(RuntimeError) as caught:guard.bounded_owned_writer(fd,lambda _fd:time.sleep(30),Path(directory),'a'*64,timeout=2,grace=.1)
    self.assertTrue(caught.exception.writerEvidence['writerGone']);self.assertEqual(caught.exception.writerEvidence['writerExitCode'],-signal.SIGTERM)
   finally:signal.setitimer(signal.ITIMER_REAL,0);signal.signal(signal.SIGALRM,previous);os.close(fd)
 def test_ignored_term_is_followed_by_owned_kill_and_actual_reap(self):
  with tempfile.TemporaryDirectory() as directory:
   fd=os.open(Path(directory)/'target',os.O_CREAT|os.O_RDWR,0o600)
   def operation(_fd):signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)
   try:result=guard.bounded_owned_writer(fd,operation,Path(directory),'a'*64,timeout=.05,grace=.05)
   finally:os.close(fd)
   self.assertTrue(result['writerGone']);self.assertEqual(result['writerExitCode'],-signal.SIGKILL)
 def test_actual_parent_death_kills_child_before_delayed_write(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);script="""import os,time
from pathlib import Path
import prepare_clone_reclaim as g
root=Path(os.environ['FIXTURE_ROOT']);fd=os.open(root/'target',os.O_CREAT|os.O_RDWR,0o600)
def operation(fd):time.sleep(30);os.write(fd,b'forbidden')
g.bounded_owned_writer(fd,operation,root,'a'*64,timeout=40)
"""
   process=subprocess.Popen([sys.executable,'-B','-c',script],cwd=Path(__file__).parent,env={**os.environ,'FIXTURE_ROOT':str(root)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
   pidfd=None
   try:
    deadline=time.monotonic()+2
    while time.monotonic()<deadline and not list(root.glob('reclaim-writer-*.json')):time.sleep(.01)
    record=json.loads(next(root.glob('reclaim-writer-*.json')).read_text());pidfd=os.pidfd_open(record['writer']['pid'])
    process.kill();process.wait(timeout=2)
    self.assertTrue(select.select([pidfd],[],[],2)[0]);self.assertEqual((root/'target').read_bytes(),b'')
    adopted=guard.cleanup_recorded_writer(next(root.glob('reclaim-writer-*.json')),'a'*64,protected_pids=(os.getpid(),))
    self.assertTrue(adopted['writerGone']);self.assertFalse(adopted['cleanupUnknown'])
   finally:
    if process.poll() is None:process.kill();process.wait()
    if pidfd is not None:os.close(pidfd)
 def test_unacknowledged_child_cannot_write_when_registration_fails(self):
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);fd=os.open(root/'target',os.O_CREAT|os.O_RDWR,0o600)
   try:
    with patch.object(guard,'receipt',side_effect=RuntimeError('writer_registration_failed')):
     with self.assertRaises(RuntimeError) as caught:guard.bounded_owned_writer(fd,lambda fd:os.write(fd,b'forbidden'),root,'a'*64,timeout=.1,grace=.1)
    self.assertTrue(caught.exception.writerEvidence['writerGone']);self.assertEqual((root/'target').read_bytes(),b'')
   finally:os.close(fd)
 def test_receipt_cannot_adopt_the_actual_outer_or_protected_source(self):
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);fd=os.open(root/'target',os.O_CREAT|os.O_RDWR,0o600)
   try:
    birth=guard.identity(os.getpid());guard.receipt(root,birth,birth,'a'*64,fd)
    with patch.object(guard.signal,'pidfd_send_signal') as sending:
     with self.assertRaisesRegex(RuntimeError,'writer_birth_changed'):guard.cleanup_recorded_writer(next(root.glob('reclaim-writer-*.json')),'a'*64,protected_pids=(os.getpid(),))
    sending.assert_not_called()
   finally:os.close(fd)
 def test_unproven_writer_retains_its_actual_pidfd_until_owned_cleanup(self):
  from unittest.mock import patch
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);target=os.open(root/'target',os.O_CREAT|os.O_RDWR,0o600);result=None
   try:
    with patch.object(guard.os,'waitpid',return_value=(0,0)),patch.object(guard.signal,'pidfd_send_signal'):
     result=guard.bounded_owned_writer(target,lambda _fd:time.sleep(30),root,'a'*64,timeout=.02,grace=.02)
    self.assertFalse(result['writerGone']);self.assertFalse(result['writerExitObserved']);self.assertTrue(result['cleanupUnknown']);self.assertTrue(result['pidfdRetained'])
    held=guard.RETAINED_WRITERS[result['writer']['pid']];os.fstat(held['pidfd'])
   finally:
    if result and result['pidfdRetained']:
     held=guard.RETAINED_WRITERS.pop(result['writer']['pid']);signal.pidfd_send_signal(held['pidfd'],signal.SIGKILL,None,0);os.waitpid(result['writer']['pid'],0);os.close(held['pidfd'])
    os.close(target)
if __name__=='__main__':unittest.main()
