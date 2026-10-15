"""Pinned TS direct parity and lab normalization on made-up catalog facts only."""
import copy
import json
import subprocess

import numpy as np
import pytest

from t5 import sides
from t5.cases import split
from t5.synthetic import pack


def test_t5_pinned_ts_parity_and_normalization():
    p = pack(1)
    early = p['population'][0]['ratings']
    # Every title is rated, so direct production naturally has no unseen suggestions.
    p['titles'][0]['fingerprint'][2] = 255
    p['titles'][1]['hasPoster'] = False
    out = sides.describe(early, p['titles'])
    pool = np.array([t['fingerprint'] for t in p['titles']], float)
    pool[pool == 255] = 0
    mean, sd = pool.mean(0), pool.std(0)
    sd[sd == 0] = 1
    case = {'early': early, 'titles': p['titles'], 'stats': {'mean': mean.tolist(), 'sd': sd.tolist()}}
    direct = subprocess.run(['bun', '--tsconfig-override', str(sides.HERE / 'tsconfig.json'),
                             str(sides.HERE / 'parity_check.ts')], input=json.dumps(case), text=True,
                            capture_output=True, check=True)
    direct = json.loads(direct.stdout)
    assert out['view'] == direct['view']
    assert out['view']['status'] == 'ready'
    if direct['view']['headline']:
        sides_by_id = {s['id']: s for s in direct['view']['sides']}
        first = sides_by_id[direct['view']['headline']['first']]['name']
        second = sides_by_id[direct['view']['headline']['second']]['name']
        assert out['text'].splitlines()[0] == f'You love {first}, and just as much {second}.'
    assert np.allclose(out['normalization']['mean'], mean)
    assert np.allclose(out['normalization']['sd'], sd)
    assert all(p['titles'][1]['key'] not in side['here'] for side in out['view']['sides'])
    assert set(out['named_titles']) == {k for s in out['view']['sides'] for k in s['here']}
    for key in out['named_titles']:
        assert p['titles'][int(key - 10**12)]['title'] in out['text']
    assert not any(c.isalpha() for c in out['numbers_only'])
    assert all(t['title'] not in out['numbers_only'] for t in p['titles'])
    assert len(out['text']) / 3 < 1500  # Conservative synthetic sizing check, no truncation.


def test_t5_filter_empty_and_explicit_snapshot_facts():
    p = pack(1)
    early = p['population'][0]['ratings'][:4]
    p['titles'][0]['fingerprint'] = None
    out = sides.describe(early, p['titles'])
    assert out['empty'] and out['text'] == '' and out['named_titles'] == []
    assert out['losses'] == 1
    del p['titles'][0]['hasPoster']
    with pytest.raises(subprocess.CalledProcessError):
        sides.describe(early, p['titles'])


def test_t5_pinned_source_hash_change(tmp_path, monkeypatch):
    import shutil
    target = tmp_path / 'source'
    shutil.copytree(sides.HERE, target)
    monkeypatch.setattr(sides, 'HERE', target)
    sides.check_source()
    (target / 'prod/server/taste-portrait/sides.server.ts').write_text('changed')
    with pytest.raises(ValueError, match='changed pinned'):
        sides.check_source()
