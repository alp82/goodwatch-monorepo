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
import stat
import threading
import time

OUTCOME_TABLE_BYTES=b'{\n  "schema": "resource-population-outcomes.v1",\n  "measurementOnly": true,\n  "requiredMetrics": {\n    "hostMeminfo": [\n      "MemTotal",\n      "MemFree",\n      "MemAvailable",\n      "Buffers",\n      "Cached",\n      "Active(file)",\n      "Inactive(file)",\n      "Dirty",\n      "Writeback",\n      "WritebackTmp",\n      "Mlocked",\n      "Unevictable",\n      "AnonPages",\n      "Shmem",\n      "SReclaimable",\n      "SUnreclaim",\n      "KernelStack",\n      "PageTables",\n      "SwapTotal",\n      "SwapFree"\n    ],\n    "hostPsi": [\n      "memory.some",\n      "memory.full",\n      "io.some",\n      "io.full"\n    ],\n    "hostVmstat": [\n      "allocstall_dma",\n      "allocstall_dma32",\n      "allocstall_normal",\n      "allocstall_movable",\n      "allocstall_device",\n      "pgscan_direct",\n      "pgsteal_direct",\n      "pgscan_file",\n      "pgsteal_file",\n      "workingset_refault_file",\n      "pswpin",\n      "pswpout"\n    ],\n    "sourceMemoryCurrent": true,\n    "sourceMemoryStat": [\n      "anon",\n      "file",\n      "kernel",\n      "shmem",\n      "file_dirty",\n      "file_writeback",\n      "unevictable",\n      "pagetables",\n      "sock",\n      "active_file",\n      "inactive_file"\n    ],\n    "sourceMemoryEventsLocal": [\n      "max",\n      "high",\n      "oom",\n      "oom_kill"\n    ],\n    "sourceCpuStat": [\n      "nr_throttled",\n      "throttled_usec",\n      "usage_usec"\n    ],\n    "sourceSwapCurrent": true,\n    "sourcePsi": [\n      "memory.some",\n      "memory.full",\n      "io.some",\n      "io.full"\n    ],\n    "mainProcess": [\n      "startTicks",\n      "parentPid",\n      "minorFaults",\n      "majorFaults",\n      "rssBytes",\n      "read_bytes",\n      "VmLck"\n    ],\n    "readerProcess": [\n      "startTicks",\n      "VmLck",\n      "cgroup"\n    ],\n    "requiredSwapTotal": 0\n  },\n  "fatalTerminate": [\n    "primary_birth_executable_or_placement_changed",\n    "container_config_changed",\n    "source_or_ancestor_limits_changed",\n    "cgroup_directory_identity_changed",\n    "reader_identity_or_placement_changed",\n    "reader_exclusion_invalid",\n    "required_metric_missing_or_invalid",\n    "host_swap_present",\n    "observed_positive_main_reader_or_aux_lock",\n    "main_absent_from_complete_unique_list",\n    "multiple_qdrant_comm_docker_top",\n    "transport_or_output_bound",\n    "unclassified_optional_census_error",\n    "required_reader_enumeration_or_exclusion_unavailable"\n  ],\n  "dimensionPartial": [\n    "membership_duplicate_or_truncated",\n    "member_birth_reuse",\n    "member_disappeared",\n    "member_lock_unknown",\n    "optional_census_identity_race",\n    "optional_census_disappeared",\n    "optional_census_bound",\n    "sample_duration_or_cadence_or_clock_outcome",\n    "optional_census_entry_unreadable"\n  ],\n  "dimensionUnavailable": [\n    "membership_unreadable",\n    "sibling_census_root_unreadable"\n  ],\n  "optionalDowngradeAllowlist": [\n    "census_bound",\n    "eligible_identity_race",\n    "process_disappeared",\n    "optional_unreadable"\n  ],\n  "permissions": {\n    "capacityPermission": false,\n    "idleAdmission": false,\n    "productionAcceptance": false,\n    "futureCeilingEstablished": false\n  },\n  "auxiliaryZeroProof": [\n    "bounded-list",\n    "birth-before",\n    "status-VmLck",\n    "birth-after",\n    "proc-cgroup-match"\n  ],\n  "positiveLockRefusesBeforeLaterBirthValidation": true,\n  "bounds": {\n    "rowBytes": 8192,\n    "rows": 1500,\n    "outputBytes": 16777216,\n    "cadenceSeconds": 2,\n    "gapSeconds": 3,\n    "sampleSeconds": 2,\n    "clockDriftSeconds": 1,\n    "memberLedgerPerEndpoint": 16\n  },\n  "countSemantics": {\n    "observedCount": "decoded bounded PID-prefix entries, including duplicates",\n    "duplicateCount": "observedCount minus unique decoded PIDs",\n    "truncatedCount": "known omitted unique decoded PIDs plus one unknown-suffix sentinel only when byteListTruncated is true",\n    "byteListTruncated": "literal boolean; not a numeric estimate of unknown suffix population",\n    "mainIdentity": "endpoint-verified main entry binds PID and startTicks to required main identity"\n  }\n}\n'
OUTCOME_TABLE_SHA256='06ac005db11c28ca353d30ab6ddfa0d2f733b0eb9321c49d064449b7325bd813'
if hashlib.sha256(OUTCOME_TABLE_BYTES).hexdigest()!=OUTCOME_TABLE_SHA256:raise ValueError('outcome_table_changed')
PERMISSIONS={'capacityPermission':False,'idleAdmission':False,'productionAcceptance':False,'futureCeilingEstablished':False}

IMAGE = 'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
ROW_BYTES = 8192
MAX_GAP_SECONDS = 3
ROWS = 1500
OUTPUT_BYTES = 16 * 1024**2
LEDGER_MEMBERS = 16
LEDGER_SECONDS = 0.25
COMM_CLASSES = {'qdrant','shell','python','other','unavailable'}
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
        'source_cgroup_scope_invalid','sample_cadence_incomplete','source_locked','reader_identity_changed','group_identity_changed','optional_unreadable','process_disappeared'}


TRIGGERS = {'source_comm','source_executable','source_birth','source_cgroup',
            'sample_membership','final_membership','process_limit','deadline',
            'argv_limit','eligible_identity_race','ssh_limit'}
PHASES = {'before_sample','after_sample','final','source_fence','process_census'}
EVIDENCE_KEYS = {'expectedStartTicks','observedStartTicks','beforeCount','afterCount',
                 'expectedGroupHash','observedGroupHash','beforeMembershipHash','afterMembershipHash','lockedBytes','memberPid','expectedLimitHash','observedLimitHash','expectedAncestorHash','observedAncestorHash','observedSwapTotalBytes','expectedSwapTotalBytes'}


class GuardFailure(ValueError):
    """Fixed diagnostic fields only; rejection behavior is unchanged."""
    def __init__(self, reason, trigger, phase, **evidence):
        if reason not in SAFE or trigger not in TRIGGERS or phase not in PHASES or not set(evidence)<=EVIDENCE_KEYS:
            raise ValueError('invalid_numeric')
        for key,value in evidence.items():
            if key.endswith('Hash'):
                if not isinstance(value,str) or not re.fullmatch('[0-9a-f]{64}',value):
                    raise ValueError('invalid_numeric')
            elif type(value)is not int or not 0<=value<=2**64-1:
                raise ValueError('invalid_numeric')
        super().__init__(reason)
        self.diagnostic={'trigger':trigger,'phase':phase,**evidence}


def diagnostic(error):
    return {'diagnostic':error.diagnostic} if isinstance(error,GuardFailure) else {}


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


def membership_ledger(proc, pids, clock=time.monotonic):
    """Diagnostic only: bracket fixed comm classes with process birth reads."""
    begun=clock();selected=sorted(pids)[:LEDGER_MEMBERS];members=[]
    for pid in selected:
        row={'pid':pid,'startTicks':None,'commClass':'unavailable','birthVerified':False}
        try:
            if clock()-begun>LEDGER_SECONDS:
                raise ValueError('census_bound')
            root=proc/str(pid);before=proc_identity(root)['startTicks']
            comm=read(root/'comm',128).strip();after=proc_identity(root)['startTicks']
            if before!=after or not before or clock()-begun>LEDGER_SECONDS:
                raise ValueError('source_changed')
            kind='qdrant'if comm=='qdrant'else'shell'if comm in('sh','bash','dash')else'python'if comm in('python','python3','uv')else'other'
            row.update(startTicks=before,commClass=kind,birthVerified=True)
        except Exception:
            pass
        members.append(row)
    truncated=len(pids)>LEDGER_MEMBERS
    return {'members':members,'truncated':truncated,
            'complete':not truncated and all(row['birthVerified']for row in members)}


def ledger_evidence(ledger):
    """Validate optional diagnostic data without allowing raw process text."""
    if not isinstance(ledger,dict)or set(ledger)!={'members','complete','truncated'}:
        raise ValueError('invalid_numeric')
    if type(ledger['complete'])is not bool or type(ledger['truncated'])is not bool or not isinstance(ledger['members'],list)or len(ledger['members'])>LEDGER_MEMBERS:
        raise ValueError('invalid_numeric')
    for row in ledger['members']:
        if not isinstance(row,dict)or set(row)!={'pid','startTicks','commClass','birthVerified'}:
            raise ValueError('invalid_numeric')
        if type(row['pid'])is not int or not 0<row['pid']<2**64 or type(row['birthVerified'])is not bool or row['commClass']not in COMM_CLASSES:
            raise ValueError('invalid_numeric')
        if row['birthVerified']:
            if type(row['startTicks'])is not int or not 0<row['startTicks']<2**64 or row['commClass']=='unavailable':
                raise ValueError('invalid_numeric')
        elif row['startTicks']is not None or row['commClass']!='unavailable':
            raise ValueError('invalid_numeric')
    if ledger['complete']and(ledger['truncated']or not all(row['birthVerified']for row in ledger['members'])):
        raise ValueError('invalid_numeric')
    return ledger


def membership_failure(trigger,phase,before,after,before_ledger,after_ledger):
    # Construct the original rejection first; diagnostics can never replace it.
    error=GuardFailure('source_changed',trigger,phase,
                       beforeCount=before['processCount'],afterCount=after['processCount'],
                       beforeMembershipHash=before['processMembershipHash'],afterMembershipHash=after['processMembershipHash'])
    for prefix,ledger,group in(('before',before_ledger,before),('after',after_ledger,after)):
        try:
            value=ledger_evidence(ledger)
            if len(value['members'])!=min(group['processCount'],LEDGER_MEMBERS)or value['truncated']!=(group['processCount']>LEDGER_MEMBERS):
                raise ValueError('invalid_numeric')
        except Exception:
            value={'members':[],'complete':False,'truncated':group['processCount']>LEDGER_MEMBERS}
        error.diagnostic.update({prefix+'Members':value['members'],prefix+'LedgerComplete':value['complete'],prefix+'LedgerTruncated':value['truncated']})
    return error


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


def process_census(proc, backup_hash, clock=time.monotonic, own_reader_birth=None):
    begun=clock();nodes=list(proc.glob('[0-9]*'));own_pid=os.getpid();excluded=0
    def own_fence():
        if type(own_reader_birth)is not int or own_reader_birth<=0:raise ValueError('reader_identity_changed')
        try:birth=proc_identity(proc/str(own_pid))['startTicks']
        except (OSError,ValueError):raise ValueError('reader_identity_changed') from None
        if birth!=own_reader_birth:raise ValueError('reader_identity_changed')
    own_fence()
    own_nodes=[node for node in nodes if node.name==str(own_pid)]
    if len(own_nodes)!=1:raise ValueError('reader_identity_changed')
    own_fence();excluded=1;nodes=[node for node in nodes if node.name!=str(own_pid)]
    processes={};jobs=[];unknown=0;reasons=[];enumerated=len(nodes)+1
    if enumerated>4096:reasons.append('census_bound');nodes=nodes[:4096]
    for node in nodes:
        if clock()-begun>1:reasons.append('census_bound');break
        if node.name==str(own_pid):raise ValueError('reader_identity_changed')
        try:
            comm=read(node/'comm',128).strip();args=[]
            if comm in ('python','python3','uv'):args=read(node/'cmdline',8192).split('\0')
            isbackup=any(v.startswith('/')and v.endswith('/backup.py')and hashlib.sha256(v.encode()).hexdigest()==backup_hash for v in args)
            if comm not in ('sshfs','ssh')and not isbackup:continue
            identity=proc_identity(node)
            memory=fields(read(node/'status'),RSS,True)if comm in ('sshfs','ssh')else None
            if proc_identity(node)['startTicks']!=identity['startTicks']:raise ValueError('eligible_identity_race')
            if read(node/'comm',128).strip()!=comm:raise ValueError('eligible_identity_race')
            if isbackup:jobs.append((int(node.name),identity['startTicks']))
            if memory is not None:
                if len(processes)>=64:reasons.append('census_bound');break
                processes[int(node.name)]={'comm':comm,'identity':identity,'memory':memory}
        except FileNotFoundError:unknown+=1;reasons.append('process_disappeared')
        except PermissionError:unknown+=1;reasons.append('optional_unreadable')
        except ValueError as error:
            if str(error)not in ('eligible_identity_race','census_bound','missing_required','invalid_numeric'):raise
            unknown+=1;reasons.append('eligible_identity_race'if str(error)=='eligible_identity_race'else'optional_unreadable')
    own_fence()
    if excluded!=1:raise ValueError('reader_identity_changed')
    # Reader identity and exclusion remain mandatory even in a partial census.
    classes={name:{'processCount':0,'observedBytes':{k:0 for k in RSS}}for name in ('sshfs','sshfs-child-ssh','other-ssh')};identities=[]
    for pid,item in processes.items():
        parent=item['identity']['parentPid'];linked=False;seen=set()
        while parent in processes and parent not in seen:
            seen.add(parent)
            if processes[parent]['comm']=='sshfs':linked=True;break
            parent=processes[parent]['identity']['parentPid']
        kind='sshfs'if item['comm']=='sshfs'else'sshfs-child-ssh'if linked else'other-ssh'
        classes[kind]['processCount']+=1
        for key,value in item['memory'].items():classes[kind]['observedBytes'][key]+=value
        identities.append((pid,item['identity']['startTicks'],kind))
    return {'classes':classes,'identityHash':digest(identities),'complete':not reasons,
        'ownedReaderExcludedCount':excluded,'enumeratedCount':enumerated,'unresolvedCount':unknown,
        'reasons':sorted(set(reasons)),'backup':{'observedCount':len(jobs),'occurrenceStatus':'observed-running'if jobs else'none-observed-in-bounded-census',
        'identityHash':digest(jobs),'complete':not reasons},'rssAccountingExact':False,'observedSumsAreTotal':False}


def siblings(group,clock=time.monotonic):
    begun=clock();items=list(group.parent.iterdir());values={k:0 for k in STAT};current=0;cohort=[];reasons=[];unknown=0
    if len(items)>256:reasons.append('census_bound');items=items[:256]
    for child in items:
        if clock()-begun>1:reasons.append('census_bound');break
        if child==group:continue
        try:
            if child.is_symlink():raise ValueError('source_cgroup_scope_invalid')
            before=child.stat()
            if not stat.S_ISDIR(before.st_mode):continue
            row=fields(read(child/'memory.stat'),STAT);value=natural(read(child/'memory.current',128).strip());after=child.stat()
            if (before.st_dev,before.st_ino)!=(after.st_dev,after.st_ino):raise ValueError('eligible_identity_race')
            current+=value
            for key,number in row.items():values[key]+=number
            cohort.append((before.st_dev,before.st_ino))
        except FileNotFoundError:unknown+=1;reasons.append('process_disappeared')
        except PermissionError:unknown+=1;reasons.append('optional_unreadable')
        except ValueError as error:
            if str(error)not in ('eligible_identity_race','missing_required','invalid_numeric','census_bound'):raise
            unknown+=1;reasons.append('eligible_identity_race'if str(error)=='eligible_identity_race'else'optional_unreadable')
    return {'observedChildCount':len(cohort),'observedCurrentBytes':current,'observedMemory':values,
        'identityHash':digest(sorted(cohort)),'complete':not reasons,'unresolvedCount':unknown,'reasons':sorted(set(reasons)),
        'scope':'direct-source-parent-siblings-hierarchical-no-descendant-double-sum','otherHostBranchesMeasured':False,'observedSumsAreTotal':False}


class Source:
    def __init__(self,expected_hash,backup_hash,proc=Path('/proc'),cgroot=Path('/sys/fs/cgroup')):
        self.proc,self.cgroot,self.backup_hash=proc,cgroot,backup_hash
        self.expected=docker_frame(proc)
        if digest(self.expected)!=expected_hash:
            raise ValueError('source_changed')
        self.group=group_path(proc,self.expected['pid'],cgroot)
        self.group_identity=self.directory_identity()
        self.expected_limits=limits(self.group);self.ancestor_hash=ancestors(self.group,cgroot)
        if self.expected_limits['memory.max']!='max'or self.expected_limits['memory.high']!='max'or self.expected_limits['cpu.max']!='max 100000'or self.expected_limits['memory.oom.group']!='0':
            raise ValueError('source_limits_changed')
        self.reader_pid=os.getpid()
        self.reader_birth=proc_identity(proc/str(self.reader_pid))['startTicks']
        self.reader_group=group_path(proc,self.reader_pid,cgroot,allow_root=True)
        self.check=ConfigCheck(self.expected,lambda:docker_frame(proc))
    def directory_identity(self):
        if self.group.resolve()!=self.group or self.group.is_symlink():raise ValueError('group_identity_changed')
        value=self.group.lstat()
        if not stat.S_ISDIR(value.st_mode):raise ValueError('group_identity_changed')
        return (value.st_dev,value.st_ino)
    def fence(self, phase='source_fence'):
        observed_directory=self.directory_identity()
        if observed_directory!=self.group_identity:
            raise GuardFailure('group_identity_changed','source_cgroup',phase,expectedGroupHash=digest(self.group_identity),observedGroupHash=digest(observed_directory))
        self.check.verify();pid=self.expected['pid'];root=self.proc/str(pid)
        locked=fields(read(root/'status'),('VmLck',),True)['VmLck']
        if locked:raise GuardFailure('source_locked','process_limit',phase,lockedBytes=locked,memberPid=pid)
        if read(root/'comm',128).strip()!='qdrant':
            raise GuardFailure('source_changed','source_comm',phase)
        if Path(os.readlink(root/'exe')).name!='qdrant':
            raise GuardFailure('source_changed','source_executable',phase)
        birth=proc_identity(root)['startTicks']
        if birth!=self.expected['startTicks']:
            raise GuardFailure('source_changed','source_birth',phase,
                               expectedStartTicks=self.expected['startTicks'],observedStartTicks=birth)
        group=group_path(self.proc,pid,self.cgroot)
        if group!=self.group:
            raise GuardFailure('source_changed','source_cgroup',phase,
                               expectedGroupHash=digest(str(self.group)),observedGroupHash=digest(str(group)))
        observed_limits=limits(self.group);observed_ancestors=ancestors(self.group,self.cgroot)
        if observed_limits!=self.expected_limits or observed_ancestors!=self.ancestor_hash:
            raise GuardFailure('source_limits_changed','process_limit',phase,expectedLimitHash=digest(self.expected_limits),observedLimitHash=digest(observed_limits),expectedAncestorHash=self.ancestor_hash,observedAncestorHash=observed_ancestors)
    def reader_proof(self):
        try: birth=proc_identity(self.proc/str(self.reader_pid))['startTicks']
        except FileNotFoundError: raise ValueError('reader_identity_changed') from None
        if os.getpid()!=self.reader_pid or birth!=self.reader_birth:
            raise GuardFailure('reader_identity_changed','source_birth','source_fence',expectedStartTicks=self.reader_birth,observedStartTicks=birth)
        group=group_path(self.proc,self.reader_pid,self.cgroot,allow_root=True)
        locked=fields(read(self.proc/str(self.reader_pid)/'status'),('VmLck',),True)['VmLck']
        outside=group!=self.group and not group.is_relative_to(self.group)
        if locked:raise GuardFailure('source_locked','process_limit','source_fence',lockedBytes=locked,memberPid=self.reader_pid)
        if group!=self.reader_group or not outside:
            raise GuardFailure('reader_identity_changed','source_cgroup','source_fence',expectedGroupHash=digest(str(self.reader_group)),observedGroupHash=digest(str(group)))
        return {'outsideSourceCgroup':True,'VmLckBytes':0,'placementUnchanged':True,
                'groupHash':digest(str(group))}
    def population(self):
        result={'status':'endpoint-verified','observedCount':None,'duplicateCount':0,'unresolvedCount':0,'truncatedCount':0,'members':[],'unknownLocks':0,'verifiedZeroLocks':0,'positiveLocks':0}
        try:
            with (self.group/'cgroup.procs').open('rb') as stream:raw=stream.read(8193)
        except OSError:
            result.update(status='unavailable',reason='optional_unreadable');return result
        over=len(raw)>8192;result['byteListTruncated']=over;raw=raw[:8192]
        if over:raw=raw.rsplit(b'\n',1)[0]
        try:pids=[natural(v) for v in raw.decode().split()]
        except (ValueError,UnicodeError):result.update(status='unavailable',reason='invalid_numeric');return result
        result['observedCount']=len(pids);result['duplicateCount']=len(pids)-len(set(pids))
        degraded=over or len(pids)>64 or result['duplicateCount']>0
        unique=sorted(set(pids));result['membershipHash']=digest(unique)
        if not degraded and self.expected['pid'] not in unique:raise ValueError('source_changed')
        begun=time.monotonic()
        selected=unique[:16];result['truncatedCount']=max(0,len(unique)-16)+(1 if over else 0)
        for index,pid in enumerate(selected):
            if time.monotonic()-begun>LEDGER_SECONDS:
                result['truncatedCount']+=len(selected)-index;result['status']='partial';result['ledgerTimeBoundReached']=True;break
            node=self.proc/str(pid);birth=None;kind='unavailable';lock=None;proof='unknown'
            try:
                birth=proc_identity(node)['startTicks'];status=read(node/'status')
                lines=[line for line in status.splitlines() if line.startswith('VmLck:')]
                if lines:
                    lock=fields(status,('VmLck',),True)['VmLck']
                    if lock:raise GuardFailure('source_locked','process_limit','process_census',lockedBytes=lock,memberPid=pid)
                if lock is None:raise ValueError('missing_required')
                comm=read(node/'comm',128).strip();kind='qdrant'if comm=='qdrant'else'shell'if comm in('sh','bash','dash')else'python'if comm in('python','python3','uv')else'other'
                if proc_identity(node)['startTicks']!=birth:raise ValueError('source_changed')
                if group_path(self.proc,pid,self.cgroot)!=self.group:raise ValueError('source_changed')
                proof='verified';result['verifiedZeroLocks']+=1
            except GuardFailure:raise
            except (FileNotFoundError,ValueError,OSError):
                proof='unknown';birth=None;kind='unavailable';lock=None;result['unresolvedCount']+=1;result['unknownLocks']+=1
            result['members'].append([pid,birth,kind,lock,proof])
        if degraded or result['truncatedCount'] or result['unresolvedCount']:result['status']='partial'
        # A partial/vanished entry never represents zero locks or all members known.
        return result

    def group_read(self):
        population=self.population()
        result={'currentBytes':natural(read(self.group/'memory.current',128).strip()),
                'memory':fields(read(self.group/'memory.stat'),STAT),
                'events':fields(read(self.group/'memory.events.local'),EVENTS),
                'cpu':fields(read(self.group/'cpu.stat'),CPU),
                'swapBytes':natural(read(self.group/'memory.swap.current',128).strip()),
                'memoryPsi':psi(read(self.group/'memory.pressure')),
                'ioPsi':psi(read(self.group/'io.pressure')),'population':population}
        return result

    def sample(self):
        begun=time.monotonic();started=stamp();self.fence('before_sample')
        reader_before=self.reader_proof();group_before=self.group_read();ledger_before=getattr(self,'_membership_ledger',None);pid=self.expected['pid'];root=self.proc/str(pid)
        process={**proc_identity(root),'readBytes':fields(read(root/'io').replace(':',''),('read_bytes',))['read_bytes'],'VmLck':fields(read(root/'status'),('VmLck',),True)['VmLck']}
        host=fields(read(self.proc/'meminfo'),MEM,True)
        if host['SwapTotal']!=0:
            raise GuardFailure('source_limits_changed','process_limit','before_sample',observedSwapTotalBytes=host['SwapTotal'],expectedSwapTotalBytes=0)
        pressure={'memory':psi(read(self.proc/'pressure/memory')),'io':psi(read(self.proc/'pressure/io'))}
        reclaim=fields(read(self.proc/'vmstat'),VM)
        userspace=process_census(self.proc,self.backup_hash,own_reader_birth=self.reader_birth)
        try: other=siblings(self.group)
        except (FileNotFoundError,PermissionError):other={'complete':False,'reason':'optional_unreadable'}
        except ValueError as error:
            if str(error)!='census_bound':raise
            other={'complete':False,'reason':'census_bound'}
        group_after=self.group_read();ledger_after=getattr(self,'_membership_ledger',None);reader_after=self.reader_proof();self.fence('after_sample')
        if process['VmLck']:raise GuardFailure('source_locked','process_limit','after_sample',lockedBytes=process['VmLck'],memberPid=pid)
        return {'startedAt':started,'finishedAt':stamp(),'durationSeconds':time.monotonic()-begun,
                'readerBefore':reader_before,'readerAfter':reader_after,
                'host':host,'hostPsi':pressure,'hostReclaim':reclaim,'process':process,
                'sourceBefore':group_before,'sourceAfter':group_after,
                'sshUserspace':userspace,'otherCgroups':other,'sourcePid':pid,
                'sourceStartTicks':self.expected['startTicks'],'sourceIdentityHash':digest(self.expected),
                'ancestorLimitHash':self.ancestor_hash,'sourceGroupHash':digest(str(self.group)),
                'dimensions':sample_dimensions(group_before,group_after,userspace,other),
                'sourceDirectoryIdentityHash':digest(self.group_identity),'metadataOnly':True,'archiveResidentBytesMeasured':False}
    def finish(self):
        self.fence('final');before=self.group_read();reader=self.reader_proof()
        after=self.group_read();self.fence('final')
        return {'reader':reader,'sourceDirectoryIdentityHash':digest(self.group_identity),
                'sourceIdentityHash':digest(self.expected),'sourceBefore':before,'sourceAfter':after,
                'sourceLockStatus':'endpoint-zero-verified' if all(g['population']['status']=='endpoint-verified' for g in (before,after)) else 'unknown',**PERMISSIONS}
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
    return {'event':'resource-population.preflight.v1','at':stamp(),'sourceIdentityHash':digest(frame),
            'kernelRelease':kernel,'dirtySysctls':dirty,'dirtyThresholdsAreHardLimits':False,
            'mountMode':mode,
            'schedule':schedule,'privatePathsPublished':False,'hostWrites':0,'queries':0}


def sample_dimensions(before,after,userspace,other):
    pop=[before['population'],after['population']]
    return {'primaryIdentity':'observed-bracket','requiredMetrics':'observed-bracket',
        'auxiliaryPopulation':'endpoint-verified' if all(v['status']=='endpoint-verified' for v in pop) else ('unavailable' if any(v['status']=='unavailable' for v in pop) else 'partial'),
        'auxiliaryLocks':'endpoint-zero-verified' if all(v['status']=='endpoint-verified' for v in pop) else 'unknown',
        'sshCensus':'observed-census' if userspace.get('complete') is True else ('unavailable' if userspace.get('reason')=='optional_unreadable' else 'partial'),
        'backupCensus':'observed-census' if userspace.get('backup',{}).get('complete') is True else ('unavailable' if userspace.get('reason')=='optional_unreadable' else 'partial'),
        'siblingCensus':'observed-census' if other.get('complete') is True else ('unavailable' if other.get('reason')=='optional_unreadable' else 'partial')}


def bound_ledgers(record):
    # Each discarded tuple remains counted; required data is never dropped.
    groups=[record[k] for k in ('sourceBefore','sourceAfter') if isinstance(record.get(k),dict)]
    if isinstance(record.get('finalResourceFence'),dict):groups.extend(record['finalResourceFence'][k] for k in ('sourceBefore','sourceAfter'))
    while len((json.dumps(record,allow_nan=False,separators=(',',':'))+'\n').encode())>ROW_BYTES:
        candidates=[group['population'] for group in groups if group.get('population',{}).get('members')]
        if not candidates:raise ValueError('output_bound')
        population=max(candidates,key=lambda p:len(p['members']));population['members'].pop()
        population['truncatedCount']+=1;population['status']='partial';population['rowBoundTruncated']=True
        if 'dimensions' in record:record['dimensions']['auxiliaryPopulation']='partial-or-unavailable';record['dimensions']['auxiliaryLocks']='unknown'
        if 'finalResourceFence' in record:record['finalResourceFence']['sourceLockStatus']='unknown'
    return record


class Output:
    def __init__(self,stream):
        self.stream,self.total=stream,0
    def emit(self,record):
        record={**record,**PERMISSIONS,'schema':'resource-population.measurement.v1','outcomeTableSha256':OUTCOME_TABLE_SHA256}
        if 'coverage' in record:raise ValueError('invalid_numeric')
        record=bound_ledgers(record)
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
    output.emit({'event':'resource-population.started.v1','at':stamp(),'scheduledStart':start,
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
        row=source.sample();row.update(event='resource-population.sample.v1',sample=count,
                                    startedMonotonicSeconds=sample_start,finishedMonotonicSeconds=clock())
        if row['durationSeconds']>2:
            continuous=False
        output.emit(row);count+=1;due=max(due+2,clock())
    ended=clock();ended_wall=wall();sampling_ended_at=dt.datetime.fromtimestamp(ended_wall,dt.timezone.utc).isoformat()
    full_window=ended>=deadline and ended_wall>=finish
    wall_drift=(ended_wall-actual_wall)-(ended-actual)
    source.fence()
    source.check.verify()
    final_proof=source.finish()
    output.emit({'event':'resource-population.complete.v1','at':stamp(),'samplingEndedAt':sampling_ended_at,'samples':count,
                 'samplingStatus':'scheduled-samples-observed' if continuous and count>0 and full_window and abs(wall_drift)<=1 else 'sampling-incomplete',
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
            Output(sys.stdout).emit({'event':'resource-population.failed.v1','reason':'window_invalid'});return 1
        try:Output(sys.stdout).emit(preflight());return 0
        except Exception:
            Output(sys.stdout).emit({'event':'resource-population.failed.v1','reason':'sample_failed'});return 1
    if not args.execute:
        Output(sys.stdout).emit({'event':'resource-population.prepared-only.v1','hostOperations':0});return 0
    output=Output(sys.stdout);source=None;failure=None;failure_diagnostic={}
    try:
        if not all(re.fullmatch('[0-9a-f]{64}',v or '')for v in (args.expected_source_sha256,args.backup_path_sha256)):
            raise ValueError('source_preflight_required')
        source=Source(args.expected_source_sha256,args.backup_path_sha256)
        run(source,output,args.start_utc,args.end_utc)
    except Exception as error:
        failure=str(error)if str(error)in SAFE else 'sample_failed'
        failure_diagnostic=diagnostic(error)
    finally:
        if source:
            try:source.close()
            except Exception:failure=failure or 'source_check_exit_unproven'
    if failure:
        output.emit({'event':'resource-population.failed.v1','at':stamp(),'reason':failure,
                     'samplingStatus':'terminated','futureCeilingEstablished':False,'productionAcceptance':False,**failure_diagnostic})
        return 1
    return 0


if __name__=='__main__':
    sys.exit(main())
