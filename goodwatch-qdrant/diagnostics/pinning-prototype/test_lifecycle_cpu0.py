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
    root=Path(directory);path=root/'cpu0-lifecycle-handoff-v1.json'
    prior={'schema':'clone-lifecycle-handoff.cpu0.v1','owner':'stager','previousSha256':None,'snapshot':{'fixed':1}}
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
      self.assertEqual(result['sha256'],life.digest(path.read_bytes()));self.assertEqual(result['previousSha256'],life.digest(raw));self.assertEqual(result['snapshot'],{'fixed':2})
      self.assertEqual(path.stat().st_mode&0o777,0o600);self.assertEqual(len(list(root.iterdir())),1)
 def test_handoff_cleanup_preserves_original_guard(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);path=root/'cpu0-lifecycle-handoff-v1.json';raw=b'{"schema":"clone-lifecycle-handoff.cpu0.v1"}\n';path.write_bytes(raw);path.chmod(0o600)
   with patch.object(life,'ROOT',root),patch.object(life,'pair_snapshot',return_value={}),patch.object(life.os,'replace',side_effect=RuntimeError('lifecycle_handoff_changed')),patch.object(life.os,'unlink',side_effect=OSError('private cleanup')):
    with self.assertRaisesRegex(RuntimeError,'lifecycle_handoff_changed') as failed:life.commit_handoff(object(),life.digest(raw),'controller')
    self.assertEqual(failed.exception.lifecycleCleanupFailure,'lifecycle_handoff_cleanup_failed')
   self.assertEqual(path.read_bytes(),raw)

if __name__=='__main__':unittest.main()
