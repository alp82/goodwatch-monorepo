"""Opaque payload in, immutable CLI bytes out. Never accepts a case or answer map.

No temperature or seed is available in these CLIs. Only transport failures retry;
completed malformed answers and tool use are terminal. Real calls wait for registration.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

from .storage import write, private_root

PROMPT = Path(__file__).with_name('prompt.txt').read_text().strip()
MODELS = {'haiku': 'claude-haiku-5-5', 'astra': 'gpt-6-astra'}
SYSTEM = 'You are a blind reader. Follow only the task instructions. Use no tools. Return one JSON choice.'


def command(reader):
    if reader == 'haiku':
        return ['claude', '-p', '--model', MODELS[reader], '--effort', 'low', '--output-format', 'json',
                '--no-session-persistence', '--safe-mode', '--restricted', '--tools', '', '--setting-sources', '',
                '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--system-prompt', SYSTEM,
                '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--max-budget-usd', '1']
    if reader == 'astra':
        return ['codex', 'exec', '-m', MODELS[reader], '-s', 'read-only', '--skip-git-repo-check', '--ephemeral',
                '--ignore-user-config', '--ignore-rules', '--json', '-c', 'project_doc_max_bytes=0',
                '-c', 'model_reasoning_effort="low"', '-c', 'features.shell_tool=false',
                '-c', 'features.apps=false',
                '-c', 'developer_instructions=' + json.dumps(SYSTEM)]
    raise ValueError('unknown reader')


def validate_payload(payload):
    if set(payload) != {'description', 'lists'} or not isinstance(payload['description'], str) or set(payload['lists']) != set('ABC'):
        raise ValueError('opaque payload required')
    for rows in payload['lists'].values():
        if len(rows) != 15:
            raise ValueError('15 rows required')
        for r in rows:
            if set(r) != {'title', 'year', 'type', 'rating'}:
                raise ValueError('private metadata in payload')


def choice(text):
    try:
        value = json.loads(text)
        return value['choice'] if set(value) == {'choice'} and value['choice'] in ('A', 'B', 'C') else None
    except (ValueError, TypeError, KeyError):
        return None


def parse(raw, reader):
    """An allowlist of Codex item kinds makes new tool event types fail closed."""
    result = {'choice': None, 'status': 'malformed', 'model': MODELS[reader], 'usage': None, 'cost': None,
              'configuration_warnings': []}
    try:
        if reader == 'haiku':
            value = json.loads(raw)
            models = sorted(value.get('modelUsage', {}))
            result.update(model=models[0] if len(models) == 1 else models or MODELS[reader],
                          usage=value.get('usage'), cost=value.get('total_cost_usd'))
            if value.get('num_turns', 0) > 1:
                return {**result, 'status': 'tool_use'}
            if value.get('is_error'):
                return result
            answer = value.get('result', '')
        else:
            events = [json.loads(line) for line in raw.splitlines() if line.strip()]
            answer = ''
            complete = False
            turn_started = False
            for event in events:
                kind = event.get('type', '')
                if kind not in ('thread.started', 'turn.started', 'turn.completed', 'turn.failed', 'error',
                                'item.started', 'item.updated', 'item.completed'):
                    return {**result, 'status': 'tool_use'}
                if 'tool' in kind or kind in ('command_execution', 'web_search'):
                    return {**result, 'status': 'tool_use'}
                if kind.startswith('item.'):
                    item = event.get('item', {})
                    if kind == 'item.completed' and item.get('type') == 'error' and not turn_started:
                        result['configuration_warnings'].append(item)
                        continue
                    if item.get('type') not in ('agent_message', 'reasoning'):
                        return {**result, 'status': 'tool_use'}
                    if kind == 'item.completed' and item.get('type') == 'agent_message':
                        answer = item.get('text', '')
                if kind == 'turn.completed':
                    complete = True
                    result['usage'] = event.get('usage')
                if kind == 'turn.started':
                    turn_started = True
                if kind in ('error', 'turn.failed'):
                    return {**result, 'status': 'transport'}
                if event.get('model'):
                    result['model'] = event['model']
            if not complete:
                return {**result, 'status': 'transport'}
        result['choice'] = choice(answer)
        result['status'] = 'ok' if result['choice'] else 'malformed'
    except (ValueError, TypeError, AttributeError):
        pass
    return result


def invoke(payload, reader, folder, *, fake_command=None, timeout=1800):
    validate_payload(payload)
    folder = Path(folder)
    private_root(folder.parent, synthetic=bool(fake_command))
    folder.mkdir(mode=0o700, parents=True, exist_ok=False)
    prompt = PROMPT + '\n\n' + json.dumps(payload, ensure_ascii=False, sort_keys=True)
    argv = fake_command if fake_command else command(reader)
    # Do not inherit memory, hooks, project context, or shell startup settings.
    env = {k: v for k,v in os.environ.items() if k in ('PATH', 'LANG', 'LC_ALL', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY')}
    env['CLAUDE_CODE_SAFE_MODE'] = '1'
    attempts = []
    started = time.monotonic()
    for attempt in range(2):
        cwd = Path(tempfile.mkdtemp(prefix='reader-', dir=folder))
        os.chmod(cwd, 0o700)
        # Codex reads hooks, memories, rules and AGENTS.md from CODEX_HOME even with --ignore-user-config: give it a
        # home that holds only the login, outside the reader's working folder, removed after the call.
        home = None
        if reader == 'astra' and not fake_command:
            home = Path(tempfile.mkdtemp(prefix='codex-home-', dir=folder))
            os.chmod(home, 0o700)
            shutil.copyfile(Path(os.environ.get('CODEX_HOME', Path.home() / '.codex')) / 'auth.json', home / 'auth.json')
            os.chmod(home / 'auth.json', 0o600)
            env['CODEX_HOME'] = str(home)
        transport = False
        try:
            done = subprocess.run(argv, input=prompt.encode(), capture_output=True, cwd=cwd, env=env, timeout=timeout)
            stdout, stderr = done.stdout, done.stderr
            transport = done.returncode != 0
        except (subprocess.TimeoutExpired, OSError) as exc:
            stdout = exc.stdout or b'' if isinstance(exc, subprocess.TimeoutExpired) else b''
            stderr = type(exc).__name__.encode()
            transport = True
        finally:
            shutil.rmtree(cwd)
            if home:
                shutil.rmtree(home)
        stdout_name, stderr_name = f'{attempt}.stdout', f'{attempt}.stderr'
        write(folder / stdout_name, stdout)
        write(folder / stderr_name, stderr)
        parsed = parse(stdout.decode('utf-8', errors='replace'), reader)
        if transport:
            parsed.update(status='transport', choice=None)
        attempts.append({'stdout': stdout_name, 'stderr': stderr_name,
                         'stdout_sha256': hashlib.sha256(stdout).hexdigest(),
                         'stderr_sha256': hashlib.sha256(stderr).hexdigest(), 'parsed': parsed,
                         'transport': transport})
        if parsed['status'] != 'transport':
            break
    record = {'reader': reader, 'requested_model': MODELS[reader], 'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(),
              'attempts': attempts, 'result': parsed, 'temperature': 'unavailable', 'seed': 'unavailable',
              'reasoning': 'low', 'seconds': time.monotonic() - started, 'fake': bool(fake_command)}
    write(folder / 'record.json', record)
    return record


def replay(folder):
    folder = Path(folder)
    record = json.loads((folder / 'record.json').read_text())
    for attempt in record['attempts']:
        for name in ('stdout', 'stderr'):
            raw = (folder / attempt[name]).read_bytes()
            if hashlib.sha256(raw).hexdigest() != attempt[name + '_sha256']:
                raise ValueError('changed response bytes')
        parsed = parse((folder / attempt['stdout']).read_text(errors='replace'), record['reader'])
        if attempt['transport']:
            parsed.update(status='transport', choice=None)
        if parsed != attempt['parsed']:
            raise ValueError('changed parser result')
    if record['result'] != record['attempts'][-1]['parsed']:
        raise ValueError('changed response result')
    return record
