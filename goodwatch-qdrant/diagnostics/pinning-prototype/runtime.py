"""Private runtime boundaries for uninstalled pin prototype; no application requests."""
from dataclasses import dataclass
import json
import os
from pathlib import Path
import resource
import stat
import subprocess

from pin import CLASSES, PAGE, Kernel, Mapping, Target, byte_count, classify, page_ranges, selection_digest


@dataclass(frozen=True)
class Spec:
    mode: str
    container: str
    image: str
    store: Path
    mounts: frozenset
    memory_bytes: int
    swap_bytes: int
    cpu_nanos: int


@dataclass(frozen=True)
class Source:
    identity: tuple
    pid: int
    cgroup: Path
    cgroup_relative: str
    spec: Spec


def docker(*args):
    try:
        return subprocess.check_output(['docker', *args], timeout=5, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        raise RuntimeError('docker_inspection_failed') from None


def inspect_source(spec):
    if spec.mode not in ('clone', 'production') or spec.store.resolve() != spec.store:
        raise ValueError('unreviewed_source_spec')
    x = json.loads(docker('inspect', spec.container))[0]
    if not x['State']['Running'] or x['Image'] != spec.image:
        raise RuntimeError('source_image_or_running_changed')
    h = x['HostConfig']
    if h['Memory'] != spec.memory_bytes or h['MemorySwap'] != spec.swap_bytes or h['NanoCpus'] != spec.cpu_nanos:
        raise RuntimeError('source_resources_changed')
    if frozenset((m['Source'], m['Destination'], m['Type'], m['RW']) for m in x['Mounts']) != spec.mounts:
        raise RuntimeError('source_mounts_changed')
    if spec.mode == 'clone':
        if spec.container != 'gw-qdrant-cold-406-20261011' or x['Config']['Labels'].get('goodwatch.task') != '406' or x['Config']['Labels'].get('goodwatch.owner') != 'search-100-diagnosis':
            raise RuntimeError('clone_ownership_changed')
        if h['PortBindings'] != {'6333/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '16333'}]}:
            raise RuntimeError('clone_loopback_changed')
    elif spec.container != 'qdrant-main':
        raise RuntimeError('unreviewed_production_container')
    rows = docker('top', spec.container, '-eo', 'pid,comm').decode().splitlines()[1:]
    ids = [int(row.split()[0]) for row in rows if row.split()[1] == 'qdrant']
    if len(ids) != 1:
        raise RuntimeError('actual_qdrant_pid_ambiguous')
    pid = ids[0]; proc = Path('/proc') / str(pid)
    if (proc / 'comm').read_text().strip() != 'qdrant' or (proc / 'exe').readlink().name != 'qdrant':
        raise RuntimeError('actual_qdrant_comm_changed')
    raw = (proc / 'stat').read_text(); fields = raw[raw.rfind(')') + 2:].split()
    start_ticks = int(fields[19])  # proc field22; PID reuse cannot preserve identity.
    cg = (proc / 'cgroup').read_text().strip().split(':', 2)[2]
    if '..' in cg or not cg.endswith('/docker-' + x['Id'] + '.scope'):
        raise RuntimeError('source_cgroup_changed')
    return Source((x['Id'], x['Image'], pid, start_ticks), pid, Path('/sys/fs/cgroup') / cg.lstrip('/'), cg, spec)


@dataclass
class Inventory:
    targets: list
    deleted_mappings: int


PROC = Path('/proc')
MAX_MAPPED_FILES = 20000


def inventory(source, include_payload=False):
    if inspect_source(source.spec).identity != source.identity:
        raise RuntimeError('source_identity_changed')
    targets, seen, deleted = [], set(), 0
    try:
        for line in (PROC / str(source.pid) / 'maps').read_text().splitlines():
            fields = line.split(maxsplit=5)
            if len(fields) < 6 or not fields[5].startswith('/qdrant/storage/'):
                continue
            key = (fields[3], int(fields[4]))
            if key in seen:
                continue
            if len(seen) >= MAX_MAPPED_FILES:
                raise RuntimeError('mapped_file_inventory_bound_exceeded')
            seen.add(key)
            if fields[5].endswith(' (deleted)'):
                deleted += 1
                continue
            relative = fields[5].removeprefix('/qdrant/storage/')
            host = source.spec.store / relative
            if host.resolve() != host or source.spec.store not in host.parents:
                raise RuntimeError('target_path_scope_changed')
            target = Target.open(PROC / str(source.pid) / 'root' / fields[5].lstrip('/'), classify(fields[5]))
            targets.append(target)
            info = host.lstat()
            if not stat.S_ISREG(info.st_mode) or (info.st_dev, info.st_ino, info.st_size) != target.identity or info.st_ino != key[1]:
                raise RuntimeError('host_mapped_inode_changed')
            if (os.major(info.st_dev), os.minor(info.st_dev)) != tuple(int(value, 16) for value in fields[3].split(':')):
                raise RuntimeError('mapped_device_changed')
            if target.kind == 'payload' and not include_payload:
                target.close(); target.measured_only = True
        if not targets or inspect_source(source.spec).identity != source.identity:
            raise RuntimeError('source_changed_during_inventory')
        return Inventory(targets, deleted)
    except Exception:
        for target in targets: target.close()
        raise


def accounting(source):
    values = {key: int(value) for key, value in (line.split() for line in (source.cgroup / 'memory.stat').read_text().splitlines())}
    available = next(int(line.split()[1]) * 1024 for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    cap = (source.cgroup / 'memory.max').read_text().strip()
    events = {key: int(value) for key, value in (line.split() for line in (source.cgroup / 'memory.events').read_text().splitlines())}
    cpu = {key: int(value) for key, value in (line.split() for line in (source.cgroup / 'cpu.stat').read_text().splitlines())}
    for values_required, keys in ((events, ('oom', 'oom_kill', 'max')), (cpu, ('nr_throttled', 'throttled_usec'))):
        if any(key not in values_required or type(values_required[key]) is not int or values_required[key] < 0 for key in keys):
            raise RuntimeError('required_limit_metrics_missing')
    return {'availableBytes': available, 'cgroupMaxBytes': None if cap == 'max' else int(cap),
            'anonBytes': values['anon'], 'fileBytes': values['file'], 'kernelBytes': values['kernel'],
            'unevictableBytes': values['unevictable'], 'currentBytes': int((source.cgroup / 'memory.current').read_text()),
            'memoryEvents': events, 'cpu': cpu}


def prepare_self(source, max_locked_bytes, raise_own_limit=False):
    """Root-only changes to this helper process, never services/ancestors."""
    if os.geteuid() != 0:
        raise PermissionError('root_helper_required')
    Path('/proc/self/oom_score_adj').write_text('1000')
    soft, hard = resource.getrlimit(resource.RLIMIT_MEMLOCK)
    if soft != resource.RLIM_INFINITY and soft < max_locked_bytes:
        if not raise_own_limit:
            raise RuntimeError('explicit_own_memlock_raise_required')
        resource.setrlimit(resource.RLIMIT_MEMLOCK, (max_locked_bytes, max_locked_bytes if hard != resource.RLIM_INFINITY and hard < max_locked_bytes else hard))
    if inspect_source(source.spec).identity != source.identity:
        raise RuntimeError('source_changed_before_helper_accounting')
    if Path('/proc/self/cgroup').read_text().strip().split(':', 2)[2] != source.cgroup_relative:
        with (source.cgroup / 'cgroup.procs').open('w') as output:
            output.write(str(os.getpid()))
    if Path('/proc/self/cgroup').read_text().strip().split(':', 2)[2] != source.cgroup_relative:
        raise RuntimeError('helper_accounting_not_joined')


def reconcile_source(manager, spec, allow_clone_pressure_max=False):
    """One guarded pass. Any source/inventory failure releases prior locks."""
    targets = []
    try:
        if type(allow_clone_pressure_max) is not bool or allow_clone_pressure_max and spec.mode != 'clone':
            raise ValueError('clone_pressure_window_required')
        if manager.policy.mode != spec.mode:
            raise ValueError('policy_source_mode_mismatch')
        source = inspect_source(spec)
        if manager.source_identity != source.identity:
            manager.release()
        prepare_self(source, manager.policy.max_locked_bytes)
        sampled = inventory(source, manager.policy.include_payload)
        targets = sampled.targets
        for kind in ('vector', 'graph', 'sparse', 'other'):
            members = [target for target in targets if target.kind == kind]
            if not members or not any(target.ranges for target in members):
                raise RuntimeError('expected_pin_class_coverage_missing')
        before = accounting(source)
        state = manager.reconcile(targets, source.identity, before)
        if any(values['residentLockedDataPages'] != values['lockedDataPages'] for values in state['lockedResidency'].values()):
            raise RuntimeError('locked_data_residency_incomplete')
        after_source = inspect_source(spec)
        after = accounting(after_source)
        if after_source.identity != source.identity or after['availableBytes'] < manager.policy.emergency_bytes:
            raise RuntimeError('source_or_emergency_headroom_changed_after_locking')
        pressure_max_allowed = allow_clone_pressure_max and state['newLockBytes'] == 0 and not state['rangesChanged']
        event_delta = {key: after['memoryEvents'][key] - before['memoryEvents'][key] for key in ('oom', 'oom_kill', 'max')}
        if any(value < 0 for value in event_delta.values()):
            raise RuntimeError('limit_metrics_reset_during_pass')
        if event_delta['oom'] or event_delta['oom_kill'] or event_delta['max'] and not pressure_max_allowed:
            raise RuntimeError('initial_pin_memory_limit_event')
        cpu_delta = {key: after['cpu'][key] - before['cpu'][key] for key in ('nr_throttled', 'throttled_usec')}
        if any(value < 0 for value in cpu_delta.values()):
            raise RuntimeError('limit_metrics_reset_during_pass')
        if any(cpu_delta.values()):
            raise RuntimeError('initial_pin_cpu_limit_event')
        state.update({'qdrantPid': source.pid, 'accountingBefore': before, 'accountingAfter': after,
                      'deletedMappingsExcluded': sampled.deleted_mappings, 'sourceStartTicks': source.identity[3],
                      'memoryEventDelta': event_delta, 'cpuLimitDelta': cpu_delta, 'clonePressureMaxAllowed': pressure_max_allowed,
                      'existingPageChargeMayDiffer': True, 'allExistingPageChargesInsideTargetCgroupProven': False})
        return state
    except Exception:
        manager.release()
        raise
    finally:
        for target in targets:
            if all(mapping.target is not target for mapping in manager.mappings.values()): target.close()


def measure_source(spec, include_payload=False):
    """Readonly inventory/mincore pass: no locks, cgroup joins, or self-limit writes."""
    if type(include_payload) is not bool:
        raise ValueError('explicit_measure_selection_required')
    source = inspect_source(spec)
    sampled = inventory(source, include_payload=True)
    measured = {kind: {'files': 0, 'dataPages': 0, 'residentDataPages': 0} for kind in CLASSES}
    kernel = Kernel()
    selection = []
    try:
        for target in sampled.targets:
            ranges = page_ranges(target.ranges, target.identity[2])
            values = measured[target.kind]
            values['files'] += 1; values['dataPages'] += byte_count(ranges) // PAGE
            mapping = Mapping(target, kernel)
            try:
                if mapping.address is not None:
                    values['residentDataPages'] += kernel.resident_pages(mapping.address, ranges)
                target.check()
                if target.kind != 'payload' or include_payload:
                    selection.append((target.kind, target.identity, target.ranges))
            finally:
                mapping.close()
        after = inspect_source(spec)
        if after.identity != source.identity:
            raise RuntimeError('source_changed_during_measurement')
        return {'event': 'mapped-data-measure-state.v1', 'mode': spec.mode, 'qdrantPid': source.pid,
                'sourceStartTicks': source.identity[3], 'classesMeasured': measured, 'pageBytes': PAGE,
                'selectionHash': selection_digest(selection),
                'extentRangesHashed': True, 'contentFixed': False, 'accounting': accounting(source),
                'deletedMappingsExcluded': sampled.deleted_mappings, 'lockedBytes': 0, 'queries': 0, 'storageWrites': 0}
    finally:
        for target in sampled.targets: target.close()
