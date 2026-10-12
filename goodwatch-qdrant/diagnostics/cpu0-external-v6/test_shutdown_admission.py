"""Shutdown-only resource boundary; real admission parser and caller composition.

Local fixed metadata seams do not attest a host or exercise a Qdrant signal.
"""
import json
import os
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest import mock
import admission
import packet
import setup

class ShutdownAdmissionTests(unittest.TestCase):
    def fixture(self,available=4549484544,swap=0,free=4*admission.GIB,allocated=None):
        if getattr(self,'active_scope',None) is not None:self.active_scope.close()
        scope=ExitStack();self.active_scope=scope;self.addCleanup(scope.close)
        folder=Path(scope.enter_context(tempfile.TemporaryDirectory()))
        meminfo=folder/'meminfo';meminfo.write_text(f'MemAvailable: {available//1024} kB\nSwapTotal: {swap//1024} kB\n')
        owned=folder/'owned';owned.mkdir(mode=0o700);(owned/'metadata').write_bytes(b'fixture')
        original_memory=admission.memory
        scope.enter_context(mock.patch.object(admission,'memory',side_effect=lambda:original_memory(meminfo)))
        scope.enter_context(mock.patch.object(admission,'allocated',return_value=(owned/'metadata').stat().st_blocks*512 if allocated is None else allocated))
        scope.enter_context(mock.patch.object(admission.shutil,'disk_usage',return_value=SimpleNamespace(free=free)))
        guards=mock.Mock();guards.host_cpu.return_value={'fixed':'cpu-admitted'}
        lifecycle=mock.Mock();lifecycle.attest.return_value={'state':{'fixed':'same-old-birth'}}
        scope.enter_context(mock.patch.object(admission,'old_hierarchy',return_value={'fixed':'old-cpu2-hierarchy'}))
        scope.enter_context(mock.patch.object(admission,'collection_shape',return_value={'clientClosed':True}))
        return scope,guards,lifecycle

    def test_actual_old_admission_accepts_shutdown_but_full_host_still_refuses(self):
        _,guards,lifecycle=self.fixture()
        proof=admission.old_admission(lifecycle,guards,mock.Mock())
        host=proof['host']
        self.assertEqual(host['schema'],'cpu0-old-shutdown-host-admission.v1')
        self.assertEqual(host['availableFloorBytes'],2*admission.GIB)
        self.assertEqual(host['MemAvailable'],4549484544)
        self.assertFalse(host['diagnosticComparisonAdmission'])
        self.assertEqual(host['target'],'old-owned-shutdown')
        with self.assertRaisesRegex(RuntimeError,'setup_host_admission_failed') as caught:
            admission.host(guards)
        self.assertEqual(caught.exception.setupHostEvidence['availableFloorBytes'],5*admission.GIB)

    def test_shutdown_requires_strictly_more_than_two_gib(self):
        for available in (2*admission.GIB,2*admission.GIB-1024):
            with self.subTest(available=available):
                _,guards,lifecycle=self.fixture(available=available)
                with self.assertRaisesRegex(RuntimeError,'setup_host_admission_failed'):
                    admission.old_admission(lifecycle,guards,mock.Mock())
                lifecycle.graceful_stop.assert_not_called()

    def test_every_nonmemory_host_guard_still_refuses_shutdown(self):
        for values in ({'swap':1024},{'free':3*admission.GIB},{'allocated':11*admission.GIB}):
            with self.subTest(values=values):
                _,guards,lifecycle=self.fixture(**values)
                with self.assertRaisesRegex(RuntimeError,'setup_host_admission_failed'):
                    admission.old_admission(lifecycle,guards,mock.Mock())
        _,guards,lifecycle=self.fixture();guards.host_cpu.side_effect=RuntimeError('host_cpu_pressure')
        with self.assertRaisesRegex(RuntimeError,'host_cpu_pressure'):
            admission.old_admission(lifecycle,guards,mock.Mock())

    def test_cpu_shape_and_birth_refusals_are_preserved(self):
        for boundary,reason in (('old_hierarchy','setup_old_ancestor_refused'),('collection_shape','setup_shape_changed')):
            with self.subTest(boundary=boundary):
                _,guards,lifecycle=self.fixture()
                with mock.patch.object(admission,boundary,side_effect=RuntimeError(reason)):
                    with self.assertRaisesRegex(RuntimeError,reason):admission.old_admission(lifecycle,guards,mock.Mock())
        _,guards,lifecycle=self.fixture();lifecycle.attest.side_effect=[{'birth':1},{'birth':2}]
        with self.assertRaisesRegex(RuntimeError,'setup_old_identity_changed'):
            admission.old_admission(lifecycle,guards,mock.Mock())

    def test_real_setup_shutdown_refusal_never_stages_creates_or_starts(self):
        _,guards,lifecycle=self.fixture()
        diagnostics=Path(__file__).resolve().parent.parent;source=diagnostics/'pinning-prototype'
        raw=(source/'cpu0-source-freeze.json').read_bytes();manifest=json.loads(raw)
        files={name:(source/name).read_bytes() for name in manifest['files']}
        derivative=setup.derivative_admission_policy(files['prepared-control-policy-cpu0.json'],packet.sha(files['prepared-control-policy-cpu0.json']))
        helper=(diagnostics/'clone-preparation'/'prepare_clone_reclaim.py').read_bytes()
        old={'State':{'Running':True}};lifecycle.container.return_value=old
        observed={'state':{'fixed':'same-old-birth'},'wrapper':{'pid':123,'parentPid':122},'qdrant':{'pid':124}}
        lifecycle.attest.return_value=observed;lifecycle.state_snapshot.return_value=observed['state']
        lifecycle.graceful_stop.side_effect=RuntimeError('lifecycle_stop_unclean')
        with tempfile.TemporaryFile() as lock, ExitStack() as scope:
            scope.enter_context(mock.patch.object(setup,'load_first_lifecycle',return_value=lifecycle))
            scope.enter_context(mock.patch.object(setup,'load_first_guards',return_value=guards))
            scope.enter_context(mock.patch.object(setup,'acquire_control',side_effect=lambda value:os.dup(lock.fileno())))
            scope.enter_context(mock.patch.object(setup,'Engine'))
            scope.enter_context(mock.patch.object(setup,'Docker'))
            scope.enter_context(mock.patch.object(setup.os.path,'lexists',return_value=False))
            scope.enter_context(mock.patch.object(setup.census,'immutable_prior_files'))
            scope.enter_context(mock.patch.object(setup.census,'prior_writers'))
            scope.enter_context(mock.patch.object(setup.census,'proc_controls'))
            scope.enter_context(mock.patch.object(setup,'read_owned',return_value=(helper,None)))
            stage=scope.enter_context(mock.patch.object(setup,'stage_absent'))
            create=scope.enter_context(mock.patch.object(setup,'create_owned_clone'))
            with self.assertRaisesRegex(RuntimeError,'lifecycle_stop_unclean') as caught:
                setup.run_setup(raw,packet.sha(raw),files,packet.sha(derivative),[],packet.sha(packet.canonical([])))
            stage.assert_not_called();create.assert_not_called()
            self.assertFalse(caught.exception.setupDurableStopEvidence['receiptObservedDurable'])
            self.assertEqual(lifecycle.graceful_stop.call_count,1)

if __name__=='__main__':unittest.main()
