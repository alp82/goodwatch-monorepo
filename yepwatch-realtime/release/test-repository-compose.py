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
# Coolify removes the old containers (front first) before it starts any new one: an api stop delay only lengthens
# the outage of every deploy.
assert api['YEPWATCH_PROPOSAL_SHUTDOWN_DELAY_MS'] == '0'
assert 'CRATE_PASS' not in gateway
for name, service in services.items():
    build = service['build']
    assert Path(build['context']).resolve() == root, 'Coolify project directory must resolve to repository root'
    assert (Path(build['context']) / build['dockerfile']).is_file(), 'Dockerfile must exist inside resolved context'
    assert service['build']['target'] == name
    assert not service['build'].get('args'), 'Runtime secrets must not be build arguments'
    if name != 'front':
        assert not service.get('ports'), 'Only the front may publish a port'
    assert not service.get('env_file') and not service.get('secrets'), 'No host-side private files required'
# The always-on hold (docs/yepwatch-zero-downtime-front.md) reaches the front at one fixed private address.
front_ports = services['front']['ports']
assert [(p['host_ip'], p['published'], p['target'], p.get('protocol', 'tcp')) for p in front_ports] == [('10.0.0.21', '18480', 8080, 'tcp')], front_ports
local = render(dict(values, YEPWATCH_FRONT_ADDRESS='127.0.0.1'))
assert local.returncode == 0, local.stderr
assert json.loads(local.stdout)['services']['front']['ports'][0]['host_ip'] == '127.0.0.1'
separate = render(dict(values, YEPWATCH_CATALOG_REDIS_USER='reader', YEPWATCH_CATALOG_REDIS_PASSWORD='test-reader'))
assert separate.returncode == 0, separate.stderr
api = json.loads(separate.stdout)['services']['api']['environment']
assert api['REDIS_USER'] == 'reader' and api['REDIS_PASS'] == 'test-reader'
assert api['YEPWATCH_PROPOSAL_REDIS_USER'] == 'existing-user'
print('PASS: required secrets, three repository targets, shared/independent Redis credentials, runtime-only secrets, one private hold port on the front, no api stop delay')
