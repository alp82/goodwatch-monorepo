"""Local transport preparation. Production execution is deliberately refused."""
import ctypes
import hashlib
import json
import os
from pathlib import Path
import select
import signal
import socket
import stat
import sys
import threading
import time

import idle_launcher
from idle_entry import durable, encoded, ticks

CODE_FILES = idle_launcher.CODE_FILES
ENTRY = Path(__file__).with_name('idle_entry.py')
CORE_FILES = CODE_FILES[:6]


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def row(raw):
    return {'bytes': len(raw), 'sha256': digest(raw)}


INPUT_FILES = ('source.json', 'policy.json', 'schedule.json', 'standing.json')


def _standing(inputs):
    standing = json.loads(inputs['standing.json'])
    if type(standing) is not dict or set(standing) != {'schema', 'source', 'sourceContractSha256', 'scheduler', 'resource', 'kernel'} or standing['schema'] != 'qdrant.idle-standing-inputs.v1':
        raise ValueError('transport_standing_invalid')
    source = standing['source']
    if type(source) is not dict or set(source) != {'pid', 'startTicks', 'identitySha256'} or any(type(source[key]) is not int or source[key] <= 1 for key in ('pid', 'startTicks')) or not _hash(source['identitySha256']):
        raise ValueError('transport_standing_invalid')
    scheduler = standing['scheduler']
    canonical_schedule = json.dumps(json.loads(inputs['schedule.json']), sort_keys=True, separators=(',', ':')).encode()
    if type(scheduler) is not dict or set(scheduler) != {'singleKnownRootTable', 'scheduleFileSha256', 'scheduleCanonicalSha256'} or scheduler['singleKnownRootTable'] is not True or scheduler['scheduleFileSha256'] != digest(inputs['schedule.json']) or scheduler['scheduleCanonicalSha256'] != digest(canonical_schedule):
        raise ValueError('transport_standing_invalid')
    resource = standing['resource']
    if type(resource) is not dict or set(resource) != {'complete', 'eligible', 'proofSha256'} or resource['complete'] is not True or resource['eligible'] is not True or not _hash(resource['proofSha256']) or standing['sourceContractSha256'] != digest(inputs['source.json']):
        raise ValueError('transport_standing_invalid')
    kernel = standing['kernel']
    if type(kernel) is not dict or set(kernel) != {'cgroupSha256', 'memoryMax', 'memoryHigh', 'cpuMax', 'oomGroup', 'swapCurrent'} or not _hash(kernel['cgroupSha256']) or (kernel['memoryMax'], kernel['memoryHigh'], kernel['cpuMax']) != ('max', 'max', 'max 100000') or type(kernel['oomGroup']) is not int or kernel['oomGroup'] != 0 or type(kernel['swapCurrent']) is not int or kernel['swapCurrent'] != 0:
        raise ValueError('transport_standing_invalid')
    return dict(source), digest(canonical_schedule)


def _hash(value):
    return type(value) is str and len(value) == 64 and all(c in '0123456789abcdef' for c in value)


def stage_fixture(operation):
    """Only unprivileged local refusal coverage; never a production stage."""
    if os.geteuid() == 0:
        raise ValueError('fixture_requires_unprivileged_context')
    inputs = {name: encoded({}) for name in INPUT_FILES}
    return _stage_bound(operation, inputs, 'unprivileged-refusal-fixture')


def _expected_identities(value):
    if type(value) is not dict or set(value) != {'packetSha256', 'coreSha256', 'entrySha256', 'interpreter'} or any(not _hash(value[key]) for key in ('packetSha256', 'coreSha256', 'entrySha256')):
        raise ValueError('transport_expected_code_changed')
    interpreter = value['interpreter']
    if type(interpreter) is not dict or set(interpreter) != {'path', 'sha256', 'version'} or type(interpreter['path']) is not str or not Path(interpreter['path']).is_absolute() or not _hash(interpreter['sha256']) or type(interpreter['version']) is not list or len(interpreter['version']) != 3 or any(type(v) is not int or v < 0 for v in interpreter['version']):
        raise ValueError('transport_expected_code_changed')


def stage_reviewed(operation, inputs, expected_hashes, *, expected_identities):
    """Root-only local preparation; no execution authorization is inferred."""
    if os.geteuid() != 0:
        raise ValueError('transport_stage_root_required')
    _expected_identities(expected_identities)
    if type(inputs) is not dict or set(inputs) != set(INPUT_FILES) or type(expected_hashes) is not dict or set(expected_hashes) != set(INPUT_FILES):
        raise ValueError('transport_inputs_invalid')
    paths = [Path(path).absolute() for path in inputs.values()]
    if len(set(paths)) != len(paths):
        raise ValueError('transport_inputs_invalid')
    frozen = {name: read_owned(Path(path), 0o600, 32768) for name, path in inputs.items()}
    if any(not _hash(expected_hashes[name]) or digest(raw) != expected_hashes[name] for name, raw in frozen.items()):
        raise ValueError('transport_inputs_changed')
    operation = Path(operation).absolute()
    for ancestor in operation.parents:
        info = ancestor.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise ValueError('transport_stage_invalid')
    return _stage_bound(operation, frozen, 'reviewed-preparation', expected_identities=expected_identities)


def _stage_bound(operation, inputs, kind, expected_identities=None):
    # Local fixture seam; public stage_reviewed additionally requires root inputs.
    if type(inputs) is not dict or set(inputs) != set(INPUT_FILES) or any(type(raw) is not bytes or not 0 < len(raw) <= 32768 for raw in inputs.values()):
        raise ValueError('transport_inputs_invalid')
    if kind == 'reviewed-preparation':
        source, schedule_hash = _standing(inputs)
    elif kind == 'unprivileged-refusal-fixture' and os.geteuid() != 0:
        source, schedule_hash = {'pid': 99999999, 'startTicks': 1, 'identitySha256': '0' * 64}, digest(b'{}')
    else:
        raise ValueError('transport_stage_invalid')
    operation = Path(operation).absolute()
    operation.mkdir(mode=0o700)
    parent_fd = os.open(operation.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(parent_fd)
    finally:
        os.close(parent_fd)
    for directory in ('code', 'entry', 'private', 'records'):
        (operation / directory).mkdir(mode=0o700)
    code_rows = {}
    core = hashlib.sha256()
    for name in CODE_FILES:
        source_path = Path(__file__).with_name(name)
        raw = read_owned(source_path, 0o400) if expected_identities is not None else source_path.read_bytes()
        code_rows[name] = row(raw)
        durable_bytes(operation / 'code' / name, raw, 0o400)
        if name in CORE_FILES:
            core.update(name.encode() + b'\0' + raw + b'\0')
    entry_raw = read_owned(ENTRY, 0o400) if expected_identities is not None else ENTRY.read_bytes()
    durable_bytes(operation / 'entry' / 'idle_entry.py', entry_raw, 0o400)
    hashes = {}
    for name, raw in inputs.items():
        durable_bytes(operation / 'private' / name, raw, 0o600)
        hashes[name] = digest(raw)
    manifest = {'schema': 'qdrant.idle-operation.v1', 'kind': kind,
        'entrySha256': digest(entry_raw), 'codeRows': code_rows,
        'packetSha256': idle_launcher.packet_hash(code_rows), 'coreSha256': core.hexdigest(),
        'inputHashes': hashes, 'scheduleCanonicalSha256': schedule_hash,
        'interpreter': {'path': os.path.realpath(sys.executable), 'sha256': digest(Path(sys.executable).read_bytes()),
                        'version': list(sys.version_info[:3])}, 'source': source,
        'kernel': json.loads(inputs['standing.json'])['kernel'] if kind == 'reviewed-preparation' else None}
    if expected_identities is not None:
        actual = {key: manifest[key] for key in ('packetSha256', 'coreSha256', 'entrySha256', 'interpreter')}
        if type(expected_identities) is not dict or expected_identities != actual:
            raise ValueError('transport_expected_code_changed')
    durable(operation / 'manifest.json', manifest)
    return operation


def durable_bytes(path, raw, mode):
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        fd = os.open(path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode, dir_fd=directory)
        try:
            position = 0
            while position < len(raw):
                position += os.write(fd, raw[position:])
            os.fsync(fd)
        finally:
            os.close(fd)
        os.fsync(directory)
    finally:
        os.close(directory)


def read_owned(path, mode, maximum=262144):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_nlink != 1 or before.st_uid != os.geteuid() or stat.S_IMODE(before.st_mode) != mode or before.st_size > maximum:
            raise ValueError('transport_stage_invalid')
        raw = os.read(fd, maximum + 1)
        after = os.fstat(fd)
        identity = lambda info: (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
        if identity(before) != identity(after) or len(raw) != before.st_size:
            raise ValueError('transport_stage_changed')
        return raw
    finally:
        os.close(fd)


def verify_fixture(operation):
    if os.geteuid() == 0:
        raise ValueError('fixture_requires_unprivileged_context')
    return _verify_stage(operation, 'unprivileged-refusal-fixture')


def _verify_stage(operation, kind, expected_operation_sha256=None):
    operation = Path(operation)
    if operation.resolve() != operation or set(os.listdir(operation)) != {'code', 'entry', 'private', 'records', 'manifest.json'}:
        raise ValueError('transport_stage_invalid')
    for directory in (operation, *(operation / name for name in ('code', 'entry', 'private', 'records'))):
        info = directory.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError('transport_stage_invalid')
    raw = read_owned(operation / 'manifest.json', 0o600, 32768)
    if expected_operation_sha256 is not None and digest(raw) != expected_operation_sha256:
        raise ValueError('transport_operation_changed')
    manifest = json.loads(raw)
    if type(manifest) is not dict or set(manifest) != {'schema', 'kind', 'entrySha256', 'codeRows', 'packetSha256', 'coreSha256', 'inputHashes', 'scheduleCanonicalSha256', 'interpreter', 'source', 'kernel'} or manifest['schema'] != 'qdrant.idle-operation.v1' or manifest['kind'] != kind or type(manifest['codeRows']) is not dict or set(manifest['codeRows']) != set(CODE_FILES) or type(manifest['inputHashes']) is not dict or set(manifest['inputHashes']) != set(INPUT_FILES):
        raise ValueError('transport_stage_invalid')
    if set(os.listdir(operation / 'code')) != set(CODE_FILES) or set(os.listdir(operation / 'entry')) != {'idle_entry.py'} or set(os.listdir(operation / 'private')) != set(manifest['inputHashes']) or os.listdir(operation / 'records'):
        raise ValueError('transport_stage_invalid')
    for name, expected in manifest['codeRows'].items():
        if row(read_owned(operation / 'code' / name, 0o400)) != expected or expected != row(Path(__file__).with_name(name).read_bytes()):
            raise ValueError('transport_stage_changed')
    if manifest['packetSha256'] != idle_launcher.packet_hash(manifest['codeRows']):
        raise ValueError('transport_stage_changed')
    core = hashlib.sha256()
    for name in CORE_FILES:
        core.update(name.encode() + b'\0' + read_owned(operation / 'code' / name, 0o400) + b'\0')
    if core.hexdigest() != manifest['coreSha256']:
        raise ValueError('transport_stage_changed')
    entry = read_owned(operation / 'entry' / 'idle_entry.py', 0o400)
    if digest(entry) != manifest['entrySha256'] or entry != ENTRY.read_bytes():
        raise ValueError('transport_entry_not_reviewed')
    inputs = {}
    for name, expected in manifest['inputHashes'].items():
        inputs[name] = read_owned(operation / 'private' / name, 0o600, 32768)
        if digest(inputs[name]) != expected:
            raise ValueError('transport_stage_changed')
    if kind == 'reviewed-preparation':
        expected_source, expected_schedule = _standing(inputs)
        if manifest['source'] != expected_source or manifest['scheduleCanonicalSha256'] != expected_schedule or manifest['kernel'] != json.loads(inputs['standing.json'])['kernel']:
            raise ValueError('transport_standing_invalid')
        for ancestor in operation.parents:
            info = ancestor.lstat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
                raise ValueError('transport_stage_invalid')
    if manifest['interpreter']['path'] != os.path.realpath(sys.executable) or manifest['interpreter']['sha256'] != digest(Path(sys.executable).read_bytes()) or manifest['interpreter']['version'] != list(sys.version_info[:3]):
        raise ValueError('transport_interpreter_changed')
    return manifest, digest(raw)


def verify_helper_result(result, manifest, journal_path):
    """Validate only fixed public helper shapes and exact committed journal tail."""
    import idle_journal
    import idle_trial
    base = {'event', 'phase', 'outcome', 'reason', 'queries', 'storageWrites'}
    reasons = idle_trial.REASONS | idle_launcher.LAUNCHER_REASONS | {
        'idle_journal_release_unproven', 'idle_journal_nongraceful_exit', 'holder_exit_unproven'}
    if type(result) is not dict or not base <= set(result) or result['event'] != 'qdrant.idle-launcher.v1' or result['outcome'] not in {'pass', 'inconclusive', 'refused', 'safety_abort', 'release_unproven', 'evidence_failure'}:
        raise ValueError('transport_result_invalid')
    if result['reason'] is not None and (type(result['reason']) is not str or result['reason'] not in reasons):
        raise ValueError('transport_result_invalid')
    if any(type(result[key]) is not int or result[key] != 0 for key in ('queries', 'storageWrites')):
        raise ValueError('transport_result_invalid')
    if result['phase'] == 'refused':
        if set(result) == base | {'journalCreated'} and result['journalCreated'] is False and result['outcome'] == 'refused':
            return
        if set(result) == base | {'journalCreationUnknown'} and result['journalCreationUnknown'] is True and result['outcome'] == 'release_unproven':
            return
        raise ValueError('transport_result_invalid')
    fields = {'packetSha256', 'sourceContractSha256', 'terminalReceipt', 'writerReleased', 'writerGraceful', 'writerExitCode', 'registeredHoldersExited'}
    if result['phase'] != 'complete' or set(result) != base | fields or any(type(result[key]) is not bool for key in ('writerReleased', 'writerGraceful', 'registeredHoldersExited')) or result['writerExitCode'] is not None and type(result['writerExitCode']) is not int:
        raise ValueError('transport_result_invalid')
    if result['packetSha256'] != manifest['packetSha256'] or result['sourceContractSha256'] != manifest['inputHashes']['source.json']:
        raise ValueError('transport_result_invalid')
    terminal = result['terminalReceipt']
    if type(terminal) is not dict or set(terminal) != {'sequence', 'recordSha256', 'committed'} or type(terminal['sequence']) is not int or not 1 <= terminal['sequence'] <= 512 or terminal['committed'] is not True or type(terminal['recordSha256']) is not str or not idle_journal.HASH.fullmatch(terminal['recordSha256']):
        raise ValueError('transport_journal_invalid')
    raw = read_owned(journal_path, 0o600, idle_journal.MAX_TOTAL_BYTES)
    if not raw.endswith(b'\n'):
        raise ValueError('transport_journal_invalid')
    lines = raw.splitlines(keepends=True)
    if len(lines) != terminal['sequence']:
        raise ValueError('transport_journal_invalid')
    last = None
    for index, line in enumerate(lines, 1):
        if len(line) > idle_journal.MAX_RECORD_BYTES:
            raise ValueError('transport_journal_invalid')
        try:
            record = json.loads(line)
            if encoded(record) != line or set(record) != {'schema', 'sequence', 'kind', 'codeSha256', 'policySha256', 'data'} or record['schema'] != 'qdrant.idle-journal.v1' or type(record['sequence']) is not int or record['sequence'] != index or record['codeSha256'] != manifest['coreSha256'] or record['policySha256'] != manifest['inputHashes']['policy.json']:
                raise ValueError('transport_journal_invalid')
            if index == 1:
                if record['kind'] != 'binding' or record['data'] != {'packetSha256': manifest['packetSha256'], 'sourceContractSha256': manifest['inputHashes']['source.json']}:
                    raise ValueError('transport_journal_invalid')
            elif record['kind'] == 'birth':
                idle_journal.birth(record['data'])
            elif record['kind'] == 'event':
                data = record['data']
                idle_journal.sanitize(data, manifest['coreSha256'], manifest['inputHashes']['policy.json'])
                if data['scheduleSha256'] != manifest['scheduleCanonicalSha256'] and not (data['scheduleSha256'] is None and data['phase'] == 'complete' and data.get('outcome') == 'refused'):
                    raise ValueError('transport_journal_invalid')
            else:
                raise ValueError('transport_journal_invalid')
        except (ValueError, KeyError, TypeError):
            raise ValueError('transport_journal_invalid') from None
        last = record
    if digest(lines[-1]) != terminal['recordSha256'] or last['kind'] != 'event' or last['data']['phase'] != 'complete':
        raise ValueError('transport_journal_invalid')
    if result['outcome'] == 'pass' and (not result['writerReleased'] or not result['writerGraceful'] or result['writerExitCode'] != 0 or not result['registeredHoldersExited'] or last['data']['outcome'] != 'pass'):
        raise ValueError('transport_result_invalid')


def execute_fixture(operation):
    if signal.getsignal(signal.SIGCHLD) != signal.SIG_DFL:
        raise ValueError('transport_child_reaping_required')
    manifest, operation_hash = verify_fixture(operation)
    if threading.current_thread() is not threading.main_thread() or threading.active_count() != 1:
        raise ValueError('transport_single_thread_required')
    return _execute(Path(operation), manifest, operation_hash)


def inspect_runtime(path=Path('/run/goodwatch-qdrant-pin')):
    try:
        return _inspect_runtime(path, 0)
    except (OSError, ValueError):
        raise ValueError('transport_runtime_invalid') from None


def _inspect_runtime(path, owner_uid):
    """Metadata only. Never creates a directory, opens a lock, or deletes."""
    info = path.lstat()
    if path.resolve() != path or not stat.S_ISDIR(info.st_mode) or info.st_uid != owner_uid or stat.S_IMODE(info.st_mode) != 0o700:
        raise ValueError('transport_runtime_invalid')
    lock = path / 'supervisor.lock'
    try:
        node = lock.lstat()
    except FileNotFoundError:
        return {'directoryDevice': info.st_dev, 'directoryInode': info.st_ino, 'lock': None}
    if not stat.S_ISREG(node.st_mode) or node.st_uid != owner_uid or node.st_nlink != 1 or node.st_mode & 0o077:
        raise ValueError('transport_runtime_invalid')
    return {'directoryDevice': info.st_dev, 'directoryInode': info.st_ino,
            'lock': {'device': node.st_dev, 'inode': node.st_ino}}


def hierarchy_root(path, mountinfo, owner_uid=0):
    """Typed root-only applicability, from directory and cgroup2 mount metadata.

    owner_uid is a local filesystem fixture seam; production uses root only.
    """
    info = path.lstat()
    if path.resolve() != path or not stat.S_ISDIR(info.st_mode) or info.st_uid != owner_uid:
        raise ValueError('transport_source_fence_failed')
    with mountinfo.open('rb') as stream:
        raw = stream.read(1048577)
    if len(raw) > 1048576:
        raise ValueError('transport_source_fence_failed')
    matches = []
    for line in raw.decode().splitlines():
        fields = line.split()
        if len(fields) < 10 or '-' not in fields:
            raise ValueError('transport_source_fence_failed')
        separator = fields.index('-')
        if fields[4] != str(path):
            continue
        if fields[3] != '/' or fields[separator + 1] != 'cgroup2' or fields[2] != f'{os.major(info.st_dev)}:{os.minor(info.st_dev)}':
            raise ValueError('transport_source_fence_failed')
        matches.append(int(fields[0]))
    if len(matches) != 1:
        raise ValueError('transport_source_fence_failed')
    for name in ('memory.max', 'memory.high', 'cpu.max'):
        try:
            (path / name).lstat()
        except FileNotFoundError:
            continue
        raise ValueError('transport_source_fence_failed')
    return {'kind': 'hierarchy-root', 'controllerLimits': 'not-applicable', 'controllerFilesAbsent': True,
            'filesystem': 'cgroup2', 'mountId': matches[0], 'device': info.st_dev, 'inode': info.st_ino}


def kernel_fence(manifest, proc=Path('/proc'), cgroup_root=Path('/sys/fs/cgroup'), root_owner_uid=0):
    try:
        return _kernel_fence(manifest, proc, cgroup_root, root_owner_uid)
    except (OSError, ValueError, IndexError, KeyError, TypeError):
        raise ValueError('transport_source_fence_failed') from None


def _kernel_fence(manifest, proc, cgroup_root, root_owner_uid):
    """No Docker RPC/subprocess/data reads. Expected identity is standing-bound."""
    source = manifest['source']
    pid = source['pid']
    if pid == os.getpid():
        raise ValueError('transport_source_fence_failed')
    def bounded(path):
        with path.open('rb') as stream:
            raw = stream.read(4097)
        if len(raw) > 4096:
            raise ValueError('transport_source_fence_failed')
        return raw.decode().strip()
    def identity():
        return int(bounded(proc / str(pid) / 'stat').rsplit(')', 1)[1].split()[19])
    if identity() != source['startTicks']:
        raise ValueError('transport_source_fence_failed')
    group_rows = bounded(proc / str(pid) / 'cgroup').splitlines()
    own_rows = bounded(proc / 'self' / 'cgroup').splitlines()
    if len(group_rows) != 1 or not group_rows[0].startswith('0::/') or len(own_rows) != 1 or not own_rows[0].startswith('0::/'):
        raise ValueError('transport_source_fence_failed')
    group = group_rows[0][3:]
    own = own_rows[0][3:]
    if any(part in ('.', '..') for part in Path(group).parts) or own == group or own.startswith(group.rstrip('/') + '/') or digest(group.encode()) != manifest['kernel']['cgroupSha256']:
        raise ValueError('transport_source_fence_failed')
    target = cgroup_root / group.lstrip('/')
    if target.resolve() != target:
        raise ValueError('transport_source_fence_failed')
    root_proof = hierarchy_root(cgroup_root, proc / 'self' / 'mountinfo', root_owner_uid)
    for current in (target, *target.parents):
        if current == cgroup_root:
            break
        if current != cgroup_root and cgroup_root not in current.parents:
            break
        if tuple(bounded(current / key) for key in ('memory.max', 'memory.high', 'cpu.max')) != ('max', 'max', 'max 100000'):
            raise ValueError('transport_source_fence_failed')
        if current == cgroup_root:
            break
    if bounded(target / 'memory.oom.group') != '0' or bounded(target / 'memory.swap.current') != '0' or identity() != source['startTicks'] or bounded(proc / str(pid) / 'cgroup').splitlines() != group_rows:
        raise ValueError('transport_source_fence_failed')
    return {'sourcePid': pid, 'sourceStartTicks': source['startTicks'], 'cgroupSha256': digest(group.encode()), 'limitsUnchanged': True, 'outsideSource': True, 'swapCurrent': 0, 'oomGroup': 0, 'hierarchyRoot': root_proof}


def execute_production(operation):
    # No deployment/window authorization is encoded by this preparation API.
    raise ValueError('transport_production_not_reviewed')


def run_reviewed_stage(operation, expected_operation_sha256=None):
    """Inactive integration API, requiring a separately reviewed root host gate.

    No CLI calls this API. Calling it on a host is outside this preparation task.
    """
    if os.geteuid() != 0:
        raise ValueError('transport_stage_root_required')
    if threading.current_thread() is not threading.main_thread() or threading.active_count() != 1 or signal.getsignal(signal.SIGCHLD) != signal.SIG_DFL:
        raise ValueError('transport_child_reaping_required')
    if not _hash(expected_operation_sha256):
        raise ValueError('transport_operation_changed')
    manifest, operation_hash = _verify_stage(operation, 'reviewed-preparation', expected_operation_sha256)
    if not _hash(expected_operation_sha256) or operation_hash != expected_operation_sha256:
        raise ValueError('transport_operation_changed')
    kernel_fence(manifest)
    runtime_before = inspect_runtime()
    # A later separately reviewed change must bind causal/fresh-resource gates.
    return execute_production(operation)


def _execute(operation, manifest, operation_hash, runtime_before=None, outer_seconds=450, release_seconds=1):
    # Timing injection is a private local-fixture seam, never manifest-configured.
    if not 0 < outer_seconds <= 450 or not 0 < release_seconds <= 1:
        raise ValueError('transport_fixture_bound_invalid')
    parent_pid = os.getpid()
    gate_parent, gate_child = socket.socketpair()
    stdout_read, stdout_write = os.pipe()
    stderr_read, stderr_write = os.pipe()
    child = os.fork()
    if child == 0:
        try:
            gate_parent.close()
            os.close(stdout_read); os.close(stderr_read)
            libc = ctypes.CDLL(None, use_errno=True)
            if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0 or os.getppid() != parent_pid:
                os._exit(4)
            for selected in (signal.SIGCHLD, signal.SIGALRM, signal.SIGTERM, signal.SIGINT):
                signal.signal(selected, signal.SIG_DFL)
            signal.pthread_sigmask(signal.SIG_SETMASK, set())
            signal.setitimer(signal.ITIMER_REAL, 0)
            os.dup2(stdout_write, 1); os.dup2(stderr_write, 2)
            os.dup2(gate_child.fileno(), 3)
            if gate_child.fileno() != 3:
                gate_child.close()
            os.set_inheritable(3, True)
            null = os.open('/dev/null', os.O_RDONLY)
            os.dup2(null, 0)
            if null != 0:
                os.close(null)
            os.execv(sys.executable, [sys.executable, '-I', '-B', '-S', str(operation / 'entry' / 'idle_entry.py'), str(operation), '3'])
        finally:
            os._exit(4)
    gate_child.close(); os.close(stdout_write); os.close(stderr_write)
    pidfd = None
    start = time.monotonic()
    status = None
    ready = False
    failure = None
    counts = [0, 0]
    captured = [bytearray(), bytearray()]
    open_pipes = {stdout_read, stderr_read}
    for descriptor in open_pipes:
        os.set_blocking(descriptor, False)
    try:
        pidfd = os.pidfd_open(child)
        child_ticks = ticks(child)
        if child == manifest['source']['pid'] or select.select([pidfd], [], [], 0)[0]:
            raise ValueError('transport_birth_invalid')
        gate_parent.settimeout(10)
        ready_raw = gate_parent.recv(1025)
        expected = {'phase': 'ready', 'pid': child, 'startTicks': child_ticks}
        if json.loads(ready_raw) != expected or ticks(child) != child_ticks:
            raise ValueError('transport_birth_invalid')
        durable(operation / 'records' / 'cli-birth.json', {'schema': 'qdrant.idle-cli-birth.v1', 'operationSha256': operation_hash, **expected})
        ready = True
        gate_parent.sendall(operation_hash.encode() + b'\n')
        gate_parent.close()
        while time.monotonic() - start < outer_seconds:
            readable = select.select([pidfd, *open_pipes], [], [], 0.05)[0]
            for index, descriptor in enumerate((stdout_read, stderr_read)):
                if descriptor in readable:
                    part = os.read(descriptor, 65536)
                    if not part:
                        open_pipes.discard(descriptor)
                    counts[index] += len(part)
                    captured[index].extend(part[:max(0, 32768-len(captured[index]))])
            if pidfd in readable:
                _, status = os.waitpid(child, 0)
                break
        if status is None:
            failure = 'transport_outer_deadline'
    except (ValueError, OSError, KeyError, IndexError, TypeError, TimeoutError, json.JSONDecodeError):
        failure = 'transport_pidfd_acquisition_failed' if pidfd is None else 'transport_protocol_failed'
    finally:
        gate_parent.close()
        if status is None and pidfd is None:
            # Closing GO prevents invocation. Reap only our direct fork child;
            # without a retained PID-fd no numeric PID may be signalled.
            end = time.monotonic() + release_seconds
            while time.monotonic() < end:
                reaped, candidate = os.waitpid(child, os.WNOHANG)
                if reaped == child:
                    status = candidate
                    break
                time.sleep(0.01)
        elif status is None:
            for chosen, wait in ((signal.SIGTERM, release_seconds), (signal.SIGKILL, release_seconds)):
                if not select.select([pidfd], [], [], 0)[0]:
                    try: signal.pidfd_send_signal(pidfd, chosen)
                    except ProcessLookupError: pass
                if select.select([pidfd], [], [], wait)[0]:
                    _, status = os.waitpid(child, 0)
                    break
        # Finite final drain; EOF from inherited descendant pipes is not needed.
        drain_end = time.monotonic() + 0.05
        while open_pipes and time.monotonic() < drain_end:
            readable = select.select(list(open_pipes), [], [], max(0, drain_end-time.monotonic()))[0]
            for index, descriptor in enumerate((stdout_read, stderr_read)):
                if descriptor in readable:
                    part = os.read(descriptor, 65536)
                    if not part:
                        open_pipes.discard(descriptor)
                    counts[index] += len(part)
                    captured[index].extend(part[:max(0, 32768-len(captured[index]))])
        if pidfd is not None:
            os.close(pidfd)
        os.close(stdout_read); os.close(stderr_read)
    receipt = None
    verified = False
    try:
        receipt = json.loads(read_owned(operation / 'records' / 'entry-result.json', 0o600, 32768))
        if set(receipt) != {'schema', 'operationSha256', 'entrySha256', 'inputHashes', 'helperResult'} or receipt['schema'] != 'qdrant.idle-entry-result.v1' or receipt['operationSha256'] != operation_hash or receipt['entrySha256'] != manifest['entrySha256'] or receipt['inputHashes'] != manifest['inputHashes']:
            raise ValueError('transport_receipt_invalid')
        result = receipt['helperResult']
        verify_helper_result(result, manifest, operation / 'records' / 'inner.jsonl')
        expected_exit = {'pass': 0, 'inconclusive': 2, 'refused': 3}.get(result['outcome'], 4)
        if status is None or os.waitstatus_to_exitcode(status) != expected_exit:
            raise ValueError('transport_receipt_invalid')
        verified = True
    except (ValueError, OSError, KeyError, TypeError, json.JSONDecodeError):
        failure = failure or 'transport_receipt_unproven'
    output = {'schema': 'qdrant.idle-outer-result.v1', 'operationSha256': operation_hash,
        'cliExitCode': None if status is None else os.waitstatus_to_exitcode(status), 'cliExited': status is not None,
        'birthCommitted': ready, 'authoritativeReceiptVerified': verified,
        'helperResult': receipt['helperResult'] if verified else None, 'reason': failure,
        'stdoutBytes': counts[0], 'stderrBytes': counts[1], 'captureOverflow': any(value > 32768 for value in counts),
        'unknownEarlyChildrenPossible': True, 'holderExitUnknown': True}
    if runtime_before is not None:
        output['runtimeBefore'] = runtime_before
        try:
            after = inspect_runtime()
            output['runtimeAfter'] = after
            if any(after[key] != runtime_before[key] for key in ('directoryDevice', 'directoryInode')) or runtime_before['lock'] is not None and after['lock'] != runtime_before['lock']:
                raise ValueError('transport_runtime_changed')
        except (ValueError, OSError):
            output['reason'] = 'transport_runtime_changed'
            output['authoritativeReceiptVerified'] = False
    durable(operation / 'records' / 'outer-result.json', output)
    return output
