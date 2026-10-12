import hashlib
import json
from pathlib import Path
import tempfile
import signal
import time
import sys
import os
import mmap
import ctypes
import resource
import unittest

import pin
import production
import runtime
from unittest.mock import patch
from types import SimpleNamespace


def stubborn_holder(connection):
    signal.signal(signal.SIGTERM, signal.SIG_IGN)
    connection.send({'started': True})
    while True: time.sleep(.02)


def retry_messages_holder(connection,messages):
    if connection.recv()!='reconcile':return
    for attempt in messages:
        connection.send({'retry':'target_size_changed_during_pass','released':True,'attempt':attempt})
    connection.send({'failed':'projected_headroom_below_reserve'})
    if connection.poll(5) and connection.recv()=='close':connection.send({'closed':True})


def leased_holder(connection):
    class FixturePins:
        def __init__(self,*args): pass
        def close(self): pass
        def release_state(self): return {'released':True,'heldMappingCount':0}
    with patch.object(runtime,'validate_source_locally',side_effect=lambda source:source),patch.object(runtime,'prepare_self'),patch.object(production,'reconcile_with_retries',return_value={}),patch.object(pin,'PinSet',FixturePins),patch.object(production,'safe_state',return_value={'fixtureState':True}):
        production.holder(connection,None,SimpleNamespace(max_locked_bytes=4096),'unused',False,False,production.code_hash(),idle_lease_seconds=.6)


def proof_holder(connection,source):
    memory=mmap.mmap(-1,4*pin.PAGE)
    address=ctypes.addressof(ctypes.c_char.from_buffer(memory));kernel=pin.Kernel()
    kernel.call('mlock',address,4*pin.PAGE)
    try:
        while connection.poll(5):
            command=connection.recv()
            if command=='close':
                kernel.call('munlock',address,4*pin.PAGE);memory.close();connection.send({'closed':True});return
            if command!='reconcile':return
            limits=resource.getrlimit(resource.RLIMIT_MEMLOCK)
            proof={k:None if v==resource.RLIM_INFINITY else v for k,v in zip(('softBefore','hardBefore','softAfter','hardAfter'),(*limits,*limits))}
            vmas=len(Path('/proc/self/maps').read_text().splitlines());maximum=int(Path('/proc/sys/vm/max_map_count').read_text())
            state={'mode':'production','queries':0,'storageWrites':0,'selectionHash':'d'*64,'extentRangesHashed':True,
                'lockedBytes':4*pin.PAGE,'newLockBytes':4*pin.PAGE,'qdrantPid':source.pid,'sourceStartTicks':source.identity[3],
                'deletedMappingsExcluded':0,'nonresidentSelectedBytes':0,'projectedCurrentBytes':4*pin.PAGE,
                'capReserveBytes':256*1024**2,'pageBytes':pin.PAGE,'rangesChanged':False,
                'classesMeasured':{k:{'files':1,'dataLockBytes':pin.PAGE,'dataPages':1,'rawExtentCount':1,'dataRangeCount':1} for k in pin.CLASSES},
                'lockedResidency':{k:{'lockedDataPages':1,'residentLockedDataPages':1} for k in ('vector','graph','sparse','other')},
                'memoryEventDelta':{'oom':0,'oom_kill':0,'max':0},'cpuLimitDelta':{'nr_throttled':0,'throttled_usec':0},
                'nofileLimits':runtime.ensure_inventory_nofile(raise_own_nofile=True),
                'mappingBounds':{'currentVmas':vmas,'maxMapCount':maximum,'projectedAdditionalVmas':1,'reservedVmas':1024,'projectedTotalVmas':vmas+1025},
                'memlockLimits':proof}
            connection.send({'state':production.safe_state(state)})
    finally:
        if not memory.closed:kernel.call('munlock',address,4*pin.PAGE);memory.close()
        connection.close()


def failed_holder(connection,spec,policy,reason):
    class FixturePins:
        def __init__(self,*args):pass
        def close(self):pass
        def release_state(self):return {'released':True,'heldMappingCount':0}
    with patch.object(runtime,'validate_source_locally',side_effect=lambda source:source),patch.object(runtime,'prepare_self'),patch.object(runtime,'reconcile_source',side_effect=RuntimeError(reason)),patch.object(runtime,'accounting',return_value={}),patch.object(pin,'PinSet',FixturePins):
        production.holder(connection,spec,policy,'unused',False,False,production.code_hash())


class ProductionPolicyTests(unittest.TestCase):
    def test_actual_parent_pipe_validates_ordered_retry_claims_without_calling_them_release_proof(self):
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)
            policy=pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            for messages,expected,count in (([1,2],'projected_headroom_below_reserve',2),([2],'invalid_holder_reply',0),([1,1],'invalid_holder_reply',1),([1,2,3],'invalid_holder_reply',2)):
                records=[];workers=[]
                def factory(_target,_args):
                    worker=production.Holder(retry_messages_holder,(messages,),cleanup_seconds=.05);workers.append(worker);return worker
                with patch.object(production,'check_source',return_value=source),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                    with self.assertRaisesRegex(RuntimeError,expected):
                        production.supervise({'lifetimeSeconds':5},spec,policy,records.append,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
                claims=[row for row in records if row['phase']=='inventory_retry_claimed']
                self.assertEqual(len(claims),count)
                self.assertTrue(all(row['holderClaimed'] is True and 'released' not in row for row in claims))
                self.assertTrue(records[-1]['released']);self.assertFalse(workers[0].alive_owned())

    def test_unproven_exit_retains_real_pidfd_for_later_owned_kill(self):
        worker=production.Holder(stubborn_holder,cleanup_seconds=.01)
        self.assertTrue(worker.connection.poll(3));worker.connection.recv();fd=worker.pidfd
        with patch.object(worker,'signal_owned'):
            result=worker.close()
        self.assertFalse(result['released']);os.fstat(fd);self.assertTrue(worker.alive_owned())
        worker.signal_owned(signal.SIGKILL);worker.process.join(2)
        self.assertTrue(worker.close()['released'])
        with self.assertRaises(OSError):os.fstat(fd)

    def test_ignored_sigchld_is_rejected_before_owned_spawn(self):
        before=signal.getsignal(signal.SIGCHLD)
        try:
            signal.signal(signal.SIGCHLD,signal.SIG_IGN)
            with self.assertRaisesRegex(RuntimeError,'owned_child_reaping_unavailable'):production.Holder(stubborn_holder)
        finally:signal.signal(signal.SIGCHLD,before)

    def test_watchdog_killed_pipe_eof_reports_emergency_in_actual_supervisor(self):
        available=[10*pin.GIB];records=[];workers=[];reads=[]
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)
            policy=pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            def factory(_target,_args):
                worker=production.Holder(stubborn_holder,cleanup_seconds=5)
                self.assertTrue(worker.connection.poll(3));worker.connection.recv();workers.append(worker);return worker
            def accounting(_source):
                reads.append(True)
                if len(reads)==2:available[0]=0;time.sleep(.1)
                return {'availableBytes':10*pin.GIB}
            def watchdog(floor):return production.EmergencyWatchdog(floor,read_available=lambda:available[0],poll_seconds=.01,kill_seconds=.03)
            with patch.object(production,'check_source',return_value=source),patch.object(runtime,'accounting',side_effect=accounting):
                with self.assertRaisesRegex(RuntimeError,'emergency_headroom_release'):
                    production.supervise({'lifetimeSeconds':5},spec,policy,records.append,Path(directory)/'lock',worker_factory=factory,watchdog_factory=watchdog,poll_seconds=.01)
            self.assertTrue(records[-1]['emergencyRelease']);self.assertTrue(records[-1]['released'])
            self.assertFalse(workers[0].alive_owned())

    def test_turnover_close_keeps_watchdog_attached_to_actual_locked_holder(self):
        available=[10*pin.GIB];workers=[];records=[]
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            selected=[runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)]
            policy=pin.Policy('production',4*pin.PAGE,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            case=self
            class DropOnTurnover(production.Holder):
                def close(self,emergency=False):
                    if self.alive_owned():
                        available[0]=0;time.sleep(.2)
                        # Pressure protection must already have killed this
                        # real mlocked child before graceful close starts.
                        case.assertFalse(self.alive_owned())
                    return super().close(emergency=emergency)
            def factory(_target,_args):
                worker=DropOnTurnover(proof_holder,(selected[0],),cleanup_seconds=5);workers.append(worker);return worker
            def emit(row):
                records.append(row)
                if row['phase']=='heartbeat':selected[0]=runtime.Source(('new','image',901,101),901,Path(directory),production.own_group(),spec)
            def watchdog(floor):return production.EmergencyWatchdog(floor,read_available=lambda:available[0],poll_seconds=.01,kill_seconds=.03)
            with patch.object(production,'check_source',side_effect=lambda *_:selected[0]),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                with self.assertRaisesRegex(RuntimeError,'emergency_headroom_release'):
                    production.supervise({'lifetimeSeconds':5},spec,policy,emit,Path(directory)/'lock',worker_factory=factory,watchdog_factory=watchdog,poll_seconds=.01)
            self.assertEqual(len(workers),1)
            released=next(row for row in records if row.get('reason')=='source_turnover')
            self.assertTrue(released['emergencyRelease']);self.assertTrue(released['released'])

    def test_watchdog_pressure_during_clean_lifetime_close_is_fast_and_reported_as_failure(self):
        available=[10*pin.GIB];workers=[];records=[]
        class DropOnClose(production.Holder):
            def close(self,emergency=False):
                available[0]=0
                return super().close(emergency=emergency)
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),'/fixture',spec)
            policy=pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            def factory(_target,_args):
                worker=DropOnClose(stubborn_holder,cleanup_seconds=5)
                self.assertTrue(worker.connection.poll(5));worker.connection.recv();workers.append(worker);return worker
            def watchdog(floor):return production.EmergencyWatchdog(floor,read_available=lambda:available[0],poll_seconds=.01,kill_seconds=.03)
            started=time.monotonic()
            with patch.object(production,'check_source',return_value=source),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                with self.assertRaisesRegex(RuntimeError,'emergency_headroom_release'):
                    production.supervise({'lifetimeSeconds':.3},spec,policy,records.append,Path(directory)/'lock',worker_factory=factory,watchdog_factory=watchdog,poll_seconds=.01)
            self.assertLess(time.monotonic()-started,2)
            self.assertTrue(records[-1]['released']);self.assertTrue(records[-1]['emergencyRelease'])
            self.assertFalse(workers[0].alive_owned())

    def test_real_holder_source_rpc_timeout_is_fixed_and_releases_without_parent_reply(self):
        worker=production.Holder(production.holder,(None,None,None,False,False,production.code_hash(),60,.1),cleanup_seconds=.05)
        try:
            worker.connection.send('reconcile')
            self.assertTrue(worker.connection.poll(3));self.assertEqual(worker.connection.recv(),{'request':'source'})
            self.assertTrue(worker.connection.poll(2));self.assertEqual(worker.connection.recv(),{'failed':'source_rpc_timeout'})
            worker.process.join(2);self.assertFalse(worker.alive_owned())
        finally:self.assertTrue(worker.close()['released'])

    def test_pidfd_signals_owned_child_and_reap_proof_ignores_unrelated_pid_path(self):
        worker=production.Holder(stubborn_holder,cleanup_seconds=.05)
        self.assertTrue(worker.connection.poll(5));worker.connection.recv()
        fd=worker.pidfd;self.assertIsInstance(fd,int)
        worker.signal_owned(signal.SIGKILL);worker.process.join(2)
        self.assertFalse(worker.alive_owned())
        # A recycled numeric PID path must not override the kernel pidfd/reap.
        with patch.object(Path,'exists',return_value=True):result=worker.close()
        self.assertTrue(result['released'])
        with self.assertRaises(OSError):os.fstat(fd)
        worker.signal_owned(signal.SIGKILL)  # Closed ownership cannot hit another fd.

    def test_parent_rejects_claimed_source_budget_or_vmlock_mismatch_against_real_holder(self):
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),production.own_group(),spec)
            policy=pin.Policy('production',4*pin.PAGE,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            worker=production.Holder(proof_holder,(source,),cleanup_seconds=.1)
            try:
                worker.connection.send('reconcile');self.assertTrue(worker.connection.poll(5));state=worker.connection.recv()['state']
                self.assertEqual(production.verify_holder(worker,source,state,policy)['vmLockedBytes'],4*pin.PAGE)
                for changed,reason in (({**state,'qdrantPid':901},'holder_state_source_changed'),({**state,'sourceStartTicks':101},'holder_state_source_changed'),({**state,'lockedBytes':2*pin.GIB+1},'holder_state_policy_exceeded'),({**state,'lockedBytes':pin.PAGE},'holder_lock_proof_missing')):
                    with self.assertRaisesRegex(RuntimeError,reason):production.verify_holder(worker,source,changed,policy)
            finally:self.assertTrue(worker.close()['released'])

    def test_spawned_holder_rejects_unfrozen_code_before_inspection(self):
        worker=production.Holder(production.holder,(None,None,None,False,False,'0'*64),cleanup_seconds=.05)
        try:
            self.assertTrue(worker.connection.poll(5));self.assertEqual(worker.connection.recv(),{'failed':'holder_code_changed'})
            worker.process.join(1);self.assertEqual(worker.process.exitcode,1)
        finally:self.assertTrue(worker.close()['released'])

    def test_clean_sigterm_midpass_releases_actual_holder_without_timeout_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),'/fixture',spec)
            policy=pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            events=[];workers=[];checks=[0]
            def factory(_target,_args):
                worker=production.Holder(stubborn_holder,cleanup_seconds=.02);self.assertTrue(worker.connection.poll(5));worker.connection.recv();workers.append(worker);return worker
            def source_check(*_args):
                checks[0]+=1
                if checks[0]==2:os.kill(os.getpid(),signal.SIGTERM)
                return source
            with patch.object(production,'check_source',side_effect=source_check),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                production.supervise({'lifetimeSeconds':5},spec,policy,events.append,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
            self.assertTrue(events[-1]['released']);self.assertFalse(workers[0].process.is_alive())

    def test_actual_parent_checks_real_vmlock_happy_proof_and_retires_old_holder_on_turnover(self):
        workers=[];events=[]
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            group=production.own_group()
            source=runtime.Source(('private-a','image',900,100),900,Path(directory),group,spec)
            replacement=runtime.Source(('private-b','image',901,101),901,Path(directory),group,spec)
            selected=[source]
            policy=pin.Policy('production',4*pin.PAGE,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            def factory(_target,_args):
                if workers:self.assertFalse(workers[-1].process.is_alive())
                worker=production.Holder(proof_holder,(selected[0],),cleanup_seconds=.1);workers.append(worker);return worker
            def emit(event):
                events.append(event)
                if event['phase']=='heartbeat':
                    if len(workers)==1:selected[0]=replacement
                    else:os.kill(os.getpid(),signal.SIGTERM)
            with patch.object(production,'check_source',side_effect=lambda *_args:selected[0]),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                production.supervise({'lifetimeSeconds':5},spec,policy,emit,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
        locked=[e for e in events if e['phase']=='locked'];self.assertEqual(len(locked),2)
        self.assertTrue(all(e['vmLockedBytes']==4*pin.PAGE and e['holderPlacementVerified'] for e in locked))
        self.assertEqual([e['qdrantPid'] for e in locked],[900,901])
        self.assertTrue(all(not w.process.is_alive() for w in workers))
        released=[e for e in events if e['phase']=='released'];self.assertEqual(released[0]['reason'],'source_turnover')
        self.assertTrue(all(e['released'] and e['gracefulReleaseAcknowledged'] for e in released))

    def test_holder_failure_reason_reaches_actual_parent_without_private_error(self):
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),'/fixture',spec)
            policy=pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            for cause,expected in (('projected_headroom_below_reserve','projected_headroom_below_reserve'),('private-path-and-secret','guard_or_runtime_failure')):
                events=[];workers=[]
                def factory(_target,_args):
                    worker=production.Holder(failed_holder,(spec,policy,cause),cleanup_seconds=.05);workers.append(worker);return worker
                with patch.object(production,'check_source',return_value=source),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                    with self.assertRaisesRegex(RuntimeError,expected):production.supervise({'lifetimeSeconds':5},spec,policy,events.append,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
                self.assertFalse(workers[0].process.is_alive());self.assertTrue(events[-1]['released'])
                self.assertNotIn('private-path',json.dumps(events))

    def test_clean_lifetime_expiry_midpass_does_not_become_timeout_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            spec=runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source=runtime.Source(('private','image',900,100),900,Path(directory),'/fixture',spec)
            policy=pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            events=[];workers=[]
            def factory(_target,_args):
                worker=production.Holder(stubborn_holder,cleanup_seconds=.02)
                self.assertTrue(worker.connection.poll(5));worker.connection.recv();workers.append(worker);return worker
            with patch.object(production,'check_source',return_value=source),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                production.supervise({'lifetimeSeconds':.1},spec,policy,events.append,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
            self.assertTrue(events[-1]['released']);self.assertFalse(workers[0].process.is_alive())

    def test_oom_group_guard_and_exact_nofile_proof_reject_missing_or_changed_invariants(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);source=SimpleNamespace(cgroup=root,cgroup_relative='/target')
            config={'source':{'memoryMax':'max','memoryHigh':'max','cpuMax':'max 100000'}}
            for key,value in (('memory.max','max'),('memory.high','max'),('cpu.max','max 100000'),('memory.oom.group','0')):(root/key).write_text(value)
            with patch.object(runtime,'inspect_source',return_value=source),patch.object(production,'own_group',return_value='/parent'):
                self.assertIs(production.check_source(config,None,'/parent'),source)
                (root/'memory.oom.group').write_text('1')
                with self.assertRaisesRegex(RuntimeError,'production_oom_group_changed'):production.check_source(config,None,'/parent')
        proof={'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1048576,'softAfter':1048576,'hardLimit':1048576,'raised':False,'hardChanged':False}
        self.assertEqual(production.nofile_proof(proof),proof)
        for changed in ({k:v for k,v in proof.items() if k!='hardLimit'},{**proof,'requiredSoft':20259},{**proof,'hardChanged':True},{**proof,'privatePath':'secret'}):
            with self.assertRaisesRegex(RuntimeError,'invalid_nofile_proof'):production.nofile_proof(changed)

    def test_valid_parent_command_gap_outlives_old_scaled_idle_lease_then_eof_is_prompt(self):
        worker = production.Holder(leased_holder,cleanup_seconds=.05)
        try:
            worker.connection.send('reconcile')
            self.assertTrue(worker.connection.poll(5))
            self.assertEqual(worker.connection.recv(),{'request':'source'})
            worker.connection.send({'source':SimpleNamespace(spec=None)})
            self.assertTrue(worker.connection.poll(1))
            self.assertEqual(worker.connection.recv(),{'state':{'fixtureState':True}})
            # 60→.6 and the previous15→.15: valid parent work lasts .25.
            time.sleep(.25)
            self.assertTrue(worker.process.is_alive())
            worker.connection.send('reconcile')
            self.assertTrue(worker.connection.poll(1))
            self.assertEqual(worker.connection.recv(),{'state':{'fixtureState':True}})
            begun = time.monotonic(); worker.connection.close(); worker.process.join(.4)
            self.assertFalse(worker.process.is_alive())
            self.assertLess(time.monotonic()-begun,.4)
        finally: worker.close()

    def test_reviewed_policy_requires_archive_plus_reserve_and_exact_source(self):
        with tempfile.TemporaryDirectory() as directory:
            store = Path(directory) / 'store'; store.mkdir()
            config = {
                'schema': 'production-mapped-data-pin.v1',
                'source': {'store': str(store), 'image': 'sha256:' + 'a' * 64,
                           'mounts': [[str(store), '/qdrant/storage', 'volume', True]],
                           'memoryBytes': 0, 'swapBytes': 0, 'cpuNanos': 0,
                           'memoryMax': 'max', 'memoryHigh': 'max', 'cpuMax': 'max 100000'},
                'policy': {'maxLockedBytes': 2 * pin.GIB, 'archiveBytes': 5 * pin.GIB,
                           'reserveBytes': 7 * pin.GIB, 'emergencyBytes': 3 * pin.GIB // 2,
                           'includePayload': False, 'capReserveBytes': 256 * 1024**2,
                           'mappingReserveCount': 1024},
                'lifetimeSeconds': 600,
            }
            path = Path(directory) / 'policy.json'
            def load():
                raw = json.dumps(config).encode(); path.write_bytes(raw)
                return production.load_policy(path, hashlib.sha256(raw).hexdigest())
            checked, spec, policy = load()
            self.assertEqual(spec.mode, 'production')
            self.assertEqual(spec.container, 'qdrant-main')
            self.assertEqual(policy.reserve_bytes, 7 * pin.GIB)
            config['policy']['reserveBytes'] = 2 * pin.GIB
            with self.assertRaises(ValueError): load()
            config['policy']['reserveBytes'] = 7 * pin.GIB
            config['policy']['includePayload'] = True
            with self.assertRaises(ValueError): load()
            config['policy']['includePayload'] = False
            config['source']['mounts'][0][2] = 'unknown'
            with self.assertRaises(ValueError): load()

    def test_blocked_holder_is_killed_reaped_and_cannot_claim_graceful_release(self):
        worker = production.Holder(stubborn_holder, cleanup_seconds=.05)
        self.assertTrue(worker.connection.poll(5))
        self.assertEqual(worker.connection.recv(), {'started': True})
        result = worker.close()
        self.assertEqual(result['exitCode'], -signal.SIGKILL)
        self.assertTrue(result['released'])
        self.assertTrue(result['holderExited'])
        self.assertFalse(result['gracefulReleaseAcknowledged'])
        self.assertFalse(Path('/proc', str(worker.process.pid)).exists())

    def test_supervisor_default_does_not_inspect_or_change_any_source(self):
        import subprocess
        result = subprocess.run([sys.executable, str(Path(production.__file__))],
                                capture_output=True, text=True, timeout=5)
        self.assertEqual(result.returncode, 0)
        value = json.loads(result.stdout)
        self.assertEqual(value['phase'], 'prepared')
        self.assertFalse(value['execution'])
        self.assertEqual(result.stderr, '')

    def test_invalid_cli_never_echoes_private_values_or_traceback(self):
        import subprocess
        result = subprocess.run([sys.executable,str(Path(production.__file__)),'--private-argument-value'],capture_output=True,text=True,timeout=5)
        self.assertEqual(result.returncode,1)
        self.assertEqual(result.stderr,'')
        self.assertNotIn('private-argument-value',result.stdout)
        self.assertEqual(json.loads(result.stdout)['phase'],'failed')

    def test_emergency_floor_interrupts_real_blocked_holder_before_pass_deadline(self):
        workers = []; records = []
        with tempfile.TemporaryDirectory() as directory:
            spec = runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source = runtime.Source(('private-container','private-image',900,100),900,Path(directory),'/fixture',spec)
            policy = pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            def factory(_target,_args):
                worker = production.Holder(stubborn_holder,cleanup_seconds=5)
                self.assertTrue(worker.connection.poll(5)); worker.connection.recv(); workers.append(worker)
                return worker
            checks = iter([{'availableBytes':10*pin.GIB},{'availableBytes':10*pin.GIB},{'availableBytes':pin.GIB}])
            begun = time.monotonic()
            with patch.object(production,'check_source',return_value=source),patch.object(runtime,'accounting',side_effect=lambda _s:next(checks)):
                with self.assertRaisesRegex(RuntimeError,'emergency_headroom_release'):
                    production.supervise({'lifetimeSeconds':600},spec,policy,records.append,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
            self.assertLess(time.monotonic()-begun,2)
            self.assertEqual(len(workers),1)
            self.assertFalse(workers[0].process.is_alive())
            self.assertEqual(records[-1]['phase'],'released')
            self.assertTrue(records[-1]['released'])
            self.assertFalse(records[-1]['gracefulReleaseAcknowledged'])

    def test_parent_connection_loss_exits_actual_holder_without_source_inspection(self):
        worker = production.Holder(production.holder,(None,None,None,False,False,production.code_hash()),cleanup_seconds=.05)
        worker.connection.close()
        worker.process.join(5)
        self.assertFalse(worker.process.is_alive())
        self.assertEqual(worker.process.exitcode,1)
        self.assertFalse(Path('/proc',str(worker.process.pid)).exists())

    def test_emergency_watchdog_kills_holder_while_parent_source_rpc_is_blocked(self):
        worker = production.Holder(stubborn_holder,cleanup_seconds=.02)
        self.assertTrue(worker.connection.poll(5)); worker.connection.recv()
        available = [10*pin.GIB]
        watchdog = production.EmergencyWatchdog(3*pin.GIB//2,read_available=lambda:available[0],poll_seconds=.01,kill_seconds=.03)
        watchdog.attach(worker)
        available[0] = pin.GIB
        # Parent deliberately does no control polling here: it could be in Docker.
        time.sleep(.2)
        worker.process.join(1)
        try:
            self.assertTrue(watchdog.tripped.is_set())
            self.assertFalse(worker.process.is_alive())
            self.assertEqual(worker.process.exitcode,-signal.SIGKILL)
        finally:
            watchdog.close(); worker.close()

    def test_source_turnover_during_blocked_pass_releases_actual_old_holder(self):
        workers = []; records = []
        with tempfile.TemporaryDirectory() as directory:
            spec = runtime.Spec('production','qdrant-main','sha256:'+'a'*64,Path(directory),frozenset(),0,0,0)
            source = runtime.Source(('private-container','private-image',900,100),900,Path(directory),'/fixture',spec)
            replacement = runtime.Source(('replacement','private-image',901,101),901,Path(directory),'/new-fixture',spec)
            policy = pin.Policy('production',pin.GIB,5*pin.GIB,7*pin.GIB,3*pin.GIB//2,cap_reserve_bytes=256*1024**2,mapping_reserve_count=1024)
            def factory(_target,_args):
                worker = production.Holder(stubborn_holder,cleanup_seconds=5)
                self.assertTrue(worker.connection.poll(5)); worker.connection.recv(); workers.append(worker); return worker
            with patch.object(production,'check_source',side_effect=[source,replacement]),patch.object(runtime,'accounting',return_value={'availableBytes':10*pin.GIB}):
                with self.assertRaisesRegex(RuntimeError,'source_changed_during_pass'):
                    production.supervise({'lifetimeSeconds':600},spec,policy,records.append,Path(directory)/'lock',worker_factory=factory,poll_seconds=.01)
            self.assertTrue(records[-1]['released'])
            self.assertFalse(workers[0].process.is_alive())


if __name__ == '__main__': unittest.main()
