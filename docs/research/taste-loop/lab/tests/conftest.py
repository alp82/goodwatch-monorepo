"""Fixtures: a made-up home folder, in it a made-up pack and gate, and a made-up loop folder that is a git
repository of its own with a committed copy of the lab. Every run in a test goes through that copy's run.sh, so a
test takes the same path as a real run: the pack named by the loop's committed MANIFEST.json, the lock slots of
its data root, the ledger beside the lab, the git checks.

No test reads the real pack, the real gate file or the real ledger, and no test runs with HOME pointing at the
account's home: this file moves HOME to a temporary folder before anything else is imported.
"""
import atexit
import os
import pwd
import shutil
import subprocess
import sys
import tempfile

ACCOUNT_HOME = os.path.realpath(pwd.getpwuid(os.getuid()).pw_dir)
HOME = tempfile.mkdtemp(prefix='taste-tests-home-')
assert os.path.realpath(HOME) != ACCOUNT_HOME and not os.path.realpath(HOME).startswith(ACCOUNT_HOME + os.sep)
os.environ['HOME'] = HOME
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'
os.environ.pop('TASTE_TIMEOUT', None)
atexit.register(shutil.rmtree, HOME, True)

import pytest  # noqa: E402

REAL_LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, REAL_LAB)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
ITEMS = ('001-test', '002-budget', '003-gate', '004-verify', '005-prereg', '006-process', '007-gate-before',
         '008-ledger', '009-sandbox')


def git(loop, *args):
    return subprocess.run(['git', '-c', 'user.email=t@t', '-c', 'user.name=t', *args], cwd=loop, check=True,
                          capture_output=True, text=True)


@pytest.fixture(scope='session')
def world(tmp_path_factory):
    import synth
    assert os.path.expanduser('~') == HOME
    data = os.path.join(HOME, 'goodwatch-research', 'taste')         # where run.sh keeps its lock slots
    pack_dir = synth.build(data)
    loop = str(tmp_path_factory.mktemp('repo') / 'loop')
    lab = os.path.join(loop, 'lab')
    shutil.copytree(REAL_LAB, lab, ignore=shutil.ignore_patterns('__pycache__', 'tests', '.pytest_cache'))
    shutil.copy(os.path.join(pack_dir, 'MANIFEST.json'), os.path.join(loop, 'MANIFEST.json'))
    for name in ITEMS:
        os.makedirs(os.path.join(loop, 'items', name))
        with open(os.path.join(loop, 'items', name, 'BRIEF.md'), 'w') as f:
            f.write('test item\n')
    os.makedirs(os.path.join(loop, 'items', '010-no-brief'))
    with open(os.path.join(loop, '.gitignore'), 'w') as f:
        f.write('__pycache__/\n')
    subprocess.run(['git', 'init', '-q', loop], check=True)
    git(loop, 'add', '.gitignore', 'MANIFEST.json', 'lab', *[f'items/{name}/BRIEF.md' for name in ITEMS])
    git(loop, 'commit', '-q', '-m', 'the made-up loop')
    env = dict(os.environ)

    def sh(*args, script='run.sh'):
        base = [os.path.join(lab, script)] if script == 'run.sh' else [sys.executable, os.path.join(lab, script)]
        return subprocess.run(base + [str(a) for a in args], capture_output=True, text=True, env=env)

    def run(predictor, *args, mode='explore', item='001'):
        return sh(os.path.join(lab, predictor), '--task', 'T1', '--tier', 'A', '--mode', mode, '--item', item, *args)

    return {'home': HOME, 'data': data, 'pack_dir': pack_dir, 'loop': loop, 'lab': lab, 'run': run, 'sh': sh,
            'env': env, 'git': (lambda *a: git(loop, *a))}


@pytest.fixture(scope='session')
def pack(world):
    from pack import Pack
    return Pack(world['pack_dir'])


def ledger(world):
    from common import read_ledger
    return read_ledger(os.path.join(world['loop'], 'ledger.jsonl'))
