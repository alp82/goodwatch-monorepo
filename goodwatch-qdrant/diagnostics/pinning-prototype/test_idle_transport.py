import tempfile
from pathlib import Path
import unittest

import idle_transport


class TransportTests(unittest.TestCase):
    def test_real_unprivileged_entry_returns_durable_refusal_without_source_inspection(self):
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            result = idle_transport.execute_fixture(operation)
            self.assertEqual(result['cliExitCode'], 3)
            self.assertTrue(result['cliExited'])
            self.assertEqual(result['helperResult']['outcome'], 'refused')
            self.assertEqual(result['helperResult']['reason'], 'idle_launcher_owned_context_required')
            self.assertFalse(result['helperResult']['journalCreated'])
            self.assertTrue(result['authoritativeReceiptVerified'])
            self.assertTrue(result['unknownEarlyChildrenPossible'])
            self.assertTrue((operation / 'records' / 'outer-result.json').is_file())

    def test_rebound_core_mutation_is_rejected_before_cli_birth(self):
        import json
        import os
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            path = operation / 'code' / 'pin.py'
            os.chmod(path, 0o600)
            path.write_bytes(path.read_bytes() + b'\n# changed\n')
            os.chmod(path, 0o400)
            manifest_path = operation / 'manifest.json'
            manifest = json.loads(manifest_path.read_bytes())
            manifest['codeRows']['pin.py'] = idle_transport.row(path.read_bytes())
            manifest_path.write_bytes(idle_transport.encoded(manifest))
            with self.assertRaisesRegex(ValueError, 'transport_stage_changed'):
                idle_transport.execute_fixture(operation)
            self.assertEqual(list((operation / 'records').iterdir()), [])

    def test_production_rejects_unprivileged_fixture_without_spawning(self):
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            with self.assertRaisesRegex(ValueError, 'transport_production_not_reviewed'):
                idle_transport.execute_production(operation)
            self.assertEqual(list((operation / 'records').iterdir()), [])

    def test_rebound_standin_entry_is_rejected_before_cli_birth(self):
        import json
        import os
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            path = operation / 'entry' / 'idle_entry.py'
            os.chmod(path, 0o600)
            path.write_bytes(b'raise SystemExit(0)\n')
            os.chmod(path, 0o400)
            manifest_path = operation / 'manifest.json'
            manifest = json.loads(manifest_path.read_bytes())
            manifest['entrySha256'] = idle_transport.digest(path.read_bytes())
            manifest_path.write_bytes(idle_transport.encoded(manifest))
            with self.assertRaisesRegex(ValueError, 'transport_entry_not_reviewed'):
                idle_transport.execute_fixture(operation)
            self.assertEqual(list((operation / 'records').iterdir()), [])

    def test_outer_does_not_wait_for_descendant_stdout_eof(self):
        import json
        import os
        import time
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, bound = idle_transport.verify_fixture(operation)
            # Deliberately manifest-rejected stand-in, only the private OS seam.
            body = """import json,os,sys,time
from pathlib import Path
fd=int(sys.argv[2])
ticks=int(Path('/proc',str(os.getpid()),'stat').read_text().rsplit(')',1)[1].split()[19])
os.write(fd,(json.dumps({'phase':'ready','pid':os.getpid(),'startTicks':ticks})+'\\n').encode())
os.read(fd,128)
os.close(fd)
if os.fork()==0:
    time.sleep(1)
    os._exit(0)
os._exit(0)
"""
            path = operation / 'entry' / 'idle_entry.py'
            os.chmod(path, 0o600)
            path.write_text(body)
            os.chmod(path, 0o400)
            started = time.monotonic()
            result = idle_transport._execute(operation, manifest, bound)
            elapsed = time.monotonic() - started
            self.assertTrue(result['cliExited'])
            self.assertEqual(result['cliExitCode'], 0)
            self.assertFalse(result['authoritativeReceiptVerified'])
            self.assertTrue(result['holderExitUnknown'])
            self.assertLess(elapsed, 0.8)
            # The fixture's descendant is finite; no outer descendant signalling.
            time.sleep(max(0, 1.1 - elapsed))

    def test_ignored_sigchld_is_refused_before_owned_fork(self):
        import signal
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            previous = signal.signal(signal.SIGCHLD, signal.SIG_IGN)
            try:
                with self.assertRaisesRegex(ValueError, 'transport_child_reaping_required'):
                    idle_transport.execute_fixture(operation)
            finally:
                signal.signal(signal.SIGCHLD, previous)
            self.assertEqual(list((operation / 'records').iterdir()), [])

    def test_actual_owned_writer_receipt_is_verified_and_extended_tail_rejected(self):
        import hashlib
        import idle_launcher
        import idle_trial
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            journal = operation / 'records' / 'inner.jsonl'
            def refuse():
                raise RuntimeError('idle_guard_failure')
            result = idle_launcher._invoke({}, {}, 'unused', manifest['inputHashes']['policy.json'],
                lambda: None, idle_trial.code_hash(), journal,
                binding={'packetSha256': manifest['packetSha256'],
                         'sourceContractSha256': manifest['inputHashes']['source.json']},
                preflight=refuse)
            self.assertTrue(result['writerReleased'])
            self.assertTrue(result['registeredHoldersExited'])
            idle_transport.verify_helper_result(result, manifest, journal)
            with journal.open('ab') as stream:
                stream.write(b' ')
            with self.assertRaisesRegex(ValueError, 'transport_journal_invalid'):
                idle_transport.verify_helper_result(result, manifest, journal)

    def test_standing_receipt_not_live_inspection_selects_source_identity(self):
        import json
        inputs = {name: idle_transport.encoded({}) for name in idle_transport.INPUT_FILES}
        hashes = {name: idle_transport.digest(raw) for name, raw in inputs.items()}
        source = {'pid': 34567, 'startTicks': 987654, 'identitySha256': 'a' * 64}
        standing = {'schema': 'qdrant.idle-standing-inputs.v1', 'source': source,
            'sourceContractSha256': hashes['source.json'],
            'scheduler': {'singleKnownRootTable': True,
                'scheduleFileSha256': hashes['schedule.json'],
                'scheduleCanonicalSha256': idle_transport.digest(b'{}')},
            'resource': {'complete': True, 'eligible': True, 'proofSha256': 'b' * 64},
            'kernel': {'cgroupSha256': 'c' * 64, 'memoryMax': 'max', 'memoryHigh': 'max',
                       'cpuMax': 'max 100000', 'oomGroup': 0, 'swapCurrent': 0}}
        inputs['standing.json'] = idle_transport.encoded(standing)
        with tempfile.TemporaryDirectory() as tmp:
            operation = Path(tmp) / 'operation'
            idle_transport._stage_bound(operation, inputs, kind='reviewed-preparation')
            manifest = json.loads((operation / 'manifest.json').read_bytes())
            self.assertEqual(manifest['source'], source)
            self.assertEqual(manifest['inputHashes']['standing.json'], idle_transport.digest(inputs['standing.json']))
            with self.assertRaisesRegex(ValueError, 'transport_production_not_reviewed'):
                idle_transport.execute_production(operation)
            self.assertEqual(list((operation / 'records').iterdir()), [])

    def test_ready_entry_eof_and_wrong_manifest_go_never_invoke_api(self):
        import json
        import socket
        import subprocess
        import sys
        for payload in (None, b'0' * 64 + b'\n'):
            with self.subTest(payload=payload), tempfile.TemporaryDirectory() as tmp:
                operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
                parent, child = socket.socketpair()
                process = subprocess.Popen([sys.executable, '-I', '-B', '-S',
                    str(operation / 'entry' / 'idle_entry.py'), str(operation), str(child.fileno())],
                    pass_fds=(child.fileno(),), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                child.close()
                try:
                    parent.settimeout(5)
                    ready = json.loads(parent.recv(1024))
                    self.assertEqual(ready['pid'], process.pid)
                    if payload is not None:
                        parent.sendall(payload)
                    parent.close()
                    self.assertEqual(process.wait(timeout=5), 4)
                    self.assertEqual(list((operation / 'records').iterdir()), [])
                finally:
                    parent.close()
                    if process.poll() is None:
                        process.kill()
                    process.wait(timeout=5)

    def test_entry_uses_os_exit_despite_unreaped_owned_fixture_child(self):
        import json
        import os
        import time
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            path = operation / 'entry' / 'idle_entry.py'
            body = path.read_text().replace("    durable(operation / 'records' / 'entry-result.json', receipt)",
                "    import multiprocessing\n    multiprocessing.get_context('fork').Process(target=time.sleep, args=(1,)).start()\n    durable(operation / 'records' / 'entry-result.json', receipt)")
            os.chmod(path, 0o600); path.write_text(body); os.chmod(path, 0o400)
            manifest['entrySha256'] = idle_transport.digest(path.read_bytes())
            raw = idle_transport.encoded(manifest)
            (operation / 'manifest.json').write_bytes(raw)
            # Private stand-in boundary: public verify rejects these changed bytes.
            with self.assertRaisesRegex(ValueError, 'transport_entry_not_reviewed'):
                idle_transport.execute_fixture(operation)
            started = time.monotonic()
            result = idle_transport._execute(operation, manifest, idle_transport.digest(raw))
            elapsed = time.monotonic() - started
            self.assertEqual(result['cliExitCode'], 3)
            self.assertTrue(result['authoritativeReceiptVerified'])
            self.assertLess(elapsed, 0.8)
            time.sleep(max(0, 1.1 - elapsed))

    def test_inactive_root_api_refuses_real_unprivileged_caller_before_source_reads(self):
        with self.assertRaisesRegex(ValueError, 'transport_stage_root_required'):
            idle_transport.run_reviewed_stage(Path('/nonexistent/no-source-read'))

    def test_metadata_kernel_fence_rejects_capped_ancestor_and_identity_turnover(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            proc = root / 'proc'
            groups = root / 'groups'
            pid = 34567
            (proc / str(pid)).mkdir(parents=True)
            (proc / 'self').mkdir()
            raw_stat = str(pid) + ' (qdrant) ' + ' '.join(['S'] + ['0'] * 18 + ['99'])
            (proc / str(pid) / 'stat').write_text(raw_stat)
            (proc / str(pid) / 'cgroup').write_text('0::/parent/qdrant\n')
            (proc / 'self' / 'cgroup').write_text('0::/outer\n')
            target = groups / 'parent' / 'qdrant'
            target.mkdir(parents=True)
            for directory in (groups / 'parent', target):
                for name, value in (('memory.max', 'max'), ('memory.high', 'max'), ('cpu.max', 'max 100000')):
                    (directory / name).write_text(value)
            (target / 'memory.oom.group').write_text('0')
            (target / 'memory.swap.current').write_text('0')
            node = groups.stat()
            (proc / 'self' / 'mountinfo').write_text(f'123 1 {os.major(node.st_dev)}:{os.minor(node.st_dev)} / {groups} rw - cgroup2 cgroup rw\n')
            manifest = {'source': {'pid': pid, 'startTicks': 99},
                'kernel': {'cgroupSha256': idle_transport.digest(b'/parent/qdrant')}}
            proof = idle_transport.kernel_fence(manifest, proc, groups, root_owner_uid=os.geteuid())
            self.assertTrue(proof['outsideSource'])
            self.assertEqual(proof['hierarchyRoot']['controllerLimits'], 'not-applicable')
            self.assertFalse((groups / 'cpu.max').exists())
            (target / 'memory.high').unlink()
            with self.assertRaisesRegex(ValueError, 'transport_source_fence_failed'):
                idle_transport.kernel_fence(manifest, proc, groups, root_owner_uid=os.geteuid())
            (target / 'memory.high').write_text('max')
            (groups / 'parent' / 'memory.high').write_text('1024')
            with self.assertRaisesRegex(ValueError, 'transport_source_fence_failed'):
                idle_transport.kernel_fence(manifest, proc, groups, root_owner_uid=os.geteuid())
            (groups / 'parent' / 'memory.high').write_text('max')
            (proc / str(pid) / 'stat').write_text(raw_stat.replace(' 99', ' 100'))
            with self.assertRaisesRegex(ValueError, 'transport_source_fence_failed'):
                idle_transport.kernel_fence(manifest, proc, groups, root_owner_uid=os.geteuid())

    def test_real_journaled_refusal_through_manifest_rejected_standin(self):
        import json
        import os
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            path = operation / 'entry' / 'idle_entry.py'
            body = path.read_text()
            start = body.index('    result = idle_launcher.run_reviewed(')
            end = body.index('    receipt = ', start)
            body = body[:start] + """    def refuse():
        raise RuntimeError('idle_guard_failure')
    result = idle_launcher._invoke({}, {}, 'unused', manifest['inputHashes']['policy.json'],
        lambda: None, manifest['coreSha256'], operation / 'records' / 'inner.jsonl',
        binding={'packetSha256':manifest['packetSha256'],
                 'sourceContractSha256':manifest['inputHashes']['source.json']},
        preflight=refuse)
""" + body[end:]
            os.chmod(path, 0o600); path.write_text(body); os.chmod(path, 0o400)
            manifest['entrySha256'] = idle_transport.digest(path.read_bytes())
            raw = idle_transport.encoded(manifest)
            (operation / 'manifest.json').write_bytes(raw)
            with self.assertRaisesRegex(ValueError, 'transport_entry_not_reviewed'):
                idle_transport.execute_fixture(operation)
            result = idle_transport._execute(operation, manifest, idle_transport.digest(raw))
            self.assertTrue(result['authoritativeReceiptVerified'])
            self.assertTrue(result['birthCommitted'])
            self.assertEqual(result['cliExitCode'], 3)
            self.assertEqual(result['helperResult']['phase'], 'complete')
            self.assertTrue(result['helperResult']['registeredHoldersExited'])
            self.assertTrue(result['helperResult']['writerGraceful'])

    def test_outer_death_midrun_kills_only_its_owned_cli_by_parent_death(self):
        import json
        import os
        import select
        import signal
        import subprocess
        import sys
        import time
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            # Stand-in's finite lifetime avoids any unowned surviving test process.
            body = """import json,os,sys,time
from pathlib import Path
fd=int(sys.argv[2])
ticks=int(Path('/proc',str(os.getpid()),'stat').read_text().rsplit(')',1)[1].split()[19])
os.write(fd,(json.dumps({'phase':'ready','pid':os.getpid(),'startTicks':ticks})+'\\n').encode())
os.read(fd,128)
os.close(fd)
time.sleep(5)
os._exit(0)
"""
            entry = operation / 'entry' / 'idle_entry.py'
            os.chmod(entry, 0o600); entry.write_text(body); os.chmod(entry, 0o400)
            runner = Path(tmp) / 'runner.py'
            runner.write_text('import sys,json\nfrom pathlib import Path\nsys.path.insert(0,'
                + repr(str(Path(idle_transport.__file__).parent)) + ')\nimport idle_transport\np=Path(sys.argv[1])\nraw=(p/"manifest.json").read_bytes()\nidle_transport._execute(p,json.loads(raw),idle_transport.digest(raw))\n')
            outer = subprocess.Popen([sys.executable, '-I', '-B', '-S', str(runner), str(operation)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            holder = None
            try:
                deadline = time.monotonic() + 5
                birth_path = operation / 'records' / 'cli-birth.json'
                while not birth_path.exists() and time.monotonic() < deadline:
                    time.sleep(0.01)
                birth = json.loads(birth_path.read_bytes())
                holder = os.pidfd_open(birth['pid'])
                self.assertFalse(select.select([holder], [], [], 0)[0])
                outer.kill(); outer.wait(timeout=5)
                self.assertTrue(select.select([holder], [], [], 2)[0])
                self.assertFalse((operation / 'records' / 'entry-result.json').exists())
            finally:
                if outer.poll() is None:
                    outer.kill()
                outer.wait(timeout=5)
                if holder is not None:
                    os.close(holder)

    def test_receipt_failure_forces_os_exit_with_unreaped_multiprocessing_child(self):
        import json
        import os
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            path = operation / 'entry' / 'idle_entry.py'
            body = path.read_text().replace("    durable(operation / 'records' / 'entry-result.json', receipt)",
                "    import multiprocessing\n    multiprocessing.get_context('fork').Process(target=time.sleep, args=(1,)).start()\n    (operation / 'records' / 'entry-result.json').write_text('{}')\n    durable(operation / 'records' / 'entry-result.json', receipt)")
            os.chmod(path, 0o600); path.write_text(body); os.chmod(path, 0o400)
            manifest['entrySha256'] = idle_transport.digest(path.read_bytes())
            raw = idle_transport.encoded(manifest)
            (operation / 'manifest.json').write_bytes(raw)
            result = idle_transport._execute(operation, manifest, idle_transport.digest(raw))
            self.assertEqual(result['cliExitCode'], 5)
            self.assertFalse(result['authoritativeReceiptVerified'])
            self.assertTrue(result['holderExitUnknown'])

    def test_root_preparation_still_refuses_even_with_successful_checks(self):
        from unittest.mock import patch
        with patch.object(idle_transport.os, 'geteuid', return_value=0), \
             patch.object(idle_transport, '_verify_stage', return_value=({}, 'a' * 64)), \
             patch.object(idle_transport, 'kernel_fence', return_value={}), \
             patch.object(idle_transport, 'inspect_runtime', return_value={}), \
             patch.object(idle_transport.os, 'fork', side_effect=AssertionError('must not fork')):
            with self.assertRaisesRegex(ValueError, 'transport_production_not_reviewed'):
                idle_transport.run_reviewed_stage(Path('/unused'), expected_operation_sha256='a' * 64)

    def test_wrong_expected_operation_identity_refuses_with_empty_records(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, bound = idle_transport.verify_fixture(operation)
            with patch.object(idle_transport.os, 'geteuid', return_value=0), \
                 patch.object(idle_transport, '_verify_stage', return_value=(manifest, bound)), \
                 patch.object(idle_transport.os, 'fork', side_effect=AssertionError('must not fork')):
                with self.assertRaisesRegex(ValueError, 'transport_operation_changed'):
                    idle_transport.run_reviewed_stage(operation, expected_operation_sha256='f' * 64)
            self.assertEqual(list((operation / 'records').iterdir()), [])

    def test_inner_schedule_must_match_bound_canonical_schedule(self):
        from datetime import datetime, timezone
        import idle_journal
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            path = operation / 'records' / 'inner.jsonl'
            writer = idle_journal.Journal(path, manifest['coreSha256'], manifest['inputHashes']['policy.json'])
            try:
                writer.bind({'packetSha256': manifest['packetSha256'], 'sourceContractSha256': manifest['inputHashes']['source.json']})
                frame = {'event': 'qdrant.idle-lock-trial.v1', 'policyBasis': 'idle-2g-floor-6g-transient.v1',
                    'codeSha256': manifest['coreSha256'], 'policySha256': manifest['inputHashes']['policy.json'],
                    'scheduleSha256': 'c' * 64, 'at': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'queries': 0, 'storageWrites': 0, 'phase': 'baseline_start'}
                writer.emit(frame)
                writer.emit({**frame, 'scheduleSha256': None, 'phase': 'complete', 'outcome': 'refused'})
                receipt = dict(writer.last_receipt)
            finally:
                proof = writer.close()
            result = {'event': 'qdrant.idle-launcher.v1', 'phase': 'complete', 'outcome': 'refused', 'reason': None,
                'queries': 0, 'storageWrites': 0, 'packetSha256': manifest['packetSha256'],
                'sourceContractSha256': manifest['inputHashes']['source.json'], 'terminalReceipt': receipt,
                'writerReleased': proof['released'], 'writerGraceful': proof['gracefulReleaseAcknowledged'],
                'writerExitCode': proof['exitCode'], 'registeredHoldersExited': True}
            with self.assertRaisesRegex(ValueError, 'transport_journal_invalid'):
                idle_transport.verify_helper_result(result, manifest, path)

    def test_pidfd_acquisition_failure_retains_unknown_receipt_without_numeric_signals(self):
        from unittest.mock import patch
        import errno
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            with patch.object(idle_transport.os, 'pidfd_open', side_effect=OSError(errno.EIO, 'fixture')), \
                 patch.object(idle_transport.signal, 'pidfd_send_signal', side_effect=AssertionError('unowned signal')):
                result = idle_transport.execute_fixture(operation)
            self.assertFalse(result['birthCommitted'])
            self.assertFalse(result['authoritativeReceiptVerified'])
            self.assertTrue(result['holderExitUnknown'])
            self.assertTrue(result['unknownEarlyChildrenPossible'])
            self.assertEqual(result['reason'], 'transport_pidfd_acquisition_failed')
            self.assertTrue((operation / 'records' / 'outer-result.json').is_file())
            self.assertFalse((operation / 'records' / 'inner.jsonl').exists())
            self.assertFalse((operation / 'records' / 'entry-result.json').exists())
            self.assertFalse((operation / 'records' / 'cli-birth.json').exists())
            if result['cliExited']:
                self.assertEqual(result['cliExitCode'], 5)

    def _standin(self, operation, after_go):
        import os
        entry = operation / 'entry' / 'idle_entry.py'
        body = """import json,os,signal,sys,time
from pathlib import Path
fd=int(sys.argv[2])
ticks=int(Path('/proc',str(os.getpid()),'stat').read_text().rsplit(')',1)[1].split()[19])
os.write(fd,(json.dumps({'phase':'ready','pid':os.getpid(),'startTicks':ticks})+'\\n').encode())
os.read(fd,128)
os.close(fd)
""" + after_go
        os.chmod(entry, 0o600); entry.write_text(body); os.chmod(entry, 0o400)

    def test_outer_deadline_uses_only_owned_pidfd_term_then_kill(self):
        import signal
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, bound = idle_transport.verify_fixture(operation)
            self._standin(operation, "signal.signal(signal.SIGTERM,signal.SIG_IGN)\ntime.sleep(5)\nos._exit(0)\n")
            actual = idle_transport.signal.pidfd_send_signal
            observed = []
            def send(fd, chosen):
                observed.append(chosen)
                return actual(fd, chosen)
            with patch.object(idle_transport.signal, 'pidfd_send_signal', side_effect=send):
                result = idle_transport._execute(operation, manifest, bound, outer_seconds=.25, release_seconds=.05)
            self.assertEqual(observed, [signal.SIGTERM, signal.SIGKILL])
            self.assertTrue(result['cliExited'])
            self.assertEqual(result['cliExitCode'], -signal.SIGKILL)
            self.assertEqual(result['reason'], 'transport_outer_deadline')
            self.assertFalse(result['authoritativeReceiptVerified'])

    def test_foreign_runtime_lock_is_stat_only_and_kept_intact(self):
        import fcntl
        import os
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'runtime'; root.mkdir(mode=0o700)
            lock = root / 'supervisor.lock'; lock.write_bytes(b'foreign'); lock.chmod(0o600)
            with lock.open('rb') as held:
                fcntl.flock(held, fcntl.LOCK_EX | fcntl.LOCK_NB)
                before = lock.stat()
                with patch.object(idle_transport.os, 'open', side_effect=AssertionError('must not open')), \
                     patch.object(fcntl, 'flock', side_effect=AssertionError('must not flock')):
                    result = idle_transport._inspect_runtime(root, os.geteuid())
                self.assertEqual(result['lock']['inode'], before.st_ino)
                self.assertEqual(lock.read_bytes(), b'foreign')
                self.assertEqual(lock.stat().st_ino, before.st_ino)

    def test_inherited_signal_mask_and_dispositions_are_normalized(self):
        import json
        import signal
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, bound = idle_transport.verify_fixture(operation)
            self._standin(operation, "mask=signal.pthread_sigmask(signal.SIG_BLOCK,set())\nrow={'alarmDefault':signal.getsignal(signal.SIGALRM)==signal.SIG_DFL,'termDefault':signal.getsignal(signal.SIGTERM)==signal.SIG_DFL,'maskEmpty':not mask,'gateFixed':fd==3,'timerEmpty':signal.getitimer(signal.ITIMER_REAL)==(0.0,0.0)}\nPath(sys.argv[1],'records','signals.json').write_text(json.dumps(row))\nos._exit(0)\n")
            old = signal.signal(signal.SIGALRM, signal.SIG_IGN)
            mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM, signal.SIGALRM})
            try:
                result = idle_transport._execute(operation, manifest, bound)
            finally:
                signal.signal(signal.SIGALRM, old)
                signal.pthread_sigmask(signal.SIG_SETMASK, mask)
            self.assertEqual(result['cliExitCode'], 0)
            self.assertEqual(json.loads((operation / 'records' / 'signals.json').read_bytes()),
                {'alarmDefault': True, 'termDefault': True, 'maskEmpty': True, 'gateFixed': True, 'timerEmpty': True})

    def test_cli_own_alarm_is_unproven_not_false_journal_absence(self):
        import signal
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, bound = idle_transport.verify_fixture(operation)
            self._standin(operation, "signal.setitimer(signal.ITIMER_REAL,.1)\ntime.sleep(5)\n")
            result = idle_transport._execute(operation, manifest, bound)
            self.assertEqual(result['cliExitCode'], -signal.SIGALRM)
            self.assertFalse(result['authoritativeReceiptVerified'])
            self.assertIsNone(result['helperResult'])
            self.assertTrue(result['holderExitUnknown'])

    def test_pipe_overflow_is_drained_and_outer_creates_only_one_process(self):
        import os
        import subprocess
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, bound = idle_transport.verify_fixture(operation)
            self._standin(operation, "data=b'x'*65536\nfor i in range(16):\n    os.write(1,data)\nos._exit(0)\n")
            actual = os.fork
            counts = []
            def fork():
                counts.append(1)
                return actual()
            with patch.object(idle_transport.os, 'fork', side_effect=fork), \
                 patch.object(subprocess, 'Popen', side_effect=AssertionError('extra subprocess')):
                result = idle_transport._execute(operation, manifest, bound)
            self.assertEqual(len(counts), 1)
            self.assertEqual(result['cliExitCode'], 0)
            self.assertTrue(result['captureOverflow'])
            self.assertEqual(result['stdoutBytes'], 1048576)

    def _journal_fixture(self, operation):
        import idle_launcher
        manifest, _ = idle_transport.verify_fixture(operation)
        def refuse():
            raise RuntimeError('idle_guard_failure')
        path = operation / 'records' / 'inner.jsonl'
        result = idle_launcher._invoke({}, {}, 'unused', manifest['inputHashes']['policy.json'],
            lambda: None, manifest['coreSha256'], path,
            binding={'packetSha256': manifest['packetSha256'], 'sourceContractSha256': manifest['inputHashes']['source.json']},
            preflight=refuse)
        return manifest, path, result

    def test_journal_binding_sequence_terminal_hash_and_torn_tail_refuse(self):
        import copy
        import json
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, path, result = self._journal_fixture(operation)
            original = path.read_bytes()
            records = [json.loads(line) for line in original.splitlines()]
            binding = copy.deepcopy(records); binding[0]['data']['packetSha256'] = 'f' * 64
            sequence = copy.deepcopy(records); sequence[-1]['sequence'] += 1
            for changed in (original[:-1], b''.join(idle_transport.encoded(row) for row in binding),
                            b''.join(idle_transport.encoded(row) for row in sequence)):
                path.write_bytes(changed)
                with self.assertRaisesRegex(ValueError, 'transport_journal_invalid'):
                    idle_transport.verify_helper_result(result, manifest, path)
            path.write_bytes(original)
            forged = copy.deepcopy(result); forged['terminalReceipt']['recordSha256'] = 'f' * 64
            with self.assertRaisesRegex(ValueError, 'transport_journal_invalid'):
                idle_transport.verify_helper_result(forged, manifest, path)

    def test_consumed_stage_is_not_retried(self):
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            first = idle_transport.execute_fixture(operation)
            saved = (operation / 'records' / 'outer-result.json').read_bytes()
            with self.assertRaisesRegex(ValueError, 'transport_stage_invalid'):
                idle_transport.execute_fixture(operation)
            self.assertEqual((operation / 'records' / 'outer-result.json').read_bytes(), saved)
            self.assertTrue(first['cliExited'])

    def test_entry_checks_changed_code_and_unknown_filename_after_outer_bypass(self):
        import hashlib
        import json
        import os
        import socket
        import subprocess
        import sys
        for mutation in ('changed-code', 'hardlink', 'unknown-file', 'pycache', 'manifest-schema', 'manifest-kind'):
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as tmp:
                operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
                if mutation == 'changed-code':
                    path = operation / 'code' / 'pin.py'; os.chmod(path, 0o600)
                    path.write_bytes(path.read_bytes() + b'\n# changed\n'); os.chmod(path, 0o400)
                elif mutation == 'hardlink':
                    os.link(operation / 'code' / 'pin.py', Path(tmp) / 'alias')
                elif mutation == 'unknown-file':
                    (operation / 'code' / 'unknown.py').write_text('')
                elif mutation == 'pycache':
                    (operation / 'code' / '__pycache__').mkdir()
                else:
                    metadata = json.loads((operation / 'manifest.json').read_bytes())
                    metadata['schema' if mutation == 'manifest-schema' else 'kind'] = 'unknown'
                    (operation / 'manifest.json').write_bytes(idle_transport.encoded(metadata))
                raw = (operation / 'manifest.json').read_bytes()
                parent, child = socket.socketpair()
                cli = subprocess.Popen([sys.executable, '-I', '-B', '-S', str(operation / 'entry' / 'idle_entry.py'),
                    str(operation), str(child.fileno())], pass_fds=(child.fileno(),),
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                child.close()
                try:
                    parent.settimeout(5); json.loads(parent.recv(1024))
                    parent.sendall(hashlib.sha256(raw).hexdigest().encode() + b'\n'); parent.close()
                    self.assertEqual(cli.wait(timeout=5), 5)
                    self.assertEqual(list((operation / 'records').iterdir()), [])
                finally:
                    parent.close()
                    if cli.poll() is None: cli.kill()
                    cli.wait(timeout=5)

    def test_manifest_cannot_claim_current_observation_is_eligible(self):
        import json
        inputs = {name: idle_transport.encoded({}) for name in idle_transport.INPUT_FILES}
        standing = {'schema': 'qdrant.idle-standing-inputs.v1',
            'source': {'pid': 12345, 'startTicks': 99, 'identitySha256': 'a' * 64},
            'sourceContractSha256': idle_transport.digest(inputs['source.json']),
            'scheduler': {'singleKnownRootTable': True,
                'scheduleFileSha256': idle_transport.digest(inputs['schedule.json']),
                'scheduleCanonicalSha256': idle_transport.digest(b'{}')},
            'resource': {'complete': True, 'eligible': False, 'proofSha256': 'b' * 64},
            'kernel': {'cgroupSha256': 'c' * 64, 'memoryMax': 'max', 'memoryHigh': 'max',
                       'cpuMax': 'max 100000', 'oomGroup': 0, 'swapCurrent': 0}}
        inputs['standing.json'] = idle_transport.encoded(standing)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'operation'
            with self.assertRaisesRegex(ValueError, 'transport_standing_invalid'):
                idle_transport._stage_bound(path, inputs, 'reviewed-preparation')
            self.assertFalse(path.exists())

    def test_caller_expected_packet_identity_is_not_derived_from_changed_disk(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            operation = Path(tmp) / 'operation'
            inputs = {name: idle_transport.encoded({}) for name in idle_transport.INPUT_FILES}
            baseline = idle_transport.stage_fixture(Path(tmp) / 'baseline')
            manifest, _ = idle_transport.verify_fixture(baseline)
            expected = {key: manifest[key] for key in ('packetSha256', 'coreSha256', 'entrySha256', 'interpreter')}
            # Private local metadata adapter only: public reviewed staging stays root-only.
            with patch.object(idle_transport, 'read_owned', side_effect=lambda path, *_args: path.read_bytes()):
                with self.assertRaisesRegex(ValueError, 'transport_expected_code_changed'):
                    idle_transport._stage_bound(operation, inputs, 'unprivileged-refusal-fixture',
                        expected_identities={**expected, 'packetSha256': 'f' * 64})
            with patch.object(idle_transport, 'read_owned', side_effect=lambda path, *_args: path.read_bytes()):
                positive = idle_transport._stage_bound(Path(tmp) / 'positive', inputs, 'unprivileged-refusal-fixture', expected_identities=expected)
            self.assertEqual(idle_transport.verify_fixture(positive)[0]['packetSha256'], expected['packetSha256'])
            self.assertFalse((operation / 'manifest.json').exists())
            self.assertEqual(list((operation / 'records').iterdir()), [])
            # Partial stage remains consumed; there is no unproved rollback.
            with self.assertRaises(FileExistsError):
                idle_transport.stage_fixture(operation)

    def test_forged_holder_birth_never_grants_outer_signal_authority(self):
        import json
        import os
        import subprocess
        import sys
        from unittest.mock import patch
        decoy = subprocess.Popen([sys.executable, '-I', '-B', '-S', '-c', 'import time;time.sleep(5)'])
        try:
            with tempfile.TemporaryDirectory() as tmp:
                operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
                manifest, path, helper = self._journal_fixture(operation)
                records = [json.loads(line) for line in path.read_bytes().splitlines()]
                birth = {**records[0], 'sequence': 2, 'kind': 'birth', 'data': {'phase': 'holder_started',
                    'holderPid': decoy.pid, 'holderStartTicks': idle_transport.ticks(decoy.pid), 'pidfdOwned': True}}
                records[-1]['sequence'] = 3
                raw = b''.join(idle_transport.encoded(record) for record in (records[0], birth, records[-1]))
                path.write_bytes(raw)
                helper['terminalReceipt']['sequence'] = 3
                helper['terminalReceipt']['recordSha256'] = idle_transport.digest(idle_transport.encoded(records[-1]))
                helper['registeredHoldersExited'] = False
                helper['outcome'] = 'release_unproven'; helper['reason'] = 'holder_exit_unproven'
                metadata = (operation / 'manifest.json').read_bytes()
                bound = idle_transport.digest(metadata)
                receipt = {'schema': 'qdrant.idle-entry-result.v1', 'operationSha256': bound,
                    'entrySha256': manifest['entrySha256'], 'inputHashes': manifest['inputHashes'], 'helperResult': helper}
                self._standin(operation, 'raw=' + repr(idle_transport.encoded(receipt))
                    + "\np=Path(sys.argv[1],'records','entry-result.json')\nfd=os.open(p,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)\nos.write(fd,raw)\nos.fsync(fd)\nos.close(fd)\nos._exit(4)\n")
                with patch.object(idle_transport.signal, 'pidfd_send_signal', side_effect=AssertionError('must not signal decoy')):
                    result = idle_transport._execute(operation, manifest, bound)
                self.assertIsNone(decoy.poll())
                self.assertTrue(result['cliExited'])
                self.assertTrue(result['authoritativeReceiptVerified'])
                self.assertFalse(result['helperResult']['registeredHoldersExited'])
                self.assertTrue(result['holderExitUnknown'])
        finally:
            decoy.kill(); decoy.wait(timeout=5)

    def test_blocked_owned_writer_under_invoke_is_released_and_receipt_unproven(self):
        import json
        import os
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(operation)
            path = operation / 'entry' / 'idle_entry.py'
            body = path.read_text().replace('\ndef main():', '''
def fixture_blocked_writer(connection, *args):
    import ctypes
    import signal
    parent = os.getppid()
    if ctypes.CDLL(None).prctl(1, signal.SIGTERM, 0, 0, 0) != 0 or os.getppid() != parent:
        os._exit(4)
    signal.signal(signal.SIGTERM, signal.SIG_DFL)
    signal.signal(signal.SIGALRM, signal.SIG_DFL)
    signal.pthread_sigmask(signal.SIG_SETMASK, set())
    signal.setitimer(signal.ITIMER_REAL, 2)
    connection.send({'ready': True})
    while True:
        time.sleep(.01)


def main():''')
            start = body.index('    result = idle_launcher.run_reviewed(')
            end = body.index('    receipt = ', start)
            body = body[:start] + '''    import functools
    original = idle_launcher.idle_journal.Journal
    idle_launcher.idle_journal.Journal = functools.partial(original,
        worker_target=fixture_blocked_writer, callback_seconds=.05)
    def refuse():
        raise RuntimeError('idle_guard_failure')
    result = idle_launcher._invoke({}, {}, 'unused', manifest['inputHashes']['policy.json'],
        lambda: None, manifest['coreSha256'], operation / 'records' / 'inner.jsonl',
        binding={'packetSha256': manifest['packetSha256'],
                 'sourceContractSha256': manifest['inputHashes']['source.json']}, preflight=refuse)
''' + body[end:]
            os.chmod(path, 0o600); path.write_text(body); os.chmod(path, 0o400)
            manifest['entrySha256'] = idle_transport.digest(path.read_bytes())
            raw = idle_transport.encoded(manifest)
            (operation / 'manifest.json').write_bytes(raw)
            with self.assertRaisesRegex(ValueError, 'transport_entry_not_reviewed'):
                idle_transport.execute_fixture(operation)
            result = idle_transport._execute(operation, manifest, idle_transport.digest(raw))
            self.assertEqual(result['cliExitCode'], 4)
            self.assertFalse(result['authoritativeReceiptVerified'])
            self.assertTrue(result['holderExitUnknown'])
            receipt = json.loads((operation / 'records' / 'entry-result.json').read_bytes())['helperResult']
            # The unchanged helper maps internal writer timeout to its fixed public enum.
            self.assertEqual(receipt['reason'], 'idle_guard_failure')
            self.assertTrue(receipt['writerReleased'])
            self.assertFalse(receipt['writerGraceful'])
            self.assertEqual(receipt['writerExitCode'], -9)

    def test_actual_entry_silent_go_channel_times_out_before_invocation(self):
        import json
        import socket
        import subprocess
        import sys
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            parent, child = socket.socketpair()
            cli = subprocess.Popen([sys.executable, '-I', '-B', '-S', str(operation / 'entry' / 'idle_entry.py'),
                str(operation), str(child.fileno())], pass_fds=(child.fileno(),),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            child.close()
            try:
                parent.settimeout(5); ready = json.loads(parent.recv(1024))
                self.assertEqual(ready['pid'], cli.pid)
                self.assertEqual(cli.wait(timeout=12), 4)
                self.assertEqual(list((operation / 'records').iterdir()), [])
            finally:
                parent.close()
                if cli.poll() is None: cli.kill()
                cli.wait(timeout=5)

    def test_outer_death_after_committed_birth_before_go_never_invokes(self):
        import json
        import os
        import select
        import subprocess
        import sys
        import time
        with tempfile.TemporaryDirectory() as tmp:
            operation = idle_transport.stage_fixture(Path(tmp) / 'operation')
            runner = Path(tmp) / 'runner.py'
            runner.write_text('import sys,json,time\nfrom pathlib import Path\nsys.path.insert(0,'
                + repr(str(Path(idle_transport.__file__).parent)) + ')\nimport idle_transport\n'
                + 'original=idle_transport.durable\ndef block(path,value):\n    original(path,value)\n    if path.name=="cli-birth.json":time.sleep(5)\n'
                + 'idle_transport.durable=block\np=Path(sys.argv[1])\nraw=(p/"manifest.json").read_bytes()\nidle_transport._execute(p,json.loads(raw),idle_transport.digest(raw))\n')
            outer = subprocess.Popen([sys.executable, '-I', '-B', '-S', str(runner), str(operation)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            fd = None
            try:
                deadline = time.monotonic() + 5
                path = operation / 'records' / 'cli-birth.json'
                while not path.exists() and time.monotonic() < deadline: time.sleep(.01)
                birth = json.loads(path.read_bytes())
                fd = os.pidfd_open(birth['pid'])
                self.assertFalse(select.select([fd], [], [], 0)[0])
                outer.kill(); outer.wait(timeout=5)
                self.assertTrue(select.select([fd], [], [], 2)[0])
                self.assertFalse((operation / 'records' / 'entry-result.json').exists())
                self.assertFalse((operation / 'records' / 'inner.jsonl').exists())
            finally:
                if outer.poll() is None: outer.kill()
                outer.wait(timeout=5)
                if fd is not None: os.close(fd)

    def test_reviewed_none_identity_refuses_before_inputs_and_stage(self):
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'operation'
            with patch.object(idle_transport.os, 'geteuid', return_value=0):
                with self.assertRaisesRegex(ValueError, 'transport_expected_code_changed'):
                    idle_transport.stage_reviewed(path, {}, {}, expected_identities=None)
            self.assertFalse(path.exists())

    def test_real_operation_hash_gate_checks_correct_and_wrong_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, digest = idle_transport.verify_fixture(path)
            with self.assertRaisesRegex(ValueError, 'transport_operation_changed'):
                idle_transport._verify_stage(path, 'unprivileged-refusal-fixture', 'f' * 64)
            self.assertEqual(idle_transport._verify_stage(path, 'unprivileged-refusal-fixture', digest), (manifest, digest))
            self.assertEqual(list((path / 'records').iterdir()), [])

    def test_hierarchy_root_present_limit_refuses_not_applicable(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'groups'; path.mkdir()
            node = path.stat(); mount = Path(tmp) / 'mountinfo'
            mount.write_text(f'123 1 {os.major(node.st_dev)}:{os.minor(node.st_dev)} / {path} rw - cgroup2 cgroup rw\n')
            proof = idle_transport.hierarchy_root(path, mount, os.geteuid())
            self.assertTrue(proof['controllerFilesAbsent'])
            for name in ('memory.max', 'memory.high', 'cpu.max'):
                target = path / name; target.write_text('1024')
                with self.assertRaisesRegex(ValueError, 'transport_source_fence_failed'):
                    idle_transport.hierarchy_root(path, mount, os.geteuid())
                target.unlink()

    def test_pidfd_failure_retains_unknown_for_not_yet_exited_direct_child(self):
        import errno, os, time
        from unittest.mock import patch
        with tempfile.TemporaryDirectory() as tmp:
            path = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, digest = idle_transport.verify_fixture(path)
            entry = path / 'entry' / 'idle_entry.py'
            os.chmod(entry, 0o600)
            entry.write_text('import time,os\ntime.sleep(.3)\nos.read(3,128)\nos._exit(4)\n')
            os.chmod(entry, 0o400)
            original = os.fork; children = []
            def fork():
                child = original()
                if child: children.append(child)
                return child
            try:
                with patch.object(idle_transport.os, 'fork', side_effect=fork), \
                     patch.object(idle_transport.os, 'pidfd_open', side_effect=OSError(errno.EIO, 'fixture')), \
                     patch.object(idle_transport.signal, 'pidfd_send_signal', side_effect=AssertionError('unowned signal')):
                    result = idle_transport._execute(path, manifest, digest, release_seconds=.05)
                self.assertFalse(result['cliExited']); self.assertIsNone(result['cliExitCode'])
                self.assertFalse(result['birthCommitted'])
                self.assertEqual(result['reason'], 'transport_pidfd_acquisition_failed')
                self.assertTrue((path / 'records' / 'outer-result.json').exists())
                for name in ('cli-birth.json', 'entry-result.json', 'inner.jsonl'):
                    self.assertFalse((path / 'records' / name).exists())
            finally:
                for child in children:
                    self.assertEqual(os.waitstatus_to_exitcode(os.waitpid(child, 0)[1]), 4)

    def test_partial_nonpass_receipt_then_fsync_failure_cannot_verify(self):
        import os
        with tempfile.TemporaryDirectory() as tmp:
            path = idle_transport.stage_fixture(Path(tmp) / 'operation')
            manifest, _ = idle_transport.verify_fixture(path)
            entry = path / 'entry' / 'idle_entry.py'
            body = entry.read_text().replace("    receipt = {'schema':", "    result = {'event':'qdrant.idle-launcher.v1','phase':'refused','outcome':'release_unproven','reason':'idle_guard_failure','queries':0,'storageWrites':0,'journalCreationUnknown':True}\n    receipt = {'schema':")
            body = body.replace("    durable(operation / 'records' / 'entry-result.json', receipt)", "    durable(operation / 'records' / 'entry-result.json', receipt)\n    raise OSError('fixture fsync failure after receipt bytes')")
            os.chmod(entry, 0o600); entry.write_text(body); os.chmod(entry, 0o400)
            manifest['entrySha256'] = idle_transport.digest(entry.read_bytes())
            raw = idle_transport.encoded(manifest); (path / 'manifest.json').write_bytes(raw)
            result = idle_transport._execute(path, manifest, idle_transport.digest(raw))
            self.assertTrue((path / 'records' / 'entry-result.json').exists())
            self.assertEqual(result['cliExitCode'], 5)
            self.assertFalse(result['authoritativeReceiptVerified'])
            self.assertIsNone(result['helperResult'])

    def test_reviewed_identity_schema_refuses_before_any_input_read(self):
        from unittest.mock import patch
        good = {'packetSha256':'a'*64,'coreSha256':'b'*64,'entrySha256':'c'*64,
                'interpreter':{'path':'/usr/bin/python3','sha256':'d'*64,'version':[3,11,0]}}
        candidates = [None, {}, {**good,'packetSha256':False}, {**good,'interpreter':{'path':'relative','sha256':'d'*64,'version':[3,11,0]}}, {**good,'interpreter':{**good['interpreter'],'version':[True,11,0]}}]
        with tempfile.TemporaryDirectory() as tmp:
            paths = {name:Path(tmp)/name for name in idle_transport.INPUT_FILES}
            for path in paths.values(): path.write_bytes(b'{}'); path.chmod(0o600)
            hashes = {name:idle_transport.digest(b'{}') for name in paths}
            for index, candidate in enumerate(candidates):
                operation = Path(tmp)/f'operation-{index}'
                with patch.object(idle_transport.os,'geteuid',return_value=0), patch.object(idle_transport,'read_owned',side_effect=AssertionError('identity must precede reads')):
                    with self.assertRaisesRegex(ValueError,'transport_expected_code_changed'):
                        idle_transport.stage_reviewed(operation, paths, hashes, expected_identities=candidate)
                self.assertFalse(operation.exists())
