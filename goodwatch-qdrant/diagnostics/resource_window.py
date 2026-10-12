"""Prepared read-only resource window. No file-data/FUSE scan or runtime mutation."""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import threading
import time

IMAGE = 'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
ROW_BYTES = 8192
MAX_GAP_SECONDS = 3
ROWS = 1500
OUTPUT_BYTES = 16 * 1024**2
MEM = ('MemTotal','MemFree','MemAvailable','Buffers','Cached','Active(file)',
       'Inactive(file)','Dirty','Writeback','WritebackTmp','Mlocked','Unevictable',
       'AnonPages','Shmem','SReclaimable','SUnreclaim','KernelStack','PageTables',
       'SwapTotal','SwapFree')
STAT = ('anon','file','kernel','shmem','file_dirty','file_writeback','unevictable',
        'pagetables','sock','active_file','inactive_file')
VM = ('allocstall_dma','allocstall_dma32','allocstall_normal','allocstall_movable',
      'allocstall_device','pgscan_direct','pgsteal_direct','pgscan_file',
      'pgsteal_file','workingset_refault_file','pswpin','pswpout')
EVENTS = ('max','high','oom','oom_kill')
CPU = ('nr_throttled','throttled_usec','usage_usec')
RSS = ('VmRSS','RssAnon','RssFile','RssShmem','VmSwap')
SAFE = {'missing_required','invalid_numeric','source_changed','source_limits_changed',
        'source_config_check_failed','source_config_check_stale','census_bound',
        'output_bound','sample_bound','window_invalid','source_preflight_required',
        'backup_identity_required','sample_failed','source_check_exit_unproven',
        'source_cgroup_scope_invalid','sample_cadence_incomplete','source_locked'}


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


def read(path, size=65536):
    with Path(path).open('rb') as stream:
        value = stream.read(size+1)
    if len(value)>size:
        raise ValueError('census_bound')
    return value.decode()


def natural(value):
    if not re.fullmatch(r'[0-9]{1,20}',value) or int(value)>2**64-1:
        raise ValueError('invalid_numeric')
    return int(value)


def fields(text, names, kib=False):
    out={}
    for line in text.splitlines():
        parts=line.replace(':','').split()
        if parts and parts[0] in names:
            if parts[0] in out or len(parts)!=(3 if kib else 2) or (kib and parts[2]!='kB'):
                raise ValueError('invalid_numeric')
            out[parts[0]]=natural(parts[1])*(1024 if kib else 1)
    if set(out)!=set(names):
        raise ValueError('missing_required')
    return out


def psi(text):
    out={}
    for line in text.splitlines():
        parts=line.split()
        if not parts or parts[0] not in ('some','full'):
            continue
        if parts[0] in out:
            raise ValueError('invalid_numeric')
        pairs=dict(v.split('=',1)for v in parts[1:])
        value=float(pairs['avg10'])
        if not math.isfinite(value)or not 0<=value<=100:
            raise ValueError('invalid_numeric')
        out[parts[0]]={'avg10':value,'total':natural(pairs['total'])}
    if set(out)!={'some','full'}:
        raise ValueError('missing_required')
    return out


def proc_identity(root):
    text=read(root/'stat',8192)
    parts=text[text.rfind(')')+2:].split()
    return {'startTicks':natural(parts[19]),'parentPid':natural(parts[1]),
            'minorFaults':natural(parts[7]),'majorFaults':natural(parts[9]),
            'rssBytes':natural(parts[21])*os.sysconf('SC_PAGE_SIZE')}


def group_path(proc, pid, cgroot, allow_root=False):
    values=[v[3:]for v in read(proc/str(pid)/'cgroup',8192).splitlines()if v.startswith('0::/')]
    if len(values)!=1 or '..'in Path(values[0]).parts:
        raise ValueError('source_cgroup_scope_invalid')
    path=cgroot/values[0].lstrip('/')
    if not path.resolve().is_relative_to(cgroot.resolve()) or (path==cgroot and not allow_root):
        raise ValueError('source_cgroup_scope_invalid')
    return path


def limits(path):
    result={}
    for name in ('memory.max','memory.high','memory.swap.max','cpu.max','memory.oom.group'):
        value=read(path/name,128).strip()
        if not re.fullmatch(r'(?:max|[0-9]+)(?: [0-9]+)?',value):
            raise ValueError('invalid_numeric')
        result[name]=value
    return result


def ancestors(group,cgroot):
    rows=[]
    for parent in (group,*group.parents):
        if not parent.is_relative_to(cgroot):
            break
        row={name:read(parent/name,128).strip()for name in
             ('memory.max','memory.high','memory.swap.max','cpu.max')if(parent/name).exists()}
        rows.append((str(parent.relative_to(cgroot)),row))
        if parent==cgroot:
            break
    return digest(rows)


def command(args):
    # Values remain in memory. No Docker error text, env, logs, or command line is emitted.
    result=subprocess.run(['/usr/bin/docker',*args],stdout=subprocess.PIPE,
                          stderr=subprocess.DEVNULL,timeout=2,check=True)
    if len(result.stdout)>65536:
        raise ValueError('census_bound')
    return result.stdout.decode()


def docker_frame(proc):
    template='{"id":"{{.Id}}","image":"{{.Image}}","running":{{.State.Running}},"mounts":{{json .Mounts}},"memory":{{.HostConfig.Memory}},"swap":{{.HostConfig.MemorySwap}},"cpu":{{.HostConfig.NanoCpus}}}'
    raw=json.loads(command(['inspect','--format',template,'qdrant-main']))
    if raw['image']!=IMAGE or raw['running']is not True or any(raw[k]!=0 for k in ('memory','swap','cpu')):
        raise ValueError('source_changed')
    mounts=sorted((m['Source'],m['Destination'],m['Type'],m['RW'])for m in raw['mounts'])
    if not 1<=len(mounts)<=8:
        raise ValueError('source_changed')
    lines=command(['top','qdrant-main','-eo','pid,comm']).splitlines()[1:]
    pids=[natural(p[0])for line in lines if len(p:=line.split())==2 and p[1]=='qdrant']
    if len(pids)!=1:
        raise ValueError('source_changed')
    pid=pids[0];identity=proc_identity(proc/str(pid))
    return {'containerId':raw['id'],'image':raw['image'],'pid':pid,
            'startTicks':identity['startTicks'],'mounts':mounts,'allocation':[0,0,0]}


class ConfigCheck:
    """Slow Docker inspection is outside the numeric sampling path."""
    def __init__(self,expected,inspect,clock=time.monotonic):
        self.expected,self.inspect,self.clock=expected,inspect,clock
        self.last=clock();self.failed=False;self.stop=threading.Event()
        self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start()
    def run(self):
        while not self.stop.wait(10):
            try:
                if self.inspect()!=self.expected:
                    self.failed=True;return
                self.last=self.clock()
            except Exception:
                self.failed=True;return
    def verify(self):
        if self.failed:
            raise ValueError('source_config_check_failed')
        if self.clock()-self.last>16:
            raise ValueError('source_config_check_stale')
    def close(self):
        self.stop.set();self.thread.join(5)
        if self.thread.is_alive():
            raise ValueError('source_check_exit_unproven')


def process_census(proc, backup_hash, clock=time.monotonic):
    begun=clock();nodes=list(proc.glob('[0-9]*'))
    if len(nodes)>4096:
        raise ValueError('census_bound')
    processes={};jobs=[];races=0
    for node in nodes:
        if clock()-begun>1:
            raise ValueError('census_bound')
        try:
            comm=read(node/'comm',128).strip()
            # Only fixed executable/path-shape hashes are retained; args never leave memory.
            args=read(node/'cmdline',8192).split('\0') if comm in ('python','python3','uv') else []
            isbackup=any(v.startswith('/')and v.endswith('/backup.py')and hashlib.sha256(v.encode()).hexdigest()==backup_hash for v in args)
            if comm not in ('sshfs','ssh')and not isbackup:
                continue
            identity=proc_identity(node)
            if isbackup:
                jobs.append((int(node.name),identity['startTicks']))
            if comm in ('sshfs','ssh'):
                processes[int(node.name)]={'comm':comm,'identity':identity,'memory':fields(read(node/'status'),RSS,True)}
            if proc_identity(node)['startTicks']!=identity['startTicks'] or read(node/'comm',128).strip()!=comm:
                raise ValueError('census_bound')
        except FileNotFoundError:
            # Keep recording source/host resources but never call this census complete.
            races+=1
            processes.pop(int(node.name),None)
            jobs=[job for job in jobs if job[0]!=int(node.name)]
    if len(processes)>64:
        raise ValueError('census_bound')
    classes={name:{'processCount':0,'bytes':{k:0 for k in RSS}}for name in ('sshfs','sshfs-child-ssh','other-ssh')}
    identities=[]
    for pid,item in processes.items():
        parent=item['identity']['parentPid'];linked=False;seen=set()
        while parent in processes and parent not in seen:
            seen.add(parent)
            if processes[parent]['comm']=='sshfs':
                linked=True;break
            parent=processes[parent]['identity']['parentPid']
        kind='sshfs'if item['comm']=='sshfs'else('sshfs-child-ssh'if linked else 'other-ssh')
        classes[kind]['processCount']+=1
        for key,value in item['memory'].items():
            classes[kind]['bytes'][key]+=value
        identities.append((pid,item['identity']['startTicks'],kind))
    return {'classes':classes,'identityHash':digest(identities),'complete':races==0,
            'disappearedDuringCensus':races,
            'backup':{'count':len(jobs),'running':bool(jobs),'identityHash':digest(jobs),'complete':races==0},
            'rssAccountingExact':False}


def siblings(group,clock=time.monotonic):
    begun=clock();items=list(group.parent.iterdir());values={k:0 for k in STAT};current=0;cohort=[]
    if len(items)>256:
        raise ValueError('census_bound')
    for child in items:
        if clock()-begun>1:
            raise ValueError('census_bound')
        if child==group or not child.is_dir():
            continue
        if child.is_symlink():
            raise ValueError('source_cgroup_scope_invalid')
        stat=child.stat();row=fields(read(child/'memory.stat'),STAT)
        current+=natural(read(child/'memory.current',128).strip())
        for key,value in row.items():
            values[key]+=value
        cohort.append((stat.st_dev,stat.st_ino))
    return {'childCount':len(cohort),'currentBytes':current,'memory':values,
            'identityHash':digest(sorted(cohort)),'complete':True,
            'scope':'direct-source-parent-siblings-hierarchical-no-descendant-double-sum',
            'otherHostBranchesMeasured':False}


class Source:
    def __init__(self,expected_hash,backup_hash,proc=Path('/proc'),cgroot=Path('/sys/fs/cgroup')):
        self.proc,self.cgroot,self.backup_hash=proc,cgroot,backup_hash
        self.expected=docker_frame(proc)
        if digest(self.expected)!=expected_hash:
            raise ValueError('source_changed')
        self.group=group_path(proc,self.expected['pid'],cgroot)
        self.expected_limits=limits(self.group);self.ancestor_hash=ancestors(self.group,cgroot)
        if self.expected_limits['memory.max']!='max'or self.expected_limits['memory.high']!='max'or self.expected_limits['cpu.max']!='max 100000'or self.expected_limits['memory.oom.group']!='0':
            raise ValueError('source_limits_changed')
        self.reader_pid=os.getpid()
        self.reader_group=group_path(proc,self.reader_pid,cgroot,allow_root=True)
        self.check=ConfigCheck(self.expected,lambda:docker_frame(proc))
    def fence(self):
        self.check.verify();pid=self.expected['pid'];root=self.proc/str(pid)
        if read(root/'comm',128).strip()!='qdrant'or Path(os.readlink(root/'exe')).name!='qdrant'or proc_identity(root)['startTicks']!=self.expected['startTicks']or group_path(self.proc,pid,self.cgroot)!=self.group:
            raise ValueError('source_changed')
        if limits(self.group)!=self.expected_limits or ancestors(self.group,self.cgroot)!=self.ancestor_hash:
            raise ValueError('source_limits_changed')
    def reader_proof(self):
        group=group_path(self.proc,self.reader_pid,self.cgroot,allow_root=True)
        locked=fields(read(self.proc/str(self.reader_pid)/'status'),('VmLck',),True)['VmLck']
        outside=group!=self.group and not group.is_relative_to(self.group)
        if group!=self.reader_group or not outside or locked:
            raise ValueError('source_locked')
        return {'outsideSourceCgroup':True,'VmLckBytes':0,'placementUnchanged':True,
                'groupHash':digest(str(group))}
    def group_read(self):
        pids=[natural(v)for v in read(self.group/'cgroup.procs',8192).split()]
        if len(pids)>64 or len(set(pids))!=len(pids) or self.expected['pid'] not in pids:
            raise ValueError('census_bound')
        locked=sum(fields(read(self.proc/str(pid)/'status'),('VmLck',),True)['VmLck']for pid in pids)
        return {'currentBytes':natural(read(self.group/'memory.current',128).strip()),
                'memory':fields(read(self.group/'memory.stat'),STAT),
                'events':fields(read(self.group/'memory.events.local'),EVENTS),
                'cpu':fields(read(self.group/'cpu.stat'),CPU),
                'swapBytes':natural(read(self.group/'memory.swap.current',128).strip()),
                'memoryPsi':psi(read(self.group/'memory.pressure')),
                'ioPsi':psi(read(self.group/'io.pressure')),
                'processCount':len(pids),'processVmLckBytes':locked,'processMembershipHash':digest(sorted(pids))}
    def sample(self):
        begun=time.monotonic();started=stamp();self.fence()
        reader_before=self.reader_proof();group_before=self.group_read();pid=self.expected['pid'];root=self.proc/str(pid)
        process={**proc_identity(root),'readBytes':fields(read(root/'io').replace(':',''),('read_bytes',))['read_bytes'],'VmLck':fields(read(root/'status'),('VmLck',),True)['VmLck']}
        host=fields(read(self.proc/'meminfo'),MEM,True)
        if host['SwapTotal']!=0:
            raise ValueError('source_limits_changed')
        pressure={'memory':psi(read(self.proc/'pressure/memory')),'io':psi(read(self.proc/'pressure/io'))}
        reclaim=fields(read(self.proc/'vmstat'),VM)
        try: userspace=process_census(self.proc,self.backup_hash)
        except Exception as error:
            userspace={'complete':False,'reason':str(error)if str(error)in SAFE else 'sample_failed'}
        try: other=siblings(self.group)
        except Exception as error:
            other={'complete':False,'reason':str(error)if str(error)in SAFE else 'sample_failed'}
        group_after=self.group_read();reader_after=self.reader_proof();self.fence()
        if group_before['processMembershipHash']!=group_after['processMembershipHash']:
            raise ValueError('source_changed')
        if group_before['processVmLckBytes'] or group_after['processVmLckBytes'] or process['VmLck']:
            raise ValueError('source_locked')
        return {'startedAt':started,'finishedAt':stamp(),'durationSeconds':time.monotonic()-begun,
                'readerBefore':reader_before,'readerAfter':reader_after,
                'host':host,'hostPsi':pressure,'hostReclaim':reclaim,'process':process,
                'sourceBefore':group_before,'sourceAfter':group_after,
                'sshUserspace':userspace,'otherCgroups':other,'sourcePid':pid,
                'sourceStartTicks':self.expected['startTicks'],'sourceIdentityHash':digest(self.expected),
                'ancestorLimitHash':self.ancestor_hash,'sourceGroupHash':digest(str(self.group)),
                'metadataOnly':True,'archiveResidentBytesMeasured':False}
    def finish(self):
        self.fence();before=self.group_read();reader=self.reader_proof()
        after=self.group_read();self.fence()
        if before['processMembershipHash']!=after['processMembershipHash']:
            raise ValueError('source_changed')
        if before['processVmLckBytes'] or after['processVmLckBytes']:
            raise ValueError('source_locked')
        return {'reader':reader,'sourceMembershipHash':after['processMembershipHash'],
                'sourceProcessVmLckBytes':0,'sourceIdentityHash':digest(self.expected)}
    def close(self):
        self.check.close()


def schedule_metadata(text, system_offset_seconds, system_utc):
    """Only schedule/timezone metadata escapes; entire commands remain private."""
    jobs=[];cron_tz=None;app_tz=None
    for line in text.splitlines():
        value=line.strip()
        if not value or value.startswith('#'):
            continue
        if value.startswith('CRON_TZ='):
            cron_tz=value.split('=',1)[1].strip().strip('\"\'')
            continue
        if value.startswith('TZ='):
            app_tz=value.split('=',1)[1].strip().strip('\"\'')
            continue
        pieces=value.split(None,5)
        paths=re.findall(r'(?:/[A-Za-z0-9_.-]+)+/backup\.py',value)
        if not paths or 'qdrant'not in value.lower():
            continue
        if len(pieces)!=6 or len(set(paths))!=1 or any(not re.fullmatch(r'[0-9*/,-]+',v)for v in pieces[:5]):
            raise ValueError('backup_identity_required')
        jobs.append({'scheduleFields':pieces[:5],
                     'backupPathHash':hashlib.sha256(paths[0].encode()).hexdigest(),
                     'cronTimezoneDeclared':cron_tz is not None,
                     'cronTimezoneHash':digest(cron_tz)if cron_tz is not None else None,
                     'cronTimezoneIsUtc':cron_tz in ('UTC','Etc/UTC','GMT')if cron_tz is not None else None,
                     'applicationTimezoneDeclared':app_tz is not None})
    if len(jobs)!=1:
        raise ValueError('backup_identity_required')
    return {'jobs':jobs,'systemUtcOffsetSeconds':system_offset_seconds,
            'systemTimezoneIsUtc':system_utc,
            'cronTimezoneImplementationVerified':False,
            'nextBackupUtcEstablished':False,
            'applicationTimezoneControlsScheduler':False}


def mount_mode_metadata(text, target):
    rows=[]
    for line in text.splitlines():
        first,separator,last=line.partition(' - ')
        if not separator:
            continue
        left=first.split();right=last.split()
        if len(left)<6 or len(right)<3:
            raise ValueError('sample_failed')
        point=left[4].replace('\\040',' ').replace('\\011','\t').replace('\\134','\\')
        if target==point or target.startswith(point.rstrip('/')+'/'):
            opts=set(left[5].split(','))|set(right[2].split(','))
            rows.append((len(point),{'filesystemClass':'sshfs'if right[0]=='fuse.sshfs'else('fuse-other'if right[0].startswith('fuse')else'other'),
                                    'visibleDirectIo':bool(opts&{'direct_io','direct-io'}),
                                    'visibleWritebackCache':'writeback_cache'in opts,
                                    'visibleSync':'sync'in opts,
                                    'visibleKernelCache':'kernel_cache'in opts,
                                    'visibleAutoCache':'auto_cache'in opts,
                                    'negotiatedFuseIoModeEstablished':False}))
    if not rows:
        raise ValueError('missing_required')
    return max(rows,key=lambda r:r[0])[1]


def preflight(proc=Path('/proc')):
    frame=docker_frame(proc)
    targets=[m[0]for m in frame['mounts']if m[1]=='/qdrant/snapshots']
    if len(targets)!=1:
        raise ValueError('source_changed')
    names=('dirty_background_bytes','dirty_background_ratio','dirty_bytes','dirty_ratio',
           'dirty_expire_centisecs','dirty_writeback_centisecs')
    dirty={name:natural(read(proc/'sys/vm'/name,128).strip())for name in names}
    offset=dt.datetime.now().astimezone().utcoffset().total_seconds()
    tz=os.path.realpath('/etc/localtime').split('/zoneinfo/')[-1]
    schedule=schedule_metadata(read('/var/spool/cron/crontabs/root'),int(offset),tz in ('UTC','Etc/UTC','GMT'))
    kernel=os.uname().release
    if not re.fullmatch(r'[A-Za-z0-9._+-]{1,100}',kernel):
        raise ValueError('invalid_numeric')
    mode=mount_mode_metadata(read(proc/'self/mountinfo'),targets[0])
    if docker_frame(proc)!=frame:
        raise ValueError('source_changed')
    return {'event':'resource-window.preflight.v1','at':stamp(),'sourceIdentityHash':digest(frame),
            'kernelRelease':kernel,'dirtySysctls':dirty,'dirtyThresholdsAreHardLimits':False,
            'mountMode':mode,
            'schedule':schedule,'privatePathsPublished':False,'hostWrites':0,'queries':0}


class Output:
    def __init__(self,stream):
        self.stream,self.total=stream,0
    def emit(self,record):
        encoded=json.dumps(record,allow_nan=False,separators=(',',':'))+'\n'
        n=len(encoded.encode())
        if n>ROW_BYTES or self.total+n>OUTPUT_BYTES:
            raise ValueError('output_bound')
        self.stream.write(encoded);self.stream.flush();self.total+=n


def run(source,output,start,end,wall=time.time,clock=time.monotonic,sleep=time.sleep):
    start_date=dt.datetime.fromisoformat(start);end_date=dt.datetime.fromisoformat(end)
    if start_date.utcoffset()!=dt.timedelta(0) or end_date.utcoffset()!=dt.timedelta(0):
        raise ValueError('window_invalid')
    begin=start_date.timestamp();finish=end_date.timestamp()
    if not 2<=finish-begin<=2700 or not 0<=begin-wall()<=300:
        raise ValueError('window_invalid')
    while wall()<begin:
        sleep(min(1,begin-wall()))
    actual=clock();actual_wall=wall();deadline=actual+max(0,finish-actual_wall);due=actual;count=0;continuous=wall()-begin<2;previous=None
    output.emit({'event':'resource-window.started.v1','at':stamp(),'scheduledStart':start,
                 'scheduledEnd':end,'intervalSeconds':2,'maximumGapSeconds':MAX_GAP_SECONDS,'startedMonotonicSeconds':actual,'maximumRows':ROWS,'maximumRowBytes':ROW_BYTES,
                 'maximumOutputBytes':OUTPUT_BYTES,'noContentsRead':True,'queries':0,'cacheControls':0})
    while clock()<deadline and wall()<finish:
        if count>=ROWS:
            raise ValueError('sample_bound')
        sleep(max(0,min(due-clock(),deadline-clock())))
        if clock()>=deadline or wall()>=finish:
            break
        sample_start=clock()
        if previous is not None and sample_start-previous>MAX_GAP_SECONDS:
            continuous=False
        previous=sample_start
        row=source.sample();row.update(event='resource-window.sample.v1',sample=count,
                                    startedMonotonicSeconds=sample_start,finishedMonotonicSeconds=clock())
        if row['durationSeconds']>2 or not row['sshUserspace']['complete'] or not row['otherCgroups']['complete']:
            continuous=False
        output.emit(row);count+=1;due=max(due+2,clock())
    ended=clock();ended_wall=wall()
    full_window=ended>=deadline and ended_wall>=finish
    wall_drift=(ended_wall-actual_wall)-(ended-actual)
    source.fence()
    source.check.verify()
    final_proof=source.finish()
    output.emit({'event':'resource-window.complete.v1','at':stamp(),'samples':count,
                 'continuousCoverage':continuous and count>0 and full_window and abs(wall_drift)<=1,
                 'fullScheduledWindowObserved':full_window,'elapsedMonotonicSeconds':ended-actual,
                 'finishedMonotonicSeconds':ended,'wallClockDriftSeconds':wall_drift,
                 'maximumWallDriftSeconds':1,'finalResourceFence':final_proof,'futureCeilingEstablished':False,'productionAcceptance':False})


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute',action='store_true')
    parser.add_argument('--inspect-preflight',action='store_true')
    parser.add_argument('--start-utc');parser.add_argument('--end-utc')
    parser.add_argument('--expected-source-sha256');parser.add_argument('--backup-path-sha256')
    args=parser.parse_args()
    if args.inspect_preflight:
        if args.execute:
            print(json.dumps({'event':'resource-window.failed.v1','reason':'window_invalid'}));return 1
        try:Output(sys.stdout).emit(preflight());return 0
        except Exception:
            print(json.dumps({'event':'resource-window.failed.v1','reason':'sample_failed'}));return 1
    if not args.execute:
        print(json.dumps({'event':'resource-window.prepared-only.v1','hostOperations':0}));return 0
    output=Output(sys.stdout);source=None;failure=None
    try:
        if not all(re.fullmatch('[0-9a-f]{64}',v or '')for v in (args.expected_source_sha256,args.backup_path_sha256)):
            raise ValueError('source_preflight_required')
        source=Source(args.expected_source_sha256,args.backup_path_sha256)
        run(source,output,args.start_utc,args.end_utc)
    except Exception as error:
        failure=str(error)if str(error)in SAFE else 'sample_failed'
    finally:
        if source:
            try:source.close()
            except Exception:failure=failure or 'source_check_exit_unproven'
    if failure:
        output.emit({'event':'resource-window.failed.v1','at':stamp(),'reason':failure,
                     'continuousCoverage':False,'futureCeilingEstablished':False,'productionAcceptance':False})
        return 1
    return 0


if __name__=='__main__':
    sys.exit(main())
