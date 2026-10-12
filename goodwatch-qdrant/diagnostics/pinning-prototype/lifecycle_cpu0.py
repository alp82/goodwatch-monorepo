"""Explicit owned-clone child-only TERM and lifecycle continuity.

No default action or production target. All callers must hold the one control
lock and authenticate these bytes before import. PIDFD exit readiness proves
birth disappearance; child exit status is inferred from the reviewed wrapper
and Docker State, never claimed as a non-parent wait result on Linux 6.8.
"""
from contextlib import contextmanager
from datetime import datetime, timezone
import errno
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import select
import re
import signal
import stat
import sys
import time
import tempfile
import subprocess

ROOT = Path('/root/goodwatch-qdrant-cold-406-20261011')
OLD = 'gw-qdrant-cold-406-20261011'
NEW = 'gw-qdrant-cpu0-100-20261012'
IMAGE = 'sha256:dd57172b0bbebb29b0a96a37c1f378a317449730c36cdfe68feabe36e740a92b'
SCRIPT_SHA = 'f773b9c6df212eb34cfcffaa932b27a713e9d477492d2b5b40eb8f8cc5f2475e'
STOP_SECONDS = 20
PORT = {'6333/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '16333'}]}
MOUNTS = frozenset(((str(ROOT/'store'), '/qdrant/storage', 'bind', True),
                   (str(ROOT/'runtime-snapshots'), '/qdrant/snapshots', 'bind', True),
                   (str(ROOT/'rename-proof/media-20261011T041503Z.snapshot'),
                    '/qdrant/snapshots/fixture.snapshot', 'bind', False)))
REASONS = frozenset(('lifecycle_target_refused', 'lifecycle_freeze_changed',
    'lifecycle_process_changed', 'lifecycle_wrapper_unreviewed',
    'lifecycle_recovery_allowed', 'lifecycle_membership_changed',
    'lifecycle_connection_present', 'lifecycle_connection_unknown',
    'lifecycle_reader_placement', 'lifecycle_lock_unproven',
    'lifecycle_stop_timeout', 'lifecycle_stop_unclean',
    'lifecycle_clean_receipt_missing', 'lifecycle_handoff_changed',
    'lifecycle_handoff_invalid', 'lifecycle_fork_scope_active',
    'lifecycle_guard_or_runtime_failure', 'lifecycle_pidfd_close_failed',
    'lifecycle_lock_close_failed', 'lifecycle_handoff_cleanup_failed',
    'lifecycle_interpreter_unsupported', 'lifecycle_docker_unavailable',
    'lifecycle_docker_cleanup_failed'))


def require_interpreter():
    if sys.version_info < (3, 11):
        raise RuntimeError('lifecycle_interpreter_unsupported')
    try:
        expected=Path('/usr/bin/python3').resolve(strict=True)
        declared=Path(sys.executable).resolve(strict=True)
        actual=Path('/proc/self/exe').stat();target=expected.stat()
        if declared!=expected or (actual.st_dev,actual.st_ino)!=(target.st_dev,target.st_ino) or not stat.S_ISREG(actual.st_mode):raise ValueError()
    except (OSError,ValueError):
        raise RuntimeError('lifecycle_interpreter_unsupported') from None


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def utc():
    return datetime.now(timezone.utc).isoformat()


def bounded(path, limit):
    with Path(path).open('rb') as stream:
        data = stream.read(limit+1)
    if len(data) > limit:
        raise RuntimeError('lifecycle_process_changed')
    return data


def unified(data):
    try:
        rows = data.decode().splitlines()
        if len(rows) != 1 or not rows[0].startswith('0::/'):
            raise ValueError()
        path = rows[0][3:]
        if any(p in ('.', '..') for p in path.split('/')) or '//' in path or (path != '/' and path.endswith('/')) or any(ord(c) < 32 for c in path):
            raise ValueError()
        return path
    except (UnicodeError, ValueError):
        raise RuntimeError('lifecycle_process_changed') from None


def birth(pid, proc=Path('/proc')):
    if type(pid) is not int or pid <= 0:
        raise RuntimeError('lifecycle_process_changed')
    raw = bounded(proc/str(pid)/'stat', 8192).decode()
    fields = raw[raw.rfind(')')+2:].split()
    value = int(fields[19])
    if value <= 0:
        raise RuntimeError('lifecycle_process_changed')
    return value


def process(pid, proc=Path('/proc')):
    before = birth(pid, proc)
    d = proc/str(pid)
    raw = bounded(d/'stat', 8192).decode()
    fields = raw[raw.rfind(')')+2:].split()
    group = bounded(d/'cgroup', 8192)
    path = unified(group)
    exe = os.readlink(d/'exe')
    info = (d/'exe').stat()
    comm = bounded(d/'comm', 256).decode().strip()
    status = bounded(d/'status', 65536).decode()
    locked = [int(row.split()[1])*1024 for row in status.splitlines() if row.startswith('VmLck:')]
    if len(locked) != 1 or locked[0] != 0 or birth(pid, proc) != before:
        raise RuntimeError('lifecycle_process_changed')
    return {'pid': pid, 'startTicks': before, 'parentPid': int(fields[1]),
            'comm': comm, 'exeBasename': Path(exe).name,
            'exeIdentityHash': digest(canonical([info.st_dev, info.st_ino, info.st_size])),
            'group': path, 'groupHash': digest(group), 'VmLckBytes': 0}


def public_process(value):
    return {k: value[k] for k in ('pid', 'startTicks', 'parentPid',
                                 'exeIdentityHash', 'groupHash', 'VmLckBytes')}


def require_lock(fd):
    info = os.fstat(fd)
    target = (ROOT/'control.lock').lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_nlink != 1 or stat.S_IMODE(info.st_mode) != 0o600 or (info.st_dev, info.st_ino) != (target.st_dev, target.st_ino):
        raise RuntimeError('lifecycle_lock_unproven')
    proven = False
    for row in bounded(Path('/proc/self/fdinfo')/str(fd), 8192).decode().splitlines():
        found = re.fullmatch(r'lock:\s+\d+:\s+FLOCK\s+ADVISORY\s+WRITE\s+(\d+)\s+([0-9a-fA-F]+):([0-9a-fA-F]+):(\d+)\s+0\s+EOF', row)
        if found and tuple(int(found[i], 16 if i in (2, 3) else 10) for i in (1, 2, 3, 4)) == (os.getpid(), os.major(info.st_dev), os.minor(info.st_dev), info.st_ino):
            proven = True
    if not proven:
        raise RuntimeError('lifecycle_lock_unproven')
    # Separate open must conflict: acquiring it would mean this fd has no lock.
    probe = os.open(ROOT/'control.lock', os.O_RDWR | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        try:
            fcntl.flock(probe, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            pass
        else:
            raise RuntimeError('lifecycle_lock_unproven')
    finally:
        os.close(probe)
    os.set_inheritable(fd, False)


def container(name, docker):
    if name not in (OLD, NEW):
        raise RuntimeError('lifecycle_target_refused')
    if ROOT.resolve() != ROOT:
        raise RuntimeError('lifecycle_target_refused')
    rows = json.loads(docker('inspect', name))
    if len(rows) != 1:
        raise RuntimeError('lifecycle_target_refused')
    x = rows[0]; c = x['Config']; h = x['HostConfig']; state = x['State']
    expected_cpu = 2_000_000_000 if name == OLD else 0
    tuples = [(m['Source'], m['Destination'], m['Type'], m['RW']) for m in x['Mounts']]
    if x['Name'] != '/'+name or x['Image'] != IMAGE or c.get('Labels', {}).get('goodwatch.task') != '406' or c.get('Labels', {}).get('goodwatch.owner') != 'search-100-diagnosis' or len(tuples) != 3 or frozenset(tuples) != MOUNTS:
        raise RuntimeError('lifecycle_target_refused')
    if h['Memory'] != 6*1024**3 or h['MemorySwap'] != 6*1024**3 or type(h['NanoCpus']) is not int or h['NanoCpus'] != expected_cpu or h['PortBindings'] != PORT or h['RestartPolicy'] != {'Name': 'no', 'MaximumRetryCount': 0}:
        raise RuntimeError('lifecycle_target_refused')
    if name == NEW and (type(h['CpuQuota']) is not int or h['CpuQuota'] != 0 or type(h['CpuPeriod']) is not int or h['CpuPeriod'] != 0 or h['CpusetCpus'] != '' or h['CpusetMems'] != ''):
        raise RuntimeError('lifecycle_target_refused')
    if c.get('WorkingDir') != '/qdrant' or c.get('Cmd') != ['./entrypoint.sh'] or c.get('Entrypoint') not in (None, []):
        raise RuntimeError('lifecycle_wrapper_unreviewed')
    if any(type(state.get(k)) is not bool for k in ('Running', 'OOMKilled')) or type(state.get('ExitCode')) is not int or type(state.get('Pid')) is not int or type(x.get('RestartCount')) is not int:
        raise RuntimeError('lifecycle_target_refused')
    # Values stay private; only the config hash and derived boolean are emitted.
    env = c.get('Env', [])
    if not isinstance(env, list) or any(not isinstance(v, str) for v in env):
        raise RuntimeError('lifecycle_wrapper_unreviewed')
    options = [v.split('=', 1)[1] for v in env if v.startswith('QDRANT_ALLOW_RECOVERY_MODE=')]
    if len(options) > 1 or (options and options[0] != 'false'):
        raise RuntimeError('lifecycle_recovery_allowed')
    return x


def mounted_identities(wrapper, proc=Path('/proc')):
    result = []
    for source, destination, _, writable in sorted(MOUNTS):
        path = Path(source)
        if path.resolve() != path:
            raise RuntimeError('lifecycle_target_refused')
        a = path.lstat()
        actual = proc/str(wrapper['pid'])/'root'/destination.lstrip('/')
        b = actual.stat(follow_symlinks=False)
        expected_kind = stat.S_ISDIR if writable else stat.S_ISREG
        if not expected_kind(a.st_mode) or not expected_kind(b.st_mode) or (a.st_dev, a.st_ino) != (b.st_dev, b.st_ino):
            raise RuntimeError('lifecycle_target_refused')
        result.append((destination, a.st_dev, a.st_ino, stat.S_IFMT(a.st_mode)))
    return digest(canonical(result))


def state_snapshot(x):
    s = x['State']
    return {'containerIdHash': digest(x['Id'].encode()), 'running': s['Running'],
            'startedAt': s['StartedAt'], 'finishedAt': s['FinishedAt'],
            'restartCount': x['RestartCount'], 'exitCode': s['ExitCode'],
            'OOMKilled': s['OOMKilled'],
            'configurationHash': digest(canonical([x['Config'], x['HostConfig'],
                sorted((m['Source'], m['Destination'], m['Type'], m['RW']) for m in x['Mounts'])]))}


def script(wrapper, proc=Path('/proc')):
    d = proc/str(wrapper['pid'])
    # /proc/PID/root is an intentional kernel magic-link boundary. Only the
    # fixed leaf is O_NOFOLLOW; birth and FD/path identity fence the read.
    path = d/'root/qdrant/entrypoint.sh'
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_size > 4096:
            raise RuntimeError('lifecycle_wrapper_unreviewed')
        raw = os.read(fd, 4097); after = os.fstat(fd); current = path.stat(follow_symlinks=False)
        sig = lambda v: (v.st_dev, v.st_ino, v.st_size, v.st_mtime_ns)
        if sig(before) != sig(after) or sig(after) != sig(current) or len(raw) != before.st_size or digest(raw) != SCRIPT_SHA:
            raise RuntimeError('lifecycle_wrapper_unreviewed')
    finally:
        os.close(fd)
    argv = bounded(d/'cmdline', 4096).split(b'\0')
    if argv[-1:] != [b'']:
        raise RuntimeError('lifecycle_wrapper_unreviewed')
    argv = argv[:-1]
    if len(argv) != 2 or argv[0] not in (b'bash', b'/bin/bash', b'/usr/bin/bash') or argv[1] not in (b'./entrypoint.sh', b'/qdrant/entrypoint.sh') or wrapper['exeBasename'] != 'bash':
        raise RuntimeError('lifecycle_wrapper_unreviewed')
    # Read only this fixed key in memory. No environment data is returned.
    env = bounded(d/'environ', 131072).split(b'\0')
    values = [v.split(b'=', 1)[1] for v in env if v.startswith(b'QDRANT_ALLOW_RECOVERY_MODE=')]
    if len(values) > 1 or (values and values[0] != b'false'):
        raise RuntimeError('lifecycle_recovery_allowed')
    if birth(wrapper['pid'], proc) != wrapper['startTicks']:
        raise RuntimeError('lifecycle_process_changed')
    return {'scriptSha256': SCRIPT_SHA, 'wrapperArgvHash': digest(b'\0'.join(argv)),
            'RecoveryAllowed': False}


def no_clients(wrapper, proc=Path('/proc')):
    # Fixed Qdrant HTTP/GRPC local ports; LISTEN/TIME_WAIT are not live clients.
    count = 0
    for table in ('tcp', 'tcp6'):
        data = bounded(proc/str(wrapper['pid'])/'net'/table, 65536)
        lines = data.decode().splitlines()
        if not lines or len(lines) > 512:
            raise RuntimeError('lifecycle_connection_unknown')
        try:
            for line in lines[1:]:
                fields = line.split(); port = int(fields[1].rsplit(':', 1)[1], 16)
                state = int(fields[3], 16)
                if port in (6333, 6334) and state not in (0x0A, 0x06, 0x07):
                    count += 1
        except (ValueError, IndexError):
            raise RuntimeError('lifecycle_connection_unknown') from None
    if count:
        raise RuntimeError('lifecycle_connection_present')
    return {'activeServiceConnections': 0, 'connectionCensusComplete': True}


def attest(name, docker, proc=Path('/proc'), cgroups=Path('/sys/fs/cgroup')):
    x = container(name, docker)
    if x['State']['Running'] is not True or x['State']['OOMKilled']:
        raise RuntimeError('lifecycle_clean_receipt_missing')
    wrapper = process(x['State']['Pid'], proc)
    group = wrapper['group']
    cg = cgroups/group.lstrip('/')
    if group == '/' or cg.resolve() != cg:
        raise RuntimeError('lifecycle_membership_changed')
    raw = bounded(cg/'cgroup.procs', 512)
    members = [int(v) for v in raw.split()]
    if len(members) != 2 or len(set(members)) != 2 or wrapper['pid'] not in members:
        raise RuntimeError('lifecycle_membership_changed')
    qpid = next(pid for pid in members if pid != wrapper['pid'])
    child = process(qpid, proc)
    if child['parentPid'] != wrapper['pid'] or child['comm'] != 'qdrant' or child['exeBasename'] != 'qdrant' or child['group'] != group:
        raise RuntimeError('lifecycle_membership_changed')
    own = process(os.getpid(), proc)
    if own['group'] == group or own['group'].startswith(group.rstrip('/')+'/'):
        raise RuntimeError('lifecycle_reader_placement')
    script_proof = script(wrapper, proc)
    mount_identity = mounted_identities(wrapper, proc)
    clients = no_clients(wrapper, proc)
    if mounted_identities(wrapper, proc) != mount_identity or bounded(cg/'cgroup.procs', 512) != raw or birth(wrapper['pid'], proc) != wrapper['startTicks'] or birth(child['pid'], proc) != child['startTicks'] or state_snapshot(container(name, docker)) != state_snapshot(x):
        raise RuntimeError('lifecycle_process_changed')
    if process(os.getpid(), proc) != own:
        raise RuntimeError('lifecycle_reader_placement')
    return {'state': state_snapshot(x), 'wrapper': public_process(wrapper),
            'qdrant': public_process(child), **script_proof, **clients,
            'liveMountIdentityHash': mount_identity,
            'readerOutsideSourceSubtree': True, 'readerVmLckBytes': 0}


def birth_gone(pid, ticks, proc=Path('/proc')):
    try:
        return birth(pid, proc) != ticks
    except FileNotFoundError:
        return True


def wait_births(qpid, qticks, wpid, wticks, pidfd, started,
                clock=time.monotonic, sleep=time.sleep, proc=Path('/proc')):
    poll = select.poll(); poll.register(pidfd, select.POLLIN)
    while clock()-started < STOP_SECONDS:
        ready = poll.poll(0)
        if ready and birth_gone(qpid, qticks, proc) and birth_gone(wpid, wticks, proc):
            return
        sleep(min(.05, max(0, STOP_SECONDS-(clock()-started))))
    raise RuntimeError('lifecycle_stop_timeout')


def clean_state(before, after, wall_start, wall_end, elapsed):
    stable = ('containerIdHash', 'configurationHash', 'startedAt', 'restartCount')
    try:
        finished = datetime.fromisoformat(after['finishedAt'].replace('Z', '+00:00'))
        low = datetime.fromisoformat(wall_start); high = datetime.fromisoformat(wall_end)
    except (ValueError, TypeError):
        raise RuntimeError('lifecycle_stop_unclean') from None
    if any(value.tzinfo is None for value in (finished, low, high)) or type(elapsed) not in (int, float) or not math.isfinite(elapsed):
        raise RuntimeError('lifecycle_stop_unclean')
    if any(before[k] != after[k] for k in stable) or after['running'] is not False or type(after['exitCode']) is not int or after['exitCode'] != 0 or after['OOMKilled'] is not False or before['finishedAt'] == after['finishedAt'] or not low <= finished <= high or not 0 <= elapsed <= STOP_SECONDS:
        raise RuntimeError('lifecycle_stop_unclean')


def action_inspector(started):
    """Fixed read-only Docker inspect consumes the same stop deadline."""
    def inspect(*args):
        remaining=STOP_SECONDS-(time.monotonic()-started)
        if remaining<=0:raise RuntimeError('lifecycle_stop_timeout')
        if len(args)!=2 or args[0]!='inspect' or args[1] not in (OLD,NEW):raise RuntimeError('lifecycle_target_refused')
        child=None;primary=None
        try:
            child=subprocess.Popen(['/usr/bin/docker',*args],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,close_fds=True)
            chunks=[];size=0
            while True:
                remaining=STOP_SECONDS-(time.monotonic()-started)
                if remaining<=0:raise RuntimeError('lifecycle_stop_timeout')
                ready,_,_=select.select([child.stdout],[],[],remaining)
                if not ready:raise RuntimeError('lifecycle_stop_timeout')
                raw=os.read(child.stdout.fileno(),min(65536,1024**2+1-size))
                if not raw:break
                chunks.append(raw);size+=len(raw)
                if size>1024**2:raise RuntimeError('lifecycle_docker_unavailable')
            remaining=STOP_SECONDS-(time.monotonic()-started)
            if remaining<=0:raise RuntimeError('lifecycle_stop_timeout')
            if child.wait(timeout=remaining)!=0:raise RuntimeError('lifecycle_docker_unavailable')
            return b''.join(chunks).decode()
        except subprocess.TimeoutExpired:
            primary=RuntimeError('lifecycle_stop_timeout');raise primary from None
        except (OSError,UnicodeError):
            primary=RuntimeError('lifecycle_docker_unavailable');raise primary from None
        except BaseException as error:
            primary=error;raise
        finally:
            if child is not None:
                # Only our direct inspect CLI child; never a Qdrant PID/group.
                try:
                    if child.poll() is None:
                        child.terminate()
                        try:child.wait(timeout=1)
                        except subprocess.TimeoutExpired:
                            child.kill();child.wait(timeout=1)
                    child.stdout.close()
                except BaseException:
                    if primary is None:raise RuntimeError('lifecycle_docker_unavailable') from None
                    primary.lifecycleCleanupFailure='lifecycle_docker_cleanup_failed'
                    primary.lifecycleDockerCleanupEvidence={'pid':child.pid,'clientGone':child.poll() is not None,'exitCode':child.returncode}
    return inspect


def graceful_stop(name, docker, lock_fd, protected_pids=(), expected=None):
    """Only the authenticated Qdrant child is the explicit protected exception."""
    started = time.monotonic(); wall_start = utc()
    before = None; after = None; fd = None; sent = False; completed = None
    docker=action_inspector(started)
    try:
        require_interpreter()
        require_lock(lock_fd)
        before = attest(name, docker)
        if expected is not None and before != expected:
            raise RuntimeError('lifecycle_handoff_changed')
        q = before['qdrant']; w = before['wrapper']
        # Callers protect parents/readers/wrapper/other clone processes. This
        # exact authenticated child is never selected by set subtraction.
        if q['pid'] in set(protected_pids) or q['pid'] in (os.getpid(), os.getppid(), w['pid']):
            raise RuntimeError('lifecycle_target_refused')
        fd = os.pidfd_open(q['pid'], 0)
        require_lock(lock_fd)
        if attest(name, docker) != before or birth(q['pid']) != q['startTicks']:
            raise RuntimeError('lifecycle_process_changed')
        if time.monotonic()-started >= STOP_SECONDS:
            raise RuntimeError('lifecycle_stop_timeout')
        signal.pidfd_send_signal(fd, signal.SIGTERM, None, 0)
        sent = True
        wait_births(q['pid'], q['startTicks'], w['pid'], w['startTicks'], fd, started)
        after = state_snapshot(container(name, docker))
        wall_end = utc(); elapsed = time.monotonic()-started
        clean_state(before['state'], after, wall_start, wall_end, elapsed)
        require_lock(lock_fd)
        completed = {'schema': 'clone-child-term.clean.v1', 'target': name,
                'before': before, 'after': after, 'wallStartedAt': wall_start,
                'wallFinishedAt': wall_end, 'elapsedSeconds': elapsed,
                'qdrantBirthGone': True, 'wrapperBirthGone': True,
                'childExitStatusObserved': False,
                'childExitZeroInferredFromWrapperAndDocker': True,
                'signal': 'SIGTERM', 'killFallback': False, 'clean': True}
        return completed
    except BaseException as error:
        def disappearance(key):
            if before is None:
                return None
            try:
                value = before[key]
                return birth_gone(value['pid'], value['startTicks'])
            except BaseException:
                return None
        # Do not spend a new Docker call outside the shared stop deadline.
        # after is the already-observed final state if one was acquired.
        reason = str(error) if type(error) is RuntimeError and str(error) in REASONS else 'lifecycle_guard_or_runtime_failure'
        error.lifecycleFailureEvidence = {
            'schema': 'clone-child-term.failed.v1',
            'target': name if name in (OLD, NEW) else 'not-allowed',
            'reason': reason, 'before': before, 'after': after,
            'beforeStatus': 'observed' if before is not None else 'unavailable',
            'afterStatus': 'observed' if after is not None else 'unavailable',
            'wallStartedAt': wall_start, 'wallFinishedAt': utc(),
            'elapsedSeconds': time.monotonic()-started,
            'signalSent': sent, 'signal': 'SIGTERM' if sent else None,
            'qdrantBirthGone': disappearance('qdrant'),
            'wrapperBirthGone': disappearance('wrapper'),
            'childExitStatusObserved': False, 'killFallback': False,
            'clean': False, 'lateObservationCannotPromoteClean': True,
            'privateErrorOmitted': True}
        raise
    finally:
        original = sys.exc_info()[1]
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                if original is None:
                    error=RuntimeError('lifecycle_pidfd_close_failed')
                    error.lifecycleCompletedStopReceipt=completed
                    error.lifecycleCleanupFailure='lifecycle_pidfd_close_failed'
                    raise error from None
                original.lifecycleCleanupFailure = 'lifecycle_pidfd_close_failed'


def require_clean_receipt(snapshot, receipt):
    if not isinstance(receipt, dict) or receipt.get('schema') != 'clone-child-term.clean.v1' or receipt.get('clean') is not True or receipt.get('qdrantBirthGone') is not True or receipt.get('wrapperBirthGone') is not True or receipt.get('after') != snapshot or snapshot['running'] is not False:
        raise RuntimeError('lifecycle_clean_receipt_missing')
    try:
        clean_state(receipt['before']['state'], receipt['after'],
                    receipt['wallStartedAt'], receipt['wallFinishedAt'],
                    receipt['elapsedSeconds'])
        if receipt['before']['scriptSha256'] != SCRIPT_SHA or receipt['before']['RecoveryAllowed'] is not False or receipt.get('signal') != 'SIGTERM' or receipt.get('killFallback') is not False or receipt.get('childExitStatusObserved') is not False or receipt.get('childExitZeroInferredFromWrapperAndDocker') is not True:
            raise RuntimeError('lifecycle_clean_receipt_missing')
        for key in ('qdrant', 'wrapper'):
            row = receipt['before'][key]
            if type(row['pid']) is not int or type(row['startTicks']) is not int or row['pid'] <= 0 or row['startTicks'] <= 0 or not birth_gone(row['pid'], row['startTicks']):
                raise RuntimeError('lifecycle_clean_receipt_missing')
    except (KeyError, TypeError, ValueError):
        raise RuntimeError('lifecycle_clean_receipt_missing') from None


def compare_handoff(previous, current):
    if previous != current:
        raise RuntimeError('lifecycle_handoff_changed')


def secure_json(path):
    """Only the two fixed public lifecycle receipt paths; no private input."""
    if path not in (ROOT/'cpu0-old-clean-receipt-v1.json', ROOT/'cpu0-lifecycle-handoff-v1.json') or path.resolve() != path:
        raise RuntimeError('lifecycle_handoff_invalid')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        a = os.fstat(fd)
        if not stat.S_ISREG(a.st_mode) or a.st_uid != os.geteuid() or a.st_nlink != 1 or stat.S_IMODE(a.st_mode) != 0o600 or a.st_size > 32768:
            raise RuntimeError('lifecycle_handoff_invalid')
        raw = os.read(fd, 32769); b = os.fstat(fd); c = path.lstat()
        sig = lambda s: (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns, s.st_uid, s.st_mode, s.st_nlink)
        if len(raw) != a.st_size or sig(a) != sig(b) or sig(b) != sig(c):
            raise RuntimeError('lifecycle_handoff_changed')
        return json.loads(raw), digest(raw), sig(c)
    finally:
        os.close(fd)


def pair_snapshot(docker):
    old = state_snapshot(container(OLD, docker))
    receipt, receipt_sha, _ = secure_json(ROOT/'cpu0-old-clean-receipt-v1.json')
    if receipt.get('target') != OLD:
        raise RuntimeError('lifecycle_clean_receipt_missing')
    require_clean_receipt(old, receipt)
    new = attest(NEW, docker)
    return {'variant': 'cpu0-owned-lifecycle.v1', 'oldStopped': old,
            'oldCleanReceiptSha256': receipt_sha, 'newRunning': new}


def read_handoff(docker, expected_sha):
    if not isinstance(expected_sha, str) or len(expected_sha) != 64 or any(c not in '0123456789abcdef' for c in expected_sha):
        raise RuntimeError('lifecycle_handoff_invalid')
    record, found, _ = secure_json(ROOT/'cpu0-lifecycle-handoff-v1.json')
    if found != expected_sha or record.get('schema') != 'clone-lifecycle-handoff.cpu0.v1':
        raise RuntimeError('lifecycle_handoff_changed')
    compare_handoff(record['snapshot'], pair_snapshot(docker))
    return record


def commit_handoff(docker, expected_sha, owner):
    path = ROOT/'cpu0-lifecycle-handoff-v1.json'
    prior, found, identity = secure_json(path)
    if found != expected_sha or owner not in ('controller', 'turnover', 'preflight', 'stager', 'outer'):
        raise RuntimeError('lifecycle_handoff_changed')
    record = {'schema': 'clone-lifecycle-handoff.cpu0.v1', 'owner': owner,
              'previousSha256': found, 'snapshot': pair_snapshot(docker)}
    raw = canonical(record)+b'\n'
    fd, temporary = tempfile.mkstemp(prefix='.cpu0-handoff-', dir=ROOT)
    temp_identity = (os.fstat(fd).st_dev, os.fstat(fd).st_ino)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'wb') as output:
            output.write(raw); output.flush(); os.fsync(output.fileno())
        _, now, current = secure_json(path)
        if now != found or current != identity:
            raise RuntimeError('lifecycle_handoff_changed')
        os.replace(temporary, path); temporary = None
        directory = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
        return {**record, 'sha256': digest(raw)}
    finally:
        original = sys.exc_info()[1]
        if temporary is not None:
            try:
                current = Path(temporary).lstat()
                if (current.st_dev, current.st_ino) == temp_identity:
                    os.unlink(temporary)
            except BaseException:
                if original is None:
                    raise RuntimeError('lifecycle_handoff_cleanup_failed') from None
                original.lifecycleCleanupFailure='lifecycle_handoff_cleanup_failed'


# register_at_fork has no unregister operation. One immutable callback is
# installed; its process-local scope is active only around the exact helper.
_FORK_FD = None


def _child_close_control():
    global _FORK_FD
    fd = _FORK_FD; _FORK_FD = None
    if fd is not None:
        try:
            os.close(fd)
        except OSError:
            os._exit(127)


require_interpreter()
os.register_at_fork(after_in_child=_child_close_control)


@contextmanager
def helper_fork_scope(lock_fd):
    global _FORK_FD
    if _FORK_FD is not None:
        raise RuntimeError('lifecycle_fork_scope_active')
    require_lock(lock_fd); _FORK_FD = lock_fd
    try:
        yield
    finally:
        original = sys.exc_info()[1]
        _FORK_FD = None
        try:
            require_lock(lock_fd)
        except BaseException as cleanup:
            if original is None:
                raise
            original.lifecycleCleanupFailure = str(cleanup) if type(cleanup) is RuntimeError and str(cleanup) in REASONS else 'lifecycle_lock_unproven'
