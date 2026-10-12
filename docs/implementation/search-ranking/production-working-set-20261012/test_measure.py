import base64,contextlib,hashlib,io,json,os,resource,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
import inspect_measure as m
m.load({n:Path(n).read_bytes()for n in m.FILES})
pin,runtime,production=m.pin,m.runtime,m.production

class Tests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name);self.store=self.root/'store';self.store.mkdir()
  self.proc=self.root/'proc';(self.proc/'900'/'root'/'qdrant').mkdir(parents=True);(self.proc/'900'/'root'/'qdrant'/'storage').symlink_to(self.store,target_is_directory=True)
  self.spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,self.store,frozenset(),0,0,0)
  self.source=runtime.Source(('private','image',900,100),900,self.root/'cgroup','/foreign-fixture',self.spec)
  self.account={'availableBytes':10*pin.GIB,'anonBytes':100,'fileBytes':200,'kernelBytes':300,'unevictableBytes':0,'currentBytes':600,'cgroupMaxBytes':None,'memoryEvents':{'oom':0,'oom_kill':0,'max':0},'cpu':{'nr_throttled':0,'throttled_usec':0}}
  self.rows=[]
  components=('vector_storage_dense','vector_index_dense','vector_storage_sparse','id_tracker','payload_index/field')
  for i,component in enumerate(components):
   path=self.store/'collections/fixture/0/segments/52fe6e69-16c6-4fd1-b4b4-0d36b9e76979'/component/('graph.bin'if component=='vector_index_dense'else'mapped.bin');path.parent.mkdir(parents=True,exist_ok=True)
   path.write_bytes(b'x'*pin.PAGE)
   if component=='vector_storage_dense':
    fd=os.open(path,os.O_RDWR)
    try:os.ftruncate(fd,4*pin.PAGE);os.pwrite(fd,b'x'*pin.PAGE,3*pin.PAGE)
    finally:os.close(fd)
   s=path.stat();device=f'{os.major(s.st_dev):02x}:{os.minor(s.st_dev):02x}'
   self.rows.append(f'{i+1:04x}-{i+2:04x} r--s 00000000 {device} {s.st_ino} /qdrant/storage/{path.relative_to(self.store)}')
  (self.proc/'900/maps').write_text('\n'.join(self.rows)+'\n')
  self.addCleanup(patch.stopall);patch.object(runtime,'PROC',self.proc).start();patch.object(m,'SOURCE_PID',900).start();patch.object(m,'SOURCE_TICKS',100).start();patch.object(runtime,'accounting',return_value=self.account).start()

 def test_default_has_no_input_source_or_module_execution_and_no_raw_errors(self):
  with patch.object(m,'decode',side_effect=AssertionError()),patch.object(m,'measure',side_effect=AssertionError()),contextlib.redirect_stdout(io.StringIO())as out:self.assertEqual(m.main([]),0)
  self.assertFalse(json.loads(out.getvalue())['execution']);self.assertEqual(m.safe_reason(RuntimeError('credential-secret')),'guard_or_runtime_failure')

 def test_real_extents_mincore_totals_exclude_payload_without_locking_content_or_placement(self):
  original=pin.Kernel.call
  def no_lock(kernel,name,*args):
   self.assertEqual(name,'munmap');return original(kernel,name,*args)
  with patch.object(pin.Kernel,'call',no_lock),patch.object(runtime,'prepare_self',side_effect=AssertionError()):
   result=m.measure({},self.spec,allow_nofile=True,check_source=lambda _:self.source)
  self.assertEqual(result['selectedDataBytes'],5*pin.PAGE);self.assertEqual(result['payloadSelectedBytes'],0)
  self.assertEqual(result['classesMeasured']['payload']['dataBytes'],pin.PAGE)
  self.assertEqual(result['classesMeasured']['vector']['dataBytes'],2*pin.PAGE)
  self.assertEqual(result['queries'],0);self.assertEqual(result['lockedBytes'],0);self.assertEqual(result['vmLockedBytes'],0)
  self.assertTrue(result['ownFdCountUnchanged']);self.assertTrue(result['ownFdCohortUnchanged']);self.assertEqual(result['ownFdCountBefore'],result['ownFdCountAfter']);self.assertTrue(result['ownOomScoreAdjUnchanged']);self.assertEqual(set(result['hostMemoryBefore']),{'MemAvailable','Dirty','Writeback'});self.assertEqual(set(result['hostMemoryAfter']),{'MemAvailable','Dirty','Writeback'});self.assertTrue(result['mappedCohortUnchanged']);self.assertTrue(result['ownNofileRestored'])
  text=json.dumps(result);self.assertNotIn(str(self.store),text);self.assertNotIn('mapped.bin',text)

 def test_real_own_nofile_soft_raise_restores_hard_and_soft(self):
  old=resource.getrlimit(resource.RLIMIT_NOFILE);resource.setrlimit(resource.RLIMIT_NOFILE,(64,old[1]))
  try:
   result=m.measure({},self.spec,allow_nofile=True,check_source=lambda _:self.source)
   self.assertTrue(result['nofileLimits']['raised']);self.assertFalse(result['nofileLimits']['hardChanged'])
   self.assertEqual(resource.getrlimit(resource.RLIMIT_NOFILE),(64,old[1]))
  finally:resource.setrlimit(resource.RLIMIT_NOFILE,old)

 def test_source_turnover_and_limit_events_fail_after_actual_inventory_and_close_fds(self):
  for changed in ('source','limit'):
   calls=[];baseline=len(os.listdir('/proc/self/fd'))
   def check(_):
    calls.append(True)
    return runtime.Source(('new','image',900,101),900,self.source.cgroup,self.source.cgroup_relative,self.spec)if changed=='source'and len(calls)>4 else self.source
   def accounting(_):
    value={**self.account,'memoryEvents':dict(self.account['memoryEvents'])}
    if changed=='limit'and len(calls)>4:value['memoryEvents']['max']=1
    return value
   with patch.object(runtime,'accounting',side_effect=accounting):
    self.assertRaisesRegex(RuntimeError,'source_identity_changed'if changed=='source'else'source_limit_event',m.measure,{},self.spec,allow_nofile=True,check_source=check)
   self.assertEqual(len(os.listdir('/proc/self/fd')),baseline)

 def test_mapping_cohort_turnover_is_not_reported_as_stable_snapshot(self):
  calls=[]
  def check(_):
   calls.append(True)
   if len(calls)==6:(self.proc/'900/maps').write_text('\n'.join(self.rows[:-1])+'\n')
   return self.source
  self.assertRaisesRegex(RuntimeError,'mapped_cohort_changed',m.measure,{},self.spec,allow_nofile=True,check_source=check)

 def test_nofollow_and_single_link_guard_fail_and_close_actual_fds(self):
  path=self.store/self.rows[0].split('/qdrant/storage/')[1];os.link(path,self.root/'alias');baseline=len(os.listdir('/proc/self/fd'))
  self.assertRaisesRegex(ValueError,'target_not_owned_regular_single_link_file',m.measure,{},self.spec,allow_nofile=True,check_source=lambda _:self.source)
  self.assertEqual(len(os.listdir('/proc/self/fd')),baseline)

 def test_no_implicit_nofile_raise_without_explicit_permission(self):
  old=resource.getrlimit(resource.RLIMIT_NOFILE);resource.setrlimit(resource.RLIMIT_NOFILE,(64,old[1]))
  try:
   self.assertRaisesRegex(RuntimeError,'explicit_own_nofile_raise_required',m.measure,{},self.spec,check_source=lambda _:self.source)
   self.assertEqual(resource.getrlimit(resource.RLIMIT_NOFILE),(64,old[1]))
  finally:resource.setrlimit(resource.RLIMIT_NOFILE,old)

 def test_actual_hashed_module_packet_and_positive_fixture_contract(self):
  config={'store':str(self.store),'image':self.spec.image,'mounts':[[str(self.store),'/qdrant/storage','bind',True]],'memoryBytes':0,'swapBytes':0,'cpuNanos':0,'memoryMax':'max','memoryHigh':'max','cpuMax':'max 100000'}
  contract=json.dumps(config).encode();packet={'code':{n:base64.b64encode(Path(n).read_bytes()).decode()for n in m.FILES},'contract':base64.b64encode(contract).decode()}
  with patch.object(m,'CONTRACT',hashlib.sha256(contract).hexdigest()):
   code,decoded=m.decode(json.dumps(packet).encode());self.assertEqual(decoded,config);self.assertEqual(set(code),set(m.FILES))
   packet['code']['pin.py']=base64.b64encode(b'altered').decode();self.assertRaisesRegex(RuntimeError,'private_input_invalid',m.decode,json.dumps(packet).encode())

 def test_input_whitelist_hashes_reject_extra_or_changed_code_without_source_access(self):
  self.assertRaisesRegex(RuntimeError,'private_input_invalid',m.decode,b'{"credential":"secret"}')
  self.assertRaisesRegex(RuntimeError,'private_input_invalid',m.decode,b'x'*524289)

if __name__=='__main__':unittest.main()
