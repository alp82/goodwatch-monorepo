import contextlib
import hashlib
import io
import json
from pathlib import Path
import signal
import tempfile
import unittest
from unittest.mock import Mock, patch

import daemon
import pin


def config():
    root = daemon.ROOT
    return {'schema': 'mapped-data-pin-config.v1', 'source': {'mode': 'clone', 'container': 'gw-qdrant-cold-406-20261011', 'image': daemon.IMAGE,
        'store': str(root/'store'), 'mounts': [[str(root/'store'), '/qdrant/storage', 'bind', True], [str(root/'runtime-snapshots'), '/qdrant/snapshots', 'bind', True],
        [str(root/'rename-proof/media-20261011T041503Z.snapshot'), '/qdrant/snapshots/fixture.snapshot', 'bind', False]],
        'memoryBytes': 6*pin.GIB, 'swapBytes': 6*pin.GIB, 'cpuNanos': 2_000_000_000},
        'policy': {'maxLockedBytes': 2*pin.GIB, 'archiveBytes': 4428863488, 'reserveBytes': 2*pin.GIB, 'emergencyBytes': 3*pin.GIB//2, 'includePayload': False},
        'intervalSeconds': 2, 'lifetimeSeconds': 4, 'actions': ['measure', 'pin']}


def accounting():
    return {'availableBytes': 8*pin.GIB, 'cgroupMaxBytes': 6*pin.GIB, 'anonBytes': 1, 'fileBytes': 1, 'kernelBytes': 1, 'unevictableBytes': 0, 'currentBytes': 3,
        'memoryEvents': {'oom': 0, 'oom_kill': 0, 'max': 0}, 'cpu': {'nr_throttled': 0, 'throttled_usec': 0}}


def pin_state():
    return {'event': 'mapped-data-pin-state.v1', 'mode': 'clone', 'queries': 0, 'storageWrites': 0, 'lockedBytes': 16384, 'newLockBytes': 16384,
        'selectionHash': 'a'*64, 'extentRangesHashed': True, 'qdrantPid': 123, 'sourceStartTicks': 100, 'pageBytes': 4096, 'rangesChanged': True, 'deletedMappingsExcluded':0, 'memoryEventDelta':{'oom':0,'oom_kill':0,'max':0}, 'cpuLimitDelta':{'nr_throttled':0,'throttled_usec':0}, 'clonePressureMaxAllowed':False,
        'classesMeasured': {k: {'files': 1, 'dataLockBytes': 4096} for k in daemon.KINDS},
        'lockedResidency': {k: {'lockedDataPages': 1, 'residentLockedDataPages': 1} for k in ('vector', 'graph', 'sparse', 'other')},
        'accountingBefore': accounting(), 'accountingAfter': accounting(), 'private': 'private-source-path'}


class DaemonTests(unittest.TestCase):
    def frozen(self, value):
        temp = tempfile.TemporaryDirectory(); self.addCleanup(temp.cleanup); path = Path(temp.name)/'policy.json'
        raw = json.dumps(value).encode(); path.write_bytes(raw)
        return path, hashlib.sha256(raw).hexdigest(), daemon.code_hash()

    def test_default_has_no_inspection_or_pinset(self):
        with patch.object(daemon.runtime, 'inspect_source') as inspect, patch.object(daemon.pin, 'PinSet') as manager, contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(daemon.main([]), 0)
        inspect.assert_not_called(); manager.assert_not_called(); self.assertFalse(json.loads(out.getvalue())['inspection'])

    def test_frozen_config_rejects_hash_source_mount_and_unreviewed_payload(self):
        path, policy_hash, code_hash = self.frozen(config())
        self.assertEqual(daemon.load_config(path, policy_hash, code_hash)[1].mode, 'clone')
        with self.assertRaises(ValueError): daemon.load_config(path, '0'*64, code_hash)
        for mutate in (lambda c: c['source'].update(mode='production'), lambda c: c['source']['mounts'][2].__setitem__(0, '/private'),
                       lambda c: c['policy'].update(includePayload=True), lambda c: c.update(lifetimeSeconds=99999), lambda c: c['source'].update(swapBytes=12*pin.GIB)):
            value = config(); mutate(value); path, h, ch = self.frozen(value)
            with self.assertRaises(ValueError): daemon.load_config(path, h, ch)

    def test_measure_runner_never_prepares_self_or_creates_locks(self):
        _, spec, policy = daemon.load_config(*self.frozen(config()))
        m = {'event': 'mapped-data-measure-state.v1', 'mode':'clone','extentRangesHashed':True, 'lockedBytes': 0, 'queries': 0, 'storageWrites': 0, 'selectionHash': 'a'*64,
             'classesMeasured': {k: {'files': 1, 'dataPages': 1, 'residentDataPages': 1} for k in daemon.KINDS}, 'accounting': accounting(),
             'qdrantPid': 123, 'sourceStartTicks': 100, 'pageBytes': 4096, 'private': 'secret'}
        emitted = []; clock = Mock(side_effect=[0, 0, 4, 4])
        with patch.object(daemon.runtime, 'measure_source', return_value=m), patch.object(daemon.runtime, 'prepare_self') as prepare, patch.object(daemon.pin, 'PinSet') as manager:
            daemon.run(config(), spec, policy, 'measure', emitted.append, clock=clock, wait=Mock())
        prepare.assert_not_called(); manager.assert_not_called(); self.assertNotIn('private', emitted[0]); self.assertEqual(emitted[-1]['reason'], 'lifetime')

    def test_signal_releases_pins_and_restores_handlers_without_retries(self):
        _, spec, policy = daemon.load_config(*self.frozen(config())); manager = Mock(); captured = {}; emitted = []
        def install(sig, callback): captured[sig] = callback; return 'prior'
        def reconcile(*args): captured[signal.SIGTERM](signal.SIGTERM, None); return pin_state()
        with patch.object(daemon.signal, 'signal', side_effect=install), patch.object(daemon.pin, 'PinSet', return_value=manager), patch.object(daemon.runtime, 'reconcile_source', side_effect=reconcile):
            daemon.run(config(), spec, policy, 'pin', emitted.append, clock=Mock(side_effect=[0,0,1]), wait=Mock())
        manager.close.assert_called_once(); self.assertEqual(emitted[-1]['reason'], 'signal'); self.assertNotIn('private', emitted[0])
        self.assertEqual(captured[signal.SIGTERM], 'prior')

    def test_missing_numeric_proof_or_residency_cannot_emit_ready(self):
        value = pin_state(); del value['accountingAfter']['memoryEvents']['oom_kill']
        with self.assertRaises(KeyError): daemon.public_state(value)
        value = pin_state(); value['lockedResidency']['graph']['residentLockedDataPages'] = 0
        with self.assertRaises(ValueError): daemon.public_state(value)

    def test_failed_unmap_is_fatal_sanitized_not_retried(self):
        path, h, ch = self.frozen(config()); manager = Mock(); manager.close.side_effect = RuntimeError('private path failed munmap')
        def reconcile(*args): raise RuntimeError('private provider content')
        with patch.object(daemon.pin, 'PinSet', return_value=manager), patch.object(daemon.runtime, 'reconcile_source', side_effect=reconcile), contextlib.redirect_stdout(io.StringIO()) as out:
            code = daemon.main(['--config', str(path), '--policy-sha256', h, '--code-sha256', ch, '--action', 'pin'])
        self.assertEqual(code,1); manager.close.assert_called_once(); self.assertNotIn('private',out.getvalue()); self.assertEqual(json.loads(out.getvalue())['reason'],'guard_or_runtime_failure')

    def test_invalid_cli_omits_private_argument_and_no_traceback(self):
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
            self.assertEqual(daemon.main(['--private-query-payload-secret']), 1)
        self.assertEqual(err.getvalue(), '')
        self.assertNotIn('secret', out.getvalue())
        self.assertEqual(json.loads(out.getvalue())['reason'], 'invalid_cli_arguments')


if __name__ == '__main__': unittest.main()
