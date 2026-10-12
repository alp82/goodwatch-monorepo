"""Direct isolated entry. Import/re-execution has no transport side effects."""
import hashlib
import json
import os
from pathlib import Path
import select
import stat
import sys
import time


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode() + b'\n'


def durable(path, value):
    raw = encoded(value)
    if len(raw) > 32768:
        raise ValueError('entry_receipt_limit')
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        descriptor = os.open(path.name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600, dir_fd=directory)
        try:
            offset = 0
            while offset < len(raw):
                offset += os.write(descriptor, raw[offset:])
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
        os.fsync(directory)
    finally:
        os.close(directory)


def ticks(pid):
    return int(Path('/proc', str(pid), 'stat').read_text().rsplit(')', 1)[1].split()[19])


def checked(path, mode, limit):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        before = os.fstat(fd)
        if not stat.S_ISREG(before.st_mode) or before.st_uid != os.geteuid() or before.st_nlink != 1 or stat.S_IMODE(before.st_mode) != mode or before.st_size > limit:
            raise ValueError('entry_stage_invalid')
        raw = os.read(fd, limit + 1)
        after = os.fstat(fd)
        identity = lambda info: (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns)
        if identity(before) != identity(after) or len(raw) != before.st_size:
            raise ValueError('entry_stage_invalid')
        return raw
    finally:
        os.close(fd)


def verify(operation, manifest):
    if type(manifest) is not dict or set(manifest) != {'schema', 'kind', 'entrySha256', 'codeRows', 'packetSha256', 'coreSha256', 'inputHashes', 'scheduleCanonicalSha256', 'interpreter', 'source', 'kernel'} or manifest['schema'] != 'qdrant.idle-operation.v1' or manifest['kind'] not in {'reviewed-preparation', 'unprivileged-refusal-fixture'} or os.geteuid() == 0 and manifest['kind'] != 'reviewed-preparation':
        raise ValueError('entry_stage_invalid')
    names = ('pin.py', 'runtime.py', 'production.py', 'production_journal.py',
             'zero_placement.py', 'idle_trial.py', 'idle_journal.py', 'idle_lease.py', 'idle_launcher.py')
    if operation.resolve() != operation or set(os.listdir(operation)) != {'code', 'entry', 'private', 'records', 'manifest.json'} or set(manifest['codeRows']) != set(names):
        raise ValueError('entry_stage_invalid')
    for directory in (operation, *(operation / name for name in ('code', 'entry', 'private', 'records'))):
        info = directory.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) != 0o700:
            raise ValueError('entry_stage_invalid')
    if os.geteuid() == 0:
        for ancestor in operation.parents:
            info = ancestor.lstat()
            if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
                raise ValueError('entry_stage_invalid')
    if set(os.listdir(operation / 'code')) != set(names) or set(os.listdir(operation / 'entry')) != {'idle_entry.py'} or set(os.listdir(operation / 'private')) != {'source.json', 'policy.json', 'schedule.json', 'standing.json'}:
        raise ValueError('entry_stage_invalid')
    core = hashlib.sha256()
    for name in names:
        raw = checked(operation / 'code' / name, 0o400, 262144)
        if manifest['codeRows'][name] != {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}:
            raise ValueError('entry_stage_invalid')
        if name in names[:6]:
            core.update(name.encode() + b'\0' + raw + b'\0')
    if core.hexdigest() != manifest['coreSha256'] or hashlib.sha256(json.dumps(manifest['codeRows'], sort_keys=True, separators=(',', ':')).encode()).hexdigest() != manifest['packetSha256']:
        raise ValueError('entry_stage_invalid')
    if hashlib.sha256(checked(operation / 'entry' / 'idle_entry.py', 0o400, 262144)).hexdigest() != manifest['entrySha256']:
        raise ValueError('entry_stage_invalid')
    inputs = {}
    for name, expected in manifest['inputHashes'].items():
        if name not in {'source.json', 'policy.json', 'schedule.json', 'standing.json'}:
            raise ValueError('entry_stage_invalid')
        raw = checked(operation / 'private' / name, 0o600, 32768)
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('entry_stage_invalid')
        inputs[name] = raw
    if set(inputs) != {'source.json', 'policy.json', 'schedule.json', 'standing.json'} or hashlib.sha256(json.dumps(json.loads(inputs['schedule.json']), sort_keys=True, separators=(',', ':')).encode()).hexdigest() != manifest['scheduleCanonicalSha256']:
        raise ValueError('entry_stage_invalid')
    interpreter = manifest['interpreter']
    if interpreter['path'] != os.path.realpath(sys.executable) or interpreter['version'] != list(sys.version_info[:3]) or hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest() != interpreter['sha256']:
        raise ValueError('entry_stage_invalid')
    return inputs


def main():
    # A fixed inherited channel has been made CLOEXEC-safe by the owned outer.
    operation = Path(sys.argv[1])
    gate = int(sys.argv[2])
    raw = checked(operation / 'manifest.json', 0o600, 32768)
    manifest_hash = hashlib.sha256(raw).hexdigest()
    os.write(gate, encoded({'phase': 'ready', 'pid': os.getpid(), 'startTicks': ticks(os.getpid())}))
    limit = time.monotonic() + 10
    message = b''
    while b'\n' not in message and len(message) <= 128:
        remaining = limit - time.monotonic()
        if remaining <= 0 or not select.select([gate], [], [], remaining)[0]:
            os._exit(4)
        part = os.read(gate, 129 - len(message))
        if not part:
            os._exit(4)
        message += part
    os.close(gate)
    if message != manifest_hash.encode() + b'\n':
        os._exit(4)
    manifest = json.loads(raw)
    if not (sys.flags.isolated and sys.flags.dont_write_bytecode and sys.flags.no_site):
        os._exit(4)
    inputs = verify(operation, manifest)
    code = operation / 'code'
    sys.path.insert(0, str(code))
    import idle_launcher
    for name in manifest['codeRows']:
        module = __import__(name[:-3])
        if Path(module.__file__) != code / name:
            os._exit(4)
    result = idle_launcher.run_reviewed(
        operation / 'private' / 'source.json', manifest['inputHashes']['source.json'],
        operation / 'private' / 'policy.json', manifest['inputHashes']['policy.json'],
        json.loads(inputs['schedule.json']),
        manifest['codeRows'], operation / 'records' / 'inner.jsonl',
        manifest['source']['pid'], manifest['source']['startTicks'], manifest['source']['identitySha256'])
    receipt = {'schema': 'qdrant.idle-entry-result.v1', 'operationSha256': manifest_hash,
               'entrySha256': manifest['entrySha256'], 'inputHashes': manifest['inputHashes'],
               'helperResult': result}
    durable(operation / 'records' / 'entry-result.json', receipt)
    os._exit({'pass': 0, 'inconclusive': 2, 'refused': 3}.get(result['outcome'], 4))


if __name__ == '__main__':
    try:
        main()
    except BaseException:
        # Distinct from a committed helper non-pass result (4). Never join children.
        os._exit(5)
