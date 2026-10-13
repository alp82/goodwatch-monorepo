"""The processes a predictor runs in. Started by run.py as its own Python process; never imported by it.

    python3 -s -P -B sandbox.py        (the job arrives on standard input; two folders arrive as open descriptors)

Why it is built this way. In T1 every other member's ratings are visible to the predictor. So the view of member A
shows member B's ratings, which are hidden in the view of member B. The same predictor code runs on both. The
hidden labels are therefore only absent if nothing at all can pass from one view's process to another's: no file,
no memory, no kernel object, no message. The rules below are that requirement, not decoration.

One process per view, and what it is given
- For every view a fresh process is forked from a worker that holds only label-free things: numpy, the title data,
  the predictor's source text. The worker keeps nothing a predictor process produced: answers and logs move from
  pipes into files inside the kernel (splice), and the per-view facts (seconds, memory) are written to files by a
  helper process that exits.
- The predictor is loaded from its source text under a module name made from the file's hash, so two predictors
  with the same file name cannot meet. It can import numpy, scipy, sklearn and the standard library; the worker
  imports whatever the file's import statements name before any view is opened, because afterwards the predictor
  process cannot read the disk.

What the predictor process cannot do (the kernel enforces each line; the process cannot undo any of them)
- Files (Landlock): it may read its own view folder and nothing else; it may write nothing. No pack, no gate, no
  answer file, no other view, no ledger, no repository, not even Python's own files.
- System calls (seccomp): no new process and no exec; no socket; no shared memory, message queue or semaphore; no
  kernel keyring; no signal to another process; no look into another process; no change to any file's size, times,
  owner or mode and no file lock (Landlock on this kernel covers none of those); no change of priority, limits or
  namespaces.
- Namespaces: its own process, IPC and network namespace inside a user namespace without network, when the
  machine allows it. This repeats what seccomp already forbids; a run without it is marked in the ledger, and
  registered and gate runs refuse to run without it.
- Descriptors: only its answer pipe (3), its notes pipe (4) and its own log pipe (1 and 2). Not the output folder,
  whose name is random and is not in this process's memory.
- Limits: address space, CPU seconds, wall-clock seconds.
- Harness state: none. Once the process is confined it raises `_Ready`, which carries the predictor's source, a
  module name made from its hash and the view, and unwinds every harness frame up to the top of this file. `predict`
  is then called from `_serve`, whose frame and the frames under it hold no job, no view list, no view id, no
  folder, no report. The predictor is compiled under the name `<predictor_HASH>` and has no `__file__`.

What is reported: an audit hook in the predictor process notes every attempt to open or list a path, start a
process or open a socket, and refuses it. Each note is written to the notes pipe the moment it is made, so a
predictor cannot take one back. The report is advisory: a predictor can add false notes, close the pipe, or go
around Python through the C library, where it is stopped without a note. Landlock and seccomp are the boundary.

What still connects two predictor processes that run at the same moment: the load they put on the machine. Runs
that count (registered, gate, verify) therefore run one view at a time; other runs run two.
"""
import json
import os
import sys


def leave_network():
    """A new user and network namespace: no route to anything. Must run before threads exist."""
    uid, gid = os.getuid(), os.getgid()
    try:
        os.unshare(os.CLONE_NEWUSER | os.CLONE_NEWNET)
    except (OSError, AttributeError):
        return False
    try:
        with open('/proc/self/setgroups', 'w') as f:
            f.write('deny')
        with open('/proc/self/uid_map', 'w') as f:
            f.write(f'{uid} {uid} 1')
        with open('/proc/self/gid_map', 'w') as f:
            f.write(f'{gid} {gid} 1')
    except OSError:
        pass
    return True


NET_ISOLATED = leave_network() if __name__ == '__main__' else False

import ast  # noqa: E402
import ctypes  # noqa: E402
import fcntl  # noqa: E402
import gc  # noqa: E402
import resource  # noqa: E402
import select  # noqa: E402
import signal  # noqa: E402
import time  # noqa: E402
import traceback  # noqa: E402
import types  # noqa: E402

LIBC = ctypes.CDLL(None, use_errno=True)
ALLOWED_PACKAGES = ('numpy', 'scipy', 'sklearn')
NUMPY_PARTS = ('numpy.linalg', 'numpy.fft', 'numpy.ma', 'numpy.random', 'numpy.polynomial', 'numpy.lib.stride_tricks',
               'numpy.lib.recfunctions', 'numpy.strings', 'numpy.char', 'numpy.rec')
ANSWER_LIMIT = 64 << 20
LOG_LIMIT = 256 << 10
NOTES_LIMIT = 64 << 10
ANSWER_FD, NOTES_FD = 3, 4                             # the predictor process's two pipes, always these numbers

# ------------------------------------------------------------------ Landlock: files

_FS_EXECUTE, _FS_WRITE_FILE, _FS_READ_FILE, _FS_READ_DIR = 1 << 0, 1 << 1, 1 << 2, 1 << 3
_FS_ALL_V1 = (1 << 13) - 1
_FS_REFER = 1 << 13
_FS_FILE_RIGHTS = _FS_EXECUTE | _FS_WRITE_FILE | _FS_READ_FILE
_READ = _FS_READ_FILE | _FS_READ_DIR
_WRITE = _READ | _FS_WRITE_FILE | (1 << 4) | (1 << 5) | (1 << 6) | (1 << 7) | (1 << 8) | (1 << 9) | (1 << 10) | \
    (1 << 11) | (1 << 12)
SYSTEM_READ = ('/usr', '/lib', '/lib64', '/etc/ld.so.cache', '/etc/localtime', '/dev/null', '/dev/urandom',
               '/proc/cpuinfo', '/proc/meminfo', '/sys/devices/system/cpu')


class _RulesetAttr(ctypes.Structure):
    _fields_ = [('handled_access_fs', ctypes.c_uint64)]


class _PathBeneath(ctypes.Structure):
    _pack_ = 1
    _layout_ = 'ms'
    _fields_ = [('allowed_access', ctypes.c_uint64), ('parent_fd', ctypes.c_int32)]


def landlock(read=(), write=()):
    """Restrict this process, for good, to reading under `read` and reading and writing under `write` (paths or
    open folders). Raises when the kernel cannot enforce it: a predictor never runs unconfined."""
    abi = LIBC.syscall(444, None, 0, 1)
    if abi < 1:
        raise RuntimeError('Landlock is not available; the harness does not run predictors without it')
    attr = _RulesetAttr(_FS_ALL_V1 | (_FS_REFER if abi >= 2 else 0))
    ruleset = LIBC.syscall(444, ctypes.byref(attr), ctypes.sizeof(attr), 0)
    if ruleset < 0:
        raise RuntimeError(f'landlock_create_ruleset failed: errno {ctypes.get_errno()}')
    for places, rights in ((read, _READ), (write, _WRITE)):
        for place in places:
            if isinstance(place, int):
                fd, is_dir, own = place, True, False
            elif os.path.exists(place):
                fd, is_dir, own = os.open(place, os.O_PATH | os.O_CLOEXEC), os.path.isdir(place), True
            else:
                continue
            rule = _PathBeneath(rights if is_dir else rights & _FS_FILE_RIGHTS, fd)
            if LIBC.syscall(445, ruleset, 1, ctypes.byref(rule), 0) != 0:
                raise RuntimeError(f'landlock_add_rule failed for {place}: errno {ctypes.get_errno()}')
            if own:
                os.close(fd)
    if LIBC.prctl(38, 1, 0, 0, 0) != 0:               # PR_SET_NO_NEW_PRIVS
        raise RuntimeError('prctl(PR_SET_NO_NEW_PRIVS) failed')
    if LIBC.syscall(446, ruleset, 0) != 0:
        raise RuntimeError(f'landlock_restrict_self failed: errno {ctypes.get_errno()}')
    os.close(ruleset)


# ------------------------------------------------------------------ seccomp: system calls

# x86-64 system call numbers the predictor process may not use (they answer "operation not permitted").
DENIED = {
    'new processes and exec': (57, 58, 59, 322),                       # fork vfork execve execveat
    'sockets': (41, 53, 425, 426, 427),                                # socket socketpair io_uring_*
    'System V and POSIX IPC': (29, 30, 31, 64, 65, 66, 67, 68, 69, 70, 71, 240, 241, 242, 243, 244, 245),
    'kernel keyrings': (248, 249, 250),
    'signals to other processes': (62, 200, 234, 129, 297, 424),       # kill tkill tgkill rt_*sigqueueinfo pidfd
    'other processes': (101, 310, 311, 312, 434, 438, 440, 448),       # ptrace process_vm_* kcmp pidfd_* ...
    'file size, times, owner, mode, attributes, locks': (76, 77, 132, 235, 261, 280, 90, 91, 268, 452, 92, 93, 94,
                                                          260, 188, 189, 190, 197, 198, 199, 285, 73),
    'priority and limits of processes': (141, 142, 144, 203, 314, 251, 302, 160),
    'mounts and namespaces': (165, 166, 155, 161, 272, 308, 428, 429, 430, 431, 432, 433, 442),
    'kernel features': (321, 298, 323, 447, 303, 304, 300, 301, 253, 294, 254, 169, 170, 171, 246, 320, 175, 313,
                        176, 163, 164, 227, 305, 159, 167, 168, 134, 180),
}
_CLONE, _CLONE3, _CLONE_THREAD = 56, 435, 0x10000
_FCNTL, _FCNTL_LOCKS = 72, (5, 6, 7, 36, 37, 38)       # F_GETLK F_SETLK F_SETLKW and the open-file-description ones


class _SockFilter(ctypes.Structure):
    _fields_ = [('code', ctypes.c_uint16), ('jt', ctypes.c_uint8), ('jf', ctypes.c_uint8), ('k', ctypes.c_uint32)]


class _SockFprog(ctypes.Structure):
    _fields_ = [('len', ctypes.c_uint16), ('filter', ctypes.POINTER(_SockFilter))]


def _seccomp_program():
    ld, jeq, jge, jset, ret = 0x20, 0x15, 0x35, 0x45, 0x06
    allow, eperm, enosys = 0x7fff0000, 0x00050000 | 1, 0x00050000 | 38
    ins = [(ld, 0, 0, 4), (jeq, 1, 0, 0xC000003E), (ret, 0, 0, eperm),           # x86-64 only
           (ld, 0, 0, 0), (jge, 0, 1, 0x40000000), (ret, 0, 0, eperm),           # no x32 calls
           (jeq, 0, 1, _CLONE3), (ret, 0, 0, enosys)]                            # the C library falls back to clone
    for numbers in DENIED.values():
        for nr in numbers:
            ins += [(jeq, 0, 1, nr), (ret, 0, 0, eperm)]
    locks = [(jeq, 0, 1, cmd) if i % 2 == 0 else (ret, 0, 0, eperm) for cmd in _FCNTL_LOCKS for i in range(2)]
    ins += [(jeq, 0, len(locks) + 2, _FCNTL), (ld, 0, 0, 24)] + locks + [(ret, 0, 0, allow)]   # fcntl: no file locks
    ins += [(jeq, 0, 3, _CLONE), (ld, 0, 0, 16), (jset, 1, 0, _CLONE_THREAD), (ret, 0, 0, eperm),   # threads only
            (ret, 0, 0, allow)]
    array = (_SockFilter * len(ins))(*[_SockFilter(*i) for i in ins])
    return _SockFprog(len(ins), array), array


if os.uname().machine != 'x86_64':
    raise RuntimeError('the sandbox knows the system call numbers of x86-64 only')
_PROGRAM, _PROGRAM_KEEP = _seccomp_program()


def seccomp():
    if LIBC.prctl(38, 1, 0, 0, 0) != 0 or LIBC.prctl(22, 2, ctypes.byref(_PROGRAM), 0, 0) != 0:
        raise RuntimeError(f'seccomp could not be installed: errno {ctypes.get_errno()}')


# ------------------------------------------------------------------ the report

_PATH_EVENTS = ('open', 'os.listdir', 'os.scandir', 'os.chdir', 'os.mkdir', 'os.remove', 'os.rename', 'os.rmdir',
                'os.symlink', 'os.link', 'os.truncate', 'os.chmod', 'os.chown', 'os.utime', 'os.walk', 'glob.glob',
                'shutil.copyfile', 'sqlite3.connect', 'os.setxattr', 'os.getxattr', 'os.listxattr')
_DENIED_EVENTS = ('subprocess.Popen', 'os.system', 'os.exec', 'os.posix_spawn', 'os.spawn', 'os.fork', 'os.forkpty',
                  'pty.spawn', 'socket.connect', 'socket.bind', 'socket.getaddrinfo', 'socket.gethostbyname',
                  'socket.sendto', 'socket.__new__', 'urllib.Request', 'http.client.connect', 'ftplib.connect',
                  'smtplib.connect', 'os.kill', 'os.killpg', 'webbrowser.open', 'os.unshare', 'os.setns',
                  'resource.setrlimit', 'resource.prlimit', 'os.setpriority', 'os.sched_setaffinity')


def _install_hook():
    """Note and refuse. The hook holds nothing but the number of the notes pipe; from here on the harness's own
    code in this process touches descriptors only, which the hook lets pass."""
    write, dumps, fd = os.write, json.dumps, NOTES_FD

    def hook(event, args):
        if event in _PATH_EVENTS:
            path = args[0] if args else None
            if path is None or isinstance(path, int):
                return
            what = str(path)[:300]
        elif event in _DENIED_EVENTS:
            what = str(args[:2])[:300]
        else:
            return
        try:
            write(fd, (dumps([event, what]) + '\n').encode())
        except OSError:
            pass
        raise PermissionError(f'the harness does not let a predictor do this: {event} {what}')

    sys.addaudithook(hook)


def _describe(value, name):
    import numpy as np
    if value is None:
        return None
    try:
        a = np.asarray(value)
        if a.dtype.kind not in 'fiub':
            return {'error': f'{name} is not numeric ({a.dtype})'}
        return {'shape': list(a.shape), 'values': a.astype(float).ravel().tolist()}
    except Exception as e:                            # noqa: BLE001
        return {'error': f'{name} cannot be read as numbers: {type(e).__name__}: {e}'}


# ------------------------------------------------------------------ the predictor process

class _Ready(BaseException):
    """Raised in the predictor process once it is confined. It carries what `predict` needs (the source, a module
    name, the view) and unwinds every harness frame on its way to the top of this file."""


def _write_answer(fd, answer):
    data = json.dumps(answer).encode()
    while data:
        data = data[os.write(fd, data):]


def _confine(job, vid, titles, source, answer_fd, notes_fd, log_fd, load_view):
    """Runs in the innermost process: loads the view, shuts everything else, and raises _Ready. Never returns."""
    out = answer_fd
    try:
        LIBC.prctl(1, signal.SIGKILL, 0, 0, 0)        # die with the helper that started this process
        os.dup2(log_fd, 1)
        os.dup2(log_fd, 2)
        view_fd = os.open(vid, os.O_PATH | os.O_DIRECTORY, dir_fd=job['views_fd'])
        landlock(read=(view_fd,))
        data = load_view(view_fd, titles)
        os.close(0)                                   # no standard input; nothing shared with another view
        answer_fd = fcntl.fcntl(answer_fd, fcntl.F_DUPFD, 100)
        notes_fd = fcntl.fcntl(notes_fd, fcntl.F_DUPFD, 100)
        os.closerange(3, 100)
        os.dup2(answer_fd, ANSWER_FD)
        os.dup2(notes_fd, NOTES_FD)
        out = ANSWER_FD
        os.closerange(NOTES_FD + 1, 4096)
        os.chdir('/')
        limit = int(job['memory_mb']) << 20
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
        resource.setrlimit(resource.RLIMIT_CPU, (int(job['cpu_seconds']), int(job['cpu_seconds']) + 5))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        seccomp()
        ready = _Ready(source, job['module'], data)
    except BaseException as e:                        # noqa: BLE001
        try:
            _write_answer(out, {'returned': 'error', 'error': f'the harness could not confine the process: '
                                                               f'{type(e).__name__}: {e}'[:2000]})
        finally:
            os._exit(0)
    raise ready


def _trace(error, source, name):
    """A traceback without a file read: lines of the predictor's own source, names for everything else."""
    lines = source.decode('utf-8', 'replace').splitlines()
    out, tb = [], error.__traceback__
    while tb is not None:
        code = tb.tb_frame.f_code
        row = f'  File "{code.co_filename}", line {tb.tb_lineno}, in {code.co_name}'
        if code.co_filename == name and 0 < tb.tb_lineno <= len(lines):
            row += '\n    ' + lines[tb.tb_lineno - 1].strip()
        out.append(row)
        tb = tb.tb_next
    return ('\n'.join(out) + f'\n{type(error).__name__}: {error}')[-3000:]


def _serve(source, name, view):
    """The predictor process after every harness frame is gone: load the predictor, call it, write the answer.
    This frame holds the source, the module name and the view, which is what the predictor has anyway."""
    _install_hook()
    try:
        module = types.ModuleType(name)
        sys.modules[name] = module
        exec(compile(source, f'<{name}>', 'exec'), module.__dict__)
        result = module.predict(view)
        if not isinstance(result, dict):
            answer = {'returned': type(result).__name__}
        else:
            answer = {'returned': 'dict', 'keys': sorted(str(k) for k in result)}
            for key in ('rank', 'score', 'p_low'):
                answer[key] = _describe(result.get(key), key)
    except BaseException as e:                        # noqa: BLE001
        answer = {'returned': 'error', 'error': f'{type(e).__name__}: {e}'[:2000],
                  'trace': _trace(e, source, f'<{name}>')}
    try:
        _write_answer(ANSWER_FD, answer)
        sys.stdout.flush()
        sys.stderr.flush()
    finally:
        os._exit(0)


def _child(fn, *args):
    """What a forked child does: run fn and exit. Only _Ready passes, on its way to the top."""
    try:
        fn(*args)
    except _Ready:
        raise
    except BaseException:                             # noqa: BLE001
        traceback.print_exc()
        os._exit(1)
    os._exit(0)


def _helper(job, vid, titles, source, answer_fd, notes_fd, log_fd, load_view, start):
    """Between the worker and the predictor process: owns the namespaces, keeps the wall clock, writes the facts
    of this one view to a file and exits. Runs no predictor code and reads no answer."""
    signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGCHLD})
    namespaces = True
    try:
        os.unshare(os.CLONE_NEWPID | os.CLONE_NEWIPC | os.CLONE_NEWNET)
    except (OSError, AttributeError):
        namespaces = False
    pid = os.fork()
    if pid == 0:
        signal.pthread_sigmask(signal.SIG_UNBLOCK, {signal.SIGCHLD})
        _confine(job, vid, titles, source, answer_fd, notes_fd, log_fd, load_view)
    os.close(answer_fd)
    os.close(notes_fd)
    os.close(log_fd)
    timed_out = signal.sigtimedwait({signal.SIGCHLD}, float(job['wall_seconds'])) is None
    if timed_out:
        os.kill(pid, signal.SIGKILL)
    _, status, usage = os.wait4(pid, 0)
    facts = {'seconds': round(time.time() - start, 4), 'peak_mb': round(usage.ru_maxrss / 1024, 1),
             'namespaces': namespaces, 'timed_out': timed_out,
             'ended': f'signal {os.WTERMSIG(status)}' if os.WIFSIGNALED(status) else f'exit {os.WEXITSTATUS(status)}'}
    fd = os.open(f'{vid}.facts', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=job['out_fd'])
    os.write(fd, json.dumps(facts).encode())
    os._exit(0)


def _run_view(job, vid, titles, source, load_view, null_fd):
    """Fork the helper for one view and move its answer, its notes and its log into files without reading them."""
    answer_r, answer_w = os.pipe()
    notes_r, notes_w = os.pipe()
    log_r, log_w = os.pipe()
    start = time.time()
    pid = os.fork()
    if pid == 0:
        for fd in (answer_r, notes_r, log_r):
            os.close(fd)
        _child(_helper, job, vid, titles, source, answer_w, notes_w, log_w, load_view, start)
    for fd in (answer_w, notes_w, log_w):
        os.close(fd)
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    moved = {answer_r: [os.open(f'{vid}.answer', flags, 0o600, dir_fd=job['out_fd']), 0, ANSWER_LIMIT],
             notes_r: [os.open(f'{vid}.notes', flags, 0o600, dir_fd=job['out_fd']), 0, NOTES_LIMIT],
             log_r: [os.open(f'{vid}.log', flags, 0o600, dir_fd=job['out_fd']), 0, LOG_LIMIT]}
    deadline = start + float(job['wall_seconds']) + 20
    live = set(moved)
    while live:
        left = deadline - time.time()
        ready = select.select(list(live), [], [], left)[0] if left > 0 else []
        if not ready:
            os.kill(pid, signal.SIGKILL)
            break
        for fd in ready:
            to, size, limit = moved[fd]
            n = os.splice(fd, to if size < limit else null_fd, 1 << 20)
            if n == 0:
                live.discard(fd)
            moved[fd][1] = size + n
            if fd == answer_r and size + n > limit:
                os.kill(pid, signal.SIGKILL)
                live.clear()
    for fd, (to, _, _) in moved.items():
        os.close(fd)
        os.close(to)
    os.waitpid(pid, 0)


def _run_views(job, part, titles, source, load_view, null_fd):
    for vid in part:
        _run_view(job, vid, titles, source, load_view, null_fd)


# ------------------------------------------------------------------ the worker

def preload(source, path):
    """Import what the predictor's import statements name, so the predictor process needs no file. Only the
    standard library, numpy, scipy and sklearn."""
    tree = ast.parse(source, path)
    names = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names += [(a.name, True) for a in node.names]
        elif isinstance(node, ast.ImportFrom):
            if node.level or not node.module:
                raise ImportError('a predictor is one file: relative imports are not possible')
            names.append((node.module, True))
            names += [(f'{node.module}.{a.name}', False) for a in node.names]
    for name, required in names:
        root = name.split('.')[0]
        if root not in sys.stdlib_module_names and root not in ALLOWED_PACKAGES:
            raise ImportError(f'a predictor may import the standard library, numpy, scipy and sklearn, not {root}')
        try:
            __import__(name)
        except ImportError:
            if required:
                raise


def shared_writable_mappings(maps):
    """Memory this process shares writably with its children would connect one view to the next. `maps` is
    /proc/self/maps, opened before the process lost the right to open it."""
    maps.seek(0)
    return [line.strip() for line in maps if len(line.split()) > 1 and line.split()[1][1] == 'w'
            and line.split()[1][3] == 's']


def main():
    job = json.loads(sys.stdin.read())
    os.dup2(os.open('/dev/null', os.O_RDONLY), 0)
    out_fd = job['out_fd']

    def finish(facts, code):
        fd = os.open('worker.facts', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600, dir_fd=out_fd)
        os.write(fd, json.dumps(facts).encode())
        os.close(fd)
        sys.exit(code)

    import numpy  # noqa: F401
    lab = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, lab)
    from views import load_titles, load_view
    sys.path.remove(lab)                               # a predictor imports from the system's Python only
    sys.path_importer_cache.clear()
    titles = load_titles(job['titles'])
    with open(job['predictor'], 'rb') as f:
        source = f.read()
    null_fd = os.open('/dev/null', os.O_WRONLY)
    maps = open('/proc/self/maps')
    sys.dont_write_bytecode = True
    os.chdir('/')
    landlock(read=SYSTEM_READ + (job['views_fd'],), write=(out_fd,))
    facts = {'landlock': True, 'seccomp': True, 'net_isolated': NET_ISOLATED}
    try:
        for name in NUMPY_PARTS:
            try:
                __import__(name)
            except ImportError:
                pass
        preload(source, job['predictor'])
    except BaseException as e:                         # noqa: BLE001
        finish({**facts, 'error': f'the predictor cannot be loaded: {type(e).__name__}: {e}'}, 0)
    shared = shared_writable_mappings(maps)
    maps.close()
    if shared:
        finish({**facts, 'error': f'the worker shares writable memory with its children: {shared[:3]}'}, 0)

    parts = [job['view_list'][i::int(job['workers'])] for i in range(int(job['workers']))]
    pids = []
    for part in parts:
        pid = os.fork()
        if pid == 0:
            _child(_run_views, job, part, titles, source, load_view, null_fd)
        pids.append(pid)
    ok = all(os.waitpid(pid, 0)[1] == 0 for pid in pids)
    finish(facts if ok else {**facts, 'error': 'a worker process ended early'}, 0)


def _top():
    try:
        main()                                         # the worker returns from here by sys.exit
    except _Ready as ready:
        go = ready.args                                # this is a predictor process; the harness frames are gone
    else:
        return
    for name in ('__file__', '__cached__', '__loader__', '__spec__'):
        globals().pop(name, None)
    gc.collect()
    _serve(*go)


if __name__ == '__main__':
    _top()
