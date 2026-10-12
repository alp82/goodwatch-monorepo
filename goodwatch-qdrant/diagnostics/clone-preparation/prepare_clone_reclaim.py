"""Prepared-only clone cache control. No search queries, lifecycle or resource edits."""
import sys
sys.dont_write_bytecode=True
import argparse,datetime,errno,fcntl,hashlib,json,os,re,resource,signal,stat,time,urllib.request
from pathlib import Path
STAGE=Path('/root/goodwatch-qdrant-cold-406-20261011/pin-control-20261012-406-v3')
REQUEST=3*1024**3
LIMIT_FILES=('memory.min','memory.low','memory.high','memory.max','memory.swap.max','cpu.max','io.max','pids.max')
SAFE={'source_changed','swap_present','locked_source_pages','dirty_source_pages','source_children_present','source_limits_changed','ancestor_limits_changed','parent_placement_changed','reclaim_fd_changed','reclaim_timeout','reclaim_writer_survived','reclaim_write_failed','reclaim_resource_event','post_cap_fit_inconclusive','metadata_health_changed','source_freeze_changed','invalid_reclaim_lock','prepared_input_changed','writer_start_failed','quiescence_bound_exceeded'}

def digest(data):return hashlib.sha256(data).hexdigest()
def at():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def reason(error):return str(error) if type(error) is RuntimeError and str(error) in (SAFE|WRITER_SAFE) else 'guard_or_runtime_failure'
def numbers(path):return {k:int(v) for k,v in (l.split() for l in path.read_text().splitlines())}
def pid_identity(pid):
 p=Path('/proc')/str(pid);s=(p/'stat').read_text();v=s[s.rfind(')')+2:].split()
 return int(v[19]),digest((p/'limits').read_bytes())
def limit_fingerprint(cgroup):
 rows=[]
 for parent in (cgroup,*cgroup.parents):
  if parent==Path('/sys/fs'):break
  for name in LIMIT_FILES:
   path=parent/name;rows.append((str(parent),name,path.read_text() if path.exists() else None))
 return digest(json.dumps(rows,sort_keys=True).encode())
def snapshot(c,source):
 if c.runtime.inspect_source(source.spec).identity!=source.identity:raise RuntimeError('source_changed')
 cg=source.cgroup
 if cg.resolve()!=cg or not cg.is_relative_to('/sys/fs/cgroup'):raise RuntimeError('source_changed')
 if any(p.is_dir() for p in cg.iterdir()):raise RuntimeError('source_children_present')
 mem=numbers(cg/'memory.stat');events=numbers(cg/'memory.events');cpu=numbers(cg/'cpu.stat')
 host={k.rstrip(':'):int(v.split()[0])*1024 for k,v in (l.split(maxsplit=1) for l in Path('/proc/meminfo').read_text().splitlines())}
 if host['SwapTotal'] or int((cg/'memory.swap.current').read_text()) or (cg/'memory.swap.max').read_text().strip()!='0':raise RuntimeError('swap_present')
 if mem['file_dirty'] or mem['file_writeback']:
  error=RuntimeError('dirty_source_pages');error.dirtyEvidence={'fileDirtyBytes':mem['file_dirty'],'fileWritebackBytes':mem['file_writeback']};raise error
 if mem['unevictable']:raise RuntimeError('locked_source_pages')
 processes=[]
 for pid in sorted(int(v) for v in(cg/'cgroup.procs').read_text().split()):
  p=Path('/proc')/str(pid);status={k:v.strip() for k,v in(l.split(':',1) for l in(p/'status').read_text().splitlines())}
  if int(status['VmLck'].split()[0]):raise RuntimeError('locked_source_pages')
  ticks,limits=pid_identity(pid);processes.append((pid,ticks,limits))
 if source.pid not in [p[0] for p in processes]:raise RuntimeError('source_changed')
 p=Path('/proc')/str(source.pid);s=(p/'stat').read_text();v=s[s.rfind(')')+2:].split();io={k.rstrip(':'):int(x) for k,x in(l.split() for l in(p/'io').read_text().splitlines())}
 account=c.daemon.account(c.runtime.accounting(source));selected=('anon','file','file_mapped','file_dirty','file_writeback','shmem','inactive_file','active_file','kernel','unevictable','pgfault','pgmajfault','workingset_refault_file','pgscan','pgsteal')
 return {'at':at(),'qdrantPid':source.pid,'sourceStartTicks':source.identity[3],'accounting':account,'memory':{k:mem[k] for k in selected},'memoryEvents':{k:events[k] for k in ('max','oom','oom_kill')},'cpu':{k:cpu[k] for k in('nr_throttled','throttled_usec')},'sourceProcessCount':len(processes),'sourceProcessFence':digest(json.dumps(processes).encode()),'ancestorLimitFence':limit_fingerprint(cg),'qdrantCounters':{'minorFaults':int(v[7]),'majorFaults':int(v[9]),'readBytes':io['read_bytes'],'writeBytes':io['write_bytes']},'hostSwapBytes':host['SwapTotal'],'cgroupSwapBytes':0}

def fence(before,after):
 if (before['qdrantPid'],before['sourceStartTicks'])!=(after['qdrantPid'],after['sourceStartTicks']):raise RuntimeError('source_changed')
 if before['sourceProcessFence']!=after['sourceProcessFence']:raise RuntimeError('source_limits_changed')
 if before['ancestorLimitFence']!=after['ancestorLimitFence']:raise RuntimeError('ancestor_limits_changed')
 for group in ('memoryEvents','cpu'):
  if any(after[group][k]!=before[group][k] for k in before[group]):raise RuntimeError('reclaim_resource_event')

def secure_lock(path):
 info=path.lstat()
 if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600:raise RuntimeError('invalid_reclaim_lock')
 fd=os.open(path,os.O_RDWR|os.O_NOFOLLOW)
 opened=os.fstat(fd)
 if (opened.st_dev,opened.st_ino)!=(info.st_dev,info.st_ino):os.close(fd);raise RuntimeError('invalid_reclaim_lock')
 try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BaseException:os.close(fd);raise
 return fd

def writer(fd,result_fd,prewrite=None):
 try:
  try:
   if prewrite is not None:prewrite()
  except BaseException as error:
   result={'outcome':'guard-failed','reason':reason(error),'writeAttempts':0}
  else:
   try:
    written=os.write(fd,str(REQUEST).encode());result={'outcome':'accepted','writtenBytes':written,'writeAttempts':1}
    if written!=len(str(REQUEST)):result={'outcome':'write-failed','errno':0,'writeAttempts':1}
   except OSError as error:result={'outcome':'under-reclaimed' if error.errno==errno.EAGAIN else 'write-failed','errno':error.errno if error.errno in (errno.EAGAIN,errno.EINVAL,errno.EPERM,errno.ENOENT,errno.EBADF) else 0,'writeAttempts':1}
  os.write(result_fd,json.dumps(result).encode())
 finally:os.close(fd);os.close(result_fd)



"""Prepared child ownership seam; no cgroup operation until its caller supplies one."""
import ctypes,hashlib,json,os,re,select,signal,stat,time
from pathlib import Path
RETAINED_WRITERS={}
WRITER_SAFE={'writer_birth_unavailable','writer_birth_changed','writer_registration_failed','writer_parent_changed','writer_interrupted','writer_cleanup_unproven','writer_protected_pids_required','writer_receipt_bound_exceeded','writer_guard_failed'}
def fixed_reason(error):return str(error) if type(error) is RuntimeError and str(error) in WRITER_SAFE else 'writer_guard_failed'
def identity(pid):
 path=Path('/proc')/str(pid);text=(path/'stat').read_text();parts=text[text.rfind(')')+2:].split()
 return {'pid':pid,'startTicks':int(parts[19]),'cmdlineSha256':hashlib.sha256((path/'cmdline').read_bytes()).hexdigest(),'exeSha256':hashlib.sha256(os.readlink(path/'exe').encode()).hexdigest(),'cgroupSha256':hashlib.sha256((path/'cgroup').read_bytes()).hexdigest()}
def same_birth(birth):return identity(birth['pid'])==birth

def arm_parent_death(parent):
 signal.signal(signal.SIGTERM,signal.SIG_DFL);signal.signal(signal.SIGINT,signal.SIG_DFL)
 signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGTERM,signal.SIGINT})
 libc=ctypes.CDLL(None,use_errno=True)
 if libc.prctl(1,signal.SIGTERM,0,0,0)!=0:raise RuntimeError('writer_registration_failed')
 if os.getppid()!=parent:raise RuntimeError('writer_parent_changed')

def receipt(directory,birth,parent,helper_sha256,target):
 if directory.resolve()!=directory:raise RuntimeError('writer_registration_failed')
 info=directory.lstat()
 if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)!=0o700:raise RuntimeError('writer_registration_failed')
 existing=sorted(directory.glob('reclaim-writer-*.json'))
 if len(existing)>=14:raise RuntimeError('writer_registration_failed')
 for previous in existing:read_record(previous,helper_sha256)
 opened=os.fstat(target)
 value={'schema':'owned-reclaim-writer-birth.v1','writer':birth,'parent':parent,'helperSha256':helper_sha256,'targetDevice':opened.st_dev,'targetInode':opened.st_ino,'targetFd':target,'writeAcknowledged':False}
 path=directory/f"reclaim-writer-{birth['pid']}-{birth['startTicks']}.json"
 fd=os.open(path,os.O_CREAT|os.O_EXCL|os.O_WRONLY|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb') as output:output.write((json.dumps(value,sort_keys=True)+'\n').encode());output.flush();os.fsync(output.fileno())
 folder=os.open(directory,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
 try:os.fsync(folder)
 finally:os.close(folder)
 return value

def bounded_owned_writer(target,operation,directory,helper_sha256,timeout=60,grace=5):
 """Birth receipt fsync and pidfd ownership precede ack; operation runs only in child."""
 if not hasattr(os,'pidfd_open') or not hasattr(signal,'pidfd_send_signal'):raise RuntimeError('writer_registration_failed')
 parent=identity(os.getpid());ack_read,ack_write=os.pipe();pid=None;pidfd=None;birth=None;gone=False;status=None;registered=False;interrupted=None;timed_out=False;fork_mask=None
 try:
  fork_mask=signal.pthread_sigmask(signal.SIG_BLOCK,{signal.SIGTERM,signal.SIGINT})
  pid=os.fork()
  if pid==0:
   try:
    os.close(ack_write)
    arm_parent_death(parent['pid'])
    if os.read(ack_read,1)!=b'1':os._exit(125)
    if os.getppid()!=parent['pid']:os._exit(125)
    operation(target)
    os._exit(0)
   except BaseException:os._exit(126)
  signal.pthread_sigmask(signal.SIG_SETMASK,fork_mask)
  os.close(ack_read);ack_read=None
  pidfd=os.pidfd_open(pid,0);birth=identity(pid)
  if birth['startTicks']<=0 or not same_birth(parent):raise RuntimeError('writer_birth_changed')
  receipt(directory,birth,parent,helper_sha256,target);registered=True
  os.write(ack_write,b'1');os.close(ack_write);ack_write=None
  deadline=time.monotonic()+timeout
  while time.monotonic()<deadline:
   observed,value=os.waitpid(pid,os.WNOHANG)
   if observed:gone=True;status=value;break
   time.sleep(.02)
  timed_out=not gone
 except BaseException as error:
  interrupted=error
 finally:
  old_mask=signal.pthread_sigmask(signal.SIG_BLOCK,{signal.SIGTERM,signal.SIGINT})
  if fork_mask is not None:old_mask=fork_mask
  # Force EOF for any unacknowledged child before bounded owned reap.
  if ack_write is not None:os.close(ack_write);ack_write=None
  # No broad PID signal: a live owned pidfd is mandatory even on failure.
  if pid is not None and not gone:
   for sig,seconds in ((signal.SIGTERM,grace),(signal.SIGKILL,grace)):
    if pidfd is None:
     deadline=time.monotonic()+grace
     while time.monotonic()<deadline:
      observed,value=os.waitpid(pid,os.WNOHANG)
      if observed:gone=True;status=value;break
      time.sleep(.02)
     break
    try:signal.pidfd_send_signal(pidfd,sig,None,0)
    except ProcessLookupError:pass
    deadline=time.monotonic()+seconds
    while time.monotonic()<deadline:
     observed,value=os.waitpid(pid,os.WNOHANG)
     if observed:gone=True;status=value;break
     time.sleep(.02)
    if gone:break
  if pidfd is not None and not gone:
   RETAINED_WRITERS[pid]={'pidfd':pidfd,'birth':birth};pidfd=None
  for fd in (ack_read,ack_write,pidfd):
   if fd is not None:os.close(fd)
  evidence={'schema':'owned-reclaim-writer-exit.v1','registeredBeforeWrite':registered,'writer':birth,'writerGone':gone,'writerExitObserved':gone,'writerExitCode':os.waitstatus_to_exitcode(status) if gone else None,'cleanupUnknown':not gone,'pidfdRetained':not gone and pid in RETAINED_WRITERS,'parentInterrupted':interrupted is not None,'timedOut':timed_out}
  pending=signal.sigpending()&{signal.SIGTERM,signal.SIGINT}
  deferred_count=0
  while pending:
   signal.sigwait(pending);deferred_count+=1;pending=signal.sigpending()&{signal.SIGTERM,signal.SIGINT}
  evidence['cleanupDeferredSignalsCount']=deferred_count
  if deferred_count and interrupted is None:interrupted=RuntimeError('writer_interrupted')
  if interrupted is not None:interrupted.writerEvidence=evidence
  try:signal.pthread_sigmask(signal.SIG_SETMASK,old_mask)
  except BaseException as late:
   late.writerEvidence=evidence
   if interrupted is None:interrupted=late
 if interrupted is not None:raise interrupted
 return evidence

def read_record(path,helper_sha256):
 """Outer adoption: metadata-only receipt/actual-process/target-FD identity proof."""
 if path.resolve()!=path:raise RuntimeError('writer_birth_changed')
 info=path.lstat()
 if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600 or info.st_size>4096:raise RuntimeError('writer_birth_changed')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
 try:
  opened=os.fstat(fd);raw=os.read(fd,4097);after=os.fstat(fd)
  if len(raw)!=opened.st_size or (opened.st_dev,opened.st_ino,opened.st_size,opened.st_mtime_ns)!=(info.st_dev,info.st_ino,info.st_size,info.st_mtime_ns) or (after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns)!=(opened.st_dev,opened.st_ino,opened.st_size,opened.st_mtime_ns) or (path.lstat().st_dev,path.lstat().st_ino)!=(opened.st_dev,opened.st_ino):raise RuntimeError('writer_birth_changed')
 finally:os.close(fd)
 value=json.loads(raw)
 if type(value) is not dict or set(value)!={'schema','writer','parent','helperSha256','targetDevice','targetInode','targetFd','writeAcknowledged'}:raise RuntimeError('writer_birth_changed')
 for birth in (value['writer'],value['parent']):
  if type(birth) is not dict or set(birth)!={'pid','startTicks','cmdlineSha256','exeSha256','cgroupSha256'} or any(type(birth[k]) is not int or birth[k]<=0 for k in ('pid','startTicks')) or any(type(birth[k]) is not str or not re.fullmatch('[a-f0-9]{64}',birth[k]) for k in ('cmdlineSha256','exeSha256','cgroupSha256')):raise RuntimeError('writer_birth_changed')
 if any(type(value[k]) is not int or value[k]<0 for k in ('targetDevice','targetInode','targetFd')) or value['targetInode']<=0 or value['targetFd']<3 or value['writeAcknowledged'] is not False:raise RuntimeError('writer_birth_changed')
 if value['schema']!='owned-reclaim-writer-birth.v1' or value['helperSha256']!=helper_sha256 or path.name!=f"reclaim-writer-{value['writer']['pid']}-{value['writer']['startTicks']}.json":raise RuntimeError('writer_birth_changed')
 return value

def open_recorded_writer(path,helper_sha256,protected_pids=()):
 if not protected_pids or any(type(pid) is not int or pid<=0 for pid in protected_pids):raise RuntimeError('writer_protected_pids_required')
 value=read_record(path,helper_sha256)
 if value['writer']['pid'] in {os.getpid(),value['parent']['pid'],*protected_pids}:raise RuntimeError('writer_birth_changed')
 try:
  current=identity(value['writer']['pid'])
  if current['startTicks']!=value['writer']['startTicks']:return None,value
  if current!=value['writer']:raise RuntimeError('writer_birth_changed')
 except FileNotFoundError:return None,value
 pidfd=os.pidfd_open(value['writer']['pid'],0)
 try:
  if select.select([pidfd],[],[],0)[0]:return pidfd,value
  if not same_birth(value['writer']):raise RuntimeError('writer_birth_changed')
  target=Path('/proc')/str(value['writer']['pid'])/'fd'/str(value['targetFd']);info=target.stat()
  if (info.st_dev,info.st_ino)!=(value['targetDevice'],value['targetInode']):raise RuntimeError('writer_birth_changed')
 except BaseException:
  RETAINED_WRITERS.setdefault(value['writer']['pid'],{'birth':value['writer'],'pidfd':pidfd,'additionalPidfds':[]})
  if RETAINED_WRITERS[value['writer']['pid']]['pidfd']!=pidfd:RETAINED_WRITERS[value['writer']['pid']]['additionalPidfds'].append(pidfd)
  raise
 return pidfd,value

def cleanup_recorded_writer(path,helper_sha256,grace=5,protected_pids=()):
 """Never calls waitpid for an adopted non-child; pidfd readiness proves actual exit."""
 pidfd,value=open_recorded_writer(path,helper_sha256,protected_pids)
 if pidfd is None:return {'writerExitObserved':True,'writerGone':True,'proof':'recorded-birth-absent','cleanupUnknown':False}
 try:
  if select.select([pidfd],[],[],0)[0]:return {'writerExitObserved':True,'writerGone':True,'proof':'recorded-pidfd-exited','cleanupUnknown':False}
  for sig in (signal.SIGTERM,signal.SIGKILL):
   try:signal.pidfd_send_signal(pidfd,sig,None,0)
   except ProcessLookupError:
    if select.select([pidfd],[],[],0)[0]:return {'writerExitObserved':True,'writerGone':True,'proof':'recorded-pidfd-exited','cleanupUnknown':False}
   if select.select([pidfd],[],[],grace)[0]:return {'writerExitObserved':True,'writerGone':True,'proof':'recorded-pidfd-exited','cleanupUnknown':False}
  RETAINED_WRITERS[value['writer']['pid']]={'pidfd':pidfd,'birth':value['writer']};pidfd=None
  return {'writerExitObserved':False,'writerGone':False,'proof':'recorded-pidfd-unknown','cleanupUnknown':True,'pidfdRetained':True}
 finally:
  if pidfd is not None:os.close(pidfd)

def census_recorded_writers(directory,helper_sha256,protected_pids,cleanup=False,max_records=14):
 """Continues owned cleanup after stale/malformed records; unknown always blocks proof."""
 info=directory.lstat()
 if directory.resolve()!=directory or not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)!=0o700 or max_records!=14 or not protected_pids:raise RuntimeError('writer_birth_changed')
 paths=sorted(directory.glob('reclaim-writer-*.json'));bound_failed=len(paths)>max_records
 results=[]
 for path in paths[:2*max_records]:
  try:
   if not re.fullmatch(r'reclaim-writer-[1-9][0-9]*-[1-9][0-9]*\.json',path.name):raise RuntimeError('writer_birth_changed')
   if cleanup:result=cleanup_recorded_writer(path,helper_sha256,protected_pids=protected_pids)
   else:
    pidfd,value=open_recorded_writer(path,helper_sha256,protected_pids)
    exited=pidfd is None or bool(select.select([pidfd],[],[],0)[0])
    result={'writerExitObserved':exited,'writerGone':exited,'cleanupUnknown':not exited}
    if pidfd is not None:
     if exited:os.close(pidfd)
     else:
      RETAINED_WRITERS.setdefault(value['writer']['pid'],{'pidfd':pidfd,'birth':value['writer'],'additionalPidfds':[]})
      if RETAINED_WRITERS[value['writer']['pid']]['pidfd']!=pidfd:RETAINED_WRITERS[value['writer']['pid']]['additionalPidfds'].append(pidfd)
  except BaseException as error:result={'writerExitObserved':False,'writerGone':False,'cleanupUnknown':True,'reason':fixed_reason(error)}
  results.append(result)
 if bound_failed:results.append({'writerExitObserved':False,'writerGone':False,'cleanupUnknown':True,'reason':'writer_receipt_bound_exceeded'})
 return {'receiptCount':len(paths),'recordedWritersGone':not bound_failed and all(r['writerGone'] for r in results),'recordedWriterResults':results,'unknownUnregisteredChildrenProvenGone':False}


def bounded_write(fd,timeout=60,prewrite=None,receipt_directory=None):
 read_fd,write_fd=os.pipe();result=None
 try:
  directory=receipt_directory if receipt_directory is not None else Path(__file__).parent
  def operation(target):
   os.close(read_fd);writer(target,write_fd,prewrite)
  evidence=bounded_owned_writer(fd,operation,directory,hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),timeout=timeout)
  os.close(write_fd);write_fd=None
  raw=os.read(read_fd,4096) if evidence['writerGone'] else b''
  result=json.loads(raw) if raw else {'outcome':'timeout' if evidence['timedOut'] else 'write-failed','writeAttempts':None}
  result.update(evidence);result['requestedBytes']=REQUEST;result['writerPid']=evidence['writer']['pid'] if evidence['writer'] else None
  return result
 finally:
  os.close(fd)
  if write_fd is not None:os.close(write_fd)
  os.close(read_fd)


def health(c,source):
 with urllib.request.urlopen('http://127.0.0.1:16333/collections/media_fingerprint_v1',timeout=5) as response:
  raw=response.read(1024*1024+1)
 if len(raw)>1024*1024:raise RuntimeError('metadata_health_changed')
 result=json.loads(raw)['result']
 if result['status']!='green' or result['optimizer_status']!='ok' or result['points_count']!=244262 or result['segments_count']!=12 or result['config']['params']['shard_number']!=6:raise RuntimeError('metadata_health_changed')
 return {'green':True,'optimizerOk':True,'points':244262,'segments':12,'shards':c.guard_shards(source)}

def cap_fit(measured,current,reserve):
 missing=0
 for kind in ('vector','graph','sparse','other'):
  values=measured['classesMeasured'][kind]
  if values['files']<=0 or values['dataPages']<=0 or not 0<=values['residentDataPages']<=values['dataPages']:raise RuntimeError('post_cap_fit_inconclusive')
  missing+=(values['dataPages']-values['residentDataPages'])*measured['pageBytes']
 out={'currentBytes':current['currentBytes'],'missingSelectedBytes':missing,'reserveBytes':reserve,'capBytes':current['cgroupMaxBytes']}
 if current['cgroupMaxBytes']!=6*1024**3 or current['currentBytes']+missing+reserve>current['cgroupMaxBytes']:raise RuntimeError('post_cap_fit_inconclusive')
 return out


def require_held_control_lock(c,fd):
 info=os.fstat(fd);path=c.ROOT/'control.lock';current=path.lstat()
 if path.resolve()!=path or not stat.S_ISREG(info.st_mode) or info.st_uid!=os.geteuid() or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600 or (info.st_dev,info.st_ino)!=(current.st_dev,current.st_ino):raise RuntimeError('invalid_reclaim_lock')
 records=(Path('/proc/self/fdinfo')/str(fd)).read_text().splitlines()
 for line in records:
  match=re.fullmatch(r'lock:\s+\d+:\s+FLOCK\s+ADVISORY\s+WRITE\s+(\d+)\s+([0-9a-fA-F]+):([0-9a-fA-F]+):(\d+)\s+0\s+EOF',line)
  if match and (int(match[1]),int(match[2],16),int(match[3],16),int(match[4]))==(os.getpid(),os.major(info.st_dev),os.minor(info.st_dev),info.st_ino):return
 raise RuntimeError('invalid_reclaim_lock')


def quiescent_snapshot(c,source,seconds=0,clock=time.monotonic,sleep=time.sleep):
 if seconds not in (0,60):raise RuntimeError('prepared_input_changed')
 start=clock();attempts=0;last=None
 while True:
  attempts+=1
  try:
   state=snapshot(c,source)
   if seconds and clock()-start>seconds:raise RuntimeError('quiescence_bound_exceeded')
   return state,{'budgetSeconds':seconds,'samples':attempts,'seconds':round(clock()-start,3),'fileDirtyBytes':0,'fileWritebackBytes':0,'zeroDirtyAndWriteback':True}
  except RuntimeError as error:
   if str(error)!='dirty_source_pages':raise
   last=getattr(error,'dirtyEvidence',None)
   elapsed=clock()-start
   if seconds==0 or elapsed>=seconds:
    error.quiescenceEvidence={'budgetSeconds':seconds,'samples':attempts,'seconds':round(elapsed,3),'zeroDirtyAndWriteback':False,**(last or {})};raise
   sleep(min(.25,seconds-elapsed))


def under_control_lock(c,config,spec,policy,lock_fd,quiescence_seconds=0,raise_own_nofile=False):
 """One clone request under an already-held verified control lock; never reacquires it."""
 directory=None;target=None;output={'schema':'owned-clone-reclaim-preparation.v1','queries':0,'pinning':False,'archiveBytesRead':0,'fileCacheAdvice':False,'lifecycleChanges':0,'sourceResourceLimitWrites':0,'productionBackupEquivalent':False}
 try:
  require_held_control_lock(c,lock_fd)
  c.frozen_helper(config);container=c.inspect_stopped_or_running(spec);output['ownedAllocatedBytes']=c.owned_total_budget()
  source=c.runtime.inspect_source(spec);parent_group=c.self_cgroup()
  if parent_group==source.cgroup_relative:raise RuntimeError('parent_placement_changed')
  allowed_pids={source.pid,container['State']['Pid']}
  if set(int(v) for v in(source.cgroup/'cgroup.procs').read_text().split())!=allowed_pids:raise RuntimeError('source_changed')
  output['healthBefore']=health(c,source)
  initial=c.runtime.measure_source(spec,raise_own_nofile=raise_own_nofile);output['initialMeasurement']=c.daemon.public_measure(initial)
  output['before'],output['quiescence']=quiescent_snapshot(c,source,quiescence_seconds)
  # Opening only the exact guarded cgroup directory and its write-only reclaim file.
  directory=os.open(source.cgroup,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);directory_identity=os.fstat(directory)
  target=os.open('memory.reclaim',os.O_WRONLY|os.O_NOFOLLOW,dir_fd=directory);identity=os.fstat(target)
  current=os.stat('memory.reclaim',dir_fd=directory,follow_symlinks=False)
  if (identity.st_dev,identity.st_ino)!=(current.st_dev,current.st_ino):raise RuntimeError('reclaim_fd_changed')
  immediate=snapshot(c,source);fence(output['before'],immediate)
  if c.self_cgroup()!=parent_group or source.cgroup.stat().st_ino!=directory_identity.st_ino:raise RuntimeError('parent_placement_changed')
  def prewrite():
   c.runtime.validate_source_locally(source)
   current=os.stat('memory.reclaim',dir_fd=directory,follow_symlinks=False)
   if (current.st_dev,current.st_ino)!=(identity.st_dev,identity.st_ino) or source.cgroup.stat().st_ino!=directory_identity.st_ino:raise RuntimeError('reclaim_fd_changed')
   fence(output['before'],snapshot(c,source))
   if c.self_cgroup()!=parent_group:raise RuntimeError('parent_placement_changed')
  owned_target=target;target=None;output['writer']=bounded_write(owned_target,prewrite=prewrite)
  output['after']=snapshot(c,source);fence(output['before'],output['after'])
  if not output['writer']['writerGone']:raise RuntimeError('reclaim_writer_survived')
  if output['writer']['timedOut']:raise RuntimeError('reclaim_timeout')
  if output['writer']['outcome']=='guard-failed':raise RuntimeError(output['writer']['reason'])
  if output['writer']['outcome'] not in ('accepted','under-reclaimed'):raise RuntimeError('reclaim_write_failed')
  measured=c.runtime.measure_source(spec,raise_own_nofile=raise_own_nofile);output['measurement']=c.daemon.public_measure(measured)
  if measured['selectionHash']!=initial['selectionHash']:raise RuntimeError('source_changed')
  output['final']=snapshot(c,source);fence(output['before'],output['final']);output['healthAfter']=health(c,source)
  current=output['final']['accounting'];output['postCapFit']=cap_fit(measured,current,policy.cap_reserve_bytes)
  c.host_available(max(policy.emergency_bytes,policy.reserve_bytes+policy.cap_reserve_bytes));c.frozen_helper(config)
  if c.self_cgroup()!=parent_group:raise RuntimeError('parent_placement_changed')
  require_held_control_lock(c,lock_fd)
  output['stage']='prepared-headroom-measured';return output
 except BaseException as error:
  output.update({'stage':'failed','reason':reason(error),'privateErrorOmitted':True})
  if hasattr(error,'writerEvidence'):output['writerFailure']=error.writerEvidence
  if hasattr(error,'dirtyEvidence'):output['dirtyEvidence']=error.dirtyEvidence
  if hasattr(error,'quiescenceEvidence'):output['quiescence']=error.quiescenceEvidence
  error.reclaimEvidence=output;raise
 finally:
  if target is not None:os.close(target)
  if directory is not None:os.close(directory)


def run(c,config,spec,policy,emit):
 locks=[]
 try:
  locks.append(secure_lock(c.ROOT/'control.lock'))
  if (STAGE/'pin-instance.lock').exists():locks.append(secure_lock(STAGE/'pin-instance.lock'))
  output=under_control_lock(c,config,spec,policy,locks[0],raise_own_nofile=True);emit(output);return 0
 except BaseException as error:
  output=getattr(error,'reclaimEvidence',{'schema':'owned-clone-reclaim-preparation.v1','stage':'failed','reason':reason(error),'privateErrorOmitted':True,'queries':0})
  emit(output);return 1
 finally:
  for fd in reversed(locks):os.close(fd)


def main(argv=None):
 parser=argparse.ArgumentParser();parser.add_argument('--execute-reviewed',action='store_true');parser.add_argument('--script-sha256');parser.add_argument('--controller-sha256');parser.add_argument('--policy-sha256');args=parser.parse_args(argv);emit=lambda v:print(json.dumps(v,sort_keys=True),flush=True)
 if not args.execute_reviewed:emit({'stage':'prepared-only','execution':False});return 0
 try:
  if args.script_sha256!=digest(Path(__file__).read_bytes()):raise RuntimeError('prepared_input_changed')
  if STAGE.resolve()!=STAGE or stat.S_IMODE(STAGE.stat().st_mode)!=0o700 or STAGE.stat().st_uid!=0 or any(STAGE.glob('*.pyc')) or (STAGE/'__pycache__').exists():raise RuntimeError('source_freeze_changed')
  if args.controller_sha256!=digest((STAGE/'controller.py').read_bytes()):raise RuntimeError('source_freeze_changed')
  for name in ('controller.py','pin.py','runtime.py','daemon.py','helper-config.json','controller-config.json'):
   info=(STAGE/name).lstat()
   if not stat.S_ISREG(info.st_mode) or info.st_uid!=0 or info.st_nlink!=1 or stat.S_IMODE(info.st_mode)!=0o600:raise RuntimeError('source_freeze_changed')
  sys.path.insert(0,str(STAGE));import controller as c
  if Path(c.__file__).resolve()!=STAGE/'controller.py':raise RuntimeError('source_freeze_changed')
  config,spec,policy=c.load_control(STAGE/'controller-config.json',args.policy_sha256,args.controller_sha256)
  return run(c,config,spec,policy,emit)
 except BaseException as error:emit({'stage':'failed','reason':reason(error),'privateErrorOmitted':True});return 1
if __name__=='__main__':raise SystemExit(main())
