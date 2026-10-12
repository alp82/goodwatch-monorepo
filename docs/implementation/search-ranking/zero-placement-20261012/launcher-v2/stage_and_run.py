"""Local-review-only private stdin stager; default never inspects or executes."""
import base64,ctypes,hashlib,json,os,re,select,signal,stat,subprocess,sys,time
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path('/var/lib/goodwatch-search-tail-406')
STAGE=ROOT/'zero-placement-20261012-406-v2'
CODE='b9a9f13d851ac0a46ce30163126e698b297015b13999a4c9546fd0b0513a87e7'
CONTRACT='12db49b938d8d8d6b24738c860559c098732ff351cf1b90c4637f28d0d2f1b6d'
FILES={'pin.py':'4fea5b5b30a1b294466007f0d390f0b9dbc205ee7225ef704baf55e3c7d7dabc','runtime.py':'4e4cbce3e7b088cfd187af1b61b40ef633e9c9b6a4435e54e3a503921da0c1de','production.py':'9ad60d1b347600add5907c92125288aec3a2914caece63655a4df4ad59203005','production_journal.py':'20fd12fe1a2e5aa24ad5366bc584c0f410d12f6396ff84c0e2719d4fa3ebb389','zero_placement.py':'5e1cbc8b6288b4751f88b0f8c253e4569487aded8f9c028dea707680d549708d'}
SOURCE_PID=3411704;SOURCE_TICKS=2673362807
REASONS={'prepared','version_or_owner','private_input','stage_exists','source_fence','stage_guard','outer_timeout','outer_interrupted','owned_exit_unproven','invalid_public_frame','runtime_failure','cli_failed'}

def emit(phase,**data):
    print(json.dumps({'event':'qdrant.zero-placement.outer.v1','phase':phase,**data},sort_keys=True),flush=True)

def fail(reason):raise RuntimeError(reason)
def digest(raw):return hashlib.sha256(raw).hexdigest()
def ticks(pid):
    raw=Path('/proc',str(pid),'stat').read_text();return int(raw[raw.rfind(')')+2:].split()[19])
def private(path,mode,directory=False):
    s=path.lstat()
    if path.resolve()!=path or s.st_uid!=0 or stat.S_IMODE(s.st_mode)!=mode or (not stat.S_ISDIR(s.st_mode) if directory else not stat.S_ISREG(s.st_mode)or s.st_nlink!=1):fail('stage_guard')
    return s

def source_fence(contract):
    try:
        x=json.loads(subprocess.check_output(['/usr/bin/docker','inspect','qdrant-main'],timeout=5,stderr=subprocess.DEVNULL))[0]
        if not x['State']['Running']or x['Image']!=contract['image']:fail('source_fence')
        if any(x['HostConfig'][a]!=contract[b]for a,b in [('Memory','memoryBytes'),('MemorySwap','swapBytes'),('NanoCpus','cpuNanos')]):fail('source_fence')
        if sorted((m['Source'],m['Destination'],m['Type'],m['RW'])for m in x['Mounts'])!=sorted(tuple(m)for m in contract['mounts']):fail('source_fence')
        rows=subprocess.check_output(['/usr/bin/docker','top','qdrant-main','-eo','pid,comm'],timeout=5,stderr=subprocess.DEVNULL).decode().splitlines()[1:]
        ids=[int(r.split()[0])for r in rows if r.split()[1]=='qdrant']
        if ids!=[SOURCE_PID]or ticks(SOURCE_PID)!=SOURCE_TICKS:fail('source_fence')
        proc=Path('/proc',str(SOURCE_PID))
        if (proc/'comm').read_text().strip()!='qdrant'or(proc/'exe').readlink().name!='qdrant':fail('source_fence')
        cg=(proc/'cgroup').read_text().strip().split(':',2)[2]
        if '..'in cg or not cg.endswith('/docker-'+x['Id']+'.scope')or Path('/proc/self/cgroup').read_text().strip().split(':',2)[2]==cg:fail('source_fence')
        group=Path('/sys/fs/cgroup')/cg.lstrip('/')
        for filename,key in [('memory.max','memoryMax'),('memory.high','memoryHigh'),('cpu.max','cpuMax')]:
            if(group/filename).read_text().strip()!=contract[key]:fail('source_fence')
        if(group/'memory.oom.group').read_text().strip()!='0':fail('source_fence')
        store=Path(contract['store'])
        if store.resolve()!=store or not store.is_dir():fail('source_fence')
        return digest(repr((x['Id'],x['Image'],SOURCE_PID,SOURCE_TICKS)).encode())
    except RuntimeError:raise
    except BaseException:fail('source_fence')

def payload(raw):
    try:
        if len(raw)>1048576:fail('private_input')
        data=json.loads(raw)
        if set(data)!={'code','contract'}or set(data['code'])!=set(FILES):fail('private_input')
        files={name:base64.b64decode(data['code'][name],validate=True)for name in FILES}
        if any(digest(files[n])!=h for n,h in FILES.items()):fail('private_input')
        combined=hashlib.sha256()
        for name in FILES:combined.update(name.encode()+b'\0'+files[name]+b'\0')
        if combined.hexdigest()!=CODE:fail('private_input')
        contract=base64.b64decode(data['contract'],validate=True)
        if len(contract)>16384 or digest(contract)!=CONTRACT:fail('private_input')
        parsed=json.loads(contract)
        if set(parsed)!={'store','image','mounts','memoryBytes','swapBytes','cpuNanos','memoryMax','memoryHigh','cpuMax'}:fail('private_input')
        if any(parsed[k]!=0 or type(parsed[k])is not int for k in ('memoryBytes','swapBytes','cpuNanos'))or(parsed['memoryMax'],parsed['memoryHigh'],parsed['cpuMax'])!=('max','max','max 100000'):fail('private_input')
        return files,contract,parsed
    except RuntimeError:raise
    except BaseException:fail('private_input')

def write_new(path,raw,mode):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
    try:
        view=memoryview(raw)
        while view:
            count=os.write(fd,view)
            if count<=0:fail('stage_guard')
            view=view[count:]
        os.fchmod(fd,mode);os.fsync(fd)
    finally:os.close(fd)
    private(path,mode)

def fsync_dir(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
    try:os.fsync(fd)
    finally:os.close(fd)

def stage(files,contract,parsed):
    private(ROOT,0o700,True)
    if os.path.lexists(STAGE):fail('stage_exists')
    identity=source_fence(parsed) # before ANY dedicated file/directory publication
    STAGE.mkdir(mode=0o700);private(STAGE,0o700,True);fsync_dir(ROOT)
    for name,raw in files.items():write_new(STAGE/name,raw,0o400)
    write_new(STAGE/'source-contract.json',contract,0o600)
    write_new(STAGE/'journal.jsonl',b'',0o600);fsync_dir(STAGE)
    if set(p.name for p in STAGE.iterdir())!=set(FILES)|{'source-contract.json','journal.jsonl'}:fail('stage_guard')
    if source_fence(parsed)!=identity:fail('source_fence')
    return identity

PUBLIC_FIELDS={'event','at','phase','mode','reason','lockedBytes','qdrantPid','sourceStartTicks','sourceIdentitySha256','imageSha256','mountsSha256','dockerMemoryBytes','dockerSwapBytes','dockerCpuNanos','cgroupMemoryMaxUnlimited','cgroupMemoryHighUnlimited','cgroupCpuUnlimited','oomGroup','vmLockedBytes','parentOutsideSourceCgroup','holderPlacementVerified','holderPid','holderStartTicks','sourceRpcCount','released','gracefulReleaseAcknowledged','holderExited','exitCode','allocationUnchanged','children','queries','inventoryReads','archiveReads','modelReads'}
PUBLIC_ENUMS={'event':{'qdrant.zero-placement.v1','qdrant.zero-placement.failed.v1'},'phase':{'source_before','joined','exited','cleanup','source_after','complete'},'mode':{'close','term','kill'}}
def public_frame(raw):
    row=json.loads(raw)
    if type(row)is not dict or not set(row)<=PUBLIC_FIELDS or row.get('event')not in PUBLIC_ENUMS['event']:fail('invalid_public_frame')
    for key,value in row.items():
        if key in PUBLIC_ENUMS:
            if value not in PUBLIC_ENUMS[key]:fail('invalid_public_frame')
        elif key=='at':
            if type(value)is not str or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ',value):fail('invalid_public_frame')
        elif key.endswith('Sha256'):
            if type(value)is not str or not re.fullmatch('[a-f0-9]{64}',value):fail('invalid_public_frame')
        elif key=='holderExited':
            if type(value)is not bool:fail('invalid_public_frame')
        elif key=='reason':
            if value not in ALLOWED_CHILD_REASONS:fail('invalid_public_frame')
        elif value is not None and type(value)not in (bool,int):fail('invalid_public_frame')
    return row
ALLOWED_CHILD_REASONS=set() # Loaded only from verified staged reviewed module, never raw errors.


def child_arm(parent):
    kernel=ctypes.CDLL(None,use_errno=True)
    if kernel.prctl(1,signal.SIGTERM,0,0,0)!=0 or os.getppid()!=parent:os._exit(125)
    signal.signal(signal.SIGTERM,signal.SIG_DFL);signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGTERM})

def owned(pid,start):
    if pid in(SOURCE_PID,os.getpid())or pid<=1:fail('owned_exit_unproven')
    try:
        if ticks(pid)!=start:return None
        fd=os.pidfd_open(pid)
        if ticks(pid)!=start:os.close(fd);fail('owned_exit_unproven')
        return fd
    except FileNotFoundError:return None
    except ProcessLookupError:return None

def live(fd):return not select.select([fd],[],[],0)[0]
def send(fd,sig):
    try:signal.pidfd_send_signal(fd,sig)
    except ProcessLookupError:pass

def births():
    path=STAGE/'journal.jsonl';private(path,0o600)
    if path.stat().st_size>1048576:fail('owned_exit_unproven')
    raw=path.read_bytes()
    if len(raw)>1048576 or raw and not raw.endswith(b'\n'):fail('owned_exit_unproven')
    rows=[json.loads(line)for line in raw.splitlines()];found=[]
    for i,row in enumerate(rows,1):
        if row.get('schema')!='qdrant.helper-journal.v1'or row.get('sequence')!=i or any(row.get(k)!=v for k,v in [('codeSha256',CODE),('policySha256',CONTRACT),('serviceSha256',CODE)]):fail('owned_exit_unproven')
        data=row.get('data',{})
        if row.get('kind')=='helper.event'and data.get('phase')=='holder_started':
            pid=data.get('holderPid');start=data.get('holderStartTicks')
            if type(pid)is not int or type(start)is not int or pid<=1 or start<=0 or pid==SOURCE_PID or data.get('pidfdOwned')is not True or (pid,start)in found or len(found)>=3:fail('owned_exit_unproven')
            found.append((pid,start))
    return raw,found

def cleanup(process,pidfd):
    # Stop parent first so a final birth cannot race the census. Kernel PDEATHSIG
    # handles unregistered children, which cannot receive placement commands.
    if live(pidfd):send(pidfd,signal.SIGTERM)
    deadline=time.monotonic()+2
    while live(pidfd)and time.monotonic()<deadline:time.sleep(.02)
    if live(pidfd):send(pidfd,signal.SIGKILL)
    deadline=time.monotonic()+3
    while live(pidfd)and time.monotonic()<deadline:time.sleep(.02)
    parent_gone=not live(pidfd)
    if not parent_gone:return {'cliExited':False,'registeredHoldersExited':False,'unknownEarlyChildrenPossible':True}
    process.poll()
    raw,registered=births();allgone=True
    for pid,start in registered:
        fd=owned(pid,start)
        if fd is None:continue
        try:
            if live(fd):send(fd,signal.SIGKILL)
            deadline=time.monotonic()+2
            while live(fd)and time.monotonic()<deadline:time.sleep(.02)
            if live(fd):allgone=False
            else:
                try:os.waitpid(pid,os.WNOHANG)
                except ChildProcessError:pass
        finally:os.close(fd)
    # Reap only our adopted descendants. No broad waitpid(-1) or source signalling.
    return {'cliExited':True,'registeredHoldersExited':allgone,'registeredHolders':len(registered),'unknownEarlyChildrenPossible':True,'journalSha256':digest(raw)}

def run_cli(parsed):
    global ALLOWED_CHILD_REASONS
    sys.path.insert(0,str(STAGE));import zero_placement
    ALLOWED_CHILD_REASONS=zero_placement.REASONS|{'guard_or_runtime_failure'}
    if zero_placement.code_hash()!=CODE:fail('stage_guard')
    parent=os.getpid();process=None;fd=None;state=None;result=1;error=None
    try:
        process=subprocess.Popen([sys.executable,'-I','-B',str(STAGE/'zero_placement.py'),'--execute-reviewed','--contract',str(STAGE/'source-contract.json'),'--contract-sha256',CONTRACT,'--code-sha256',CODE,'--journal',str(STAGE/'journal.jsonl')],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,preexec_fn=lambda:child_arm(parent))
        start=ticks(process.pid);fd=owned(process.pid,start)
        if fd is None:fail('owned_exit_unproven')
        emit('cli_started',cliPid=process.pid,cliStartTicks=start,pidfdOwned=True)
        os.set_blocking(process.stdout.fileno(),False);pending=b'';deadline=time.monotonic()+110;count=0
        while True:
            if time.monotonic()>deadline:fail('outer_timeout')
            ready=select.select([process.stdout],[],[],.1)[0]
            if ready:
                chunk=os.read(process.stdout.fileno(),65536)
                if not chunk:break
                pending+=chunk
                if len(pending)>65536:fail('invalid_public_frame')
                while b'\n'in pending:
                    line,pending=pending.split(b'\n',1);count+=1
                    if count>64:fail('invalid_public_frame')
                    row=public_frame(line);print(json.dumps(row,sort_keys=True),flush=True)
            if process.poll()is not None and not ready:break
        if pending:fail('invalid_public_frame')
        result=process.wait(timeout=1)
        if result!=0:fail('cli_failed')
        if source_fence(parsed)!=INITIAL_IDENTITY:fail('source_fence')
    except BaseException as exc:
        error=str(exc)if type(exc)is RuntimeError and str(exc)in REASONS else 'runtime_failure'
    finally:
        if process is not None and fd is not None:
            try:state=cleanup(process,fd)
            except BaseException:state={'cliExited':not live(fd),'registeredHoldersExited':False,'unknownEarlyChildrenPossible':True}
            if state['cliExited']:os.close(fd)
            emit('cli_finished',cliExit=process.returncode,**state)
            if process.returncode==0 and state.get('registeredHolders')!=3:error='owned_exit_unproven'
            if not state['cliExited']or not state['registeredHoldersExited']:error='owned_exit_unproven'
        elif process is not None:error='owned_exit_unproven'
    if error:fail(error)
    return result
INITIAL_IDENTITY=None

def main(argv=None):
    global INITIAL_IDENTITY
    argv=sys.argv[1:]if argv is None else argv
    if not argv:emit('prepared',execution=False);return 0
    if argv!=['--execute-reviewed']:emit('failed',reason='private_input',execution=False);return 1
    if sys.version_info<(3,9)or os.geteuid()!=0:emit('failed',reason='version_or_owner');return 1
    def interrupted(_sig,_frame):fail('outer_interrupted')
    signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
    signal.signal(signal.SIGALRM,lambda *_:fail('outer_timeout'));signal.alarm(150)
    try:
        if signal.getsignal(signal.SIGCHLD)==signal.SIG_IGN:fail('version_or_owner')
        # Adopt ONLY this invocation's children for reaping; host/service state unchanged.
        if ctypes.CDLL(None,use_errno=True).prctl(36,1,0,0,0)!=0:fail('version_or_owner')
        files,raw,parsed=payload(sys.stdin.buffer.read(1048577))
        INITIAL_IDENTITY=stage(files,raw,parsed)
        emit('staged',codeSha256=CODE,contractSha256=CONTRACT,sourceIdentitySha256=INITIAL_IDENTITY,sourcePid=SOURCE_PID,sourceStartTicks=SOURCE_TICKS,execution=True)
        return run_cli(parsed)
    except BaseException as exc:
        value=str(exc)if type(exc)is RuntimeError and str(exc)in REASONS else 'runtime_failure'
        emit('failed',reason=value);return 1
    finally:signal.alarm(0)
if __name__=='__main__':raise SystemExit(main())
