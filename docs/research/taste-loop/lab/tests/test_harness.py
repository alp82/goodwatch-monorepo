"""The harness end to end on the made-up pack: one run, what is refused, registration, budgets, the ledger, the
controls, verify, the gate, the sandbox, the table. Every run goes through run.sh of the committed lab copy, as a
real run does. The tests run in the order of this file and share one ledger."""
import fcntl
import json
import os
import subprocess
import sys

import numpy as np

from conftest import REAL_LAB, ledger

B0, B1, B2, B5 = 'ladder/b0_median.py', 'ladder/b1_public.py', 'ladder/b2_taste_today.py', 'ladder/b5_pooled.py'


def sha(path):
    from common import sha256_file
    return sha256_file(os.path.join(REAL_LAB, path))


def refused(done, text):
    assert done.returncode != 0 and text in done.stderr, done.stdout + done.stderr


def prereg(world, item, candidate_sha, reference=B0, others='all', task='T1', commit=True, extra=''):
    folder = [d for d in os.listdir(os.path.join(world['loop'], 'items')) if d.startswith(item)][0]
    path = os.path.join(world['loop'], 'items', folder, 'PREREG.md')
    with open(path, 'w') as f:
        f.write(f'# Pre-registration\n\nSome prose.\n\ncandidate: {candidate_sha}\nreference: {reference}\n'
                f'others: {others}\ntask: {task}\n{extra}')
    if commit:
        world['git']('add', f'items/{folder}/PREREG.md')
        world['git']('commit', '-q', '-m', f'prereg {item}')
    return path


def test_one_run_writes_one_ledger_line_and_leaves_no_views(world):
    before = len(ledger(world))
    done = world['run'](B1, '--ref', os.path.join(world['lab'], B0))
    assert done.returncode == 0, done.stdout + done.stderr
    lines = ledger(world)
    assert len(lines) == before + 1
    line = lines[-1]
    assert line['mode'] == 'explore' and line['item'] == '001' and line['tier'] == 'A' and line['task'] == 'T1'
    assert line['predictor'] == {'path': B1, 'sha256': sha(B1)} and line['refs'][0]['sha256'] == sha(B0)
    assert line['pack_sha256'] and line['harness_sha256'] and line['git_commit'] and line['lab_uncommitted'] is False
    assert line['seed'] == 20261013 and line['draws'] == 10000 and line['threads'] == 2 and line['calibrated'] == []
    assert line['seconds'] > 0 and line['peak_mb'] > 0
    assert line['sandbox'] == {'landlock': True, 'seccomp': True, 'net_isolated': True, 'namespaces': True,
                               'attempts': 0, 'examples': []}
    o = line['measures']['others']
    d = o['vs'][B0]['mae']
    assert d['lo'] < d['diff'] < d['hi'] and d['sde'] > 0 and d['n'] == o['n_members']
    assert o['vs'][B0]['pair_acc']['diff'] > 0 and o['n_targets_edited'] > 0
    assert o['mae_unedited']['value'] != o['mae']['value'] and 'mae_unedited' in o['vs'][B0]
    # the owner of the made-up pack has 4 sittings: plain figures, no interval, and the reason; franchises give one
    w = line['measures']['owner']
    v = w['vs'][B0]
    assert w['sittings'] == 4 and v['mae']['diff'] is not None and v['mae']['lo'] is None and v['mae']['sde'] is None
    assert 'fewer than 10' in v['mae']['why'] and w['mae']['lo'] is None
    assert v['mae_franchise']['lo'] < v['mae_franchise']['diff'] < v['mae_franchise']['hi']
    assert {'sitting:same', 'sitting:later', 'media:movie', 'fingerprint:without', 'label:edited_later'} <= \
        set(line['measures']['strata'])
    work = os.path.join(world['data'], 'work')
    assert os.listdir(os.path.join(work, 'runs')) == [] and os.listdir(os.path.join(work, 'keys')) == []
    result = os.path.join(world['data'], 'results', line['run_id'], 'result.json')
    assert json.load(open(result))['per_member']


def test_stored_reference_answers_are_checked_before_they_are_used(world):
    refs = ['--ref', os.path.join(world['lab'], B0), '--ref', os.path.join(world['lab'], B1)]
    a = world['run'](B5, *refs)
    one = ledger(world)[-1]
    b = world['run'](B5, *refs, '--no-cache')
    two = ledger(world)[-1]
    assert a.returncode == 0 and b.returncode == 0
    assert all(r['cached'] for r in one['refs']) and not any(r['cached'] for r in two['refs'])
    assert one['measures'] == two['measures'] and one['views'] == two['views']
    # a stored file that claims another predictor's hash, or holds another's answers under this name, is not used
    cache = os.path.join(world['data'], 'work', 'cache')
    stored = [os.path.join(d, f) for d, _, files in os.walk(cache) for f in files if f == f'{sha(B1)}.json']
    assert len(stored) == 1
    got = json.load(open(stored[0]))
    assert got['sha256'] == sha(B1)
    got['sha256'] = sha(B0)
    for answer in got['main'].values():
        answer['score'] = [10.0] * len(answer['score'])
    json.dump(got, open(stored[0], 'w'))
    c = world['run'](B5, *refs)
    three = ledger(world)[-1]
    assert c.returncode == 0 and [r['cached'] for r in three['refs']] == [True, False]
    assert three['measures'] == one['measures']


def test_what_the_protocol_refuses(world, tmp_path):
    n = len(ledger(world))
    lab = world['lab']
    refused(world['sh'](os.path.join(lab, B0), '--task', 'T1', '--tier', 'B', '--mode', 'explore', '--item', '001'),
            'tier B is read by gate.py only')
    refused(world['run'](B0, '--shuffle-seed', '1'), 'controls')
    refused(world['run'](B0, item='999'), 'item 999')
    refused(world['run'](B0, item='00[1]'), 'three digits')             # a pattern is not a second budget
    refused(world['run'](B0, item='010'), 'BRIEF.md is not committed')    # a folder alone is not an item
    for flag in ('--pack', '--loop-dir'):                                 # no way to point a run at another pack
        done = world['run'](B0, flag, str(tmp_path))
        assert done.returncode == 2 and 'unrecognized arguments' in done.stderr
    # run.py without run.sh, with or without the old environment switch
    for extra in ({}, {'TASTE_RUN_SH': '1'}):
        direct = subprocess.run([sys.executable, os.path.join(lab, 'run.py'), os.path.join(lab, B0), '--mode',
                                 'explore', '--item', '001'], capture_output=True, text=True,
                                env={**world['env'], **extra})
        refused(direct, 'use run.sh')
    # run.sh with HOME somewhere else holds a lock that is not a slot of the pack's data root
    moved = subprocess.run([os.path.join(lab, 'run.sh'), os.path.join(lab, B0), '--mode', 'explore', '--item', '001'],
                           capture_output=True, text=True, env={**world['env'], 'HOME': str(tmp_path)})
    refused(moved, 'use run.sh')
    # control mode: the six names, and only the lab's own predictors
    refused(world['run'](B0, '--control', 'smoke', mode='control'), 'unknown control')
    refused(world['run'](B0, mode='control'), 'unknown control')
    refused(world['run'](B0, '--control', 'leak'), 'only there')
    mine = tmp_path / 'mine.py'
    mine.write_text('import numpy as np\n\n\ndef predict(view):\n    n = len(view["targets"]["title"])\n'
                    '    return {"rank": np.zeros(n), "score": np.full(n, 7.0), "p_low": None}\n')
    refused(world['sh'](mine, '--mode', 'control', '--control', 'planted', '--item', '001'),
            'under lab/ladder/ or lab/controls/predictors/')
    # references are rungs
    refused(world['run'](B1, '--ref', str(mine)), 'a reference is a rung')
    refused(world['run'](B1, '--ref', os.path.join(lab, 'controls/predictors/clash/a/best.py')),
            'a reference is a rung')
    refused(world['run'](B1, '--ref', os.path.join(lab, B0), '--ref', os.path.join(lab, B0)), 'named once')
    # ladder mode is for rungs
    refused(world['sh'](mine, '--mode', 'ladder', '--item', '001'), 'mode ladder runs the pinned files')
    # a file dropped into lab/ladder/ is not a rung, and a rung edited in place is not that rung any more:
    # what runs without a budget is pinned by hash in lab/pins.json, which is part of the harness hash
    dropped = os.path.join(lab, 'ladder', 'b6_new.py')
    open(dropped, 'w').write(mine.read_text())
    refused(world['sh'](dropped, '--mode', 'ladder', '--item', '001'), 'mode ladder runs the pinned files')
    refused(world['sh'](dropped, '--mode', 'control', '--control', 'planted', '--item', '001'), 'pinned predictors')
    refused(world['run'](B1, '--ref', dropped), 'a reference is a rung')
    os.remove(dropped)
    with open(os.path.join(lab, B1), 'a') as f:
        f.write('# tuned\n')
    refused(world['run'](B1, mode='ladder'), 'mode ladder runs the pinned files')
    refused(world['run'](B0, '--ref', os.path.join(lab, B1)), 'a reference is a rung')
    refused(world['run'](B1, '--control', 'planted', mode='control'), 'pinned predictors')
    world['git']('checkout', '--', 'lab/ladder/b1_public.py')
    # a predictor is code, not a table
    big = tmp_path / 'big.py'
    big.write_text(mine.read_text() + 'TABLE = [\n' + '    0.123456789,\n' * 5000 + ']\n')
    assert big.stat().st_size > 64 << 10
    refused(world['sh'](big, '--mode', 'explore', '--item', '001'), 'is over 64 KB')
    assert len(ledger(world)) == n                                    # a refused run writes nothing


def test_registered_runs_the_one_comparison_its_prereg_names(world, tmp_path):
    loop, lab = world['loop'], world['lab']
    item = os.path.join(loop, 'items', '005-prereg')
    run = (lambda *args: world['run'](B1, *args, mode='registered', item='005'))
    n = len(ledger(world))
    refused(run(), 'needs')
    path = prereg(world, '005', sha(B1), commit=False)
    refused(run(), 'not committed')
    # a hash somewhere in the prose registers nothing
    open(path, 'w').write(f'rejected drafts, do not run: `{sha(B1)}`\n')
    world['git']('add', 'items/005-prereg/PREREG.md')
    world['git']('commit', '-q', '-m', 'prose only')
    refused(run(), 'exactly one line `candidate: ...`')
    prereg(world, '005', sha(B1), commit=False)
    refused(run(), 'differs from the committed version')
    prereg(world, '005', sha(B1), extra=f'candidate: {sha(B5)}\n')
    refused(run(), 'exactly one line `candidate: ...`, found 2')
    prereg(world, '005', sha(B5))
    refused(run(), 'registers candidate')
    prereg(world, '005', sha(B1), reference=B5)
    refused(run(), 'registers reference ladder/b5_pooled.py')
    prereg(world, '005', sha(B1), reference='controls/predictors/clash/a/best.py')
    refused(run(), 'reference is not ladder/<file>')
    prereg(world, '005', sha(B1), others='before')
    refused(run(), 'registers others: before')
    prereg(world, '005', sha(B1), task='T2a')
    refused(run(), 'registers task T2a')
    prereg(world, '005', sha(B1))
    refused(run('--members', 'owner'), '--members is refused')
    # the code must be committed
    with open(os.path.join(lab, 'score.py'), 'a') as f:
        f.write('# changed\n')
    refused(run(), 'lab/ has uncommitted changes')
    world['git']('checkout', '--', 'lab/score.py')
    # and so must the candidate, with the registered hash
    own = os.path.join(item, 'candidate.py')
    open(own, 'w').write(open(os.path.join(lab, B1)).read() + '# mine\n')
    from common import sha256_file
    prereg(world, '005', sha256_file(own))
    done = world['sh'](own, '--mode', 'registered', '--item', '005')
    refused(done, 'not committed with the registered hash')
    os.remove(own)
    outside = tmp_path / 'candidate.py'
    outside.write_text(open(os.path.join(lab, B1)).read() + '# mine\n')
    refused(world['sh'](outside, '--mode', 'registered', '--item', '005'), 'not in the repository')
    assert len(ledger(world)) == n
    prereg(world, '005', sha(B1))
    for _ in range(3):
        done = run()
        assert done.returncode == 0, done.stderr
    line = ledger(world)[-1]
    assert line['mode'] == 'registered' and line['primary_ref'] == B0 and line['options']['members'] == 'all'
    refused(run(), 'has used its 3 registered runs')


def test_budgets_are_for_candidates_and_the_ladder_uses_none(world):
    from common import append_ledger
    path = os.path.join(world['loop'], 'ledger.jsonl')
    for i in range(19):
        append_ledger(path, {'item': '002', 'mode': 'explore', 'run_id': f'made-up-{i}', 'status': 'failed'})
    append_ledger(path, {'item': '002', 'mode': 'control', 'run_id': 'a control does not count'})
    assert world['run'](B0, item='002').returncode == 0                # the 20th
    refused(world['run'](B0, item='002'), 'has used its 20 explore runs')
    done = world['run'](B0, mode='ladder', item='002')
    assert done.returncode == 0, done.stderr
    assert ledger(world)[-1]['mode'] == 'ladder'


def test_a_committed_ledger_line_cannot_be_edited_or_removed(world):
    path = os.path.join(world['loop'], 'ledger.jsonl')
    world['git']('add', 'ledger.jsonl')
    world['git']('commit', '-q', '-m', 'ledger')
    kept = open(path).read()
    n = len(ledger(world))
    lines = kept.splitlines(True)
    for changed in (''.join(lines[1:]),                                           # a committed line removed
                    lines[0].replace('"explore"', '"control"') + ''.join(lines[1:]),   # a committed line edited
                    ''):                                                          # the ledger emptied
        open(path, 'w').write(changed)
        refused(world['run'](B0, item='008'), 'not a prefix of the working copy')
        refused(world['sh']('--verify', json.loads(lines[0])['run_id']), 'not a prefix')
        refused(world['sh']('--gate', '008'), 'not a prefix')
    open(path, 'w').write(kept)
    assert world['run'](B0, item='008').returncode == 0                 # lines after the committed ones are fine
    assert len(ledger(world)) == n + 1


def control(world, name):
    return subprocess.run([sys.executable, os.path.join(world['lab'], 'controls', f'{name}.py'), '--item', '001'],
                          capture_output=True, text=True, env=world['env'])


def test_contract_canary_is_rejected(world):
    done = control(world, 'contract')
    assert done.returncode == 0, done.stdout + done.stderr
    line = [x for x in ledger(world) if x.get('control') == 'contract' and 'predictor' in x][-1]
    assert line['status'] == 'failed' and 'measures' not in line


def test_rank_scale_canary_fails_the_contract_check(world):
    done = control(world, 'rankscale')
    assert done.returncode == 0, done.stdout + done.stderr
    line = [x for x in ledger(world) if x.get('control') == 'rankscale' and 'predictor' in x][-1]
    assert line['status'] == 'failed' and 'measures' not in line and 'rank in 0..1' in line['error']
    # the canary is B2 itself up to its last line
    marker, end = '# ---- copied from b2_taste_today.py ----\n', '# ---- end of the copy ----\n'
    canary = open(os.path.join(REAL_LAB, 'controls/predictors/rankscale.py')).read()
    b2 = open(os.path.join(REAL_LAB, B2)).read()
    copied = canary[canary.index(marker) + len(marker):canary.index(end)]
    assert copied in b2 and b2.index(copied) + len(copied) > len(b2) - 200


def test_two_files_named_best_py_give_their_own_results(world):
    done = control(world, 'clash')
    assert done.returncode == 0, done.stdout + done.stderr


def test_planted_effect_is_found(world):
    done = control(world, 'planted')
    assert done.returncode == 0, done.stdout + done.stderr


def test_leak_canary_gets_nothing_and_is_reported(world):
    done = control(world, 'leak')
    assert done.returncode == 0, done.stdout + done.stderr
    line = [x for x in ledger(world) if x.get('control') == 'leak' and 'predictor' in x][-1]
    assert line['status'] == 'attempts' and line['sandbox']['attempts'] > 100 and line['sandbox']['landlock']
    log = open(os.path.join(world['data'], 'results', line['run_id'], 'log.txt')).read()
    assert 'leak canary: 0 of' in log and 'shared memory note: refused' in log
    # it went for the made-up pack of this run, by its true path, and never for anything under a gate folder
    assert f'libc open {os.path.join(world["pack_dir"], "pack.pkl")}: refused' in log
    assert '/gate/' not in log and world['home'] in log
    assert "__file__ of the predictor: None" in log
    assert 'frames from predict down: predict < _serve < _top < <module>' in log and 'frames above: GOT nothing' in log
    assert 'worked' not in log and 'left a note' not in log
    assert not [x for x in log.splitlines() if 'target ratings found' in x and not x.startswith('leak canary: 0 of')]


def test_leak_canary_refuses_to_run_outside_the_sandbox(tmp_path):
    code = f'''
import importlib.util
spec = importlib.util.spec_from_file_location('canary', {os.path.join(REAL_LAB, 'controls/predictors/leak_canary.py')!r})
canary = importlib.util.module_from_spec(spec); spec.loader.exec_module(canary)
canary.predict({{}})
'''
    done = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, cwd=str(tmp_path), timeout=60,
                          env={'PATH': '/usr/bin:/bin', 'HOME': str(tmp_path)})
    assert done.returncode != 0 and 'runs only inside the harness sandbox' in done.stderr


def test_leak_canary_finds_the_answers_when_nothing_confines_it(world, pack, tmp_path):
    """The other half of the control: on the made-up pack, outside the sandbox, the canary reads the answers. So when
    it finds nothing inside, the sandbox is the reason."""
    import views
    out = str(tmp_path / 'data' / 'work' / 'runs' / 'r1')
    index, keys, _ = views.build_t1(pack, out, members=[pack.owner])
    views.export_titles(pack, os.path.join(out, 'titles.npz'))
    views.write_keys(str(tmp_path / 'data' / 'work' / 'keys' / 'r1.bin'), index, keys)
    main = [v for v in index if v['kind'] == 'main']
    code = f'''
import sys, json, importlib.util
sys.path.insert(0, {REAL_LAB!r})
import views
spec = importlib.util.spec_from_file_location('canary', {os.path.join(REAL_LAB, 'controls/predictors/leak_canary.py')!r})
canary = importlib.util.module_from_spec(spec); spec.loader.exec_module(canary)
titles = views.load_titles({os.path.join(out, 'titles.npz')!r})
out = {{}}
for vid in {[v['vid'] for v in main]!r}:
    out[vid] = canary.predict(views.load_view({os.path.join(out, 'views')!r} + '/' + vid, titles))['score'].tolist()
print(json.dumps(out))
'''
    for name, root in (('the answer file and later views', str(tmp_path / 'data')),
                       ('the pack', os.path.dirname(world['pack_dir']))):
        # TASTE_CANARY_ROOT puts the canary in its test mode: it reads files under that folder and does nothing else
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(tmp_path), 'TMPDIR': str(tmp_path), 'TASTE_CANARY_ROOT': root,
               'OMP_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1'}
        done = subprocess.run([sys.executable, '-B', '-c', code], capture_output=True, text=True, env=env,
                              cwd=str(tmp_path), timeout=300)
        assert done.returncode == 0, done.stderr[-2000:]
        got = json.loads(done.stdout.strip().splitlines()[-1])
        for v in main:
            assert got[v['vid']] == keys[v['vid']]['score'].tolist(), name


FRAME_PROBE = '''import sys

import numpy as np


def predict(view):
    f, seen = sys._getframe(0), []
    while f:
        names = sorted(f.f_locals) if not f.f_code.co_name.startswith('<') else []
        held = sorted(k for k, v in f.f_globals.items() if isinstance(v, (dict, list)) and not k.startswith('__'))
        seen.append(f"{f.f_code.co_name} locals={names} containers={held if f.f_code.co_name == '<module>' else '-'}")
        f = f.f_back
    print('FRAMES ' + ' | '.join(seen), file=sys.stderr)
    print('FILE ' + repr(globals().get('__file__')) + ' ' + predict.__code__.co_filename, file=sys.stderr)
    n = len(view['targets']['title'])
    return {'rank': np.zeros(n), 'score': np.full(n, 7.0), 'p_low': None}
'''


def test_predict_is_called_from_frames_that_hold_no_harness_state(world, tmp_path):
    probe = tmp_path / 'probe.py'
    probe.write_text(FRAME_PROBE)
    done = world['sh'](probe, '--mode', 'explore', '--item', '009', '--members', 'owner')
    assert done.returncode == 0, done.stdout + done.stderr
    line = ledger(world)[-1]
    log = open(os.path.join(world['data'], 'results', line['run_id'], 'log.txt')).read()
    frames = [x for x in log.splitlines() if x.startswith('FRAMES ')]
    assert frames and len(set(frames)) == 1                           # the same in every view
    chain = frames[0][len('FRAMES '):].split(' | ')
    assert [c.split()[0] for c in chain] == ['predict', '_serve', '_top', '<module>']
    assert chain[1].startswith("_serve locals=['module', 'name', 'source', 'view']")
    assert chain[2].startswith("_top locals=['go', 'name']")
    assert 'DENIED' in chain[3] and 'job' not in frames[0] and 'vid' not in frames[0] and 'notes' not in frames[0]
    files = [x for x in log.splitlines() if x.startswith('FILE ')]
    assert files and all(x.startswith('FILE None <predictor_') for x in files)


def test_verify_reproduces_a_run_and_catches_one_that_cannot_be(world, tmp_path):
    assert world['run'](B5, '--ref', os.path.join(world['lab'], B0), item='004').returncode == 0
    run_id = ledger(world)[-1]['run_id']
    done = world['sh']('--verify', run_id)
    assert done.returncode == 0 and 'verified' in done.stdout, done.stdout + done.stderr
    last = ledger(world)[-1]
    assert last['mode'] == 'verify' and last['of'] == run_id and last['match'] is True and 'measures' not in last
    refused(subprocess.run([sys.executable, os.path.join(world['lab'], 'verify.py'), run_id], capture_output=True,
                           text=True, env=world['env']), 'use run.sh')

    dice = tmp_path / 'dice.py'
    dice.write_text('import numpy as np\n\n\ndef predict(view):\n    n = len(view["targets"]["title"])\n'
                    '    s = np.random.default_rng().uniform(1, 10, n)\n'
                    '    return {"rank": s, "score": s, "p_low": None}\n')
    assert world['sh'](str(dice), '--task', 'T1', '--tier', 'A', '--mode', 'explore', '--item', '004').returncode == 0
    run_id = ledger(world)[-1]['run_id']
    done = world['sh']('--verify', run_id)
    assert done.returncode == 1 and 'NOT REPRODUCED' in done.stdout
    assert ledger(world)[-1]['match'] is False
    dice.write_text(dice.read_text() + '# changed\n')
    done = world['sh']('--verify', run_id)
    assert done.returncode != 0 and 'is not the file the run used' in done.stderr


def gate_files(world):
    folder = os.path.join(world['data'], 'gate')
    return sorted(os.path.relpath(os.path.join(d, f), folder) for d, _, files in os.walk(folder) for f in files)


def test_gate_prints_a_verdict_and_writes_one_summary_line(world):
    from gate import replicated
    assert replicated(-0.2, -0.1) and replicated(-0.2, -0.3)
    assert not replicated(-0.2, -0.09) and not replicated(-0.2, 0.1) and not replicated(0.0, -0.1)
    assert not replicated(0.2, 0.3)                                   # a loss that repeats is not a replication
    prereg(world, '003', sha(B5))
    refused(world['sh']('--gate', '003'), 'no finished registered run')
    assert world['run'](B5, mode='registered', item='003').returncode == 0
    registered = ledger(world)[-1]
    refused(subprocess.run([sys.executable, os.path.join(world['lab'], 'gate.py'), '003'], capture_output=True,
                           text=True, env=world['env']), 'lab/run.sh --gate')
    assert gate_files(world) == ['synth/gate.pkl']                    # a refused gate leaves nothing and uses no look
    done = world['sh']('--gate', '003')
    assert done.returncode == 0, done.stderr
    assert done.stdout.splitlines() in (['replicated', 'looks used: 1 of 8'], ['not replicated', 'looks used: 1 of 8'])
    last = ledger(world)[-1]
    assert last['mode'] == 'gate' and last['of'] == registered['run_id'] and last['looks_used'] == 1
    assert set(last) == {'mode', 'item', 'time', 'of', 'verdict', 'looks_used', 'looks_allowed', 'pack'}
    # of tier B: the look, one summary line, the log, the title file. No result per member or per measure.
    results = os.path.join(world['data'], 'gate', 'results', 'synth')
    rows = [json.loads(x) for x in open(os.path.join(results, 'summary.jsonl'))]
    assert len(rows) == 1
    row = rows[0]
    assert set(row) == {'item', 'time', 'registered_run', 'task', 'reference', 'others', 'harness_sha256',
                        'tier_a_effect', 'tier_b_effect', 'verdict', 'gate_run', 'status', 'tier_b_members',
                        'views_digest'}
    a, b = row['tier_a_effect'], row['tier_b_effect']
    assert a == registered['measures']['others']['vs'][B0]['mae']['diff'] and row['others'] == 'all'
    assert row['verdict'] == ('replicated' if a < 0 and b < 0 and abs(b) >= abs(a) / 2 else 'not replicated')
    assert row['verdict'] == last['verdict'] == done.stdout.splitlines()[0]
    files = gate_files(world)
    assert not [f for f in files if f.endswith('result.json')]
    assert set(f.split('/')[0] + '/' + f.split('/')[1] if f.startswith('results') else f.split('/')[0]
               for f in files) == {'synth', 'results/synth', 'work'}
    assert sorted(os.listdir(results)) == ['logs', 'looks.jsonl', 'summary.jsonl']
    for f in files:
        if f.endswith(('.jsonl', '.txt')):
            text = open(os.path.join(world['data'], 'gate', f)).read()
            assert 'per_member' not in text and 'strata' not in text and '"measures"' not in text
    refused(world['sh']('--gate', '003'), 'has had its look')
    # nothing of tier B stays in the open work folder, and the gate's own work folder is emptied
    gate_work = os.path.join(world['data'], 'gate', 'work')
    assert os.listdir(os.path.join(gate_work, 'runs')) == [] and os.listdir(os.path.join(gate_work, 'keys')) == []
    assert not os.path.exists(os.path.join(world['data'], 'results', row['gate_run']))


def test_gate_replays_the_registered_others_option(world, pack):
    """A registered run with `others: before` is replayed on tier B with `before` views, not the default ones."""
    import pickle

    import views
    prereg(world, '007', sha(B5), reference=B1, others='before')
    refused(world['run'](B5, '--ref', os.path.join(world['lab'], B1), mode='registered', item='007'),
            'registers others: before')
    done = world['run'](B5, '--ref', os.path.join(world['lab'], B1), '--others', 'before', mode='registered',
                        item='007')
    assert done.returncode == 0, done.stdout + done.stderr
    registered = ledger(world)[-1]
    assert registered['options']['others'] == 'before' and registered['primary_ref'] == B1
    done = world['sh']('--gate', '007')
    assert done.returncode == 0, done.stdout + done.stderr
    assert done.stdout.splitlines()[1] == 'looks used: 2 of 8'
    row = [json.loads(x) for x in open(os.path.join(world['data'], 'gate', 'results', 'synth', 'summary.jsonl'))][-1]
    assert row['item'] == '007' and row['others'] == 'before' and row['reference'] == B1
    assert row['tier_a_effect'] == registered['measures']['others']['vs'][B1]['mae']['diff']
    assert row['harness_sha256'] == registered['harness_sha256']
    gate = pickle.load(open(os.path.join(world['data'], 'gate', 'synth', 'gate.pkl'), 'rb'))['ratings']
    digests = {mode: views.build_t1(pack, '', own=gate, others_mode=mode, write=False)[2] for mode in ('all', 'before')}
    assert digests['all'] != digests['before'] and row['views_digest'] == digests['before']


TIER_PROBE = '''import numpy as np


def predict(view):
    if len(np.unique(view['others']['ratings']['member'])) >= {tier_a}:
        raise RuntimeError('this is a gate view')
    n = len(view['targets']['title'])
    return {{'rank': np.zeros(n), 'score': np.full(n, 7.0), 'p_low': None}}
'''


def test_the_look_is_used_before_the_gate_run_and_a_failed_run_leaves_no_numbers(world, pack):
    """A candidate that can tell a gate view from a tier A view and fails there on purpose."""
    from common import append_ledger, sha256_file
    loop = world['loop']
    tier_a = len(np.unique(pack.ratings['member']))
    probe = os.path.join(loop, 'items', '006-process', 'probe.py')
    open(probe, 'w').write(TIER_PROBE.format(tier_a=tier_a))
    world['git']('add', 'items/006-process/probe.py')
    prereg(world, '006', sha256_file(probe))
    done = world['sh'](probe, '--mode', 'registered', '--item', '006')
    assert done.returncode == 0, done.stdout + done.stderr
    before = gate_files(world)
    done = world['sh']('--gate', '006')
    assert done.returncode == 2 and done.stdout.splitlines()[0].startswith('not finished') \
        and done.stdout.splitlines()[1] == 'looks used: 3 of 8', done.stdout + done.stderr
    results = os.path.join(world['data'], 'gate', 'results', 'synth')
    looks = [json.loads(x) for x in open(os.path.join(results, 'looks.jsonl'))]
    assert [x['item'] for x in looks] == ['003', '007', '006']
    row = [json.loads(x) for x in open(os.path.join(results, 'summary.jsonl'))][-1]
    assert row['item'] == '006' and row['verdict'] == 'not finished' and row['tier_b_effect'] is None
    new = set(gate_files(world)) - set(before)
    assert all(f.endswith('log.txt') for f in new) and len(new) == 1    # the log, and no number
    assert ledger(world)[-1]['verdict'] == 'not finished'
    refused(world['sh']('--gate', '006'), 'has had its look')
    # a registered line the gate cannot replay is refused, and uses no look
    line = dict([x for x in ledger(world) if x.get('mode') == 'registered' and x.get('item') == '005'][-1])
    for change in ({'options': {**line['options'], 'members': ['owner']}}, {'harness_sha256': '0' * 64},
                   {'pack_sha256': '0' * 64}, {'options': {**line['options'], 'others': 'everything'}}):
        append_ledger(os.path.join(loop, 'ledger.jsonl'), {**line, **change, 'run_id': 'made-up'})
        refused(world['sh']('--gate', '005'), 'cannot be replayed')
    assert len([x for x in open(os.path.join(results, 'looks.jsonl'))]) == 3


def test_a_third_run_waits_for_a_lock_slot_wherever_the_environment_points(world, tmp_path):
    locks = os.path.join(world['data'], 'work', 'locks')
    held = []
    for name in ('slot0.lock', 'slot1.lock'):
        f = open(os.path.join(locks, name), 'a')
        fcntl.flock(f, fcntl.LOCK_EX)
        held.append(f)
    for extra in ({}, {'TASTE_LOCKS': str(tmp_path), 'TASTE_RUN_SH': '1'}):
        done = subprocess.run(['timeout', '3', os.path.join(world['lab'], 'run.sh'), os.path.join(world['lab'], B0),
                               '--task', 'T1', '--tier', 'A', '--mode', 'explore', '--item', '001'],
                              capture_output=True, text=True, env={**world['env'], **extra})
        assert done.returncode == 124 and 'both lock slots are taken' in done.stderr
    for f in held:
        f.close()
    refused(subprocess.run([os.path.join(world['lab'], 'run.sh'), os.path.join(world['lab'], B0), '--mode', 'explore',
                            '--item', '001'], capture_output=True, text=True,
                           env={**world['env'], 'TASTE_TIMEOUT': '99999'}), 'at most 7200')


def test_table_reads_ladder_lines_only_and_refuses_a_mixed_cohort(world):
    from common import append_ledger
    lab = world['lab']
    table = (lambda: subprocess.run([sys.executable, os.path.join(lab, 'table.py'), 'T1'], capture_output=True,
                                    text=True, env=world['env']))
    for rung, refs in ((B0, [B0]), (B1, [B0]), (B2, [B0, B1])):
        args = [x for r in refs for x in ('--ref', os.path.join(lab, r))]
        assert world['run'](rung, *args, mode='ladder').returncode == 0
    for rung in (B0, B1):
        assert world['run'](rung, '--ref', os.path.join(lab, B0), '--others', 'before', mode='ladder').returncode == 0
    done = table()
    assert done.returncode == 0, done.stderr
    text = done.stdout
    lines = [x for x in ledger(world) if x.get('mode') == 'ladder' and x['options']['others'] == 'all']
    b1 = [x for x in lines if x['predictor']['path'] == B1][-1]
    b2 = [x for x in lines if x['predictor']['path'] == B2][-1]
    d = b1['measures']['others']['vs'][B0]
    assert f'{d["mae"]["diff"]:+.3f} ({d["mae"]["lo"]:+.3f} to {d["mae"]["hi"]:+.3f})' in text
    assert f'{d["pair_acc"]["diff"]:+.3f} ({d["pair_acc"]["lo"]:+.3f} to {d["pair_acc"]["hi"]:+.3f})' in text
    # B5 has exploratory and registered runs in this ledger, and none in mode ladder
    assert '| B5 | Pooled predictor, personal weights on | not run' in text
    row = [x for x in text.splitlines() if x.startswith('| B2 | Today\'s taste (calibrated)')][0]
    assert 'not like for like' in row and b2['calibrated'] == [B2]
    assert [x for x in text.splitlines() if x.startswith('| B2 | B1 | all | not like for like')]
    assert [x for x in text.splitlines() if x.startswith('| B1 | GoodWatch score') and '| like for like |' in x]
    # the floor of the calibrated rung stands beside it, and the owner has no interval over 4 sittings
    floor = b2['measures']['calibrator_floor']['others']
    assert '## The calibrator floor' in text and f'{floor["vs_b0"]["diff"]:+.3f}' in text
    assert 'n/a: 4 sittings, fewer than 10' in text
    # others: before stands beside others: all
    before = [x for x in ledger(world) if x.get('mode') == 'ladder' and x['options']['others'] == 'before'
              and x['predictor']['path'] == B1][-1]
    assert before['views']['digest'] != b1['views']['digest']
    assert f'{before["measures"]["others"]["mae"]["value"]:.3f}' in text and 'before: error' in text
    assert f'{b1["measures"]["others"]["mae_unedited"]["value"]:.3f}' in text
    # a row from another harness, another pack or other views does not go into one table with B0's
    path = os.path.join(world['loop'], 'ledger.jsonl')
    kept = open(path).read()
    for change, what in (({'harness_sha256': '0' * 64}, 'harness_sha256 differs'),
                         ({'pack_sha256': '0' * 64}, 'pack_sha256 differs'),
                         ({'views': {**b1['views'], 'digest': '0' * 64}}, 'views digest differs')):
        append_ledger(path, {**b1, **change})
        done = table()
        assert done.returncode != 0 and 'do not belong together' in done.stderr and what in done.stderr
        open(path, 'w').write(kept)
    assert table().returncode == 0


def test_the_pins_match_the_ladder_and_the_control_predictors():
    done = subprocess.run([sys.executable, '-B', os.path.join(REAL_LAB, 'pin.py'), '--check'], capture_output=True,
                          text=True)
    assert done.returncode == 0, done.stdout + done.stderr
    from common import HARNESS_FILES
    assert 'pins.json' in HARNESS_FILES and 'gate.py' in HARNESS_FILES and 'run.sh' in HARNESS_FILES
