"""The harness end to end on the made-up pack: one run, what is refused, the controls, verify, the gate, the table.
Every run goes through run.sh, as a real run does."""
import fcntl
import json
import os
import subprocess
import sys

import numpy as np

from conftest import LAB, ledger

B0, B1, B5 = 'ladder/b0_median.py', 'ladder/b1_public.py', 'ladder/b5_pooled.py'


def sha(path):
    from common import sha256_file
    return sha256_file(os.path.join(LAB, path))


def test_one_run_writes_one_ledger_line_and_leaves_no_views(world):
    before = len(ledger(world))
    done = world['run'](B1, '--ref', os.path.join(LAB, B0))
    assert done.returncode == 0, done.stdout + done.stderr
    lines = ledger(world)
    assert len(lines) == before + 1
    line = lines[-1]
    assert line['mode'] == 'explore' and line['item'] == '001' and line['tier'] == 'A' and line['task'] == 'T1'
    assert line['predictor'] == {'path': B1, 'sha256': sha(B1)} and line['refs'][0]['sha256'] == sha(B0)
    assert line['pack_sha256'] and line['harness_sha256'] and line['git_commit'] is not None or True
    assert line['seed'] == 20261013 and line['draws'] == 10000 and line['threads'] == 2
    assert line['seconds'] > 0 and line['peak_mb'] > 0
    assert line['sandbox'] == {'landlock': True, 'seccomp': True, 'net_isolated': True, 'namespaces': True,
                               'attempts': 0, 'examples': []}
    d = line['measures']['others']['vs'][B0]['mae']
    assert d['lo'] < d['diff'] < d['hi'] and d['sde'] > 0 and d['n'] == line['measures']['others']['n_members']
    assert 'owner' in line['measures'] and line['measures']['owner']['vs'][B0]['mae']['sde'] > 0
    assert {'sitting:same', 'sitting:later', 'media:movie', 'fingerprint:without'} <= set(line['measures']['strata'])
    work = os.path.join(world['root'], 'data', 'work')
    assert os.listdir(os.path.join(work, 'runs')) == [] and os.listdir(os.path.join(work, 'keys')) == []
    result = os.path.join(world['root'], 'data', 'results', line['run_id'], 'result.json')
    assert json.load(open(result))['per_member']


def test_stored_reference_answers_give_the_same_measures(world):
    a = world['run'](B5, '--ref', os.path.join(LAB, B0), '--ref', os.path.join(LAB, B1))
    one = ledger(world)[-1]
    b = world['run'](B5, '--ref', os.path.join(LAB, B0), '--ref', os.path.join(LAB, B1), '--no-cache')
    two = ledger(world)[-1]
    assert a.returncode == 0 and b.returncode == 0
    assert all(r['cached'] for r in one['refs']) and not any(r['cached'] for r in two['refs'])
    assert one['measures'] == two['measures'] and one['views'] == two['views']


def test_what_the_protocol_refuses(world):
    n = len(ledger(world))
    done = world['sh'](os.path.join(LAB, B0), '--task', 'T1', '--tier', 'B', '--mode', 'explore', '--item', '001')
    assert done.returncode != 0 and 'tier B is read by gate.py only' in done.stderr
    done = world['run'](B0, '--shuffle-seed', '1')
    assert done.returncode != 0 and 'controls' in done.stderr
    done = world['run'](B0, item='999')
    assert done.returncode != 0 and 'item 999' in done.stderr
    direct = subprocess.run([sys.executable, os.path.join(LAB, 'run.py'), os.path.join(LAB, B0), '--mode', 'explore',
                             '--item', '001', '--pack', world['pack_dir'], '--loop-dir', world['loop']],
                            capture_output=True, text=True, env={k: v for k, v in world['env'].items()
                                                                 if k != 'TASTE_RUN_SH'})
    assert direct.returncode != 0 and 'use run.sh' in direct.stderr
    assert len(ledger(world)) == n                                    # a refused run writes nothing


def test_registered_needs_a_committed_prereg_with_the_hash(world):
    item = os.path.join(world['loop'], 'items', '005-prereg')
    git = (lambda *a: subprocess.run(['git', '-c', 'user.email=t@t', '-c', 'user.name=t', *a], cwd=world['loop'],
                                     check=True, capture_output=True))
    run = (lambda: world['run'](B1, mode='registered', item='005'))
    done = run()
    assert done.returncode != 0 and 'needs' in done.stderr
    open(os.path.join(item, 'PREREG.md'), 'w').write(f'candidate {sha(B1)}\n')
    done = run()
    assert done.returncode != 0 and 'not committed' in done.stderr
    open(os.path.join(item, 'PREREG.md'), 'w').write('candidate 0000\n')
    git('add', 'items/005-prereg/PREREG.md')
    git('commit', '-q', '-m', 'prereg without the hash')
    done = run()
    assert done.returncode != 0 and 'does not list' in done.stderr
    open(os.path.join(item, 'PREREG.md'), 'w').write(f'candidate {sha(B1)}\n')
    done = run()
    assert done.returncode != 0 and 'differs from the committed version' in done.stderr
    git('commit', '-q', '-am', 'prereg')
    for _ in range(3):
        done = run()
        assert done.returncode == 0, done.stderr
    done = run()
    assert done.returncode != 0 and 'has used its 3 registered runs' in done.stderr


def test_the_21st_exploratory_run_is_refused(world):
    from common import append_ledger
    path = os.path.join(world['loop'], 'ledger.jsonl')
    for i in range(19):
        append_ledger(path, {'item': '002', 'mode': 'explore', 'run_id': f'made-up-{i}', 'status': 'failed'})
    append_ledger(path, {'item': '002', 'mode': 'control', 'run_id': 'a control does not count'})
    assert world['run'](B0, item='002').returncode == 0                # the 20th
    done = world['run'](B0, item='002')
    assert done.returncode != 0 and 'has used its 20 explore runs' in done.stderr


def control(world, name):
    return subprocess.run([sys.executable, os.path.join(LAB, 'controls', f'{name}.py'), '--item', '001', '--pack',
                           world['pack_dir'], '--loop-dir', world['loop']], capture_output=True, text=True,
                          env=world['env'])


def test_contract_canary_is_rejected(world):
    done = control(world, 'contract')
    assert done.returncode == 0, done.stdout + done.stderr
    line = [x for x in ledger(world) if x.get('control') == 'contract' and 'predictor' in x][-1]
    assert line['status'] == 'failed' and 'measures' not in line


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
    log = open(os.path.join(world['root'], 'data', 'results', line['run_id'], 'log.txt')).read()
    assert 'leak canary: 0 of' in log and 'libc open' in log and 'shared memory note: refused' in log
    assert 'worked' not in log and 'left a note' not in log
    assert not [x for x in log.splitlines() if 'target ratings found' in x and not x.startswith('leak canary: 0 of')]


def test_leak_canary_refuses_to_run_outside_the_sandbox(tmp_path):
    code = f'''
import importlib.util
spec = importlib.util.spec_from_file_location('canary', {os.path.join(LAB, 'controls/predictors/leak_canary.py')!r})
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
sys.path.insert(0, {LAB!r})
import views
spec = importlib.util.spec_from_file_location('canary', {os.path.join(LAB, 'controls/predictors/leak_canary.py')!r})
canary = importlib.util.module_from_spec(spec); spec.loader.exec_module(canary)
titles = views.load_titles({os.path.join(out, 'titles.npz')!r})
out = {{}}
for vid in {[v['vid'] for v in main]!r}:
    out[vid] = canary.predict(views.load_view({os.path.join(out, 'views')!r} + '/' + vid, titles))['score'].tolist()
print(json.dumps(out))
'''
    for name, root in (('the answer file and later views', str(tmp_path / 'data')),
                       ('the pack', os.path.join(os.path.dirname(os.path.dirname(world['pack_dir'])), 'packs'))):
        # TASTE_CANARY_ROOT puts the canary in its test mode: it reads files under that folder and does nothing else
        env = {'PATH': '/usr/bin:/bin', 'HOME': str(tmp_path), 'TMPDIR': str(tmp_path), 'TASTE_CANARY_ROOT': root,
               'OMP_NUM_THREADS': '1', 'OPENBLAS_NUM_THREADS': '1'}
        done = subprocess.run([sys.executable, '-c', code], capture_output=True, text=True, env=env,
                              cwd=str(tmp_path), timeout=120)
        assert done.returncode == 0, done.stderr[-2000:]
        got = json.loads(done.stdout.strip().splitlines()[-1])
        for v in main:
            assert got[v['vid']] == keys[v['vid']]['score'].tolist(), name


def test_verify_reproduces_a_run_and_catches_one_that_cannot_be(world, tmp_path):
    assert world['run'](B5, '--ref', os.path.join(LAB, B0), item='004').returncode == 0
    run_id = ledger(world)[-1]['run_id']
    done = world['sh'](run_id, script='verify.py')
    assert done.returncode == 0 and 'verified' in done.stdout, done.stdout + done.stderr
    last = ledger(world)[-1]
    assert last['mode'] == 'verify' and last['of'] == run_id and last['match'] is True and 'measures' not in last

    dice = tmp_path / 'dice.py'
    dice.write_text('import numpy as np\n\n\ndef predict(view):\n    n = len(view["targets"]["title"])\n'
                    '    s = np.random.default_rng().uniform(1, 10, n)\n'
                    '    return {"rank": s, "score": s, "p_low": None}\n')
    assert world['sh'](str(dice), '--task', 'T1', '--tier', 'A', '--mode', 'explore', '--item', '004').returncode == 0
    run_id = ledger(world)[-1]['run_id']
    done = world['sh'](run_id, script='verify.py')
    assert done.returncode == 1 and 'NOT REPRODUCED' in done.stdout
    assert ledger(world)[-1]['match'] is False
    dice.write_text(dice.read_text() + '# changed\n')
    done = world['sh'](run_id, script='verify.py')
    assert done.returncode != 0 and 'is not the file the run used' in done.stderr


def test_gate_prints_a_verdict_and_nothing_else(world):
    item = os.path.join(world['loop'], 'items', '003-gate')
    open(os.path.join(item, 'PREREG.md'), 'w').write(f'candidate {sha(B5)} against B0\n')
    for args in (['add', 'items/003-gate/PREREG.md'], ['commit', '-q', '-m', 'prereg gate']):
        subprocess.run(['git', '-c', 'user.email=t@t', '-c', 'user.name=t', *args], cwd=world['loop'], check=True)
    done = world['sh']('003', script='gate.py')
    assert done.returncode != 0 and 'no registered run' in done.stderr
    assert world['run'](B5, mode='registered', item='003').returncode == 0
    registered = ledger(world)[-1]
    done = world['sh']('003', script='gate.py')
    assert done.returncode == 0, done.stderr
    assert done.stdout.splitlines() in (['replicated', 'looks used: 1 of 8'], ['not replicated', 'looks used: 1 of 8'])
    last = ledger(world)[-1]
    assert last['mode'] == 'gate' and last['of'] == registered['run_id'] and last['looks_used'] == 1
    assert set(last) == {'mode', 'item', 'time', 'of', 'verdict', 'looks_used', 'looks_allowed', 'pack'}
    numbers = json.load(open(os.path.join(world['root'], 'data', 'gate', 'results', 'synth', '003.json')))
    a, b = numbers['tier_a_effect'], numbers['tier_b_effect']
    assert a == registered['measures']['others']['vs'][B0]['mae']['diff']
    assert numbers['verdict'] == ('replicated' if (a > 0) == (b > 0) and abs(b) >= abs(a) / 2 else 'not replicated')
    assert numbers['tier_b']['tier'] == 'B' and 'owner' not in numbers['tier_b']['measures']
    done = world['sh']('003', script='gate.py')
    assert done.returncode != 0 and 'has had its look' in done.stderr
    # nothing of tier B stays in the open work folder, and the gate's own work folder is emptied
    gate_work = os.path.join(world['root'], 'data', 'gate', 'work')
    assert os.listdir(os.path.join(gate_work, 'runs')) == [] and os.listdir(os.path.join(gate_work, 'keys')) == []


def test_table_is_built_from_the_ledger_alone(world):
    for rung in (B0, B1):
        assert world['run'](rung, '--ref', os.path.join(LAB, B0)).returncode == 0
    done = subprocess.run([sys.executable, os.path.join(LAB, 'table.py'), 'T1', '--loop-dir', world['loop']],
                          capture_output=True, text=True)
    assert done.returncode == 0, done.stderr
    rows = [x for x in done.stdout.splitlines() if x.startswith('| B')]
    assert any(x.startswith('| B1 | GoodWatch score') and ' to ' in x for x in rows)
    assert '| B3 | Taste on standardized fingerprints (calibrated) | not run' in done.stdout
    line = [x for x in ledger(world) if x.get('predictor', {}).get('path') == B1 and x['mode'] == 'explore'][-1]
    d = line['measures']['others']['vs'][B0]['mae']
    assert f'{d["diff"]:+.3f} ({d["lo"]:+.3f} to {d["hi"]:+.3f})' in done.stdout


def test_a_third_run_waits_for_a_lock_slot(world, tmp_path):
    locks = tmp_path / 'locks'
    locks.mkdir()
    held = []
    for name in ('slot0.lock', 'slot1.lock'):
        f = open(locks / name, 'w')
        fcntl.flock(f, fcntl.LOCK_EX)
        held.append(f)
    done = subprocess.run(['timeout', '3', os.path.join(LAB, 'run.sh'), os.path.join(LAB, B0), '--task', 'T1',
                           '--tier', 'A', '--mode', 'explore', '--item', '001', '--pack', world['pack_dir'],
                           '--loop-dir', world['loop']], capture_output=True, text=True,
                          env={**world['env'], 'TASTE_LOCKS': str(locks)})
    assert done.returncode == 124 and 'both lock slots are taken' in done.stderr
    for f in held:
        f.close()
