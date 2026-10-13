"""Paths, hashes and small helpers shared by the harness files. No data is read here."""
import hashlib
import json
import os
import subprocess

import numpy as np

LAB = os.path.dirname(os.path.abspath(__file__))
LOOP = os.path.dirname(LAB)                          # docs/research/taste-loop
DATA_ROOT = os.path.expanduser('~/goodwatch-research/taste')
HARNESS_FILES = ('common.py', 'pack.py', 'views.py', 'sandbox.py', 'score.py', 'stats.py', 'run.py')
SEED = 20261013                                      # bootstrap, folds and controls; the seed of the tier split
DRAWS = 10000
BUDGET = {'explore': 20, 'registered': 3}
NAT = np.iinfo(np.int64).min


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


def harness_sha256():
    h = hashlib.sha256()
    for name in HARNESS_FILES:
        h.update(f'{name}:{sha256_file(os.path.join(LAB, name))}\n'.encode())
    return h.hexdigest()


def git(args, cwd):
    return subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True)


def read_ledger(path):
    if not os.path.exists(path):
        return []
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


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
