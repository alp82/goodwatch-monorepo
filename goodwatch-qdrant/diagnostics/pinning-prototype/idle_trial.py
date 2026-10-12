"""Prepared, bounded idle-only lock/release experiment; no persistent service."""
import argparse
from collections import deque
from contextlib import contextmanager
import ctypes
import fcntl
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import stat
import sys
import threading
import time

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import pin
import production
import runtime
import zero_placement

HOST_KEYS = ('MemAvailable', 'MemFree', 'Dirty', 'Writeback', 'WritebackTmp', 'SwapTotal', 'Mlocked', 'Unevictable')
STAT_KEYS = ('anon', 'kernel', 'file', 'shmem', 'file_dirty', 'file_writeback', 'unevictable')
RECLAIM_KEYS = ('allocstall_dma', 'allocstall_dma32', 'allocstall_normal', 'allocstall_movable', 'allocstall_device', 'pgscan_direct', 'workingset_refault_file')
MEMORY_KEYS = ('max', 'oom', 'oom_kill')
CPU_KEYS = ('nr_throttled', 'throttled_usec')
SCIENTIFIC_KEYS = ('allocstall_dma', 'allocstall_dma32', 'allocstall_normal', 'allocstall_movable', 'allocstall_device', 'workingset_refault_file')
SAFETY_REASONS = frozenset({'idle_headroom', 'idle_dirty_growth', 'idle_anon_growth', 'idle_kernel_growth', 'idle_limit_event',
    'idle_metric_missing', 'idle_metric_reset', 'idle_poll_stale', 'idle_main_stale', 'idle_source_changed', 'idle_schedule_expired',
    'idle_holder_deadline', 'idle_code_changed', 'idle_guard_failure', 'idle_interrupted', 'idle_initial_timeout', 'idle_buffer_full'})
SAFETY_REASONS |= frozenset({'local_source_identity_changed','production_allocation_changed','production_oom_group_changed',
    'supervisor_placement_changed','source_or_emergency_headroom_changed_after_locking','emergency_headroom_release',
    'initial_pin_memory_limit_event','initial_pin_cpu_limit_event','limit_metrics_reset_during_pass',
    'required_limit_metrics_missing','source_resources_changed','source_cgroup_changed','source_image_or_running_changed',
    'source_mounts_changed','source_changed_before_helper_accounting','source_changed_during_pass',
    'source_changed_during_inventory','source_identity_changed','holder_placement_changed','holder_lock_proof_missing',
    'holder_state_source_changed','holder_state_policy_exceeded','holder_release_unproven','invalid_holder_reply',
    'invalid_production_state','invalid_nofile_proof','holder_code_changed',
    'docker_inspection_failed','actual_qdrant_pid_ambiguous','actual_qdrant_comm_changed',
    'idle_holder_disappeared','holder_disappeared','production_limit_event'})
NON_URGENT_REASONS=frozenset({'idle_quiet_pressure','idle_hold_complete'})
REASONS = SAFETY_REASONS | production.PRODUCTION_REASONS | {'idle_full_budget_admission_failed', 'invalid_idle_policy',
    'idle_quiet_pressure', 'idle_initial_timeout', 'idle_holder_disappeared', 'idle_second_reconcile', 'idle_hold_complete',
    'idle_baseline_pressure', 'idle_release_not_graceful', 'idle_registration_unproven', 'idle_execution_not_reviewed', 'idle_policy_changed'}


def reason(error):
    value = str(error)
    return value if type(error) in (RuntimeError, ValueError) and value in REASONS else 'idle_guard_failure'


def code_hash():
    digest = hashlib.sha256()
    for name in ('pin.py', 'runtime.py', 'production.py', 'production_journal.py', 'zero_placement.py', 'idle_trial.py'):
        digest.update(name.encode() + b'\0' + (Path(__file__).parent / name).read_bytes() + b'\0')
    return digest.hexdigest()



def load_policy(path, digest):
    with Path(path).open('rb') as stream: raw=stream.read(16385)
    if len(raw)>16384 or hashlib.sha256(raw).hexdigest()!=digest:raise ValueError('idle_policy_changed')
    config=json.loads(raw)
    expected={'schema':'production-idle-lock-release.v1','maxLockedBytes':2*pin.GIB,
        'floorBytes':2*pin.GIB,'transientAllowanceBytes':6*pin.GIB,'includePayload':False,
        'capReserveBytes':256*1024**2,'mappingReserveCount':1024,'baselineSeconds':30,
        'initialSeconds':180,'holdSeconds':30,'cleanupSeconds':20,'pollSeconds':2}
    if config!=expected or any(type(config[k])is not type(v)for k,v in expected.items()):raise ValueError('invalid_idle_policy')
    return pin.IdlePolicy()

def required(values, keys):
    if any(key not in values or type(values[key]) is not int or values[key] < 0 for key in keys):
        raise RuntimeError('idle_metric_missing')
    return {key: values[key] for key in keys}


def parse_meminfo(text):
    values = {}
    for row in text.splitlines():
        fields = row.split()
        if fields and fields[0].rstrip(':') in HOST_KEYS:
            key = fields[0].rstrip(':')
            if key in values or len(fields) != 3 or fields[2] != 'kB' or not fields[1].isdigit():
                raise RuntimeError('idle_metric_missing')
            values[key] = int(fields[1]) * 1024
    return required(values, HOST_KEYS)


def parse_counters(text, keys):
    values = {}
    for row in text.splitlines():
        fields = row.split()
        if fields and fields[0] in keys:
            if fields[0] in values or len(fields) != 2 or not fields[1].isdigit():
                raise RuntimeError('idle_metric_missing')
            values[fields[0]] = int(fields[1])
    return required(values, keys)


def parse_psi(text):
    result = {}
    for row in text.splitlines():
        fields = row.split()
        if fields and fields[0] in ('some', 'full'):
            totals = [v[6:] for v in fields[1:] if v.startswith('total=')]
            if fields[0] in result or len(totals) != 1 or not totals[0].isdigit():
                raise RuntimeError('idle_metric_missing')
            result[fields[0]] = int(totals[0])
    return required(result, ('some', 'full'))


def effective_available(host):
    return max(0, host['MemAvailable'] - host['Dirty'] - host['Writeback'])


def _sample(source, proc_root, cgroup_root, validate):
    """Fresh local proc/cgroup reads only. Main observes overdue reader separately."""
    start = time.monotonic_ns()
    validate(source)
    host = parse_meminfo((proc_root/'meminfo').read_text())
    group = source.cgroup
    stat = parse_counters((group / 'memory.stat').read_text(), STAT_KEYS)
    current = (group / 'memory.current').read_text().strip()
    if not current.isdigit(): raise RuntimeError('idle_metric_missing')
    limits = {'memoryMax': (group/'memory.max').read_text().strip(), 'memoryHigh': (group/'memory.high').read_text().strip(),
              'cpuMax': (group/'cpu.max').read_text().strip(), 'oomGroup': (group/'memory.oom.group').read_text().strip()}
    if limits != {'memoryMax':'max', 'memoryHigh':'max', 'cpuMax':'max 100000', 'oomGroup':'0'}:
        raise RuntimeError('idle_source_changed')
    ancestor=[]; parent=group
    for _ in range(64):
        values=tuple(None if parent==cgroup_root and not (parent/name).exists() else (parent/name).read_text().strip() for name in ('memory.max','memory.high','cpu.max'))
        if any(value not in (None,'max')for value in values[:2]) or values[2] is not None and not values[2].startswith('max '):
            raise RuntimeError('idle_source_changed')
        ancestor.append(values)
        if parent==cgroup_root:break
        if parent==parent.parent:raise RuntimeError('idle_source_changed')
        parent=parent.parent
    else:raise RuntimeError('idle_source_changed')
    row = {'source':{'pid':source.pid,'startTicks':source.identity[3],
        'cgroupHash':hashlib.sha256(source.cgroup_relative.encode()).hexdigest(),
        'ancestorLimitHash':hashlib.sha256(repr(ancestor).encode()).hexdigest()}, 'startMonoNs':start, 'host':host, 'effectiveAvailableBytes':effective_available(host),
           'sourceMemory':{**stat, 'current':int(current)},
           'memoryEvents':parse_counters((group/'memory.events').read_text(), MEMORY_KEYS),
           'cpuEvents':parse_counters((group/'cpu.stat').read_text(), CPU_KEYS),
           'reclaim':parse_counters((proc_root/'vmstat').read_text(), RECLAIM_KEYS),
           'psi':{key:parse_psi((proc_root/'pressure'/key).read_text()) for key in ('memory', 'io')}}
    validate(source)
    row['endMonoNs'] = time.monotonic_ns()
    if row['endMonoNs']-start > 1_000_000_000: raise RuntimeError('idle_poll_stale')
    return row



def sample(source):
    return _sample(source,Path('/proc'),Path('/sys/fs/cgroup'),runtime.validate_source_locally)

def accounting(source):
    row = sample(source)
    return {'availableBytes':row['effectiveAvailableBytes'], 'cgroupMaxBytes':None,
        'anonBytes':row['sourceMemory']['anon'], 'kernelBytes':row['sourceMemory']['kernel'],
        'fileBytes':row['sourceMemory']['file'], 'unevictableBytes':row['sourceMemory']['unevictable'],
        'currentBytes':row['sourceMemory']['current'], 'memoryEvents':row['memoryEvents'], 'cpu':row['cpuEvents']}


def check_pressure(before, now, hold=None):
    if now['source']!=before['source']:raise RuntimeError('idle_source_changed')
    for key in ('memoryEvents', 'cpuEvents', 'reclaim'):
        if any(now[key][k] < before[key][k] for k in before[key]): raise RuntimeError('idle_metric_reset')
    for key in ('memory', 'io'):
        if any(now['psi'][key][k] < before['psi'][key][k] for k in ('some', 'full')): raise RuntimeError('idle_metric_reset')
    if now['host']['SwapTotal'] != 0 or now['effectiveAvailableBytes'] < 8*pin.GIB: raise RuntimeError('idle_headroom')
    if now['host']['Dirty']+now['host']['Writeback'] > pin.GIB: raise RuntimeError('idle_dirty_growth')
    if now['sourceMemory']['anon']-before['sourceMemory']['anon'] > 3*pin.GIB//2: raise RuntimeError('idle_anon_growth')
    if now['sourceMemory']['kernel']-before['sourceMemory']['kernel'] > 256*1024**2: raise RuntimeError('idle_kernel_growth')
    if now['memoryEvents'] != before['memoryEvents'] or now['cpuEvents'] != before['cpuEvents']: raise RuntimeError('idle_limit_event')
    if hold is not None:
        if any(now['reclaim'][k] > hold['reclaim'][k] for k in SCIENTIFIC_KEYS) or any(now['psi'][k]['full'] > hold['psi'][k]['full'] for k in ('memory','io')):
            raise RuntimeError('idle_quiet_pressure')



def backup_lease(row):
    """Outer known-job check is fresh and separate from the local pressure poll."""
    keys={'checkedMonoNs','nextBackupMonoNs','knownBackupIdle','knownSnapshotPhaseIdle','scheduleSha256'}
    if type(row)is not dict or set(row)!=keys or row['knownBackupIdle']is not True or row['knownSnapshotPhaseIdle']is not True:
        raise RuntimeError('idle_schedule_expired')
    for key in ('checkedMonoNs','nextBackupMonoNs'):
        if type(row[key])is not int or row[key]<0:raise RuntimeError('idle_schedule_expired')
    now=time.monotonic_ns()
    if not 0<=now-row['checkedMonoNs']<=1_000_000_000 or row['nextBackupMonoNs']<=now:
        raise RuntimeError('idle_schedule_expired')
    value=row['scheduleSha256']
    if type(value)is not str or len(value)!=64 or any(c not in '0123456789abcdef'for c in value):raise RuntimeError('idle_schedule_expired')
    return row['nextBackupMonoNs'],value

class Guard:
    """Independent pressure/deadline guard. Signal handlers only set a bool."""
    def __init__(self, reader, baseline, boundary, poll=2, stale=4, main_stale=12,
                 clock=time.monotonic, interrupted=lambda:False):
        self.reader=reader;self.baseline=baseline;self.boundary=boundary;self.poll=poll
        self.stale=stale;self.main_stale=main_stale;self.clock=clock;self.interrupted=interrupted
        self.lock=threading.Lock();self.stop=threading.Event();self.worker=None
        self.first_reason=None;self.first_origin=None;self.safety_reason=None;self.last_poll=clock();self.last_main=clock()
        self.hold=None;self.hold_end=None;self.release_end=None;self.phase='baseline'
        self.rows=deque(maxlen=256);self.thread=threading.Thread(target=self.run,daemon=True);self.thread.start()

    def trip(self,value,origin='guard'):
        if origin not in ('guard','main'):raise ValueError('idle_guard_failure')
        with self.lock:
            if self.first_reason is None:self.first_reason=value;self.first_origin=origin
            if value in SAFETY_REASONS and self.safety_reason is None:self.safety_reason=value
            worker=self.worker
            urgent=value in SAFETY_REASONS or worker is not None and value not in NON_URGENT_REASONS
            if urgent and self.safety_reason is None:self.safety_reason=value
        if urgent and worker is not None and worker.alive_owned():worker.signal_owned(signal.SIGKILL)

    def attach(self,worker):
        with self.lock:
            if self.first_reason is not None:raise RuntimeError(self.first_reason)
            self.worker=worker

    def pulse(self):
        if self.interrupted():self.trip('idle_interrupted',origin='main')
        now=self.clock()
        with self.lock:
            self.last_main=now;stale=now-self.last_poll>self.stale;value=self.first_reason
        if stale:self.trip('idle_poll_stale',origin='main');value=self.first_reason
        if value is not None:raise RuntimeError(value)

    def set_phase(self,phase):
        with self.lock:self.phase=phase

    def begin_hold(self,row,seconds=30):
        with self.lock:
            self.hold=row;self.hold_end=self.clock()+seconds;self.release_end=self.hold_end+20;self.phase='hold'
        return self.hold_end

    def begin_cleanup(self):
        with self.lock:
            self.phase='cleanup';self.hold=None;self.release_end=min(self.release_end or float('inf'),self.clock()+20)

    def drain(self):
        with self.lock:
            rows=list(self.rows);self.rows.clear()
        return rows

    def run(self):
        while not self.stop.is_set():
            try:
                now=self.clock()
                with self.lock:
                    main=self.last_main;hold=self.hold;release_end=self.release_end;phase=self.phase
                if self.interrupted():raise RuntimeError('idle_interrupted')
                if now>=self.boundary:raise RuntimeError('idle_schedule_expired')
                if release_end is not None and now>=release_end:raise RuntimeError('idle_holder_deadline')
                if phase!='cleanup' and now-main>self.main_stale:raise RuntimeError('idle_main_stale')
                row=self.reader()
                with self.lock:
                    if len(self.rows)==self.rows.maxlen:raise RuntimeError('idle_buffer_full')
                    self.last_poll=self.clock();self.rows.append({'phase':phase,'sample':row})
                # Retain the triggering observation before evaluating it.
                check_pressure(self.baseline,row,hold)
            except BaseException as error:
                value=reason(error);self.trip(value)
                if value=='idle_quiet_pressure':
                    with self.lock:self.hold=None
                else:return
            self.stop.wait(self.poll)

    def close(self):
        self.stop.set();self.thread.join(1.1)
        return not self.thread.is_alive()


def holder(connection, spec, policy, lock_path, raise_memlock, raise_nofile, expected_hash, lifetime=230):
    manager=None
    try:
        if threading.current_thread() is not threading.main_thread(): raise RuntimeError('idle_guard_failure')
        if code_hash()!=expected_hash: raise RuntimeError('idle_code_changed')
        parent=os.getppid()
        if parent<=1 or ctypes.CDLL(None,use_errno=True).prctl(1,signal.SIGTERM,0,0,0)!=0 or os.getppid()!=parent:
            raise RuntimeError('holder_parent_identity_changed')
        signal.signal(signal.SIGTERM,signal.SIG_DFL); signal.signal(signal.SIGALRM,signal.SIG_DFL)
        signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGTERM,signal.SIGALRM})
        signal.setitimer(signal.ITIMER_REAL,lifetime)
        def source_check(requested):
            if requested!=spec:raise RuntimeError('source_rpc_spec_changed')
            connection.send({'request':'source'})
            if not connection.poll(15):raise RuntimeError('source_rpc_timeout')
            reply=connection.recv()
            if type(reply)is not dict or set(reply)!={'source'} or reply['source'].spec!=spec:raise RuntimeError('source_rpc_spec_changed')
            return runtime.validate_source_locally(reply['source'])
        before=resource.getrlimit(resource.RLIMIT_MEMLOCK)
        used=False
        while connection.poll(60):
            command=connection.recv()
            if command=='close':break
            if command!='reconcile' or used:raise RuntimeError('idle_second_reconcile')
            used=True
            if code_hash()!=expected_hash:raise RuntimeError('idle_code_changed')
            source=source_check(spec)
            runtime.prepare_self(source,policy.max_locked_bytes,raise_own_limit=raise_memlock,source_check=source_check)
            manager=pin.PinSet(policy,Path(lock_path))
            state=runtime.reconcile_source(manager,spec,source_check=source_check,raise_own_nofile=raise_nofile,accounting_reader=accounting)
            after=resource.getrlimit(resource.RLIMIT_MEMLOCK)
            state['memlockLimits']={k:None if v==resource.RLIM_INFINITY else v for k,v in zip(('softBefore','hardBefore','softAfter','hardAfter'),(*before,*after))}
            state.update(mode='production',queries=0,storageWrites=0)
            connection.send({'state':production.safe_state(state)})
        if manager is not None:
            manager.close()
            if manager.release_state()!= {'released':True,'heldMappingCount':0}:raise RuntimeError('holder_release_unproven')
        connection.send({'closed':True})
    except BaseException as error:
        if manager is not None:
            try:manager.close()
            except BaseException:pass
        try:connection.send({'failed':reason(error)})
        except BaseException:pass
        raise SystemExit(1)
    finally:connection.close()


def _run(config,spec,register,emit,holder_lock,lease_check,expected_hash,policy_hash,
         raise_memlock=False,raise_nofile=False,reader=sample,check_source=production.check_source,
         worker_factory=production.Holder,baseline_seconds=30,hold_seconds=30,initial_seconds=180,
         poll=2,guard_factory=Guard):
    """Private fixture seam; public run holds the shared lock and fixed timings."""
    if threading.current_thread() is not threading.main_thread():raise RuntimeError('idle_guard_failure')
    if (baseline_seconds,hold_seconds,initial_seconds,poll)!=(30,30,180,2) and worker_factory is production.Holder:
        raise RuntimeError('invalid_idle_policy')
    policy=pin.IdlePolicy();original=production.own_group();worker=None;guard=None;cleanup=None
    cause=None;main_reason=None;initial=None;hold=None;schedule_hash=None;previous={};stopped=False
    started=time.monotonic()
    def output(row):emit({'event':'qdrant.idle-lock-trial.v1','policyBasis':'idle-2g-floor-6g-transient.v1',
        'codeSha256':expected_hash,'policySha256':policy_hash,'scheduleSha256':schedule_hash,
        'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'queries':0,'storageWrites':0,**row})
    def interrupted(_s,_f):
        nonlocal stopped
        stopped=True  # No locks, pipe operations, Event.set, or signals here.
    def fresh_source():
        fresh=check_source(config,spec,original)
        if fresh.identity!=identity:raise RuntimeError('idle_source_changed')
        if backup_lease(lease_check())!=(boundary_ns,schedule_hash):raise RuntimeError('idle_schedule_expired')
        return fresh
    def drain():
        for row in guard.drain():output(row)
    try:
        if code_hash()!=expected_hash:raise RuntimeError('idle_code_changed')
        source=check_source(config,spec,original);identity=source.identity
        boundary_ns,schedule_hash=backup_lease(lease_check());boundary=boundary_ns/1_000_000_000
        if boundary-started<baseline_seconds+initial_seconds+hold_seconds+20+120:raise RuntimeError('idle_schedule_expired')
        initial=reader(source);check_pressure(initial,initial)
        output({'phase':'baseline_start','sample':initial})
        guard=guard_factory(lambda:reader(source),initial,boundary-120,poll=poll,interrupted=lambda:stopped)
        for sig in (signal.SIGTERM,signal.SIGINT):previous[sig]=signal.signal(sig,interrupted)
        end=time.monotonic()+baseline_seconds
        while time.monotonic()<end:
            guard.pulse();fresh_source();drain();time.sleep(min(poll,max(0,end-time.monotonic())))
        guard.pulse();admitted=reader(fresh_source());check_pressure(initial,admitted,initial)
        if admitted['effectiveAvailableBytes']<policy.admission_bytes:raise RuntimeError('idle_full_budget_admission_failed')
        output({'phase':'admitted','sample':admitted,'fullBudgetBytes':policy.max_locked_bytes,'retainBytes':policy.reserve_bytes})
        if code_hash()!=expected_hash:raise RuntimeError('idle_code_changed')
        guard.pulse();fresh_source();guard.set_phase('initial')
        worker=worker_factory(holder,(spec,policy,str(holder_lock),raise_memlock,raise_nofile,expected_hash,initial_seconds+hold_seconds+20))
        birth=production.holder_birth(worker)
        if register(dict(birth)) is not True:raise RuntimeError('idle_registration_unproven')
        output(birth);guard.attach(worker);worker.connection.send('reconcile')
        deadline=time.monotonic()+initial_seconds;requests=0;state=None
        while time.monotonic()<deadline:
            guard.pulse();fresh=fresh_source();drain()
            if not worker.connection.poll(poll):continue
            try:reply=worker.connection.recv()
            except (EOFError,OSError):raise RuntimeError('idle_holder_disappeared') from None
            if reply=={'request':'source'}:
                requests+=1
                if requests>32:raise RuntimeError('source_rpc_budget')
                worker.connection.send({'source':fresh});continue
            if type(reply)is dict and set(reply)=={'failed'}:
                if reply['failed'] in NON_URGENT_REASONS:raise RuntimeError('invalid_holder_reply')
                raise RuntimeError(reply['failed'] if reply['failed'] in REASONS else 'idle_guard_failure')
            if type(reply)is not dict or set(reply)!={'state'}:raise RuntimeError('invalid_holder_reply')
            state=production.safe_state({**reply['state'],'mode':'production','queries':0,'storageWrites':0});break
        if state is None:raise RuntimeError('idle_initial_timeout')
        guard.pulse();fresh=fresh_source();proof=production.verify_holder(worker,fresh,state,policy)
        if (proof['holderPid'],proof['holderStartTicks'])!=(birth['holderPid'],birth['holderStartTicks']):raise RuntimeError('holder_placement_changed')
        hold=reader(fresh);check_pressure(initial,hold);end=guard.begin_hold(hold,hold_seconds)
        output({'phase':'lock_ready',**state,**proof,'sample':hold,'initialSelfChargeIncluded':True})
        while time.monotonic()<end:
            guard.pulse()
            if code_hash()!=expected_hash:raise RuntimeError('idle_code_changed')
            fresh_source()
            if not worker.alive_owned():raise RuntimeError('idle_holder_disappeared')
            drain();time.sleep(min(poll,max(0,end-time.monotonic())))
        # Hold expiration is not a guard reason. All final fences still execute.
        guard.pulse();fresh=fresh_source()
        if not worker.alive_owned():raise RuntimeError('idle_holder_disappeared')
        end_proof=production.verify_holder(worker,fresh,state,policy)
        if (end_proof['holderPid'],end_proof['holderStartTicks'])!=(birth['holderPid'],birth['holderStartTicks']):raise RuntimeError('holder_placement_changed')
        final_sample=reader(fresh);check_pressure(initial,final_sample,hold)
        output({'phase':'pre_release',**end_proof,'sample':final_sample});cause='idle_hold_complete'
    except BaseException as error:
        main_reason=reason(error);cause=main_reason
        if guard is not None:guard.trip(main_reason,origin='main')
    finally:
        urgent=cause in SAFETY_REASONS or worker is not None and cause not in NON_URGENT_REASONS or guard is not None and guard.safety_reason is not None
        cleanup_reason=None;shutdown_reason=None;drain_reason=None;post_reason=None;guard_exited=True
        if guard is not None:guard.begin_cleanup()
        if worker is not None:
            try:
                if urgent and worker.alive_owned():worker.signal_owned(signal.SIGKILL)
                cleanup=worker.close(emergency=urgent)
            except BaseException:cleanup_reason='holder_exit_unproven'
        if cleanup is not None and not cleanup['released']:cleanup_reason='holder_exit_unproven'
        if guard is not None:
            if worker is None or not worker.alive_owned():
                guard_exited=guard.close()
                if not guard_exited:shutdown_reason='idle_poll_stale'
            else:cleanup_reason='holder_exit_unproven'
            urgent=urgent or guard.safety_reason is not None
            try:drain()
            except BaseException:drain_reason='idle_guard_failure'
        for sig,old in previous.items():signal.signal(sig,old)
        graceful=cleanup is not None and cleanup['released'] and cleanup['gracefulReleaseAcknowledged'] is True and cleanup['exitCode']==0
        if cause=='idle_hold_complete' and not graceful and not urgent and not cleanup_reason:cleanup_reason='idle_release_not_graceful'
        outcome='release_unproven' if cleanup_reason=='holder_exit_unproven' else 'safety_abort' if urgent and worker is not None else 'refused' if worker is None and cause!='idle_quiet_pressure' else 'pass' if cause=='idle_hold_complete' and graceful and not shutdown_reason and not drain_reason and (guard is None or guard.first_reason is None) else 'inconclusive'
        post=None
        if cleanup is not None and cleanup['released']:
            try:
                fresh=check_source(config,spec,original)
                if fresh.identity!=source.identity:raise RuntimeError('idle_source_changed')
                post=reader(fresh);check_pressure(initial,post)
            except BaseException as error:post_reason=reason(error)
        post_safety=post_reason
        if post_safety and worker is not None and outcome!='release_unproven':outcome='safety_abort'
        output({'phase':'complete','outcome':outcome,'postReleaseSample':post,'observerShutdownReason':shutdown_reason,'drainReason':drain_reason,'postReleaseReason':post_reason,
            'guardReason':guard.first_reason if guard and guard.first_origin=='guard' else None,
            'firstReason':guard.first_reason if guard else main_reason,'firstReasonOrigin':guard.first_origin if guard else 'main' if main_reason else None,'mainReason':main_reason,
            'completionReason':cause if main_reason is None else None,'safetyReason':(guard.safety_reason if guard else None) or (cause if urgent else None) or post_safety,
            'cleanupReason':cleanup_reason,'guardExited':guard_exited,'cleanup':cleanup,'elapsedMs':round((time.monotonic()-started)*1000)})
    return outcome


@contextmanager
def _supervisor_lock(root,owner_uid=0):
    """Private ownership seam for local fixtures; production always requires UID 0."""
    if root.resolve()!=root or root.stat().st_uid!=owner_uid or root.stat().st_mode & 0o077:
        raise RuntimeError('owned_supervisor_directory_required')
    descriptor=os.open(root/'supervisor.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
    try:
        info=os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=owner_uid or info.st_nlink!=1 or info.st_mode & 0o077:
            raise RuntimeError('owned_supervisor_lock_required')
        fcntl.flock(descriptor,fcntl.LOCK_EX|fcntl.LOCK_NB)
        yield root/'holder.lock'
    finally:os.close(descriptor)


def run(config,spec,register,emit,lease_check,expected_hash,policy_path,policy_hash,
        raise_memlock=False,raise_nofile=False):
    """Reviewed API only; share the exact legacy supervisor/holder lock paths."""
    load_policy(policy_path,policy_hash)
    if spec.mode!='production' or spec.container!='qdrant-main':raise RuntimeError('invalid_production_source')
    with _supervisor_lock(Path('/run/goodwatch-qdrant-pin')) as holder_lock:
        return _run(config,spec,register,emit,holder_lock,lease_check,expected_hash,policy_hash,raise_memlock,raise_nofile)


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--execute-reviewed',action='store_true')
    args=parser.parse_args(argv)
    # Remote launcher/shared-lock/journal integration remains a separate reviewed gate.
    print(json.dumps({'event':'qdrant.idle-lock-trial.v1','phase':'refused' if args.execute_reviewed else 'prepared',
        'execution':False,'reason':'idle_execution_not_reviewed','queries':0,'storageWrites':0}))
    return 1 if args.execute_reviewed else 0


if __name__=='__main__':raise SystemExit(main())
