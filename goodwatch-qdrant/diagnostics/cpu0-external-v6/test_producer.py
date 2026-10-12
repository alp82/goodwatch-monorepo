import json,os,tempfile,unittest,socket,threading
from pathlib import Path
import producer as p
from unittest.mock import patch

def info(running=False):
 return {'Id':'a'*64,'Name':'/'+p.NAME,'Image':p.IMAGE,'Config':{'Entrypoint':['node'],'Cmd':['/app/build/server/replay/run-heldout-no-profile.mjs','--private-stream','--heldout-stream']},'HostConfig':{'ReadonlyRootfs':True,'LogConfig':{'Type':'none'},'Memory':3*1024**3,'MemorySwap':3*1024**3,'NanoCpus':2*10**9,'Binds':p.BINDINGS,'PidsLimit':256,'NetworkMode':'coolify','AutoRemove':True,'Tmpfs':{'/tmp':'rw,noexec,nosuid,size=64m'},'RestartPolicy':{'Name':'no'}},'State':{'Running':running,'Pid':123 if running else 0,'StartedAt':'2026-10-12T00:00:00.000000000Z'}}
class Backend:
 def __init__(self):self.events=[];self.running=False;self.present=True;self.proof={'cliExitCode':0,'containerExitCode':0,'exitObserved':True,'birthGone':True}
 def find_name(self,n):self.events.append('find');return []
 def image_id(self,i):return i
 def create_fixed(self):self.events.append('create');return 'a'*64
 def inspect(self,i):return info(self.running) if self.present else None
 def start_attach(self,i):self.events.append('start');self.running=True
 def birth(self,pid):return {'pid':pid,'startTicks':456}
 def private_chunks(self):self.events.append('private');yield b'private-fixture\n'
 def wait(self):self.running=False;self.present=False;return self.proof
 def birth_gone(self,r):return not self.running
 def stop(self,*a):self.events.append('stop');self.running=False;self.present=False
class Tests(unittest.TestCase):
 def test_auth_failure_has_zero_docker(self):
  b=Backend()
  def refused():raise RuntimeError('producer_guard_changed')
  with self.assertRaisesRegex(RuntimeError,'producer_guard_changed'):p.execute(b,lambda x:None,lambda x:None,authenticate_fn=refused)
  self.assertEqual(b.events,[])
 def test_registration_before_private_and_distinct_exit_proofs(self):
  b=Backend();public=[];private=[]
  def registered(row):b.events.append('register');public.append(row)
  result=p.execute(b,private.append,registered,authenticate_fn=lambda:{'authenticated':True})
  self.assertLess(b.events.index('register'),b.events.index('private'))
  self.assertNotIn('private-fixture',json.dumps(public));self.assertEqual(public[0]['kind'],'private-producer-registration')
  self.assertEqual(result['containerExitCode'],0)
 def test_cli_failure_never_completion_credit(self):
  b=Backend();b.proof['cliExitCode']=1
  with self.assertRaisesRegex(RuntimeError,'producer_exit_unproven') as e:p.execute(b,lambda x:None,lambda x:None,authenticate_fn=lambda:{})
  self.assertTrue(e.exception.producerCleanupEvidence['containerGone']);self.assertFalse(e.exception.producerCleanupEvidence['exitZeroProven'])
 def test_foreign_existing_name_never_started(self):
  b=Backend();b.find_name=lambda n:['foreign']
  with self.assertRaisesRegex(RuntimeError,'producer_name_in_use'):p.execute(b,lambda x:None,lambda x:None,authenticate_fn=lambda:{})
  self.assertEqual(b.events,[])
 def test_changed_birth_never_signaled_and_primary_survives(self):
  b=Backend()
  def output(x):b.birth=lambda pid:{'pid':pid,'startTicks':999};raise RuntimeError('primary_fixture')
  with self.assertRaisesRegex(RuntimeError,'primary_fixture') as e:p.execute(b,output,lambda x:None,authenticate_fn=lambda:{})
  self.assertEqual(e.exception.producerCleanupEvidence['cleanupFailure'],'producer_birth_changed');self.assertNotIn('stop',b.events)
 def test_bool_exit_not_zero_proof(self):
  b=Backend();b.proof['cliExitCode']=False
  with self.assertRaisesRegex(RuntimeError,'producer_exit_unproven'):p.execute(b,lambda x:None,lambda x:None,authenticate_fn=lambda:{})
 def test_real_mode_hardlink_and_symlink_refusal(self):
  with tempfile.TemporaryDirectory() as d:
   path=Path(d)/'source';path.write_bytes(b'fixture');path.chmod(0o600)
   self.assertEqual(p.read_owned(path,uid=os.getuid())[0],b'fixture');path.chmod(0o644)
   with self.assertRaisesRegex(RuntimeError,'producer_file_refused'):p.read_owned(path,uid=os.getuid())
   path.chmod(0o600);os.link(path,Path(d)/'alias')
   with self.assertRaisesRegex(RuntimeError,'producer_file_refused'):p.read_owned(path,uid=os.getuid())
   (Path(d)/'sym').symlink_to(path)
   with self.assertRaisesRegex(RuntimeError,'producer_file_refused'):p.read_owned(Path(d)/'sym',uid=os.getuid())
class AuthenticationTests(unittest.TestCase):
 def test_actual_authentication_and_changed_guard_env_receipt(self):
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);root.chmod(0o700);stage=root/'stage';stage.mkdir(mode=0o700);envdir=root/'env';envdir.mkdir(mode=0o700)
   env=envdir/'private.env';receipt=envdir/'receipt';guard=root/'guard'
   def write(path,raw):path.write_bytes(raw);path.chmod(0o600)
   def read(path,maximum=32*1024**2):return p.read_owned(path,maximum,uid=os.getuid())
   def directory(path):
    self.assertEqual(path.stat().st_mode&0o777,0o700);a=path.stat();return(a.st_dev,a.st_ino)
   write(stage/'producer-guard.mjs',b'guardcode');write(stage/'production.mjs',b'bundle');write(guard,b'historyguard')
   manifest=json.dumps({'files':{'producer-guard.mjs':p.sha(b'guardcode')},'productionBundleSha256':p.sha(b'bundle')}).encode();write(stage/'prepared-source-manifest.json',manifest)
   write(env,b'SEARCH_STORAGE_KEY='+b'a'*64+b'\nCRATE_HOSTS=fixture\nCRATE_USER=fixture\nCRATE_PASS=fixture\nDIAGNOSTIC_INDEX_BUILD=20261011T041503Z\n')
   identity=read(env)[1]
   paths={str(stage/'producer-guard.mjs'):{},str(stage/'prepared-source-manifest.json'):{},str(stage/'production.mjs'):{},str(env):identity}
   rec=json.dumps({'schema':'private-producer-stage-receipt.v1','sourceManifestSha256':p.sha(manifest),'files':paths}).encode();write(receipt,rec)
   with patch.multiple(p,ROOT=root,STAGE=stage,ENV=env,RECEIPT=receipt,GUARD=guard,MANIFEST_SHA=p.sha(manifest),RECEIPT_SHA=p.sha(rec),GUARD_SHA=p.sha(b'historyguard')):
    auth=lambda:p.authenticate(read=read,check_directory=directory)
    self.assertTrue(auth()['authenticated'])
    for target,changed,reason in ((guard,b'changed','producer_guard_changed'),(env,b'changed','producer_env_changed'),(receipt,b'changed','producer_receipt_changed')):
     original=target.read_bytes();write(target,changed);b=Backend()
     with self.assertRaisesRegex(RuntimeError,reason):p.execute(b,lambda x:None,lambda x:None,authenticate_fn=auth)
     self.assertEqual(b.events,[]);write(target,original)
 def test_wait_next_exit_headers_registered_before_attach(self):
  events=[]
  class Response:
   status=200
   def read(self,bound):events.append('body');return b'{"StatusCode":0}'
  class Connection:
   def __init__(self,*args,**kwargs):self.sock=self
   def request(self,*args,**kwargs):events.append(args[1])
   def getresponse(self):events.append('registered-headers');return Response()
   def settimeout(self,value):pass
   def close(self):pass
  class Child:
   def poll(self):return None
  with patch.object(p,'UnixConnection',Connection),patch.object(p.subprocess,'Popen',lambda *a,**k:(events.append('attach') or Child())):
   b=p.DockerBackend();b.inspect=lambda i:info(True);b.start_attach('a'*64)
   self.assertLess(events.index('registered-headers'),events.index('attach'))
   self.assertIn('/v1.43/containers/'+('a'*64)+'/wait?condition=next-exit',events)
class UnixProtocolTests(unittest.TestCase):
 def test_real_unix_wait_headers_before_attach_and_error_refusal(self):
  for payload in ({'StatusCode':0},{'StatusCode':0,'Error':{'Message':'fixture'}}):
   with self.subTest(error='Error' in payload),tempfile.TemporaryDirectory() as d:
    address=str(Path(d)/'engine.sock');listener=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);listener.bind(address);listener.listen(1)
    release=threading.Event();headers=threading.Event();requests=[];server_errors=[]
    body=json.dumps(payload).encode()
    def server():
     try:
      connection,_=listener.accept();connection.settimeout(2)
      raw=b''
      while b'\r\n\r\n' not in raw:raw+=connection.recv(4096)
      requests.append(raw.split(b'\r\n',1)[0])
      connection.sendall(b'HTTP/1.1 200 OK\r\nContent-Length: '+str(len(body)).encode()+b'\r\n\r\n');headers.set()
      if not release.wait(2):raise RuntimeError('local fixture deadline')
      connection.sendall(body);connection.close()
     except BaseException as e:server_errors.append(type(e).__name__)
    thread=threading.Thread(target=server);thread.start()
    class LocalConnection(p.UnixConnection):
     def connect(self):self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(2);self.sock.connect(address)
    class Child:
     def poll(self):return None
     def wait(self,timeout):return 0
    def attach(*args,**kwargs):
     self.assertTrue(headers.is_set());release.set();return Child()
    try:
     with patch.object(p,'UnixConnection',LocalConnection),patch.object(p.subprocess,'Popen',attach):
      backend=p.DockerBackend();backend.inspect=lambda i:info(True);backend.birth_gone=lambda r:True;backend.registered={'fixture':True}
      backend.start_attach('a'*64)
      if 'Error' in payload:
       with self.assertRaisesRegex(RuntimeError,'producer_exit_unproven'):backend.wait()
      else:self.assertEqual(backend.wait()['containerExitCode'],0)
     thread.join(2);self.assertFalse(thread.is_alive());self.assertEqual(server_errors,[])
     self.assertIn(b'condition=next-exit',requests[0])
    finally:release.set();listener.close();thread.join(2)
 def test_independent_container_nonzero_refuses_completion(self):
  backend=Backend();backend.proof['containerExitCode']=17
  with self.assertRaisesRegex(RuntimeError,'producer_exit_unproven'):p.execute(backend,lambda x:None,lambda x:None,authenticate_fn=lambda:{})

class IndependentCleanupTests(unittest.TestCase):
 def test_missing_receipts_never_create_absence_or_birth_proof(self):
  with patch.object(p.os.path,'lexists',lambda path:False):
   backend=Backend();result=p.cleanup_from_receipts(backend,check_directory=lambda p:None)
   self.assertTrue(result['nameAbsentObserved']);self.assertIsNone(result['containerGone']);self.assertIsNone(result['birthGone']);self.assertTrue(result['ownershipUnknown'])
 def test_registration_gap_running_instance_not_signaled(self):
  created={'schema':'cpu0-producer-created.v6','containerId':'a'*64,'image':p.IMAGE,'shapeVerified':True,'running':False}
  with patch.object(p.os.path,'lexists',lambda path:path.name=='cpu0-producer-created-v1.json'):
   backend=Backend();backend.running=True;backend.find_name=lambda name:['a'*64]
   result=p.cleanup_from_receipts(backend,read=lambda path,limit:(json.dumps(created).encode(),{}),check_directory=lambda p:None)
   self.assertTrue(result['registeredBirthUnknown']);self.assertFalse(result['cleanupAttempted']);self.assertNotIn('stop',backend.events)
 def test_registration_receipt_cleanup_does_not_read_credentials(self):
  created={'schema':'cpu0-producer-created.v6','containerId':'a'*64,'image':p.IMAGE,'shapeVerified':True,'running':False}
  running=p.registration(info(True),{'pid':123,'startTicks':456});paths=[]
  def read(path,limit):paths.append(path.name);return(json.dumps(created if 'created' in path.name else running).encode(),{})
  with patch.object(p.os.path,'lexists',lambda path:True):
   backend=Backend();backend.running=True;backend.find_name=lambda name:['a'*64] if backend.present else []
   result=p.cleanup_from_receipts(backend,read=read,check_directory=lambda p:None)
   self.assertTrue(result['containerGone']);self.assertTrue(result['birthGone']);self.assertEqual(paths,['cpu0-producer-created-v1.json','cpu0-producer-registration-v1.json']);self.assertIn('stop',backend.events)

if __name__=='__main__':unittest.main()
