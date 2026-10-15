"""Private immutable artifacts; temporary output is permitted only for synthetic tests."""
import json
import os
from pathlib import Path
import pwd

REPO = Path(__file__).resolve().parents[5]
DATA = Path(pwd.getpwuid(os.getuid()).pw_dir) / 'goodwatch-research/taste'


def private_root(path, synthetic=False):
    path = Path(path).expanduser().resolve()
    if path == REPO or REPO in path.parents:
        raise ValueError('member artifacts cannot be in the repository')
    if not synthetic:
        allowed = (DATA / 'work/t5', DATA / 'results')
        if not any(path == p or p in path.parents for p in allowed) or Path('/tmp') in path.parents:
            raise ValueError('member artifacts require the private taste data root')
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(path, 0o700)
    return path


def write(path, data):
    """No replacement of responses or frozen inputs, even after an interrupted run."""
    path = Path(path)
    raw = data if isinstance(data, bytes) else (json.dumps(data, sort_keys=True, separators=(',', ':'), allow_nan=False) + '\n').encode()
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as f:
        f.write(raw)
    return raw


def read(path):
    return json.loads(Path(path).read_text())
