"""Prepared clone-only cold/pressure controls. Holds candidate pins through query lease.

Default prepares only. No private query payload is accepted or emitted. No production mode.
"""
import sys
sys.dont_write_bytecode = True
import argparse
import ctypes
from datetime import datetime, timezone
import fcntl
import hashlib
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
import daemon
import pin
import runtime

ROOT = daemon.ROOT
ARCHIVE = ROOT/'rename-proof/media-20261011T041503Z.snapshot'
ARCHIVE_HASH = '614149a3885293985ad912d2ed92bf03fa23f42235bb6ddde78e9991c22c64eb'
ARCHIVE_BYTES = 4428863488


def at(): return datetime.now(timezone.utc).isoformat()
def digest(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_control(path, policy_hash, code_hash):
    raw = Path(path).read_bytes()
    if len(raw) > 16384 or hashlib.sha256(raw).hexdigest() != policy_hash or digest(__file__) != code_hash:
        raise ValueError('control_freeze_changed')
    c = json.loads(raw)
    if set(c) != {'schema', 'helperConfig', 'helperPolicySha256', 'helperCodeSha256', 'pressure', 'queryLeaseSeconds', 'pressurePlacement', 'mechanismNegativeTags','initialPinRequestSeconds','steadyPinRequestSeconds','negativePrequeryMissingBytes','reconcileIntervalSeconds'} or c['schema'] != 'clone-pin-control.v1':
        raise ValueError('explicit_control_policy_required')
    if c['pressurePlacement'] != 'controller-original-cgroup': raise ValueError('pressure_placement_required')
    if c['mechanismNegativeTags']!=['control-native-title']:raise ValueError('predeclared_negative_control_required')
    p = c['pressure']
    if set(p) != {'archive', 'bytes', 'sha256', 'rateBytesPerSecond', 'maxSeconds'} or p['archive'] != str(ARCHIVE) or p['bytes'] != ARCHIVE_BYTES or p['sha256'] != ARCHIVE_HASH:
        raise ValueError('fixed_readonly_archive_required')
    daemon.integer(p['rateBytesPerSecond'], 1, 64*1024**2); daemon.integer(p['maxSeconds'], 70, 180)
    daemon.integer(c['queryLeaseSeconds'], 60, 60)
    daemon.integer(c['initialPinRequestSeconds'],180,180);daemon.integer(c['steadyPinRequestSeconds'],30,30)
    daemon.integer(c['negativePrequeryMissingBytes'],64*1024**2,64*1024**2)
    daemon.integer(c['reconcileIntervalSeconds'],10,10)
    if p['bytes']/p['rateBytesPerSecond'] > p['maxSeconds']:
        raise ValueError('pressure_cannot_fit_deadline')
    config, spec, policy = daemon.load_config(c['helperConfig'], c['helperPolicySha256'], c['helperCodeSha256'])
    if config['intervalSeconds']!=c['reconcileIntervalSeconds'] or config['lifetimeSeconds']!=600:raise ValueError('helper_timing_policy_changed')
    if 'pin' not in config['actions']:
        raise ValueError('pin_capability_missing')
    return c, spec, policy


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
    x = data[0]; h = x['HostConfig']
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
    try:
        subprocess.run(['/usr/bin/docker',*args],check=True,timeout=35,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    except (OSError,subprocess.SubprocessError):raise RuntimeError('clone_control_command_failed') from None


def cold(spec):
    # Only owned container and clean owned store pages; never global drop_caches.
    inspect_stopped_or_running(spec)
    clone_command('stop','--time','20',spec.container)
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
    available = next(int(l.split()[1])*1024 for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:'))
    if available <= 5*pin.GIB or shutil.disk_usage(ROOT).free <= 3*pin.GIB:
        raise RuntimeError('cold_start_headroom')
    inspect_stopped_or_running(spec); clone_command('start',spec.container)
    deadline = time.monotonic()+90
    while time.monotonic()<deadline:
        try:
            with urllib.request.urlopen('http://127.0.0.1:16333/collections/media_fingerprint_v1',timeout=2) as response:
                info=json.load(response)['result']
            if info['status']=='green' and info['optimizer_status']=='ok':
                if info['points_count']!=244262 or info['segments_count']!=12 or info['config']['params']['shard_number']!=6:raise RuntimeError('cold_collection_shape_changed')
                break
        except OSError: pass
        time.sleep(1)
    else:
        clone_command('stop','--time','3',spec.container); raise RuntimeError('clone_readiness_failed')
    source = runtime.inspect_source(spec);guard_shards(source)
    return {'at':at(),'actualQdrantPid':source.pid,'sourceStartTicks':source.identity[3],'ownedFiles':len(files),'ownedAllocatedBytes':allocated,'residentPagesAfterEviction':resident,
            'shardCount':6,'pointCount':daemon.integer(info['points_count'],1),'segmentCount':daemon.integer(info['segments_count'],1)}


def process_counters(source):
    if runtime.inspect_source(source.spec).identity!=source.identity:raise RuntimeError('counter_source_changed')
    proc=Path('/proc')/str(source.pid);raw=(proc/'stat').read_text();fields=raw[raw.rfind(')')+2:].split()
    if int(fields[19])!=source.identity[3]:raise RuntimeError('counter_pid_reused')
    io={k.rstrip(':'):int(v) for k,v in (line.split() for line in (proc/'io').read_text().splitlines())}
    return {'minorFaults':daemon.integer(int(fields[7])),'majorFaults':daemon.integer(int(fields[9])),
            'physicalReadBytes':daemon.integer(io['read_bytes']),'rssBytes':daemon.integer(int(fields[21])*pin.PAGE)}


def counter_delta(before,after):
    out={k:after[k]-before[k] for k in ('minorFaults','majorFaults','physicalReadBytes','rssBytes')}
    if any(out[k]<0 for k in ('minorFaults','majorFaults','physicalReadBytes')):raise RuntimeError('counter_reset')
    return out


def limits(before,after,pressure=False):
    before,after=daemon.account(before),daemon.account(after)
    m={k:after['memoryEvents'][k]-before['memoryEvents'][k] for k in ('oom','oom_kill','max')}
    c={k:after['cpu'][k]-before['cpu'][k] for k in ('nr_throttled','throttled_usec')}
    if any(v<0 for v in (*m.values(),*c.values())) or m['oom'] or m['oom_kill'] or m['max'] and not pressure or any(c.values()):
        raise RuntimeError('phase_resource_failed')
    return {'memoryEventDelta':m,'cpuLimitDelta':c,'pressureMaxException':pressure}


def self_cgroup():
    rows=Path('/proc/self/cgroup').read_text().splitlines()
    unified=[row[3:] for row in rows if row.startswith('0::')]
    if len(unified)!=1: raise RuntimeError('controller_cgroup_missing')
    return unified[0]


def host_available(floor):
    available=next(int(l.split()[1])*1024 for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:'))
    if available<floor:raise RuntimeError('host_emergency_floor')
    return available


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
            host_available(floor);data=os.read(fd,1024**2)
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


def pin_child(connection,spec,policy,raise_limit,config):
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
            state=runtime.reconcile_source(manager,spec,allow_clone_pressure_max=command=='pressure-pass',source_check=source_check)
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
    def __init__(self,spec,policy,raise_limit,config):
        self.config=config;self.failure_details=None
        multiprocessing.set_executable('/usr/bin/python3');context=multiprocessing.get_context('spawn');self.connection,child=context.Pipe()
        self.process=context.Process(target=pin_child,args=(child,spec,policy,raise_limit,config));self.process.start();child.close();self.spec=spec;self.previous=None;self.pressure_active=False
    def request(self,pressure=False):
        before=runtime.accounting(runtime.inspect_source(self.spec))
        if self.previous is not None:limits(self.previous,before,pressure=pressure and self.pressure_active)
        self.connection.send('pressure-pass' if pressure and self.pressure_active else 'strict-pass')
        deadline=time.monotonic()+(self.config['initialPinRequestSeconds'] if self.previous is None else self.config['steadyPinRequestSeconds']);inspections=0
        while True:
            remaining=deadline-time.monotonic()
            if remaining<=0 or not self.connection.poll(remaining):raise RuntimeError('pin_child_timeout')
            reply=self.connection.recv()
            if reply=={'request':'inspect-source'}:
                inspections+=1
                if inspections>32:raise RuntimeError('source_rpc_budget')
                source=runtime.inspect_source(self.spec)
                if self_cgroup()==source.cgroup_relative:raise RuntimeError('parent_inspection_inside_clone_cgroup')
                self.connection.send({'source':source});continue
            break
        if reply.get('failed') is True:
            self.failure_details={'releaseState':reply.get('releaseState'),'cleanupFailureReasons':[x for x in reply.get('cleanupFailureReasons',[]) if x in CONTROL_REASONS]}
            reason=reply.get('reason')
            raise RuntimeError(reason if reason in CONTROL_REASONS else 'pin_child_failed')
        if set(reply)!={'state'}:raise RuntimeError('pin_child_failed')
        after=runtime.accounting(runtime.inspect_source(self.spec))
        limits(before,after,pressure=pressure and self.pressure_active and reply['state']['newLockBytes']==0 and not reply['state']['rangesChanged'])
        self.previous=after
        rows=(Path('/proc')/str(self.process.pid)/'cgroup').read_text().splitlines()
        if '0::'+runtime.inspect_source(self.spec).cgroup_relative not in rows:raise RuntimeError('pin_child_placement')
        status=(Path('/proc')/str(self.process.pid)/'status').read_text().splitlines()
        locked=[int(line.split()[1])*1024 for line in status if line.startswith('VmLck:')]
        if len(locked)!=1 or locked[0]<reply['state']['lockedBytes']:raise RuntimeError('pin_holder_lock_proof_missing')
        return reply['state']
    def begin_pressure(self):
        current=runtime.accounting(runtime.inspect_source(self.spec))
        if self.previous is not None:limits(self.previous,current)
        self.previous=current;self.pressure_active=True
    def end_pressure(self):
        current=runtime.accounting(runtime.inspect_source(self.spec))
        if self.previous is None:raise RuntimeError('pressure_ledger_missing')
        limits(self.previous,current,pressure=True);self.previous=current;self.pressure_active=False
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


def pressure(config,source,manager=None,clock=time.monotonic,sleep=time.sleep,floor=None):
    if floor is None:raise ValueError('explicit_pressure_floor_required')
    p=config['pressure'];fd=os.open(ARCHIVE,os.O_RDONLY|os.O_NOFOLLOW)
    start=clock();started=at()
    if manager is not None:manager.begin_pressure()
    sha=hashlib.sha256(); read=0; last_pass=start;passes=0;pass_seconds=0
    try:
        original=os.fstat(fd)
        if not stat.S_ISREG(original.st_mode) or original.st_size!=p['bytes']: raise RuntimeError('archive_identity_failed')
        while True:
            chunk_started=clock();host_available(floor);data=os.read(fd,1024**2)
            if not data: break
            read+=len(data); sha.update(data)
            if read>p['bytes'] or clock()-start>p['maxSeconds']: raise RuntimeError('pressure_bound_failed')
            # Explicit pressure window is the actual owned read loop, not a supplied boolean.
            if manager is not None and clock()-last_pass>=config['reconcileIntervalSeconds']:
                pass_start=clock();manager.request(pressure=True);last_pass=clock();passes+=1;pass_seconds+=last_pass-pass_start
                if last_pass-start>p['maxSeconds']:raise RuntimeError('pressure_bound_failed')
            delay=len(data)/p['rateBytesPerSecond']-(clock()-chunk_started)
            if delay>0:sleep(delay)
            if clock()-start>p['maxSeconds']:raise RuntimeError('pressure_bound_failed')
        end=os.fstat(fd)
        if (end.st_dev,end.st_ino,end.st_size,end.st_mtime_ns)!=(original.st_dev,original.st_ino,original.st_size,original.st_mtime_ns) or read!=p['bytes'] or sha.hexdigest()!=p['sha256']:
            raise RuntimeError('archive_checksum_or_identity_changed')
        if clock()-start>p['maxSeconds']:raise RuntimeError('pressure_bound_failed')
        if runtime.inspect_source(source.spec).identity!=source.identity: raise RuntimeError('source_changed_during_pressure')
        return {'startedAt':started,'finishedAt':at(),'bytes':read,'seconds':round(clock()-start,3),'reconcileIntervalSeconds':config['reconcileIntervalSeconds'],'reconcilePassCount':passes,'reconcileSeconds':round(pass_seconds,3),'sha256':sha.hexdigest(),'storageContentWrites':0,'mode':'readonly-existing-archive','rateMode':'per-chunk-no-catch-up','chunkBytes':1024**2,'rateBytesPerSecond':p['rateBytesPerSecond']}
    finally:
        try:
            if manager is not None:manager.end_pressure()
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


def stage(config,spec,policy,phase,emit,raise_own_memlock=False,case_tag=None):
    if phase not in ('baseline','candidate'): raise ValueError('phase_required')
    manager=None; lock_fd=None
    try:
        frozen_helper(config)
        if ROOT.resolve()!=ROOT:raise RuntimeError('owned_root_changed')
        lock_fd=os.open(ROOT/'control.lock',os.O_CREAT|os.O_RDWR|os.O_NOFOLLOW,0o600)
        s=os.fstat(lock_fd)
        if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.geteuid() or s.st_nlink!=1: raise RuntimeError('invalid_control_lock')
        fcntl.flock(lock_fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
        original_group=self_cgroup();archive_verified=verify_archive(policy.emergency_bytes);cold_state=cold(spec);source=runtime.inspect_source(spec)
        if original_group==source.cgroup_relative:raise RuntimeError('controller_pressure_already_in_clone_cgroup')
        initial=runtime.measure_source(spec)
        if phase=='candidate':
            nonresident=sum((initial['classesMeasured'][k]['dataPages']-initial['classesMeasured'][k]['residentDataPages'])*initial['pageBytes'] for k in ('vector','graph','sparse','other'))
            current=daemon.account(initial['accounting']);cap=current['cgroupMaxBytes']
            if cap is None or nonresident<0 or current['currentBytes']+nonresident+policy.cap_reserve_bytes>cap:raise RuntimeError('initial_cap_fit_inconclusive')
            pin_proc_before=process_counters(source);manager=PinChild(spec,policy,raise_own_memlock,config);pin_state=manager.request();pin_proc_after=process_counters(source)
            if pin_state['selectionHash']!=initial['selectionHash']: raise RuntimeError('initial_cohort_changed')
        before=runtime.accounting(source);limits(initial['accounting'],before) if phase=='baseline' else None;pressure_proc_before=process_counters(source);pressure_state=pressure(config,source,manager,floor=policy.emergency_bytes); after=runtime.accounting(source)
        pressure_proc_after=process_counters(source);owned_total_budget();pressure_limits=limits(before,after,pressure=True)
        if self_cgroup()!=original_group:raise RuntimeError('pressure_writer_placement_changed')
        measured=runtime.measure_source(spec)
        if runtime.inspect_source(spec).identity!=source.identity:raise RuntimeError('query_source_changed')
        measured_account=runtime.accounting(source);limits(after,measured_account)
        if initial['selectionHash']!=measured['selectionHash']: raise RuntimeError('pressure_cohort_changed')
        resident_loss=sum(initial['classesMeasured'][k]['residentDataPages']-measured['classesMeasured'][k]['residentDataPages'] for k in ('vector','graph','sparse','other'))
        emit({'schema':'search.clone-mlock-control.v2','stage':'pressure-complete','phase':phase,'at':at(),'selectionHash':initial['selectionHash'],'selectedResidentDataPagesLost':resident_loss,'prequeryMissingBytes':sum((measured['classesMeasured'][k]['dataPages']-measured['classesMeasured'][k]['residentDataPages'])*measured['pageBytes'] for k in ('vector','graph','sparse','other')),'negativePrequeryMissingBytes':config.get('negativePrequeryMissingBytes',64*1024**2),'pressure':pressure_state,'pressureLimits':pressure_limits,'residencyBeforePressure':initial['classesMeasured'],'residencyAfterPressure':measured['classesMeasured'],'queries':0,'storageContentWrites':0})
        missing_bytes=sum((measured['classesMeasured'][k]['dataPages']-measured['classesMeasured'][k]['residentDataPages'])*measured['pageBytes'] for k in ('vector','graph','sparse','other'))
        if phase=='baseline' and case_tag in config.get('mechanismNegativeTags',[]) and missing_bytes<config['negativePrequeryMissingBytes']:raise RuntimeError('negative_missing_pages_inconclusive')
        if manager is not None:
            final=manager.request()
            if final['selectionHash']!=initial['selectionHash'] or final['newLockBytes']!=0 or final['rangesChanged']: raise RuntimeError('candidate_cohort_changed')
        else:final=None;pin_state=None
        frozen_helper(config);guard_shards(source);query_before=runtime.accounting(source);limits(measured_account,query_before);query_proc_before=process_counters(source);query_started=at()
        emit({'schema':'search.clone-mlock-control.v2','stage':'query-ready','phase':phase,'at':at(),'cold':cold_state,'archiveVerified':archive_verified,'pressure':pressure_state,'pressureWriterPlacement':'controller-original-cgroup','pressureLimits':pressure_limits,'pressureProcessDelta':counter_delta(pressure_proc_before,pressure_proc_after),'queryWindowStartedAt':query_started,
              'selectionHash':initial['selectionHash'],'residencyBeforePressure':initial['classesMeasured'],'residencyAfterPressure':measured['classesMeasured'],
              'initialPinState':pin_state,'initialPinProcessDelta':counter_delta(pin_proc_before,pin_proc_after) if phase=='candidate' else None,'pinState':final,'contentStillMutable':True,'queries':0,'storageContentWrites':0})
        query_lease(config['queryLeaseSeconds'])
        if runtime.inspect_source(spec).identity!=source.identity: raise RuntimeError('query_source_changed')
        frozen_helper(config);guard_shards(source);query_after=runtime.accounting(source);query_proc_after=process_counters(source);query_limits=limits(query_before,query_after)
        if manager is not None:
            held=manager.request()
            if held['selectionHash']!=initial['selectionHash'] or held['newLockBytes']!=0 or held['rangesChanged']:raise RuntimeError('query_pin_cohort_changed')
        post=runtime.measure_source(spec)
        limits(query_after,runtime.accounting(source))
        if runtime.inspect_source(spec).identity!=source.identity:raise RuntimeError('query_source_changed')
        if post['selectionHash']!=initial['selectionHash']: raise RuntimeError('query_cohort_changed')
        emit({'schema':'search.clone-mlock-control.v2','stage':'query-finished','phase':phase,'at':at(),'queryWindowStartedAt':query_started,'queryLimits':query_limits,'queryProcessDelta':counter_delta(query_proc_before,query_proc_after),
              'selectionHash':post['selectionHash'],'residencyAfterQuery':post['classesMeasured'],'pinStateAfterQuery':held if manager is not None else None,'contentStillMutable':True,'queries':0,'storageContentWrites':0})
    except BaseException as error:
        emit({'schema':'search.clone-mlock-control.v2','stage':'phase-failed','phase':phase,'at':at(),'reason':safe_control_reason(error),'childFailureDetails':getattr(manager,'failure_details',None),'queries':0,'storageContentWrites':0})
        raise
    finally:
        # Preserve the phase cause; cleanup evidence is a separate observation.
        original_error=sys.exc_info()[1];released=False;cleanup_error=None
        try:
            if manager is not None:manager.close()
            released=True
        except BaseException as error:cleanup_error=error
        finally:
            if lock_fd is not None:os.close(lock_fd)
            gone=manager is None or (not manager.process.is_alive() and not (Path('/proc')/str(manager.process.pid)).exists())
            emit({'schema':'search.clone-mlock-control.v2','stage':'released','phase':phase,'at':at(),'released':released,'pinChildExited':gone,'pinChildExitCode':manager.process.exitcode if manager is not None else None,'cleanupReason':safe_control_reason(cleanup_error) if cleanup_error else None,'queries':0,'storageContentWrites':0})
        if cleanup_error is not None and original_error is None:raise cleanup_error
    emit({'schema':'search.clone-mlock-control.v2','stage':'unpin-complete','phase':phase,'at':at(),'pinChildExited':True,'queries':0,'storageContentWrites':0})


CONTROL_REASONS=frozenset(('archive_checksum_or_identity_changed', 'archive_fd_path_identity', 'archive_identity_failed', 'archive_path_changed_before_advice', 'archive_path_scope', 'archive_scope', 'archive_store_inode_alias', 'archive_verification_bound', 'archive_verification_failed', 'candidate_cohort_changed', 'clone_control_command_failed', 'clone_identity_ambiguous', 'clone_identity_changed', 'clone_mount_changed', 'clone_not_stopped', 'clone_readiness_failed', 'clone_resource_or_port_changed', 'cold_collection_shape_changed', 'cold_eviction_not_complete', 'cold_inode_changed', 'cold_start_headroom', 'control_freeze_changed', 'controller_cgroup_missing', 'controller_interrupted', 'controller_pressure_already_in_clone_cgroup', 'counter_pid_reused', 'counter_reset', 'counter_source_changed', 'explicit_control_arguments_required', 'explicit_control_policy_required', 'explicit_pressure_floor_required', 'helper_timing_policy_changed', 'fixed_readonly_archive_required', 'gate_freeze_changed', 'gate_interrupted', 'guard_or_runtime_failure', 'helper_freeze_changed', 'host_emergency_floor', 'initial_cap_fit_inconclusive', 'initial_cohort_changed', 'invalid_control_lock', 'invalid_pin_command', 'invalid_query_ack', 'join_source_changed', 'mapped_shard_coverage_missing', 'negative_missing_pages_inconclusive', 'owned_inode_alias', 'owned_nonregular', 'owned_root_changed', 'owned_root_nonregular', 'owned_root_symlink', 'owned_size_guard', 'owned_symlink', 'owned_total_disk_budget', 'parent_already_clone_cgroup', 'parent_cgroup_changed', 'parent_inspection_inside_clone_cgroup', 'phase_required', 'phase_resource_failed', 'pin_capability_missing', 'pin_child_cleanup', 'pin_child_exit_failed', 'pin_child_exit_unproven', 'pin_child_failed', 'pin_child_placement', 'pin_child_timeout', 'pin_holder_lock_proof_missing', 'pin_release_unproven', 'predeclared_negative_control_required', 'pressure_bound_failed', 'pressure_cannot_fit_deadline', 'pressure_cohort_changed', 'pressure_ledger_missing', 'pressure_placement_required', 'pressure_writer_placement_changed', 'query_cohort_changed', 'query_lease_eof', 'query_lease_timeout', 'query_pin_cohort_changed', 'query_source_changed', 'source_changed_during_pressure', 'source_rpc_budget', 'source_rpc_failed', 'source_rpc_spec_changed', 'source_rpc_timeout', 'source_spec_changed', 'turnover_not_fresh', 'turnover_readiness_failed', 'turnover_shape_changed', 'zero_child_cleanup_failed', 'zero_child_exit_unproven', 'zero_child_lease_failed', 'zero_child_timeout', 'zero_join_failed', 'zero_join_proof_missing', 'zero_pin_proof_missing')) | pin.SAFE_REASONS

def safe_control_reason(error):
    return next((x for x in error.args if type(x) is str and x in CONTROL_REASONS),'guard_or_runtime_failure')


def main(argv=None):
    parser=daemon.SafeParser(description=__doc__); parser.add_argument('--config');parser.add_argument('--policy-sha256');parser.add_argument('--code-sha256')
    parser.add_argument('--phase',choices=('baseline','candidate'));parser.add_argument('--case-tag',choices=('coverage-history-080628','coverage-history-083054','heldout-person','heldout-description','heldout-unseen-native','control-native-title','control-low-vote-title'));parser.add_argument('--execute-reviewed',action='store_true');parser.add_argument('--raise-own-memlock',action='store_true')
    emit=lambda x:print(json.dumps(x,sort_keys=True),flush=True)
    try:
        args=parser.parse_args(argv)
        if not args.execute_reviewed:
            emit({'schema':'search.clone-mlock-control.v2','stage':'prepared-only','execution':False,'queries':0,'storageContentWrites':0});return 0
        if not args.config or not args.phase or not args.case_tag: raise ValueError('explicit_control_arguments_required')
        def interrupted(signum,frame):raise RuntimeError('controller_interrupted')
        signal.signal(signal.SIGTERM,interrupted);signal.signal(signal.SIGINT,interrupted)
        c,spec,policy=load_control(args.config,args.policy_sha256,args.code_sha256)
        stage(c,spec,policy,args.phase,lambda x:emit({**x,'helperCodeSha256':c['helperCodeSha256'],'helperPolicySha256':c['helperPolicySha256'],'controllerCodeSha256':args.code_sha256,'controllerPolicySha256':args.policy_sha256}),args.raise_own_memlock,args.case_tag)
        return 0
    except BaseException as error:
        reason=safe_control_reason(error)
        emit({'schema':'search.clone-mlock-control.v2','stage':'failed','reason':reason,'queries':0,'storageContentWrites':0});return 1


if __name__=='__main__': raise SystemExit(main())
