import ctypes,errno,json,os,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import prepare_clone_reclaim as p
class ZeroWait(unittest.TestCase):
 def state(self,d=0):return {'memory':{'file_dirty':d,'file_writeback':0}}
 def test_dirty_clean_and_exact60(self):
  now=[0];calls=[0]
  def check():calls[0]+=1;return self.state(4096 if calls[0]<3 else 0)
  e,_=p.child_zero_wait(check,0,clock=lambda:now[0],sleep=lambda n:now.__setitem__(0,now[0]+n));self.assertEqual((e['samples'],e['seconds']),(3,.5))
  e,_=p.child_zero_wait(lambda:self.state(),0,clock=lambda:60);self.assertEqual(e['seconds'],60)
 def test_late_clean_dirty_deadline_and_unreadable_fail_closed(self):
  for limit in (60.001,65,135,145):
   with self.assertRaisesRegex(RuntimeError,'writer_prewrite_timeout'):p.child_zero_wait(lambda:self.state(),0,clock=lambda:limit)
  now=[0]
  def late():now[0]=60.001;return self.state()
  with self.assertRaisesRegex(RuntimeError,'writer_prewrite_timeout'):p.child_zero_wait(late,0,clock=lambda:now[0])
  now=[0]
  with self.assertRaisesRegex(RuntimeError,'writer_prewrite_timeout'):p.child_zero_wait(lambda:self.state(8192),0,clock=lambda:now[0],sleep=lambda n:now.__setitem__(0,now[0]+n))
  self.assertEqual(now[0],60)
  for error in (TimeoutError('private'),OSError('private'),RuntimeError('reclaim_fd_changed'),RuntimeError('parent_placement_changed')):
   with patch.object(p.time,'sleep') as sleep:
    with self.assertRaises(type(error)):p.child_zero_wait(lambda:(_ for _ in ()).throw(error),time.monotonic())
    sleep.assert_not_called()
 def test_dirty_never_hides_fence_failure(self):
  before={'qdrantPid':1,'sourceStartTicks':2,'sourceProcessFence':'a','ancestorLimitFence':'b','memoryEvents':{'max':0,'oom':0,'oom_kill':0},'cpu':{'nr_throttled':0,'throttled_usec':0}}
  for change,reason in (({'memoryEvents':{'max':1,'oom':0,'oom_kill':0}},'reclaim_resource_event'),({'sourceStartTicks':3},'source_changed'),({'sourceProcessFence':'x'},'source_limits_changed'),({'ancestorLimitFence':'x'},'ancestor_limits_changed')):
   def check():s={**before,**change,**self.state(8192)};p.fence(before,s);return s
   with patch.object(p.time,'sleep') as sleep:
    with self.assertRaisesRegex(RuntimeError,reason):p.child_zero_wait(check,time.monotonic())
    sleep.assert_not_called()
 def test_zero_sample_cannot_hide_counter_drift(self):
  before={'qdrantPid':1,'sourceStartTicks':2,'sourceProcessFence':'a','ancestorLimitFence':'b','memoryEvents':{'max':0,'oom':0,'oom_kill':0},'cpu':{'nr_throttled':0,'throttled_usec':0}}
  def check():state={**before,**self.state(),'cpu':{'nr_throttled':1,'throttled_usec':1}};p.fence(before,state);return state
  with self.assertRaisesRegex(RuntimeError,'reclaim_resource_event'):p.child_zero_wait(check,time.monotonic())
class Protocol(unittest.TestCase):
 def test_partial_order_and_deadline(self):
  for frames in ([('zero-wait',10),('write-start',70)],[('write-start',11)],[('zero-wait',10),('zero-wait',11)],[('zero-wait',10),('write-start',75.001)]):
   r,w=os.pipe();x=p.WriterProtocol(r,w,clock=lambda:100);sender=os.dup(w);x.ack(10,0)
   try:
    for phase,stamp in frames:p.phase_frame(sender,phase,stamp)
    os.close(sender);sender=None
    if len(frames)==2 and frames[-1]==('write-start',70):
     x.drain();self.assertEqual(x.deadline(),130);self.assertTrue(x.evidence(True)['drainedToEof']);self.assertTrue(x.evidence(True)['writeStartObserved']);x.write_at=100;self.assertEqual(x.deadline(),135);self.assertEqual(x.evidence(True)['lifecycleSeconds'],145)
    else:
     with self.assertRaisesRegex(RuntimeError,'writer_protocol_failed'):x.drain()
   finally:
    if sender is not None:os.close(sender)
    os.close(r)
  r,w=os.pipe();x=p.WriterProtocol(r,w,clock=lambda:100);sender=os.dup(w);x.ack(10,0)
  try:
   os.write(sender,b'{');os.close(sender)
   with self.assertRaisesRegex(RuntimeError,'writer_protocol_failed'):x.drain()
   self.assertFalse(x.evidence(True)['valid'])
  finally:os.close(r)
 def test_timeout_start_race_is_not_zero_attempt_proof(self):
  r,w=os.pipe();x=p.WriterProtocol(r,w,clock=lambda:100);sender=os.dup(w);x.ack(10,0)
  try:
   p.phase_frame(sender,'zero-wait',10);p.phase_frame(sender,'write-start',70);x.drain();e=x.evidence(True);self.assertTrue(e['writeStartObserved']);self.assertFalse(e['drainedToEof']);os.close(sender);x.drain();self.assertTrue(x.evidence(True)['drainedToEof'])
  finally:os.close(r)
 def test_complete_malformed_and_unknown_frame_fail_with_fixed_cause(self):
  for raw in (b'{private}\n',b'{"phase":"unknown","monotonic":10}\n',b'{"phase":"zero-wait","monotonic":1e999}\n'):
   r,w=os.pipe();x=p.WriterProtocol(r,w,clock=lambda:100);sender=os.dup(w);x.ack(10,0)
   try:
    os.write(sender,raw);os.close(sender)
    with self.assertRaisesRegex(RuntimeError,'writer_protocol_failed'):x.drain()
    self.assertFalse(x.evidence(True)['valid'])
   finally:os.close(r)
class ActualWriter(unittest.TestCase):
 def target(self):
  t=tempfile.TemporaryDirectory();self.addCleanup(t.cleanup);d=Path(t.name);f=d/'target';return d,f,os.open(f,os.O_CREAT|os.O_WRONLY,0o600)
 def test_actual_wait_then_one_write_and_one_receipt(self):
  d,f,fd=self.target();n=[0]
  def check():n[0]+=1;return {'memory':{'file_dirty':4096 if n[0]==1 else 0,'file_writeback':0}}
  x=p.bounded_phase_write(fd,check,d);self.assertEqual(f.read_text(),str(p.REQUEST));self.assertEqual(x['writeAttempts'],1);self.assertEqual(x['prewriteQuiescence']['samples'],2);self.assertTrue(x['phaseProtocol']['writeStartObserved']);self.assertTrue(x['phaseProtocol']['drainedToEof']);self.assertTrue(x['writerGone']);self.assertEqual(len(list(d.glob('reclaim-writer-*.json'))),1)
 def test_actual_prewrite_failure_proves_zero_and_exit(self):
  d,f,fd=self.target();x=p.bounded_phase_write(fd,lambda:(_ for _ in ()).throw(RuntimeError('reclaim_resource_event')),d)
  self.assertEqual(x['reason'],'reclaim_resource_event');self.assertEqual(x['writeAttempts'],0);self.assertFalse(x['phaseProtocol']['writeStartObserved']);self.assertTrue(x['phaseProtocol']['drainedToEof']);self.assertTrue(x['writerExitObserved']);self.assertEqual(f.read_bytes(),b'')
 def test_nineteenth_no_ack_no_residue(self):
  d,f,fd=self.target();birth=p.identity(os.getpid())
  for i in range(18):p.receipt(d,{**birth,'pid':900000+i},birth,'a'*64,fd,max_records=18)
  names={x.name for x in d.iterdir()};r,w=os.pipe();protocol=p.WriterProtocol(r,w)
  try:
   with self.assertRaisesRegex(RuntimeError,'writer_registration_failed') as caught:p.bounded_owned_writer(fd,lambda target,ack:os.write(target,b'forbidden'),d,'a'*64,protocol=protocol,max_records=18)
   self.assertFalse(caught.exception.writerEvidence['registeredBeforeWrite']);self.assertTrue(caught.exception.writerEvidence['writerGone']);self.assertEqual({x.name for x in d.iterdir()},names);self.assertEqual(f.read_bytes(),b'');self.assertEqual(len(list(d.glob('reclaim-writer-*.json'))),18)
  finally:os.close(fd);os.close(r);os.close(w)
 def test_real_exclusive_directory_registration(self):
  import fcntl
  d,f,fd=self.target();folder=os.open(d,os.O_RDONLY|os.O_DIRECTORY);fcntl.flock(folder,fcntl.LOCK_EX)
  try:
   with self.assertRaises(BlockingIOError):p.receipt(d,p.identity(os.getpid()),p.identity(os.getpid()),'a'*64,fd,max_records=18)
   self.assertEqual(list(d.glob('reclaim-writer-*.json')),[])
  finally:os.close(folder);os.close(fd)
 def test_29th_sentinel_counts_only_receipts(self):
  d,f,fd=self.target();(d/'control.lock').touch();(d/'pin-instance.lock').touch()
  for i in range(29):record=d/f'reclaim-writer-{900000+i}-1.json';record.write_text('{}');record.chmod(0o600)
  x=p.census_recorded_writers(d,'a'*64,(os.getpid(),),max_records=18);self.assertEqual(x['receiptCount'],29);self.assertEqual(len(x['recordedWriterResults']),29);self.assertFalse(x['recordedWritersGone']);self.assertEqual(x['recordedWriterResults'][-1]['reason'],'writer_receipt_bound_exceeded');os.close(fd)
class PriorReceiptTests(unittest.TestCase):
 def test_actual_recorded_gone_birth_is_accepted_without_receipt_deletion(self):
  import hashlib
  with tempfile.TemporaryDirectory() as name:
   directory=Path(name);helper=directory/'prepare_clone_reclaim.py';helper.write_bytes(b'reviewed prior helper');helper.chmod(0o600);sha=hashlib.sha256(helper.read_bytes()).hexdigest();target=directory/'target';fd=os.open(target,os.O_CREAT|os.O_RDWR,0o600)
   try:result=p.bounded_owned_writer(fd,lambda target:os.write(target,b'1'),directory,sha,timeout=1)
   finally:os.close(fd)
   self.assertTrue(result['writerGone']);record=next(directory.glob('reclaim-writer-*.json'));original=record.read_bytes()
   proof=p.inspect_prior_receipts(directory,sha,(os.getpid(),os.getppid()));self.assertTrue(proof['recordedWritersGone']);self.assertEqual(proof['receiptCount'],1);self.assertEqual(record.read_bytes(),original)
   helper.write_bytes(b'drift')
   with self.assertRaisesRegex(RuntimeError,'writer_birth_changed'):p.inspect_prior_receipts(directory,sha,(os.getpid(),os.getppid()))
 def test_pidfd_is_opened_before_actual_birth_reread(self):
  calls=[];birth={'pid':900001,'startTicks':1,'cmdlineSha256':'a'*64,'exeSha256':'b'*64,'cgroupSha256':'c'*64};record={'writer':birth,'parent':{'pid':900002},'targetFd':3,'targetDevice':1,'targetInode':1}
  realread,realwrite=os.pipe()
  try:
   def openpid(*_):calls.append('pidfd');return realread
   def reread(*_):calls.append('birth');return {**birth,'startTicks':2}
   with patch.object(p,'read_record',return_value=record),patch.object(p.os,'pidfd_open',side_effect=openpid),patch.object(p,'identity',side_effect=reread),patch.object(p.signal,'pidfd_send_signal') as sending:
    result,_=p.open_recorded_writer(Path('/fixture'), 'a'*64,(os.getpid(),));self.assertIsNone(result);self.assertEqual(calls,['pidfd','birth']);sending.assert_not_called()
  finally:os.close(realwrite)

class SingleKernelWrite(unittest.TestCase):
 def test_eintr_is_one_libc_invocation_never_python_retry(self):
  calls=[]
  class Call:
   def __call__(self,*args):calls.append(args);ctypes.set_errno(errno.EINTR);return -1
  class Library:write=Call()
  with patch.object(p.ctypes,'CDLL',return_value=Library()):
   with self.assertRaises(OSError) as caught:p.kernel_write_once(123,b'3221225472')
  self.assertEqual(caught.exception.errno,errno.EINTR);self.assertEqual(len(calls),1);self.assertEqual(calls[0][2],10)
 def test_actual_owned_child_eintr_reports_one_attempt_and_no_bytes(self):
  with tempfile.TemporaryDirectory() as name:
   d=Path(name);f=d/'target';fd=os.open(f,os.O_CREAT|os.O_RDWR,0o600)
   with patch.object(p,'kernel_write_once',side_effect=InterruptedError(errno.EINTR,'private')):
    value=p.bounded_phase_write(fd,lambda:{'memory':{'file_dirty':0,'file_writeback':0}},d)
   self.assertEqual(value['outcome'],'write-failed');self.assertEqual(value['errno'],errno.EINTR);self.assertEqual(value['writeAttempts'],1);self.assertEqual(f.read_bytes(),b'');self.assertTrue(value['writerGone']);self.assertTrue(value['phaseProtocol']['drainedToEof']);self.assertTrue(value['phaseProtocol']['writeStartObserved']);self.assertEqual(len(list(d.glob('reclaim-writer-*.json'))),1)

class RetainedPidfds(unittest.TestCase):
 def test_existing_retained_without_list_keeps_old_and_new_pidfds(self):
  for changed in (False,True):
   with tempfile.TemporaryDirectory() as name:
    d=Path(name);fd=os.open(d/'target',os.O_CREAT|os.O_RDWR,0o600);child=os.fork()
    if child==0:time.sleep(30);os._exit(0)
    old=os.pidfd_open(child,0);birth=p.identity(child);parent=p.identity(os.getpid());p.receipt(d,birth,parent,'a'*64,fd);record=next(d.glob('reclaim-writer-*.json'));p.RETAINED_WRITERS[child]={'pidfd':old,'birth':birth}
    try:
     if changed:
      with patch.object(p,'identity',return_value={**birth,'cmdlineSha256':'b'*64}):
       with self.assertRaisesRegex(RuntimeError,'writer_birth_changed'):p.open_recorded_writer(record,'a'*64,{os.getpid()})
     else:
      evidence=p.census_recorded_writers(d,'a'*64,{os.getpid()});self.assertFalse(evidence['recordedWritersGone'])
     held=p.RETAINED_WRITERS[child];self.assertEqual(held['pidfd'],old);self.assertEqual(len(held['additionalPidfds']),1);os.fstat(old);os.fstat(held['additionalPidfds'][0])
    finally:
     os.kill(child,9);os.waitpid(child,0);held=p.RETAINED_WRITERS.pop(child);os.close(held['pidfd'])
     for other in held.get('additionalPidfds',[]):os.close(other)
     os.close(fd)

if __name__=='__main__':unittest.main()
