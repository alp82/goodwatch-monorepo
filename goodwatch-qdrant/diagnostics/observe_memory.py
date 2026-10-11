"""Bounded, read-only host and Qdrant memory-pressure observation."""
import argparse
import datetime
import json
import math
import pathlib
import re
import subprocess
import sys
import time

IMAGE = 'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
MEMINFO = ('MemFree', 'MemAvailable', 'Cached', 'Dirty', 'Writeback',
           'Active(file)', 'Inactive(file)', 'Mapped', 'Unevictable', 'Mlocked',
           'AnonPages', 'SwapTotal', 'SwapFree', 'SwapCached')
VM_NAMES = ('pgscan_kswapd', 'pgscan_direct', 'pgscan_khugepaged', 'pgscan_anon',
            'pgscan_file', 'pgsteal_kswapd', 'pgsteal_direct', 'pgsteal_khugepaged',
            'pgsteal_anon', 'pgsteal_file', 'workingset_refault_anon',
            'workingset_refault_file', 'pswpin', 'pswpout')
VM_NAMES += tuple(prefix + zone for prefix in ('allocstall_', 'pgscan_', 'pgsteal_')
                  for zone in ('dma', 'dma32', 'normal', 'movable', 'device'))
MEMORY_STAT = ('anon', 'file', 'kernel', 'unevictable', 'file_mapped', 'file_dirty',
               'file_writeback', 'pgfault', 'pgmajfault', 'workingset_refault_file',
               'workingset_refault_anon', 'pgscan', 'pgsteal')
MEMORY_EVENTS = ('low', 'high', 'max', 'oom', 'oom_kill', 'oom_group_kill')
CPU_STAT = ('usage_usec', 'user_usec', 'system_usec', 'nr_periods', 'nr_throttled',
            'throttled_usec')


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def natural(value):
    if not re.fullmatch(r'[0-9]+', value):
        raise ValueError('invalid_numeric')
    return int(value)


def numbers(text, allowed):
    result = {}
    for line in text.splitlines():
        parts = line.split()
        if parts and parts[0] in allowed:
            if len(parts) != 2 or parts[0] in result:
                raise ValueError('invalid_numeric')
            result[parts[0]] = natural(parts[1])
    return result


def meminfo(text):
    result = {}
    for line in text.splitlines():
        key, separator, rest = line.partition(':')
        if key in MEMINFO:
            parts = rest.split()
            if not separator or len(parts) != 2 or parts[1] != 'kB' or key in result:
                raise ValueError('invalid_numeric')
            result[key] = natural(parts[0])
    if set(result) != set(MEMINFO):
        raise ValueError('missing_required')
    return result


def pressure(text):
    result = {}
    for line in text.splitlines():
        parts = line.split()
        if not parts or parts[0] not in ('some', 'full'):
            continue
        if parts[0] in result:
            raise ValueError('invalid_numeric')
        values = dict(part.split('=', 1) for part in parts[1:])
        row = {}
        for key in ('avg10', 'avg60', 'avg300'):
            value = float(values[key])
            if not math.isfinite(value) or not 0 <= value <= 100:
                raise ValueError('invalid_numeric')
            row[key] = value
        row['total'] = natural(values['total'])
        result[parts[0]] = row
    if set(result) != {'some', 'full'}:
        raise ValueError('missing_required')
    return result


def process(stat, io, page_size):
    values = stat[stat.rfind(')') + 2:].split()
    return {'minorFaults': natural(values[7]), 'majorFaults': natural(values[9]),
            'cpuTicks': natural(values[11]) + natural(values[12]),
            'startTicks': natural(values[19]), 'rssBytes': natural(values[21]) * page_size,
            'readBytes': numbers(io.replace(':', ''), ('read_bytes',))['read_bytes']}


def limit(text):
    value = text.strip()
    return {'unbounded': value == 'max', 'value': None if value == 'max' else natural(value)}


class Source:
    def __init__(self, proc=pathlib.Path('/proc'), cgroups=pathlib.Path('/sys/fs/cgroup')):
        self.proc, self.cgroups = proc, cgroups

    def identity(self):
        raw = subprocess.check_output(['docker', 'inspect', 'qdrant-main'], timeout=5, stderr=subprocess.DEVNULL)
        item = json.loads(raw)[0]
        if not item['State']['Running'] or item['Image'] != IMAGE:
            raise ValueError('identity_changed')
        rows = subprocess.check_output(['docker', 'top', 'qdrant-main', '-eo', 'pid,comm'],
                                       timeout=5, stderr=subprocess.DEVNULL).decode().splitlines()[1:]
        pids = [natural(parts[0]) for row in rows if len(parts := row.split()) == 2 and parts[1] == 'qdrant']
        if len(pids) != 1:
            raise ValueError('identity_changed')
        pid = pids[0]
        if (self.proc / str(pid) / 'comm').read_text().strip() != 'qdrant':
            raise ValueError('identity_changed')
        start = self.counters(pid)['startTicks']
        return (item['Id'], item['Image'], pid, start)

    def counters(self, pid):
        import os
        started = stamp()
        root = self.proc / str(pid)
        result = process((root / 'stat').read_text(), (root / 'io').read_text(),
                         os.sysconf('SC_PAGE_SIZE'))
        return {'startedAt': started, 'finishedAt': stamp(), **result}

    def cgroup(self, pid, container_id):
        started = stamp()
        entries = (self.proc / str(pid) / 'cgroup').read_text().splitlines()
        paths = [line[3:] for line in entries if line.startswith('0::/')]
        if len(paths) != 1 or '..' in pathlib.PurePosixPath(paths[0]).parts:
            raise ValueError('identity_changed')
        if pathlib.PurePosixPath(paths[0]).name not in (container_id, 'docker-' + container_id + '.scope'):
            raise ValueError('identity_changed')
        root = self.cgroups / paths[0].lstrip('/')
        if not root.resolve().is_relative_to(self.cgroups.resolve()):
            raise ValueError('identity_changed')
        quota, period = (root / 'cpu.max').read_text().split()
        result = {'memoryMax': limit((root / 'memory.max').read_text()),
                'memoryHigh': limit((root / 'memory.high').read_text()),
                'memoryCurrentBytes': natural((root / 'memory.current').read_text().strip()),
                'memoryStat': numbers((root / 'memory.stat').read_text(), MEMORY_STAT),
                'memoryEvents': numbers((root / 'memory.events').read_text(), MEMORY_EVENTS),
                'cpuQuota': limit(quota), 'cpuPeriodUsec': natural(period),
                'cpuStat': numbers((root / 'cpu.stat').read_text(), CPU_STAT)}
        return {'startedAt': started, 'finishedAt': stamp(), **result}

    def host(self):
        started = stamp()
        result = {'meminfoKiB': meminfo((self.proc / 'meminfo').read_text()),
                'vmstat': numbers((self.proc / 'vmstat').read_text(), VM_NAMES),
                'memoryPressure': pressure((self.proc / 'pressure/memory').read_text()),
                'ioPressure': pressure((self.proc / 'pressure/io').read_text())}
        return {'hostStartedAt': started, 'hostFinishedAt': stamp(), **result}


def sample(source, expected):
    started = stamp()
    if source.identity() != expected:
        raise ValueError('identity_changed')
    before = source.counters(expected[2])
    group_before = source.cgroup(expected[2], expected[0])
    host = source.host()
    group_after = source.cgroup(expected[2], expected[0])
    after = source.counters(expected[2])
    if source.identity() != expected or before['startTicks'] != expected[3] or after['startTicks'] != expected[3]:
        raise ValueError('identity_changed')
    return {'event': 'qdrant.memory.observation.v1', 'startedAt': started, 'finishedAt': stamp(),
            'processBefore': before, 'processAfter': after,
            'cgroupBefore': group_before, 'cgroupAfter': group_after, **host}


def bounded(value, low, high):
    try:
        number = float(value)
    except ValueError:
        raise argparse.ArgumentTypeError('outside bounded range') from None
    if not math.isfinite(number) or not low <= number <= high:
        raise argparse.ArgumentTypeError('outside bounded range')
    return number


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--duration-seconds', type=lambda value: bounded(value, 2, 3600), default=600)
    parser.add_argument('--interval-seconds', type=lambda value: bounded(value, 1, 10), default=2)
    args = parser.parse_args()
    source = Source()
    try:
        expected = source.identity()
        started = time.monotonic()
        deadline, due = started + args.duration_seconds, started
        while due < deadline:
            time.sleep(max(0, due - time.monotonic()))
            if time.monotonic() >= deadline:
                break
            print(json.dumps(sample(source, expected), allow_nan=False), flush=True)
            due += args.interval_seconds
            # Slow proc/docker reads never trigger a catch-up burst.
            due = max(due, time.monotonic())
        print(json.dumps({'event': 'qdrant.memory.observation.complete.v1', 'at': stamp()}), flush=True)
        return 0
    except Exception as error:
        reason = 'identity_changed' if isinstance(error, ValueError) and error.args == ('identity_changed',) else 'sample_failed'
        print(json.dumps({'event': 'qdrant.memory.observation.failed.v1', 'at': stamp(), 'reason': reason}), flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
