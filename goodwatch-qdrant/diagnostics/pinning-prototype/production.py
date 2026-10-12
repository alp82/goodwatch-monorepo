"""Prepared production supervisor. Default performs no inspection or pinning."""
import sys
sys.dont_write_bytecode = True
import hashlib
import ctypes
import fcntl
import json
import multiprocessing
import os
from pathlib import Path
import re
import resource
import select
import signal
import stat
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pin
import runtime

PRODUCTION_REASONS = frozenset({'invalid_production_policy','production_policy_changed','invalid_production_source',
    'invalid_production_mounts','production_allocation_changed','supervisor_group_unavailable','supervisor_placement_changed',
    'invalid_production_state','production_limit_event','invalid_nofile_proof','holder_memlock_limit_missing',
    'holder_parent_identity_changed','holder_code_changed','source_rpc_spec_changed','source_rpc_timeout','invalid_holder_command',
    'holder_release_unproven','host_headroom_unavailable','emergency_watchdog_exit_unproven','holder_placement_changed',
    'holder_lock_proof_missing','holder_state_source_changed','holder_state_policy_exceeded','holder_exit_unproven',
    'source_changed_during_pass','source_rpc_budget','invalid_holder_reply','holder_pass_timeout','holder_disappeared',
    'frozen_production_inputs_required','owned_supervisor_directory_required','owned_supervisor_lock_required',
    'production_oom_group_changed','invalid_cli_arguments','owned_pidfd_unavailable','inventory_race_retry','inventory_retry_release_unproven','inventory_retry_source_changed','inventory_retry_limit_changed','durable_holder_journal_required','owned_child_reaping_unavailable'}) | pin.SAFE_REASONS


def safe_reason(error):
    if isinstance(error,(EOFError,ConnectionError)):return 'holder_disappeared'
    reason = str(error)
    return reason if type(error) in (RuntimeError,ValueError) and reason in PRODUCTION_REASONS else pin.safe_reason(error)


def integer(value, low=0, high=None):
    if type(value) is not int or value < low or high is not None and value > high:
        raise ValueError('invalid_production_policy')
    return value


def load_policy(path, digest):
    with Path(path).open('rb') as stream: raw = stream.read(16385)
    if len(raw) > 16384 or not re.fullmatch('[a-f0-9]{64}', digest or '') or hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('production_policy_changed')
    c = json.loads(raw)
    if set(c) != {'schema', 'source', 'policy', 'lifetimeSeconds'} or c['schema'] != 'production-mapped-data-pin.v1':
        raise ValueError('invalid_production_policy')
    s = c['source']
    if set(s) != {'store','image','mounts','memoryBytes','swapBytes','cpuNanos','memoryMax','memoryHigh','cpuMax'}:
        raise ValueError('invalid_production_source')
    store = Path(s['store'])
    if not store.is_absolute() or store.resolve() != store or not store.is_dir() or not re.fullmatch('sha256:[a-f0-9]{64}', s['image']):
        raise ValueError('invalid_production_source')
    if type(s['mounts']) is not list or not 1 <= len(s['mounts']) <= 8:
        raise ValueError('invalid_production_mounts')
    for m in s['mounts']:
        if type(m) is not list or len(m) != 4 or not all(type(x) is str and x.startswith('/') for x in m[:2]) or m[2] not in ('bind','volume') or type(m[3]) is not bool:
            raise ValueError('invalid_production_mounts')
    mounts = frozenset(tuple(m) for m in s['mounts'])
    if len(mounts) != len(s['mounts']) or not any(m[0] == str(store) and m[1] == '/qdrant/storage' and m[3] for m in mounts):
        raise ValueError('invalid_production_mounts')
    # This first production trial preserves the observed uncapped allocation.
    if any(type(s[k]) is not int or s[k] != 0 for k in ('memoryBytes','swapBytes','cpuNanos')) or s['memoryMax'] != 'max' or s['memoryHigh'] != 'max' or s['cpuMax'] != 'max 100000':
        raise ValueError('production_allocation_changed')
    p = c['policy']
    if set(p) != {'maxLockedBytes','archiveBytes','reserveBytes','emergencyBytes','includePayload','capReserveBytes','mappingReserveCount'} or p['includePayload'] is not False:
        raise ValueError('invalid_production_policy')
    policy = pin.Policy('production', integer(p['maxLockedBytes'],1,2*pin.GIB), integer(p['archiveBytes'],1),
                        integer(p['reserveBytes'],1), integer(p['emergencyBytes'],3*pin.GIB//2),
                        cap_reserve_bytes=integer(p['capReserveBytes'],256*1024**2,pin.GIB),
                        mapping_reserve_count=integer(p['mappingReserveCount'],1024,16384))
    integer(c['lifetimeSeconds'],30,8*86400)
    spec = runtime.Spec('production','qdrant-main',s['image'],store,mounts,0,0,0)
    return c, spec, policy


def code_hash():
    digest = hashlib.sha256()
    for name in ('pin.py','runtime.py','production.py'):
        digest.update(name.encode()+b'\0'+(Path(__file__).parent/name).read_bytes()+b'\0')
    return digest.hexdigest()


def own_group():
    rows = Path('/proc/self/cgroup').read_text().splitlines()
    groups = [r[3:] for r in rows if r.startswith('0::')]
    if len(groups) != 1: raise RuntimeError('supervisor_group_unavailable')
    return groups[0]


def check_source(config, spec, original_group):
    source = runtime.inspect_source(spec)
    if own_group() != original_group or original_group == source.cgroup_relative:
        raise RuntimeError('supervisor_placement_changed')
    s = config['source']
    for filename, key in (('memory.max','memoryMax'),('memory.high','memoryHigh'),('cpu.max','cpuMax')):
        if (source.cgroup/filename).read_text().strip() != s[key]:
            raise RuntimeError('production_allocation_changed')
    if (source.cgroup/'memory.oom.group').read_text().strip() != '0':
        raise RuntimeError('production_oom_group_changed')
    return source


def nofile_proof(value):
    fields = {'openFdCount','mappedFileBound','reserveFds','requiredSoft','softBefore','softAfter','hardLimit','raised','hardChanged'}
    if type(value) is not dict or set(value) != fields:raise RuntimeError('invalid_nofile_proof')
    out = {k:integer(value[k]) for k in ('openFdCount','mappedFileBound','reserveFds','requiredSoft')}
    out.update({k:None if value[k] is None else integer(value[k]) for k in ('softBefore','softAfter','hardLimit')})
    if (out['mappedFileBound'] != runtime.MAX_MAPPED_FILES or out['reserveFds'] != runtime.NOFILE_RESERVE
            or out['openFdCount'] > runtime.MAX_MAPPED_FILES+runtime.NOFILE_RESERVE
            or out['requiredSoft'] != out['openFdCount']+runtime.MAX_MAPPED_FILES+runtime.NOFILE_RESERVE
            or out['requiredSoft'] > runtime.MAX_REQUIRED_NOFILE
            or any(out[k] is not None and out[k] < out['requiredSoft'] for k in ('softAfter','hardLimit'))
            or type(value['raised']) is not bool or value['hardChanged'] is not False
            or value['raised'] != (out['softBefore'] is not None and out['softBefore'] < out['requiredSoft'])):
        raise RuntimeError('invalid_nofile_proof')
    return {**out,'raised':value['raised'],'hardChanged':False}


def safe_state(state):
    """Only fixed numeric/hash evidence crosses the retained journal boundary."""
    if state.get('mode') != 'production' or state.get('queries') != 0 or state.get('storageWrites') != 0:
        raise RuntimeError('invalid_production_state')
    digest = state['selectionHash']
    if not re.fullmatch('[a-f0-9]{64}', digest): raise RuntimeError('invalid_production_state')
    out = {'selectionHash':digest,'extentRangesHashed':True,'contentFixed':False}
    for k in ('lockedBytes','newLockBytes','qdrantPid','sourceStartTicks','deletedMappingsExcluded','nonresidentSelectedBytes','projectedCurrentBytes','capReserveBytes','pageBytes'):
        out[k] = integer(state[k])
    out['rangesChanged'] = state['rangesChanged'] is True
    out['classesMeasured'] = {kind:{k:integer(state['classesMeasured'][kind][k]) for k in ('files','dataLockBytes','dataPages','rawExtentCount','dataRangeCount')} for kind in pin.CLASSES}
    out['lockedResidency'] = {kind:{k:integer(state['lockedResidency'][kind][k]) for k in ('lockedDataPages','residentLockedDataPages')} for kind in ('vector','graph','sparse','other')}
    for v in out['lockedResidency'].values():
        if v['lockedDataPages'] < 1 or v['lockedDataPages'] != v['residentLockedDataPages']: raise RuntimeError('locked_data_residency_incomplete')
    for name,keys in (('memoryEventDelta',('oom','oom_kill','max')),('cpuLimitDelta',('nr_throttled','throttled_usec'))):
        out[name] = {k:integer(state[name][k]) for k in keys}
        if any(out[name].values()): raise RuntimeError('production_limit_event')
    # Own limits are fixed numeric/boolean proofs, not raw proc data.
    out['nofileLimits'] = nofile_proof(state['nofileLimits'])
    out['mappingBounds'] = {k:integer(state['mappingBounds'][k]) for k in ('currentVmas','maxMapCount','projectedAdditionalVmas','reservedVmas','projectedTotalVmas')}
    out['existingPageChargesInsideTargetProven'] = False
    proof = state['memlockLimits']
    out['memlockLimits'] = {k:None if proof[k] is None else integer(proof[k]) for k in ('softBefore','hardBefore','softAfter','hardAfter')}
    if out['memlockLimits']['softAfter'] is not None and out['memlockLimits']['softAfter'] < out['lockedBytes']:
        raise RuntimeError('holder_memlock_limit_missing')
    return out



BENIGN_INVENTORY_RACES=frozenset({'mapped_file_disappeared_during_inventory','target_size_changed_during_pass','extent_ranges_changed_during_locking'})


def reconcile_with_retries(manager,spec,source_check,raise_nofile,on_retry):
    """Two retries within the parent's unchanged deadline; every race releases."""
    origin=source_check(spec);before=runtime.accounting(origin)
    for attempt in range(3):
        try:return runtime.reconcile_source(manager,spec,source_check=source_check,raise_own_nofile=raise_nofile)
        except Exception as error:
            if safe_reason(error) not in BENIGN_INVENTORY_RACES or attempt==2:raise
            if manager.release_state()!= {'released':True,'heldMappingCount':0}:raise RuntimeError('inventory_retry_release_unproven') from None
            fresh=source_check(spec);after=runtime.accounting(fresh)
            if fresh.identity!=origin.identity:raise RuntimeError('inventory_retry_source_changed') from None
            if after['availableBytes']<manager.policy.emergency_bytes:raise RuntimeError('emergency_headroom_release') from None
            if after['cgroupMaxBytes']!=before['cgroupMaxBytes'] or any(after[group][key]!=before[group][key] for group,keys in (('memoryEvents',('oom','oom_kill','max')),('cpu',('nr_throttled','throttled_usec'))) for key in keys):raise RuntimeError('inventory_retry_limit_changed') from None
            on_retry({'retry':safe_reason(error),'released':True,'attempt':attempt+1})


def holder(connection, spec, policy, lock_path, raise_memlock, raise_nofile, expected_code_hash=None, idle_lease_seconds=60, source_rpc_seconds=15):
    manager = None
    memlock_before = resource.getrlimit(resource.RLIMIT_MEMLOCK)
    try:
        if expected_code_hash != code_hash():raise RuntimeError('holder_code_changed')
        parent = os.getppid()
        # Kernel delivery releases mappings even if inventory/locking is blocked.
        if parent <= 1 or ctypes.CDLL(None,use_errno=True).prctl(1,signal.SIGTERM,0,0,0) != 0 or os.getppid() != parent:
            raise RuntimeError('holder_parent_identity_changed')
        signal.signal(signal.SIGTERM,signal.SIG_DFL)
        signal.pthread_sigmask(signal.SIG_UNBLOCK,{signal.SIGTERM})
        def source_check(requested):
            if requested != spec: raise RuntimeError('source_rpc_spec_changed')
            connection.send({'request':'source'})
            if not connection.poll(source_rpc_seconds): raise RuntimeError('source_rpc_timeout')
            reply = connection.recv()
            if set(reply) != {'source'} or reply['source'].spec != spec: raise RuntimeError('source_rpc_spec_changed')
            return runtime.validate_source_locally(reply['source'])
        # Parent disappearance/EOF or missing command cannot leave a permanent holder.
        while connection.poll(idle_lease_seconds):
            command = connection.recv()
            if command == 'close': break
            if command != 'reconcile': raise RuntimeError('invalid_holder_command')
            if expected_code_hash != code_hash():raise RuntimeError('holder_code_changed')
            if manager is None:
                source = source_check(spec)
                runtime.prepare_self(source,policy.max_locked_bytes,raise_own_limit=raise_memlock,source_check=source_check)
                manager = pin.PinSet(policy,Path(lock_path))
            state = reconcile_with_retries(manager,spec,source_check,raise_nofile,connection.send)
            memlock_after = resource.getrlimit(resource.RLIMIT_MEMLOCK)
            state['memlockLimits'] = {k:None if v == resource.RLIM_INFINITY else v for k,v in zip(
                ('softBefore','hardBefore','softAfter','hardAfter'),(*memlock_before,*memlock_after))}
            connection.send({'state':safe_state(state)})
        if manager is not None:
            manager.close()
            if manager.release_state() != {'released':True,'heldMappingCount':0}: raise RuntimeError('holder_release_unproven')
        connection.send({'closed':True})
    except BaseException as error:
        reason = safe_reason(error)
        if manager is not None:
            try: manager.close()
            except BaseException: pass
        try:connection.send({'failed':reason})
        except BaseException:pass
        raise SystemExit(1)
    finally: connection.close()


class Holder:
    """Bounded process ownership; close observes actual exit, not a claimed flag."""
    def __init__(self, target, args=(), cleanup_seconds=5):
        if signal.getsignal(signal.SIGCHLD)==signal.SIG_IGN:
            raise RuntimeError('owned_child_reaping_unavailable')
        context = multiprocessing.get_context('spawn')
        self.connection, child = context.Pipe()
        self.process = context.Process(target=target,args=(child,*args))
        self.cleanup_seconds = cleanup_seconds
        self.process.start(); child.close()
        self.signal_lock=threading.Lock();self.pidfd=None
        try:self.pidfd=os.pidfd_open(self.process.pid,0)
        except ProcessLookupError:
            self.process.join(self.cleanup_seconds)
            if self.process.is_alive():raise RuntimeError('owned_pidfd_unavailable')
        except BaseException:
            if self.process.is_alive():self.process.kill()
            self.process.join(self.cleanup_seconds);self.connection.close()
            raise RuntimeError('owned_pidfd_unavailable') from None

    def alive_owned(self):
        with self.signal_lock:
            return self.pidfd is not None and not select.select([self.pidfd],[],[],0)[0]

    def signal_owned(self,number):
        with self.signal_lock:
            if self.pidfd is None:return
            try:signal.pidfd_send_signal(self.pidfd,number)
            except ProcessLookupError:pass

    def close(self,emergency=False):
        acknowledged = False
        if emergency and self.process.is_alive():
            try:self.signal_owned(signal.SIGKILL)
            except ProcessLookupError:pass
            self.process.join(self.cleanup_seconds)
        if self.process.is_alive():
            graceful_deadline = time.monotonic()+self.cleanup_seconds
            try:
                self.connection.send('close')
                if self.connection.poll(self.cleanup_seconds): acknowledged = self.connection.recv() == {'closed':True}
            except (EOFError,OSError): pass
            self.process.join(max(0,graceful_deadline-time.monotonic()))
        if self.process.is_alive(): self.signal_owned(signal.SIGTERM); self.process.join(self.cleanup_seconds)
        if self.process.is_alive(): self.signal_owned(signal.SIGKILL); self.process.join(self.cleanup_seconds)
        self.connection.close()
        gone = not self.process.is_alive() and not self.alive_owned()
        if gone:
            with self.signal_lock:
                if self.pidfd is not None:os.close(self.pidfd);self.pidfd=None
        return {'holderExited':gone,'gracefulReleaseAcknowledged':acknowledged,'exitCode':self.process.exitcode,
                'released':gone}


def host_available():
    rows = Path('/proc/meminfo').read_text().splitlines()
    values = [line.split() for line in rows if line.startswith('MemAvailable:')]
    if len(values) != 1 or len(values[0]) != 3 or values[0][2] != 'kB': raise RuntimeError('host_headroom_unavailable')
    return integer(int(values[0][1]))*1024


class EmergencyWatchdog:
    """No Docker/RPC dependency. Only the explicitly owned holder can be signalled."""
    def __init__(self, floor, read_available=host_available, poll_seconds=2, kill_seconds=5):
        self.floor = floor; self.read_available = read_available; self.poll_seconds = poll_seconds
        self.kill_seconds = kill_seconds; self.tripped = threading.Event(); self.stopped = threading.Event()
        self.guard = threading.Lock(); self.worker = None
        self.thread = threading.Thread(target=self.run,daemon=True); self.thread.start()

    def attach(self, worker):
        with self.guard:
            if self.tripped.is_set(): raise RuntimeError('emergency_headroom_release')
            self.worker = worker

    def detach(self):
        with self.guard: self.worker = None

    def run(self):
        while not self.stopped.is_set():
            try: healthy = self.read_available() >= self.floor
            except BaseException: healthy = False
            if not healthy:
                self.tripped.set()
                with self.guard:
                    worker = self.worker
                    try:
                        if worker is not None and worker.alive_owned(): worker.signal_owned(signal.SIGTERM)
                    except (OSError,ValueError): pass
                if not self.stopped.wait(self.kill_seconds):
                    with self.guard:
                        try:
                            if worker is self.worker and worker is not None and worker.alive_owned(): worker.signal_owned(signal.SIGKILL)
                        except (OSError,ValueError): pass
                return
            self.stopped.wait(self.poll_seconds)

    def close(self):
        self.stopped.set(); self.thread.join(self.poll_seconds+self.kill_seconds+1)
        if self.thread.is_alive(): raise RuntimeError('emergency_watchdog_exit_unproven')



def holder_birth(worker):
    if not worker.alive_owned():raise RuntimeError('holder_disappeared')
    try:fields=(Path('/proc')/str(worker.process.pid)/'stat').read_text().rsplit(')',1)[1].split()
    except FileNotFoundError:raise RuntimeError('holder_disappeared') from None
    ticks=integer(int(fields[19]),1)
    if not worker.alive_owned():raise RuntimeError('holder_disappeared')
    return {'phase':'holder_started','holderPid':worker.process.pid,'holderStartTicks':ticks,'pidfdOwned':True}


def verify_holder(worker, source, state, policy):
    if (state['qdrantPid'],state['sourceStartTicks']) != source.identity[2:4]:raise RuntimeError('holder_state_source_changed')
    if state['lockedBytes'] > policy.max_locked_bytes or state['lockedBytes'] > 2*pin.GIB:raise RuntimeError('holder_state_policy_exceeded')
    proc = Path('/proc')/str(worker.process.pid)
    if (proc/'cgroup').read_text().strip() != '0::'+source.cgroup_relative:
        raise RuntimeError('holder_placement_changed')
    status = (proc/'status').read_text().splitlines()
    locked = [int(line.split()[1])*1024 for line in status if line.startswith('VmLck:')]
    if len(locked) != 1 or locked[0] != state['lockedBytes']: raise RuntimeError('holder_lock_proof_missing')
    if locked[0] > policy.max_locked_bytes or locked[0] > 2*pin.GIB:raise RuntimeError('holder_state_policy_exceeded')
    fields = (proc/'stat').read_text().rsplit(')',1)[1].split()
    return {'holderPid':worker.process.pid,'holderStartTicks':integer(int(fields[19]),1),
            'vmLockedBytes':locked[0],'holderPlacementVerified':True}


def supervise(config, spec, policy, emit, lock_path, raise_memlock=False, raise_nofile=False,
              worker_factory=Holder, poll_seconds=2, watchdog_factory=EmergencyWatchdog, expected_code_hash=None):
    original = own_group(); worker = None; identity = None; stopped = False; urgent = False; pending_error = False
    expected_code_hash = expected_code_hash or code_hash()
    watchdog = watchdog_factory(policy.emergency_bytes)
    def stop(_s,_f):
        nonlocal stopped
        stopped = True
    previous = {s:signal.signal(s,stop) for s in (signal.SIGTERM,signal.SIGINT)}
    deadline = time.monotonic()+config['lifetimeSeconds']; next_pass = 0
    try:
        while not stopped and time.monotonic() < deadline:
            if code_hash() != expected_code_hash:raise RuntimeError('holder_code_changed')
            if watchdog.tripped.is_set(): raise RuntimeError('emergency_headroom_release')
            source = check_source(config,spec,original); memory = runtime.accounting(source)
            if memory['availableBytes'] < policy.emergency_bytes: raise RuntimeError('emergency_headroom_release')
            if identity is not None and identity != source.identity:
                cleanup = worker.close(); emit({'phase':'released','reason':'source_turnover','emergencyRelease':watchdog.tripped.is_set(),**cleanup})
                if not cleanup['released']: raise RuntimeError('holder_exit_unproven')
                if watchdog.tripped.is_set():raise RuntimeError('emergency_headroom_release')
                worker = None; identity = None
            if worker is None:
                worker = worker_factory(holder,(spec,policy,str(lock_path),raise_memlock,raise_nofile,expected_code_hash)); identity = source.identity; next_pass = 0
                watchdog.attach(worker)
                # Synchronous durable sink registration must finish before any
                # command permits this child to inspect/join/lock the source.
                emit(holder_birth(worker))
            if time.monotonic() >= next_pass:
                worker.connection.send('reconcile'); pass_end = min(deadline,time.monotonic()+(180 if next_pass == 0 else 30)); requests = 0; state = None; retry_attempt=0
                while not stopped and time.monotonic() < pass_end:
                    if watchdog.tripped.is_set(): raise RuntimeError('emergency_headroom_release')
                    fresh = check_source(config,spec,original)
                    if fresh.identity != identity: raise RuntimeError('source_changed_during_pass')
                    if runtime.accounting(fresh)['availableBytes'] < policy.emergency_bytes: raise RuntimeError('emergency_headroom_release')
                    if not worker.connection.poll(min(poll_seconds,max(0,pass_end-time.monotonic()))): continue
                    try:reply = worker.connection.recv()
                    except (EOFError,ConnectionError):raise RuntimeError('holder_disappeared') from None
                    if reply == {'request':'source'}:
                        requests += 1
                        if requests > 32: raise RuntimeError('source_rpc_budget')
                        worker.connection.send({'source':fresh}); continue
                    if type(reply) is dict and set(reply)=={'retry','released','attempt'}:
                        if type(reply['retry'])is not str or reply['retry'] not in BENIGN_INVENTORY_RACES or reply['released'] is not True or type(reply['attempt'])is not int or reply['attempt']!=retry_attempt+1 or reply['attempt']>2:raise RuntimeError('invalid_holder_reply')
                        retry_attempt=reply['attempt']
                        emit({'phase':'inventory_retry_claimed','reason':'inventory_race_retry','holderClaimed':True,'attempt':retry_attempt,'emergencyRelease':watchdog.tripped.is_set(),'holderPid':worker.process.pid})
                        continue
                    if type(reply) is dict and set(reply) == {'failed'}:
                        if type(reply['failed']) is not str or reply['failed'] not in PRODUCTION_REASONS:raise RuntimeError('invalid_holder_reply')
                        raise RuntimeError(reply['failed'])
                    if type(reply) is not dict or set(reply) != {'state'}: raise RuntimeError('invalid_holder_reply')
                    state = safe_state({**reply['state'],'mode':'production','queries':0,'storageWrites':0})
                    break
                if state is None:
                    if stopped or time.monotonic() >= deadline:break
                    raise RuntimeError('holder_pass_timeout')
                fresh = check_source(config,spec,original)
                if fresh.identity != identity: raise RuntimeError('source_changed_during_pass')
                proof = verify_holder(worker,fresh,state,policy)
                if watchdog.tripped.is_set(): raise RuntimeError('emergency_headroom_release')
                emit({'phase':'locked',**state,**proof,'availableBytes':runtime.accounting(fresh)['availableBytes'],
                      'sourceIdentitySha256':hashlib.sha256(repr(fresh.identity).encode()).hexdigest()})
                next_pass = time.monotonic()+10
            if watchdog.tripped.is_set(): raise RuntimeError('emergency_headroom_release')
            if not worker.process.is_alive(): raise RuntimeError('holder_disappeared')
            emit({'phase':'heartbeat','qdrantPid':source.pid,'sourceStartTicks':source.identity[3],
                  'holderPid':worker.process.pid,'availableBytes':memory['availableBytes']})
            time.sleep(min(poll_seconds,max(0,deadline-time.monotonic())))
    except BaseException as error:
        pending_error = True
        if watchdog.tripped.is_set() and safe_reason(error)=='holder_disappeared':
            urgent=True
            raise RuntimeError('emergency_headroom_release') from None
        urgent = safe_reason(error) in ('emergency_headroom_release','source_or_emergency_headroom_changed_after_locking')
        raise
    finally:
        urgent = urgent or watchdog.tripped.is_set()
        cleanup = None
        try:
            if worker is not None:
                if urgent and worker.process.is_alive():
                    try:worker.signal_owned(signal.SIGKILL)
                    except ProcessLookupError:pass
                # Keep independent pressure protection attached during normal
                # cleanup as well; a blocked graceful close can still be killed.
                cleanup = worker.close(emergency=urgent)
                if not cleanup['released']: raise RuntimeError('holder_exit_unproven')
        finally:
            try:
                # Never disarm pressure protection while owned exit is still
                # unproven. Its retained pidfd can still deliver owned signals.
                if worker is None or not worker.alive_owned():
                    watchdog.detach(); watchdog.close()
                urgent = urgent or watchdog.tripped.is_set()
                if cleanup is not None:
                    emit({'phase':'released','reason':'supervisor_exit','emergencyRelease':urgent,**cleanup})
            finally:
                for s,h in previous.items(): signal.signal(s,h)
        if (urgent or watchdog.tripped.is_set()) and not pending_error:raise RuntimeError('emergency_headroom_release')


def main(argv=None):
    import argparse
    class SafeParser(argparse.ArgumentParser):
        def error(self,message): raise ValueError('invalid_cli_arguments')
    parser = SafeParser(description=__doc__)
    parser.add_argument('--execute-reviewed',action='store_true'); parser.add_argument('--config')
    parser.add_argument('--policy-sha256'); parser.add_argument('--code-sha256')
    parser.add_argument('--raise-own-memlock',action='store_true'); parser.add_argument('--raise-own-nofile',action='store_true')
    def emit(row):
        print(json.dumps({'event':'qdrant.pin-helper.v1','at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
                          'queries':0,'storageWrites':0,**row}),flush=True)
        if row.get('phase')=='holder_started':
            committed=getattr(sys.stdout,'holder_registration_committed',None)
            if not callable(committed) or committed(row['holderPid'],row['holderStartTicks']) is not True:
                raise RuntimeError('durable_holder_journal_required')
    try: args = parser.parse_args(argv)
    except ValueError:
        emit({'phase':'failed','reason':'invalid_cli_arguments'}); return 1
    if not args.execute_reviewed: emit({'phase':'prepared','execution':False}); return 0
    try:
        if not callable(getattr(sys.stdout,'holder_registration_committed',None)):raise RuntimeError('durable_holder_journal_required')
        if args.code_sha256 != code_hash(): raise ValueError('frozen_production_inputs_required')
        c,spec,policy = load_policy(args.config,args.policy_sha256)
        lock_root = Path('/run/goodwatch-qdrant-pin')
        if lock_root.resolve() != lock_root or lock_root.stat().st_uid != 0 or lock_root.stat().st_mode & 0o077:
            raise ValueError('owned_supervisor_directory_required')
        fd = os.open(lock_root/'supervisor.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
        try:
            info = os.fstat(fd)
            if not stat.S_ISREG(info.st_mode) or info.st_uid != 0 or info.st_nlink != 1: raise ValueError('owned_supervisor_lock_required')
            fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            supervise(c,spec,policy,lambda r:emit({**r,'codeSha256':args.code_sha256,'policySha256':args.policy_sha256}),
                      lock_root/'holder.lock',args.raise_own_memlock,args.raise_own_nofile,expected_code_hash=args.code_sha256)
        finally: os.close(fd)
        return 0
    except BaseException as error:
        reason = safe_reason(error)
        emit({'phase':'failed','reason':reason,
              'codeSha256':args.code_sha256 if re.fullmatch('[a-f0-9]{64}',args.code_sha256 or '') else None,
              'policySha256':args.policy_sha256 if re.fullmatch('[a-f0-9]{64}',args.policy_sha256 or '') else None}); return 1


if __name__ == '__main__': raise SystemExit(main())
