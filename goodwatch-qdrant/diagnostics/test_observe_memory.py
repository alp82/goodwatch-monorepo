import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import observe_memory as observation


def stat(start=100, major=12):
    fields = ['0'] * 22
    fields[0], fields[7], fields[9] = 'S', '7', str(major)
    fields[11], fields[12], fields[19], fields[21] = '8', '9', str(start), '10'
    return '42 (qdrant worker (name)) ' + ' '.join(fields)


def fixture(root):
    proc, groups = root / 'proc', root / 'cgroups'
    process = proc / '42'
    process.mkdir(parents=True)
    (process / 'stat').write_text(stat())
    (process / 'io').write_text('read_bytes: 1234\nprivate_marker: secret\n')
    (process / 'comm').write_text('qdrant\n')
    container = 'a' * 64
    relative = 'system.slice/docker-' + container + '.scope'
    (process / 'cgroup').write_text('0::/' + relative + '\n')
    group = groups / relative
    group.mkdir(parents=True)
    for name, text in {'cpu.max': 'max 100000', 'memory.max': 'max', 'memory.high': 'max',
                       'memory.current': '1024', 'memory.stat': 'anon 10\nfile 20\nprivate_marker secret',
                       'memory.events': 'max 0\noom 0', 'cpu.stat': 'nr_throttled 0'}.items():
        (group / name).write_text(text)
    (proc / 'meminfo').write_text('\n'.join(key + ': 123 kB' for key in observation.MEMINFO) + '\nprivate_marker: secret')
    (proc / 'vmstat').write_text('allocstall_dma32 3\npgsteal_kswapd 99\nprivate_marker secret')
    (proc / 'pressure').mkdir()
    for name in ('memory', 'io'):
        (proc / 'pressure' / name).write_text('some avg10=1.5 avg60=2 avg300=3 total=4 private_marker=secret\nfull avg10=0 avg60=0 avg300=0 total=5')
    return observation.Source(proc, groups), container


class ObservationTests(unittest.TestCase):
    def identity_command(self, container):
        def command(args, timeout, stderr):
            self.assertEqual(stderr, observation.subprocess.DEVNULL)
            if args[1] == 'inspect':
                return json.dumps([{'Id': container, 'Image': observation.IMAGE, 'State': {'Running': True},
                                    'Config': {'Env': ['private_marker=secret']}}]).encode()
            return b'PID COMMAND\n41 wrapper\n42 qdrant\n'
        return command

    def test_real_file_snapshot_numeric_brackets_and_fresh_reads(self):
        with tempfile.TemporaryDirectory() as directory:
            source, container = fixture(Path(directory))
            with patch.object(observation.subprocess, 'check_output', side_effect=self.identity_command(container)):
                identity = source.identity()
                first = observation.sample(source, identity)
                (source.proc / 'meminfo').write_text('\n'.join(key + ': 456 kB' for key in observation.MEMINFO))
                (source.proc / '42/stat').write_text(stat(major=15))
                second = observation.sample(source, identity)
            self.assertEqual(first['processBefore']['majorFaults'], 12)
            self.assertEqual(first['qdrantPid'], 42)
            self.assertEqual(first['processAfter']['cpuTicks'], 17)
            self.assertEqual(second['processBefore']['majorFaults'], 15)
            self.assertEqual(first['meminfoKiB']['MemAvailable'], 123)
            self.assertEqual(second['meminfoKiB']['MemAvailable'], 456)
            self.assertEqual(first['vmstat']['allocstall_dma32'], 3)
            self.assertEqual(first['cgroupBefore']['memoryMax'], {'unbounded': True, 'value': None})
            self.assertLessEqual(first['startedAt'], first['finishedAt'])
            self.assertNotIn('private_marker', json.dumps(first))
            self.assertNotIn(directory, json.dumps(first))

    def test_restart_inside_host_read_rejects_entire_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            source, container = fixture(Path(directory))
            original = source.host
            def host():
                result = original()
                (source.proc / '42/stat').write_text(stat(start=101))
                return result
            with patch.object(observation.subprocess, 'check_output', side_effect=self.identity_command(container)):
                identity = source.identity()
                with patch.object(source, 'host', side_effect=host), self.assertRaisesRegex(ValueError, 'identity_changed'):
                    observation.sample(source, identity)

    def test_wrong_container_cgroup_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            source, container = fixture(Path(directory))
            (source.proc / '42/cgroup').write_text('0::/system.slice/other.scope\n')
            with self.assertRaisesRegex(ValueError, 'identity_changed'):
                source.cgroup(42, container)

    def test_units_duplicates_nonfinite_and_missing_fields_rejected(self):
        for text in ('MemFree: 1 bytes', 'MemFree: -1 kB', 'MemFree: 1 kB\nMemFree: 2 kB'):
            with self.assertRaises(ValueError):
                observation.meminfo(text)
        with self.assertRaises(ValueError):
            observation.pressure('some avg10=nan avg60=0 avg300=0 total=0\nfull avg10=0 avg60=0 avg300=0 total=0')
        with self.assertRaises(ValueError):
            observation.numbers('pgscan_file 1\npgscan_file 2', observation.VM_NAMES)

    def test_failed_read_emits_fixed_reason_without_raw_exception(self):
        output = io.StringIO()
        with patch.object(observation.sys, 'argv', ['observe_memory.py']), \
             patch.object(observation.Source, 'identity', side_effect=OSError('private_marker /secret/path')), \
             contextlib.redirect_stdout(output):
            self.assertEqual(observation.main(), 1)
        event = json.loads(output.getvalue())
        self.assertEqual(event['reason'], 'sample_failed')
        self.assertNotIn('private_marker', output.getvalue())

    def test_bounds_and_no_catchup_burst(self):
        for value in ('nan', 'inf', 'private_marker', '0', '3601'):
            with self.assertRaises(Exception):
                observation.bounded(value, 2, 3600)
        output, sleeps = io.StringIO(), []
        clock = [0.0]
        def sleep(seconds):
            sleeps.append(seconds)
            clock[0] += seconds
        def snapshot(source, identity):
            clock[0] += 3
            return {'event': 'fixture'}
        with patch.object(observation.sys, 'argv', ['observe_memory.py', '--duration-seconds', '8']), \
             patch.object(observation.Source, 'identity', return_value=('id', 'image', 42, 100)), \
             patch.object(observation, 'sample', side_effect=snapshot), \
             patch.object(observation.time, 'monotonic', side_effect=lambda: clock[0]), \
             patch.object(observation.time, 'sleep', side_effect=sleep), contextlib.redirect_stdout(output):
            self.assertEqual(observation.main(), 0)
        self.assertEqual(len(output.getvalue().splitlines()), 4)
        self.assertEqual(clock[0], 9)
        self.assertTrue(all(value >= 0 for value in sleeps))


if __name__ == '__main__':
    unittest.main()
