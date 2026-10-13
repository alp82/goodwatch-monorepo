"""Leak canary: a predictor that tries every way it can think of to find the hidden ratings.

Where it finds a target's rating it returns it as the score; everywhere else it returns the median of the member's
visible ratings, exactly as rung B0 does. So if the sandbox holds, its error equals B0's for every member, and the
harness reports the attempts. If anything leaks, its error drops below B0's and the control fails.

What it tries (each attempt is printed to the log):
 1. the files an insider knows: the pack, the tier list, the owner file, the answer files, other runs' views, the
    ledger, the webapp's .env. The harness gives a predictor no path, not even its own (it has no `__file__`), so
    the canary takes the lab folder and the data root from the harness's own module `common`, which is loaded in
    the process it runs in;
 2. the folder it runs in, its temporary folder, and any folder a descriptor was left open on: sibling views (a
    later block of the same member holds this block's ratings as history), the answer file beside the run;
 3. /proc: its own and its parent's command line, environment, working folder and open files;
 4. file descriptors it may have inherited;
 5. other processes: cat and find through subprocess and os.system;
 6. the C library directly (open through ctypes), which Python's audit hook does not see;
 7. the network: a socket to this machine;
 8. the harness's own objects: every frame above it (for a job, a view id, a view list, the report or its
    switch) and everything the garbage collector knows;
 9. a note from one view to the next (another member's view shows this member's ratings): shared memory, and
    probes of what else could carry one: file times, sizes, modes and locks, the kernel keyring, unix sockets,
    message queues, signals, priorities, a lingering process.

Two safety rules, because this file is dangerous outside the sandbox:
- It refuses to run unless the process is under a seccomp filter (the harness sandbox), or TASTE_CANARY_ROOT is set.
- With TASTE_CANARY_ROOT set it does one thing only: read packs, answer files and views under that folder. That is
  the test that the canary can find answers when nothing confines it; it is run on a made-up pack.
- Anything under a folder named `gate` is never touched, not even opened: the gate file is tier B, and a canary
  that breaks out must not reach it. Landlock's rule does not depend on the path (only the view folder is
  readable), so the pack file and the answer files stand in for it.
"""
import ctypes
import gc
import glob
import json
import os
import pickle
import socket
import subprocess
import sys

import numpy as np

LOG = []


def note(what, outcome):
    LOG.append(f'{what}: {outcome}')


def attempt(what, fn):
    try:
        got = fn()
        note(what, 'GOT ' + (repr(got)[:80] if got is not None else 'nothing'))
        return got
    except BaseException as e:                         # noqa: BLE001
        note(what, f'refused ({type(e).__name__})')
        return None


def is_gate(path):
    return 'gate' in os.path.abspath(path).split(os.sep)


def read(path):
    with open(path, 'rb') as f:
        return f.read()


def from_pack(data, view, found):
    """Ratings of the predicted member in a pack: the member is the one the view's others lack."""
    obj = pickle.loads(data)
    r = obj['ratings']
    keys = view['titles']['key']
    targets = {int(keys[t]): int(t) for t in view['targets']['title']}
    seen = set(int(keys[t]) for t in view['me']['ratings']['title'])
    others = set(view['others']['ratings']['member'].tolist())
    for u in set(r['member'].tolist()) - others:
        at = r['member'] == u
        mine = set(r['title_key'][at].tolist())
        if seen <= mine:
            for k, s in zip(r['title_key'][at].tolist(), r['score'][at].tolist()):
                if k in targets:
                    found[targets[k]] = s


def arrays_of(data):
    """The harness's own file format (views.save_arrays): a magic word, a JSON header, the bytes."""
    if data[:8] != b'TASTEVW1':
        raise ValueError('not a view file')
    n = int.from_bytes(data[8:16], 'little')
    out = {}
    for h in json.loads(data[16:16 + n]):
        count = int(np.prod(h['shape'], dtype=np.int64))
        out[h['name']] = np.frombuffer(data, np.dtype(h['dtype']), count, 16 + n + h['offset']).reshape(h['shape'])
    return out


def from_bin(data, view, found):
    """Another view of the same member (a later block holds this block's ratings as history) or an answer file
    (<view>.title and <view>.score, for exactly these targets)."""
    targets = set(view['targets']['title'].tolist())
    mine = set(view['me']['ratings']['title'].tolist())
    z = arrays_of(data)
    if 'me.ratings.title' in z:
        title, score = z['me.ratings.title'].tolist(), z['me.ratings.score'].tolist()
        if mine <= set(title):
            for a, b in zip(title, score):
                if a in targets:
                    found.setdefault(a, b)
        return
    for name in z:
        if name.endswith('.title') and name[:-5] + 'score' in z:
            title = z[name].tolist()
            if set(title) == targets:
                for a, b in zip(title, z[name[:-5] + 'score'].tolist()):
                    found[a] = b


def harvest(path, view, found):
    if is_gate(path):                                  # tier B: never touched
        return 'skipped: under a gate folder'
    data = read(path)
    if path.endswith('pack.pkl'):
        from_pack(data, view, found)
    elif path.endswith('.bin'):
        from_bin(data, view, found)
    return len(data)


def search(root, view, found, depth=4):
    """Walk a folder for packs, answer files and other views."""
    count = 0
    for folder, folders, files in os.walk(root):
        folders[:] = [d for d in folders if d != 'gate']      # tier B: never entered
        if is_gate(folder) or folder.count(os.sep) - root.count(os.sep) > depth:
            continue
        for name in files:
            if name == 'pack.pkl' or name.endswith('.bin'):
                try:
                    harvest(os.path.join(folder, name), view, found)
                    count += 1
                except Exception:                      # noqa: BLE001
                    pass
    return count or None


def shm_note(view, found):
    """A System V shared memory segment with a fixed key. Read what an earlier view left (the ratings it saw of
    every other member, among them this member's), then leave this view's own."""
    libc = ctypes.CDLL(None, use_errno=True)
    libc.shmat.restype = ctypes.c_void_p
    key, hits = 0x7A57E001, 0
    r = view['others']['ratings']
    table = np.c_[r['member'], r['title'], r['score']].astype(np.int32)
    keys = set(view['targets']['title'].tolist())
    others = set(r['member'].tolist())
    shmid = libc.shmget(key, 0, 0)
    if shmid >= 0:
        address = libc.shmat(shmid, None, 0)
        n = ctypes.cast(address, ctypes.POINTER(ctypes.c_int32))[0]
        rows = np.ctypeslib.as_array(ctypes.cast(address + 4, ctypes.POINTER(ctypes.c_int32)), (n * 3,)).reshape(n, 3)
        for member, title, score in rows.tolist():
            if member not in others and title in keys:
                found[title] = score
                hits += 1
        return hits or None
    shmid = libc.shmget(key, 4 + table.nbytes, 0o1600)
    if shmid < 0:
        raise PermissionError(ctypes.get_errno())
    address = libc.shmat(shmid, None, 0)
    ctypes.cast(address, ctypes.POINTER(ctypes.c_int32))[0] = len(table)
    ctypes.memmove(address + 4, table.tobytes(), table.nbytes)
    return 'left a note'


def answer(view, found):
    n = len(view['targets']['title'])
    y = view['me']['ratings']['score']
    median = float(np.median(y)) if len(y) else 7.0
    score = np.array([float(found.get(int(t), median)) for t in view['targets']['title']])
    print(f'leak canary: {len(found)} of {n} target ratings found\n  ' + '\n  '.join(LOG), file=sys.stderr)
    return {'rank': np.zeros(n), 'score': score, 'p_low': None}


def predict(view):
    del LOG[:]
    found = {}
    libc = ctypes.CDLL(None, use_errno=True)
    test_root = os.environ.get('TASTE_CANARY_ROOT')
    if test_root:                                      # the canary's own test: files under one folder, nothing else
        attempt(f'walk {test_root}', lambda: search(test_root, view, found, depth=8))
        return answer(view, found)
    if libc.prctl(21, 0, 0, 0, 0) != 2:                # PR_GET_SECCOMP: 2 is filter mode
        raise RuntimeError('the leak canary runs only inside the harness sandbox')

    note('__file__ of the predictor', repr(globals().get('__file__')))
    common = sys.modules.get('common')                 # the harness's own constants, loaded in this process
    lab = getattr(common, 'LAB', None) or '/nonexistent/docs/research/taste-loop/lab'
    data = getattr(common, 'DATA_ROOT', None) or '/nonexistent/goodwatch-research/taste'
    pack_folder = getattr(common, 'PACK_FOLDER', None) or os.path.join(data, 'packs', 'none')
    note('lab folder and data root taken from the harness', f'{lab} {data}')
    here = os.path.join(lab, 'controls', 'predictors', 'leak_canary.py')
    home = os.path.dirname(os.path.dirname(data))
    repo = lab.split('/docs/research/')[0]
    pack_file = os.path.join(pack_folder, 'pack.pkl')

    # 1. what an insider knows
    for pattern in ('packs/*/pack.pkl', 'work/keys/*.bin', 'work/runs/*/views/*/view.bin'):
        hits = attempt(f'glob {pattern}', lambda p=pattern: glob.glob(os.path.join(data, p)) or None) or []
        for path in hits[:50]:
            attempt(f'read {path}', lambda p=path: harvest(p, view, found))
            if path.endswith('pack.pkl'):
                pack_file = path
    for path in (pack_file, os.path.join(data, 'tiers.json'), os.path.join(data, 'owner'),
                 os.path.join(data, 'key'), os.path.join(repo, 'docs/research/taste-loop/ledger.jsonl'),
                 os.path.join(repo, 'goodwatch-webapp/.env'),
                 os.path.join(home, 'projects/goodwatch-monorepo/goodwatch-webapp/.env'),
                 os.path.join(repo, 'docs/research/taste-loop/lab/pack.py'), '/etc/passwd'):
        attempt(f'read {path}', lambda p=path: harvest(p, view, found))
    attempt(f'walk {data}', lambda: search(data, view, found))

    # 2. where it runs
    cwd = attempt('getcwd', os.getcwd) or '/'
    attempt('list cwd', lambda: os.listdir(cwd))
    roots = [cwd, os.environ.get('TMPDIR', '/tmp')]
    for fd in range(3, 32):                            # a folder left open would show where the run lives
        where = attempt(f'folder behind descriptor {fd}', lambda f=fd: os.readlink(f'/proc/self/fd/{f}'))
        if where and where.startswith('/'):
            roots += [where, os.path.dirname(where), os.path.dirname(os.path.dirname(where))]
    for root in dict.fromkeys(roots):
        if root != '/':
            attempt(f'walk {root}', lambda r=root: search(r, view, found, depth=4))

    # 3. /proc
    for pid in ('self', str(os.getppid())):
        for name in ('cmdline', 'environ', 'maps', 'mem'):
            attempt(f'/proc/{pid}/{name}', lambda p=f'/proc/{pid}/{name}': read(p)[:60])
        attempt(f'/proc/{pid}/cwd', lambda p=f'/proc/{pid}/cwd': os.readlink(p))
        attempt(f'/proc/{pid}/fd', lambda p=f'/proc/{pid}/fd': os.listdir(p))

    # 4. inherited file descriptors
    def fds():
        got = []
        for fd in range(3, 64):
            try:
                os.lseek(fd, 0, 0)
                got.append((fd, os.read(fd, 40)))
            except OSError:
                pass
        return got or None
    attempt('inherited file descriptors', fds)

    # 5. other processes
    attempt('subprocess cat', lambda: subprocess.run(['/usr/bin/cat', pack_file], capture_output=True).stdout[:40]
            or None)
    attempt('subprocess find', lambda: subprocess.run(['/usr/bin/find', data, '-name', '*.bin'],
                                                      capture_output=True).stdout[:200] or None)
    attempt('os.system', lambda: os.system(f'cat {pack_file} > /dev/null') or None)

    def fork(how):
        pid = how()
        if pid == 0:
            os._exit(0)
        if pid < 0:
            raise PermissionError(ctypes.get_errno())
        os.waitpid(pid, 0)
        return 'forked'
    attempt('os.fork', lambda: fork(os.fork))
    attempt('fork (libc)', lambda: fork(libc.fork))

    # 6. the C library, past the audit hook
    def raw_open(path, take=1 << 26):
        if is_gate(path):                              # tier B: never touched
            raise PermissionError('skipped: under a gate folder')
        fd = libc.open(path.encode(), 0)
        if fd < 0:
            raise PermissionError(ctypes.get_errno())
        buf = ctypes.create_string_buffer(take)
        size = libc.read(fd, buf, take)
        libc.close(fd)
        return buf.raw[:size]
    raw = attempt(f'libc open {pack_file}', lambda: raw_open(pack_file))
    if raw:
        attempt('use it', lambda: from_pack(raw, view, found))

    # 7. the network (this machine only)
    def connect():
        s = socket.socket()
        s.settimeout(1)
        try:
            s.connect(('127.0.0.1', 9))
        except ConnectionRefusedError:
            return 'the network is reachable (connection refused by this machine)'
        finally:
            s.close()
        return 'connected'
    attempt('socket to 127.0.0.1', connect)

    def call(name, *args):
        ctypes.set_errno(0)
        code = getattr(libc, name)(*args)
        if code < 0:
            raise PermissionError(ctypes.get_errno())
        return f'{name} worked'
    attempt('socket (libc)', lambda: call('socket', 2, 1, 0))

    # 9. a note from one view to the next: the view of another member shows this member's ratings
    attempt('shared memory note', lambda: shm_note(view, found))
    own = here.encode()
    size = attempt('stat of its own file', lambda: os.stat(here).st_size)
    attempt('file times (os.utime)', lambda: os.utime(here))
    attempt('file times (libc utimensat)', lambda: call('utimensat', -100, own, None, 0))
    if size:
        attempt('file size (libc truncate to the same size)', lambda: call('truncate', own, ctypes.c_long(size)))
    attempt('file mode (libc chmod to the same mode)', lambda: call('chmod', own, os.stat(here).st_mode & 0o7777))
    attempt('file lock (flock)', lambda: call('flock', 1, 1 | 4))
    attempt('kernel keyring (add_key)', lambda: call('syscall', 248, b'user', b'taste-canary', b'x', 1, -4))
    attempt('unix socket (libc)', lambda: call('socket', 1, 1, 0))
    attempt('message queue (msgget)', lambda: call('msgget', 0x7A57E002, 0o1600))
    attempt('signal to the parent', lambda: call('kill', os.getppid(), 0))
    attempt('process list', lambda: [p for p in os.listdir('/proc') if p.isdigit()][:5] or None)
    attempt('unshare (libc)', lambda: call('unshare', 0x08000000))

    # 8. the harness's own objects
    def frames():
        hits, chain, f = [], ['predict'], sys._getframe(0)
        wanted = ('job', 'vid', 'notes', 'state', 'view_list', 'parts', 'part', 'out_fd', 'views_fd')
        while f.f_code.co_name != 'predict':
            f = f.f_back
        f = f.f_back                                   # the frame that called predict, and on down
        while f:
            chain.append(f.f_code.co_name)
            for name, value in list(f.f_locals.items()):
                if name in wanted and not f.f_code.co_name.startswith('<'):
                    hits.append((f.f_code.co_name, name))
                if isinstance(value, dict) and value is not view and \
                        any(k in ('rank', 'answer', 'results', 'keys', 'view_list', 'views_fd', 'titles', 'predictor')
                            for k in value if isinstance(k, str)) and value is not view.get('titles'):
                    hits.append((f.f_code.co_name, name, sorted(str(k) for k in value)[:6]))
            f = f.f_back
        note('frames from predict down', ' < '.join(chain))
        return hits or None
    attempt('frames above', frames)

    def heap():
        hits = 0
        targets = set(view['targets']['title'].tolist())
        for obj in gc.get_objects():
            if isinstance(obj, dict) and 'score' in obj and 'title' in obj and obj is not view['me']['ratings'] \
                    and obj is not view['others']['ratings']:
                try:
                    if len(obj['title']) == len(obj['score']):
                        for a, b in zip(np.asarray(obj['title']).tolist(), np.asarray(obj['score']).tolist()):
                            if a in targets:
                                found.setdefault(a, b)
                                hits += 1
                except Exception:                      # noqa: BLE001
                    pass
        return hits or None
    attempt('objects in memory', heap)

    def earlier_answers():
        hits = [type(o).__name__ for o in gc.get_objects()
                if isinstance(o, dict) and len(o) < 50
                and (('returned' in o and 'attempts' in o) or ('values' in o and 'shape' in o))]
        return hits[:5] or None
    attempt('answers of earlier views in memory', earlier_answers)
    return answer(view, found)
