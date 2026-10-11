import contextlib
import io
import json
from types import SimpleNamespace
import unittest
from unittest.mock import Mock,patch

import controller
from test_daemon import accounting


class ControllerTests(unittest.TestCase):
    def test_first_command_precedes_source_rpc_and_release_is_proven(self):
        source=SimpleNamespace(spec='spec')
        replies=iter(['strict-pass',{'source':source},'close'])
        connection=Mock();connection.recv.side_effect=lambda:next(replies);connection.poll.return_value=True
        manager=Mock();manager.release_state.return_value={'released':True,'heldMappingCount':0}
        def prepare(source,budget,**kwargs):pass
        with patch.object(controller,'frozen_helper'),patch.object(controller,'guard_shards'),patch.object(controller,'validate_child_source',return_value=source),patch.object(controller.runtime,'prepare_self',side_effect=prepare),patch.object(controller.pin,'PinSet',return_value=manager),patch.object(controller.runtime,'reconcile_source',return_value={'raw':'state'}),patch.object(controller.daemon,'public_state',return_value={'public':'state'}):
            controller.pin_child(connection,'spec',SimpleNamespace(max_locked_bytes=1),False,{})
        self.assertEqual(connection.send.call_args_list[0].args[0],{'request':'inspect-source'})
        self.assertEqual(connection.send.call_args_list[-1].args[0],{'closed':True})
        manager.close.assert_called_once();manager.release_state.assert_called_once()

    def test_child_failure_reports_original_reason_after_cleanup_attempt(self):
        source=SimpleNamespace(spec='spec');connection=Mock();connection.poll.return_value=True
        replies=iter(['strict-pass',{'source':source}]);connection.recv.side_effect=lambda:next(replies)
        manager=Mock();manager.close.side_effect=RuntimeError('private cleanup path')
        manager.release_state.return_value={'released':False,'heldMappingCount':1}
        with patch.object(controller,'frozen_helper'),patch.object(controller,'guard_shards'),patch.object(controller,'validate_child_source',return_value=source),patch.object(controller.runtime,'prepare_self'),patch.object(controller.pin,'PinSet',return_value=manager),patch.object(controller.runtime,'reconcile_source',side_effect=RuntimeError('projected_headroom_below_reserve')):
            with self.assertRaises(SystemExit):controller.pin_child(connection,'spec',SimpleNamespace(max_locked_bytes=1),False,{})
        manager.close.assert_called_once()
        failure=connection.send.call_args_list[-1].args[0]
        self.assertTrue(failure['failed']);self.assertEqual(failure['reason'],'projected_headroom_below_reserve');self.assertEqual(failure['releaseState'],{'released':False,'heldMappingCount':1})
        self.assertNotIn('private',str(failure))

    def test_default_never_loads_policy_or_executes_control(self):
        with patch.object(controller,'load_control') as load,patch.object(controller,'stage') as stage,contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(controller.main([]),0)
        load.assert_not_called();stage.assert_not_called();self.assertEqual(json.loads(out.getvalue())['stage'],'prepared-only')

    def test_pressure_cap_is_visible_but_query_and_initial_limits_remain_strict(self):
        before=accounting();after=accounting();after['memoryEvents']['max']=603
        self.assertEqual(controller.limits(before,after,pressure=True)['memoryEventDelta']['max'],603)
        with self.assertRaises(RuntimeError):controller.limits(before,after)
        for key in ('oom','oom_kill'):
            after=accounting();after['memoryEvents'][key]=1
            with self.assertRaises(RuntimeError):controller.limits(before,after,pressure=True)
        after=accounting();after['cpu']['throttled_usec']=1
        with self.assertRaises(RuntimeError):controller.limits(before,after,pressure=True)

    def test_private_or_partial_query_ack_is_bounded(self):
        import os
        for data in (b'{"stage":"query-finished"}\n',b'{"query":"private text"}\n',b'x'*128,b'{"stage":'):
            read,write=os.pipe()
            try:
                os.write(write,data)
                with os.fdopen(read,'rb',closefd=False) as reader:
                    if data==b'{"stage":"query-finished"}\n':controller.query_lease(.03,reader)
                    else:
                        with self.assertRaises(RuntimeError):controller.query_lease(.03,reader)
            finally:os.close(read);os.close(write)

    def test_resource_counter_resets_fail_but_rss_decline_is_valid(self):
        before={'minorFaults':10,'majorFaults':20,'physicalReadBytes':100,'rssBytes':100}
        after={**before,'rssBytes':0}
        self.assertEqual(controller.counter_delta(before,after)['rssBytes'],-100)
        with self.assertRaises(RuntimeError):controller.counter_delta(before,{**after,'majorFaults':19})

    def test_failed_or_unknown_execute_arguments_emit_no_private_error(self):
        with contextlib.redirect_stdout(io.StringIO()) as out,contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(controller.main(['--private-secret']),1)
        self.assertEqual(err.getvalue(),'');self.assertNotIn('secret',out.getvalue());self.assertEqual(json.loads(out.getvalue())['stage'],'failed')

    def test_parent_pressure_loop_uses_explicit_steady_child_pass_only_inside_read_window(self):
        source=SimpleNamespace(identity=('fixed',),spec='spec');manager=Mock()
        info=SimpleNamespace(st_mode=0o100600,st_size=3,st_dev=1,st_ino=2,st_mtime_ns=3)
        config={'pressure':{'bytes':3,'sha256':controller.hashlib.sha256(b'abc').hexdigest(),'rateBytesPerSecond':1,'maxSeconds':10}}
        times=iter([0,3,3,3,3,3,3,3,3]);clock=lambda:next(times)
        with patch.object(controller.os,'open',return_value=123),patch.object(controller.os,'read',side_effect=[b'abc',b'']),patch.object(controller.os,'fstat',return_value=info),patch.object(controller.os,'close') as close,patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller,'host_available',return_value=8*1024**3):
            state=controller.pressure(config,source,manager,clock=clock,sleep=Mock(),floor=1)
        manager.request.assert_called_once_with(pressure=True);close.assert_called_once_with(123);self.assertEqual(state['bytes'],3)

    def test_candidate_keeps_child_pins_through_query_ack_and_cleans_on_timeout(self):
        from test_daemon import pin_state
        import os
        spec=SimpleNamespace();source=SimpleNamespace(identity=('fixed',),spec=spec,cgroup_relative='/clone',pid=123)
        measured={'selectionHash':'a'*64,'classesMeasured':{k:{'files':1,'dataPages':1,'residentDataPages':1} for k in ('vector','graph','sparse','other')},'pageBytes':4096,'accounting':accounting()}
        first=pin_state();steady=pin_state();steady.update(newLockBytes=0,rangesChanged=False)
        for fail in (False,True):
            holder=Mock();holder.request.side_effect=[first,steady,steady]
            emitted=[]
            def lease(_seconds):
                holder.close.assert_not_called()
                self.assertEqual(emitted[-1]['stage'],'query-ready')
                if fail:raise RuntimeError('query_lease_timeout')
            record={'minorFaults':1,'majorFaults':2,'physicalReadBytes':3,'rssBytes':4}
            with patch.object(controller.os,'open',return_value=12),patch.object(controller.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(controller.os,'close'),patch.object(controller.fcntl,'flock'),patch.object(controller,'frozen_helper'),patch.object(controller,'guard_shards',return_value=6),patch.object(controller,'self_cgroup',return_value='/session'),patch.object(controller,'verify_archive',return_value={'bytes':controller.ARCHIVE_BYTES}),patch.object(controller,'owned_total_budget',return_value=1),patch.object(controller,'cold',return_value={'actualQdrantPid':123}),patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller.runtime,'measure_source',return_value=measured),patch.object(controller.runtime,'accounting',side_effect=lambda source:accounting()),patch.object(controller,'process_counters',return_value=record),patch.object(controller,'pressure',return_value={'bytes':controller.ARCHIVE_BYTES}),patch.object(controller,'PinChild',return_value=holder),patch.object(controller,'query_lease',side_effect=lease),patch.object(controller.runtime,'prepare_self') as parent_join:
                if fail:
                    with self.assertRaises(RuntimeError):controller.stage({'queryLeaseSeconds':2},spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',emitted.append)
                else:controller.stage({'queryLeaseSeconds':2},spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',emitted.append)
            holder.close.assert_called_once();parent_join.assert_not_called()
            if not fail:
                self.assertEqual(emitted[-1]['stage'],'unpin-complete');self.assertEqual(emitted[-3]['stage'],'query-finished');self.assertEqual(emitted[-3]['pinStateAfterQuery']['lockedBytes'],16384)

    def test_pressure_cohort_change_blocks_query_lease_and_releases_holder(self):
        from test_daemon import pin_state
        import os
        source=SimpleNamespace(identity=('fixed',),spec=object(),cgroup_relative='/clone',pid=123);holder=Mock();holder.request.return_value=pin_state()
        snapshots=[{'selectionHash':'a'*64,'classesMeasured':{k:{'dataPages':1,'residentDataPages':1} for k in ('vector','graph','sparse','other')},'pageBytes':4096,'accounting':accounting()},{'selectionHash':'b'*64,'classesMeasured':{}}]
        with patch.object(controller.os,'open',return_value=12),patch.object(controller.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(controller.os,'close'),patch.object(controller.fcntl,'flock'),patch.object(controller,'frozen_helper'),patch.object(controller,'guard_shards',return_value=6),patch.object(controller,'self_cgroup',return_value='/session'),patch.object(controller,'verify_archive',return_value={}),patch.object(controller,'owned_total_budget',return_value=1),patch.object(controller,'cold',return_value={}),patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller.runtime,'measure_source',side_effect=snapshots),patch.object(controller.runtime,'accounting',side_effect=lambda source:accounting()),patch.object(controller,'process_counters',return_value={'minorFaults':0,'majorFaults':0,'physicalReadBytes':0,'rssBytes':0}),patch.object(controller,'pressure',return_value={}),patch.object(controller,'PinChild',return_value=holder),patch.object(controller,'query_lease') as lease:
            with self.assertRaises(RuntimeError):controller.stage({'queryLeaseSeconds':2},source.spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',Mock())
        lease.assert_not_called();holder.close.assert_called_once()

    def test_archive_store_alias_fails_before_advice(self):
        import os,tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'store').mkdir();(root/'rename-proof').mkdir()
            store=root/'store'/'vector.bin';store.write_bytes(b'abc');archive=root/'rename-proof'/'media.snapshot';os.link(store,archive)
            with patch.object(controller,'ROOT',root),patch.object(controller,'ARCHIVE',archive),patch.object(controller,'ARCHIVE_BYTES',3),patch.object(controller.os,'fsync') as fsync,patch.object(controller.os,'posix_fadvise') as advice:
                with self.assertRaises(RuntimeError):controller.verify_archive(1)
            fsync.assert_not_called();advice.assert_not_called()

    def test_low_host_memory_aborts_pressure_before_next_read(self):
        source=SimpleNamespace(identity=('fixed',),spec='spec');info=SimpleNamespace(st_mode=0o100600,st_size=3)
        with patch.object(controller.os,'open',return_value=123),patch.object(controller.os,'fstat',return_value=info),patch.object(controller.os,'close') as close,patch.object(controller.os,'read') as read,patch.object(controller,'host_available',side_effect=RuntimeError('host_emergency_floor')):
            with self.assertRaises(RuntimeError):controller.pressure({'pressure':{'bytes':3}},source,floor=1)
        read.assert_not_called();close.assert_called_once_with(123)

    def test_whole_owned_budget_counts_archive_and_deduplicates_hardlinks(self):
        import os,tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);path=root/'archive';path.write_bytes(b'abc');os.link(path,root/'alias')
            with patch.object(controller,'ROOT',root),patch.object(controller.shutil,'disk_usage',return_value=SimpleNamespace(free=4*controller.pin.GIB)):
                self.assertEqual(controller.owned_total_budget(),path.stat().st_blocks*512)
            with patch.object(controller,'ROOT',root),patch.object(controller.shutil,'disk_usage',return_value=SimpleNamespace(free=2*controller.pin.GIB)):
                with self.assertRaises(RuntimeError):controller.owned_total_budget()

    def test_source_inspection_rpc_runs_in_parent_and_cap_ledger_checks_between_passes(self):
        import tempfile
        from pathlib import Path
        from test_daemon import pin_state
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'900').mkdir();(root/'900'/'cgroup').write_text('0::/clone\n');(root/'900'/'status').write_text('VmLck: 16 kB\n')
            source=SimpleNamespace(cgroup_relative='/clone');state=pin_state();state.update(newLockBytes=0,rangesChanged=False)
            obj=controller.PinChild.__new__(controller.PinChild);obj.spec='fixed';obj.process=SimpleNamespace(pid=900);obj.previous=accounting();obj.pressure_active=False
            obj.connection=Mock();obj.connection.poll.return_value=True;obj.connection.recv.side_effect=[{'request':'inspect-source'},{'state':state}]
            real_path=controller.Path
            with patch.object(controller,'Path',side_effect=lambda x:root if str(x)=='/proc' else real_path(x)),patch.object(controller.runtime,'accounting',side_effect=lambda x:accounting()),patch.object(controller.runtime,'inspect_source',return_value=source) as inspect,patch.object(controller,'self_cgroup',return_value='/session'):
                result=obj.request()
            self.assertEqual(result['lockedBytes'],16384);self.assertIn(unittest.mock.call({'source':source}),obj.connection.send.call_args_list)
            inspect.assert_called();obj.connection.reset_mock()
            changed=accounting();changed['memoryEvents']['max']=1
            with patch.object(controller.runtime,'accounting',return_value=changed),patch.object(controller.runtime,'inspect_source',return_value=source):
                with self.assertRaises(RuntimeError):obj.request()
            obj.connection.send.assert_not_called()


if __name__=='__main__':unittest.main()
