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
assert set(services) == {'front', 'api', 'gateway', 'valkey'}
api, gateway = services['api']['environment'], services['gateway']['environment']
assert api['REDIS_USER'] == api['YEPWATCH_PROPOSAL_REDIS_USER'] == gateway['YEPWATCH_VALKEY_USER'] == 'existing-user'
assert api['REDIS_PASS'] == api['YEPWATCH_PROPOSAL_REDIS_PASSWORD'] == gateway['YEPWATCH_VALKEY_PASSWORD'] == 'test-existing-redis'
assert 'environment' not in services['front']
# Coolify removes the old containers (newest first) before it starts any new one: an api stop delay only lengthens
# the outage of every deploy.
assert api['YEPWATCH_PROPOSAL_SHUTDOWN_DELAY_MS'] == '0'
assert 'CRATE_PASS' not in gateway
# Live rooms (docs/yepwatch-valkey-rooms.md): a dedicated Valkey that never evicts, persists every second on a
# named volume and publishes no port.
valkey = services['valkey']
command = ' '.join(valkey['command'])
for flag in ('--appendonly yes', '--appendfsync everysec', '--maxmemory-policy noeviction', '--dir /data'):
    assert flag in command, flag
assert valkey['image'].startswith('valkey/valkey:') and valkey['image'].count('.') == 2, 'pin the valkey image'
assert [(v['type'], v['source'], v['target']) for v in valkey['volumes']] == [('volume', 'valkey-data', '/data')]
assert not valkey.get('ports'), 'the rooms Valkey publishes no port'
# Deploy order (Coolify creates in dependency order and removes newest first): valkey, then the api once valkey has
# started (not healthy: that wait cost 2.5 s a deploy), then the front once the api has started, then the gateway. So the
# gateway goes first, the front never holds a request for an api that is already gone, and valkey goes last.
assert not valkey.get('depends_on')
assert {k: v['condition'] for k, v in services['api']['depends_on'].items()} == {'valkey': 'service_started'}
assert {k: v['condition'] for k, v in services['front']['depends_on'].items()} == {'api': 'service_started'}
# The gateway last of all, so removed first: its goodbye reaches phones before a request can meet a stopping front.
assert {k: v['condition'] for k, v in services['gateway']['depends_on'].items()} == {'api': 'service_started', 'front': 'service_started'}
assert api['YEPWATCH_PROPOSAL_ROOMS_VALKEY_URL'] == 'redis://valkey:6379'
assert valkey['environment']['YEPWATCH_ROOMS_VALKEY_SEED'] == values['YEPWATCH_ROOM_KEY']
assert 'valkey' not in json.dumps(services['gateway'].get('depends_on', {}))
for name, service in services.items():
    if name == 'valkey':
        continue
    build = service['build']
    assert Path(build['context']).resolve() == root, 'Coolify project directory must resolve to repository root'
    assert (Path(build['context']) / build['dockerfile']).is_file(), 'Dockerfile must exist inside resolved context'
    assert service['build']['target'] == name
    assert not service['build'].get('args'), 'Runtime secrets must not be build arguments'
    if name not in ('front', 'gateway'):
        assert not service.get('ports'), 'Only the front and the gateway may publish a port'
    assert not service.get('env_file') and not service.get('secrets'), 'No host-side private files required'
# The always-on hold (docs/yepwatch-zero-downtime-front.md) reaches the front and, for the live channel's WebSocket,
# the gateway at fixed private addresses.
ports = lambda name: [(p['host_ip'], p['published'], p['target'], p.get('protocol', 'tcp')) for p in services[name]['ports']]
assert ports('front') == [('10.0.0.21', '18480', 8080, 'tcp')], ports('front')
assert ports('gateway') == [('10.0.0.21', '18481', 4311, 'tcp')], ports('gateway')
local = render(dict(values, YEPWATCH_FRONT_ADDRESS='127.0.0.1'))
assert local.returncode == 0, local.stderr
assert all(json.loads(local.stdout)['services'][n]['ports'][0]['host_ip'] == '127.0.0.1' for n in ('front', 'gateway'))
separate = render(dict(values, YEPWATCH_CATALOG_REDIS_USER='reader', YEPWATCH_CATALOG_REDIS_PASSWORD='test-reader'))
assert separate.returncode == 0, separate.stderr
api = json.loads(separate.stdout)['services']['api']['environment']
assert api['REDIS_USER'] == 'reader' and api['REDIS_PASS'] == 'test-reader'
assert api['YEPWATCH_PROPOSAL_REDIS_USER'] == 'existing-user'
print('PASS: required secrets, three repository targets, a persistent noeviction rooms Valkey, shared/independent Redis credentials, runtime-only secrets, private hold ports on the front and gateway, deploy order, no api stop delay')
