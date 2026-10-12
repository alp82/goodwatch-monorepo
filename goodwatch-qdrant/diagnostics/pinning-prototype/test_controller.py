import contextlib
import io
import json
from types import SimpleNamespace
import unittest
from unittest.mock import Mock,patch

import controller
from test_daemon import accounting


class ControllerTests(unittest.TestCase):
    def test_cache_preparation_loads_only_the_exact_owned_immutable_bytes(self):
        import tempfile,os,hashlib
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'prepare_clone_reclaim.py';raw=b'REQUEST=3221225472\n'
            path.write_bytes(raw);path.chmod(0o600)
            config={'cachePreparation':{'helperPath':str(path),'helperSha256':hashlib.sha256(raw).hexdigest(),'requestedBytes':3*1024**3}}
            with patch.object(controller,'MODULE_DIR',Path(directory)):
                self.assertEqual(controller.load_cache_preparation(config).REQUEST,3*1024**3)
                path.write_bytes(b'REQUEST=0\n')
                with self.assertRaisesRegex(RuntimeError,'cache_preparation_freeze_changed'):controller.load_cache_preparation(config)
                path.write_bytes(raw);path.chmod(0o644)
                with self.assertRaisesRegex(RuntimeError,'cache_preparation_freeze_changed'):controller.load_cache_preparation(config)

    def test_preparation_to_initial_and_initial_to_pin_counters_are_strict(self):
        clean=accounting();changed=accounting();changed['memoryEvents']['max']=1
        with self.assertRaisesRegex(RuntimeError,'phase_resource_failed'):controller.limits(clean,changed)
        changed=accounting();changed['cpu']['nr_throttled']=1
        with self.assertRaisesRegex(RuntimeError,'phase_resource_failed'):controller.limits(clean,changed)

    def test_nofile_raise_requires_separate_cli_opt_in(self):
        for enabled in (False,True):
            args=['--execute-reviewed','--config','fixture','--policy-sha256','a'*64,'--code-sha256','b'*64,'--phase','candidate','--case-tag','heldout-person']
            if enabled:args.append('--raise-own-nofile')
            with patch.object(controller,'load_control',return_value=({},object(),object())),patch.object(controller,'stage') as stage,patch.object(controller.signal,'signal'),contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(controller.main(args),0)
                self.assertEqual(stage.call_args.args[-1],enabled)

    def test_first_command_precedes_source_rpc_and_release_is_proven(self):
        source=SimpleNamespace(spec='spec')
        replies=iter(['strict-pass',{'source':source},'close'])
        connection=Mock();connection.recv.side_effect=lambda:next(replies);connection.poll.return_value=True
        manager=Mock();manager.release_state.return_value={'released':True,'heldMappingCount':0}
        def prepare(source,budget,**kwargs):pass
        with patch.object(controller,'frozen_helper'),patch.object(controller,'guard_shards'),patch.object(controller,'validate_child_source',return_value=source),patch.object(controller.runtime,'prepare_self',side_effect=prepare),patch.object(controller.pin,'PinSet',return_value=manager),patch.object(controller.runtime,'reconcile_source',return_value={'raw':'state'}),patch.object(controller.daemon,'public_state',return_value={'public':'state'}):
            controller.pin_child(connection,'spec',SimpleNamespace(max_locked_bytes=1),False,{},raise_own_nofile=True)
            self.assertTrue(controller.runtime.reconcile_source.call_args.kwargs['raise_own_nofile'])
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
        config={'reconcileIntervalSeconds':10,'pressure':{'bytes':3,'sha256':controller.hashlib.sha256(b'abc').hexdigest(),'rateBytesPerSecond':1,'maxSeconds':10}}
        times=iter([0]+[10]*20);clock=lambda:next(times)
        with patch.object(controller.os,'open',return_value=123),patch.object(controller.os,'read',side_effect=[b'abc',b'']),patch.object(controller.os,'fstat',return_value=info),patch.object(controller.os,'close') as close,patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller,'host_available',return_value=8*1024**3):
            state=controller.pressure(config,source,manager,clock=clock,sleep=Mock(),floor=1)
        manager.request.assert_called_once_with(pressure=True);close.assert_called_once_with(123);self.assertEqual(state['bytes'],3)

    def test_candidate_keeps_child_pins_through_query_ack_and_cleans_on_timeout(self):
        from test_daemon import pin_state
        import os
        spec=SimpleNamespace();source=SimpleNamespace(identity=('fixed',),spec=spec,cgroup_relative='/clone',pid=123)
        measured={'selectionHash':'a'*64,'classesMeasured':{k:{'files':1,'dataPages':1,'residentDataPages':1} for k in ('vector','graph','sparse','other')},'pageBytes':4096,'accounting':accounting(),'nofileLimits':{'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1024,'softAfter':20260,'hardLimit':1048576,'raised':True,'hardChanged':False}}
        first=pin_state();steady=pin_state();steady.update(newLockBytes=0,rangesChanged=False)
        for fail in (False,True):
            holder=Mock();holder.request.side_effect=[first,steady,steady]
            emitted=[]
            def lease(_seconds):
                holder.close.assert_not_called()
                self.assertEqual(emitted[-1]['stage'],'query-ready')
                if fail:raise RuntimeError('query_lease_timeout')
            record={'minorFaults':1,'majorFaults':2,'physicalReadBytes':3,'rssBytes':4}
            with patch.object(controller.os,'open',return_value=12),patch.object(controller.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(controller.os,'close'),patch.object(controller.fcntl,'flock'),patch.object(controller,'frozen_helper'),patch.multiple(controller,load_cache_preparation=Mock(),prepare_cache=Mock(return_value={'final':{'accounting':accounting()}})),patch.object(controller,'guard_shards',return_value=6),patch.object(controller,'self_cgroup',return_value='/session'),patch.object(controller,'verify_archive',return_value={'bytes':controller.ARCHIVE_BYTES}),patch.object(controller,'owned_total_budget',return_value=1),patch.object(controller,'cold',return_value={'actualQdrantPid':123}),patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller.runtime,'measure_source',return_value=measured) as measure_read,patch.object(controller.runtime,'accounting',side_effect=lambda source:accounting()),patch.object(controller,'process_counters',return_value=record),patch.object(controller,'pressure',return_value={'bytes':controller.ARCHIVE_BYTES}),patch.object(controller,'PinChild',return_value=holder),patch.object(controller,'query_lease',side_effect=lease),patch.object(controller.runtime,'prepare_self') as parent_join:
                if fail:
                    with self.assertRaises(RuntimeError):controller.stage({'queryLeaseSeconds':2,'controlReadySeconds':1200,'cachePreparation':{'helperSha256':'f'*64}},spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',emitted.append,raise_own_nofile=True)
                else:controller.stage({'queryLeaseSeconds':2,'controlReadySeconds':1200,'cachePreparation':{'helperSha256':'f'*64}},spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',emitted.append,raise_own_nofile=True)
            holder.close.assert_called_once();parent_join.assert_not_called()
            self.assertEqual(emitted[0]['stage'],'cache-preparation-complete')
            self.assertTrue(measure_read.call_args_list)
            self.assertTrue(all(call.kwargs['raise_own_nofile'] is True for call in measure_read.call_args_list))
            if not fail:
                self.assertEqual(emitted[-1]['stage'],'unpin-complete');self.assertEqual(emitted[-3]['stage'],'query-finished');self.assertEqual(emitted[-3]['pinStateAfterQuery']['lockedBytes'],16384)

    def test_pressure_cohort_change_blocks_query_lease_and_releases_holder(self):
        from test_daemon import pin_state
        import os
        source=SimpleNamespace(identity=('fixed',),spec=object(),cgroup_relative='/clone',pid=123);holder=Mock();holder.request.return_value=pin_state()
        snapshots=[{'selectionHash':'a'*64,'classesMeasured':{k:{'dataPages':1,'residentDataPages':1} for k in ('vector','graph','sparse','other')},'pageBytes':4096,'accounting':accounting(),'nofileLimits':{'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1024,'softAfter':20260,'hardLimit':1048576,'raised':True,'hardChanged':False}},{'selectionHash':'b'*64,'classesMeasured':{}}]
        with patch.object(controller.os,'open',return_value=12),patch.object(controller.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)),patch.object(controller.os,'close'),patch.object(controller.fcntl,'flock'),patch.object(controller,'frozen_helper'),patch.multiple(controller,load_cache_preparation=Mock(),prepare_cache=Mock(return_value={'final':{'accounting':accounting()}})),patch.object(controller,'guard_shards',return_value=6),patch.object(controller,'self_cgroup',return_value='/session'),patch.object(controller,'verify_archive',return_value={}),patch.object(controller,'owned_total_budget',return_value=1),patch.object(controller,'cold',return_value={}),patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller.runtime,'measure_source',side_effect=snapshots),patch.object(controller.runtime,'accounting',side_effect=lambda source:accounting()),patch.object(controller,'process_counters',return_value={'minorFaults':0,'majorFaults':0,'physicalReadBytes':0,'rssBytes':0}),patch.object(controller,'pressure',return_value={}),patch.object(controller,'PinChild',return_value=holder),patch.object(controller,'query_lease') as lease:
            with self.assertRaises(RuntimeError):controller.stage({'queryLeaseSeconds':2,'controlReadySeconds':1200,'cachePreparation':{'helperSha256':'f'*64}},source.spec,SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',Mock())
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

    def test_verified_archive_reads_and_advises_only_the_owned_file(self):
        import hashlib,tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'store').mkdir();(root/'rename-proof').mkdir()
            archive=root/'rename-proof'/'media.snapshot';archive.write_bytes(b'abc')
            with patch.object(controller,'ROOT',root),patch.object(controller,'ARCHIVE',archive),patch.object(controller,'ARCHIVE_BYTES',3),patch.object(controller,'ARCHIVE_HASH',hashlib.sha256(b'abc').hexdigest()),patch.object(controller,'owned_store_files',return_value=([],0)),patch.object(controller,'owned_total_budget'),patch.object(controller,'host_available',return_value=10),patch.object(controller.os,'fsync') as fsync,patch.object(controller.os,'posix_fadvise') as advice:
                result=controller.verify_archive(1)
            self.assertEqual(result['bytes'],3);self.assertTrue(result['ownedArchiveAdviceCompleted'])
            fsync.assert_called_once();advice.assert_called_once()

    def test_low_host_memory_aborts_pressure_before_next_read(self):
        source=SimpleNamespace(identity=('fixed',),spec='spec');info=SimpleNamespace(st_mode=0o100600,st_size=3)
        with patch.object(controller.os,'open',return_value=123),patch.object(controller.os,'fstat',return_value=info),patch.object(controller.os,'close') as close,patch.object(controller.os,'read') as read,patch.object(controller,'host_available',side_effect=RuntimeError('host_emergency_floor')):
            with self.assertRaises(RuntimeError):controller.pressure({'reconcileIntervalSeconds':10,'pressure':{'bytes':3}},source,floor=1)
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
            obj=controller.PinChild.__new__(controller.PinChild);obj.spec='fixed';obj.config={'initialPinRequestSeconds':180,'steadyPinRequestSeconds':30};obj.process=SimpleNamespace(pid=900);obj.previous=accounting();obj.pressure_active=False
            obj.connection=Mock();obj.connection.poll.return_value=True;obj.connection.recv.side_effect=[{'request':'inspect-source'},{'state':state}]
            real_path=controller.Path
            with patch.object(controller,'Path',side_effect=lambda x:root if str(x)=='/proc' else real_path(x)),patch.object(controller.runtime,'accounting',side_effect=lambda x:accounting()),patch.object(controller.runtime,'inspect_source',return_value=source) as inspect,patch.object(controller,'self_cgroup',return_value='/session'):
                result=obj.request()
            self.assertEqual(result['lockedBytes'],16384);self.assertIn(unittest.mock.call({'source':source}),obj.connection.send.call_args_list)
            (root/'900'/'status').write_text('VmLck: 8 kB\n');obj.connection.recv.side_effect=[{'state':state}]
            with patch.object(controller,'Path',side_effect=lambda x:root if str(x)=='/proc' else real_path(x)),patch.object(controller.runtime,'accounting',side_effect=lambda x:accounting()),patch.object(controller.runtime,'inspect_source',return_value=source):
                with self.assertRaisesRegex(RuntimeError,'pin_holder_lock_proof_missing'):obj.request()
            (root/'900'/'status').write_text('VmLck: 16 kB\n')
            inspect.assert_called();obj.connection.reset_mock()
            changed=accounting();changed['memoryEvents']['max']=1
            with patch.object(controller.runtime,'accounting',return_value=changed),patch.object(controller.runtime,'inspect_source',return_value=source):
                with self.assertRaises(RuntimeError):obj.request()
            obj.connection.send.assert_not_called()

    def test_phase_cause_survives_cleanup_failure_with_actual_exit_evidence(self):
        import os
        from contextlib import ExitStack
        from test_daemon import pin_state
        holder=Mock();holder.request.return_value=pin_state();holder.close.side_effect=RuntimeError('pin_child_exit_failed')
        holder.failure_details={'releaseState':{'released':True,'heldMappingCount':0},'cleanupFailureReasons':[]}
        holder.process=SimpleNamespace(pid=999999999,exitcode=1,is_alive=lambda:False)
        source=SimpleNamespace(identity=('fixed',),spec='spec',cgroup_relative='/clone',pid=1)
        measured={'selectionHash':'a'*64,'classesMeasured':{k:{'dataPages':1,'residentDataPages':1} for k in ('vector','graph','sparse','other')},'pageBytes':4096,'accounting':accounting(),'nofileLimits':{'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1024,'softAfter':20260,'hardLimit':1048576,'raised':True,'hardChanged':False}}
        events=[]
        with ExitStack() as stack:
            stack.enter_context(patch.object(controller.os,'open',return_value=12));stack.enter_context(patch.object(controller.os,'fstat',return_value=SimpleNamespace(st_mode=0o100600,st_uid=os.geteuid(),st_nlink=1)))
            for owner,name in ((controller.os,'close'),(controller.fcntl,'flock'),(controller,'frozen_helper'),(controller,'guard_shards'),(controller,'verify_archive'),(controller,'owned_total_budget'),(controller,'cold'),(controller,'load_cache_preparation'),(controller,'prepare_cache')):stack.enter_context(patch.object(owner,name))
            stack.enter_context(patch.object(controller,'prepare_cache',return_value={'final':{'accounting':accounting()}}))
            stack.enter_context(patch.object(controller,'self_cgroup',return_value='/parent'))
            stack.enter_context(patch.object(controller.runtime,'inspect_source',return_value=source));stack.enter_context(patch.object(controller.runtime,'measure_source',return_value=measured));stack.enter_context(patch.object(controller.runtime,'accounting',side_effect=lambda source:accounting()))
            stack.enter_context(patch.object(controller,'process_counters',return_value={'minorFaults':0,'majorFaults':0,'physicalReadBytes':0,'rssBytes':0}))
            stack.enter_context(patch.object(controller,'PinChild',return_value=holder));stack.enter_context(patch.object(controller,'pressure',side_effect=RuntimeError('pressure_bound_failed')))
            with self.assertRaisesRegex(RuntimeError,'pressure_bound_failed'):controller.stage({'cachePreparation':{'helperSha256':'f'*64}},'spec',SimpleNamespace(emergency_bytes=1,cap_reserve_bytes=1),'candidate',events.append)
        self.assertEqual(events[-2]['reason'],'pressure_bound_failed');self.assertFalse(events[-1]['released'])
        self.assertTrue(events[-1]['pinChildExited']);self.assertEqual(events[-1]['pinChildExitCode'],1);self.assertEqual(events[-1]['cleanupReason'],'pin_child_exit_failed')

    def test_real_owned_process_close_timeout_proves_child_gone(self):
        import multiprocessing,time
        context=multiprocessing.get_context('fork');process=context.Process(target=time.sleep,args=(30,));process.start()
        obj=controller.PinChild.__new__(controller.PinChild);obj.process=process;obj.connection=Mock();obj.connection.poll.return_value=False
        try:
            with self.assertRaisesRegex(RuntimeError,'pin_child_cleanup'):obj.close()
            self.assertFalse(process.is_alive());self.assertFalse((controller.Path('/proc')/str(process.pid)).exists())
        finally:
            if process.is_alive():process.kill();process.join()

    def test_actual_local_proc_identity_validator_detects_pid_reuse_and_cgroup_change(self):
        import tempfile
        from pathlib import Path
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);proc=root/'123';proc.mkdir();(proc/'comm').write_text('qdrant\n');(proc/'exe').symlink_to('/qdrant/qdrant')
            fields=['0']*20;fields[19]='456';(proc/'stat').write_text('123 (qdrant) '+' '.join(fields));(proc/'cgroup').write_text('0::/docker-owned.scope\n')
            source=SimpleNamespace(pid=123,identity=('owned','image',123,456),cgroup_relative='/docker-owned.scope')
            with patch.object(controller.runtime,'PROC',root):
                self.assertIs(controller.runtime.validate_source_locally(source),source)
                fields[19]='457';(proc/'stat').write_text('123 (qdrant) '+' '.join(fields))
                with self.assertRaisesRegex(RuntimeError,'local_source_identity_changed'):controller.runtime.validate_source_locally(source)
                fields[19]='456';(proc/'stat').write_text('123 (qdrant) '+' '.join(fields));(proc/'cgroup').write_text('0::/outside\n')
                with self.assertRaisesRegex(RuntimeError,'local_source_identity_changed'):controller.runtime.validate_source_locally(source)

    def test_static_reason_union_preserves_fixed_codes_and_discards_private_errors(self):
        for reason in ('pressure_bound_failed','source_rpc_spec_changed','pin_child_exit_failed','host_emergency_floor','projected_headroom_below_reserve'):
            self.assertEqual(controller.safe_control_reason(RuntimeError(reason)),reason)
        self.assertEqual(controller.safe_control_reason(RuntimeError('/private/query/provider-key')),'guard_or_runtime_failure')

    def test_actual_docker_response_guards_exact_owner_image_resources_and_mounts(self):
        import copy
        from test_daemon import config
        c=config()['source'];spec=SimpleNamespace(container=c['container'],image=c['image'],memory_bytes=c['memoryBytes'],swap_bytes=c['swapBytes'],cpu_nanos=c['cpuNanos'],mounts=frozenset(tuple(x) for x in c['mounts']))
        document={'Name':'/'+c['container'],'Image':c['image'],'Config':{'Labels':{'goodwatch.task':'406','goodwatch.owner':'search-100-diagnosis'}},'HostConfig':{'Memory':c['memoryBytes'],'MemorySwap':c['swapBytes'],'NanoCpus':c['cpuNanos'],'PortBindings':{'6333/tcp':[{'HostIp':'127.0.0.1','HostPort':'16333'}]}},'Mounts':[dict(zip(('Source','Destination','Type','RW'),m)) for m in c['mounts']]}
        with patch.object(controller.runtime,'docker',return_value=json.dumps([document]).encode()):self.assertEqual(controller.inspect_stopped_or_running(spec)['Image'],spec.image)
        for mutate in (lambda d:d.update(Image='changed'),lambda d:d['Config']['Labels'].update({'goodwatch.owner':'other'}),lambda d:d['HostConfig'].update(Memory=1),lambda d:d['HostConfig']['PortBindings']['6333/tcp'][0].update(HostIp='0.0.0.0'),lambda d:d['Mounts'].append(d['Mounts'][0])):
            changed=copy.deepcopy(document);mutate(changed)
            with patch.object(controller.runtime,'docker',return_value=json.dumps([changed]).encode()):
                with self.assertRaises(RuntimeError):controller.inspect_stopped_or_running(spec)


    def test_reconcile_pause_cannot_create_archive_catchup_burst(self):
        source=SimpleNamespace(identity=('fixed',),spec='spec');manager=Mock();time={'now':0};sleeps=[]
        chunks=iter([b'a',b'b',b'c',b'']);reads={'count':0}
        def read(fd,count):
            reads['count']+=1
            if reads['count']==1:time['now']+=10
            return next(chunks)
        def pause(seconds):sleeps.append(seconds);time['now']+=seconds
        def reconcile(**kwargs):time['now']+=20
        manager.request.side_effect=reconcile
        info=SimpleNamespace(st_mode=0o100600,st_size=3,st_dev=1,st_ino=2,st_mtime_ns=3)
        config={'reconcileIntervalSeconds':10,'pressure':{'bytes':3,'sha256':controller.hashlib.sha256(b'abc').hexdigest(),'rateBytesPerSecond':1,'maxSeconds':100}}
        with patch.object(controller.os,'open',return_value=123),patch.object(controller.os,'read',side_effect=read),patch.object(controller.os,'fstat',return_value=info),patch.object(controller.os,'close'),patch.object(controller.runtime,'inspect_source',return_value=source),patch.object(controller,'host_available'):
            result=controller.pressure(config,source,manager,clock=lambda:time['now'],sleep=pause,floor=1)
        self.assertEqual(sleeps,[1,1]);self.assertEqual(result['bytes'],3);self.assertEqual(result['reconcilePassCount'],1)


    def test_archive_policy_mismatch_has_archive_cause_without_helper_inspection(self):
        import tempfile
        from pathlib import Path
        c=json.loads((Path(controller.__file__).parent/'prepared-control-policy.json').read_text());c['pressure']['bytes']+=1
        raw=json.dumps(c).encode()
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'policy.json';path.write_bytes(raw)
            with patch.object(controller.daemon,'load_config') as helper:
                with self.assertRaises(ValueError) as caught:controller.load_control(path,controller.hashlib.sha256(raw).hexdigest(),controller.digest(controller.__file__))
            self.assertEqual(controller.safe_control_reason(caught.exception),'fixed_readonly_archive_required');helper.assert_not_called()




    def test_readiness_budget_is_fixed_before_loading_helper(self):
        import tempfile
        from pathlib import Path
        c=json.loads((Path(controller.__file__).parent/'prepared-control-policy.json').read_text());c['controlReadySeconds']=600
        raw=json.dumps(c).encode()
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'policy.json';path.write_bytes(raw)
            with patch.object(controller.daemon,'load_config')as helper:
                with self.assertRaises(ValueError):controller.load_control(path,controller.hashlib.sha256(raw).hexdigest(),controller.digest(controller.__file__))
                helper.assert_not_called()

    def test_v4_writer_budgets_and_receipt_bound_are_explicit_before_helper_load(self):
        import tempfile
        from pathlib import Path
        for key,value in (('registrationSeconds',11),('prewriteAcceptanceSeconds',61),('prewriteSupervisionSeconds',66),('kernelWriteSeconds',61),('cleanupSeconds',11),('lifecycleSeconds',155),('receiptLimit',14),('censusLimit',36)):
            config=json.loads((Path(controller.__file__).parent/'prepared-control-policy.json').read_text());config['cachePreparation']['writerPolicy'][key]=value
            raw=json.dumps(config).encode()
            with tempfile.TemporaryDirectory() as directory:
                path=Path(directory)/'policy.json';path.write_bytes(raw)
                with patch.object(controller.daemon,'load_config') as helper:
                    with self.assertRaisesRegex(ValueError,'explicit_cache_preparation_required'):controller.load_control(path,controller.hashlib.sha256(raw).hexdigest(),controller.digest(controller.__file__))
                    helper.assert_not_called()

if __name__=='__main__':unittest.main()
