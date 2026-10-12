"""Prepared clone-only cold/pressure controls. Holds candidate pins through query lease.

Default prepares only. No private query payload is accepted or emitted. No production mode.
"""
import sys
sys.dont_write_bytecode = True
import argparse
from contextlib import contextmanager
import ctypes
from datetime import datetime, timezone
import fcntl
import hashlib
import importlib.util,types
import json
import multiprocessing
import os
import re
from pathlib import Path
import select
import signal
import shutil
import stat
import subprocess
import time
import urllib.request

MODULE_DIR=Path(__file__).absolute().parent
if MODULE_DIR.resolve()!=MODULE_DIR:raise SystemExit(1)
sys.path.insert(0,str(MODULE_DIR))
import daemon_cpu0 as daemon
import pin_cpu0 as pin
import runtime_cpu0 as runtime
import cpu0_guards

ROOT = daemon.ROOT
ARCHIVE = ROOT/'rename-proof/media-20261011T041503Z.snapshot'
ARCHIVE_HASH = '614149a3885293985ad912d2ed92bf03fa23f42235bb6ddde78e9991c22c64eb'
ARCHIVE_BYTES = 4428863488

_INSPECTOR=None


def _own_birth():
    raw=(Path('/proc')/str(os.getpid())/'stat').read_text()
    value=int(raw[raw.rfind(')')+2:].split()[19])
    if value<=0:raise RuntimeError('overhead_identity_changed')
    return value


@contextmanager
def inspector_scope():
    """Parent-only counters; inherited fork copies never aggregate child work."""
    global _INSPECTOR
    if _INSPECTOR is not None:raise RuntimeError('overhead_inspector_scope_active')
    old=runtime.docker
    record={'ownerPid':os.getpid(),'ownerStartTicks':_own_birth(),'runtimeDockerCalls':0,'totalElapsedSeconds':0.0,'maxElapsedSeconds':0.0,'callTimeoutSeconds':5,'parentOnly':True,'unsampledPeakBytes':None}
    def observed(*args):
        parent=os.getpid()==record['ownerPid']
        if parent and _own_birth()!=record['ownerStartTicks']:raise RuntimeError('overhead_identity_changed')
        started=time.monotonic()
        try:return old(*args)
        finally:
            if parent:
                elapsed=time.monotonic()-started;record['runtimeDockerCalls']+=1;record['totalElapsedSeconds']+=elapsed;record['maxElapsedSeconds']=max(record['maxElapsedSeconds'],elapsed)
    _INSPECTOR=record;runtime.docker=observed
    try:yield record
    finally:runtime.docker=old;_INSPECTOR=None


def phase_overhead(config,source,lock_fd,manager=None,*,baseline=False):
    lifecycle=load_lifecycle(config)
    if _INSPECTOR is None or os.getpid()!=_INSPECTOR['ownerPid'] or _own_birth()!=_INSPECTOR['ownerStartTicks']:raise RuntimeError('overhead_inspector_unproven')
    registered=lifecycle.registered_phase_context(source,lock_fd);outside=registered['outside']
    helper=lifecycle.source_helper_context(source,manager) if manager is not None else None
    qdrant=lifecycle.process(source.pid);wrapper=lifecycle.process(qdrant['parentPid'])
    expected_members=sorted([qdrant['pid'],wrapper['pid']]+([helper['identity']['pid']] if helper else []))
    source_members=lifecycle.bounded(source.cgroup/'cgroup.procs',512)
    if sorted(int(value) for value in source_members.split())!=expected_members or qdrant['group']!=source.cgroup_relative or wrapper['group']!=source.cgroup_relative or qdrant['comm']!='qdrant' or qdrant['exeBasename']!='qdrant':raise RuntimeError('overhead_helper_unproven')
    lifecycle.script(wrapper)
    raw=lifecycle.bounded(Path('/proc')/str(os.getpid())/'task'/str(os.getpid())/'children',8192)
    members=[int(value) for value in raw.split()]
    if members!=([helper['identity']['pid']] if helper is not None else []):raise RuntimeError('overhead_unregistered_child')
    if baseline:
        enrolled,_=lifecycle.registry_json(ROOT/'cpu0-consumer-enrolment-v2.json')
        outside={role:enrolled[role] for role in ('consumer','transportParent')}
    source_values=lifecycle.source_resource_context(source)
    if inspect_source(source.spec).identity!=source.identity:raise RuntimeError('overhead_identity_changed')
    # Re-fence actual current process identities without rebasing the metrics.
    fresh_registered=lifecycle.registered_phase_context(source,lock_fd);fresh=fresh_registered['outside']
    if any(registered[key]!=fresh_registered[key] for key in ('consumerEnrolmentSha256','consumerRegistrationSha256')):raise RuntimeError('consumer_registry_unproven')
    if any(outside[role]['identity']!=fresh[role]['identity'] for role in outside):raise RuntimeError('overhead_identity_changed')
    if helper is not None and lifecycle.source_helper_context(source,manager)['identity']!=helper['identity']:raise RuntimeError('overhead_identity_changed')
    if lifecycle.process(source.pid)!=qdrant or lifecycle.process(wrapper['pid'])!=wrapper or lifecycle.bounded(source.cgroup/'cgroup.procs',512)!=source_members:raise RuntimeError('overhead_identity_changed')
    if lifecycle.bounded(Path('/proc')/str(os.getpid())/'task'/str(os.getpid())/'children',8192)!=raw:raise RuntimeError('overhead_unregistered_child')
    return {'schema':'clone-overhead-endpoint.cpu0.v2','sourceIdentity':list(source.identity),'source':source_values,'outside':outside,'sourceHelper':helper,'consumerEnrolmentSha256':registered['consumerEnrolmentSha256'],'consumerRegistrationSha256':registered['consumerRegistrationSha256'],'inspector':{**_INSPECTOR,'liveUnregisteredDirectChildren':0},'sampledAt':at(),'sampleMonotonicSeconds':time.monotonic()}


def at(): return datetime.now(timezone.utc).isoformat()
def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_control(path, policy_hash, code_hash):
    raw = Path(path).read_bytes()
    if len(raw) > 16384 or hashlib.sha256(raw).hexdigest() != policy_hash or digest(__file__) != code_hash:
        raise ValueError('control_freeze_changed')
    c = json.loads(raw)
    if set(c) != {'schema', 'helperConfig', 'helperPolicySha256', 'helperCodeSha256', 'pressure', 'queryLeaseSeconds','controlReadySeconds', 'pressurePlacement', 'mechanismNegativeTags','initialPinRequestSeconds','steadyPinRequestSeconds','negativePrequeryMissingBytes','reconcileIntervalSeconds','cachePreparation','cpuIsolation','lifecycle'} or c['schema'] != 'clone-pin-control.cpu0-fixed.v2':
        raise ValueError('explicit_control_policy_required')
    if c['pressurePlacement'] != 'controller-original-cgroup': raise ValueError('pressure_placement_required')
    if c['mechanismNegativeTags']!=['control-native-title']:raise ValueError('predeclared_negative_control_required')
    p = c['pressure']
    if set(p) != {'archive', 'bytes', 'sha256', 'rateBytesPerSecond', 'maxSeconds'} or p['archive'] != str(ARCHIVE) or p['bytes'] != ARCHIVE_BYTES or p['sha256'] != ARCHIVE_HASH:
        raise ValueError('fixed_readonly_archive_required')
    daemon.integer(p['rateBytesPerSecond'], 1, 64*1024**2); daemon.integer(p['maxSeconds'], 70, 180)
    daemon.integer(c['queryLeaseSeconds'], 60, 60)
    daemon.integer(c['controlReadySeconds'],1200,1200)
    daemon.integer(c['initialPinRequestSeconds'],180,180);daemon.integer(c['steadyPinRequestSeconds'],30,30)
    daemon.integer(c['negativePrequeryMissingBytes'],64*1024**2,64*1024**2)
    daemon.integer(c['reconcileIntervalSeconds'],10,10)
    if p['bytes']/p['rateBytesPerSecond'] > p['maxSeconds']:
        raise ValueError('pressure_cannot_fit_deadline')
    prep=c['cachePreparation']
    if set(prep)!={'mode','requestedBytes','maxSeconds','quiescenceSeconds','postwriteQuiescenceSeconds','helperPath','helperSha256','writerPolicy'} or prep['mode']!='post-cold-owned-cgroup-reclaim' or prep['requestedBytes']!=3*pin.GIB or prep['maxSeconds']!=60 or prep['quiescenceSeconds']!=60 or prep['postwriteQuiescenceSeconds']!=60 or prep['helperPath']!=str(MODULE_DIR/'prepare_clone_reclaim.py') or not re.fullmatch('[a-f0-9]{64}',prep['helperSha256']):raise ValueError('explicit_cache_preparation_required')
    if prep['writerPolicy']!={'registrationSeconds': 10, 'prewriteAcceptanceSeconds': 60, 'prewriteSupervisionSeconds': 65, 'kernelWriteSeconds': 60, 'cleanupSeconds': 10, 'lifecycleSeconds': 145, 'receiptLimit': 18, 'censusLimit': 28}:raise ValueError('explicit_cache_preparation_required')
    cpu0_guards.validate_policy(c['cpuIsolation'])
    config, spec, policy = daemon.load_config(c['helperConfig'], c['helperPolicySha256'], c['helperCodeSha256'])
    if config['intervalSeconds']!=c['reconcileIntervalSeconds'] or config['lifetimeSeconds']!=600:raise ValueError('helper_timing_policy_changed')
    if 'pin' not in config['actions']:
        raise ValueError('pin_capability_missing')
    global CPU_POLICY
    CPU_POLICY=c['cpuIsolation']
    load_lifecycle(c)
    return c, spec, policy


def load_lifecycle(config):
    value=config['lifecycle'];path=MODULE_DIR/'lifecycle_cpu0.py'
    if set(value)!={'modulePath','moduleSha256','entrypointSha256','stopSeconds','handoffPath','oldCleanReceiptPath'} or value['modulePath']!=str(path) or not re.fullmatch('[a-f0-9]{64}',value['moduleSha256']) or value['entrypointSha256']!='f773b9c6df212eb34cfcffaa932b27a713e9d477492d2b5b40eb8f8cc5f2475e' or type(value['stopSeconds'])is not int or value['stopSeconds']!=20 or value['handoffPath']!=str(ROOT/'cpu0-lifecycle-handoff-v2.json') or value['oldCleanReceiptPath']!=str(ROOT/'cpu0-old-clean-receipt-v1.json'):
        raise RuntimeError('lifecycle_freeze_changed')
    if path.resolve()!=path:raise RuntimeError('lifecycle_freeze_changed')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_CLOEXEC)
    try:
        a=os.fstat(fd);raw=os.read(fd,65537);b=os.fstat(fd);current=path.lstat()
        sig=lambda s:(s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_mode,s.st_uid,s.st_nlink)
        if not stat.S_ISREG(a.st_mode) or a.st_uid!=os.geteuid() or a.st_nlink!=1 or stat.S_IMODE(a.st_mode)!=0o600 or len(raw)>65536 or sig(a)!=sig(b) or sig(b)!=sig(current) or hashlib.sha256(raw).hexdigest()!=value['moduleSha256']:raise RuntimeError('lifecycle_freeze_changed')
    finally:os.close(fd)
    module=sys.modules.get('lifecycle_cpu0')
    if module is not None:
        if Path(module.__file__).resolve()!=path or getattr(module,'_AUTHENTICATED_SOURCE_SHA256',None)!=value['moduleSha256']:raise RuntimeError('lifecycle_freeze_changed')
    else:
        module=types.ModuleType('lifecycle_cpu0');module.__file__=str(path);sys.modules['lifecycle_cpu0']=module
        try:
            exec(compile(raw,str(path),'exec'),module.__dict__)
            module._AUTHENTICATED_SOURCE_SHA256=hashlib.sha256(raw).hexdigest()
        except BaseException:
            sys.modules.pop('lifecycle_cpu0',None);raise
    return module


def load_cache_preparation(config):
    prep=config['cachePreparation'];path=MODULE_DIR/'prepare_clone_reclaim.py'
    if prep['helperPath']!=str(path) or path.resolve()!=path:raise RuntimeError('cache_preparation_freeze_changed')
    before=path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_uid!=os.geteuid() or before.st_nlink!=1 or stat.S_IMODE(before.st_mode)!=0o600:raise RuntimeError('cache_preparation_freeze_changed')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        opened=os.fstat(fd);raw=os.read(fd,131073);after=os.fstat(fd);current=path.lstat()
        signature=lambda i:(i.st_dev,i.st_ino,i.st_size,i.st_mtime_ns,i.st_mode,i.st_uid,i.st_nlink)
        if len(raw)>131072 or signature(before)!=signature(opened) or signature(opened)!=signature(after) or signature(after)!=signature(current) or hashlib.sha256(raw).hexdigest()!=prep['helperSha256']:raise RuntimeError('cache_preparation_freeze_changed')
    finally:os.close(fd)
    module=types.ModuleType('reviewed_owned_clone_reclaim');module.__file__=str(path)
    exec(compile(raw,str(path),'exec'),module.__dict__)
    if module.REQUEST!=prep['requestedBytes']:raise RuntimeError('cache_preparation_policy_changed')
    return module


def prepare_cache(config,spec,policy,lock_fd,raise_own_nofile=False):
    helper=load_cache_preparation(config)
    lifecycle=load_lifecycle(config)
    with lifecycle.helper_fork_scope(lock_fd):
        return helper.under_control_lock(sys.modules[__name__],config,spec,policy,lock_fd,quiescence_seconds=config['cachePreparation']['quiescenceSeconds'],postwrite_seconds=config['cachePreparation']['postwriteQuiescenceSeconds'],raise_own_nofile=raise_own_nofile)


def frozen_helper(config):
    if daemon.code_hash()!=config['helperCodeSha256'] or digest(config['helperConfig'])!=config['helperPolicySha256']:raise RuntimeError('helper_freeze_changed')


def guard_shards(source):
    ids=set()
    for line in (Path('/proc')/str(source.pid)/'maps').read_text().splitlines():
        fields=line.split(maxsplit=5)
        if len(fields)==6:
            match=re.match(r'^/qdrant/storage/collections/media_fingerprint_v1/([0-5])/',fields[5])
            if match:ids.add(int(match[1]))
    if ids!=set(range(6)):raise RuntimeError('mapped_shard_coverage_missing')
    return 6


def inspect_stopped_or_running(spec):
    data = json.loads(runtime.docker('inspect', spec.container))
    if len(data) != 1: raise RuntimeError('clone_identity_ambiguous')
    x = data[0]; h = x['HostConfig']; cpu0_guards.docker_cpu(h,CPU_POLICY)
    if x['Name'] != '/'+spec.container or x['Image'] != spec.image or x['Config']['Labels'].get('goodwatch.task') != '406' or x['Config']['Labels'].get('goodwatch.owner') != 'search-100-diagnosis':
        raise RuntimeError('clone_identity_changed')
    if h['Memory'] != spec.memory_bytes or h['MemorySwap'] != spec.swap_bytes or h['NanoCpus'] != spec.cpu_nanos or h['PortBindings'] != {'6333/tcp':[{'HostIp':'127.0.0.1','HostPort':'16333'}]}:
        raise RuntimeError('clone_resource_or_port_changed')
    mounts = [(m['Source'],m['Destination'],m['Type'],m['RW']) for m in x['Mounts']]
    if len(mounts) != 3 or frozenset(mounts) != spec.mounts:
        raise RuntimeError('clone_mount_changed')
    return x


def owned_store_files(store):
    if ROOT.resolve() != ROOT or store != ROOT/'store' or store.resolve() != store:
        raise RuntimeError('owned_root_changed')
    files, seen, total = [], set(), 0
    for base, dirs, names in os.walk(store, followlinks=False):
        for name in dirs+names:
            path = Path(base)/name; s = path.lstat()
            if stat.S_ISLNK(s.st_mode): raise RuntimeError('owned_symlink')
            if stat.S_ISREG(s.st_mode):
                key = (s.st_dev,s.st_ino)
                if s.st_nlink != 1 or key in seen: raise RuntimeError('owned_inode_alias')
                seen.add(key); files.append((path,(s.st_dev,s.st_ino,s.st_size))); total += s.st_blocks*512
            elif not stat.S_ISDIR(s.st_mode): raise RuntimeError('owned_nonregular')
    if not files or total >= 7*pin.GIB or sum(identity[2] for _,identity in files) >= 28*pin.GIB:
        raise RuntimeError('owned_size_guard')
    return files,total


def clone_command(*args):
    if len(args)!=2 or args[0]!='start' or args[1]!='gw-qdrant-cpu0-100-20261012':raise RuntimeError('lifecycle_target_refused')
    try:
        subprocess.run(['/usr/bin/docker',*args],check=True,timeout=35,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    except (OSError,subprocess.SubprocessError):raise RuntimeError('clone_control_command_failed') from None


def host_memory(path=Path('/proc/meminfo')):
    required={'MemTotal','MemAvailable','Dirty','Writeback','SwapTotal'}
    try:
        with path.open('rb') as stream: raw=stream.read(65537)
        if len(raw)>65536: raise ValueError()
        values={}
        for row in raw.decode('ascii').splitlines():
            key, rest=row.split(':',1)
            if key not in required: continue
            fields=rest.split()
            if key in values or len(fields)!=2 or fields[1]!='kB' or not fields[0].isdigit(): raise ValueError()
            values[key]=int(fields[0])*1024
        if set(values)!=required or values['MemTotal']<=0 or values['MemAvailable']>values['MemTotal']: raise ValueError()
        return values
    except (OSError,ValueError,UnicodeError):
        raise RuntimeError('host_memory_unproven') from None


def require_unheld_scope(target,account):
    try:
        if target['state']['running'] is not True or target['state']['OOMKilled'] is not False or any(type(target[k]['VmLckBytes'])is not int or target[k]['VmLckBytes']!=0 for k in ('wrapper','qdrant')) or type(account['unevictableBytes'])is not int or account['unevictableBytes']!=0 or any(type(account['memoryEvents'][k])is not int or account['memoryEvents'][k]!=0 for k in ('max','oom','oom_kill')):
            raise ValueError()
    except (KeyError,TypeError,ValueError):
        raise RuntimeError('running_unheld_scope_unproven') from None


def unheld_host_admission(policy,target,account):
    # Fixed frozen recipe, not a generic caller-provided lower floor.
    if policy.mode!='clone' or policy.max_locked_bytes!=2*pin.GIB or policy.reserve_bytes!=2*pin.GIB or policy.emergency_bytes!=3*pin.GIB//2 or policy.cap_reserve_bytes!=256*1024**2:
        raise RuntimeError('fixed_capacity_policy_changed')
    require_unheld_scope(target,account)
    memory=host_memory()
    floor=policy.max_locked_bytes+policy.reserve_bytes
    proof={'schema':'clone-running-headroom.cpu0-fixed.v2','admissionBasis':'frozen-max-lock-plus-reserve','observedPhase':'running-unheld','pinAdmission':False,
           'maxLockedBytes':policy.max_locked_bytes,'reserveBytes':policy.reserve_bytes,'emergencyBytes':policy.emergency_bytes,
           'hostMemAvailableBytes':memory['MemAvailable'],'hostMemTotalBytes':memory['MemTotal'],'hostMemAvailableFloorBytes':floor,
           'hostDirtyBytes':memory['Dirty'],'hostWritebackBytes':memory['Writeback'],'hostSwapBytes':memory['SwapTotal'],'strictGreaterThan':True}
    reason='swap_present' if memory['SwapTotal']!=0 else 'host_emergency_floor' if memory['MemAvailable']<=floor else None
    if reason:
        error=RuntimeError(reason);error.admissionFailureEvidence=proof;raise error
    return proof


def stopped_host_admission(state):
    if state.get('running')is not False or state.get('OOMKilled')is not False or type(state.get('exitCode'))is not int or state['exitCode']!=0:
        raise RuntimeError('clone_not_stopped')
    memory=host_memory()
    proof={'schema':'clone-stopped-headroom.cpu0.v2','admissionBasis':'unchanged-prestart-five-gib','observedPhase':'stopped','pinAdmission':False,
           'hostMemAvailableBytes':memory['MemAvailable'],'hostMemTotalBytes':memory['MemTotal'],'hostMemAvailableFloorBytes':5*pin.GIB,
           'hostDirtyBytes':memory['Dirty'],'hostWritebackBytes':memory['Writeback'],'hostSwapBytes':memory['SwapTotal'],'strictGreaterThan':True}
    reason='swap_present' if memory['SwapTotal']!=0 else 'cold_start_headroom' if memory['MemAvailable']<=5*pin.GIB else None
    if reason:
        error=RuntimeError(reason);error.admissionFailureEvidence=proof;raise error
    return proof


def query_memory(policy,scope):
    if policy.emergency_bytes!=3*pin.GIB//2 or scope not in ('before-query','after-query'):raise RuntimeError('fixed_capacity_policy_changed')
    memory=host_memory()
    proof={'schema':'clone-host-memory.cpu0.v2','scope':scope,'sampledAt':at(),'sampleMonotonicSeconds':time.monotonic(),
           'hostMemTotalBytes':memory['MemTotal'],'hostMemAvailableBytes':memory['MemAvailable'],'hostDirtyBytes':memory['Dirty'],
           'hostWritebackBytes':memory['Writeback'],'hostSwapBytes':memory['SwapTotal'],'hostMemAvailableFloorBytes':policy.emergency_bytes}
    reason='swap_present' if memory['SwapTotal']!=0 else 'host_emergency_floor' if memory['MemAvailable']<policy.emergency_bytes else None
    if reason:
        error=RuntimeError(reason);error.queryMemoryFailureEvidence=proof;raise error
    return proof


def working_set_admission(policy,inventory):
    if policy.max_locked_bytes!=2*pin.GIB or policy.reserve_bytes!=2*pin.GIB:raise RuntimeError('fixed_capacity_policy_changed')
    try:
        page=inventory['pageBytes']
        if type(page)is not int or page<=0:raise ValueError()
        total=resident=0
        for kind in ('vector','graph','sparse','other'):
            row=inventory['classesMeasured'][kind]
            if any(type(row[key])is not int for key in ('files','dataPages','residentDataPages')) or row['files']<=0 or row['dataPages']<=0 or not 0<=row['residentDataPages']<=row['dataPages']:raise ValueError()
            total+=row['dataPages']*page;resident+=row['residentDataPages']*page
        if not 0<total<=policy.max_locked_bytes:raise ValueError()
        if not re.fullmatch('[a-f0-9]{64}',inventory['selectionHash']):raise ValueError()
    except (KeyError,TypeError,ValueError):raise RuntimeError('working_set_inventory_unproven') from None
    memory=host_memory()
    proof={'schema':'clone-working-set-admission.cpu0.v2','observedPhase':'running-unheld','admissionBasis':'full-selected-lock-debit-plus-reserve',
           'selectionHash':inventory['selectionHash'],'selectedBytes':total,'selectedResidentBytes':resident,'selectedMissingBytes':total-resident,
           'maxLockedBytes':policy.max_locked_bytes,'reserveBytes':policy.reserve_bytes,'hostMemAvailableFloorBytes':total+policy.reserve_bytes,
           'hostMemAvailableBytes':memory['MemAvailable'],'hostMemTotalBytes':memory['MemTotal'],'hostDirtyBytes':memory['Dirty'],
           'hostWritebackBytes':memory['Writeback'],'hostSwapBytes':memory['SwapTotal'],'sampledAt':at(),'sampleMonotonicSeconds':time.monotonic(),'greaterThanOrEqual':True}
    reason='swap_present' if memory['SwapTotal']!=0 else 'projected_headroom_below_reserve' if memory['MemAvailable']-total<policy.reserve_bytes else None
    if reason:
        error=RuntimeError(reason);error.workingSetFailureEvidence=proof;raise error
    return proof


def admission_failure(error):
    return {key:getattr(error,key) for key in ('admissionFailureEvidence','queryMemoryFailureEvidence','workingSetFailureEvidence','pressureMemoryFailureEvidence','overheadFailureEvidence') if getattr(error,key,None)is not None}


def birth_admission(config,spec,policy,*,_entry_baseline=False):
    lifecycle=load_lifecycle(config)
    host_cpu=cpu0_guards.host_cpu();allocated=owned_total_budget();disk_free=shutil.disk_usage(ROOT).free
    if disk_free<=3*pin.GIB:raise RuntimeError('owned_total_disk_budget')
    source=inspect_source(spec);hierarchy=cpu0_guards.inspect_cpu_source(source,CPU_POLICY,runtime.docker)
    guard_shards(source)
    request=urllib.request.Request('http://127.0.0.1:16333/collections/media_fingerprint_v1',headers={'Connection':'close'})
    with urllib.request.urlopen(request,timeout=2)as response:info=json.load(response)['result']
    if (info['status'],info['optimizer_status'],info['points_count'],info['segments_count'],info['config']['params']['shard_number'])!=('green','ok',244262,12,6):raise RuntimeError('cold_collection_shape_changed')
    # attest proves actual running wrapper/Qdrant, exactly two source members,
    # no client/holder and both VmLck=0; no caller-supplied phase is accepted.
    target=lifecycle.attest(spec.container,runtime.docker)
    if target['qdrant']['pid']!=source.pid or target['qdrant']['startTicks']!=source.identity[3] or inspect_source(spec).identity!=source.identity:raise RuntimeError('lifecycle_process_changed')
    source_limits=_source_cgroup_limits(source,spec,lifecycle)
    outside=lifecycle.entry_resource_context(source) if _entry_baseline else None
    entry_source=lifecycle.entry_source_context(source) if _entry_baseline else None
    account=entry_source['accounting'] if _entry_baseline else runtime.accounting(source)
    headroom=unheld_host_admission(policy,target,account)
    try:
        if lifecycle.attest(spec.container,runtime.docker)!=target or inspect_source(spec).identity!=source.identity:raise RuntimeError('lifecycle_process_changed')
        require_unheld_scope(target,lifecycle.entry_source_context(source)['accounting'] if _entry_baseline else runtime.accounting(source))
        if _source_cgroup_limits(source,spec,lifecycle)!=source_limits:raise RuntimeError('source_limits_changed')
        if _entry_baseline:
            after=lifecycle.entry_resource_context(source)
            if any(outside[role]['identity']!=after[role]['identity'] for role in outside):raise RuntimeError('overhead_identity_changed')
    except BaseException as error:
        error.admissionFailureEvidence=headroom
        raise
    proof={'schema':'clone-birth-admission.cpu0-fixed.v2','variant':'cpu0-fixed-capacity.v2','at':at(),'sourceIdentity':list(source.identity),'target':target,'hostCpu':host_cpu,
            **{key:value for key,value in headroom.items() if key!='schema'},
            'ownedAllocatedBytes':allocated,'ownedAllocatedCeilingBytes':11*pin.GIB,'diskFreeBytes':disk_free,'diskFreeFloorBytes':3*pin.GIB,'cpuHierarchy':hierarchy,'pointCount':244262,'segmentCount':12,'shardCount':6,'clientsClosed':True}
    if _entry_baseline:
        proof['overheadBaseline']={'schema':'clone-entry-overhead-baseline.cpu0.v2','sourceIdentity':list(source.identity),'source':entry_source['source'],'outside':outside,'baselineChargeBytes':0,'baselineOnly':True,'pinAdmission':False,'unsampledPeakBytes':None,'preJoinHelperChargeUnattributed':True,'pageTablesIncludedInKernel':True}
    return proof


def _source_cgroup_limits(source,spec,lifecycle):
    limits={}
    for leaf,key in (('memory.max','memoryMaxBytes'),('memory.high','memoryHighBytes'),('memory.swap.max','memorySwapMaxBytes')):
        text=lifecycle.bounded(source.cgroup/leaf,128).decode('ascii').strip()
        if text=='max' and leaf=='memory.high':limits[key]=None
        elif text.isdigit() and int(text)<=2**53-1:limits[key]=int(text)
        else:raise RuntimeError('source_limits_changed')
    if spec.memory_bytes!=6*pin.GIB or spec.swap_bytes!=6*pin.GIB or limits['memoryMaxBytes']!=spec.memory_bytes or limits['memorySwapMaxBytes']!=0:raise RuntimeError('source_limits_changed')
    return limits


def _fixed_cpu_policy(config):
    expected={'periodMicros':100000,'weight':100,'cpusetCpus':'','cpusetMems':''}
    actual=config.get('cpuIsolation')
    cpu0_guards.validate_policy(actual)
    if actual!=expected:raise RuntimeError('cpu_policy_required')
    return actual


def _entry_identity_once(config,spec,policy):
    """Read immutable entry fences without taking an accounting baseline."""
    cpu_policy=_fixed_cpu_policy(config)
    lifecycle=load_lifecycle(config);source=runtime.inspect_source(spec)
    target=lifecycle.attest(spec.container,runtime.docker)
    if target['qdrant']['pid']!=source.pid or target['qdrant']['startTicks']!=source.identity[3]:raise RuntimeError('lifecycle_process_changed')
    limits=_source_cgroup_limits(source,spec,lifecycle)
    hierarchy=cpu0_guards.inspect_cpu_source(source,cpu_policy,runtime.docker)
    rows=[]
    for row in hierarchy['rows']:
        item={key:row[key] for key in ('depth','groupIdentitySha256','quotaMicros','periodMicros')}
        if 'applicability'in row:item['applicability']=row['applicability']
        rows.append(item)
    cpu_identity={key:hierarchy[key] for key in ('weight','cpusetCpus','cpusetMems')};cpu_identity['rows']=rows
    own=lifecycle.process(os.getpid());parent=lifecycle.process(own['parentPid'])
    outside={}
    for role,value in (('entryInspector',own),('transportParent',parent)):
        group=value['group'];source_group=source.cgroup_relative
        if group==source_group or group.startswith(source_group.rstrip('/')+'/'):raise RuntimeError('overhead_placement_unproven')
        outside[role]={**lifecycle.public_process(value),'outsideSourceCgroup':True}
    if lifecycle.bounded(Path('/proc')/str(os.getpid())/'task'/str(os.getpid())/'children',8192).split():raise RuntimeError('overhead_unregistered_child')
    return {'schema':'clone-entry-identity.cpu0.v2','sourceIdentity':list(source.identity),'target':target,'sourceLimits':limits,'cpuIdentity':cpu_identity,'outside':outside}


def entry_identity(config,spec,policy):
    """Pre/post intent comparison; no host sample, metrics, or caller roster."""
    before=_entry_identity_once(config,spec,policy)
    if _entry_identity_once(config,spec,policy)!=before:raise RuntimeError('lifecycle_process_changed')
    return before


def renew_cleanup(config,spec,policy,historical_source):
    """Renew source safety for independently observed owned-Node cleanup only."""
    if config.get('schema')!='clone-pin-control.cpu0-fixed.v2':raise RuntimeError('control_freeze_changed')
    cpu_policy=_fixed_cpu_policy(config)
    lifecycle=load_lifecycle(config);source=runtime.inspect_source(spec)
    current=lifecycle.cleanup_attest(spec.container,historical_source,runtime.docker)
    if current['qdrant']['pid']!=source.pid or current['qdrant']['startTicks']!=source.identity[3]:raise RuntimeError('lifecycle_process_changed')
    limits=_source_cgroup_limits(source,spec,lifecycle)
    hierarchy=cpu0_guards.inspect_cpu_source(source,cpu_policy,runtime.docker)
    events={}
    for row in lifecycle.bounded(source.cgroup/'memory.events',8192).decode('ascii').splitlines():
        values=row.split()
        if values and values[0]in ('max','oom','oom_kill'):
            if len(values)!=2 or values[0]in events or not values[1].isdigit() or int(values[1])>2**53-1:raise RuntimeError('required_limit_metrics_missing')
            events[values[0]]=int(values[1])
    if set(events)!={'max','oom','oom_kill'}:raise RuntimeError('required_limit_metrics_missing')
    after=lifecycle.cleanup_attest(spec.container,historical_source,runtime.docker)
    if _source_cgroup_limits(source,spec,lifecycle)!=limits:raise RuntimeError('source_limits_changed')
    hierarchy_after=cpu0_guards.inspect_cpu_source(source,cpu_policy,runtime.docker)
    cpu_identity=lambda value:{'rows':[{key:row[key]for key in ('depth','groupIdentitySha256','quotaMicros','periodMicros')if key in row}for row in value['rows']],**{key:value[key]for key in ('weight','cpusetCpus','cpusetMems')}}
    if cpu_identity(hierarchy)!=cpu_identity(hierarchy_after):raise RuntimeError('cpu_ancestor_changed')
    # Absolute connection/event/CPU usage observations are not identity fences.
    immutable=lambda value:{key:({'containerIdHash':part['containerIdHash'],'configurationHash':part['configurationHash'],'startedAt':part['startedAt']}if key=='state'else part)for key,part in value.items()if key not in ('activeServiceConnections','connectionCensusComplete')}
    if immutable(current)!=immutable(after) or runtime.inspect_source(spec).identity!=source.identity:raise RuntimeError('lifecycle_process_changed')
    return {'schema':'clone-cleanup-source-renewal.cpu0.v2','variant':'cpu0-fixed-capacity.v2','historicalSource':historical_source,'currentSource':current,'sourceIdentity':list(source.identity),'sourceLimits':limits,'cpuHierarchy':hierarchy,'sourceEvents':events,'lifecycleLineage':{'sameContainer':True,'sameConfiguration':True,'reviewedScript':True,'sameMountIdentity':True,'sameWrapperArgv':True,'recoveryDisallowed':True},'cleanupOnly':True,'admission':False}


def running_entry_admission(config,spec,policy):
    """Authenticated RPC caller gets internally derived entry context, no roster."""
    global CPU_POLICY
    CPU_POLICY=_fixed_cpu_policy(config)
    return birth_admission(config,spec,policy,_entry_baseline=True)


def cold(spec,config,policy,lock_fd,initial_admission):
    # Only owned container and clean owned store pages; never global drop_caches.
    cpu0_guards.host_cpu()
    lifecycle=load_lifecycle(config)
    inspect_stopped_or_running(spec)
    stopped=lifecycle.graceful_stop(spec.container,runtime.docker,lock_fd,protected_pids=(os.getpid(),os.getppid()),expected=initial_admission['target'])
    try:
        if inspect_stopped_or_running(spec)['State']['Running']: raise RuntimeError('clone_not_stopped')
        files, allocated = owned_store_files(spec.store);owned_total_budget();kernel = pin.Kernel(); resident = 0
        for path,identity in files:
            fd = os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
            try:
                s = os.fstat(fd)
                if (s.st_dev,s.st_ino,s.st_size) != identity or s.st_nlink != 1: raise RuntimeError('cold_inode_changed')
                os.fsync(fd); os.posix_fadvise(fd,0,0,os.POSIX_FADV_DONTNEED)
                if s.st_size:
                    address = kernel.map(fd,s.st_size)
                    try: resident += kernel.resident_pages(address,((0,(s.st_size+pin.PAGE-1)//pin.PAGE*pin.PAGE),))
                    finally: kernel.call('munmap',address,s.st_size)
            finally: os.close(fd)
        if resident != 0: raise RuntimeError('cold_eviction_not_complete')
        stopped_state=lifecycle.state_snapshot(inspect_stopped_or_running(spec))
        lifecycle.require_clean_receipt(stopped_state,stopped)
        stopped_admission=stopped_host_admission(stopped_state)
        if shutil.disk_usage(ROOT).free<=3*pin.GIB:raise RuntimeError('owned_total_disk_budget')
        clone_command('start',spec.container)
        deadline = time.monotonic()+90
        while time.monotonic()<deadline:
            try:
                request=urllib.request.Request('http://127.0.0.1:16333/collections/media_fingerprint_v1',headers={'Connection':'close'})
                with urllib.request.urlopen(request,timeout=2) as response:
                    info=json.load(response)['result']
                if info['status']=='green' and info['optimizer_status']=='ok':
                    if info['points_count']!=244262 or info['segments_count']!=12 or info['config']['params']['shard_number']!=6:raise RuntimeError('cold_collection_shape_changed')
                    break
            except OSError: pass
            time.sleep(1)
        else:
            raise RuntimeError('clone_readiness_failed')
        source = inspect_source(spec);guard_shards(source)
        admission=birth_admission(config,spec,policy)
        return {'at':at(),'actualQdrantPid':source.pid,'sourceStartTicks':source.identity[3],'ownedFiles':len(files),'ownedAllocatedBytes':allocated,'residentPagesAfterEviction':resident,
                'shardCount':6,'pointCount':daemon.integer(info['points_count'],1),'segmentCount':daemon.integer(info['segments_count'],1),'cleanStop':stopped,'stoppedAdmission':stopped_admission,'birthAdmission':admission}
    except BaseException as error:
        error.lifecycleCompletedStopReceipt=stopped
        raise


def process_counters(source):
    if inspect_source(source.spec).identity!=source.identity:raise RuntimeError('counter_source_changed')
    proc=Path('/proc')/str(source.pid);raw=(proc/'stat').read_text();fields=raw[raw.rfind(')')+2:].split()
    if int(fields[19])!=source.identity[3]:raise RuntimeError('counter_pid_reused')
    io={k.rstrip(':'):int(v) for k,v in (line.split() for line in (proc/'io').read_text().splitlines())}
    return {'minorFaults':daemon.integer(int(fields[7])),'majorFaults':daemon.integer(int(fields[9])),
            'physicalReadBytes':daemon.integer(io['read_bytes']),'rssBytes':daemon.integer(int(fields[21])*pin.PAGE)}


def counter_delta(before,after):
    out={k:after[k]-before[k] for k in ('minorFaults','majorFaults','physicalReadBytes','rssBytes')}
    if any(out[k]<0 for k in ('minorFaults','majorFaults','physicalReadBytes')):raise RuntimeError('counter_reset')
    return out


def limits(before,after,pressure=False,scope='turnover-join'):
    return cpu0_guards.resource_limits(before,after,pressure=pressure,scope=scope,account=daemon.account)


def inspect_source(spec):
    source=runtime.inspect_source(spec)
    cpu0_guards.inspect_cpu_source(source,CPU_POLICY,runtime.docker)
    return source


def self_cgroup():
    rows=Path('/proc/self/cgroup').read_text().splitlines()
    unified=[row[3:] for row in rows if row.startswith('0::')]
    if len(unified)!=1: raise RuntimeError('controller_cgroup_missing')
    return unified[0]


def host_available(floor,*,scope='archive-operation'):
    memory=host_memory()
    if memory['MemAvailable']<floor:
        error=RuntimeError('host_emergency_floor')
        error.pressureMemoryFailureEvidence={'schema':'clone-pressure-memory.cpu0.v2','scope':scope,'sampledAt':at(),'sampleMonotonicSeconds':time.monotonic(),
            'hostMemTotalBytes':memory['MemTotal'],'hostMemAvailableBytes':memory['MemAvailable'],'hostMemAvailableFloorBytes':floor,
            'hostDirtyBytes':memory['Dirty'],'hostWritebackBytes':memory['Writeback'],'hostSwapBytes':memory['SwapTotal']}
        raise error
    return memory['MemAvailable']


def owned_total_budget():
    seen=set();allocated=0
    for base,dirs,names in os.walk(ROOT,followlinks=False):
        for name in dirs+names:
            s=(Path(base)/name).lstat()
            if stat.S_ISLNK(s.st_mode):raise RuntimeError('owned_root_symlink')
            if stat.S_ISREG(s.st_mode) and (s.st_dev,s.st_ino) not in seen:
                seen.add((s.st_dev,s.st_ino));allocated+=s.st_blocks*512
            elif not stat.S_ISREG(s.st_mode) and not stat.S_ISDIR(s.st_mode):raise RuntimeError('owned_root_nonregular')
    if allocated>=11*pin.GIB or shutil.disk_usage(ROOT).free<=3*pin.GIB:raise RuntimeError('owned_total_disk_budget')
    return allocated


def verify_archive(floor):
    if ARCHIVE.resolve()!=ARCHIVE or ROOT.resolve()!=ROOT:raise RuntimeError('archive_path_scope')
    fd=os.open(ARCHIVE,os.O_RDONLY|os.O_NOFOLLOW)
    try:
        before=os.fstat(fd);path_info=ARCHIVE.lstat();sha=hashlib.sha256();read=0
        if (before.st_dev,before.st_ino,before.st_size)!=(path_info.st_dev,path_info.st_ino,path_info.st_size):raise RuntimeError('archive_fd_path_identity')
        files,_=owned_store_files(ROOT/'store');owned_total_budget()
        if (before.st_dev,before.st_ino) in {identity[:2] for _,identity in files}:raise RuntimeError('archive_store_inode_alias')
        if not stat.S_ISREG(before.st_mode) or before.st_size!=ARCHIVE_BYTES: raise RuntimeError('archive_scope')
        while True:
            host_available(floor,scope='archive-verification');data=os.read(fd,1024**2)
            if not data:break
            sha.update(data);read+=len(data)
            if read>ARCHIVE_BYTES:raise RuntimeError('archive_verification_bound')
        after=os.fstat(fd)
        if (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns)!=(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns) or read!=ARCHIVE_BYTES or sha.hexdigest()!=ARCHIVE_HASH:
            raise RuntimeError('archive_verification_failed')
        # Only this verified owned archive, before cold baseline; no global cache operation.
        path_info=ARCHIVE.lstat()
        if (path_info.st_dev,path_info.st_ino,path_info.st_size,path_info.st_mtime_ns)!=(before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns):raise RuntimeError('archive_path_changed_before_advice')
        os.fsync(fd);os.posix_fadvise(fd,0,0,os.POSIX_FADV_DONTNEED)
        return {'at':at(),'bytes':read,'sha256':sha.hexdigest(),'ownedArchiveAdviceCompleted':True}
    finally:os.close(fd)


def validate_child_source(source,spec):
    if source.spec!=spec or source.identity[1]!=spec.image:raise RuntimeError('source_rpc_spec_changed')
    return runtime.validate_source_locally(source)


def pin_child(connection,spec,policy,raise_limit,config,raise_own_nofile=False):
    manager=None
    try:
        def source_check(requested):
            if requested!=spec:raise RuntimeError('source_rpc_spec_changed')
            connection.send({'request':'inspect-source'})
            if not connection.poll(10):raise RuntimeError('source_rpc_timeout')
            reply=connection.recv()
            if set(reply)!={'source'}:raise RuntimeError('source_rpc_failed')
            return validate_child_source(reply['source'],spec)
        while True:
            command=connection.recv()
            if command=='close':break
            if command not in ('strict-pass','pressure-pass'):raise ValueError('invalid_pin_command')
            frozen_helper(config)
            if manager is None:
                source=source_check(spec);guard_shards(source)
                runtime.prepare_self(source,policy.max_locked_bytes,raise_own_limit=raise_limit,source_check=source_check)
                manager=pin.PinSet(policy,MODULE_DIR/'pin-instance.lock')
            state=runtime.reconcile_source(manager,spec,allow_clone_pressure_max=command=='pressure-pass',source_check=source_check,raise_own_nofile=raise_own_nofile)
            connection.send({'state':daemon.public_state(state)})
        if manager is not None:
            manager.close()
            if manager.release_state()!= {'released':True,'heldMappingCount':0}:raise RuntimeError('pin_release_unproven')
        manager=None;connection.send({'closed':True})
    except BaseException as error:
        reason=safe_control_reason(error);release={'released':manager is None,'heldMappingCount':0};cleanup_reasons=pin.failure_details(error).get('cleanupFailureReasons',[])
        if manager is not None:
            try:manager.close()
            except BaseException as cleanup_error:cleanup_reasons=[*cleanup_reasons,safe_control_reason(cleanup_error)]
            release=manager.release_state()
        try:connection.send({'failed':True,'reason':reason,'releaseState':release,'cleanupFailureReasons':cleanup_reasons})
        except BaseException:pass
        raise SystemExit(1)
    finally:connection.close()


class PinChild:
    def __init__(self,spec,policy,raise_limit,config,raise_own_nofile=False):
        self.config=config;self.failure_details=None
        multiprocessing.set_executable('/usr/bin/python3');context=multiprocessing.get_context('spawn');self.connection,child=context.Pipe()
        self.process=context.Process(target=pin_child,args=(child,spec,policy,raise_limit,config,raise_own_nofile));self.process.start();child.close();self.spec=spec;self.previous=None;self.pressure_active=False
    def request(self,pressure=False):
        before=runtime.accounting(inspect_source(self.spec))
        if self.previous is not None:limits(self.previous,before,pressure=pressure and self.pressure_active,scope='held-pin-prior-to-pass')
        self.connection.send('pressure-pass' if pressure and self.pressure_active else 'strict-pass')
        deadline=time.monotonic()+(self.config['initialPinRequestSeconds'] if self.previous is None else self.config['steadyPinRequestSeconds']);inspections=0
        while True:
            remaining=deadline-time.monotonic()
            if remaining<=0 or not self.connection.poll(remaining):raise RuntimeError('pin_child_timeout')
            reply=self.connection.recv()
            if reply=={'request':'inspect-source'}:
                inspections+=1
                if inspections>32:raise RuntimeError('source_rpc_budget')
                source=inspect_source(self.spec)
                if self_cgroup()==source.cgroup_relative:raise RuntimeError('parent_inspection_inside_clone_cgroup')
                self.connection.send({'source':source});continue
            break
        if reply.get('failed') is True:
            self.failure_details={'releaseState':reply.get('releaseState'),'cleanupFailureReasons':[x for x in reply.get('cleanupFailureReasons',[]) if x in CONTROL_REASONS]}
            reason=reply.get('reason')
            raise RuntimeError(reason if reason in CONTROL_REASONS else 'pin_child_failed')
        if set(reply)!={'state'}:raise RuntimeError('pin_child_failed')
        after=runtime.accounting(inspect_source(self.spec))
        limits(before,after,pressure=pressure and self.pressure_active and reply['state']['newLockBytes']==0 and not reply['state']['rangesChanged'],scope='held-pin-pass')
        self.previous=after
        rows=(Path('/proc')/str(self.process.pid)/'cgroup').read_text().splitlines()
        if '0::'+inspect_source(self.spec).cgroup_relative not in rows:raise RuntimeError('pin_child_placement')
        status=(Path('/proc')/str(self.process.pid)/'status').read_text().splitlines()
        locked=[int(line.split()[1])*1024 for line in status if line.startswith('VmLck:')]
        if len(locked)!=1 or locked[0]<reply['state']['lockedBytes']:raise RuntimeError('pin_holder_lock_proof_missing')
        return reply['state']
    def begin_pressure(self):
        current=runtime.accounting(inspect_source(self.spec))
        if self.previous is not None:limits(self.previous,current,scope='pressure-start-continuity')
        self.previous=current;self.pressure_active=True
    def end_pressure(self):
        current=runtime.accounting(inspect_source(self.spec))
        if self.previous is None:raise RuntimeError('pressure_ledger_missing')
        limits(self.previous,current,pressure=True,scope='pressure-end-continuity');self.previous=current;self.pressure_active=False
    def close(self):
        try:
            if self.process.is_alive():
                self.connection.send('close')
                if not self.connection.poll(5) or self.connection.recv()!={'closed':True}:raise RuntimeError('pin_child_cleanup')
                self.process.join(5)
            if self.process.is_alive():raise RuntimeError('pin_child_cleanup')
            if self.process.exitcode!=0:raise RuntimeError('pin_child_exit_failed')
        finally:
            if self.process.is_alive():self.process.terminate();self.process.join(5)
            if self.process.is_alive():self.process.kill();self.process.join(5)
            self.connection.close()
        if self.process.is_alive() or (Path('/proc')/str(self.process.pid)).exists():raise RuntimeError('pin_child_exit_unproven')


def pressure(config,source,manager=None,clock=time.monotonic,sleep=time.sleep,floor=None,overhead_check=None):
    if floor is None:raise ValueError('explicit_pressure_floor_required')
    p=config['pressure'];fd=os.open(ARCHIVE,os.O_RDONLY|os.O_NOFOLLOW)
    start=clock();started=at()
    if manager is not None:manager.begin_pressure()
    sha=hashlib.sha256(); read=0; last_pass=start;passes=0;pass_seconds=0;last_overhead=start
    try:
        original=os.fstat(fd)
        if not stat.S_ISREG(original.st_mode) or original.st_size!=p['bytes']: raise RuntimeError('archive_identity_failed')
        if overhead_check is not None:overhead_check()
        while True:
            chunk_started=clock();host_available(floor,scope='archive-pressure');data=os.read(fd,1024**2)
            if not data: break
            read+=len(data); sha.update(data)
            if read>p['bytes'] or clock()-start>p['maxSeconds']: raise RuntimeError('pressure_bound_failed')
            # Explicit pressure window is the actual owned read loop, not a supplied boolean.
            if manager is not None and clock()-last_pass>=config['reconcileIntervalSeconds']:
                pass_start=clock();manager.request(pressure=True);last_pass=clock();passes+=1;pass_seconds+=last_pass-pass_start
                if last_pass-start>p['maxSeconds']:raise RuntimeError('pressure_bound_failed')
            if overhead_check is not None and clock()-last_overhead>=config['reconcileIntervalSeconds']:
                overhead_check();last_overhead=clock()
            delay=len(data)/p['rateBytesPerSecond']-(clock()-chunk_started)
            if delay>0:sleep(delay)
            if clock()-start>p['maxSeconds']:raise RuntimeError('pressure_bound_failed')
        end=os.fstat(fd)
        if (end.st_dev,end.st_ino,end.st_size,end.st_mtime_ns)!=(original.st_dev,original.st_ino,original.st_size,original.st_mtime_ns) or read!=p['bytes'] or sha.hexdigest()!=p['sha256']:
            raise RuntimeError('archive_checksum_or_identity_changed')
        if clock()-start>p['maxSeconds']:raise RuntimeError('pressure_bound_failed')
        if inspect_source(source.spec).identity!=source.identity: raise RuntimeError('source_changed_during_pressure')
        if overhead_check is not None:overhead_check()
        return {'startedAt':started,'finishedAt':at(),'bytes':read,'seconds':round(clock()-start,3),'reconcileIntervalSeconds':config['reconcileIntervalSeconds'],'reconcilePassCount':passes,'reconcileSeconds':round(pass_seconds,3),'sha256':sha.hexdigest(),'storageContentWrites':0,'mode':'readonly-existing-archive','rateMode':'per-chunk-no-catch-up','chunkBytes':1024**2,'rateBytesPerSecond':p['rateBytesPerSecond']}
    finally:
        try:
            cpu0_guards.finalize_pressure(manager,sys.exc_info()[1])
        finally:os.close(fd)


def query_lease(seconds,reader=sys.stdin,clock=time.monotonic):
    fd=reader.fileno();deadline=clock()+seconds;line=b''
    while b'\n' not in line:
        remaining=deadline-clock()
        if remaining<=0:raise RuntimeError('query_lease_timeout')
        ready,_,_=select.select([fd],[],[],remaining)
        if not ready:raise RuntimeError('query_lease_timeout')
        part=os.read(fd,128-len(line))
        if not part:raise RuntimeError('query_lease_eof')
        line+=part
        if len(line)>=128:raise RuntimeError('invalid_query_ack')
    if line.count(b'\n')!=1 or not line.endswith(b'\n') or json.loads(line)!={'stage':'query-finished'}:raise RuntimeError('invalid_query_ack')


def stage(config,spec,policy,phase,emit,raise_own_memlock=False,case_tag=None,raise_own_nofile=False,handoff_sha=None):
    with inspector_scope():
        return _stage(config,spec,policy,phase,emit,raise_own_memlock,case_tag,raise_own_nofile,handoff_sha)


def _stage(config,spec,policy,phase,emit,raise_own_memlock=False,case_tag=None,raise_own_nofile=False,handoff_sha=None):
    if phase not in ('baseline','candidate'): raise ValueError('phase_required')
    manager=None; lock_fd=None;cpu_before=None;cpu_after=None;source=None;lifecycle=None;cold_state=None
    original_emit=emit
    emit=lambda row:original_emit({'variant':'cpu0-fixed-capacity.v2',**row})
    try:
        frozen_helper(config);load_cache_preparation(config)
        if ROOT.resolve()!=ROOT:raise RuntimeError('owned_root_changed')
        lock_fd=os.open(ROOT/'control.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
        s=os.fstat(lock_fd)
        if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.geteuid() or s.st_nlink!=1: raise RuntimeError('invalid_control_lock')
        fcntl.flock(lock_fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        os.set_inheritable(lock_fd,False)
        lifecycle=load_lifecycle(config);lifecycle.require_lock(lock_fd);lifecycle.read_handoff(runtime.docker,handoff_sha)
        initial_admission=birth_admission(config,spec,policy)
        entry_source=inspect_source(spec)
        entry_baseline=phase_overhead(config,entry_source,lock_fd,baseline=True)
        entry_overhead=lifecycle.overhead_growth(entry_baseline,phase_overhead(config,entry_source,lock_fd))
        original_group=self_cgroup();archive_verified=verify_archive(policy.emergency_bytes);cold_state=cold(spec,config,policy,lock_fd,initial_admission);source=inspect_source(spec)
        if original_group==source.cgroup_relative:raise RuntimeError('controller_pressure_already_in_clone_cgroup')
        cpu_before=cpu0_guards.inspect_cpu_source(source,CPU_POLICY,runtime.docker)
        overhead_baseline=phase_overhead(config,source,lock_fd,baseline=True)
        def overhead_check():return lifecycle.overhead_growth(overhead_baseline,phase_overhead(config,source,lock_fd,manager))
        overhead_check()
        preparation=prepare_cache(config,spec,policy,lock_fd,raise_own_nofile=raise_own_nofile)
        if inspect_source(spec).identity!=source.identity:raise RuntimeError('source_changed_after_cache_preparation')
        initial=runtime.measure_source(spec,raise_own_nofile=raise_own_nofile)
        continuity=limits(preparation['final']['accounting'],initial['accounting'],scope='preparation-to-inventory');working_set=working_set_admission(policy,initial)
        cache_overhead=overhead_check()
        emit({'schema':'search.clone-mlock-control.v3','stage':'cache-preparation-complete','cpuHierarchyBefore':cpu_before,'phase':phase,'at':at(),'cachePreparation':preparation,'cachePreparationMode':'post-cold-owned-cgroup-reclaim','cachePreparationHelperSha256':config['cachePreparation']['helperSha256'],'preparationToInitialLimits':continuity,'workingSetAdmission':working_set,'overheadEvidence':cache_overhead,'queries':0,'storageContentWrites':0})
        if phase=='candidate':
            nonresident=sum((initial['classesMeasured'][k]['dataPages']-initial['classesMeasured'][k]['residentDataPages'])*initial['pageBytes'] for k in ('vector','graph','sparse','other'))
            current=daemon.account(initial['accounting']);cap=current['cgroupMaxBytes']
            if cap is None or nonresident<0 or current['currentBytes']+nonresident+policy.cap_reserve_bytes>cap:
                error=RuntimeError('initial_cap_fit_inconclusive');error.workingSetFailureEvidence={**working_set,'sourceCurrentBytes':current['currentBytes'],'sourceCapBytes':cap,'capReserveBytes':policy.cap_reserve_bytes};raise error
            pin_proc_before=process_counters(source)
            with lifecycle.helper_fork_scope(lock_fd):
                manager=PinChild(spec,policy,raise_own_memlock,config,raise_own_nofile=raise_own_nofile)
            pin_state=manager.request();pin_proc_after=process_counters(source)
            limits(initial['accounting'],pin_state['accountingBefore'],scope='inventory-to-pin')
            if pin_state['selectionHash']!=initial['selectionHash']: raise RuntimeError('initial_cohort_changed')
        before=runtime.accounting(source);limits(initial['accounting'],before,scope='baseline-inventory-to-pressure') if phase=='baseline' else None;pressure_proc_before=process_counters(source);pressure_state=pressure(config,source,manager,floor=policy.emergency_bytes,overhead_check=overhead_check); after=runtime.accounting(source)
        pressure_proc_after=process_counters(source);owned_total_budget();pressure_limits=limits(before,after,pressure=True,scope='pressure-interval')
        if self_cgroup()!=original_group:raise RuntimeError('pressure_writer_placement_changed')
        measured=runtime.measure_source(spec,raise_own_nofile=raise_own_nofile)
        if inspect_source(spec).identity!=source.identity:raise RuntimeError('query_source_changed')
        measured_account=runtime.accounting(source);limits(after,measured_account,scope='pressure-to-inventory')
        if initial['selectionHash']!=measured['selectionHash']: raise RuntimeError('pressure_cohort_changed')
        resident_loss=sum(initial['classesMeasured'][k]['residentDataPages']-measured['classesMeasured'][k]['residentDataPages'] for k in ('vector','graph','sparse','other'))
        emit({'schema':'search.clone-mlock-control.v3','stage':'pressure-complete','phase':phase,'at':at(),'selectionHash':initial['selectionHash'],'selectedResidentDataPagesLost':resident_loss,'prequeryMissingBytes':sum((measured['classesMeasured'][k]['dataPages']-measured['classesMeasured'][k]['residentDataPages'])*measured['pageBytes'] for k in ('vector','graph','sparse','other')),'negativePrequeryMissingBytes':config.get('negativePrequeryMissingBytes',64*1024**2),'pressure':pressure_state,'pressureLimits':pressure_limits,'parentInitialNofileLimits':daemon.nofile_limits(initial['nofileLimits']),'parentNofileLimits':daemon.nofile_limits(measured['nofileLimits']),'residencyBeforePressure':initial['classesMeasured'],'residencyAfterPressure':measured['classesMeasured'],'queries':0,'storageContentWrites':0})
        missing_bytes=sum((measured['classesMeasured'][k]['dataPages']-measured['classesMeasured'][k]['residentDataPages'])*measured['pageBytes'] for k in ('vector','graph','sparse','other'))
        if phase=='baseline' and case_tag in config.get('mechanismNegativeTags',[]) and missing_bytes<config['negativePrequeryMissingBytes']:raise RuntimeError('negative_missing_pages_inconclusive')
        if manager is not None:
            final=manager.request()
            if final['selectionHash']!=initial['selectionHash'] or final['newLockBytes']!=0 or final['rangesChanged']: raise RuntimeError('candidate_cohort_changed')
        else:final=None;pin_state=None
        frozen_helper(config);guard_shards(source);query_before=runtime.accounting(source);limits(measured_account,query_before,scope='inventory-to-query');query_proc_before=process_counters(source);query_overhead_before=overhead_check();query_memory_before=query_memory(policy,'before-query');query_started=at()
        emit({'schema':'search.clone-mlock-control.v3','stage':'query-ready','cpuHierarchyBefore':cpu_before,'initialAdmission':initial_admission,'birthAdmission':cold_state['birthAdmission'],'phase':phase,'at':at(),'diagnosticReadySeconds':config['controlReadySeconds'],'cold':cold_state,'archiveVerified':archive_verified,'pressure':pressure_state,'pressureWriterPlacement':'controller-original-cgroup','pressureLimits':pressure_limits,'pressureProcessDelta':counter_delta(pressure_proc_before,pressure_proc_after),'queryWindowStartedAt':query_started,'queryMemoryBefore':query_memory_before,
              'selectionHash':initial['selectionHash'],'parentInitialNofileLimits':daemon.nofile_limits(initial['nofileLimits']),'parentNofileLimits':daemon.nofile_limits(measured['nofileLimits']),'residencyBeforePressure':initial['classesMeasured'],'residencyAfterPressure':measured['classesMeasured'],
              'initialPinState':pin_state,'initialPinProcessDelta':counter_delta(pin_proc_before,pin_proc_after) if phase=='candidate' else None,'pinState':final,'entryOverheadEvidence':entry_overhead,'overheadEvidence':query_overhead_before,'contentStillMutable':True,'queries':0,'storageContentWrites':0})
        query_lease(config['queryLeaseSeconds'])
        if inspect_source(spec).identity!=source.identity: raise RuntimeError('query_source_changed')
        frozen_helper(config);guard_shards(source);query_after=runtime.accounting(source);query_proc_after=process_counters(source);query_limits=limits(query_before,query_after,scope='query-interval')
        if manager is not None:
            held=manager.request()
            if held['selectionHash']!=initial['selectionHash'] or held['newLockBytes']!=0 or held['rangesChanged']:raise RuntimeError('query_pin_cohort_changed')
        post=runtime.measure_source(spec,raise_own_nofile=raise_own_nofile)
        limits(query_after,runtime.accounting(source),scope='post-query-inventory')
        if inspect_source(spec).identity!=source.identity:raise RuntimeError('query_source_changed')
        if post['selectionHash']!=initial['selectionHash']: raise RuntimeError('query_cohort_changed')
        cpu_after=cpu0_guards.inspect_cpu_source(source,CPU_POLICY,runtime.docker)
        cpu_deltas=cpu0_guards.cpu_delta(cpu_before,cpu_after)
        query_overhead_after=overhead_check();query_memory_after=query_memory(policy,'after-query')
        emit({'schema':'search.clone-mlock-control.v3','stage':'query-finished','cpuHierarchyBefore':cpu_before,'cpuHierarchyAfter':cpu_after,'cpuHierarchyDelta':cpu_deltas,'phase':phase,'at':at(),'queryWindowStartedAt':query_started,'queryMemoryBefore':query_memory_before,'queryMemoryAfter':query_memory_after,'queryLimits':query_limits,'queryProcessDelta':counter_delta(query_proc_before,query_proc_after),
              'selectionHash':post['selectionHash'],'parentNofileLimits':daemon.nofile_limits(post['nofileLimits']),'residencyAfterQuery':post['classesMeasured'],'pinStateAfterQuery':held if manager is not None else None,'overheadEvidence':query_overhead_after,'contentStillMutable':True,'queries':0,'storageContentWrites':0})
    except BaseException as error:
        cpu_snapshot_failure='cpu_phase_source_unavailable' if source is None else None
        if source is not None:
            try:cpu_after=cpu0_guards.inspect_cpu_source(source,CPU_POLICY,runtime.docker)
            except BaseException as snapshot_error:cpu_snapshot_failure=safe_control_reason(snapshot_error)
        emit({'schema':'search.clone-mlock-control.v3','stage':'phase-failed','phase':phase,'at':at(),'reason':safe_control_reason(error),'lifecycleCompletedStopReceipt':getattr(error,'lifecycleCompletedStopReceipt',None) or (cold_state.get('cleanStop') if cold_state is not None else None),'lifecycleFailureEvidence':getattr(error,'lifecycleFailureEvidence',None),'lifecycleCleanupFailure':getattr(error,'lifecycleCleanupFailure',None),'lifecycleDockerCleanupEvidence':getattr(error,'lifecycleDockerCleanupEvidence',None),'childFailureDetails':getattr(manager,'failure_details',None),'cachePreparationFailure':getattr(error,'reclaimEvidence',None),'resourceLimitEvidence':getattr(error,'resourceLimitEvidence',None),'cpuHierarchyEvidence':getattr(error,'cpuHierarchyEvidence',None),'hostCpuEvidence':getattr(error,'hostCpuEvidence',None),'cpuHierarchyBefore':cpu_before,'cpuHierarchyAfter':cpu_after,'cpuHierarchySnapshotFailure':cpu_snapshot_failure,'cpuHierarchyBeforeStatus':'observed' if cpu_before is not None else 'not-observed','pressureFinalizationFailure':getattr(error,'pressureFinalizationFailure',None),'queries':0,'storageContentWrites':0,**admission_failure(error)})
        raise
    finally:
        # Preserve the phase cause; cleanup evidence is a separate observation.
        original_error=sys.exc_info()[1];released=False;cleanup_error=None
        try:
            if manager is not None:manager.close()
            released=True
            if original_error is None:
                lifecycle.require_lock(lock_fd)
                handoff=lifecycle.commit_handoff(runtime.docker,handoff_sha,'controller')
                emit({'schema':'search.clone-mlock-control.v3','stage':'handoff-complete','phase':phase,'at':at(),'handoff':handoff,'queries':0,'storageContentWrites':0})
        except BaseException as error:cleanup_error=error
        finally:
            if lock_fd is not None:
                try:os.close(lock_fd)
                except BaseException:
                    if cleanup_error is None:cleanup_error=RuntimeError('lifecycle_lock_close_failed')
                    if original_error is not None:original_error.lifecycleCleanupFailure='lifecycle_lock_close_failed'
            gone=manager is None or (not manager.process.is_alive() and not (Path('/proc')/str(manager.process.pid)).exists())
            emit({'schema':'search.clone-mlock-control.v3','stage':'released','phase':phase,'at':at(),'released':released,'pinChildExited':gone,'pinChildExitCode':manager.process.exitcode if manager is not None else None,'cleanupReason':safe_control_reason(cleanup_error) if cleanup_error else None,'queries':0,'storageContentWrites':0})
        if cleanup_error is not None and original_error is None:raise cleanup_error
    emit({'schema':'search.clone-mlock-control.v3','stage':'unpin-complete','phase':phase,'at':at(),'pinChildExited':True,'queries':0,'storageContentWrites':0})


CONTROL_REASONS=frozenset(('archive_checksum_or_identity_changed', 'archive_fd_path_identity', 'archive_identity_failed', 'archive_path_changed_before_advice', 'archive_path_scope', 'archive_scope', 'archive_store_inode_alias', 'archive_verification_bound', 'archive_verification_failed', 'candidate_cohort_changed', 'clone_control_command_failed', 'clone_identity_ambiguous', 'clone_identity_changed', 'clone_mount_changed', 'clone_not_stopped', 'clone_readiness_failed', 'clone_resource_or_port_changed', 'cold_collection_shape_changed', 'cold_eviction_not_complete', 'cold_inode_changed', 'cold_start_headroom', 'control_freeze_changed', 'controller_cgroup_missing', 'controller_interrupted', 'controller_pressure_already_in_clone_cgroup', 'counter_pid_reused', 'counter_reset', 'counter_source_changed', 'explicit_control_arguments_required', 'explicit_control_policy_required', 'explicit_pressure_floor_required', 'helper_timing_policy_changed', 'fixed_readonly_archive_required', 'gate_freeze_changed', 'gate_interrupted', 'guard_or_runtime_failure', 'helper_freeze_changed', 'host_emergency_floor', 'initial_cap_fit_inconclusive', 'initial_cohort_changed', 'invalid_control_lock', 'invalid_pin_command', 'invalid_query_ack', 'join_source_changed', 'mapped_shard_coverage_missing', 'negative_missing_pages_inconclusive', 'owned_inode_alias', 'owned_nonregular', 'owned_root_changed', 'owned_root_nonregular', 'owned_root_symlink', 'owned_size_guard', 'owned_symlink', 'owned_total_disk_budget', 'parent_already_clone_cgroup', 'parent_cgroup_changed', 'parent_inspection_inside_clone_cgroup', 'phase_required', 'phase_resource_failed', 'pin_capability_missing', 'pin_child_cleanup', 'pin_child_exit_failed', 'pin_child_exit_unproven', 'pin_child_failed', 'pin_child_placement', 'pin_child_timeout', 'pin_holder_lock_proof_missing', 'pin_release_unproven', 'predeclared_negative_control_required', 'pressure_bound_failed', 'pressure_cannot_fit_deadline', 'pressure_cohort_changed', 'pressure_ledger_missing', 'pressure_placement_required', 'pressure_writer_placement_changed', 'query_cohort_changed', 'query_lease_eof', 'query_lease_timeout', 'query_pin_cohort_changed', 'query_source_changed', 'source_changed_during_pressure', 'source_rpc_budget', 'source_rpc_failed', 'source_rpc_spec_changed', 'source_rpc_timeout', 'source_spec_changed', 'turnover_not_fresh', 'turnover_readiness_failed', 'turnover_shape_changed', 'zero_child_cleanup_failed', 'zero_child_exit_unproven', 'zero_child_lease_failed', 'zero_child_timeout', 'zero_join_failed', 'zero_join_proof_missing', 'zero_pin_proof_missing')) | pin.SAFE_REASONS

CONTROL_REASONS |= frozenset(('host_memory_unproven','fixed_capacity_policy_changed','running_unheld_scope_unproven','working_set_inventory_unproven'))
CONTROL_REASONS |= cpu0_guards.REASONS | frozenset(('cpu_phase_source_unavailable','pressure_finalization_failed'))
CONTROL_REASONS |= frozenset(('lifecycle_target_refused','lifecycle_freeze_changed','lifecycle_process_changed','lifecycle_wrapper_unreviewed','lifecycle_recovery_allowed','lifecycle_membership_changed','lifecycle_connection_present','lifecycle_connection_unknown','lifecycle_reader_placement','lifecycle_lock_unproven','lifecycle_stop_timeout','lifecycle_stop_unclean','lifecycle_clean_receipt_missing','lifecycle_handoff_changed','lifecycle_handoff_invalid','lifecycle_fork_scope_active','lifecycle_guard_or_runtime_failure','lifecycle_pidfd_close_failed','lifecycle_lock_close_failed','lifecycle_handoff_cleanup_failed','lifecycle_interpreter_unsupported','lifecycle_docker_unavailable','lifecycle_docker_cleanup_failed'))

CONTROL_REASONS |= frozenset(('explicit_cache_preparation_required','cache_preparation_freeze_changed','cache_preparation_policy_changed','source_changed_after_cache_preparation','source_changed','swap_present','locked_source_pages','dirty_source_pages','source_children_present','source_limits_changed','ancestor_limits_changed','parent_placement_changed','reclaim_fd_changed','reclaim_timeout','reclaim_writer_survived','reclaim_write_failed','reclaim_resource_event','post_cap_fit_inconclusive','metadata_health_changed','source_freeze_changed','invalid_reclaim_lock','prepared_input_changed','writer_start_failed','quiescence_bound_exceeded','postwrite_zero_timeout','postwrite_sample_bound_exceeded','writer_birth_unavailable','writer_birth_changed','writer_registration_failed','writer_parent_changed','writer_interrupted','writer_cleanup_unproven','writer_registration_timeout','writer_protocol_failed','writer_prewrite_timeout'))

CONTROL_REASONS |= frozenset(('preflight_source_unproven','preflight_loader_unproven','preflight_stdin_unproven','preflight_argv_unproven','consumer_argv_invalid','consumer_executable_changed','node_provenance_changed','consumer_enrolment_write_failed','overhead_placement_unproven','overhead_measurement_unproven','overhead_identity_changed','overhead_unregistered_child','overhead_growth_exceeded','overhead_inspector_scope_active','overhead_inspector_unproven','consumer_registry_unproven','overhead_helper_unproven'))

def safe_control_reason(error):
    return next((x for x in error.args if type(x) is str and x in CONTROL_REASONS),'guard_or_runtime_failure')


def main(argv=None):
    parser=daemon.SafeParser(description=__doc__); parser.add_argument('--config');parser.add_argument('--policy-sha256');parser.add_argument('--code-sha256')
    parser.add_argument('--handoff-sha256')
    parser.add_argument('--phase',choices=('baseline','candidate'));parser.add_argument('--case-tag',choices=('coverage-history-080628','coverage-history-083054','heldout-person','heldout-description','heldout-unseen-native','control-native-title','control-low-vote-title'));parser.add_argument('--execute-reviewed',action='store_true');parser.add_argument('--raise-own-memlock',action='store_true');parser.add_argument('--raise-own-nofile',action='store_true')
    emit=lambda x:print(json.dumps(x,sort_keys=True),flush=True)
    try:
        args=parser.parse_args(argv)
        if not args.execute_reviewed:
            emit({'schema':'search.clone-mlock-control.v3','stage':'prepared-only','execution':False,'queries':0,'storageContentWrites':0});return 0
        if not args.config or not args.phase or not args.case_tag or not args.handoff_sha256: raise ValueError('explicit_control_arguments_required')
        def interrupted(signum,frame):raise RuntimeError('controller_interrupted')
        signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
        c,spec,policy=load_control(args.config,args.policy_sha256,args.code_sha256)
        stage(c,spec,policy,args.phase,lambda x:emit({**x,'helperCodeSha256':c['helperCodeSha256'],'helperPolicySha256':c['helperPolicySha256'],'controllerCodeSha256':args.code_sha256,'controllerPolicySha256':args.policy_sha256}),args.raise_own_memlock,args.case_tag,args.raise_own_nofile,args.handoff_sha256)
        return 0
    except BaseException as error:
        reason=safe_control_reason(error)
        emit({'schema':'search.clone-mlock-control.v3','stage':'failed','reason':reason,'queries':0,'storageContentWrites':0,**admission_failure(error)});return 1


if __name__=='__main__': raise SystemExit(main())
