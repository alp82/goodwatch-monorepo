"""Paths, hashes and small helpers shared by the harness files. No member data is read here."""
import hashlib
import json
import os
import pwd
import subprocess

import numpy as np

LAB = os.path.dirname(os.path.abspath(__file__))
LOOP = os.path.dirname(LAB)                          # docs/research/taste-loop
LADDER = os.path.join(LAB, 'ladder')
CONTROL_PREDICTORS = os.path.join(LAB, 'controls', 'predictors')
MANIFEST = os.path.join(LOOP, 'MANIFEST.json')       # the committed copy of the pack's manifest
PINS = os.path.join(LAB, 'pins.json')                # the sha256 of every rung and every control predictor
HARNESS_FILES = ('common.py', 'pack.py', 'views.py', 'sandbox.py', 'score.py', 'stats.py', 'run.py', 'run.sh',
                 'gate.py', 'pins.json')
SEED = 20261013                                      # bootstrap, folds and controls; the seed of the tier split
DRAWS = 10000
BUDGET = {'explore': 20, 'registered': 3}            # per item, for candidate predictors
CONTROLS = ('shuffled', 'planted', 'leak', 'contract', 'clash', 'rankscale')
OTHERS = ('all', 'before', 'no-owner')
PREDICTOR_BYTES = 64 << 10
NAT = np.iinfo(np.int64).min


def loop_pack():
    """(folder, sha256 of pack.pkl) of the one pack this loop folder's ledger belongs to, from the committed
    MANIFEST.json. `~` in the folder is the home of the account, whatever $HOME says, so no environment variable
    moves the pack, the work folder or the lock slots. (None, None) without a manifest."""
    try:
        with open(MANIFEST) as f:
            manifest = json.load(f)
        folder = manifest['pack_folder']
        if folder.startswith('~/'):
            folder = os.path.join(pwd.getpwuid(os.getuid()).pw_dir, folder[2:])
        return os.path.abspath(folder), manifest['files_sha256']['pack.pkl']
    except (OSError, ValueError, KeyError):
        return None, None


PACK_FOLDER = loop_pack()[0]
DATA_ROOT = os.path.dirname(os.path.dirname(PACK_FOLDER)) if PACK_FOLDER else None


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def sha256_arrays(arrays):
    """One hash over named arrays: names, dtypes, shapes and bytes, in name order."""
    h = hashlib.sha256()
    for name in sorted(arrays):
        a = np.ascontiguousarray(arrays[name])
        h.update(f'{name}|{a.dtype.str}|{a.shape}|'.encode())
        h.update(a.tobytes())
    return h.hexdigest()


def pins():
    """{path relative to the lab: sha256} of the files that run without a budget: the rungs of the ladder and the
    control predictors. pins.json is one of the harness files, so the harness hash changes with any of them."""
    with open(PINS) as f:
        return json.load(f)


def pinned(path, folder):
    """Is `path` a pinned file under `folder` (lab/ladder or lab/controls/predictors), unchanged?"""
    name = rel(os.path.realpath(path), os.path.realpath(LAB))
    return inside(path, folder) and pins().get(name) == sha256_file(path)


def harness_sha256():
    """The identity of the harness code, the ladder and the control predictors. This hash, not the git commit,
    says which code produced a ledger line."""
    h = hashlib.sha256()
    for name in HARNESS_FILES:
        h.update(f'{name}:{sha256_file(os.path.join(LAB, name))}\n'.encode())
    return h.hexdigest()


def git(args, cwd, text=True):
    return subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=text)


def inside(path, folder):
    """Is the file `path`, with every link followed, inside `folder`?"""
    path, folder = os.path.realpath(path), os.path.realpath(folder)
    return os.path.commonpath([path, folder]) == folder and path != folder


def read_ledger(path):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


def committed_bytes(path):
    """The content of `path` in the last commit of its repository; b'' when the file is not in it. None when the
    folder is not in a git repository at all."""
    folder = os.path.dirname(os.path.abspath(path))
    if git(['rev-parse', '--show-toplevel'], folder).returncode != 0:
        return None
    done = git(['show', f'HEAD:./{os.path.basename(path)}'], folder, text=False)
    return done.stdout if done.returncode == 0 else b''


def checked_ledger(path):
    """Every line that counts: the committed ledger and what the working copy holds beyond it. Raises ValueError
    unless the committed ledger is a prefix of the working copy (a line that was committed can never be edited or
    removed)."""
    committed = committed_bytes(path)
    if committed is None:
        raise ValueError('the loop folder is not in a git repository')
    working = b''
    if os.path.exists(path):
        with open(path, 'rb') as f:
            working = f.read()
    if not working.startswith(committed):
        raise ValueError('the committed ledger.jsonl is not a prefix of the working copy: a committed line was '
                         'edited or removed')
    union = committed + working[len(committed):]
    return [json.loads(line) for line in union.decode().splitlines() if line.strip()]


def append_ledger(path, line):
    """One line, written with a single write call on a file opened for appending."""
    data = json.dumps(line, sort_keys=True, allow_nan=False) + '\n'
    fd = os.open(path, os.O_WRONLY | os.O_APPEND | os.O_CREAT, 0o644)
    try:
        os.write(fd, data.encode())
    finally:
        os.close(fd)


def rel(path, base=LAB):
    """A path as the ledger names it: relative to the lab folder when it is inside, else absolute."""
    path = os.path.abspath(path)
    return os.path.relpath(path, base) if os.path.commonpath([path, base]) == base else path
