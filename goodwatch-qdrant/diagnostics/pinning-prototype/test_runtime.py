import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pin
import runtime
from test_pin import TrackingKernel, locked_bytes


class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name)
        self.store=self.root/'store';self.store.mkdir();self.proc=self.root/'proc';(self.proc/'900'/'root'/'qdrant').mkdir(parents=True)
        (self.proc/'900'/'root'/'qdrant'/'storage').symlink_to(self.store,target_is_directory=True)
        self.spec=runtime.Spec('clone','gw-qdrant-cold-406-20261011','sha256:'+'a'*64,self.store,frozenset(),6*pin.GIB,6*pin.GIB,2_000_000_000)
        self.source=runtime.Source(('container','image',900,100),900,self.root/'cgroup','/fixture',self.spec)
        self.addCleanup(patch.stopall);patch.object(runtime,'PROC',self.proc).start();patch.object(runtime,'inspect_source',return_value=self.source).start()
        self.nofile_patch=patch.object(runtime,'ensure_inventory_nofile',return_value={'openFdCount':4,'mappedFileBound':20000,'reserveFds':256,'requiredSoft':20260,'softBefore':1048576,'softAfter':1048576,'hardLimit':1048576,'raised':False,'hardChanged':False})
        self.nofile_patch.start()
        self.paths=[]
        for name in ('vector.bin','graph.bin','sparse.bin','id_tracker.bin','payload_index.bin'):
            path=self.store/name;path.write_bytes(b'data'.ljust(pin.PAGE,b'x'));self.paths.append(path)
        self.write_maps(self.paths)
        self.memory={'availableBytes':1024**3,'anonBytes':16384,'fileBytes':0,'kernelBytes':4096,'unevictableBytes':0,'currentBytes':20480,
                     'cgroupMaxBytes':1024**2,'memoryEvents':{'oom':0,'oom_kill':0,'max':0},'cpu':{'nr_throttled':0,'throttled_usec':0}}

    def write_maps(self,paths,deleted=None):
        rows=[]
        for index,path in enumerate(paths):
            info=path.stat();device=f'{os.major(info.st_dev):02x}:{os.minor(info.st_dev):02x}'
            rows.append(f'{index+1:04x}-{index+2:04x} r--s 00000000 {device} {info.st_ino} /qdrant/storage/{path.name}')
        if deleted is not None:rows.append(deleted+' (deleted)')
        (self.proc/'900'/'maps').write_text('\n'.join(rows)+'\n')
        return rows

    def manager(self):
        manager=pin.PinSet(pin.Policy('clone',16*pin.PAGE,0,16*pin.PAGE,8*pin.PAGE,cap_reserve_bytes=16*pin.PAGE,mapping_reserve_count=16),self.root/'pin.lock',TrackingKernel())
        self.addCleanup(manager.close);return manager

    def test_inventory_closes_measure_only_payload_fd_and_skips_deleted_mapping(self):
        rows=self.write_maps(self.paths);self.paths[0].unlink();self.write_maps(self.paths[1:],rows[0])
        result=runtime.inventory(self.source)
        self.assertEqual(result.deleted_mappings,1)
        payload=next(t for t in result.targets if t.kind=='payload');self.assertTrue(payload.measured_only);self.assertEqual(payload.fd,-1)
        for target in result.targets:target.close()

    def test_segment_replacement_retires_only_old_inode_without_unpinning_healthy_maps(self):
        manager=self.manager()
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory):
            first=runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
            old_rows=self.write_maps(self.paths);old_identity=self.paths[0].stat().st_ino;self.paths[0].unlink()
            replacement=self.store/'replacement_vector.bin';replacement.write_bytes(b'replacement'.ljust(pin.PAGE,b'x'))
            self.paths[0]=replacement;self.write_maps(self.paths,old_rows[0])
            old_healthy={key:mapping.address for key,mapping in manager.mappings.items() if key[1]!=old_identity}
            second=runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
        self.assertEqual(second['deletedMappingsExcluded'],1);self.assertNotEqual(first['selectionHash'],second['selectionHash'])
        for key,address in old_healthy.items():self.assertEqual(manager.mappings[key].address,address)
        self.assertFalse(any(key[1]==old_identity for key in manager.mappings))

    def test_source_restart_releases_old_pins_then_rechecks_helper_placement(self):
        manager=self.manager();placements=[]
        def prepare(source,budget,source_check=None):placements.append((source.identity,locked_bytes()))
        with patch.object(runtime,'prepare_self',side_effect=prepare),patch.object(runtime,'accounting',return_value=self.memory):
            runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
            previous=self.source.identity;self.source=runtime.Source(('new-container','image',900,200),900,self.root/'new-cgroup','/new-fixture',self.spec)
            runtime.inspect_source.return_value=self.source
            runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
        self.assertNotEqual(placements[0][0],placements[1][0]);self.assertEqual(placements[0][1],placements[1][1])
        self.assertNotEqual(previous,manager.source_identity)

    def test_missing_required_class_does_not_emit_ready_and_releases_prior_pins(self):
        manager=self.manager()
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory):
            runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source);self.write_maps(self.paths[:1])
            with self.assertRaises(RuntimeError):runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
        self.assertEqual(manager.mappings,{})

    def test_missing_limit_proof_metrics_never_defaults_to_zero_success(self):
        manager=self.manager();missing=dict(self.memory);missing['memoryEvents']={'oom':0,'max':0}
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=missing):
            with self.assertRaises(KeyError):runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
        self.assertEqual(manager.mappings,{})

    def test_identity_guard_preserved_when_runtime_cleanup_unmap_fails(self):
        manager=self.manager();baseline=locked_bytes()
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory):
            runtime.reconcile_source(manager,self.spec,source_check=lambda spec:self.source)
        held={key:(mapping.address,mapping.target.fd) for key,mapping in manager.mappings.items()}
        manager.kernel.fail_unmap=len(held)
        changed=runtime.Source(('changed','image',900,200),900,self.source.cgroup,self.source.cgroup_relative,self.spec)
        # Three source proofs: initial source, inventory before/after, then changed post-lock proof.
        checks=iter([self.source,self.source,self.source,changed])
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory):
            with self.assertRaises(RuntimeError) as caught:
                runtime.reconcile_source(manager,self.spec,source_check=lambda spec:next(checks))
        self.assertEqual(pin.safe_reason(caught.exception),'source_or_emergency_headroom_changed_after_locking')
        details=pin.failure_details(caught.exception)
        self.assertEqual(details['cleanupFailureReasons'],['guard_or_runtime_failure'])
        self.assertEqual(details['releaseState'],{'released':False,'heldMappingCount':4})
        self.assertEqual(held,{key:(mapping.address,mapping.target.fd) for key,mapping in manager.mappings.items()})
        self.assertGreater(locked_bytes(),baseline)
        manager.release();self.assertEqual(locked_bytes(),baseline)

    def test_measure_is_readonly_matches_pin_cohort_and_leaves_no_locks(self):
        baseline=locked_bytes()
        with patch.object(runtime,'prepare_self') as prepare,patch.object(runtime,'accounting',return_value=self.memory):
            measured=runtime.measure_source(self.spec)
            prepare.assert_not_called()
        self.assertEqual(locked_bytes(),baseline)
        self.assertEqual(measured['classesMeasured']['payload']['dataPages'],1)
        self.assertEqual(measured['lockedBytes'],0)
        # Payload remains measured but is not selected by the four-class pin rule.
        manager=self.manager()
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory):
            measured=runtime.measure_source(self.spec);pinned=runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
        self.assertEqual(measured['selectionHash'],pinned['selectionHash'])

    def test_pressure_max_exception_requires_steady_explicit_clone_window(self):
        for phase in ('initial','steady-default','steady-explicit','steady-oom','steady-throttle'):
            with self.subTest(phase=phase):
                manager=self.manager()
                with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory):
                    if phase!='initial':runtime.reconcile_source(manager,self.spec,source_check=runtime.inspect_source)
                after=dict(self.memory);after['memoryEvents']=dict(self.memory['memoryEvents']);after['memoryEvents']['max']=1
                after['cpu']=dict(self.memory['cpu'])
                if phase=='steady-oom':after['memoryEvents']['oom']=1
                if phase=='steady-throttle':after['cpu']['nr_throttled']=1
                with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',side_effect=[self.memory,after]):
                    if phase=='steady-explicit':
                        state=runtime.reconcile_source(manager,self.spec,allow_clone_pressure_max=True,source_check=runtime.inspect_source)
                        self.assertTrue(state['clonePressureMaxAllowed']);self.assertEqual(state['memoryEventDelta']['max'],1)
                    else:
                        with self.assertRaises(RuntimeError):runtime.reconcile_source(manager,self.spec,allow_clone_pressure_max=phase!='steady-default',source_check=runtime.inspect_source)
                        self.assertEqual(manager.mappings,{})
                manager.close()

    def test_capped_reconcile_uses_external_source_callback_without_docker(self):
        manager=self.manager()
        with patch.object(runtime,'prepare_self'),patch.object(runtime,'accounting',return_value=self.memory),patch.object(runtime,'docker',side_effect=AssertionError('unexpected capped subprocess')) as docker:
            state=runtime.reconcile_source(manager,self.spec,source_check=lambda spec:self.source)
        docker.assert_not_called();self.assertEqual(state['lockedBytes'],4*pin.PAGE)
        self.assertGreater(state['mappingBounds']['projectedAdditionalVmas'],0)

    def test_missing_external_inspector_refuses_before_setup(self):
        manager=self.manager()
        with patch.object(runtime,'prepare_self') as setup:
            with self.assertRaisesRegex(RuntimeError,'outside_source_inspector_required'):
                runtime.reconcile_source(manager,self.spec)
        setup.assert_not_called();self.assertEqual(manager.mappings,{})

    def test_raw_docker_stderr_is_suppressed_and_error_is_fixed(self):
        with patch.object(runtime.subprocess,'check_output',side_effect=runtime.subprocess.CalledProcessError(1,['docker'],stderr=b'private config')) as call:
            with self.assertRaisesRegex(RuntimeError,'^docker_inspection_failed$'):runtime.docker('inspect','fixture')
        self.assertEqual(call.call_args.kwargs['stderr'],runtime.subprocess.DEVNULL)
        self.assertEqual(call.call_args.args[0][0],'/usr/bin/docker')


if __name__=='__main__':unittest.main()
