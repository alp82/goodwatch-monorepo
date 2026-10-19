#!/usr/bin/env python3
"""Validate the compact publication in scratch space; never alter its receipts."""
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tarfile
import tempfile

B = Path(__file__).resolve().parent
ORIGINAL_SEAL = '2631845aaf7cb93e422cd670f71746dad559342a4e429d30e110e20124c2fe95'

def relative(name):
    p = PurePosixPath(name)
    if not name or p.is_absolute() or '..' in p.parts or '\\' in name:
        raise ValueError('Unsafe publication path')
    return p

def digest(data):
    return hashlib.sha256(data).hexdigest()

def check(data, expected):
    if digest(data) != expected:
        raise ValueError('Publication hash mismatch')

def hashes(path):
    entries = {}
    for line in path.read_text().splitlines():
        h, name = line.split('  ', 1)
        relative(name)
        if name in entries:
            raise ValueError('Duplicate seal path')
        entries[name] = h
    return entries

def main():
    publication = hashes(B / 'PUBLICATION-SHA256SUMS')
    for name, h in publication.items():
        check((B / name).read_bytes(), h)
    check((B / 'SHA256SUMS').read_bytes(), ORIGINAL_SEAL)
    original = hashes(B / 'SHA256SUMS')
    with tempfile.TemporaryDirectory(prefix='goodwatch-baseline-verify-') as scratch:
        target = Path(scratch)
        for name, h in original.items():
            if name.startswith('snapshots/'):
                continue
            check((B / name).read_bytes(), h)
            dest = target / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(B / name, dest)
        shutil.copyfile(B / 'SHA256SUMS', target / 'SHA256SUMS')
        # Original receipt stays immutable; the validator writes a new receipt here.
        shutil.copyfile(B / 'verification.json', target / 'verification.json')
        manifest = json.loads((target / 'manifest.json').read_text())
        expected = {f['snapshot']: f['sha256'] for f in manifest['files'] if f['snapshot']}
        found = set()
        with tarfile.open(target / 'snapshots.tar.gz', 'r:gz') as archive:
            for member in archive:
                relative(member.name)
                if not member.isfile() or member.name not in expected or member.name in found:
                    raise ValueError('Unexpected or unsafe archive member')
                data = archive.extractfile(member).read()
                check(data, expected[member.name])
                dest = target / member.name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
                found.add(member.name)
        if found != set(expected):
            raise ValueError('Missing archive members')
        subprocess.run([sys.executable, '-E', str(target / 'validate_bundle.py'), '--snapshot-only', '--self-test'], check=True)

if __name__ == '__main__':
    main()
