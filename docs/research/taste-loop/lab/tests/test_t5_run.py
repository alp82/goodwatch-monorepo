"""The entire synthetic path, including two fake-reader jobs and fresh-process replay."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
from t5.run import LAB, build, checked, source_digest
from t5.storage import private_root


def test_t5_whole_pipeline_and_fresh_verify(tmp_path):
    root = tmp_path/'run'
    env = dict(os.environ, PYTHONPATH=str(LAB))
    done = subprocess.run([sys.executable,'-m','t5.run','--synthetic','--output',str(root),'all'],
                          cwd=LAB, env=env, capture_output=True,text=True,timeout=120)
    assert done.returncode == 0, done.stdout+done.stderr
    assert json.loads(done.stdout)['match']
    aggregate = json.loads((root/'aggregate.json').read_text())
    assert aggregate['members'] == 18 and aggregate['triples'] == 72
    assert aggregate['ready'] and not aggregate['invalid']
    assert aggregate['readers']['haiku']['s']['share']['value'] > 1/3
    for p in root.rglob('*'):
        assert p.stat().st_mode & 0o777 == (0o700 if p.is_dir() else 0o600)
    frozen = json.loads((root/'frozen.json').read_text())
    frozen['cases'][0]['answer'] = 'Z'
    (root/'frozen.json').write_text(json.dumps(frozen))
    with pytest.raises(ValueError,match='frozen cases'):
        checked(root,True)


def test_t5_deterministic_build_digest(tmp_path):
    a=build(private_root(tmp_path/'a',True),True)
    b=build(private_root(tmp_path/'b',True),True)
    assert a == b


def test_t5_read_resume_skips_immutable_records_and_ledgers_resume(tmp_path, monkeypatch):
    from t5 import run, broker
    root = private_root(tmp_path / 'resume', True)
    frozen = build(root, True)
    invoke = broker.invoke
    called = []
    def interrupted(payload, reader, folder, **kwargs):
        if len(called) == 2:
            raise TimeoutError('simulated job deadline between cases')
        called.append(folder)
        # A completed tool-use record must also be skipped forever on resume.
        if len(called) == 1:
            kwargs['fake_command'] = [sys.executable, '-c', 'print(\'{"num_turns":2,"result":""}\')']
        return invoke(payload, reader, folder, **kwargs)
    monkeypatch.setattr(broker, 'invoke', interrupted)
    with pytest.raises(TimeoutError):
        run.read_suite(root, 'haiku', True)
    saved = {p: (p / 'record.json').read_bytes() for p in called}
    def resumed(payload, reader, folder, **kwargs):
        assert folder not in saved, 'completed case was recalled'
        called.append(folder)
        return invoke(payload, reader, folder, **kwargs)
    monkeypatch.setattr(broker, 'invoke', resumed)
    totals = run.read_suite(root, 'haiku', True)
    assert totals['resumed'] and totals['skipped'] == 2
    assert totals['calls'] == 3 * len(frozen['cases']) - 2
    assert totals['voided_cases'] == 1 and totals['status'] == 'complete'
    assert all((p / 'record.json').read_bytes() == raw for p, raw in saved.items())
    assert len(called) == len(set(called)) == 3 * len(frozen['cases'])
    monkeypatch.setattr(broker, 'invoke', lambda *a, **kw: pytest.fail('completed suite recalled'))
    again = run.read_suite(root, 'haiku', True)
    assert again['calls'] == 0 and again['skipped'] == 3 * len(frozen['cases'])
    lines = [json.loads(line) for line in (root / 'ledger.jsonl').read_text().splitlines()]
    assert any(line['stage'] == 'read-haiku' and line['aggregate']['status'] == 'interrupted' for line in lines)
    starts = [line['aggregate'] for line in lines if line['stage'] == 'read-haiku-start']
    assert starts[1]['resumed'] and starts[1]['existing_records'] == 2
    # No calls precede integrity checking of stored bytes on a subsequent resume.
    next(iter(saved)).joinpath('0.stdout').write_text('tampered')
    with pytest.raises(ValueError, match='response bytes'):
        run.read_suite(root, 'haiku', True)


def test_t5_read_stops_and_ledgers_incomplete_above_void_cap(tmp_path, monkeypatch):
    from t5 import run, broker
    root = private_root(tmp_path / 'void-cap', True)
    frozen = build(root, True)
    invoke = broker.invoke
    def tool_use(payload, reader, folder, **kwargs):
        kwargs['fake_command'] = [sys.executable, '-c', 'print(\'{"num_turns":2,"result":""}\')']
        return invoke(payload, reader, folder, **kwargs)
    monkeypatch.setattr(broker, 'invoke', tool_use)
    with pytest.raises(ValueError, match='10% voided'):
        run.read_suite(root, 'haiku', True)
    lines = [json.loads(line) for line in (root / 'ledger.jsonl').read_text().splitlines()]
    assert lines[-1]['aggregate']['status'] == 'incomplete'
    assert lines[-1]['aggregate']['voided_cases'] == 8
    assert lines[-1]['aggregate']['calls'] < 3 * len(frozen['cases'])
    monkeypatch.setattr(broker, 'invoke', lambda *a, **kw: pytest.fail('incomplete suite recalled'))
    with pytest.raises(ValueError, match='10% voided'):
        run.read_suite(root, 'haiku', True)


def test_t5_real_read_never_uses_the_fake_reader(tmp_path, monkeypatch):
    from t5 import run, broker
    root = private_root(tmp_path / 'real', True)
    frozen = build(root, True)
    monkeypatch.setattr(run, 'checked', lambda r, s: {**json.loads((root / 'frozen.json').read_text()), 'synthetic': s})
    monkeypatch.setattr(run, 'registered', lambda f: None)
    seen = []
    def real(payload, reader, folder, **kwargs):
        seen.append(kwargs.get('fake_command'))
        raise RuntimeError('stop after the first call')
    monkeypatch.setattr(broker, 'invoke', real)
    with pytest.raises(RuntimeError):
        run.read_suite(root, 'haiku', False)
    assert seen == [None]


def test_t5_fake_records_refused_in_a_real_run(tmp_path):
    from t5 import run
    from t5.cases import control_payload
    root = private_root(tmp_path / 'mixed', True)
    build(root, True)
    run.read_suite(root, 'haiku', True)
    frozen = json.loads((root / 'frozen.json').read_text())
    case = frozen['cases'][0]
    folder = root / f'haiku-s-{case["id"]}'
    run.stored_record(folder, control_payload(case, 's'), 'haiku', True)
    with pytest.raises(ValueError, match='fake record in a real run'):
        run.stored_record(folder, control_payload(case, 's'), 'haiku', False)
