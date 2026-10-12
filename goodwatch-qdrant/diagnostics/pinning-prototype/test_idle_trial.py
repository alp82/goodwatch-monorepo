import hashlib
import json
import os
from pathlib import Path
import signal
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import idle_trial as idle
import pin
import production
import runtime


def healthy():
    return {'source':{'pid':1,'startTicks':1,'cgroupHash':'a'*64,'ancestorLimitHash':'b'*64},
        'host':{k:12*pin.GIB if k=='MemAvailable' else 0 for k in idle.HOST_KEYS},'effectiveAvailableBytes':12*pin.GIB,
        'sourceMemory':{k:0 for k in (*idle.STAT_KEYS,'current')},'memoryEvents':dict.fromkeys(idle.MEMORY_KEYS,0),
        'cpuEvents':dict.fromkeys(idle.CPU_KEYS,0),'reclaim':dict.fromkeys(idle.RECLAIM_KEYS,0),
        'psi':{k:{'some':0,'full':0}for k in ('memory','io')}}


def fixture_holder(connection,lifetime):
    class Pins:
        def __init__(self,*args):pass
        def close(self):pass
        def release_state(self):return {'released':True,'heldMappingCount':0}
    with patch.object(runtime,'validate_source_locally',side_effect=lambda x:x),patch.object(runtime,'prepare_self'),patch.object(pin,'PinSet',Pins),patch.object(runtime,'reconcile_source',return_value={}),patch.object(production,'safe_state',return_value={}):
        idle.holder(connection,SimpleNamespace(),pin.IdlePolicy(),'unused',False,False,idle.code_hash(),lifetime=lifetime)


def lease(boundary):
    return {'checkedMonoNs':time.monotonic_ns(),'nextBackupMonoNs':int(boundary*1_000_000_000),
        'knownBackupIdle':True,'knownSnapshotPhaseIdle':True,'scheduleSha256':'c'*64}


def nonurgent_pipe_holder(connection,value):
    if connection.recv()!='reconcile':return
    connection.send({'failed':value})
    if connection.poll(30)and connection.recv()=='close':connection.send({'closed':True})


def sleeping_holder(connection):
    connection.send({'started':True})
    while True:time.sleep(.01)



def non_ack_proof_holder(connection,source):
    from test_production import proof_holder
    class Pipe:
        def poll(self,*args):return connection.poll(*args)
        def recv(self):return connection.recv()
        def send(self,row):
            if row!={'closed':True}:connection.send(row)
        def close(self):connection.close()
    proof_holder(Pipe(),source)


def actual_idle_holder(connection,root,spec,source,fail_after_lock=False):
    root=Path(root)
    def inventory(*args,**kwargs):
        targets=[pin.Target.open(root/k,k) for k in ('vector','graph','sparse','other')]
        return runtime.Inventory(targets,0,runtime.ensure_inventory_nofile(raise_own_nofile=True))
    reads=[0]
    def local_sample(value):
        reads[0]+=1
        if fail_after_lock and reads[0]==2:
            text=(root/'proc'/'meminfo').read_text().replace(f'MemAvailable: {12*pin.GIB//1024}',f'MemAvailable: {7*pin.GIB//1024}')
            (root/'proc'/'meminfo').write_text(text)
        return idle._sample(value,root/'proc',root/'cg',lambda value:value)
    with patch.object(runtime,'validate_source_locally',side_effect=lambda value:value),patch.object(runtime,'prepare_self'),patch.object(runtime,'inventory',side_effect=inventory),patch.object(idle,'sample',side_effect=local_sample):
        idle.holder(connection,spec,pin.IdlePolicy(),root/'actual-lock',False,True,idle.code_hash(),lifetime=10)


def pressure_files(root):
    proc=root/'proc';group=root/'cg'/'source';proc.mkdir();(proc/'pressure').mkdir();group.mkdir(parents=True)
    (proc/'meminfo').write_text('\n'.join(f'{key}: {12*pin.GIB//1024 if key=="MemAvailable" else 0} kB'for key in idle.HOST_KEYS))
    (proc/'vmstat').write_text('\n'.join(f'{key} 0'for key in idle.RECLAIM_KEYS))
    for name in ('memory','io'):(proc/'pressure'/name).write_text('some avg10=0 total=0\nfull avg10=0 total=0\n')
    (group/'memory.stat').write_text('\n'.join(f'{key} 0'for key in idle.STAT_KEYS));(group/'memory.current').write_text('0')
    for name,value in (('memory.max','max'),('memory.high','max'),('cpu.max','max 100000'),('memory.oom.group','0')):(group/name).write_text(value)
    (group/'memory.events').write_text('\n'.join(f'{key} 0'for key in idle.MEMORY_KEYS));(group/'cpu.stat').write_text('\n'.join(f'{key} 0'for key in idle.CPU_KEYS))
    return proc,group

class IdleTests(unittest.TestCase):
    def test_legacy_invariant_and_explicit_fields(self):
        with self.assertRaisesRegex(ValueError,'production_headroom_guard_cannot_be_relaxed'):
            pin.Policy('production',2*pin.GIB,5*pin.GIB,2*pin.GIB,2*pin.GIB,cap_reserve_bytes=1,mapping_reserve_count=1)
        policy=pin.IdlePolicy();self.assertEqual(policy.admission_bytes,10*pin.GIB);self.assertEqual(policy.reserve_bytes,8*pin.GIB)
        self.assertEqual((policy.floor_bytes,policy.transient_allowance_bytes),(2*pin.GIB,6*pin.GIB))
        for kwargs in ({'max_locked_bytes':pin.GIB},{'include_payload':True}):
            with self.assertRaises(ValueError):pin.IdlePolicy(**kwargs)

    def test_single_meminfo_units_and_no_tmp_discount(self):
        text='\n'.join(f'{k}: {12*pin.GIB//1024 if k=="MemAvailable" else 1024} kB'for k in idle.HOST_KEYS)
        values=idle.parse_meminfo(text);expected=12*pin.GIB-2*1024**2
        self.assertEqual(idle.effective_available(values),expected)
        values['WritebackTmp']=8*pin.GIB;self.assertEqual(idle.effective_available(values),expected)
        for bad in (text.replace('Writeback:','Missing:'),text.replace(' kB',' bytes',1),text+'\nDirty: 0 kB'):
            with self.assertRaisesRegex(RuntimeError,'idle_metric_missing'):idle.parse_meminfo(bad)

    def test_full_ceiling_admission_with_real_resident_small_mapping(self):
        with tempfile.TemporaryDirectory()as root:
            path=Path(root)/'owned';path.write_bytes(bytes(pin.PAGE));manager=pin.PinSet(pin.IdlePolicy(),Path(root)/'lock')
            try:
                memory={'availableBytes':10*pin.GIB-1,'anonBytes':0,'kernelBytes':0,'fileBytes':0,'unevictableBytes':0,'currentBytes':0,'cgroupMaxBytes':None}
                target=pin.Target.open(path,'vector');fd=target.fd
                with self.assertRaisesRegex(RuntimeError,'idle_full_budget_admission_failed'):manager.reconcile([target],('fixture',),memory)
                with self.assertRaises(OSError):os.fstat(fd)
                memory['availableBytes']=10*pin.GIB;state=manager.reconcile([pin.Target.open(path,'vector')],('fixture',),memory)
                self.assertEqual(state['lockedBytes'],pin.PAGE);self.assertEqual(state['lockedResidency']['vector']['residentLockedDataPages'],1)
            finally:manager.close()

    def test_adapter_refuses_legacy(self):
        manager=SimpleNamespace(policy=pin.Policy('fixture',pin.PAGE,0,0,0),release=lambda:None,release_state=lambda:{'released':True,'heldMappingCount':0},mappings={})
        with self.assertRaisesRegex(ValueError,'idle_accounting_adapter_required'):runtime.reconcile_source(manager,None,accounting_reader=lambda s:{})

    def test_idle_policy_requires_effective_accounting_adapter(self):
        with tempfile.TemporaryDirectory() as root:
            manager=pin.PinSet(pin.IdlePolicy(),Path(root)/'lock')
            try:
                with self.assertRaisesRegex(ValueError,'idle_accounting_adapter_required'):
                    runtime.reconcile_source(manager,None)
                self.assertEqual(manager.release_state(),{'released':True,'heldMappingCount':0})
            finally:manager.close()

    def test_pressure_reset_growth_and_scientific_separation(self):
        before=healthy();now=healthy();now['effectiveAvailableBytes']=8*pin.GIB;idle.check_pressure(before,now)
        now['effectiveAvailableBytes']-=1
        with self.assertRaisesRegex(RuntimeError,'idle_headroom'):idle.check_pressure(before,now)
        now=healthy();now['sourceMemory']['anon']=3*pin.GIB//2+1
        with self.assertRaisesRegex(RuntimeError,'idle_anon_growth'):idle.check_pressure(before,now)
        now=healthy();now['reclaim']['workingset_refault_file']=1;idle.check_pressure(before,now)
        with self.assertRaisesRegex(RuntimeError,'idle_quiet_pressure'):idle.check_pressure(before,now,before)
        now=healthy();before['cpuEvents']['nr_throttled']=1
        with self.assertRaisesRegex(RuntimeError,'idle_metric_reset'):idle.check_pressure(before,now)

    def test_independent_guard_kills_actual_owned_process_without_main_poll(self):
        worker=production.Holder(sleeping_holder);self.assertTrue(worker.connection.poll(30));worker.connection.recv()
        row=healthy();guard=idle.Guard(lambda:row,healthy(),time.monotonic()+10,poll=.02,stale=.2)
        try:
            guard.attach(worker);row['effectiveAvailableBytes']=7*pin.GIB;worker.process.join(30)
            self.assertFalse(worker.alive_owned());self.assertEqual(worker.process.exitcode,-signal.SIGKILL);self.assertEqual(guard.first_reason,'idle_headroom')
        finally:worker.close(emergency=True);guard.close()

    def test_scientific_abort_leaves_owned_holder_for_graceful_close(self):
        worker=production.Holder(sleeping_holder);self.assertTrue(worker.connection.poll(30));worker.connection.recv()
        row=healthy();guard=idle.Guard(lambda:row,healthy(),time.monotonic()+10,poll=.02,stale=1)
        try:
            guard.attach(worker);guard.begin_hold(healthy());row['psi']['io']['full']=1
            limit=time.monotonic()+1
            while guard.first_reason is None and time.monotonic()<limit:time.sleep(.01)
            self.assertEqual(guard.first_reason,'idle_quiet_pressure');self.assertTrue(worker.alive_owned())
        finally:worker.close(emergency=True);guard.close()

    def test_mutual_liveness(self):
        entered=threading.Event();release=threading.Event()
        def blocked():entered.set();release.wait(1);return healthy()
        guard=idle.Guard(blocked,healthy(),time.monotonic()+10,poll=.01,stale=.03)
        try:
            self.assertTrue(entered.wait(1));time.sleep(.05)
            with self.assertRaisesRegex(RuntimeError,'idle_poll_stale'):guard.pulse()
            self.assertEqual(guard.first_reason,'idle_poll_stale')
        finally:release.set();guard.close()
        guard=idle.Guard(healthy,healthy(),time.monotonic()+10,poll=.01,stale=.03,main_stale=.03)
        try:time.sleep(.08);self.assertEqual(guard.first_reason,'idle_main_stale')
        finally:guard.close()

    def test_kernel_timer_ends_real_holder_while_waiting_for_rpc(self):
        worker=production.Holder(fixture_holder,(.25,))
        try:
            worker.connection.send('reconcile');self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'request':'source'})
            worker.process.join(30);self.assertEqual(worker.process.exitcode,-signal.SIGALRM);self.assertTrue(worker.close()['released'])
        finally:worker.close(emergency=True)

    def test_actual_idle_holder_eof_after_state_exits_before_lease_or_timer(self):
        worker=production.Holder(fixture_holder,(60,))
        try:
            worker.connection.send('reconcile');self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'request':'source'})
            worker.connection.send({'source':SimpleNamespace(spec=SimpleNamespace())})
            self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'state':{}})
            # idle.holder's real poll lease and kernel timer are both60s;
            # neither can impersonate EOF inside this5s gate.
            worker.connection.close();worker.process.join(5)
            self.assertFalse(worker.alive_owned());self.assertEqual(worker.process.exitcode,1)
            self.assertTrue(worker.close()['released'])
        finally:worker.close(emergency=True)

    def test_exactly_one_reconcile_real_pipe(self):
        worker=production.Holder(fixture_holder,(5,))
        try:
            worker.connection.send('reconcile');self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'request':'source'})
            worker.connection.send({'source':SimpleNamespace(spec=SimpleNamespace())})
            self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'state':{}})
            worker.connection.send('reconcile');self.assertTrue(worker.connection.poll(30));self.assertEqual(worker.connection.recv(),{'failed':'idle_second_reconcile'})
            worker.process.join(30);self.assertEqual(worker.process.exitcode,1)
        finally:worker.close(emergency=True)

    def test_actual_parent_one_pass_registered_birth_hold_and_exit(self):
        from test_production import proof_holder
        fields=(Path('/proc/self/stat').read_text().rsplit(')',1)[1].split())
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        rows=[];registered=[];workers=[];boundary=time.monotonic()+1000
        def factory(target,args):
            worker=production.Holder(proof_holder,(source,));workers.append(worker);return worker
        result=idle._run({},None,lambda row:registered.append(row)or True,rows.append,'unused',lambda:lease(boundary),
            idle.code_hash(),'a'*64,reader=lambda source:healthy(),check_source=lambda *args:source,
            worker_factory=factory,baseline_seconds=.02,hold_seconds=.08,initial_seconds=30,poll=.01)
        self.assertEqual(result,'pass',rows[-1]);self.assertEqual(len(workers),1);self.assertEqual(len(registered),1)
        phases=[row['phase']for row in rows]
        self.assertLess(phases.index('holder_started'),phases.index('lock_ready'))
        complete=rows[-1];self.assertTrue(complete['cleanup']['released']);self.assertEqual(complete['cleanup']['exitCode'],0)
        self.assertIsNone(complete['guardReason']);self.assertEqual(complete['completionReason'],'idle_hold_complete');self.assertIsNone(complete['cleanupReason'])

    def test_schedule_and_required_metrics_refuse_before_child(self):
        source=SimpleNamespace(identity=('fixture',));rows=[]
        def forbidden(*args):self.fail('child must not spawn')
        result=idle._run({},None,lambda row:True,rows.append,'unused',lambda:lease(time.monotonic()+1),
            idle.code_hash(),'a'*64,reader=lambda source:healthy(),check_source=lambda *args:source,worker_factory=forbidden)
        self.assertEqual(result,'refused');self.assertEqual(rows[-1]['mainReason'],'idle_schedule_expired')
        def missing(source):raise RuntimeError('idle_metric_missing')
        result=idle._run({},None,lambda row:True,rows.append,'unused',lambda:lease(time.monotonic()+1000),
            idle.code_hash(),'a'*64,reader=missing,check_source=lambda *args:source,worker_factory=forbidden)
        self.assertEqual(result,'refused');self.assertEqual(rows[-1]['mainReason'],'idle_metric_missing')

    def test_scientific_first_reason_retained_when_cleanup_pressure_becomes_safety(self):
        row=healthy();guard=idle.Guard(lambda:row,healthy(),time.monotonic()+10,poll=.01,stale=1)
        try:
            guard.begin_hold(healthy());row['psi']['io']['full']=1
            deadline=time.monotonic()+1
            while guard.first_reason is None and time.monotonic()<deadline:time.sleep(.01)
            self.assertEqual(guard.first_reason,'idle_quiet_pressure')
            row['effectiveAvailableBytes']=7*pin.GIB
            while guard.safety_reason is None and time.monotonic()<deadline:time.sleep(.01)
            self.assertEqual(guard.first_reason,'idle_quiet_pressure');self.assertEqual(guard.safety_reason,'idle_headroom')
        finally:guard.close()

    def test_actual_parent_scientific_abort_is_graceful_and_not_pass(self):
        from test_production import proof_holder
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        rows=[];flag=[False];boundary=time.monotonic()+1000
        def reader(source):
            row=healthy()
            if flag[0]:row['psi']['io']['full']=1
            return row
        def emit(row):
            rows.append(row)
            if row['phase']=='lock_ready':flag[0]=True
        def factory(target,args):return production.Holder(proof_holder,(source,))
        result=idle._run({},None,lambda row:True,emit,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
            reader=reader,check_source=lambda *args:source,worker_factory=factory,
            baseline_seconds=.01,hold_seconds=.2,initial_seconds=30,poll=.01)
        self.assertEqual(result,'inconclusive',rows[-1]);self.assertEqual(rows[-1]['guardReason'],'idle_quiet_pressure')
        self.assertEqual(rows[-1]['cleanup']['exitCode'],0);self.assertTrue(rows[-1]['cleanup']['gracefulReleaseAcknowledged'])
        self.assertIsNone(rows[-1]['safetyReason']);self.assertIsNone(rows[-1]['cleanupReason'])

    def test_backup_lease_freshness_and_unknown_jobs_refuse(self):
        row=lease(time.monotonic()+1000);idle.backup_lease(row)
        for changed in ({'knownBackupIdle':False},{'knownSnapshotPhaseIdle':False},{'checkedMonoNs':time.monotonic_ns()-2_000_000_000}):
            with self.assertRaisesRegex(RuntimeError,'idle_schedule_expired'):idle.backup_lease({**row,**changed})

    def test_real_reader_preflight_and_finite_ancestor_refusal(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);proc,group=pressure_files(root)
            source=SimpleNamespace(pid=1,identity=('fixture','image',1,1),cgroup_relative='/fixture',cgroup=group)
            row=idle._sample(source,proc,root/'cg',lambda value:value)
            self.assertEqual(row['effectiveAvailableBytes'],12*pin.GIB);self.assertEqual(row['source']['pid'],1)
            (root/'cg'/'memory.max').write_text(str(4*pin.GIB))
            with self.assertRaisesRegex(RuntimeError,'idle_source_changed'):idle._sample(source,proc,root/'cg',lambda value:value)
            (root/'cg'/'memory.max').unlink();(proc/'vmstat').write_text('allocstall_normal 0')
            with self.assertRaisesRegex(RuntimeError,'idle_metric_missing'):idle._sample(source,proc,root/'cg',lambda value:value)

    def test_real_idle_holder_pinset_runtime_and_accounting_adapter(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);proc,group=pressure_files(root)
            for kind in ('vector','graph','sparse','other'):(root/kind).write_bytes(bytes(pin.PAGE))
            fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
            spec=runtime.Spec('production','qdrant-main','fixture',root,frozenset(),0,0,0)
            source=SimpleNamespace(spec=spec,pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group(),cgroup=group)
            worker=production.Holder(actual_idle_holder,(name,spec,source))
            try:
                worker.connection.send('reconcile');state=None;limit=time.monotonic()+8
                while time.monotonic()<limit:
                    if not worker.connection.poll(.05):continue
                    row=worker.connection.recv()
                    if row=={'request':'source'}:worker.connection.send({'source':source});continue
                    self.assertIn('state',row,row);state=row['state'];break
                self.assertIsNotNone(state);self.assertEqual(state['lockedBytes'],4*pin.PAGE)
                proof=production.verify_holder(worker,source,state,pin.IdlePolicy());self.assertEqual(proof['vmLockedBytes'],4*pin.PAGE)
                cleanup=worker.close();self.assertTrue(cleanup['gracefulReleaseAcknowledged']);self.assertEqual(cleanup['exitCode'],0)
            finally:worker.close(emergency=True)

    def test_signal_inside_guard_mutex_only_sets_flag_and_releases_owned_child(self):
        from test_production import proof_holder
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        boundary=time.monotonic()+1000;rows=[]
        class SignalGuard(idle.Guard):
            def begin_hold(self,row,seconds):
                original=self.clock;fired=[False]
                def clock():
                    if threading.current_thread()is threading.main_thread() and not fired[0]:
                        fired[0]=True;os.kill(os.getpid(),signal.SIGTERM)
                    return original()
                self.clock=clock
                return super().begin_hold(row,seconds)
        result=idle._run({},None,lambda row:True,rows.append,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
            reader=lambda source:healthy(),check_source=lambda *args:source,worker_factory=lambda target,args:production.Holder(proof_holder,(source,)),
            guard_factory=SignalGuard,baseline_seconds=.01,hold_seconds=.05,initial_seconds=30,poll=.01)
        self.assertEqual(result,'safety_abort',rows[-1]);self.assertEqual(rows[-1]['safetyReason'],'idle_interrupted');self.assertTrue(rows[-1]['cleanup']['released'])

    def test_main_safety_failure_after_hold_end_is_never_masked_as_pass(self):
        from test_production import proof_holder
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        changed=SimpleNamespace(**{**vars(source),'identity':('changed','image',os.getpid(),int(fields[19]))})
        boundary=time.monotonic()+1000;rows=[];late=[False]
        def emit(row):
            rows.append(row)
            if row['phase']=='lock_ready':time.sleep(.08);late[0]=True
        result=idle._run({},None,lambda row:True,emit,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
            reader=lambda source:healthy(),check_source=lambda *args:changed if late[0]else source,
            worker_factory=lambda target,args:production.Holder(proof_holder,(source,)),baseline_seconds=.01,hold_seconds=.02,initial_seconds=30,poll=.01)
        self.assertEqual(result,'safety_abort',rows[-1]);self.assertEqual(rows[-1]['mainReason'],'idle_source_changed')
        self.assertEqual(rows[-1]['cleanup']['exitCode'],-signal.SIGKILL)

    def test_proven_exit_without_graceful_ack_is_not_pass(self):
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        rows=[];boundary=time.monotonic()+1000
        result=idle._run({},None,lambda row:True,rows.append,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
            reader=lambda source:healthy(),check_source=lambda *args:source,
            worker_factory=lambda target,args:production.Holder(non_ack_proof_holder,(source,)),baseline_seconds=.01,hold_seconds=.02,initial_seconds=30,poll=.01)
        self.assertEqual(result,'inconclusive',rows[-1]);self.assertTrue(rows[-1]['cleanup']['released'])
        self.assertEqual(rows[-1]['cleanupReason'],'idle_release_not_graceful')

    def test_triggering_pressure_record_retained_with_original_phase(self):
        now=healthy();guard=idle.Guard(lambda:now,healthy(),time.monotonic()+10,poll=.01)
        try:
            guard.set_phase('initial');now['effectiveAvailableBytes']=7*pin.GIB
            deadline=time.monotonic()+1
            while guard.first_reason is None and time.monotonic()<deadline:time.sleep(.01)
            rows=guard.drain();self.assertTrue(any(row['phase']=='initial' and row['sample']['effectiveAvailableBytes']==7*pin.GIB for row in rows))
            self.assertEqual(guard.first_reason,'idle_headroom')
        finally:guard.close()

    def test_actual_runtime_postlock_headroom_failure_is_safety_abort(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);proc,group=pressure_files(root)
            for kind in ('vector','graph','sparse','other'):(root/kind).write_bytes(bytes(pin.PAGE))
            fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
            spec=runtime.Spec('production','qdrant-main','fixture',root,frozenset(),0,0,0)
            source=SimpleNamespace(spec=spec,pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group(),cgroup=group)
            rows=[];boundary=time.monotonic()+1000
            result=idle._run({},spec,lambda row:True,rows.append,root/'parent-lock',lambda:lease(boundary),idle.code_hash(),'a'*64,
                reader=lambda source:healthy(),check_source=lambda *args:source,
                worker_factory=lambda target,args:production.Holder(actual_idle_holder,(name,spec,source,True)),
                baseline_seconds=.01,hold_seconds=.02,initial_seconds=30,poll=.01)
            self.assertEqual(result,'safety_abort',rows[-1]);self.assertEqual(rows[-1]['mainReason'],'source_or_emergency_headroom_changed_after_locking')
            self.assertEqual(rows[-1]['safetyReason'],'source_or_emergency_headroom_changed_after_locking');self.assertTrue(rows[-1]['cleanup']['released'])

    def test_blocked_observer_shutdown_does_not_hide_proven_holder_release(self):
        from test_production import proof_holder
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        rows=[];boundary=time.monotonic()+1000;block=[False];entered=threading.Event();release=threading.Event();guards=[]
        def reader(source):
            if block[0] and threading.current_thread()is not threading.main_thread():entered.set();release.wait(4)
            return healthy()
        def emit(row):
            rows.append(row)
            if row['phase']=='pre_release':block[0]=True;self.assertTrue(entered.wait(1))
        def factory(*args,**kwargs):
            guard=idle.Guard(*args,**kwargs);guards.append(guard);return guard
        try:
            result=idle._run({},None,lambda row:True,emit,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
                reader=reader,check_source=lambda *args:source,
                worker_factory=lambda target,args:production.Holder(proof_holder,(source,)),guard_factory=factory,
                baseline_seconds=.01,hold_seconds=.02,initial_seconds=30,poll=.01)
            self.assertEqual(result,'inconclusive',rows[-1]);self.assertTrue(rows[-1]['cleanup']['released'])
            self.assertIsNone(rows[-1]['cleanupReason']);self.assertFalse(rows[-1]['guardExited']);self.assertEqual(rows[-1]['observerShutdownReason'],'idle_poll_stale')
        finally:
            release.set()
            for guard in guards:guard.close()

    def test_public_run_uses_shared_lock_and_real_lock_excludes_overlap(self):
        import fcntl
        from contextlib import contextmanager
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);root.chmod(0o700);policy=root/'policy'
            config={'schema':'production-idle-lock-release.v1','maxLockedBytes':2*pin.GIB,'floorBytes':2*pin.GIB,
                'transientAllowanceBytes':6*pin.GIB,'includePayload':False,'capReserveBytes':256*1024**2,
                'mappingReserveCount':1024,'baselineSeconds':30,'initialSeconds':180,'holdSeconds':30,'cleanupSeconds':20,'pollSeconds':2}
            policy.write_text(json.dumps(config));digest=hashlib.sha256(policy.read_bytes()).hexdigest();called=[]
            actual_lock=idle._supervisor_lock
            @contextmanager
            def local_owned_lock(requested):
                self.assertEqual(requested,Path('/run/goodwatch-qdrant-pin'))
                with actual_lock(root,owner_uid=os.geteuid())as holder_lock:yield holder_lock
            def fixture(*args):
                fd=os.open(root/'supervisor.lock',os.O_RDWR)
                try:
                    with self.assertRaises(BlockingIOError):fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
                    called.append(args[4]);return 'fixture_complete'
                finally:os.close(fd)
            spec=SimpleNamespace(mode='production',container='qdrant-main')
            with patch.object(idle,'_supervisor_lock',side_effect=local_owned_lock),patch.object(idle,'_run',side_effect=fixture):
                self.assertEqual(idle.run({},spec,lambda row:True,lambda row:None,lambda:None,'a'*64,policy,digest),'fixture_complete')
            self.assertEqual(called,[root/'holder.lock'])
            fd=os.open(root/'supervisor.lock',os.O_RDWR)
            try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
            finally:os.close(fd)
            if os.geteuid()!=0:
                with self.assertRaisesRegex(RuntimeError,'owned_supervisor_directory_required'):
                    with actual_lock(root):self.fail('production ownership cannot be relaxed')

    def test_hold_trip_after_last_main_fence_vetoes_pass(self):
        from test_production import proof_holder
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        rows=[];boundary=time.monotonic()+1000;pressure=[False];guards=[]
        def reader(source):
            row=healthy()
            if pressure[0]:row['psi']['io']['full']=1
            return row
        def emit(row):
            rows.append(row)
            if row['phase']=='pre_release':
                pressure[0]=True;deadline=time.monotonic()+2
                while guards[0].first_reason is None and time.monotonic()<deadline:time.sleep(.01)
                self.assertEqual(guards[0].first_reason,'idle_quiet_pressure')
        def guard_factory(*args,**kwargs):
            guard=idle.Guard(*args,**kwargs);guards.append(guard);return guard
        result=idle._run({},None,lambda row:True,emit,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
            reader=reader,check_source=lambda *args:source,
            worker_factory=lambda target,args:production.Holder(proof_holder,(source,)),guard_factory=guard_factory,
            baseline_seconds=.01,hold_seconds=.02,initial_seconds=30,poll=.01)
        self.assertEqual(result,'inconclusive',rows[-1]);self.assertEqual(rows[-1]['guardReason'],'idle_quiet_pressure')
        self.assertTrue(rows[-1]['cleanup']['gracefulReleaseAcknowledged']);self.assertEqual(rows[-1]['cleanup']['exitCode'],0)

    def _real_parent_fixture(self,emit_hook=None,reader_hook=None,source_hook=None,register_hook=None,guard_factory=idle.Guard,worker_target=None,worker_args=()):
        from test_production import proof_holder
        fields=Path('/proc/self/stat').read_text().rsplit(')',1)[1].split()
        source=SimpleNamespace(pid=os.getpid(),identity=('fixture','image',os.getpid(),int(fields[19])),cgroup_relative=production.own_group())
        rows=[];workers=[];phase=[None];boundary=time.monotonic()+1000
        def emit(row):
            rows.append(row);phase[0]=row['phase']
            if emit_hook:emit_hook(row,workers)
        def factory(target,args):
            worker=production.Holder(worker_target or proof_holder,worker_args if worker_target else (source,));workers.append(worker);return worker
        def reader(value):return reader_hook(phase[0],workers)if reader_hook else healthy()
        def checked(*args):return source_hook(phase[0],source)if source_hook else source
        def registered(row):return register_hook(row)if register_hook else True
        result=idle._run({},None,registered,emit,'unused',lambda:lease(boundary),idle.code_hash(),'a'*64,
            reader=reader,check_source=checked,worker_factory=factory,guard_factory=guard_factory,baseline_seconds=.01,hold_seconds=.02,initial_seconds=30,poll=.01)
        self.assertTrue(all(not worker.alive_owned()for worker in workers))
        return result,rows

    def test_real_parent_source_loss_and_limit_reasons_are_urgent(self):
        for value in ('docker_inspection_failed','actual_qdrant_pid_ambiguous','actual_qdrant_comm_changed','production_limit_event'):
            with self.subTest(reason=value):
                def checked(phase,source):
                    if phase=='lock_ready':raise RuntimeError(value)
                    return source
                result,rows=self._real_parent_fixture(source_hook=checked)
                final=rows[-1];self.assertEqual(result,'safety_abort',final)
                self.assertEqual(final['safetyReason'],value);self.assertEqual(final['mainReason'],value)
                self.assertIsNone(final['guardReason']);self.assertEqual(final['firstReasonOrigin'],'main')
                self.assertEqual(final['cleanup']['exitCode'],-signal.SIGKILL)

    def test_holder_pipe_cannot_claim_scientific_or_completion_exception(self):
        for value in ('idle_quiet_pressure','idle_hold_complete'):
            with self.subTest(reason=value):
                result,rows=self._real_parent_fixture(worker_target=nonurgent_pipe_holder,worker_args=(value,))
                final=rows[-1];self.assertEqual(result,'safety_abort',final)
                self.assertEqual(final['mainReason'],'invalid_holder_reply');self.assertEqual(final['cleanup']['exitCode'],-signal.SIGKILL)
                self.assertNotIn('lock_ready',[row['phase']for row in rows])

    def test_guard_urgency_branch_kills_actual_owned_worker_without_parent_finally(self):
        worker=production.Holder(sleeping_holder)
        self.assertTrue(worker.connection.poll(30));worker.connection.recv()
        guard=idle.Guard(healthy,healthy(),time.monotonic()+100,poll=.01)
        try:
            guard.attach(worker);guard.trip('source_rpc_budget');worker.process.join(30)
            self.assertFalse(worker.alive_owned());self.assertEqual(worker.process.exitcode,-signal.SIGKILL)
            self.assertEqual(guard.safety_reason,'source_rpc_budget')
        finally:guard.close();worker.close(emergency=True)

    def test_registration_failure_before_guard_attach_uses_parent_urgency_branch(self):
        result,rows=self._real_parent_fixture(register_hook=lambda row:False)
        final=rows[-1];self.assertEqual(result,'safety_abort',final)
        self.assertEqual(final['safetyReason'],'idle_registration_unproven')
        self.assertEqual(final['cleanup']['exitCode'],-signal.SIGKILL);self.assertTrue(final['cleanup']['released'])
        self.assertNotIn('lock_ready',[row['phase']for row in rows])

    def test_parent_safe_state_missing_proof_reasons_are_urgent(self):
        actual=production.safe_state
        for value in ('locked_data_residency_incomplete','holder_memlock_limit_missing','invalid_production_policy','production_limit_event'):
            with self.subTest(reason=value):
                def corrupted(state):
                    # Child ran its original validator; the real parent validates
                    # the actual pipe reply after this controlled corruption.
                    import copy
                    state=copy.deepcopy(state)
                    if value=='locked_data_residency_incomplete':state['lockedResidency']['vector']['residentLockedDataPages']=0
                    elif value=='holder_memlock_limit_missing':state['memlockLimits']['softAfter']=0
                    elif value=='invalid_production_policy':state['lockedBytes']=-1
                    else:state['memoryEventDelta']['oom']=1
                    return actual(state)
                with patch.object(production,'safe_state',side_effect=corrupted):result,rows=self._real_parent_fixture()
                final=rows[-1];self.assertEqual(result,'safety_abort',final)
                self.assertEqual(final['mainReason'],value);self.assertEqual(final['safetyReason'],value)
                self.assertTrue(final['cleanup']['released']);self.assertEqual(final['cleanup']['exitCode'],-signal.SIGKILL)

    def test_parent_rpc_and_spec_failure_with_live_holder_are_urgent(self):
        for value in ('source_rpc_budget','unreviewed_source_spec'):
            with self.subTest(reason=value):
                def checked(phase,source):
                    if phase=='lock_ready':raise RuntimeError(value)
                    return source
                result,rows=self._real_parent_fixture(source_hook=checked)
                final=rows[-1];self.assertEqual(result,'safety_abort',final)
                self.assertEqual(final['safetyReason'],value);self.assertEqual(final['cleanup']['exitCode'],-signal.SIGKILL)

    def test_real_holder_death_during_hold_is_safety_abort(self):
        def died(row,workers):
            if row['phase']=='lock_ready':workers[0].signal_owned(signal.SIGKILL);workers[0].process.join(30)
        result,rows=self._real_parent_fixture(emit_hook=died)
        self.assertEqual(result,'safety_abort',rows[-1]);self.assertEqual(rows[-1]['safetyReason'],'idle_holder_disappeared')
        self.assertTrue(rows[-1]['cleanup']['released'])

    def test_postrelease_headroom_and_limit_promoted_without_overwriting_cleanup(self):
        for value in ('idle_headroom','idle_limit_event'):
            with self.subTest(reason=value):
                def reader(phase,workers):
                    row=healthy()
                    if threading.current_thread()is threading.main_thread() and workers and not workers[0].alive_owned():
                        if value=='idle_headroom':row['effectiveAvailableBytes']=7*pin.GIB
                        else:row['memoryEvents']['oom_kill']=1
                    return row
                result,rows=self._real_parent_fixture(reader_hook=reader)
                final=rows[-1];self.assertEqual(result,'safety_abort',final);self.assertEqual(final['postReleaseReason'],value)
                self.assertEqual(final['safetyReason'],value);self.assertIsNone(final['firstReason']);self.assertIsNone(final['observerShutdownReason']);self.assertIsNone(final['drainReason'])
                self.assertEqual(final['cleanup']['exitCode'],0);self.assertTrue(final['cleanup']['gracefulReleaseAcknowledged'])

    def test_hold_end_real_proof_rechecked_and_compared_to_parent_birth(self):
        original=production.verify_holder;calls=[]
        def verify(*args):
            row=original(*args);calls.append(row)
            if len(calls)==2:row['holderStartTicks']+=1
            return row
        with patch.object(production,'verify_holder',side_effect=verify):result,rows=self._real_parent_fixture()
        self.assertEqual(len(calls),2);self.assertEqual(result,'safety_abort',rows[-1]);self.assertEqual(rows[-1]['mainReason'],'holder_placement_changed')
        self.assertEqual(rows[-1]['cleanup']['exitCode'],-signal.SIGKILL)

    def test_registration_callback_cannot_mutate_parent_birth(self):
        def register(row):row['holderStartTicks']+=1;return True
        result,rows=self._real_parent_fixture(register_hook=register)
        self.assertEqual(result,'pass',rows[-1]);self.assertIn('lock_ready',[row['phase']for row in rows])
        birth=next(row for row in rows if row['phase']=='holder_started');proof=next(row for row in rows if row['phase']=='lock_ready')
        self.assertEqual(birth['holderStartTicks'],proof['holderStartTicks'])

    def test_shutdown_drain_and_postrelease_failures_remain_distinct(self):
        class FailedObservationGuard(idle.Guard):
            finished=False
            def close(self):
                self.finished=True;super().close();return False
            def drain(self):
                if self.finished:raise RuntimeError('idle_guard_failure')
                return super().drain()
        def reader(phase,workers):
            row=healthy()
            if threading.current_thread()is threading.main_thread() and workers and not workers[0].alive_owned():row['memoryEvents']['oom_kill']=1
            return row
        result,rows=self._real_parent_fixture(reader_hook=reader,guard_factory=FailedObservationGuard)
        final=rows[-1];self.assertEqual(result,'safety_abort',final)
        self.assertEqual(final['observerShutdownReason'],'idle_poll_stale')
        self.assertEqual(final['drainReason'],'idle_guard_failure');self.assertEqual(final['postReleaseReason'],'idle_limit_event')
        self.assertEqual(final['safetyReason'],'idle_limit_event');self.assertTrue(final['cleanup']['released'])
        self.assertEqual(final['cleanup']['exitCode'],0)

    def test_real_intermediate_ancestor_high_and_cpu_refuse(self):
        with tempfile.TemporaryDirectory()as name:
            root=Path(name);proc,group=pressure_files(root);middle=root/'cg'/'middle';middle.mkdir();group.rename(middle/'source');group=middle/'source'
            source=SimpleNamespace(pid=1,identity=('fixture','image',1,1),cgroup_relative='/middle/source',cgroup=group)
            for key,value in (('memory.max','max'),('memory.high','max'),('cpu.max','max 100000')):(middle/key).write_text(value)
            self.assertEqual(idle._sample(source,proc,root/'cg',lambda value:value)['effectiveAvailableBytes'],12*pin.GIB)
            for key,value in (('memory.max',str(4*pin.GIB)),('memory.high',str(4*pin.GIB)),('cpu.max','200000 100000')):
                with self.subTest(key=key):
                    (middle/key).write_text(value)
                    with self.assertRaisesRegex(RuntimeError,'idle_source_changed'):idle._sample(source,proc,root/'cg',lambda value:value)
                    (middle/key).write_text('max 100000'if key=='cpu.max'else 'max')

    def test_default_cli_and_disjoint_schema(self):
        with patch('builtins.print')as output:
            self.assertEqual(idle.main([]),0);self.assertFalse(json.loads(output.call_args.args[0])['execution']);self.assertEqual(idle.main(['--execute-reviewed']),1)
        with tempfile.TemporaryDirectory()as root:
            path=Path(root)/'policy';path.write_text('{"schema":"production-mapped-data-pin.v1"}')
            with self.assertRaisesRegex(ValueError,'invalid_idle_policy'):idle.load_policy(path,hashlib.sha256(path.read_bytes()).hexdigest())


if __name__=='__main__':unittest.main()
