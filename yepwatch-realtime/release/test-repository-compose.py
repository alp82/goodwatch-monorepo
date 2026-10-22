"""Validate Coolify interpolation with disposable values; no containers or network."""
import json
import os
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[2]
base = {k: v for k, v in os.environ.items() if not k.startswith(('YEPWATCH_', 'COMPOSE_'))}
values = dict(base, YEPWATCH_ROOM_KEY='test-room-key-not-a-secret-0000000000',
              YEPWATCH_GATEWAY_SECRET='test-gateway-not-a-secret-000000000',
              YEPWATCH_ROOM_PASSWORD='test-room', YEPWATCH_CATALOG_PASSWORD='test-catalog',
              YEPWATCH_REDIS_PASSWORD='test-existing-redis', YEPWATCH_REDIS_USER='existing-user')

def render(env):
    return subprocess.run(['docker', 'compose', '--env-file', '/dev/null', '--project-directory', str(root), '-f', 'yepwatch-app/compose.yaml',
                           'config', '--format', 'json'], cwd=root, env=env, capture_output=True, text=True)

assert render(base).returncode != 0, 'Missing runtime secrets must fail'
result = render(values)
assert result.returncode == 0, result.stderr
services = json.loads(result.stdout)['services']
assert set(services) == {'front', 'api', 'gateway'}
api, gateway = services['api']['environment'], services['gateway']['environment']
assert api['REDIS_USER'] == api['YEPWATCH_PROPOSAL_REDIS_USER'] == gateway['YEPWATCH_VALKEY_USER'] == 'existing-user'
assert api['REDIS_PASS'] == api['YEPWATCH_PROPOSAL_REDIS_PASSWORD'] == gateway['YEPWATCH_VALKEY_PASSWORD'] == 'test-existing-redis'
assert 'environment' not in services['front']
assert 'CRATE_PASS' not in gateway
for name, service in services.items():
    build = service['build']
    assert Path(build['context']).resolve() == root, 'Coolify project directory must resolve to repository root'
    assert (Path(build['context']) / build['dockerfile']).is_file(), 'Dockerfile must exist inside resolved context'
    assert service['build']['target'] == name
    assert not service['build'].get('args'), 'Runtime secrets must not be build arguments'
    assert not service.get('ports'), 'Only Coolify proxy should publish the front'
    assert not service.get('env_file') and not service.get('secrets'), 'No host-side private files required'
separate = render(dict(values, YEPWATCH_CATALOG_REDIS_USER='reader', YEPWATCH_CATALOG_REDIS_PASSWORD='test-reader'))
assert separate.returncode == 0, separate.stderr
api = json.loads(separate.stdout)['services']['api']['environment']
assert api['REDIS_USER'] == 'reader' and api['REDIS_PASS'] == 'test-reader'
assert api['YEPWATCH_PROPOSAL_REDIS_USER'] == 'existing-user'
print('PASS: required secrets, three repository targets, shared/independent Redis credentials, runtime-only secrets and proxy-only ports')
