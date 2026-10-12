"""Owned legacy producer authentication and lifecycle; no executable default.

Private credentials stay out of argv/output; Engine persists Env until removal. Callbacks for registration carry
only public metadata; the stdout callback is exclusively the private pipe.
"""
import hashlib,json,os,stat,time,math,re,select
from pathlib import Path

ROOT=Path('/root/goodwatch-qdrant-cold-406-20261011')
STAGE=ROOT/'pin-control-20261012-406-v1'
ENV=Path('/var/lib/goodwatch-search-tail-406/private-producer.env')
RECEIPT=ENV.parent/'private-producer-stage-406.json'
GUARD=ROOT/'historical-index-guard-453-v2.mjs'
NAME='goodwatch-search-private-pin-stream-100'
IMAGE='sha256:3d698950ee07437a64d9bbc8eaafe2d4638a7f90dde0e57aee133d51b6653a7f'
MANIFEST_SHA='7aea9823b080b8c00234c30cef5c54510193f203b59048b7a38f371f33fe2230'
RECEIPT_SHA='51695ba03bd32d8e7f6e062021bbf84d055e850a810c2fdf7f521c37fd958c62'
GUARD_SHA='19e45f2ae9cf6ebadbbbe4c0ec435fc3e1fee2f6d7e61ef05d33d4e4d9629c90'
ENV_KEYS=frozenset(('SEARCH_STORAGE_KEY','CRATE_HOSTS','CRATE_USER','CRATE_PASS','DIAGNOSTIC_INDEX_BUILD'))
BINDINGS=[str(STAGE)+':/app/build/server/replay:ro',str(GUARD)+':/tmp/historical-index-guard.mjs:ro']

def fail(reason):raise RuntimeError(reason)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def directory(path):
    s=path.lstat()
    if path.resolve()!=path or not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or stat.S_IMODE(s.st_mode)!=0o700:fail('producer_directory_refused')
    return (s.st_dev,s.st_ino)
def read_owned(path,maximum=32*1024**2,*,uid=0):
    a=path.lstat()
    if path.resolve()!=path or not stat.S_ISREG(a.st_mode) or a.st_uid!=uid or a.st_nlink!=1 or stat.S_IMODE(a.st_mode)!=0o600 or a.st_size>maximum:fail('producer_file_refused')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        b=os.fstat(fd)
        if (a.st_dev,a.st_ino)!=(b.st_dev,b.st_ino):fail('producer_file_changed')
        raw=bytearray()
        while True:
            part=os.read(fd,min(65536,maximum+1-len(raw)))
            if not part:break
            raw.extend(part)
            if len(raw)>maximum:fail('producer_file_bound')
        z=os.fstat(fd);end=path.lstat()
        if (b.st_dev,b.st_ino,b.st_size,b.st_mtime_ns)!=(z.st_dev,z.st_ino,z.st_size,z.st_mtime_ns) or (end.st_dev,end.st_ino)!=(b.st_dev,b.st_ino) or len(raw)!=b.st_size:fail('producer_file_changed')
        return bytes(raw),{'device':b.st_dev,'inode':b.st_ino,'sha256':sha(raw)}
    finally:os.close(fd)

def authenticate(*,read=read_owned,check_directory=directory,_credential_sink=None):
    """Must run on abio before create/start, including before preload execution."""
    parents={p:check_directory(p) for p in (ROOT,STAGE,ENV.parent)}
    raw,_=read(STAGE/'prepared-source-manifest.json',65536)
    if sha(raw)!=MANIFEST_SHA:fail('producer_manifest_changed')
    manifest=json.loads(raw);files=manifest.get('files')
    if not isinstance(files,dict) or not files or len(files)>32:fail('producer_manifest_shape')
    for name,digest in files.items():
        if not isinstance(name,str) or '/' in name or name in ('.','..') or not isinstance(digest,str) or len(digest)!=64:fail('producer_manifest_shape')
        body,_=read(STAGE/name)
        if sha(body)!=digest:fail('producer_source_changed')
    alias,_=read(STAGE/'production.mjs')
    if sha(alias)!=manifest.get('productionBundleSha256'):fail('producer_bundle_changed')
    guard,_=read(GUARD,32768)
    if sha(guard)!=GUARD_SHA:fail('producer_guard_changed')
    receipt_raw,_=read(RECEIPT,65536)
    if sha(receipt_raw)!=RECEIPT_SHA:fail('producer_receipt_changed')
    proof=json.loads(receipt_raw)
    expected={str(STAGE/name) for name in files}|{str(STAGE/'prepared-source-manifest.json'),str(STAGE/'production.mjs'),str(ENV)}
    if proof.get('schema')!='private-producer-stage-receipt.v1' or proof.get('sourceManifestSha256')!=MANIFEST_SHA or not isinstance(proof.get('files'),dict) or set(proof['files'])!=expected:fail('producer_receipt_shape')
    env_raw,identity=read(ENV,32768)
    if proof['files'][str(ENV)]!=identity:fail('producer_env_changed')
    values={}
    for line in env_raw.decode('utf8').splitlines():
        if '=' not in line or '\r' in line or '\0' in line:fail('producer_env_shape')
        key,value=line.split('=',1)
        if key in values or not value or len(value)>4096:fail('producer_env_shape')
        values[key]=value
    if set(values)!=ENV_KEYS or values['DIAGNOSTIC_INDEX_BUILD']!='20261011T041503Z':fail('producer_env_shape')
    if len(values['SEARCH_STORAGE_KEY'])!=64 or any(c not in '0123456789abcdefABCDEF' for c in values['SEARCH_STORAGE_KEY']):fail('producer_env_shape')
    if not all(host and all(c.isascii() and (c.isalnum() or c in '.-') for c in host) for host in values['CRATE_HOSTS'].split(',')):fail('producer_env_shape')
    if any(check_directory(p)!=identity for p,identity in parents.items()):fail('producer_directory_changed')
    if _credential_sink is not None:_credential_sink(dict(values))
    return {'schema':'cpu0-producer-authentication.v6','sourceManifestSha256':MANIFEST_SHA,'guardSha256':GUARD_SHA,'credentialReceiptSha256':RECEIPT_SHA,'authenticated':True,'privateValuesEmitted':False}

def shape(info):
    """No private Config/Env/argv escapes; reject foreign name or shape."""
    h=info.get('HostConfig',{});c=info.get('Config',{})
    if info.get('Name')!='/'+NAME or info.get('Image')!=IMAGE or h.get('ReadonlyRootfs') is not True or h.get('LogConfig',{}).get('Type')!='none' or h.get('Memory')!=3*1024**3 or h.get('MemorySwap')!=3*1024**3 or h.get('NanoCpus')!=2*10**9 or h.get('Binds')!=BINDINGS or h.get('PidsLimit')!=256 or h.get('NetworkMode')!='coolify' or h.get('AutoRemove') is not True:fail('producer_shape_refused')
    if h.get('Tmpfs')!={'/tmp':'rw,noexec,nosuid,size=64m'} or h.get('RestartPolicy',{}).get('Name') not in ('','no'):fail('producer_shape_refused')
    if c.get('Entrypoint')!=['node'] or c.get('Cmd')!=['/app/build/server/replay/run-heldout-no-profile.mjs','--private-stream','--heldout-stream']:fail('producer_shape_refused')
    if not isinstance(info.get('Id'),str) or len(info['Id'])!=64 or any(c not in '0123456789abcdef' for c in info['Id']):fail('producer_identity_refused')
    return info['Id']


def validate_remaining(value):
    if type(value) not in (int,float) or not math.isfinite(value) or not 0<value<=7200:fail('producer_global_deadline_invalid')

def bounded_proc(path,maximum):
    with path.open('rb') as stream:raw=stream.read(maximum+1)
    if len(raw)>maximum:fail('producer_process_metadata_bound')
    return raw

def process_identity(pid,ident,*,proc=Path('/proc')):
    """Actual PIDFD/birth bracket; exact argv, executable and physical cgroup.

    No argv, exe path, cgroup path or environment enters the public receipt.
    Parent changes do not invalidate this exact process identity.
    """
    if type(pid) is not int or pid<=1 or pid in (os.getpid(),os.getppid()) or not isinstance(ident,str) or not re.fullmatch('[a-f0-9]{64}',ident):fail('producer_process_identity_refused')
    fd=os.pidfd_open(pid,0);primary=None
    try:
        base=proc/str(pid)
        def ticks():
            raw=bounded_proc(base/'stat',8192);tail=raw.rsplit(b') ',1)[1].split()
            value=int(tail[19])
            if value<=0:fail('producer_birth_refused')
            return value
        before=ticks()
        if select.select([fd],[],[],0)[0]:fail('producer_birth_gone')
        groups=bounded_proc(base/'cgroup',8192)
        rows=groups.decode('ascii').splitlines()
        if len(rows)!=1 or not rows[0].startswith('0::/'):fail('producer_cgroup_refused')
        group=rows[0][3:];parts=group.split('/')
        if any(piece in ('.','..') for piece in parts) or not any(piece in (ident,'docker-'+ident+'.scope') for piece in parts):fail('producer_cgroup_refused')
        raw_argv=bounded_proc(base/'cmdline',65536)
        expected=['node','/app/build/server/replay/run-heldout-no-profile.mjs','--private-stream','--heldout-stream']
        if raw_argv!=b'\0'.join(value.encode() for value in expected)+b'\0':fail('producer_argv_changed')
        exe=(base/'exe').stat();wanted=(base/'root/usr/local/bin/node').stat()
        if not stat.S_ISREG(exe.st_mode) or (exe.st_dev,exe.st_ino,exe.st_size)!=(wanted.st_dev,wanted.st_ino,wanted.st_size) or bounded_proc(base/'comm',256).strip()!=b'node':fail('producer_executable_changed')
        status=bounded_proc(base/'status',65536)
        locked=[int(line.split()[1])*1024 for line in status.splitlines() if line.startswith(b'VmLck:')]
        if locked!=[0]:fail('producer_process_locked')
        after=ticks()
        if before!=after or groups!=bounded_proc(base/'cgroup',8192) or raw_argv!=bounded_proc(base/'cmdline',65536) or (exe.st_dev,exe.st_ino,exe.st_size)!=(lambda x:(x.st_dev,x.st_ino,x.st_size))((base/'exe').stat()) or select.select([fd],[],[],0)[0]:fail('producer_process_changed')
        digest=lambda value:sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
        return {'pid':pid,'startTicks':before,'exeIdentityHash':digest([exe.st_dev,exe.st_ino,exe.st_size]),'argvHash':sha(raw_argv),'groupHash':sha(groups),'containerMembershipVerified':True,'VmLckBytes':0}
    except BaseException as error:
        primary=error;raise
    finally:
        try:os.close(fd)
        except OSError:
            if primary is not None:primary.producerPidfdCleanupFailure=True
            else:fail('producer_pidfd_cleanup_failed')

def registration(info,birth,process_identity):
    ident=shape(info);state=info.get('State',{})
    if not isinstance(birth,dict) or set(birth)!={'pid','startTicks'} or any(type(birth[k]) is not int or birth[k]<=0 for k in birth) or state.get('Pid')!=birth['pid'] or state.get('Running') is not True:fail('producer_birth_refused')
    if not isinstance(process_identity,dict) or set(process_identity)!={'pid','startTicks','exeIdentityHash','argvHash','groupHash','containerMembershipVerified','VmLckBytes'} or process_identity.get('VmLckBytes')!=0 or type(process_identity.get('VmLckBytes')) is not int or any(not isinstance(process_identity.get(k),str) or not re.fullmatch('[a-f0-9]{64}',process_identity[k]) for k in ('exeIdentityHash','argvHash','groupHash')):fail('producer_process_identity_refused')
    if process_identity.get('pid')!=birth['pid'] or process_identity.get('startTicks')!=birth['startTicks'] or process_identity.get('containerMembershipVerified') is not True:fail('producer_process_identity_refused')
    return {'schema':'cpu0-producer-registration.v6','containerId':ident,'image':IMAGE,'pid':birth['pid'],'startTicks':birth['startTicks'],'startedAt':state.get('StartedAt'),'shapeVerified':True,'registered':True,'processIdentity':process_identity}

def cleanup_registered(receipt,backend):
    """backend is the bounded root transport adapter; no name-only signal."""
    ident=receipt.get('containerId')
    if set(receipt)!={'schema','containerId','image','pid','startTicks','startedAt','shapeVerified','registered','processIdentity'} or receipt.get('shapeVerified') is not True or receipt.get('image')!=IMAGE or any(type(receipt.get(k)) is not int or receipt[k]<=0 for k in ('pid','startTicks')) or receipt.get('schema')!='cpu0-producer-registration.v6' or receipt.get('registered') is not True or not isinstance(ident,str) or len(ident)!=64 or any(c not in '0123456789abcdef' for c in ident):fail('producer_registration_refused')
    info=backend.inspect(ident)
    if info is None:return {'containerGone':True,'birthGone':backend.birth_gone(receipt),'exitCode':None,'exitZeroProven':False,'cleanupAttempted':False}
    if shape(info)!=ident:fail('producer_identity_changed')
    if info['State'].get('Running'):
        if backend.birth(info['State']['Pid'])!={'pid':receipt['pid'],'startTicks':receipt['startTicks']} or info['State'].get('StartedAt')!=receipt['startedAt']:fail('producer_birth_changed')
        if backend.process_identity(receipt['pid'],ident)!=receipt['processIdentity']:fail('producer_process_identity_changed')
        after=backend.inspect(ident)
        if after is None or shape(after)!=ident or after['State'].get('Pid')!=receipt['pid'] or after['State'].get('StartedAt')!=receipt['startedAt']:fail('producer_birth_changed')
        backend.stop(ident,15,25)
    remaining=backend.inspect(ident)
    return {'containerGone':remaining is None,'birthGone':backend.birth_gone(receipt),'exitCode':remaining.get('State',{}).get('ExitCode') if remaining else None,'exitZeroProven':False,'cleanupAttempted':True}

def execute(backend,emit_private,register_public,*,remaining_seconds,authenticate_fn=authenticate):
    """Backend create is stopped; start/attach stdout stays buffered until registered.

    Adapter owns fixed legacy create args and bounded stdout buffering. wait()
    must return actual attached CLI AND container exit proof, not SSH status.
    """
    validate_remaining(remaining_seconds)
    if isinstance(backend,DockerBackend):backend.deadline=min(backend.deadline,time.monotonic()+remaining_seconds)
    auth=authenticate_fn(_credential_sink=backend.set_credentials) if authenticate_fn is authenticate and isinstance(backend,DockerBackend) else authenticate_fn();receipt=None;ident=None;primary=None;creation_attempted=False
    try:
        if isinstance(backend,DockerBackend):backend.remaining(15)
        if backend.find_name(NAME):fail('producer_name_in_use')
        if backend.image_id(IMAGE)!=IMAGE:fail('producer_image_changed')
        creation_attempted=True
        ident=backend.create_fixed();info=backend.inspect(ident)
        if shape(info)!=ident or info.get('State',{}).get('Running') is not False:fail('producer_created_shape_refused')
        if isinstance(backend,DockerBackend):
            backend.createdReceiptSha256=publish_public_absent(ROOT/'cpu0-producer-created-v1.json',{'schema':'cpu0-producer-created.v6','containerId':ident,'image':IMAGE,'shapeVerified':True,'running':False})
        backend.start_attach(ident)
        info=backend.inspect(ident);receipt=registration(info,backend.birth(info['State']['Pid']),backend.process_identity(info['State']['Pid'],ident))
        if isinstance(backend,DockerBackend):
            backend.registered=receipt
            receipt_sha=publish_registration(receipt)
        else:receipt_sha=sha(json.dumps(receipt,sort_keys=True,separators=(',',':')).encode()+b'\n')
        register_public({'kind':'private-producer-registration','schema':'cpu0-producer-control.v6','authentication':auth,'registration':receipt,'receiptSha256':receipt_sha})
        for part in backend.private_chunks():
            if not isinstance(part,bytes) or len(part)>65536:fail('producer_private_chunk_bound')
            emit_private(part)
        proof=backend.wait()
        if not isinstance(proof,dict) or proof.get('cliExitCode')!=0 or type(proof.get('cliExitCode')) is not int or proof.get('containerExitCode')!=0 or type(proof.get('containerExitCode')) is not int or proof.get('exitObserved') is not True or proof.get('birthGone') is not True:fail('producer_exit_unproven')
        if isinstance(backend,DockerBackend):backend.remaining(15)
        return {'schema':'cpu0-producer-completion.v6','registration':receipt,'cliExitCode':0,'containerExitCode':0,'exitObserved':True,'birthGone':True,'privatePayloadPersisted':False}
    except BaseException as error:
        primary=error
        raise
    finally:
        if primary is not None:
            try:
                if isinstance(backend,DockerBackend):backend.begin_cleanup()
                if receipt is not None:primary.producerCleanupEvidence=cleanup_registered(receipt,backend)
                elif ident is None and creation_attempted:primary.producerCleanupEvidence={'containerGone':None,'birthGone':None,'cleanupAttempted':False,'creationAttempted':True,'createdIdentityUnknown':True}
                elif ident is not None:
                    observed=backend.inspect(ident)
                    if observed is None:primary.producerCleanupEvidence={'containerGone':True,'birthGone':None,'exitZeroProven':False,'cleanupAttempted':False}
                    elif shape(observed)==ident and observed['State'].get('Running') is True:
                        partial=registration(observed,backend.birth(observed['State']['Pid']),backend.process_identity(observed['State']['Pid'],ident))
                        primary.producerCleanupEvidence=cleanup_registered(partial,backend)
                    elif shape(observed)==ident and observed['State'].get('Running') is False:
                        backend.remove_stopped(ident)
                        primary.producerCleanupEvidence={'containerGone':backend.inspect(ident) is None,'birthGone':None,'exitZeroProven':False,'cleanupAttempted':True}
                    else:fail('producer_created_shape_refused')
            except BaseException as cleanup:
                primary.producerCleanupEvidence={'containerGone':False,'birthGone':None,'cleanupAttempted':False,'cleanupFailure':str(cleanup) if str(cleanup) in ('producer_identity_changed','producer_birth_changed','producer_registration_refused','producer_shape_refused') else 'producer_cleanup_failed'}

        if hasattr(backend,'close_client'):
            try:backend.close_client()
            except BaseException:
                if primary is not None:primary.producerClientCleanupFailure=True
                else:raise

if __name__=='__main__':
    print(json.dumps({'schema':'cpu0-producer-adapter.v6','status':'prepared-only','hostOperations':0,'producerStarted':False}))

# Concrete Unix Engine client: private create Env is sent only in the HTTP body.
import http.client,socket,subprocess,threading,queue,selectors
class UnixConnection(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);self.sock.settimeout(self.timeout);self.sock.connect('/var/run/docker.sock')
def engine(method,path,value=None,timeout=15,missing=False):
    connection=UnixConnection('localhost',timeout=timeout)
    try:
        raw=None if value is None else json.dumps(value).encode()
        connection.request(method,'/v1.43'+path,body=raw,headers={'Content-Type':'application/json'})
        response=connection.getresponse();body=response.read(1024**2+1)
        if len(body)>1024**2:fail('producer_engine_bound')
        if response.status==404 and missing:return None
        if response.status not in (200,201,204,304):fail('producer_engine_refused')
        return json.loads(body) if body else None
    except (OSError,http.client.HTTPException,ValueError):fail('producer_engine_failed')
    finally:connection.close()

class DockerBackend:
    def __init__(self,*,remaining_seconds):
        validate_remaining(remaining_seconds)
        self.deadline=time.monotonic()+remaining_seconds
        self.child=None;self.ident=None;self.wait_queue=queue.Queue(maxsize=1);self.started=time.monotonic();self.registered=None;self.credentials=None;self.wait_connection=None;self.wait_ready=False
    def remaining(self,maximum):
        left=self.deadline-time.monotonic()
        if left<=0:fail('producer_global_deadline')
        return min(maximum,left)
    def process_identity(self,pid,ident):return process_identity(pid,ident)
    def find_name(self,name):
        value=engine('GET','/containers/'+name+'/json',missing=True,timeout=self.remaining(15))
        return [] if value is None else [value['Id']]
    def image_id(self,image):return engine('GET','/images/'+image+'/json',timeout=self.remaining(15)).get('Id')
    def inspect(self,ident):return engine('GET','/containers/'+ident+'/json',missing=True,timeout=self.remaining(15))
    def birth(self,pid):
        raw=Path('/proc/'+str(pid)+'/stat').read_bytes()
        tail=raw.rsplit(b') ',1)[1].split()
        if len(raw)>8192 or len(tail)<20:fail('producer_birth_refused')
        return {'pid':pid,'startTicks':int(tail[19])}
    def birth_gone(self,r):
        try:return self.birth(r['pid'])!={'pid':r['pid'],'startTicks':r['startTicks']}
        except FileNotFoundError:return True
    def set_credentials(self,values):self.credentials=values
    def create_fixed(self):
        if any(os.path.lexists(ROOT/name) for name in ('cpu0-producer-created-v1.json','cpu0-producer-registration-v1.json')):fail('producer_prior_registration_exists')
        if self.credentials is None:fail('producer_credentials_unverified')
        env=[key+'='+value for key,value in self.credentials.items()]+['WEBAPP_ROLE=search','TYPESAFE_API_KEY=','DIAGNOSTIC_IMAGE_SOURCE=5f15698995eb4368baf5ea094b704a3752191e40','DIAGNOSTIC_BUNDLE_SOURCE=2eb889b4d7ab998f012cda8aadbc2afc8d9dd8ff','DIAGNOSTIC_PRIVATE_PIPE=1','SOURCE_MANIFEST_SHA256='+MANIFEST_SHA,'NODE_OPTIONS=--import=/app/build/server/replay/producer-guard.mjs --import=/tmp/historical-index-guard.mjs']
        config={'Image':IMAGE,'Entrypoint':['node'],'Cmd':['/app/build/server/replay/run-heldout-no-profile.mjs','--private-stream','--heldout-stream'],'Env':env,'AttachStdout':True,'AttachStderr':True,'HostConfig':{'ReadonlyRootfs':True,'LogConfig':{'Type':'none'},'Memory':3*1024**3,'MemorySwap':3*1024**3,'NanoCpus':2*10**9,'PidsLimit':256,'NetworkMode':'coolify','AutoRemove':True,'Binds':BINDINGS,'Tmpfs':{'/tmp':'rw,noexec,nosuid,size=64m'}}}
        self.ident=engine('POST','/containers/create?name='+NAME,config,timeout=self.remaining(15))['Id'];self.credentials=None;return self.ident
    def start_attach(self,ident):
        # Install independent Engine wait BEFORE startup so AutoRemove cannot
        # erase the observed container exit; readiness Event means request sent.
        ready=threading.Event()
        def waiter():
            connection=UnixConnection('localhost',timeout=self.remaining(15));self.wait_connection=connection
            try:
                connection.request('POST','/v1.43/containers/'+ident+'/wait?condition=next-exit',body=b'')
                response=connection.getresponse()
                if response.status!=200:fail('producer_wait_refused')
                # Moby installs ContainerWait before flushing these headers.
                self.wait_ready=True;connection.sock.settimeout(self.remaining(7200));ready.set()
                raw=response.read(65537)
                if response.status!=200 or len(raw)>65536:fail('producer_wait_refused')
                proof=json.loads(raw)
                self.wait_queue.put(proof)
            except BaseException:self.wait_queue.put(None);ready.set()
            finally:connection.close()
        threading.Thread(target=waiter,daemon=True).start()
        if not ready.wait(self.remaining(15)) or not self.wait_ready:fail('producer_wait_refused')
        self.child=subprocess.Popen(['/usr/bin/docker','start','--attach',ident],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env={'PATH':'/usr/bin:/bin','DOCKER_HOST':'unix:///var/run/docker.sock'},close_fds=True)
        until=time.monotonic()+self.remaining(15)
        while time.monotonic()<until:
            observed=self.inspect(ident)
            if observed and observed.get('State',{}).get('Running'):return
            if self.child.poll() is not None:fail('producer_start_failed')
            time.sleep(.02)
        fail('producer_start_timeout')
    def private_chunks(self):
        selector=selectors.DefaultSelector();selector.register(self.child.stdout,selectors.EVENT_READ)
        total=0
        try:
            while True:
                if time.monotonic()>=self.deadline:fail('producer_deadline')
                if not selector.select(self.remaining(1)):continue
                raw=os.read(self.child.stdout.fileno(),65536)
                if not raw:break
                total+=len(raw)
                if total>32*1024**2:fail('producer_private_total_bound')
                yield raw
        finally:selector.close()
    def wait(self):
        try:code=self.child.wait(timeout=self.remaining(15));proof=self.wait_queue.get(timeout=self.remaining(15))
        except (subprocess.TimeoutExpired,queue.Empty):fail('producer_exit_unproven')
        if proof is None or type(proof.get('StatusCode')) is not int or proof.get('Error') is not None:fail('producer_exit_unproven')
        return {'cliExitCode':code,'containerExitCode':proof['StatusCode'],'exitObserved':True,'birthGone':self.birth_gone(self.registered)}
    def begin_cleanup(self):self.deadline=time.monotonic()+60
    def remove_stopped(self,ident):engine('DELETE','/containers/'+ident,timeout=self.remaining(15))
    def stop(self,ident,grace,timeout):engine('POST','/containers/'+ident+'/stop?t='+str(grace),timeout=self.remaining(timeout))
    def close_client(self):
        # Supported start --attach forwards signals for this non-TTY producer.
        # TERM of this exact direct client may therefore stop its owned container;
        # client cleanup is never container exit-zero or birth-gone evidence.
        self.credentials=None
        if self.wait_connection is not None:self.wait_connection.close()
        if self.child and self.child.poll() is None:
            self.child.terminate()
            try:self.child.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self.child.kill()
                try:self.child.wait(timeout=5)
                except subprocess.TimeoutExpired:fail('producer_attach_client_gone_unproven')

def publish_public_absent(path,receipt):
    raw=json.dumps(receipt,sort_keys=True,separators=(',',':')).encode()+b'\n'
    directory(ROOT)
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view)
            if count<=0:fail('producer_receipt_write_failed')
            view=view[count:]
        os.fsync(fd)
    finally:os.close(fd)
    parent=os.open(ROOT,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(parent)
    finally:os.close(parent)
    return sha(raw)

def publish_registration(receipt):
    return publish_public_absent(ROOT/'cpu0-producer-registration-v1.json',receipt)

def cleanup_from_receipts(backend=None,*,read=read_owned,check_directory=directory):
    """Independent final census. Never reads credentials, source or model files.

    A created-ID record proves ownership, not a running birth. Missing running
    registration cannot authorize a signal; that gap stays unknown/terminal.
    """
    backend=backend or DockerBackend(remaining_seconds=60)
    check_directory(ROOT)
    created_path=ROOT/'cpu0-producer-created-v1.json'
    running_path=ROOT/'cpu0-producer-registration-v1.json'
    created=None;registered=None
    if os.path.lexists(created_path):
        raw,_=read(created_path,8192);created=json.loads(raw)
        if set(created)!={'schema','containerId','image','shapeVerified','running'} or created['schema']!='cpu0-producer-created.v6' or created['image']!=IMAGE or created['shapeVerified'] is not True or created['running'] is not False or not isinstance(created['containerId'],str) or len(created['containerId'])!=64 or any(c not in '0123456789abcdef' for c in created['containerId']):fail('producer_created_receipt_refused')
    if os.path.lexists(running_path):
        raw,_=read(running_path,8192);registered=json.loads(raw)
        if created is None or registered.get('containerId')!=created['containerId']:fail('producer_receipt_chain_refused')
    current=backend.find_name(NAME)
    if not isinstance(current,list) or len(current)>1:fail('producer_census_refused')
    if created is None:
        return {'schema':'cpu0-producer-final-cleanup.v6','nameAbsentObserved':not bool(current),'containerGone':None,'birthGone':None,'ownershipUnknown':True,'cleanupAttempted':False,'exitZeroProven':False}
    ident=created['containerId']
    if current and current!=[ident]:fail('producer_name_replaced')
    observed=backend.inspect(ident)
    if registered is not None:
        proof=cleanup_registered(registered,backend)
        return {'schema':'cpu0-producer-final-cleanup.v6','nameAbsentObserved':not bool(backend.find_name(NAME)),**proof,'ownershipUnknown':False}
    if observed is None:
        return {'schema':'cpu0-producer-final-cleanup.v6','nameAbsentObserved':not bool(current),'containerGone':True,'birthGone':None,'ownershipUnknown':False,'registeredBirthUnknown':True,'cleanupAttempted':False,'exitZeroProven':False}
    if shape(observed)!=ident:fail('producer_identity_changed')
    if observed['State'].get('Running') is True:
        return {'schema':'cpu0-producer-final-cleanup.v6','nameAbsentObserved':False,'containerGone':False,'birthGone':None,'ownershipUnknown':False,'registeredBirthUnknown':True,'cleanupAttempted':False,'exitZeroProven':False}
    backend.remove_stopped(ident)
    return {'schema':'cpu0-producer-final-cleanup.v6','nameAbsentObserved':not bool(backend.find_name(NAME)),'containerGone':backend.inspect(ident) is None,'birthGone':None,'ownershipUnknown':False,'registeredBirthUnknown':True,'cleanupAttempted':True,'exitZeroProven':False}

def confirm_registration(expected_sha,backend=None):
    """Metadata-only RPC before forwarding any private bytes."""
    backend=backend or DockerBackend(remaining_seconds=60);directory(ROOT)
    raw,_=read_owned(ROOT/'cpu0-producer-registration-v1.json',8192)
    if sha(raw)!=expected_sha:fail('producer_registration_changed')
    receipt=json.loads(raw);observed=backend.inspect(receipt.get('containerId',''))
    if observed is None:fail('producer_registration_gone')
    actual=registration(observed,backend.birth(observed['State']['Pid']),backend.process_identity(observed['State']['Pid'],receipt['containerId']))
    if actual!=receipt:fail('producer_birth_changed')
    return {'schema':'cpu0-producer-confirmed.v6','receiptSha256':expected_sha,'registration':actual,'birthVerified':True}
