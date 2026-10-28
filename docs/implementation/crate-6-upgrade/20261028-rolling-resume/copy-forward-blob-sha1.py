#!/usr/bin/env python3
"""Q65 resume: copy immutable BLOB SHA1 objects into an owner-approved private backup.

Executed on a production host only after explicit go; never imports application env.
The destination is a sibling of the snapshot repository, not inside it.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile


def digest(path):
    h = hashlib.sha1()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def copy_objects(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if not source.is_dir() or destination == source or source in destination.parents:
        raise ValueError('Invalid source/destination')
    destination.mkdir(parents=True, exist_ok=True, mode=0o700)
    if destination.stat().st_mode & 0o077:
        raise ValueError('Backup destination must be private (0700)')
    found = {}
    for path in sorted(source.rglob('*')):
        if not path.is_file() or not re.fullmatch('[0-9a-f]{40}', path.name):
            continue
        key = path.name
        if path.is_symlink() or source not in path.resolve().parents:
            raise ValueError('BLOB source escapes inspected data path')
        if digest(path) != key:
            raise ValueError('Source SHA1 mismatch: ' + key)
        target = destination / key
        size = path.stat().st_size
        if target.exists():
            if target.is_symlink() or target.stat().st_size != size or digest(target) != key:
                raise ValueError('Existing destination mismatch: ' + key)
        else:
            fd, partial = tempfile.mkstemp(prefix='.q53-part-', dir=destination)
            os.close(fd)
            try:
                shutil.copyfile(path, partial)
                if digest(Path(partial)) != key:
                    raise ValueError('Copied SHA1 mismatch: ' + key)
                os.chmod(partial, 0o600)
                os.replace(partial, target)
            finally:
                Path(partial).unlink(missing_ok=True)
        found[key] = {'sha1': key, 'bytes': size}
    return list(found.values())


def main():
    name, out = sys.argv[1:]
    if name not in ('crate-01', 'crate-02', 'crate-03'):
        raise ValueError('Unexpected production container')
    out = Path(out)
    allowed = Path('/mnt/backup-cratedb/q65-resume-20261028/blob')
    if out != allowed or out.is_symlink():
        raise ValueError('Destination outside the approved backup')
    item = json.loads(subprocess.check_output(['docker', 'inspect', name]))[0]
    mounts = [m for m in item['Mounts'] if m['Destination'] == '/data']
    if len(mounts) != 1:
        raise ValueError('Ambiguous data mount')
    source = Path(mounts[0]['Source']) / 'blobs/nodes/0/indices'
    objects = copy_objects(source, out)
    receipt = {'node': name, 'objects': objects, 'unique_objects': len(objects),
               'bytes': sum(o['bytes'] for o in objects)}
    manifest = out.parent / (name + '-manifest.json')
    manifest.write_text(json.dumps(receipt, indent=2) + '\n')
    manifest.chmod(0o600)
    print(json.dumps({'node': name, 'unique_objects': len(objects),
                      'bytes': receipt['bytes'], 'manifest': str(manifest)}))


if __name__ == '__main__':
    main()
