import copy
from contextlib import ExitStack
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock,patch
import controller_cpu0 as control
import daemon_cpu0 as daemon
from test_daemon import accounting,pin_state

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
            events=[]
            with ExitStack() as stack:
                contexts=[patch.object(control.os,'open',return_value=12),patch.object(control.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(control.os,'close'),patch.object(control.fcntl,'flock'),patch.object(control,'frozen_helper'),patch.object(control,'load_cache_preparation'),patch.object(control,'prepare_cache',return_value={'final':{'accounting':accounting()}}),patch.object(control,'guard_shards'),patch.object(control,'self_cgroup',return_value='/parent'),patch.object(control,'verify_archive'),patch.object(control,'owned_total_budget'),patch.object(control,'cold'),patch.object(control,'inspect_source',return_value=source),patch.object(control.cpu0_guards,'inspect_cpu_source',return_value={}),patch.object(control.cpu0_guards,'cpu_delta',return_value=[]),patch.object(control,'CPU_POLICY',{},create=True),patch.object(control.runtime,'measure_source',side_effect=measure),patch.object(control.runtime,'accounting',side_effect=account),patch.object(control,'process_counters',return_value={'minorFaults':0,'majorFaults':1,'physicalReadBytes':1,'rssBytes':1}),patch.object(control,'pressure',return_value={}),patch.object(control,'PinChild',return_value=holder),patch.object(control,'query_lease',side_effect=lambda _:progress.update(ack=True))]
                for context in contexts:stack.enter_context(context)
                with self.assertRaisesRegex(RuntimeError,'phase_resource_failed'):
                    control.stage({'queryLeaseSeconds':60,'controlReadySeconds':1200,'cachePreparation':{'helperSha256':'a'*64}},spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',events.append)
            failure=next(e for e in events if e['stage']=='phase-failed')
            self.assertEqual(failure['resourceLimitEvidence']['scope'],target)
            self.assertEqual(failure['reason'],'phase_resource_failed')
            self.assertEqual(events[-1]['cleanupReason'],'pin_child_cleanup')
            self.assertFalse(any(e['stage']=='query-finished' for e in events))

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
            for name in ('pin_cpu0.py','runtime_cpu0.py','daemon_cpu0.py','controller_cpu0.py','cpu0_guards.py','cpu0_preflight.py','turnover_gate_cpu0.py'):
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

if __name__=='__main__':unittest.main()
