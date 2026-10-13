"""Fixtures: a made-up pack, a made-up loop folder with its own git repository, and a way to start run.sh on them.
No test reads the real pack, the real gate file or the real ledger."""
import os
import subprocess
import sys

import pytest

LAB = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, LAB)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


@pytest.fixture(scope='session')
def world(tmp_path_factory):
    import synth
    root = tmp_path_factory.mktemp('taste')
    pack_dir = synth.build(str(root / 'data'))
    loop = root / 'loop'
    (loop / 'items' / '001-test').mkdir(parents=True)
    (loop / 'items' / '001-test' / 'BRIEF.md').write_text('test item\n')
    for name in ('002-budget', '003-gate', '004-verify', '005-prereg'):
        (loop / 'items' / name).mkdir()
    subprocess.run(['git', 'init', '-q', str(loop)], check=True)
    env = {**os.environ, 'TASTE_LOCKS': str(root / 'locks')}

    def sh(*args, script='run.sh'):
        base = [os.path.join(LAB, script)] if script == 'run.sh' else [sys.executable, os.path.join(LAB, script)]
        return subprocess.run(base + [str(a) for a in args] + ['--pack', pack_dir, '--loop-dir', str(loop)],
                              capture_output=True, text=True, env=env)

    def run(predictor, *args, mode='explore', item='001'):
        return sh(os.path.join(LAB, predictor), '--task', 'T1', '--tier', 'A', '--mode', mode, '--item', item, *args)

    return {'root': str(root), 'pack_dir': pack_dir, 'loop': str(loop), 'run': run, 'sh': sh, 'env': env}


@pytest.fixture(scope='session')
def pack(world):
    from pack import Pack
    return Pack(world['pack_dir'])


def ledger(world):
    from common import read_ledger
    return read_ledger(os.path.join(world['loop'], 'ledger.jsonl'))
