"""A1 gate replay on made-up packs only; never opens the real pack, gate or ledger."""
import json
import os
import pickle
import shutil
import subprocess

import numpy as np
import pytest

from common import sha256_file
from conftest import REAL_LAB, git, ledger
from gate import replicated_t2a
from test_harness import B2, prereg, refused, t2a


@pytest.fixture
def made_gate(tmp_path):
    import synth
    data = str(tmp_path / 'goodwatch-research' / 'taste')
    pack_dir = synth.build(data, n_members=120)
    # Plant an unambiguous title effect in both tiers, independent of popularity.
    titles = pickle.load(open(os.path.join(pack_dir, 'titles.pkl'), 'rb'))
    signal = titles['fingerprint'][:, 0]
    for folder, name in ((pack_dir, 'pack.pkl'), (os.path.join(data, 'gate', 'synth'), 'gate.pkl')):
        path = os.path.join(folder, name)
        obj = pickle.load(open(path, 'rb'))
        rows = np.searchsorted(titles['key'], obj['ratings']['title_key'])
        obj['ratings']['score'] = np.where(signal[rows] >= 8, 9, np.where(signal[rows] <= 3, 3, 7)).astype(np.int8)
        with open(path, 'wb') as f:
            pickle.dump(obj, f)
    manifest_path = os.path.join(pack_dir, 'MANIFEST.json')
    manifest = json.load(open(manifest_path))
    manifest['files_sha256']['pack.pkl'] = sha256_file(os.path.join(pack_dir, 'pack.pkl'))
    manifest['gate_sha256']['gate.pkl'] = sha256_file(os.path.join(data, 'gate', 'synth', 'gate.pkl'))
    with open(manifest_path, 'w') as f:
        json.dump(manifest, f)
    loop = str(tmp_path / 'loop')
    lab = os.path.join(loop, 'lab')
    shutil.copytree(REAL_LAB, lab, ignore=shutil.ignore_patterns('__pycache__', 'tests', '.pytest_cache'))
    shutil.copy(manifest_path, os.path.join(loop, 'MANIFEST.json'))
    folder = os.path.join(loop, 'items', '010-test')
    os.makedirs(folder)
    open(os.path.join(folder, 'BRIEF.md'), 'w').write('Made-up T2a gate test.\n')
    subprocess.run(['git', 'init', '-q', loop], check=True)
    git(loop, 'add', '.')
    git(loop, 'commit', '-q', '-m', 'made-up gate')
    env = dict(os.environ)
    env['HOME'] = str(tmp_path)

    def sh(*args):
        return subprocess.run([os.path.join(lab, 'run.sh'), *map(str, args)], capture_output=True, text=True, env=env)

    return {'data': data, 'pack_dir': pack_dir, 'loop': loop, 'lab': lab, 'env': env, 'sh': sh,
            'git': lambda *args: git(loop, *args)}


PREDICTOR = '''import numpy as np

def predict(view):
    targets = view['targets']['title']
    fp = view['titles']['fingerprint'][targets, 0]
    rank = np.where(fp >= 8, 1.0, np.where(fp <= 3, {low}, 0.5))
    return {{'rank': rank, 'score': None, 'p_low': None}}
'''


@pytest.mark.parametrize('case', ['planted', 'shuffled', 'harm', 'few'])
def test_t2a_gate_replay(made_gate, case):
    from pack import Pack
    import views
    world = made_gate
    candidate = os.path.join(world['loop'], 'items', '010-test', 'candidate.py')
    open(candidate, 'w').write(PREDICTOR.format(low=0.5 if case == 'harm' else 0.0))
    world['git']('add', 'items/010-test/candidate.py')
    prereg(world, '010', sha256_file(candidate), reference=B2, task='T2a')
    refused(world['sh']('--gate', '010'), 'no finished registered run')
    done = t2a(world, candidate, B2, mode='registered', item='010', extra=['--others', 'no-owner'])
    refused(done, 'registers others: all')
    done = t2a(world, candidate, B2, mode='registered', item='010')
    assert done.returncode == 0, done.stdout + done.stderr
    old = ledger(world)[-1]
    assert old['measures']['others']['vs'][B2]['separation']['diff'] > 0
    assert 'guard 1 against' in done.stdout and 'upper bound' in done.stdout
    assert 'guard 2 against' in done.stdout and 'descriptive per-member precision' in done.stdout
    assert 'A2 requires separation >= +0.03' in done.stdout
    # Refusal checks happen before the gate file is opened and before any look is spent.
    original = open(candidate).read()
    open(candidate, 'a').write('\n# changed\n')
    refused(world['sh']('--gate', '010'), 'not the file')
    open(candidate, 'w').write(original)
    reference = os.path.join(world['lab'], B2)
    ref_bytes = open(reference, 'rb').read()
    with open(reference, 'ab') as f:
        f.write(b'\n# changed reference\n')
    refused(world['sh']('--gate', '010'), 'not the file')
    with open(reference, 'wb') as f:
        f.write(ref_bytes)
    from common import append_ledger
    for options in ({'members': ['owner']}, {'shuffle_seed': 3}, {'plant': 0.1}):
        append_ledger(os.path.join(world['loop'], 'ledger.jsonl'), {**old, 'options': {**old['options'], **options}})
        refused(world['sh']('--gate', '010'), 'cannot be replayed')
    append_ledger(os.path.join(world['loop'], 'ledger.jsonl'), old)
    gate_path = os.path.join(world['data'], 'gate', 'synth', 'gate.pkl')
    gate = pickle.load(open(gate_path, 'rb'))
    if case == 'shuffled':
        gate['ratings']['score'] = views.shuffled_scores(gate['ratings'], 71)
    if case == 'few':
        r = gate['ratings']
        keep = np.isin(r['member'], np.unique(r['member'])[:9])
        gate['ratings'] = {k: v[keep] for k, v in r.items()}
    if case in ('shuffled', 'few'):
        with open(gate_path, 'wb') as f:
            pickle.dump(gate, f)
        manifest_path = os.path.join(world['pack_dir'], 'MANIFEST.json')
        manifest = json.load(open(manifest_path))
        manifest['gate_sha256']['gate.pkl'] = sha256_file(gate_path)
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f)
    pack = Pack(world['pack_dir'])
    out = str(os.path.join(world['data'], 'probe'))
    index, keys, digest = views.build_t2a(pack, out, own=gate['ratings'])
    for entry in index:
        u = entry['member']
        vdir = os.path.join(out, 'views', entry['vid'])
        view = views.load_arrays(os.path.join(vdir, 'view.bin'))
        population = views.load_arrays(os.path.join(vdir, 'others.bin'))
        assert pack.members['tier'][u] == 1
        assert (pack.members['tier'][population['ratings.member']] == 0).all()
        hidden = set(keys[entry['vid']]['title'])
        assert hidden.isdisjoint(view['me.ratings.title'])
        assert set(view['targets.title'][keys[entry['vid']]['pos']]) == hidden
    if case == 'planted':
        import shutil
        shutil.rmtree(out)
        index_no_owner, _, _ = views.build_t2a(pack, out, own=gate['ratings'], others_mode='no-owner')
        for entry in index_no_owner:
            population = views.load_arrays(os.path.join(out, 'views', entry['vid'], 'others.bin'))
            assert not (population['ratings.member'] == pack.owner).any()
            for name in ('want_to_see', 'skip', 'not_interested'):
                assert (pack.members['tier'][population[f'{name}.member']] == 0).all()
                assert not (population[f'{name}.member'] == pack.owner).any()
    done = world['sh']('--gate', '010')
    assert done.returncode == 0, done.stdout + done.stderr
    expected = 'replicated' if case == 'planted' else 'not replicated'
    assert done.stdout.splitlines() == [expected, 'looks used: 1 of 8']
    assert done.stderr == ''
    results = os.path.join(world['data'], 'gate', 'results', 'synth')
    summary = json.loads(open(os.path.join(results, 'summary.jsonl')).read())
    assert summary['views_digest'] == digest and summary['tier_a_effect'] == old['measures']['others']['vs'][B2]['separation']['diff']
    if case == 'harm':
        assert summary['tier_b_guard1'] > 0.03
        assert summary['tier_b_effect'] >= 0.5 * summary['tier_a_effect'] > 0
    if case == 'few':
        assert summary['tier_b_members'] < 10 and summary['tier_b_guard1_members'] < 10
    last = ledger(world)[-1]
    assert set(last) == {'mode', 'item', 'time', 'of', 'verdict', 'looks_used', 'looks_allowed', 'pack'}
    assert not any(f == 'result.json' for _, _, files in os.walk(results) for f in files)
    refused(world['sh']('--gate', '010'), 'has had its look')
    assert os.listdir(os.path.join(world['data'], 'gate', 'work', 'runs')) == []


def test_a1_gate_boundaries():
    separation = {'diff': 0.05, 'n': 10}
    guard = {'diff': 0.029, 'n': 10}
    assert replicated_t2a(0.1, separation, guard)
    for changed in ({'diff': 0.03}, {'diff': None}, {'n': 9}):
        assert not replicated_t2a(0.1, separation, {**guard, **changed})
    for changed in ({'diff': 0.049}, {'diff': -0.1}, {'n': 9}):
        assert not replicated_t2a(0.1, {**separation, **changed}, guard)
    assert not replicated_t2a(-0.1, separation, guard)


def test_precision_uses_all_bands_and_the_same_qualifying_members():
    import score
    from test_stats_score import t2a_answers, t2a_table
    member = np.repeat([0, 1, 2], 10)
    y = np.tile([3, 3, 7, 7, 9, 9, 9, 9, 9, 9], 3)
    above = np.full(30, 100.0)
    above[10:15] = 0  # member 1: two disliked out of five hits, despite fewer than five low titles
    above[20:24] = 0  # member 2: four hits, excluded
    t = t2a_table(member, y)
    p = t2a_answers(np.full(30, 0.5), 3, above=above)
    m = score.t2a_measures(t, p, {}, owner=0, draws=100, seed=1)['others']['precision50']
    assert m['n_members'] == 1
    assert m['disliked_share']['value'] == 0.4
    assert m['own_hidden_share']['value'] == 0.2
    assert m['vs_own']['value'] == 0.2


def test_a1_report_upper_bound_and_missing_coverage():
    import score
    assert score.t2a_guard1({'hi': 0.029}) == 'pass'
    assert score.t2a_guard1({'hi': 0.03}) == 'inconclusive'
    assert score.t2a_guard1({'hi': None}) == 'inconclusive'
    assert score.t2a_guard2({'hi': -0.001}) == 'fail'
    assert score.t2a_guard2({'hi': 0}) == 'pass'
    assert score.t2a_guard2({}) == 'inconclusive'


@pytest.mark.parametrize('failure', ['exception', 'failed', 'not-registered'])
def test_unexpected_replay_output_and_errors_stay_private(tmp_path, monkeypatch, capsys, failure):
    import sys
    import types
    import gate
    import run
    from common import append_ledger, harness_sha256, read_ledger

    root = tmp_path / 'taste'
    gate_dir = root / 'gate' / 'synth'
    gate_dir.mkdir(parents=True)
    gate_file = gate_dir / 'gate.pkl'
    gate_file.write_bytes(pickle.dumps({'ratings': None}))
    predictor, reference = tmp_path / 'candidate.py', tmp_path / 'reference.py'
    predictor.write_text('candidate = 1\n')
    reference.write_text('reference = 1\n')
    record = lambda p: {'path': str(p), 'sha256': sha256_file(p)}
    old = {'item': '010', 'mode': 'registered', 'status': 'ok', 'tier': 'A', 'task': 'T2a',
           'run_id': 'registered-test', 'pack_sha256': 'pack', 'titles_sha256': 'titles',
           'harness_sha256': harness_sha256(), 'predictor': record(predictor), 'refs': [record(reference)],
           'primary_ref': str(reference),
           'options': {'others': 'all', 'members': 'all', 'shuffle_seed': None, 'plant': None},
           'measures': {'others': {'vs': {str(reference): {'separation': {'diff': 0.1}}}}}}
    pack = types.SimpleNamespace(folder=str(root / 'packs' / 'synth'),
                                 manifest={'files_sha256': {'pack.pkl': 'pack', 'titles.pkl': 'titles'},
                                           'gate_folder': str(gate_dir),
                                           'gate_sha256': {'gate.pkl': sha256_file(gate_file)}})
    ledger_file = str(tmp_path / 'ledger.jsonl')
    append_ledger(ledger_file, old)
    monkeypatch.setattr(run, 'LEDGER', ledger_file)
    monkeypatch.setattr(run, 'the_pack', lambda: pack)
    monkeypatch.setattr(run, 'checked_ledger', lambda _: [old])
    monkeypatch.setattr(run, 'item_folder', lambda _: str(tmp_path))
    monkeypatch.setattr(run, 'under_run_sh', lambda _: None)
    monkeypatch.setattr(sys, 'argv', ['gate.py', '010'])

    def fail(*args, **kwargs):
        assert kwargs['gate']['registered'] == old
        assert read_ledger(str(root / 'gate/results/synth/looks.jsonl')) == [kwargs['gate']['look']]
        print('tier B number: 0.123')
        print('tier B number: 0.456', file=sys.stderr)
        if failure == 'failed':
            return {'run_id': 'failed-run', 'status': 'failed'}
        raise RuntimeError('tier B number: 0.789')

    monkeypatch.setattr(run, 'execute', fail)
    if failure == 'not-registered':
        old['mode'] = 'ladder'
    with pytest.raises(SystemExit) as done:
        gate.main()
    if failure == 'not-registered':
        assert 'no finished registered run' in done.value.code
        assert not (root / 'gate/results').exists()
        return
    assert done.value.code == 2  # a failed replay exits 2 so the orchestrator reads the log
    output = capsys.readouterr()
    assert output.out.splitlines() == ['not replicated', 'looks used: 1 of 8']
    assert output.err == ''
    private = root / 'gate/results/synth'
    assert '0.123' in (private / 'replay-registered-test.log').read_text()
    assert '0.456' in (private / 'replay-registered-test.log').read_text()
    if failure == 'exception':
        assert '0.789' in read_ledger(str(private / 'summary.jsonl'))[0]['error']
    assert set(read_ledger(ledger_file)[-1]) == {
        'mode', 'item', 'time', 'of', 'verdict', 'looks_used', 'looks_allowed', 'pack'}
