"""Local owned subprocess fixtures; no Docker, SSH or clone action."""
import base64,errno,fcntl,hashlib,importlib.util,json,os,signal,subprocess,tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
import lifecycle_cpu0 as life
SCRIPT=base64.b64decode('IyEvdXNyL2Jpbi9lbnYgYmFzaAojIFNjcmlwdCB0byBydW4gcWRyYW50IGluIGRvY2tlciBjb250YWluZXIgYW5kIGhhbmRsZSBjb250aW5nZW5jaWVzLCBsaWtlIE9PTS4KIyBUaGUgZnVuY3Rpb25pbmcgbG9naWMgaXMgYXMgZm9sbG93czoKIyAtIElmIHJlY292ZXJ5IG1vZGUgaXMgYWxsb3dlZCwgd2UgY2hlY2sgaWYgcWRyYW50IHdhcyBraWxsZWQgZHVyaW5nIGluaXRpYWxpemF0aW9uIG9yIG5vdC4KIyAgIC0gSWYgaXQgd2FzIGtpbGxlZCBkdXJpbmcgaW5pdGlhbGl6YXRpb24sIHdlIHJlbW92ZSBydW4gcWRyYW50IGluIHJlY292ZXJ5IG1vZGUKIyAgIC0gSWYgaXQgd2FzIGtpbGxlZCBhZnRlciBpbml0aWFsaXphdGlvbiwgZG8gbm90aGluZyBhbmQgcmVzdGFydCBjb250YWluZXIKIyAtIElmIHJlY292ZXJ5IG1vZGUgaXMgbm90IGFsbG93ZWQsIHdlIGp1c3QgcmVzdGFydCBjb250YWluZXIKCl90ZXJtICgpIHsKICBraWxsIC1URVJNICIkUURSQU5UX1BJRCIgMj4vZGV2L251bGwKfQoKdHJhcCBfdGVybSBTSUdURVJNCgpfaW50ZXJydXB0ICgpIHsKICBraWxsIC1JTlQgIiRRRFJBTlRfUElEIiAyPi9kZXYvbnVsbAp9Cgp0cmFwIF9pbnRlcnJ1cHQgU0lHSU5UCgouL3FkcmFudCAkQCAmCgojIEdldCBQSUQgZm9yIHRoZSB0cmFwcwpRRFJBTlRfUElEPSQhCndhaXQgJFFEUkFOVF9QSUQKCkVYSVRfQ09ERT0kPwoKUURSQU5UX0FMTE9XX1JFQ09WRVJZX01PREU9JHtRRFJBTlRfQUxMT1dfUkVDT1ZFUllfTU9ERTotZmFsc2V9CgojIENoZWNrIHRoYXQgcmVjb3ZlcnkgbW9kZSBpcyBhbGxvd2VkCmlmIFsgIiRRRFJBTlRfQUxMT1dfUkVDT1ZFUllfTU9ERSIgIT0gdHJ1ZSBdOyB0aGVuCiAgICBleGl0ICRFWElUX0NPREUKZmkKCiMgQ2hlY2sgdGhhdCBxZHJhbnQgd2FzIGtpbGxlZCAoZXhpdCBjb2RlIDEzNykKIyBJZGVhbGx5LCB3ZSB3YW50IHRvIGNhdGNoIG9ubHkgT09NLCBidXQgaXQncyBub3QgcG9zc2libGUgdG8gZGlzdGluZ3Vpc2ggaXQgZnJvbSByYW5kb20ga2lsbCBzaWduYWwKaWYgWyAkRVhJVF9DT0RFICE9IDEzNyBdOyB0aGVuCiAgICBleGl0ICRFWElUX0NPREUKZmkKClFEUkFOVF9JTklUX0ZJTEVfUEFUSD0ke1FEUkFOVF9JTklUX0ZJTEVfUEFUSDotJy5xZHJhbnQtaW5pdGlhbGl6ZWQnfQpSRUNPVkVSWV9NRVNTQUdFPSJRZHJhbnQgd2FzIGtpbGxlZCBkdXJpbmcgaW5pdGlhbGl6YXRpb24uIE1vc3QgbGlrZWx5IGl0J3MgT3V0LW9mLU1lbW9yeS4KUGxlYXNlIGNoZWNrIG1lbW9yeSBjb25zdW1wdGlvbiwgaW5jcmVhc2UgbWVtb3J5IGxpbWl0IG9yIHJlbW92ZSBzb21lIGNvbGxlY3Rpb25zIGFuZCByZXN0YXJ0IgoKIyBDaGVjayB0aGF0IHFkcmFudCB3YXMgaW5pdGlhbGl6ZWQKIyBRZHJhbnQgY3JlYXRlcyBRRFJBTlRfSU5JVF9GSUxFX1BBVEggZmlsZSBhZnRlciBpbml0aWFsaXphdGlvbgojIFNvIGlmIGl0IGRvZXNuJ3QgZXhpc3QsIHFkcmFudCB3YXMga2lsbGVkIGR1cmluZyBpbml0aWFsaXphdGlvbgppZiBbICEgLWYgIiRRRFJBTlRfSU5JVF9GSUxFX1BBVEgiIF07IHRoZW4KICAgICMgUnVuIHFkcmFudCBpbiByZWNvdmVyeSBtb2RlLgogICAgIyBObyBjb2xsZWN0aW9uIG9wZXJhdGlvbnMgYXJlIGFsbG93ZWQgaW4gcmVjb3ZlcnkgbW9kZSBleGNlcHQgZm9yIHJlbW92aW5nIGNvbGxlY3Rpb25zCiAgICBRRFJBTlRfX1NUT1JBR0VfX1JFQ09WRVJZX01PREU9IiRSRUNPVkVSWV9NRVNTQUdFIiAuL3FkcmFudCAkQCAmCiAgICAjIEdldCBQSUQgZm9yIHRoZSB0cmFwcwogICAgUURSQU5UX1BJRD0kIQogICAgd2FpdCAkUURSQU5UX1BJRAogICAgZXhpdCAkPwpmaQoKZXhpdCAkRVhJVF9DT0RFCg==')
def control_fd_probe(connection, config):
 inherited=False
 for name in os.listdir('/proc/self/fd'):
  try:
   value=os.fstat(int(name))
   if [value.st_dev,value.st_ino]==config['lockIdentity']:inherited=True
  except OSError:pass
 connection.send({'controlLockInherited':inherited});connection.close()
def fake_pin_child(connection,spec,policy,raise_limit,config,raise_own_nofile):
 control_fd_probe(connection,config)
def fake_zero_child(connection,source,config):
 control_fd_probe(connection,config)
class WrapperFixture:
 def __enter__(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
  (self.root/'entrypoint.sh').write_bytes(SCRIPT)
  child=self.root/'qdrant';child.write_text('#!/usr/bin/python3\nimport os,signal,sys,time\nsignal.signal(signal.SIGTERM,lambda *_:sys.exit(0))\nopen("ready","w").write(str(os.getpid()))\nwhile True:time.sleep(.05)\n');child.chmod(0o700)
  self.wrapper=subprocess.Popen(['/bin/bash','./entrypoint.sh'],cwd=self.root,stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env={'PATH':'/usr/bin:/bin','QDRANT_ALLOW_RECOVERY_MODE':'false'})
  end=time.monotonic()+3
  while not(self.root/'ready').exists():
   if time.monotonic()>end:raise AssertionError('local readiness timeout')
   time.sleep(.01)
  self.qpid=int((self.root/'ready').read_text());self.qt=life.birth(self.qpid);self.wt=life.birth(self.wrapper.pid)
  self.pidfd=os.pidfd_open(self.qpid);return self
 def __exit__(self,*_):
  if not life.birth_gone(self.qpid,self.qt):
   try:signal.pidfd_send_signal(self.pidfd,signal.SIGKILL,None,0)
   except ProcessLookupError:pass
  if self.wrapper.poll() is None:self.wrapper.kill()
  self.wrapper.wait(timeout=3);os.close(self.pidfd);self.tmp.cleanup()
class Tests(unittest.TestCase):
 def test_actual_script_hash(self):self.assertEqual(hashlib.sha256(SCRIPT).hexdigest(),life.SCRIPT_SHA)
 def test_child_term_exact_script_normal_wrapper_exit_zero(self):
  with WrapperFixture()as f:
   started=time.monotonic();signal.pidfd_send_signal(f.pidfd,signal.SIGTERM,None,0)
   def reap_sleep(seconds):f.wrapper.poll();time.sleep(seconds)
   life.wait_births(f.qpid,f.qt,f.wrapper.pid,f.wt,f.pidfd,started,sleep=reap_sleep)
   self.assertEqual(f.wrapper.wait(),0);self.assertTrue(life.birth_gone(f.qpid,f.qt));self.assertTrue(life.birth_gone(f.wrapper.pid,f.wt))
 def test_wrapper_term_is_not_clean_child_wait_status(self):
  with WrapperFixture()as f:
   fd=os.pidfd_open(f.wrapper.pid)
   try:signal.pidfd_send_signal(fd,signal.SIGTERM,None,0)
   finally:os.close(fd)
   self.assertEqual(f.wrapper.wait(timeout=3),143)
 def test_forced_child_kill_is_137(self):
  with WrapperFixture()as f:
   signal.pidfd_send_signal(f.pidfd,signal.SIGKILL,None,0)
   self.assertEqual(f.wrapper.wait(timeout=3),137)
 def test_real_script_fixture_bash_provenance(self):
  row=subprocess.run(['/bin/bash','--version'],capture_output=True,check=True,timeout=3)
  self.assertTrue(row.stdout.startswith(b'GNU bash, version'))
 def test_stop_state_rejects_oom_zero_elapsed_or_unclean(self):
  before={'containerIdHash':'x','configurationHash':'c','startedAt':'2026-10-12T00:00:00Z','finishedAt':'0001-01-01T00:00:00Z','restartCount':0}
  after={**before,'finishedAt':'2026-10-12T01:00:01Z','running':False,'exitCode':0,'OOMKilled':False}
  life.clean_state(before,after,'2026-10-12T01:00:00+00:00','2026-10-12T01:00:02+00:00',1)
  for changes,elapsed in (({'OOMKilled':True},1),({'exitCode':137},1),({'exitCode':143},1),({},21),({'finishedAt':'2026-10-12T00:59:59Z'},1),({'running':True},1),({'exitCode':False},1)):
   with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_unclean'):life.clean_state(before,{**after,**changes},'2026-10-12T01:00:00+00:00','2026-10-12T01:00:02+00:00',elapsed)
 def test_docker_nine_digit_finished_at_is_clean(self):
  before={'containerIdHash':'x','configurationHash':'c','startedAt':'2026-10-12T00:00:00Z','finishedAt':'0001-01-01T00:00:00Z','restartCount':0}
  after={**before,'finishedAt':'2026-10-12T01:00:01.123456789Z','running':False,'exitCode':0,'OOMKilled':False}
  life.clean_state(before,after,'2026-10-12T01:00:00+00:00','2026-10-12T01:00:02+00:00',1)
 def test_interpreter_floor_and_executable_refuse_before_action(self):
  for patcher in (patch.object(life.sys,'version_info',(3,10,0)),patch.object(life.sys,'executable','/not-reviewed/python3')):
   with patcher,patch.object(life,'attest')as inspect,patch.object(life.signal,'pidfd_send_signal')as send:
    with self.assertRaisesRegex(RuntimeError,'lifecycle_interpreter_unsupported'):life.graceful_stop(life.NEW,None,1)
    inspect.assert_not_called();send.assert_not_called()
 def test_deadline_inspector_bounded_pipe_and_no_extra_inspect(self):
  real=subprocess.Popen
  def fake(argv,**kwargs):
   self.assertEqual(argv,['/usr/bin/docker','inspect',life.NEW])
   return real(['/usr/bin/python3','-c','import sys;sys.stdout.write("x"*1048577)'],**kwargs)
  with patch.object(life.subprocess,'Popen',side_effect=fake):
   with self.assertRaisesRegex(RuntimeError,'lifecycle_docker_unavailable'):life.action_inspector(time.monotonic())('inspect',life.NEW)
  with patch.object(life.subprocess,'Popen')as start:
   with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_timeout'):life.action_inspector(time.monotonic()-21)('inspect',life.NEW)
   start.assert_not_called()
 def test_pidfd_close_failure_retains_completed_receipt(self):
  from contextlib import ExitStack
  before={'qdrant':{'pid':123,'startTicks':1},'wrapper':{'pid':124,'startTicks':2},'state':{}}
  after={'fixed':True}
  with ExitStack()as stack:
   for context in (patch.object(life,'require_lock'),patch.object(life,'attest',return_value=before),patch.object(life.os,'pidfd_open',return_value=99),patch.object(life.os,'close',side_effect=OSError('private failure')),patch.object(life,'birth',return_value=1),patch.object(life,'wait_births'),patch.object(life,'container',return_value={}),patch.object(life,'state_snapshot',return_value=after),patch.object(life,'clean_state'),patch.object(life.signal,'pidfd_send_signal')):stack.enter_context(context)
   with self.assertRaisesRegex(RuntimeError,'lifecycle_pidfd_close_failed')as failure:life.graceful_stop(life.NEW,None,1)
   self.assertTrue(failure.exception.lifecycleCompletedStopReceipt['clean']);self.assertEqual(failure.exception.lifecycleCompletedStopReceipt['after'],after)
 def test_stopped_state_zero_is_not_receipt(self):
  with self.assertRaisesRegex(RuntimeError,'lifecycle_clean_receipt_missing'):life.require_clean_receipt({'running':False,'exitCode':0},None)
 def test_handoff_gap_restart_refused(self):
  for delta in ({'restartCount':1},{'startedAt':'changed'},{'qdrant':{'startTicks':2}},{'oldFinishedAt':'changed'}):
   with self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_changed'):life.compare_handoff({'restartCount':0,'startedAt':'fixed','qdrant':{'startTicks':1},'oldFinishedAt':'fixed'}, {'restartCount':0,'startedAt':'fixed','qdrant':{'startTicks':1},'oldFinishedAt':'fixed',**delta})
 def test_fork_child_has_no_parent_control_fd_parent_still_locked(self):
  with tempfile.TemporaryDirectory()as directory,patch.object(life,'ROOT',Path(directory)):
   p=Path(directory)/'control.lock';fd=os.open(p,os.O_CREAT|os.O_RDWR,0o600);fcntl.flock(fd,fcntl.LOCK_EX)
   read,write=os.pipe()
   try:
    with life.helper_fork_scope(fd):
     pid=os.fork()
     if pid==0:
      try:
       try:os.fstat(fd);result=b'BAD'
       except OSError as e:result=b'closed' if e.errno==errno.EBADF else b'BAD'
       os.write(write,result)
      finally:os._exit(0)
     os.close(write);write=None
     self.assertEqual(os.read(read,16),b'closed');os.waitpid(pid,0);life.require_lock(fd)
    life.require_lock(fd)
   finally:
    if write is not None:os.close(write)
    os.close(read);os.close(fd)
 def test_fork_scope_preserves_primary_when_lock_cleanup_fails(self):
  original=RuntimeError('lifecycle_stop_timeout')
  with patch.object(life,'require_lock',side_effect=[None,RuntimeError('lifecycle_lock_unproven')]):
   with self.assertRaises(RuntimeError)as failure:
    with life.helper_fork_scope(10):raise original
  self.assertIs(failure.exception,original);self.assertEqual(original.lifecycleCleanupFailure,'lifecycle_lock_unproven')
 def test_exact_f831_registered_writer_closes_parent_lock_fd(self):
  path=Path(__file__).parent.parent/'clone-preparation/prepare_clone_reclaim.py'
  raw=path.read_bytes();expected='f831f00f75d4b54dce3ba493a4a078b23969222507576505052291ed0147f7c5'
  self.assertEqual(hashlib.sha256(raw).hexdigest(),expected)
  spec=importlib.util.spec_from_file_location('exact_f831_fixture',path);helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
  with tempfile.TemporaryDirectory()as directory,patch.object(life,'ROOT',Path(directory)):
   root=Path(directory);root.chmod(0o700);fd=os.open(root/'control.lock',os.O_CREAT|os.O_RDWR,0o600);fcntl.flock(fd,fcntl.LOCK_EX)
   target=os.open(root/'numeric-fixture',os.O_CREAT|os.O_WRONLY,0o600)
   def operation(output):
    try:os.fstat(fd)
    except OSError as e:
     if e.errno==errno.EBADF:os.write(output,b'closed');return
    raise RuntimeError('unexpected inherited control fd')
   try:
    with life.helper_fork_scope(fd):
     result=helper.bounded_owned_writer(target,operation,root,expected,timeout=2,grace=1)
    self.assertTrue(result['writerGone']);self.assertEqual(result['writerExitCode'],0)
    self.assertEqual((root/'numeric-fixture').read_bytes(),b'closed');life.require_lock(fd)
   finally:os.close(target);os.close(fd)
 def test_protected_target_never_signalled(self):
  fake={'qdrant':{'pid':123,'startTicks':1},'wrapper':{'pid':124,'startTicks':2}}
  with patch.object(life,'require_lock'),patch.object(life,'attest',return_value=fake),patch.object(life.os,'pidfd_open')as open_pidfd:
   with self.assertRaisesRegex(RuntimeError,'lifecycle_target_refused'):life.graceful_stop(life.NEW,lambda *_:None,3,protected_pids=(123,))
   open_pidfd.assert_not_called()
 def test_wrong_or_production_name_never_inspected(self):
  for name in ('qdrant-main','gw-qdrant-cpu0-other',''):
   with self.assertRaisesRegex(RuntimeError,'lifecycle_target_refused'):life.container(name,lambda *_:self.fail('docker called'))
 def test_expired_wait_no_signal_or_kill_fallback(self):
  with patch.object(life.select,'poll')as poll:
   with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_timeout'):life.wait_births(1,1,2,2,3,0,clock=lambda:21)
   poll.return_value.poll.assert_not_called()
 def test_unclean_stop_failure_retains_same_action_and_observed_state(self):
  from contextlib import ExitStack
  before={'qdrant':{'pid':123,'startTicks':1},'wrapper':{'pid':124,'startTicks':2},'state':{'containerIdHash':'x','configurationHash':'c','startedAt':'fixed','finishedAt':'old','restartCount':0}}
  after={**before['state'],'running':False,'exitCode':143,'OOMKilled':False,'finishedAt':life.utc()}
  with ExitStack()as stack:
   for context in (patch.object(life,'require_lock'),patch.object(life,'attest',return_value=before),patch.object(life.os,'pidfd_open',return_value=99),patch.object(life.os,'close'),patch.object(life,'birth',return_value=1),patch.object(life,'wait_births'),patch.object(life,'container',return_value={}),patch.object(life,'state_snapshot',return_value=after),patch.object(life,'birth_gone',return_value=True)):
    stack.enter_context(context)
   send=stack.enter_context(patch.object(life.signal,'pidfd_send_signal'))
   with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_unclean')as failure:life.graceful_stop(life.NEW,None,1)
   row=failure.exception.lifecycleFailureEvidence
   self.assertEqual(row['before'],before);self.assertEqual(row['after']['exitCode'],143);self.assertTrue(row['signalSent']);self.assertFalse(row['clean']);self.assertTrue(row['lateObservationCannotPromoteClean']);self.assertEqual(send.call_args.args[1],signal.SIGTERM);self.assertEqual(send.call_count,1)
 def test_timeout_late_births_gone_do_not_promote_clean(self):
  from contextlib import ExitStack
  before={'qdrant':{'pid':123,'startTicks':1},'wrapper':{'pid':124,'startTicks':2}}
  with ExitStack()as stack:
   for context in (patch.object(life,'require_lock'),patch.object(life,'attest',return_value=before),patch.object(life.os,'pidfd_open',return_value=99),patch.object(life.os,'close'),patch.object(life,'birth',return_value=1),patch.object(life,'wait_births',side_effect=RuntimeError('lifecycle_stop_timeout')),patch.object(life,'birth_gone',return_value=True),patch.object(life.signal,'pidfd_send_signal')):stack.enter_context(context)
   inspect=stack.enter_context(patch.object(life,'container'))
   with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_timeout')as failure:life.graceful_stop(life.NEW,None,1)
   row=failure.exception.lifecycleFailureEvidence
   self.assertIsNone(row['after']);self.assertEqual(row['afterStatus'],'unavailable');self.assertTrue(row['qdrantBirthGone']);self.assertFalse(row['clean']);inspect.assert_not_called()

class ProcFixture:
 def __enter__(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.proc=self.root/'proc';self.cg=self.root/'cgroups';self.proc.mkdir();(self.cg/'clone').mkdir(parents=True)
  (self.cg/'clone/cgroup.procs').write_text('10\n11\n')
  for pid,comm,ppid,ticks,group in ((10,'bash',1,100,'/clone'),(11,'qdrant',10,101,'/clone'),(os.getpid(),'python3',os.getppid(),102,'/outside')):
   d=self.proc/str(pid);d.mkdir();v=['0']*30;v[0]='S';v[1]=str(ppid);v[19]=str(ticks)
   (d/'stat').write_text(f'{pid} ({comm}) '+' '.join(v));(d/'comm').write_text(comm+'\n');(d/'cgroup').write_text('0::'+group+'\n');(d/'status').write_text('VmLck:\t0 kB\n')
   executable=self.root/comm;executable.touch(exist_ok=True);(d/'exe').symlink_to(executable)
  d=self.proc/'10';(d/'root/qdrant').mkdir(parents=True);(d/'root/qdrant/entrypoint.sh').write_bytes(SCRIPT)
  (d/'cmdline').write_bytes(b'/usr/bin/bash\0./entrypoint.sh\0');(d/'environ').write_bytes(b'QDRANT_ALLOW_RECOVERY_MODE=false\0');(d/'net').mkdir()
  for name in ('tcp','tcp6'):(d/'net'/name).write_text('header\n')
  store=d/'root/qdrant/storage';snap=d/'root/qdrant/snapshots';store.mkdir();snap.mkdir();archive=snap/'fixture.snapshot';archive.write_bytes(b'fixture')
  self.mounts=frozenset(((str(store),'/qdrant/storage','bind',True),(str(snap),'/qdrant/snapshots','bind',True),(str(archive),'/qdrant/snapshots/fixture.snapshot','bind',False)))
  self.x={'Id':'a'*64,'Name':'/'+life.NEW,'Image':life.IMAGE,'RestartCount':0,'Config':{'WorkingDir':'/qdrant','Cmd':['./entrypoint.sh'],'Entrypoint':None,'Env':['QDRANT_ALLOW_RECOVERY_MODE=false'],'Labels':{'goodwatch.task':'406','goodwatch.owner':'search-100-diagnosis'}},'HostConfig':{'Memory':6*1024**3,'MemorySwap':6*1024**3,'NanoCpus':0,'CpuQuota':0,'CpuPeriod':0,'CpusetCpus':'','CpusetMems':'','PortBindings':life.PORT,'RestartPolicy':{'Name':'no','MaximumRetryCount':0}},'State':{'Running':True,'OOMKilled':False,'ExitCode':0,'Pid':10,'StartedAt':'2026-10-12T00:00:00Z','FinishedAt':'0001-01-01T00:00:00Z'},'Mounts':[{'Source':a,'Destination':b,'Type':c,'RW':d}for a,b,c,d in self.mounts]}
  return self
 def __exit__(self,*_):self.tmp.cleanup()
 def attest(self):
  with patch.object(life,'ROOT',self.root),patch.object(life,'MOUNTS',self.mounts):return life.attest(life.NEW,lambda *_:json.dumps([self.x]),self.proc,self.cg)
class AttestationTests(unittest.TestCase):
 def test_exact_process_script_cgroup_and_mount_metadata(self):
  with ProcFixture()as f:
   row=f.attest();self.assertEqual(row['qdrant']['startTicks'],101);self.assertFalse(row['RecoveryAllowed']);self.assertTrue(row['connectionCensusComplete'])
   text=json.dumps(row);self.assertNotIn('/usr/bin/bash',text);self.assertNotIn('QDRANT_ALLOW',text)
 def test_reader_moves_during_final_source_fence_refuses(self):
  with ProcFixture()as f:
   calls=[];original=life.container
   def inspect(*args):
    row=original(*args);calls.append(1)
    if len(calls)==2:(f.proc/str(os.getpid())/'cgroup').write_text('0::/clone/child\n')
    return row
   with patch.object(life,'container',side_effect=inspect):
    with self.assertRaisesRegex(RuntimeError,'lifecycle_reader_placement'):f.attest()
 def test_script_drift_rejected_before_signal(self):
  with ProcFixture()as f:
   (f.proc/'10/root/qdrant/entrypoint.sh').write_text('changed')
   with self.assertRaisesRegex(RuntimeError,'lifecycle_wrapper_unreviewed'):f.attest()
 def test_extra_member_or_wrong_parent_rejected(self):
  with ProcFixture()as f:
   (f.cg/'clone/cgroup.procs').write_text('10\n11\n12\n')
   with self.assertRaisesRegex(RuntimeError,'lifecycle_membership_changed'):f.attest()
  with ProcFixture()as f:
   p=f.proc/'11/stat';p.write_text(p.read_text().replace('S 10 ','S 12 ',1))
   with self.assertRaisesRegex(RuntimeError,'lifecycle_membership_changed'):f.attest()
 def test_pending_client_or_malformed_socket_table_refused(self):
  for line,reason in (('0: 00000000:18BD 00000000:FFFF 01','lifecycle_connection_present'),('malformed','lifecycle_connection_unknown')):
   with ProcFixture()as f:
    (f.proc/'10/net/tcp').write_text('header\n'+line+'\n')
    with self.assertRaisesRegex(RuntimeError,reason):f.attest()
 def test_recovery_true_in_process_refused(self):
  with ProcFixture()as f:
   (f.proc/'10/environ').write_bytes(b'QDRANT_ALLOW_RECOVERY_MODE=true\0')
   with self.assertRaisesRegex(RuntimeError,'lifecycle_recovery_allowed'):f.attest()
 def test_reader_descendant_refused(self):
  with ProcFixture()as f:
   (f.proc/str(os.getpid())/'cgroup').write_text('0::/clone/child\n')
   with self.assertRaisesRegex(RuntimeError,'lifecycle_reader_placement'):f.attest()
class SpawnOwnershipTests(unittest.TestCase):
 def test_real_pin_and_zero_startup_do_not_inherit_control_owner(self):
  import controller_cpu0 as controller,turnover_gate_cpu0 as gate
  with tempfile.TemporaryDirectory()as directory,patch.object(life,'ROOT',Path(directory)):
   path=Path(directory)/'control.lock';fd=os.open(path,os.O_CREAT|os.O_RDWR,0o600);fcntl.flock(fd,fcntl.LOCK_EX)
   info=os.fstat(fd);config={'lockIdentity':[info.st_dev,info.st_ino]}
   try:
    for module,attribute,target,factory in ((controller,'pin_child',fake_pin_child,lambda:controller.PinChild(None,None,False,config)),(gate,'zero_child',fake_zero_child,lambda:gate.ZeroChild(None,config))):
     with patch.object(module,attribute,target),life.helper_fork_scope(fd):holder=factory()
     try:
      self.assertTrue(holder.connection.poll(3));self.assertEqual(holder.connection.recv(),{'controlLockInherited':False})
      holder.process.join(3);self.assertFalse(holder.process.is_alive());self.assertEqual(holder.process.exitcode,0);life.require_lock(fd)
     finally:
      if holder.process.is_alive():holder.process.kill();holder.process.join(3)
      holder.connection.close()
   finally:os.close(fd)

class HandoffTests(unittest.TestCase):
 def test_real_file_commit_hash_and_cas_drift(self):
  for drift in (False,True):
   with tempfile.TemporaryDirectory() as directory:
    root=Path(directory);path=root/'cpu0-lifecycle-handoff-v2.json'
    prior={'schema':'clone-lifecycle-handoff.cpu0.v2','owner':'stager','previousSha256':'b'*64,'snapshot':{'fixed':1},'adoptionIntentSha256':'a'*64}
    raw=life.canonical(prior)+b'\n';path.write_bytes(raw);path.chmod(0o600)
    def snapshot(*args):
     if drift:
      path.write_bytes(b'{"changed":true}\n')
     return {'fixed':2}
    with patch.object(life,'ROOT',root),patch.object(life,'pair_snapshot',side_effect=snapshot):
     if drift:
      with self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_changed'):life.commit_handoff(object(),life.digest(raw),'controller')
      self.assertEqual(path.read_bytes(),b'{"changed":true}\n');self.assertEqual(len(list(root.iterdir())),1)
     else:
      result=life.commit_handoff(object(),life.digest(raw),'controller')
      self.assertEqual(result['adoptionIntentSha256'],'a'*64);self.assertEqual(result['sha256'],life.digest(path.read_bytes()));self.assertEqual(result['previousSha256'],life.digest(raw));self.assertEqual(result['snapshot'],{'fixed':2})
      self.assertEqual(path.stat().st_mode&0o777,0o600);self.assertEqual(len(list(root.iterdir())),1)
 def test_positive_clean_receipt_pair_and_file_handoff(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory)
   before={'containerIdHash':'a'*64,'configurationHash':'b'*64,'startedAt':'2026-10-12T00:00:00Z','finishedAt':'0001-01-01T00:00:00Z','restartCount':0}
   after={**before,'finishedAt':'2026-10-12T01:00:01.123456789Z','running':False,'exitCode':0,'OOMKilled':False}
   receipt={'schema':'clone-child-term.clean.v1','target':life.OLD,'before':{'state':before,'scriptSha256':life.SCRIPT_SHA,'RecoveryAllowed':False,'qdrant':{'pid':11,'startTicks':101},'wrapper':{'pid':10,'startTicks':100}},'after':after,'wallStartedAt':'2026-10-12T01:00:00+00:00','wallFinishedAt':'2026-10-12T01:00:02+00:00','elapsedSeconds':1,'qdrantBirthGone':True,'wrapperBirthGone':True,'childExitStatusObserved':False,'childExitZeroInferredFromWrapperAndDocker':True,'signal':'SIGTERM','killFallback':False,'clean':True}
   rp=root/'cpu0-old-clean-receipt-v1.json';rp.write_bytes(life.canonical(receipt)+b'\n');rp.chmod(0o600)
   new={'state':{'running':True},'qdrant':{'pid':12,'startTicks':102}}
   with patch.object(life,'ROOT',root),patch.object(life,'birth_gone',return_value=True),patch.object(life,'container',return_value={}),patch.object(life,'state_snapshot',return_value=after),patch.object(life,'attest',return_value=new):
    life.require_clean_receipt(after,receipt);pair=life.pair_snapshot(None)
    record={'schema':'clone-lifecycle-handoff.cpu0.v2','owner':'adoption','previousSha256':None,'snapshot':pair,'adoptionIntentSha256':'a'*64};hp=root/'cpu0-lifecycle-handoff-v2.json';raw=life.canonical(record)+b'\n';hp.write_bytes(raw);hp.chmod(0o600)
    self.assertEqual(life.read_handoff(None,life.digest(raw)),record)
    new['qdrant']['startTicks']=103
    with self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_changed'):life.read_handoff(None,life.digest(raw))
 def test_handoff_cleanup_preserves_original_guard(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);path=root/'cpu0-lifecycle-handoff-v2.json';raw=life.canonical({'schema':'clone-lifecycle-handoff.cpu0.v2','owner':'adoption','previousSha256':None,'snapshot':{},'adoptionIntentSha256':'a'*64})+b'\n';path.write_bytes(raw);path.chmod(0o600)
   with patch.object(life,'ROOT',root),patch.object(life,'pair_snapshot',return_value={}),patch.object(life.os,'replace',side_effect=RuntimeError('lifecycle_handoff_changed')),patch.object(life.os,'unlink',side_effect=OSError('private cleanup')):
    with self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_changed') as failed:life.commit_handoff(object(),life.digest(raw),'controller')
    self.assertEqual(failed.exception.lifecycleCleanupFailure,'lifecycle_handoff_cleanup_failed')
   self.assertEqual(path.read_bytes(),raw)

if __name__=='__main__':unittest.main()

class HandoffV2Tests(unittest.TestCase):
 def test_only_adoption_intent_can_start_v2_chain(self):
  base={'schema':'clone-lifecycle-handoff.cpu0.v2','owner':'adoption','previousSha256':None,'snapshot':{},'adoptionIntentSha256':'a'*64}
  self.assertEqual(life.validate_handoff_record(base),base)
  for change in ({'owner':'setup'},{'previousSha256':'b'*64},{'adoptionIntentSha256':None},{'schema':'clone-lifecycle-handoff.cpu0.v1'}):
   with self.subTest(change=change),self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_invalid'):life.validate_handoff_record({**base,**change})
  later={**base,'owner':'controller','previousSha256':'b'*64}
  self.assertEqual(life.validate_handoff_record(later),later)
  with self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_invalid'):life.validate_handoff_record({**later,'previousSha256':None})

class OverheadContextTests(unittest.TestCase):
 def test_actual_own_birth_and_metrics_are_separate_and_pidfd_closed(self):
  before=len(os.listdir('/proc/self/fd'))
  row=life.resource_process(os.getpid(),'/never-the-current-source')
  self.assertEqual(set(row),{'identity','metrics'})
  self.assertEqual(row['identity']['startTicks'],life.birth(os.getpid()))
  self.assertIs(row['identity']['outsideSourceCgroup'],True)
  self.assertEqual(set(row['metrics']),{'RssAnonBytes','VmPTEBytes'})
  self.assertEqual(len(os.listdir('/proc/self/fd')),before)
  with self.assertRaisesRegex(RuntimeError,'overhead_placement_unproven'):
   life.resource_process(os.getpid(),life.process(os.getpid())['group'])
  self.assertEqual(len(os.listdir('/proc/self/fd')),before)
 def test_source_context_requires_actual_classes_not_missing_zero(self):
  from types import SimpleNamespace
  with tempfile.TemporaryDirectory() as temp:
   root=Path(temp);source=SimpleNamespace(cgroup=root)
   (root/'memory.stat').write_text('anon 100\nkernel 20\npagetables 10\nunevictable 0\n')
   (root/'memory.events').write_text('max 0\noom 0\noom_kill 0\n')
   actual=life.entry_source_context(source)
   self.assertEqual(actual['source'],{'anonBytes':100,'kernelBytes':20,'pageTablesBytes':10})
   (root/'memory.stat').write_text('anon 100\nkernel 20\nunevictable 0\n')
   with self.assertRaisesRegex(RuntimeError,'overhead_measurement_unproven'):life.entry_source_context(source)
 def test_growth_boundary_no_shrink_offset_and_no_pagetables_double_debit(self):
  from copy import deepcopy
  baseline={'sourceIdentity':['a'*64,life.IMAGE,1,2],'source':{'anonBytes':100,'kernelBytes':200,'pageTablesBytes':100},'outside':{'consumer':{'identity':{'pid':3,'startTicks':4,'parentPid':5,'exeIdentityHash':'b'*64,'groupHash':'c'*64,'VmLckBytes':0,'outsideSourceCgroup':True},'metrics':{'RssAnonBytes':100,'VmPTEBytes':50}}}}
  current=deepcopy(baseline);current['source']['anonBytes']+=512*1024**2;current['source']['kernelBytes']-=10;current['outside']['consumer']['metrics']['RssAnonBytes']=0
  self.assertEqual(life.overhead_growth(baseline,current)['chargedGrowthBytes'],512*1024**2)
  current['outside']['consumer']['metrics']['VmPTEBytes']+=1
  with self.assertRaisesRegex(RuntimeError,'overhead_growth_exceeded') as failure:life.overhead_growth(baseline,current)
  self.assertEqual(failure.exception.overheadFailureEvidence['chargedGrowthBytes'],512*1024**2+1)
  current=deepcopy(baseline);current['source']['kernelBytes']+=10;current['source']['pageTablesBytes']+=10
  self.assertEqual(life.overhead_growth(baseline,current)['chargedGrowthBytes'],10)
  current['outside']['consumer']['identity']['startTicks']+=1
  with self.assertRaisesRegex(RuntimeError,'overhead_identity_changed'):life.overhead_growth(baseline,current)

class NewControllerGrowthTests(unittest.TestCase):
 def endpoint(self):
  row={'identity':{'pid':3,'startTicks':4,'parentPid':5,'exeIdentityHash':'b'*64,'groupHash':'c'*64,'VmLckBytes':0,'outsideSourceCgroup':True},'metrics':{'RssAnonBytes':100,'VmPTEBytes':50}}
  return {'sourceIdentity':['a'*64,life.IMAGE,1,2],'source':{'anonBytes':100,'kernelBytes':200,'pageTablesBytes':100},'outside':{'consumer':row}}
 def test_new_controller_full_first_debit_and_retired_no_credit(self):
  from copy import deepcopy
  baseline=self.endpoint();current=deepcopy(baseline)
  controller=deepcopy(current['outside']['consumer']);controller['identity']['pid']=7;controller['identity']['startTicks']=8;controller['metrics']={'RssAnonBytes':512*1024**2,'VmPTEBytes':1};current['outside']['controller']=controller
  current['source']['anonBytes']=0;current['outside']['consumer']['metrics']['RssAnonBytes']=0
  with self.assertRaisesRegex(RuntimeError,'overhead_growth_exceeded')as caught:life.overhead_growth(baseline,current)
  proof=caught.exception.overheadFailureEvidence
  self.assertEqual(proof['chargedGrowthBytes'],512*1024**2+1);self.assertEqual(proof['newOutsideRoles'],['controller'])
  controller['metrics']={'RssAnonBytes':10,'VmPTEBytes':1};del current['outside']['consumer']
  proof=life.overhead_growth(baseline,current)
  self.assertEqual(proof['chargedGrowthBytes'],11);self.assertEqual(proof['retiredOutsideRoles'],['consumer'])
 def test_new_source_birth_never_silently_rebases(self):
  from copy import deepcopy
  baseline=self.endpoint();current=deepcopy(baseline);current['sourceIdentity'][3]+=1
  with self.assertRaisesRegex(RuntimeError,'overhead_identity_changed'):life.overhead_growth(baseline,current)

class CleanupAttestationTests(unittest.TestCase):
 def renew(self,f,historical):
  with patch.object(life,'ROOT',f.root),patch.object(life,'MOUNTS',f.mounts):return life.cleanup_attest(life.NEW,historical,lambda *_:json.dumps([f.x]),f.proc,f.cg)
 def test_new_birth_and_active_socket_retained_without_cleanup_veto(self):
  with ProcFixture()as f:
   historical=f.attest()
   (f.proc/'10/net/tcp').write_text('header\n0: 0100007F:18BD 0100007F:AAAA 01\n')
   for pid,old,new in ((10,'100','200'),(11,'101','201')):
    path=f.proc/str(pid)/'stat';path.write_text(path.read_text().replace(old,new))
   f.x['State']['StartedAt']='2026-10-12T00:10:00Z';f.x['State']['OOMKilled']=True
   current=self.renew(f,historical)
   self.assertEqual(current['activeServiceConnections'],1);self.assertEqual(current['qdrant']['startTicks'],201)
   self.assertEqual(current['liveMountIdentityHash'],historical['liveMountIdentityHash']);self.assertIs(current['state']['OOMKilled'],True)
   with self.assertRaisesRegex(RuntimeError,'lifecycle_connection_present'):life.no_clients(life.process(10,f.proc),f.proc)
 def test_extra_holder_stopped_config_and_malformed_history_refuse(self):
  import copy
  with ProcFixture()as f:
   historical=f.attest();path=f.cg/'clone/cgroup.procs';path.write_text('10\n11\n12\n')
   with self.assertRaisesRegex(RuntimeError,'lifecycle_membership_changed'):self.renew(f,historical)
   path.write_text('10\n11\n');f.x['State']['Running']=False
   with self.assertRaisesRegex(RuntimeError,'lifecycle_clean_receipt_missing'):self.renew(f,historical)
   f.x['State']['Running']=True;f.x['Config']['Env'].append('SAFE_FIXTURE_CHANGED=1')
   with self.assertRaisesRegex(RuntimeError,'lifecycle_process_changed'):self.renew(f,historical)
   broken=copy.deepcopy(historical);broken['wrapper']['pid']=True
   with self.assertRaisesRegex(RuntimeError,'lifecycle_target_refused'):self.renew(f,broken)

class AccountingCleanupTests(unittest.TestCase):
 def test_actual_pidfd_close_failure_preserves_original_placement_refusal(self):
  original_close=os.close;actual_open=os.pidfd_open;opened=[]
  def capture(pid):
   fd=actual_open(pid);opened.append(fd);return fd
  try:
   with patch.object(life.os,'pidfd_open',side_effect=capture),patch.object(life.os,'close',side_effect=OSError('fixture-close-failed')):
    with self.assertRaisesRegex(RuntimeError,'overhead_placement_unproven')as caught:life.resource_process(os.getpid(),life.process(os.getpid())['group'])
    self.assertEqual(caught.exception.lifecycleCleanupFailure,'lifecycle_pidfd_close_failed')
    self.assertEqual(len(opened),1);os.fstat(opened[0])
  finally:
   for fd in opened:original_close(fd)
