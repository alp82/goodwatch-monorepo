"""No paid readers: test CLI arguments, failure accounting, and member-level inference."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest
from t5 import broker
from t5.cases import order
from t5.score import score, permutation_answers
from t5.storage import private_root


def payload():
    return {'description': 'invented', 'lists': {k: [{'title': 'invented', 'year': 2000, 'type': 'movie', 'rating': 8}] * 15 for k in 'ABC'}}


def test_t5_reader_confinement_arguments():
    h = broker.command('haiku')
    for flag in ('--safe-mode', '--restricted', '--no-session-persistence', '--strict-mcp-config'):
        assert flag in h
    assert h[h.index('--tools') + 1] == ''
    assert h[h.index('--setting-sources') + 1] == ''
    assert json.loads(h[h.index('--mcp-config') + 1]) == {'mcpServers': {}}
    assert h[h.index('--model')+1] == 'claude-haiku-5-5'
    assert h[h.index('--effort')+1] == 'low'
    assert h[h.index('--system-prompt')+1] == broker.SYSTEM
    a = broker.command('astra')
    assert a[:4] == ['codex','exec','-m','gpt-6-astra']
    assert a[a.index('-s')+1] == 'read-only'
    assert all(flag in a for flag in ('--skip-git-repo-check','--json','--ephemeral','--ignore-user-config','--ignore-rules'))
    assert 'project_doc_max_bytes=0' in a and 'features.shell_tool=false' in a
    assert not any('temperature' in arg or 'seed' in arg for arg in a+h)


def test_t5_fake_reader_empty_cwd_and_raw_replay(tmp_path):
    script = tmp_path / 'fake.py'
    script.write_text('import os,json,sys\nassert os.listdir(os.getcwd()) == []\nassert "PYTHONPATH" not in os.environ\nprint(json.dumps({"result":"{\\"choice\\":\\"B\\"}","usage":{"input_tokens":10},"total_cost_usd":0}))\n')
    record = broker.invoke(payload(), 'haiku', tmp_path/'raw', fake_command=[sys.executable,str(script)])
    assert record['result']['choice'] == 'B'
    assert record['result']['usage']['input_tokens'] == 10
    assert record['temperature'] == record['seed'] == 'unavailable'
    assert len(record['attempts']) == 1
    assert broker.replay(tmp_path/'raw') == record
    for path in (tmp_path/'raw').rglob('*'):
        assert path.stat().st_mode & 0o777 == 0o600
    (tmp_path/'raw/0.stdout').write_text('changed')
    with pytest.raises(ValueError, match='response bytes'):
        broker.replay(tmp_path/'raw')


def test_t5_malformed_and_transport(tmp_path):
    malformed = [sys.executable, '-c', 'print(\'{"result":"not JSON"}\')']
    r = broker.invoke(payload(),'haiku',tmp_path/'bad',fake_command=malformed)
    assert r['result']['status'] == 'malformed' and len(r['attempts']) == 1
    failure = [sys.executable, '-c', 'raise SystemExit(2)']
    r = broker.invoke(payload(),'haiku',tmp_path/'failed',fake_command=failure)
    assert r['result']['status'] == 'transport' and len(r['attempts']) == 2
    assert broker.replay(tmp_path/'failed') == r
    assert broker.choice('{"choice":"A","extra":1}') is None
    assert broker.choice('```json\n{"choice":"A"}\n```') is None
    for kind in ('command_execution','mcp_tool_call','web_search','file_change','unknown_tool'):
        raw = json.dumps({'type':'item.started','item':{'type':kind}})
        assert broker.parse(raw,'astra')['status'] == 'tool_use'
    assert broker.parse('{"num_turns":2,"result":""}','haiku')['status'] == 'tool_use'
    private = payload(); private['answer'] = 'A'
    with pytest.raises(ValueError, match='opaque'):
        broker.invoke(private,'haiku',tmp_path/'private',fake_command=malformed)


def trial(n=180, repeats=4):
    cases, records = [], {}
    for m in range(n):
        for t in range(repeats):
            key = f'{m}-{t}'
            answer = 'ABC'[(m+t)%3]
            c = {'id':key,'member':str(m),'answer':answer}
            cases.append(c)
            for reader in ('haiku','astra'):
                for control in ('s','numbers','none'):
                    choice = answer if control == 's' else 'A'
                    records[(reader,control,key)] = {'result': {'choice':choice,'status':'ok'}}
    return cases, records


def test_t5_planted_identity_and_shuffled_labels():
    cases, records = trial()
    out = score(cases,records)
    assert out['pass'] and out['members'] == 180 and out['triples'] == 720
    for reader in out['readers'].values():
        assert reader['s']['share']['value'] == 1
        assert reader['s_minus_numbers']['lo'] > 0
        assert abs(reader['permuted']['share']['value']-1/3) < .05
        assert abs(reader['none']['share']['value']-1/3) < .001
    # One member still counts once even with many triples; missing/invalid blocks.
    records.pop(next(iter(records)))
    with pytest.raises(ValueError,match='incomplete'):
        score(cases,records)


def test_t5_numbers_shortcut_void_and_malformed_wrong():
    cases, records = trial(60)
    for (reader,control,key), record in records.items():
        if control == 'numbers':
            record['result']['choice'] = next(c['answer'] for c in cases if c['id'] == key)
    assert not score(cases,records)['pass']
    records[('haiku','s',cases[0]['id'])]['result'] = {'choice':None,'status':'malformed'}
    out = score(cases,records)
    assert out['readers']['haiku']['s']['pooled_correct'] == len(cases)-1
    records[('haiku','s',cases[0]['id'])]['result']['status'] = 'tool_use'
    out = score(cases,records)
    assert not out['invalid'] and out['excluded_void_triples'] == 1
    assert out['readers']['haiku']['s']['triples'] == len(cases)-1


def test_t5_storage_refuses_repo_and_tmp_member_data(tmp_path):
    with pytest.raises(ValueError):
        private_root(tmp_path)
    from t5.storage import REPO
    with pytest.raises(ValueError):
        private_root(REPO/'member-output',synthetic=True)
    root = private_root(tmp_path/'synthetic',synthetic=True)
    assert root.stat().st_mode & 0o777 == 0o700


def test_t5_transport_retry_identical_prompt_then_success(tmp_path):
    script, state = tmp_path/'retry.py', tmp_path/'attempts'
    script.write_text('import sys,json,hashlib,pathlib\n'
                      f'p=pathlib.Path({str(state)!r})\n'
                      'h=hashlib.sha256(sys.stdin.buffer.read()).hexdigest()\n'
                      'old=p.read_text() if p.exists() else ""\n'
                      'p.write_text(old+h+"\\n")\n'
                      'if not old: raise SystemExit(2)\n'
                      'print(json.dumps({"result":"{\\"choice\\":\\"C\\"}"}))\n')
    record=broker.invoke(payload(),'haiku',tmp_path/'retry-raw',fake_command=[sys.executable,str(script)])
    assert len(record['attempts']) == 2 and record['result']['choice'] == 'C'
    assert len(set(state.read_text().splitlines())) == 1
    assert broker.replay(tmp_path/'retry-raw') == record


def test_t5_haiku_real_json_schema_and_metadata():
    value = {'result': '{"choice":"C"}', 'is_error': False, 'num_turns': 1,
             'total_cost_usd': .002, 'usage': {'input_tokens': 12, 'output_tokens': 3},
             'modelUsage': {'claude-haiku-5-5-20261001': {'inputTokens': 12}}}
    out = broker.parse(json.dumps(value), 'haiku')
    assert out['choice'] == 'C' and out['status'] == 'ok'
    assert out['model'] == 'claude-haiku-5-5-20261001'
    assert out['usage'] == value['usage'] and out['cost'] == .002
    value['num_turns'] = 2
    out = broker.parse(json.dumps(value), 'haiku')
    assert out['status'] == 'tool_use' and out['model'] == 'claude-haiku-5-5-20261001'
    value.update(num_turns=1, is_error=True)
    assert broker.parse(json.dumps(value), 'haiku')['status'] == 'malformed'


def test_t5_codex_configuration_warnings_before_turn_only():
    warning = {'type': 'item.completed', 'item': {'type': 'error', 'message': 'unknown config setting'}}
    start = {'type': 'turn.started'}
    answer = {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': '{"choice":"B"}'}}
    finish = {'type': 'turn.completed', 'usage': {'input_tokens': 3}}
    def parse(events):
        return broker.parse('\n'.join(map(json.dumps, events)), 'astra')
    out = parse([warning, start, answer, finish])
    assert out['status'] == 'ok' and out['choice'] == 'B'
    assert out['configuration_warnings'] == [warning['item']]
    assert parse([start, warning, answer, finish])['status'] == 'tool_use'
    for kind in ('item.started', 'item.updated'):
        assert parse([{**warning, 'type': kind}, start, answer, finish])['status'] == 'tool_use'
    for kind in ('unknown', 'command_execution', 'mcp_tool_call'):
        assert parse([{'type': 'item.completed', 'item': {'type': kind}}, start, answer, finish])['status'] == 'tool_use'


def test_t5_codex_clean_auth_only_home_preserved(tmp_path, monkeypatch):
    import types
    source = tmp_path / 'user-config'
    source.mkdir()
    (source / 'auth.json').write_text('{"fake_login":true}')
    (source / 'AGENTS.md').write_text('must not be inherited')
    (source / 'config.toml').write_text('must not be inherited')
    monkeypatch.setenv('CODEX_HOME', str(source))
    monkeypatch.setattr(broker, 'private_root', lambda *a, **kw: None)
    homes = []
    def run(argv, **kwargs):
        home = Path(kwargs['env']['CODEX_HOME'])
        homes.append(home)
        assert set(p.name for p in home.iterdir()) == {'auth.json'}
        assert (home / 'auth.json').stat().st_mode & 0o777 == 0o600
        assert not list(Path(kwargs['cwd']).iterdir())
        assert 'features.skills=false' not in argv
        raw = '\n'.join(map(json.dumps, [{'type': 'turn.started'},
              {'type': 'item.completed', 'item': {'type': 'agent_message', 'text': '{"choice":"A"}'}},
              {'type': 'turn.completed'}])).encode()
        return types.SimpleNamespace(returncode=0, stdout=raw, stderr=b'')
    monkeypatch.setattr(broker.subprocess, 'run', run)
    record = broker.invoke(payload(), 'astra', tmp_path / 'raw')
    assert record['result']['status'] == 'ok'
    assert homes and all(not p.exists() for p in homes)
    assert (source / 'AGENTS.md').exists()


def test_t5_per_case_void_cap_and_shared_pairing():
    cases, records = trial(10, repeats=1)
    records[('haiku', 's', cases[0]['id'])]['result'] = {'choice': None, 'status': 'transport'}
    records[('haiku', 'numbers', cases[0]['id'])]['result'] = {'choice': None, 'status': 'tool_use'}
    out = score(cases, records)
    assert not out['invalid'] and not out['incomplete']
    assert out['members'] == 9 and out['triples'] == 9
    assert out['voids']['haiku']['cases'] == 1 and out['voids']['haiku']['share'] == .1
    for reader in out['readers'].values():
        assert reader['s']['share']['n'] == reader['numbers']['share']['n'] == reader['s_minus_numbers']['n'] == 9
    records[('haiku', 'none', cases[1]['id'])]['result'] = {'choice': None, 'status': 'tool_use'}
    out = score(cases, records)
    assert out['incomplete'] and out['invalid'] and not out['pass']
    assert out['voids']['haiku']['cases'] == 2


def test_t5_void_union_preserves_unaffected_triples_and_members():
    cases, records = trial(10)
    records[('haiku', 's', cases[0]['id'])]['result'] = {'choice': None, 'status': 'transport'}
    records[('astra', 'none', cases[1]['id'])]['result'] = {'choice': None, 'status': 'tool_use'}
    out = score(cases, records)
    assert not out['invalid'] and out['members'] == 10 and out['triples'] == 38
    assert out['excluded_void_triples'] == 2
    assert all(r['s']['share']['n'] == 10 for r in out['readers'].values())


def test_t5_edited_sensitivity_and_fixed_strata():
    from t5.score import markdown
    cases, records = trial(8, repeats=2)
    for i, c in enumerate(cases):
        c.update(early_size=(39, 40, 79, 80, 159, 160, 200, 20)[i // 2],
                 show_share=(0, 1/15, 7/15, 8/15)[i // 4], edited_labels=int(i % 2 == 0))
        if c['edited_labels']:
            for reader in ('haiku', 'astra'):
                records[(reader, 's', c['id'])]['result']['status'] = 'malformed'
    out = score(cases, records)
    assert out['triples'] == 16 and out['readers']['haiku']['s']['share']['value'] == .5
    clean = out['sensitivity_unedited']
    assert clean['members'] == 8 and clean['triples'] == 8
    assert clean['readers']['haiku']['s']['share']['value'] == 1
    assert [s['members'] for s in out['strata']['early_size'].values()] == [2, 2, 2, 2]
    assert [s['triples'] for s in out['strata']['show_share'].values()] == [4, 8, 4]
    text = markdown(out)
    assert 'unedited lists' in text and 'early_size: 160_plus' in text and 'show_share: at_least_half' in text
    assert text == markdown(json.loads(json.dumps(out, sort_keys=True)))
