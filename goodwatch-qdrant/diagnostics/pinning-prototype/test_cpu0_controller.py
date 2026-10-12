import copy
from contextlib import ExitStack
import json
import hashlib
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock,MagicMock,patch
import controller_cpu0 as control
import daemon_cpu0 as daemon
import pin_cpu0 as pin
def accounting():
    return {'availableBytes': 8*pin.GIB, 'cgroupMaxBytes': 6*pin.GIB, 'anonBytes': 1, 'fileBytes': 1, 'kernelBytes': 1, 'unevictableBytes': 0, 'currentBytes': 3,
        'memoryEvents': {'oom': 0, 'oom_kill': 0, 'max': 0}, 'cpu': {'nr_throttled': 0, 'throttled_usec': 0}}


def nofile_state():
    return {'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1048576,'softAfter':1048576,'hardLimit':1048576,'raised':False,'hardChanged':False}


def pin_state():
    return {'nofileLimits':nofile_state(), 'event': 'mapped-data-pin-state.v1', 'mode': 'clone', 'queries': 0, 'storageWrites': 0, 'lockedBytes': 16384, 'newLockBytes': 16384,
        'selectionHash': 'a'*64, 'extentRangesHashed': True, 'qdrantPid': 123, 'sourceStartTicks': 100, 'pageBytes': 4096, 'rangesChanged': True, 'deletedMappingsExcluded':0, 'memoryEventDelta':{'oom':0,'oom_kill':0,'max':0}, 'cpuLimitDelta':{'nr_throttled':0,'throttled_usec':0}, 'clonePressureMaxAllowed':False,
        'classesMeasured': {k: {'files': 1, 'dataLockBytes': 4096,'dataPages':1,'rawExtentCount':1,'dataRangeCount':1} for k in daemon.KINDS},
        'lockedResidency': {k: {'lockedDataPages': 1, 'residentLockedDataPages': 1} for k in ('vector', 'graph', 'sparse', 'other')},
        'mappingBounds':{'currentVmas':64,'maxMapCount':65530,'projectedAdditionalVmas':12,'reservedVmas':256,'projectedTotalVmas':332},'nonresidentSelectedBytes':16384,'projectedCurrentBytes':16387,'capReserveBytes':0,'capHeadroomRequired':True, 'accountingBefore': accounting(), 'accountingAfter': accounting(), 'private': 'private-source-path'}


class CallerTests(unittest.TestCase):
    def test_parent_before_pass_refusal_preserves_scope_before_sending_command(self):
        holder=control.PinChild.__new__(control.PinChild)
        holder.spec=object();holder.previous=accounting();holder.pressure_active=False;holder.connection=Mock()
        after=accounting();after['cpu']['nr_throttled']=1
        with patch.object(control,'inspect_source',return_value=object()),patch.object(control.runtime,'accounting',return_value=after):
            with self.assertRaises(RuntimeError) as failure:holder.request()
        self.assertEqual(failure.exception.resourceLimitEvidence['scope'],'held-pin-prior-to-pass')
        holder.connection.send.assert_not_called()
    def test_parent_pass_refusal_retains_actual_effective_pressure_flag(self):
        holder=control.PinChild.__new__(control.PinChild)
        holder.spec=object();holder.previous=None;holder.pressure_active=False;holder.config={'initialPinRequestSeconds':180};holder.connection=Mock()
        holder.connection.poll.return_value=True;holder.connection.recv.return_value={'state':{'newLockBytes':0,'rangesChanged':False}}
        changed=accounting();changed['cpu']['throttled_usec']=7
        with patch.object(control,'inspect_source',return_value=object()),patch.object(control.runtime,'accounting',side_effect=[accounting(),changed]):
            with self.assertRaises(RuntimeError) as failure:holder.request(pressure=True)
        evidence=failure.exception.resourceLimitEvidence
        self.assertEqual(evidence['scope'],'held-pin-pass');self.assertFalse(evidence['pressureMaxException'])
        self.assertEqual(evidence['cpuLimitDelta']['throttled_usec'],7)

    def test_post_query_and_inventory_failure_survive_cleanup_failure(self):
        for target in ('query-interval','post-query-inventory'):
            spec=SimpleNamespace();source=SimpleNamespace(identity=('fixed',),spec=spec,cgroup_relative='/clone',pid=123)
            state=pin_state();steady=pin_state();steady.update(newLockBytes=0,rangesChanged=False)
            holder=Mock();holder.request.side_effect=[state,steady,steady];holder.close.side_effect=RuntimeError('pin_child_cleanup')
            holder.process.is_alive.return_value=False;holder.process.pid=999999999;holder.process.exitcode=1
            nofile={'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1024,'softAfter':20260,'hardLimit':1048576,'raised':True,'hardChanged':False}
            measured={'selectionHash':'a'*64,'classesMeasured':{k:{'files':1,'dataPages':1,'residentDataPages':1} for k in ('vector','graph','sparse','other')},'pageBytes':4096,'accounting':accounting(),'nofileLimits':nofile}
            progress={'ack':False,'inventory':False}
            def measure(*a,**kw):
                if progress['ack']:progress['inventory']=True
                return measured
            def account(*args):
                value=accounting()
                if progress['ack'] and (target=='query-interval' or progress['inventory']):value['cpu']['nr_throttled']=1
                return value
            events=[];phase_life=MagicMock();phase_life.overhead_growth.return_value={}
            with ExitStack() as stack:
                contexts=[patch.object(control.os,'open',return_value=12),patch.object(control.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(control.os,'close'),patch.object(control.os,'set_inheritable'),patch.object(control,'load_lifecycle',return_value=phase_life),patch.object(control,'phase_overhead',return_value={}),patch.object(control.fcntl,'flock'),patch.object(control,'frozen_helper'),patch.object(control,'load_cache_preparation'),patch.object(control,'prepare_cache',return_value={'final':{'accounting':accounting()}}),patch.object(control,'guard_shards'),patch.object(control,'self_cgroup',return_value='/parent'),patch.object(control,'verify_archive'),patch.object(control,'owned_total_budget'),patch.object(control,'birth_admission',return_value={}),patch.object(control,'cold',return_value={'birthAdmission':{},'cleanStop':{'schema':'clone-child-term.clean.v1','clean':True}}),patch.object(control,'inspect_source',return_value=source),patch.object(control.cpu0_guards,'inspect_cpu_source',side_effect=[{'observed':True},RuntimeError('cpu_metric_missing')]),patch.object(control.cpu0_guards,'cpu_delta',return_value=[]),patch.object(control,'CPU_POLICY',{},create=True),patch.object(control.runtime,'measure_source',side_effect=measure),patch.object(control.runtime,'accounting',side_effect=account),patch.object(control,'process_counters',return_value={'minorFaults':0,'majorFaults':1,'physicalReadBytes':1,'rssBytes':1}),patch.object(control,'pressure',return_value={}),patch.object(control,'PinChild',return_value=holder),patch.object(control,'host_memory',return_value={'MemTotal':8*control.pin.GIB,'MemAvailable':4*control.pin.GIB,'Dirty':0,'Writeback':0,'SwapTotal':0}),patch.object(control,'query_lease',side_effect=lambda _:progress.update(ack=True))]
                for context in contexts:stack.enter_context(context)
                with self.assertRaisesRegex(RuntimeError,'phase_resource_failed'):
                    control.stage({'queryLeaseSeconds':60,'controlReadySeconds':1200,'cachePreparation':{'helperSha256':'a'*64}},spec,SimpleNamespace(emergency_bytes=3*control.pin.GIB//2,cap_reserve_bytes=1,max_locked_bytes=2*control.pin.GIB,reserve_bytes=2*control.pin.GIB),'candidate',events.append)
            failure=next(e for e in events if e['stage']=='phase-failed')
            self.assertEqual(failure['resourceLimitEvidence']['scope'],target)
            self.assertEqual(failure['lifecycleCompletedStopReceipt'],{'schema':'clone-child-term.clean.v1','clean':True})
            self.assertEqual(failure['reason'],'phase_resource_failed')
            self.assertEqual(failure['cpuHierarchyBefore'],{'observed':True})
            self.assertIsNone(failure['cpuHierarchyAfter'])
            self.assertEqual(failure['cpuHierarchySnapshotFailure'],'cpu_metric_missing')
            self.assertEqual(events[-1]['cleanupReason'],'pin_child_cleanup')
            self.assertFalse(any(e['stage']=='query-finished' for e in events))

    def test_initial_admission_refusal_precedes_archive_or_signal(self):
        for reason in ('host_cpu_busy','cpu_metric_missing','clone_not_ready'):
            lifecycle=MagicMock();events=[]
            with ExitStack() as stack:
                for item in (patch.object(control,'frozen_helper'),patch.object(control,'load_cache_preparation'),patch.object(control.os,'open',return_value=12),patch.object(control.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(control.os,'set_inheritable'),patch.object(control.os,'close'),patch.object(control.fcntl,'flock'),patch.object(control,'load_lifecycle',return_value=lifecycle),patch.object(control,'birth_admission',side_effect=RuntimeError(reason))):stack.enter_context(item)
                archive=stack.enter_context(patch.object(control,'verify_archive'));cold=stack.enter_context(patch.object(control,'cold'))
                with self.assertRaisesRegex(RuntimeError,reason):control.stage({},object(),object(),'baseline',events.append,handoff_sha='a'*64)
                archive.assert_not_called();cold.assert_not_called();lifecycle.graceful_stop.assert_not_called();lifecycle.commit_handoff.assert_not_called()
                self.assertEqual(lifecycle.read_handoff.call_count,1);self.assertEqual(lifecycle.read_handoff.call_args.args[1],'a'*64);self.assertTrue(callable(lifecycle.read_handoff.call_args.args[0]))

    def test_preflight_locked_predecessor_admission_commit(self):
        import hashlib,cpu0_preflight,cpu0_guards
        config={'schema':'clone-pin-control.cpu0-fixed.v2','helperCodeSha256':'c'*64,'helperPolicySha256':'b'*64,'cpuIsolation':{}}
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'control.json';raw=json.dumps(config).encode();path.write_bytes(raw)
            for failed in (False,True):
                life=MagicMock();history=[]
                life.read_handoff.side_effect=lambda *a:history.append('predecessor')
                life.commit_handoff.side_effect=lambda *a:history.append('commit') or {'sha256':'d'*64}
                def admit(*a):
                    history.append('admission')
                    if failed:raise RuntimeError('host_cpu_busy')
                    return {'sourceIdentity':['fixed']}
                with ExitStack() as stack:
                    for item in (patch.object(cpu0_preflight,'control',control),patch.object(cpu0_preflight,'daemon',daemon),patch.object(cpu0_preflight,'cpu0_guards',cpu0_guards),patch.object(cpu0_guards,'validate_policy'),patch.object(daemon,'load_config',return_value=({},object(),object())),patch.object(cpu0_preflight.os,'open',return_value=12),patch.object(cpu0_preflight.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(cpu0_preflight.os,'close'),patch.object(cpu0_preflight.os,'set_inheritable'),patch.object(cpu0_preflight.fcntl,'flock'),patch.object(control,'load_lifecycle',return_value=life),patch.object(control,'birth_admission',side_effect=admit)):stack.enter_context(item)
                    args=(str(path),'b'*64,'c'*64,str(path),hashlib.sha256(raw).hexdigest(),'a'*64)
                    if failed:
                        with self.assertRaisesRegex(RuntimeError,'host_cpu_busy'):cpu0_preflight._preflight(*args)
                        self.assertEqual(history,['predecessor','admission']);life.commit_handoff.assert_not_called()
                    else:
                        result=cpu0_preflight._preflight(*args);self.assertEqual(history,['predecessor','admission','commit']);self.assertEqual(result['handoffWrites'],1)
                        life.commit_handoff.assert_called_once_with(control.runtime.docker,'a'*64,'preflight')
                life.require_lock.assert_called_once_with(12)

    def test_post_stop_refusal_preserves_successful_receipt_and_birth_binding(self):
        life=MagicMock();receipt={'schema':'clone-child-term.clean.v1','clean':True};life.graceful_stop.return_value=receipt
        target={'qdrant':{'pid':123,'startTicks':1}}
        with patch.object(control.cpu0_guards,'host_cpu'),patch.object(control,'load_lifecycle',return_value=life),patch.object(control,'inspect_stopped_or_running',side_effect=[{},RuntimeError('cold_inode_changed')]),patch.object(control,'clone_command')as start:
            with self.assertRaisesRegex(RuntimeError,'cold_inode_changed')as failure:control.cold(SimpleNamespace(container='fixed'),{},object(),12,{'target':target})
            self.assertIs(failure.exception.lifecycleCompletedStopReceipt,receipt);self.assertEqual(life.graceful_stop.call_args.kwargs['expected'],target);start.assert_not_called()

    def test_zero_child_scope_exit_failure_reaps_constructed_child(self):
        from contextlib import contextmanager
        import turnover_gate_cpu0 as gate
        @contextmanager
        def scope(*args):
            yield
            raise RuntimeError('lifecycle_lock_unproven')
        life=MagicMock();life.helper_fork_scope.side_effect=scope
        source=SimpleNamespace(cgroup_relative='/clone');child=Mock();child.gone.return_value={'childGone':True,'exitCode':0};events=[]
        with ExitStack()as stack:
            for item in (patch.object(control,'owned_store_files'),patch.object(control,'owned_total_budget'),patch.object(control,'host_available'),patch.object(control.cpu0_guards,'host_cpu'),patch.object(control,'self_cgroup',return_value='/parent'),patch.object(control,'inspect_stopped_or_running',return_value={'State':{'Running':True}}),patch.object(control,'inspect_source',return_value=source),patch.object(control,'load_lifecycle',return_value=life),patch.object(control,'birth_admission',return_value={'target':{}}),patch.object(control,'frozen_helper'),patch.object(control.runtime,'accounting',return_value={}),patch.object(gate,'ZeroChild',return_value=child)):stack.enter_context(item)
            with self.assertRaisesRegex(RuntimeError,'lifecycle_lock_unproven'):gate.stage({},SimpleNamespace(store=None),SimpleNamespace(emergency_bytes=1,reserve_bytes=1,cap_reserve_bytes=1),events.append,12,'a'*64)
        child.gone.assert_called_once();self.assertTrue(any(e['stage']=='cleanup-observed' and e['childGone'] for e in events));life.graceful_stop.assert_not_called()

class RetentionTests(unittest.TestCase):
    def test_pressure_finalization_preserves_original_and_separate_failure(self):
        import cpu0_guards as guards
        original=RuntimeError('pin_child_timeout')
        cleanup=RuntimeError('phase_resource_failed');cleanup.resourceLimitEvidence={'scope':'pressure-end-continuity'}
        manager=Mock();manager.end_pressure.side_effect=cleanup
        guards.finalize_pressure(manager,original)
        self.assertEqual(str(original),'pin_child_timeout')
        self.assertEqual(original.pressureFinalizationFailure['resourceLimitEvidence']['scope'],'pressure-end-continuity')
        with self.assertRaises(RuntimeError) as failure:guards.finalize_pressure(manager,None)
        self.assertIs(failure.exception,cleanup)
    def test_preflight_refusal_outputs_numeric_context_no_private_error(self):
        import contextlib,io,cpu0_preflight
        error=RuntimeError('host_cpu_busy','private unstructured message')
        error.hostCpuEvidence={'onlineCpus':4,'load1':3,'load5':0,'cpuSomeAvg10':0}
        output=io.StringIO()
        with patch.object(cpu0_preflight,'_authenticate',return_value={}),patch.object(cpu0_preflight,'_modules'),patch.object(cpu0_preflight,'control',control),patch.object(cpu0_preflight,'cpu0_guards',__import__('cpu0_guards')),patch.object(cpu0_preflight,'_preflight',side_effect=error),contextlib.redirect_stdout(output):
            self.assertEqual(cpu0_preflight.main(['a']*6),1)
        event=json.loads(output.getvalue())
        self.assertEqual(event['hostCpuEvidence']['load1'],3)
        self.assertNotIn('private',output.getvalue())


class BindingTests(unittest.TestCase):
    def test_runtime_symbols_are_the_frozen_variant(self):
        import runtime_cpu0, pin_cpu0
        for name in ('CLASSES','PAGE','Kernel','Mapping','Target','byte_count','classify','page_ranges','selection_digest','release_preserving_error'):
            self.assertIs(getattr(runtime_cpu0,name),getattr(pin_cpu0,name))

    def test_isolated_import_without_unversioned_pin(self):
        import subprocess,sys
        source=Path(control.__file__).parent
        with tempfile.TemporaryDirectory() as directory:
            folder=Path(directory)
            for name in ('pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','controller_cpu0.py','cpu0_guards.py','cpu0_preflight.py','turnover_gate_cpu0.py','lifecycle_cpu0.py'):
                (folder/name).write_bytes((source/name).read_bytes())
            script=folder/'probe.py'
            script.write_text("import sys\nsys.path.insert(0,"+repr(str(folder))+")\nimport pin_cpu0 as pin, runtime_cpu0 as runtime, daemon_cpu0, controller_cpu0, cpu0_preflight, turnover_gate_cpu0\nassert runtime.Kernel is pin.Kernel\nassert runtime.Mapping is pin.Mapping\nassert runtime.Target is pin.Target\nassert runtime.selection_digest is pin.selection_digest\nassert 'pin' not in sys.modules\n")
            result=subprocess.run([sys.executable,'-I','-B',str(script)],capture_output=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr.decode())
            self.assertFalse((folder/'__pycache__').exists())


class ConfigTests(unittest.TestCase):
    def test_new_schema_integer_zero_and_combined_guard_hash(self):
        import hashlib
        original=json.loads((Path(daemon.__file__).parent/'prepared-helper-policy-cpu0.json').read_text())
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'config.json'
            for schema,number,valid in [('mapped-data-pin-config.cpu0.v1',0,True),('mapped-data-pin-config.v1',0,False),('mapped-data-pin-config.cpu0.v1',False,False),('mapped-data-pin-config.cpu0.v1',0.0,False),('mapped-data-pin-config.cpu0.v1',2000000000,False)]:
                value=copy.deepcopy(original);value['schema']=schema;value['source']['cpuNanos']=number
                raw=json.dumps(value).encode();path.write_bytes(raw)
                if valid:self.assertEqual(daemon.load_config(path,hashlib.sha256(raw).hexdigest(),daemon.code_hash())[1].cpu_nanos,0)
                else:
                    with self.assertRaises(ValueError):daemon.load_config(path,hashlib.sha256(raw).hexdigest(),daemon.code_hash())
            with tempfile.TemporaryDirectory() as td:
                folder=Path(td)
                for name in ('pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py'):(folder/name).write_bytes((Path(daemon.__file__).parent/name).read_bytes())
                old=daemon.code_hash(folder);(folder/'cpu0_guards.py').write_text('# drift')
                self.assertNotEqual(old,daemon.code_hash(folder))


class FixedCapacityAdmissionTests(unittest.TestCase):
    def policy(self):
        return SimpleNamespace(mode='clone',max_locked_bytes=2*control.pin.GIB,reserve_bytes=2*control.pin.GIB,
                               emergency_bytes=3*control.pin.GIB//2,cap_reserve_bytes=256*1024**2)

    def target(self):
        return {'state':{'running':True,'OOMKilled':False},'wrapper':{'VmLckBytes':0},'qdrant':{'VmLckBytes':0}}

    def account(self):
        return {'unevictableBytes':0,'memoryEvents':{'max':0,'oom':0,'oom_kill':0}}

    def sample(self,available):
        return {'MemTotal':8127848448,'MemAvailable':available,'Dirty':0,'Writeback':0,'SwapTotal':0}

    def test_running_snapshot_passes_derived_budget_but_exact_boundary_refuses(self):
        for available,success in ((4531286016,True),(4*control.pin.GIB+4096,True),(4*control.pin.GIB,False),(4*control.pin.GIB-4096,False)):
            with self.subTest(available=available),patch.object(control,'host_memory',return_value=self.sample(available)):
                if success:
                    proof=control.unheld_host_admission(self.policy(),self.target(),self.account())
                    self.assertEqual(proof['hostMemAvailableFloorBytes'],4*control.pin.GIB)
                    self.assertEqual(proof['hostMemAvailableBytes'],available)
                    self.assertEqual(proof['observedPhase'],'running-unheld')
                    self.assertFalse(proof['pinAdmission'])
                else:
                    with self.assertRaisesRegex(RuntimeError,'host_emergency_floor') as failure:
                        control.unheld_host_admission(self.policy(),self.target(),self.account())
                    self.assertEqual(failure.exception.admissionFailureEvidence['hostMemAvailableBytes'],available)
                    self.assertEqual(failure.exception.admissionFailureEvidence['hostMemTotalBytes'],8127848448)

    def test_caller_cannot_reinterpret_stopped_or_held_source(self):
        cases=[]
        stopped=self.target();stopped['state']['running']=False;cases.append((stopped,self.account()))
        held=self.target();held['qdrant']['VmLckBytes']=4096;cases.append((held,self.account()))
        account=self.account();account['unevictableBytes']=4096;cases.append((self.target(),account))
        event=self.account();event['memoryEvents']['max']=1;cases.append((self.target(),event))
        missing=self.account();del missing['memoryEvents']['oom'];cases.append((self.target(),missing))
        for target,account in cases:
            with self.subTest(target=target,account=account),patch.object(control,'host_memory',return_value=self.sample(4531286016)):
                with self.assertRaisesRegex(RuntimeError,'running_unheld_scope_unproven'):
                    control.unheld_host_admission(self.policy(),target,account)

    def test_policy_not_generic_floor_override(self):
        for key,value in (('max_locked_bytes',control.pin.GIB),('reserve_bytes',control.pin.GIB),('emergency_bytes',control.pin.GIB)):
            policy=self.policy();setattr(policy,key,value)
            with self.subTest(key=key),patch.object(control,'host_memory',return_value=self.sample(4531286016)):
                with self.assertRaisesRegex(RuntimeError,'fixed_capacity_policy_changed'):
                    control.unheld_host_admission(policy,self.target(),self.account())

    def test_same_read_failure_is_not_filled_from_later_better_memory(self):
        with patch.object(control,'host_memory',side_effect=[self.sample(4*control.pin.GIB),self.sample(8*control.pin.GIB)]) as reader:
            with self.assertRaises(RuntimeError) as failure:
                control.unheld_host_admission(self.policy(),self.target(),self.account())
        self.assertEqual(reader.call_count,1)
        self.assertEqual(failure.exception.admissionFailureEvidence['hostMemAvailableBytes'],4*control.pin.GIB)

    def test_real_meminfo_reader_requires_all_fields_without_zero_defaults(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'meminfo'
            path.write_text('MemTotal: 7937352 kB\nMemAvailable: 4425084 kB\nDirty: 0 kB\nWriteback: 0 kB\nSwapTotal: 0 kB\n')
            self.assertEqual(control.host_memory(path)['MemAvailable'],4531286016)
            path.write_text('MemTotal: 7937352 kB\nMemAvailable: 4425084 kB\n')
            with self.assertRaisesRegex(RuntimeError,'host_memory_unproven'):control.host_memory(path)

class FixedCapacityBirthTests(unittest.TestCase):
    def test_composed_birth_derives_actual_unheld_state_and_retains_sample(self):
        fixture=FixedCapacityAdmissionTests()
        target=fixture.target();target['qdrant'].update(pid=123,startTicks=456)
        source=SimpleNamespace(pid=123,identity=('container','image',123,456))
        lifecycle=Mock();lifecycle.attest.return_value=target
        shape={'status':'green','optimizer_status':'ok','points_count':244262,'segments_count':12,'config':{'params':{'shard_number':6}}}
        response=MagicMock();response.__enter__.return_value.read.return_value=json.dumps({'result':shape}).encode()
        with ExitStack() as stack:
            for item in (patch.object(control,'_source_cgroup_limits',return_value={'memoryMaxBytes':6*control.pin.GIB,'memoryHighBytes':None,'memorySwapMaxBytes':0}),patch.object(control,'load_lifecycle',return_value=lifecycle),patch.object(control.cpu0_guards,'host_cpu',return_value={}),patch.object(control,'owned_total_budget',return_value=1),patch.object(control.shutil,'disk_usage',return_value=SimpleNamespace(free=4*control.pin.GIB)),patch.object(control,'inspect_source',return_value=source),patch.object(control.cpu0_guards,'inspect_cpu_source',return_value=[]),patch.object(control,'CPU_POLICY',{},create=True),patch.object(control,'guard_shards'),patch.object(control.urllib.request,'urlopen',return_value=response),patch.object(control.runtime,'accounting',return_value=fixture.account()),patch.object(control,'host_memory',return_value=fixture.sample(4531286016))):stack.enter_context(item)
            proof=control.birth_admission({},SimpleNamespace(container='fixed'),fixture.policy())
        self.assertEqual(proof['schema'],'clone-birth-admission.cpu0-fixed.v2')
        self.assertEqual(proof['hostMemAvailableBytes'],4531286016)
        self.assertEqual(lifecycle.attest.call_count,2)
        self.assertEqual(proof['target'],target)

class QueryMemoryTests(unittest.TestCase):
    def test_actual_sample_boundary_and_no_late_zero_fill(self):
        fixture=FixedCapacityAdmissionTests();floor=fixture.policy().emergency_bytes
        for value,success in ((floor,True),(floor+4096,True),(floor-4096,False)):
            with self.subTest(value=value),patch.object(control,'host_memory',side_effect=[fixture.sample(value),fixture.sample(8*control.pin.GIB)]) as sample:
                if success:
                    proof=control.query_memory(fixture.policy(),'before-query')
                    self.assertEqual(proof['hostMemAvailableBytes'],value)
                    self.assertGreater(proof['sampleMonotonicSeconds'],0)
                else:
                    with self.assertRaisesRegex(RuntimeError,'host_emergency_floor') as refused:control.query_memory(fixture.policy(),'after-query')
                    self.assertEqual(refused.exception.queryMemoryFailureEvidence['hostMemAvailableBytes'],value)
                    self.assertEqual(refused.exception.queryMemoryFailureEvidence['scope'],'after-query')
                self.assertEqual(sample.call_count,1)

class StoppedMemoryTests(unittest.TestCase):
    def test_stopped_floor_strict_five_remains_separate_from_running_four(self):
        fixture=FixedCapacityAdmissionTests()
        for available,success in ((5*control.pin.GIB,False),(5*control.pin.GIB+4096,True),(4531286016,False)):
            with self.subTest(available=available),patch.object(control,'host_memory',return_value=fixture.sample(available)):
                state={'running':False,'OOMKilled':False,'exitCode':0}
                if success:self.assertEqual(control.stopped_host_admission(state)['hostMemAvailableFloorBytes'],5*control.pin.GIB)
                else:
                    with self.assertRaisesRegex(RuntimeError,'cold_start_headroom') as refused:control.stopped_host_admission(state)
                    self.assertEqual(refused.exception.admissionFailureEvidence['hostMemAvailableBytes'],available)
        with patch.object(control,'host_memory',return_value=fixture.sample(8*control.pin.GIB)):
            with self.assertRaisesRegex(RuntimeError,'clone_not_stopped'):control.stopped_host_admission({'running':True,'OOMKilled':False,'exitCode':0})

class ExistingCoreChargingTests(unittest.TestCase):
    def test_real_resident_mapping_debits_all_new_locks_and_restores_vmlck(self):
        pin=control.pin
        locked=lambda:next(int(row.split()[1])*1024 for row in Path('/proc/self/status').read_text().splitlines() if row.startswith('VmLck:'))
        original=locked()
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'vector.bin';path.write_bytes(b'x'*pin.PAGE)
            policy=pin.Policy('fixture',pin.PAGE,0,2*pin.GIB,0,cap_reserve_bytes=256*1024**2)
            memory={'availableBytes':2*pin.GIB+pin.PAGE-1,'anonBytes':2268217344,'kernelBytes':44908544,'fileBytes':3936546816,'unevictableBytes':0,'currentBytes':3*pin.GIB,'cgroupMaxBytes':6*pin.GIB}
            manager=pin.PinSet(policy,Path(root)/'pin.lock')
            try:
                with self.assertRaisesRegex(RuntimeError,'projected_headroom_below_reserve'):
                    manager.reconcile([pin.Target.open(path,'vector')],('fixture',1),memory)
                self.assertEqual(locked(),original)
                memory['availableBytes']+=1
                proof=manager.reconcile([pin.Target.open(path,'vector')],('fixture',1),memory)
                self.assertEqual(proof['lockedBytes'],pin.PAGE)
                self.assertEqual(proof['lockedResidency']['vector']['residentLockedDataPages'],1)
            finally:manager.close()
        self.assertEqual(locked(),original)

    def test_actual_near_cap_numbers_refuse_even_one_resident_page_before_mlock(self):
        pin=control.pin
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/'vector.bin';path.write_bytes(b'x'*pin.PAGE)
            manager=pin.PinSet(pin.Policy('fixture',pin.PAGE,0,2*pin.GIB,0,cap_reserve_bytes=256*1024**2),Path(root)/'pin.lock')
            memory={'availableBytes':4531286016,'anonBytes':2268217344,'fileBytes':3936546816,'kernelBytes':44908544,'unevictableBytes':0,'currentBytes':6249672704,'cgroupMaxBytes':6442450944}
            try:
                with self.assertRaisesRegex(RuntimeError,'initial_cap_headroom_inconclusive'):
                    manager.reconcile([pin.Target.open(path,'vector')],('fixture',1),memory)
                self.assertEqual(manager.mappings,{})
            finally:manager.close()

class WorkingSetAdmissionTests(unittest.TestCase):
    def test_both_phases_debit_resident_selected_pages_in_full(self):
        fixture=FixedCapacityAdmissionTests()
        inventory={'pageBytes':4096,'selectionHash':'a'*64,'classesMeasured':{kind:{'files':1,'dataPages':1,'residentDataPages':1} for kind in ('vector','graph','sparse','other')}}
        floor=2*control.pin.GIB+4*4096
        for available,success in ((floor,True),(floor-1,False)):
            with self.subTest(available=available),patch.object(control,'host_memory',return_value=fixture.sample(available)):
                if success:
                    proof=control.working_set_admission(fixture.policy(),inventory)
                    self.assertEqual(proof['selectedMissingBytes'],0)
                    self.assertEqual(proof['hostMemAvailableFloorBytes'],floor)
                else:
                    with self.assertRaisesRegex(RuntimeError,'projected_headroom_below_reserve') as refusal:control.working_set_admission(fixture.policy(),inventory)
                    self.assertEqual(refusal.exception.workingSetFailureEvidence['hostMemAvailableBytes'],available)
        inventory['classesMeasured']['other']['dataPages']=0
        with self.assertRaisesRegex(RuntimeError,'working_set_inventory_unproven'):control.working_set_admission(fixture.policy(),inventory)

class PreflightAuthenticationTests(unittest.TestCase):
    def fixture(self,root,p):
        stage=root/'stage';stage.mkdir(mode=0o700)
        files={name:b'raise RuntimeError("UNVERIFIED_SIBLING_EXECUTED")\n' for name in p.FULL_NAMES}
        files['prepared-helper-policy-cpu0.json']=b'{}\n'
        files['prepared-control-policy-cpu0.json']=b'{}\n'
        files['helper-config.json']=files['prepared-helper-policy-cpu0.json'];files['controller-config.json']=files['prepared-control-policy-cpu0.json']
        sha=lambda raw:hashlib.sha256(raw).hexdigest()
        freeze={'schema':'search.clone-cpu0-fixed-source-freeze.v2','variant':p.VARIANT,'preparedOnly':True,'files':{name:sha(files[name]) for name in p.SOURCE_NAMES}}
        files['cpu0-source-freeze.json']=json.dumps(freeze).encode()
        full={'schema':'cpu0-full-public-packet.v7','variant':p.VARIANT,'sourceFreezeSha256':sha(files['cpu0-source-freeze.json']),'files':{name:sha(files[name]) for name in p.FULL_NAMES}}
        files['cpu0-external-manifest.json']=json.dumps(full).encode();files['node']=b'not-executed';files['node-provenance.json']=b'{}'
        for name,raw in files.items():
            path=stage/name;path.write_bytes(raw);path.chmod(0o600)
        core=hashlib.sha256()
        for name in ('pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','cpu0_guards.py'):core.update(name.encode()+b'\0'+files[name]+b'\0')
        return stage,(str(stage/'helper-config.json'),sha(files['helper-config.json']),core.hexdigest(),str(stage/'controller-config.json'),sha(files['controller-config.json']),'a'*64)
    def test_entire_manifest_checked_before_any_sibling_execute_and_alias_refuses(self):
        import cpu0_preflight as p,hashlib
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);root.chmod(0o700);stage,args=self.fixture(root,p)
            with patch.object(p,'ROOT',root),patch.object(p,'STAGE',stage),patch.object(p,'__file__',str(stage/'cpu0_preflight.py')),patch.object(p,'ROOT_UID',os.geteuid()),patch.object(p,'_require_null_stdin'),patch.object(p,'_require_consumer_argv'):
                context=p._authenticate(args,'consumer');self.assertEqual(set(context['sources']),p.SOURCE_NAMES)
                (stage/'parity.mjs').write_bytes(b'changed unrelated module')
                with self.assertRaisesRegex(RuntimeError,'preflight_source_unproven'):p._authenticate(args,'consumer')
                with self.assertRaisesRegex(RuntimeError,'preflight_source_unproven'):p._authenticate(('wrong',*args[1:]),'consumer')
    def test_nofollow_and_exact_inventory_refuse_before_import(self):
        import cpu0_preflight as p
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);root.chmod(0o700);stage,args=self.fixture(root,p)
            with patch.object(p,'ROOT',root),patch.object(p,'STAGE',stage),patch.object(p,'__file__',str(stage/'cpu0_preflight.py')),patch.object(p,'ROOT_UID',os.geteuid()),patch.object(p,'_require_null_stdin'),patch.object(p,'_require_consumer_argv'):
                extra=stage/'unexpected.py';extra.write_bytes(b'not executed')
                with self.assertRaisesRegex(RuntimeError,'preflight_source_unproven'):p._authenticate(args,'consumer')
                extra.unlink();target=stage/'cpu0_guards.py';target.unlink();target.symlink_to(stage/'pin_cpu0.py')
                with self.assertRaisesRegex(RuntimeError,'preflight_source_unproven'):p._authenticate(args,'consumer')
    def test_actual_child_stdin_devnull_accepts_pipe_refuses(self):
        import subprocess
        source='import sys;sys.path.insert(0,'+repr(str(Path(__file__).absolute().parent))+');import cpu0_preflight as p;p._require_null_stdin()'
        self.assertEqual(subprocess.run(['/usr/bin/python3','-B','-c',source],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=3).returncode,0)
        self.assertNotEqual(subprocess.run(['/usr/bin/python3','-B','-c',source],input=b'',stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=3).returncode,0)

class ActualPreflightArgvTests(unittest.TestCase):
    def test_actual_isolated_cli_argv_accepts_and_missing_isolation_refuses(self):
        import ast,subprocess,cpu0_preflight as preflight
        source=Path(preflight.__file__).read_text()
        node=next(node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef) and node.name=='_require_consumer_argv')
        with tempfile.TemporaryDirectory() as temp:
            script=Path(temp)/'cpu0_preflight.py'
            script.write_text('import os,sys\nfrom pathlib import Path\nSTAGE=Path(__file__).parent\n'+ast.get_source_segment(source,node)+'\n_require_consumer_argv(sys.argv[1:])\n')
            args=['fixed-helper','a'*64,'b'*64,'fixed-controller','c'*64,'d'*64]
            okay=subprocess.run(['/usr/bin/python3','-I','-B',str(script),*args],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=3)
            bad=subprocess.run(['/usr/bin/python3','-B',str(script),*args],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=3)
            self.assertEqual(okay.returncode,0);self.assertNotEqual(bad.returncode,0)

class InspectorScopeTests(unittest.TestCase):
    def test_exact_delegation_parent_counts_and_restore_on_failure(self):
        token=object();failure=RuntimeError('unchanged-original')
        original=Mock(side_effect=[token,failure]);old=control.runtime.docker
        with patch.object(control.runtime,'docker',original):
            with self.assertRaises(RuntimeError) as result:
                with control.inspector_scope() as evidence:
                    self.assertIs(control.runtime.docker('inspect','fixed'),token)
                    control.runtime.docker('top','fixed','-eo','pid,comm')
            self.assertIs(result.exception,failure)
            self.assertIs(control.runtime.docker,original)
            self.assertEqual(original.call_args_list,[__import__('unittest').mock.call('inspect','fixed'),__import__('unittest').mock.call('top','fixed','-eo','pid,comm')])
            self.assertEqual(evidence['runtimeDockerCalls'],2)
            self.assertEqual(evidence['ownerPid'],os.getpid())
            self.assertGreaterEqual(evidence['totalElapsedSeconds'],0)
            self.assertIsNone(evidence['unsampledPeakBytes'])
        self.assertIs(control.runtime.docker,old)
        self.assertIsNone(control._INSPECTOR)
    def test_actual_fork_does_not_claim_parent_aggregation(self):
        import multiprocessing
        context=multiprocessing.get_context('fork');reader,writer=context.Pipe(False)
        def child():
            control.runtime.docker('inspect','fixture-only')
            writer.send({'actualPid':os.getpid(),'ownerPid':control._INSPECTOR['ownerPid'],'calls':control._INSPECTOR['runtimeDockerCalls']});writer.close()
        with patch.object(control.runtime,'docker',return_value=b'fixture'):
            with control.inspector_scope() as evidence:
                process=context.Process(target=child);process.start();writer.close()
                try:
                    self.assertTrue(reader.poll(3));row=reader.recv();process.join(3)
                    self.assertEqual(process.exitcode,0);self.assertNotEqual(row['actualPid'],row['ownerPid']);self.assertEqual(row['calls'],0);self.assertEqual(evidence['runtimeDockerCalls'],0)
                finally:
                    if process.is_alive():process.kill();process.join(3)
                    reader.close();process.close()

class EnrolmentPublicationTests(unittest.TestCase):
    """Real receipt filesystem semantics; source/process boundaries are stand-ins."""
    def fixture(self,p,life):
        own=os.getpid();rows={}
        for pid,parent in ((own,101),(101,100),(100,99)):
            rows[pid]={'identity':{'pid':pid,'startTicks':pid+1,'parentPid':parent,'exeIdentityHash':'e'*64,'groupHash':'a'*64,'VmLckBytes':0,'outsideSourceCgroup':True},'metrics':{'RssAnonBytes':4096,'VmPTEBytes':4096}}
        target={'qdrant':{'pid':77,'startTicks':78}}
        source=SimpleNamespace(pid=77,identity=['container','image',77,78],cgroup_relative='/fixture-only')
        life.resource_process.side_effect=lambda pid,group:rows[pid]
        life.attest.return_value=target;life.canonical.side_effect=lambda value:json.dumps(value,sort_keys=True,separators=(',',':')).encode()
        context={'sourceFreezeSha256':'a'*64,'externalManifestSha256':'b'*64}
        args=[str(p.STAGE/'helper-config.json'),'c'*64,'d'*64,str(p.STAGE/'controller-config.json'),'e'*64,'f'*64]
        argv=[str(p.STAGE/'node'),str(p.STAGE/'consumer_cpu0.mjs'),'--execute-reviewed-fixed-capacity-v2','--handoff-sha256',args[5],'--cpu0-source-freeze-sha256',context['sourceFreezeSha256'],'--external-manifest-sha256',context['externalManifestSha256']]
        life.bounded.return_value=b'\0'.join(value.encode() for value in argv)+b'\0'
        node={'device':1,'inode':2,'size':3,'mtimeNs':'4','ctimeNs':'5'}
        return source,context,args,node
    def test_real_exclusive_canonical_publication_and_no_overwrite(self):
        import cpu0_preflight as p
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);root.chmod(0o700);life=MagicMock();source,context,args,node=self.fixture(p,life)
            with open(root/'control.lock','w+b')as lock,patch.object(p,'ROOT',root),patch.object(p,'ROOT_UID',os.geteuid()),patch.object(p,'control',control),patch.object(control,'inspect_source',return_value=source),patch.object(p,'_node',return_value=(node,'1'*64)):
                record,sha=p._enrol_consumer(context,life,SimpleNamespace(container='fixture-only'),args,{'adoptionIntentSha256':'2'*64},lock.fileno())
                raw=(root/'cpu0-consumer-enrolment-v2.json').read_bytes()
                self.assertEqual(raw,life.canonical(record)+b'\n');self.assertEqual(hashlib.sha256(raw).hexdigest(),sha)
                self.assertEqual((root/'cpu0-consumer-enrolment-v2.json').stat().st_mode&0o777,0o600)
                with self.assertRaises(FileExistsError)as caught:p._enrol_consumer(context,life,SimpleNamespace(container='fixture-only'),args,{'adoptionIntentSha256':'2'*64},lock.fileno())
                self.assertEqual(caught.exception.consumerEnrolmentFailureEvidence['publicationState'],'not-issued')
                self.assertIs(caught.exception.consumerEnrolmentFailureEvidence['cleanupAddressableByFixedReceipt'],False)
                self.assertEqual((root/'cpu0-consumer-enrolment-v2.json').read_bytes(),raw)
    def test_write_failure_retains_fixed_cleanup_authority_and_primary_cause(self):
        import cpu0_preflight as p
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);root.chmod(0o700);life=MagicMock();source,context,args,node=self.fixture(p,life);primary=OSError('fixture-write-failure')
            with open(root/'control.lock','w+b')as lock,patch.object(p,'ROOT',root),patch.object(p,'control',control),patch.object(control,'inspect_source',return_value=source),patch.object(p,'_node',return_value=(node,'1'*64)),patch.object(p.os,'write',side_effect=primary):
                with self.assertRaises(OSError)as caught:p._enrol_consumer(context,life,SimpleNamespace(container='fixture-only'),args,{'adoptionIntentSha256':'2'*64},lock.fileno())
                self.assertIs(caught.exception,primary)
                proof=primary.consumerEnrolmentFailureEvidence
                self.assertEqual(proof['publicationState'],'issued-unknown');self.assertIs(proof['cleanupAddressableByFixedReceipt'],True);self.assertIs(proof['continuationAllowed'],False)
                self.assertEqual((root/'cpu0-consumer-enrolment-v2.json').read_bytes(),b'')
                self.assertEqual(proof['consumerEnrolment']['consumer']['identity']['pid'],101)

class EntryIdentityTests(unittest.TestCase):
    def fixture(self,root):
        for leaf,value in (('memory.max',str(6*control.pin.GIB)),('memory.high','max'),('memory.swap.max','0')):(root/leaf).write_text(value+'\n')
        spec=SimpleNamespace(container='fixture-only',memory_bytes=6*control.pin.GIB,swap_bytes=6*control.pin.GIB)
        source=SimpleNamespace(pid=77,identity=('a'*64,'sha256:fixture',77,78),cgroup=root,cgroup_relative='/source',spec=spec)
        life=MagicMock();life.attest.return_value={'qdrant':{'pid':77,'startTicks':78}}
        identities={os.getpid():{'pid':os.getpid(),'startTicks':10,'parentPid':100,'exeIdentityHash':'b'*64,'groupHash':'c'*64,'VmLckBytes':0,'group':'/outside'},100:{'pid':100,'startTicks':11,'parentPid':99,'exeIdentityHash':'d'*64,'groupHash':'e'*64,'VmLckBytes':0,'group':'/outside'}}
        life.process.side_effect=lambda pid:identities[pid]
        life.public_process.side_effect=lambda value:{key:value[key]for key in ('pid','startTicks','parentPid','exeIdentityHash','groupHash','VmLckBytes')}
        def bounded(path,limit):
            self.assertIn(path.name,('memory.max','memory.high','memory.swap.max','children'))
            return b''if path.name=='children'else path.read_bytes()
        life.bounded.side_effect=bounded
        hierarchy={'rows':[{'depth':0,'groupIdentitySha256':'f'*64,'quotaMicros':None,'periodMicros':100000,'nrThrottled':0,'throttledMicros':0},{'depth':1,'groupIdentitySha256':'1'*64,'quotaMicros':None,'periodMicros':None,'applicability':'hierarchy-root-no-bandwidth-controller','usageMicros':100,'userMicros':50,'systemMicros':50}],'weight':100,'cpusetCpus':'','cpusetMems':''}
        return spec,source,life,hierarchy,identities
    def test_same_identity_ignores_only_mutable_cpu_usage_and_never_reads_memory_baseline(self):
        with tempfile.TemporaryDirectory()as temp:
            spec,source,life,hierarchy,_=self.fixture(Path(temp));after=copy.deepcopy(hierarchy);after['rows'][1]['usageMicros']+=500
            with patch.object(control,'load_lifecycle',return_value=life),patch.object(control.runtime,'inspect_source',return_value=source),patch.object(control.cpu0_guards,'inspect_cpu_source',side_effect=[hierarchy,after]),patch.object(control,'host_memory',side_effect=AssertionError('host baseline before intent')),patch.object(control.runtime,'accounting',side_effect=AssertionError('source baseline before intent')):
                result=control.entry_identity({'cpuIsolation':{'periodMicros':100000,'weight':100,'cpusetCpus':'','cpusetMems':''}},spec,object())
                self.assertEqual(result['sourceLimits'],{'memoryMaxBytes':6*control.pin.GIB,'memoryHighBytes':None,'memorySwapMaxBytes':0})
                self.assertNotIn('usageMicros',result['cpuIdentity']['rows'][1]);self.assertEqual(set(result['outside']),{'entryInspector','transportParent'})
    def test_cap_cpu_identity_or_descendant_changes_refuse(self):
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp);spec,source,life,hierarchy,identities=self.fixture(root);after=copy.deepcopy(hierarchy);after['rows'][0]['groupIdentitySha256']='2'*64
            with patch.object(control,'load_lifecycle',return_value=life),patch.object(control.runtime,'inspect_source',return_value=source),patch.object(control.cpu0_guards,'inspect_cpu_source',side_effect=[hierarchy,after]):
                with self.assertRaisesRegex(RuntimeError,'lifecycle_process_changed'):control.entry_identity({'cpuIsolation':{'periodMicros':100000,'weight':100,'cpusetCpus':'','cpusetMems':''}},spec,object())
            (root/'memory.swap.max').write_text('1\n')
            with patch.object(control,'load_lifecycle',return_value=life),patch.object(control.runtime,'inspect_source',return_value=source):
                with self.assertRaisesRegex(RuntimeError,'source_limits_changed'):control.entry_identity({'cpuIsolation':{'periodMicros':100000,'weight':100,'cpusetCpus':'','cpusetMems':''}},spec,object())
            (root/'memory.swap.max').write_text('0\n');identities[os.getpid()]['group']='/source/descendant'
            with patch.object(control,'load_lifecycle',return_value=life),patch.object(control.runtime,'inspect_source',return_value=source),patch.object(control.cpu0_guards,'inspect_cpu_source',return_value=hierarchy):
                with self.assertRaisesRegex(RuntimeError,'overhead_placement_unproven'):control.entry_identity({'cpuIsolation':{'periodMicros':100000,'weight':100,'cpusetCpus':'','cpusetMems':''}},spec,object())

class CleanupRenewalTests(unittest.TestCase):
    def test_actual_proc_fixture_client_and_nonzero_events_are_observations_not_admission(self):
        import lifecycle_cpu0 as life
        from test_lifecycle_cpu0 import ProcFixture
        with ProcFixture()as fixture:
            historical=fixture.attest();cg=fixture.cg/'clone'
            for leaf,value in (('memory.max',str(6*control.pin.GIB)),('memory.high','max'),('memory.swap.max','0'),('memory.events','max 11\noom 2\noom_kill 1')):(cg/leaf).write_text(value+'\n')
            (fixture.proc/'10/net/tcp').write_text('header\n0: 0100007F:18BD 0100007F:AAAA 01\n')
            spec=SimpleNamespace(container=life.NEW,memory_bytes=6*control.pin.GIB,swap_bytes=6*control.pin.GIB)
            source=SimpleNamespace(pid=11,identity=('a'*64,life.IMAGE,11,101),cgroup=cg,cgroup_relative='/clone',spec=spec)
            config=json.loads((Path(__file__).parent/'prepared-control-policy-cpu0.json').read_text())
            hierarchy={'rows':[{'depth':0,'groupIdentitySha256':'f'*64,'quotaMicros':None,'periodMicros':100000,'nrThrottled':2,'throttledMicros':3}],'weight':100,'cpusetCpus':'','cpusetMems':''}
            original=life.cleanup_attest
            def renew(name,history,docker):return original(name,history,docker,fixture.proc,fixture.cg)
            with patch.object(control,'load_lifecycle',return_value=life),patch.object(control,'CPU_POLICY',config['cpuIsolation'],create=True),patch.object(control.runtime,'inspect_source',return_value=source),patch.object(control.runtime,'docker',return_value=json.dumps([fixture.x])),patch.object(control.cpu0_guards,'inspect_cpu_source',return_value=hierarchy),patch.object(life,'ROOT',fixture.root),patch.object(life,'MOUNTS',fixture.mounts),patch.object(life,'cleanup_attest',side_effect=renew),patch.object(control,'host_memory',side_effect=AssertionError('cleanup cannot demand capacity')),patch.object(control.runtime,'accounting',side_effect=AssertionError('cleanup cannot demand admission metrics')):
                result=control.renew_cleanup(config,spec,object(),historical)
                self.assertEqual(result['sourceEvents'],{'max':11,'oom':2,'oom_kill':1});self.assertEqual(result['currentSource']['activeServiceConnections'],1)
                self.assertIs(result['cleanupOnly'],True);self.assertIs(result['admission'],False);self.assertEqual(result['historicalSource'],historical)
                (cg/'memory.swap.max').write_text('1\n')
                with self.assertRaisesRegex(RuntimeError,'source_limits_changed'):control.renew_cleanup(config,spec,object(),historical)

class PressureSwapTests(unittest.TestCase):
    def test_swap_above_floor_still_refuses_with_same_read(self):
        sample={'MemTotal':8*control.pin.GIB,'MemAvailable':5*control.pin.GIB,'Dirty':123,'Writeback':456,'SwapTotal':4096}
        with patch.object(control,'host_memory',return_value=sample)as reader:
            with self.assertRaisesRegex(RuntimeError,'swap_present')as failure:control.host_available(3*control.pin.GIB//2,scope='archive-pressure')
        reader.assert_called_once_with();proof=failure.exception.pressureMemoryFailureEvidence
        self.assertEqual(proof['hostMemAvailableBytes'],sample['MemAvailable']);self.assertEqual(proof['hostSwapBytes'],4096);self.assertEqual(proof['hostDirtyBytes'],123)
    def test_zero_swap_exact_emergency_floor_unchanged(self):
        floor=3*control.pin.GIB//2;sample={'MemTotal':8*control.pin.GIB,'MemAvailable':floor,'Dirty':0,'Writeback':0,'SwapTotal':0}
        with patch.object(control,'host_memory',return_value=sample):self.assertEqual(control.host_available(floor),floor)

class FixedSourceHighTests(unittest.TestCase):
    def test_numeric_high_is_not_max_and_original_numeric_limits_survive(self):
        import lifecycle_cpu0 as life
        with tempfile.TemporaryDirectory()as temp:
            root=Path(temp)
            for leaf,value in (('memory.max',6*control.pin.GIB),('memory.high',6*control.pin.GIB),('memory.swap.max',0)):(root/leaf).write_text(str(value)+'\n')
            source=SimpleNamespace(cgroup=root);spec=SimpleNamespace(memory_bytes=6*control.pin.GIB,swap_bytes=6*control.pin.GIB)
            with self.assertRaisesRegex(RuntimeError,'source_limits_changed')as failure:control._source_cgroup_limits(source,spec,life)
            self.assertEqual(failure.exception.sourceLimitFailureEvidence,{'memoryMaxBytes':6*control.pin.GIB,'memoryHighBytes':6*control.pin.GIB,'memorySwapMaxBytes':0})
            self.assertEqual(control.admission_failure(failure.exception)['sourceLimitFailureEvidence'],failure.exception.sourceLimitFailureEvidence)
            (root/'memory.high').write_text('max\n');self.assertIsNone(control._source_cgroup_limits(source,spec,life)['memoryHighBytes'])

class RealForkScopeTests(unittest.TestCase):
    SCRIPT=r"""import os,sys,json,time,signal,fcntl,tempfile,threading,ctypes
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,sys.argv[1])
import controller_cpu0 as c,lifecycle_cpu0 as life
mode=sys.argv[2]
with tempfile.TemporaryDirectory()as directory:
 root=Path(directory);life.ROOT=root;c.ROOT=root
 fd=os.open(root/'control.lock',os.O_CREAT|os.O_RDWR,0o600);fcntl.flock(fd,fcntl.LOCK_EX);lock_identity=os.fstat(fd)
 extra=None;thread=None;event=threading.Event();address=None;libc=None;held_bytes=None
 if mode=='large-parent':held_bytes=bytearray(64*1024**2)
 def target(connection,*args):
  try:
   current=os.fstat(fd);inherited=(current.st_dev,current.st_ino)==(lock_identity.st_dev,lock_identity.st_ino)
  except OSError:inherited=False
  connection.send({'pid':os.getpid(),'startTicks':life.birth(os.getpid()),'parentPid':os.getppid(),'controlInherited':inherited})
  try:connection.recv()
  except EOFError:pass
  connection.close()
 c.pin_child=target;c.load_lifecycle=lambda _:life
 signal.signal(signal.SIGTERM,lambda *_:(_ for _ in()).throw(RuntimeError('parent interrupted')))
 if mode=='extra-fd':extra=os.open('/dev/null',os.O_RDONLY)
 if mode=='thread':thread=threading.Thread(target=lambda:event.wait(10));thread.start()
 if mode=='mapping':
  file=os.open(root/'owned-mapping',os.O_CREAT|os.O_RDWR,0o600);os.ftruncate(file,4096)
  libc=ctypes.CDLL(None,use_errno=True);libc.mmap.restype=ctypes.c_void_p
  address=libc.mmap(None,4096,1,1,file,0);os.close(file)
  if address==ctypes.c_void_p(-1).value:raise RuntimeError('fixture mmap')
 if mode=='constructor-interrupt':
  original_mask=signal.pthread_sigmask;parent_pid=os.getpid()
  def interrupted_mask(how,mask):
   result=original_mask(how,mask)
   if how==signal.SIG_SETMASK and os.getpid()==parent_pid:raise RuntimeError('constructor interruption')
   return result
  signal.pthread_sigmask=interrupted_mask
 holder=None
 try:
  with life.helper_fork_scope(fd):holder=c.PinChild(None,None,False,{})
  assert holder.process._start_method=='fork'
  assert holder.connection.poll(3);row=holder.connection.recv()
  children=Path('/proc/self/task/'+str(os.getpid())+'/children').read_text().split()
  assert children==[str(holder.process.pid)]
  life.require_lock(fd)
  contender=os.open(root/'control.lock',os.O_RDWR)
  try:
   try:fcntl.flock(contender,fcntl.LOCK_EX|fcntl.LOCK_NB);raise RuntimeError('parent lock lost')
   except BlockingIOError:pass
  finally:os.close(contender)
  if mode=='term':holder.process.terminate()
  elif mode=='eof':holder.connection.close()
  else:holder.connection.send('close')
  holder.process.join(3)
  assert not holder.process.is_alive()
  print(json.dumps({'refused':False,'childCount':len(children),'controlInherited':row['controlInherited'],'birthVerified':row['startTicks']>0 and row['parentPid']==os.getpid(),'exitCode':holder.process.exitcode,'parentLockHeld':True}))
 except RuntimeError as error:
  if mode=='constructor-interrupt':
   assert str(error)=='constructor interruption'
   assert error.childFailureDetails['constructorChildGone']is True
   life.require_lock(fd)
   print(json.dumps({'constructorChildGone':True,'originalReasonPreserved':True}))
  elif mode not in ('extra-fd','thread','mapping','large-parent'):raise
  else:
   assert str(error)=='overhead_helper_unproven'
   assert not Path('/proc/self/task/'+str(os.getpid())+'/children').read_text().split()
   print(json.dumps({'refused':True,'childrenStarted':0}))
 finally:
  if holder is not None:
   if holder.process.is_alive():holder.process.kill();holder.process.join(3)
   holder.connection.close()
  if extra is not None:os.close(extra)
  if thread is not None:event.set();thread.join(3)
  if address is not None:libc.munmap(ctypes.c_void_p(address),4096)
  os.close(fd)
"""
    def invoke(self,mode):
        import subprocess
        with tempfile.TemporaryDirectory()as directory:
            path=Path(directory)/'owned_fixture.py';path.write_text(self.SCRIPT)
            result=subprocess.run(['/usr/bin/python3','-I','-B',str(path),str(Path(__file__).absolute().parent),mode],capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode,0,result.stderr);return json.loads(result.stdout)
    def test_real_fork_census_birth_lock_and_clean_exit(self):
        proof=self.invoke('normal');self.assertEqual(proof,{'refused':False,'childCount':1,'controlInherited':False,'birthVerified':True,'exitCode':0,'parentLockHeld':True})
    def test_real_parent_pipe_eof_releases_child(self):self.assertEqual(self.invoke('eof')['exitCode'],0)
    def test_real_parent_raising_term_handler_not_inherited(self):self.assertEqual(self.invoke('term')['exitCode'],-15)
    def test_real_extra_fd_refuses_before_start(self):self.assertTrue(self.invoke('extra-fd')['refused'])
    def test_real_thread_refuses_before_start(self):self.assertTrue(self.invoke('thread')['refused'])
    def test_real_owned_mapping_refuses_before_start(self):self.assertTrue(self.invoke('mapping')['refused'])
    def test_real_parent_anonymous_memory_above_quarter_reserve_refuses(self):self.assertTrue(self.invoke('large-parent')['refused'])
    def test_real_interruption_after_start_keeps_child_owned_and_reaps(self):self.assertEqual(self.invoke('constructor-interrupt'),{'constructorChildGone':True,'originalReasonPreserved':True})

if __name__=='__main__':unittest.main()
