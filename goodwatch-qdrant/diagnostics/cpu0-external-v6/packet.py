"""CPU0 public packet boundary. No Docker, imports or host action by default."""
import hashlib
import json
import os
from pathlib import Path
import stat
import types
import sys

SOURCE_NAMES = frozenset((
    'pin_cpu0.py', 'runtime_cpu0.py', 'daemon_cpu0.py', 'cpu0_guards.py',
    'controller_cpu0.py', 'cpu0_preflight.py', 'turnover_gate_cpu0.py',
    'lifecycle_cpu0.py', 'test_lifecycle_cpu0.py', 'test_cpu0_guards.py',
    'test_cpu0_controller.py', 'prepared-helper-policy-cpu0.json',
    'prepared-control-policy-cpu0.json', 'CPU0.md'))
MAX_FILE = 262144
MAX_PACKET = 2 * 1024**2


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def hash_value(value):
    if not isinstance(value, str) or len(value) != 64 or any(c not in '0123456789abcdef' for c in value):
        raise RuntimeError('external_freeze_invalid')
    return value


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()


def verify_source(raw_manifest, expected_sha, files):
    """Validate the complete fourteen-file closure BEFORE executable imports."""
    hash_value(expected_sha)
    if not isinstance(raw_manifest, bytes) or len(raw_manifest) > MAX_FILE or sha(raw_manifest) != expected_sha:
        raise RuntimeError('source_freeze_changed')
    try:
        manifest = json.loads(raw_manifest)
    except (ValueError, UnicodeError):
        raise RuntimeError('source_freeze_invalid') from None
    if not isinstance(manifest, dict) or manifest.get('schema') != 'search.clone-cpu0-owned-source-freeze.v1' or manifest.get('variant') != 'cpu0-owned-lifecycle.v1' or manifest.get('preparedOnly') is not True:
        raise RuntimeError('source_freeze_invalid')
    expected = manifest.get('files')
    if not isinstance(expected, dict) or set(expected) != SOURCE_NAMES or not isinstance(files, dict) or set(files) != SOURCE_NAMES:
        raise RuntimeError('source_closure_incomplete')
    total = 0
    for name in sorted(SOURCE_NAMES):
        raw = files[name]
        hash_value(expected[name])
        if not isinstance(raw, bytes) or len(raw) > MAX_FILE or sha(raw) != expected[name]:
            raise RuntimeError('source_file_changed')
        total += len(raw)
    if total > MAX_PACKET:
        raise RuntimeError('source_packet_bound')
    return manifest


def load_first_lifecycle(raw_manifest, expected_sha, files):
    """First-stop stdin closure; only standalone authenticated lifecycle executes.

    No source directory is needed. A distinct module name prevents an unrelated
    cached sibling from becoming trusted. Its marker is set only after exec.
    """
    manifest = verify_source(raw_manifest, expected_sha, files)
    raw = files['lifecycle_cpu0.py']
    module = types.ModuleType('authenticated_cpu0_first_setup_lifecycle')
    module.__file__ = '<authenticated-cpu0-first-setup-lifecycle>'
    exec(compile(raw, module.__file__, 'exec'), module.__dict__)
    module._AUTHENTICATED_SOURCE_SHA256 = manifest['files']['lifecycle_cpu0.py']
    return module


def load_first_guards(raw_manifest, expected_sha, files):
    manifest=verify_source(raw_manifest,expected_sha,files)
    module=types.ModuleType('authenticated_cpu0_first_setup_guards')
    module.__file__='<authenticated-cpu0-first-setup-guards>'
    exec(compile(files['cpu0_guards.py'],module.__file__,'exec'),module.__dict__)
    module._AUTHENTICATED_SOURCE_SHA256=manifest['files']['cpu0_guards.py']
    return module


def load_staged_modules(folder,raw_manifest,expected_sha,files):
    """Execute authenticated raw source with real frozen sibling filenames.

    Modules that were already imported without this exact marker/path refuse;
    no unversioned adapter or bytecode loader is consulted.
    """
    manifest=verify_source(raw_manifest,expected_sha,files)
    directory(folder)
    order=('pin_cpu0','runtime_cpu0','cpu0_guards','daemon_cpu0',
           'lifecycle_cpu0','controller_cpu0','cpu0_preflight','turnover_gate_cpu0')
    loaded={}
    for name in order:
        filename=name+'.py';path=Path(folder)/filename
        observed,_=read_owned(path)
        if observed!=files[filename]:raise RuntimeError('staged_source_changed')
        existing=sys.modules.get(name)
        if existing is not None:
            if getattr(existing,'_AUTHENTICATED_SOURCE_SHA256',None)!=manifest['files'][filename] or getattr(existing,'__file__',None)!=str(path):
                raise RuntimeError('cached_source_untrusted')
            loaded[name]=existing;continue
        module=types.ModuleType(name);module.__file__=str(path);sys.modules[name]=module
        try:
            exec(compile(observed,str(path),'exec'),module.__dict__)
            module._AUTHENTICATED_SOURCE_SHA256=manifest['files'][filename]
        except BaseException:
            sys.modules.pop(name,None);raise
        loaded[name]=module
    return loaded


def metadata(info):
    return (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns,
            info.st_mode, info.st_uid, info.st_nlink)


def read_owned(path, mode=0o600, limit=MAX_FILE, uid=0):
    path = Path(path)
    if path.resolve(strict=True) != path:
        raise RuntimeError('owned_file_scope_changed')
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_uid != uid or before.st_nlink != 1 or stat.S_IMODE(before.st_mode) != mode or before.st_size > limit:
        raise RuntimeError('owned_file_metadata_changed')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
    try:
        opened = os.fstat(fd)
        raw = bytearray()
        while len(raw) <= limit:
            part = os.read(fd, min(65536, limit + 1 - len(raw)))
            if not part:
                break
            raw.extend(part)
        if len(raw) > limit or metadata(before) != metadata(opened) or metadata(opened) != metadata(os.fstat(fd)) or metadata(opened) != metadata(path.lstat()):
            raise RuntimeError('owned_file_identity_changed')
        return bytes(raw), (opened.st_dev, opened.st_ino)
    finally:
        os.close(fd)


def directory(path, uid=0):
    path = Path(path)
    info = path.lstat()
    if path.resolve(strict=True) != path or not stat.S_ISDIR(info.st_mode) or info.st_uid != uid or stat.S_IMODE(info.st_mode) != 0o700:
        raise RuntimeError('owned_directory_changed')
    return info.st_dev, info.st_ino


def stage_absent(path, files, uid=0):
    """Publish public bytes only; rollback each owned inode independently."""
    path = Path(path)
    directory(path.parent, uid)
    if not isinstance(files, dict) or not files or any(not isinstance(k, str) or Path(k).name != k or k in ('.', '..') for k in files):
        raise RuntimeError('stage_packet_invalid')
    if any(not isinstance(v, bytes) or len(v) > MAX_FILE for v in files.values()) or sum(map(len, files.values())) > MAX_PACKET:
        raise RuntimeError('stage_packet_bound')
    created = []; made = None
    try:
        os.mkdir(path, 0o700)
        made = directory(path, uid)
        for name, raw in files.items():
            fd = os.open(path/name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC, 0o600)
            info = os.fstat(fd); created.append((path/name, info.st_dev, info.st_ino))
            with os.fdopen(fd, 'wb') as output:
                output.write(raw); output.flush(); os.fsync(output.fileno())
        dfd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC)
        try:
            os.fsync(dfd)
        finally:
            os.close(dfd)
        return {'schema': 'cpu0-public-stage.v6', 'filesCreated': len(created), 'directoryCreated': True}
    except BaseException as original:
        failures = 0
        for entry, device, inode in reversed(created):
            try:
                current = entry.lstat()
                if (current.st_dev, current.st_ino) != (device, inode):
                    failures += 1
                else:
                    entry.unlink()
            except BaseException:
                failures += 1
        if made is not None:
            try:
                if directory(path, uid) == made:
                    path.rmdir()
                else:
                    failures += 1
            except BaseException:
                failures += 1
        original.stageCleanupEvidence = {'cleanupFailures': failures,
                                        'directoryRetained': os.path.lexists(path)}
        raise
