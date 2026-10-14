"""Local Docker only: rolling patch upgrade, auth grants, and patch rollback.

Compose topology and verify.mjs derive from #530 / d87126ee.
No production endpoints, credentials, or SSH commands exist in this runner.
"""
import base64
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.request

OLD = 'crate:5.10.9@sha256:0ab5077b2cc4180a855250c8f0af425386197f7586af39a7b5d7a08c16558184'
NEW = 'crate:5.10.16@sha256:5d7cd92eb84d56d538e2222a436e432164b853fdf186aebb17c446787f23a307'
ROOT = Path(__file__).resolve().parent
ENDPOINTS = [f'http://127.0.0.1:{port}/_sql' for port in (16430, 16431, 16432)]
REPORT = {'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
          'oldImage': OLD, 'targetImage': NEW, 'stages': [], 'writes': []}
START_AUTH = '--start-at-auth' in sys.argv
HBA_FROM_START = '--hba-from-start' in sys.argv
ENV = dict(os.environ, CRATE_IMAGE=NEW if START_AUTH else OLD, LOCAL_HBA_ENABLED='true' if START_AUTH or HBA_FROM_START else 'false')
assert ENV['DOCKER_HOST'].startswith('unix:///')
COMPOSE = ['docker', '--host', ENV['DOCKER_HOST'], 'compose', '-f', str(ROOT / 'compose.yaml'), '-p', 'goodwatch-upgrade-547']


def compose(*args):
    return subprocess.check_output(COMPOSE + list(args), env=ENV, text=True, timeout=900)


def sql(stmt, args=None, node=0, user=None, password=None):
    headers = {'Content-Type': 'application/json'}
    if user:
        headers['Authorization'] = 'Basic ' + base64.b64encode(f'{user}:{password}'.encode()).decode()
    request = urllib.request.Request(ENDPOINTS[node], json.dumps({'stmt': stmt, 'args': args or []}).encode(), headers)
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            return {'status': response.status, **json.load(response)}
    except urllib.error.HTTPError as error:
        body = error.read().decode()
        try:
            return {'status': error.code, **json.loads(body)}
        except json.JSONDecodeError:
            return {'status': error.code, 'body': body}
    except (OSError, TimeoutError) as error:
        return {'transportError': str(error)}


def ok(result):
    assert result.get('status') == 200 and 'error' not in result, result
    return result


def wait(label, check, timeout=240):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if check():
                return
        except (AssertionError, KeyError, TypeError):
            pass
        time.sleep(0.5)
    raise AssertionError(f'Timeout: {label}')


def nodes(node=0):
    return ok(sql("SELECT name, version['number'] FROM sys.nodes ORDER BY name", node=node))['rows']


def healthy(node=0):
    health = sql('SELECT health, missing_shards, underreplicated_shards FROM sys.health', node=node)
    busy = sql("SELECT count(*) FROM sys.shards WHERE state <> 'STARTED'", node=node)
    return health.get('status') == 200 and all(r == ['GREEN', 0, 0] for r in health['rows']) and busy.get('rows') == [[0]]


def record(label, node=0):
    value = {'label': label, 'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
             'nodes': nodes(node), 'health': ok(sql('SELECT table_schema, table_name, partition_ident, health, missing_shards, underreplicated_shards FROM sys.health', node=node)),
             'shards': ok(sql("SELECT table_name, id, primary, state, node['name'] FROM sys.shards ORDER BY table_name, id, primary", node=node)),
             'containers': compose('images', '--format', 'json')}
    REPORT['stages'].append(value)
    (ROOT / 'results/rolling-observations.json').write_text(json.dumps(REPORT, indent=2) + '\n')
    print(label, value['nodes'], flush=True)


def roll(image, label):
    ENV['CRATE_IMAGE'] = image
    version = image.split(':')[1].split('@')[0]
    for index in range(3):
        coordinator = (index + 1) % 3
        wait('green before node restart', lambda: healthy(coordinator))
        ok(sql("SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'primaries'", node=coordinator))
        subprocess.run(['docker', '--host', ENV['DOCKER_HOST'], 'update', '--restart=no', f'goodwatch-upgrade-547-node{index + 1}-1'], check=True, env=ENV, capture_output=True)
        node_id = ok(sql('SELECT id FROM sys.nodes WHERE name = ?', [f'node{index + 1}'], node=coordinator))['rows'][0][0]
        ok(sql('ALTER CLUSTER DECOMMISSION ?', [node_id], node=coordinator))
        wait('decommissioned node absent', lambda: len(nodes(coordinator)) == 2)
        wait('decommissioned process exited', lambda: subprocess.check_output(['docker', '--host', ENV['DOCKER_HOST'], 'inspect', f'goodwatch-upgrade-547-node{index + 1}-1', '--format', '{{.State.Status}}'], env=ENV, text=True).strip() == 'exited')
        remaining = nodes(coordinator)
        assert len(remaining) == 2, remaining
        down_health = ok(sql('SELECT health, missing_shards, underreplicated_shards FROM sys.health', node=coordinator))
        assert all(r[1] == 0 for r in down_health['rows']), down_health
        probe_id = f'{label}-down-{index}'
        ok(sql('INSERT INTO doc.auth_upgrade_probe (id, n) VALUES (?, 1)', [probe_id], node=coordinator))
        assert ok(sql('SELECT n FROM doc.auth_upgrade_probe WHERE id = ?', [probe_id], node=coordinator))['rows'] == [[1]]
        REPORT['writes'].append({'id': probe_id, 'coordinator': coordinator, 'nodeDown': index, 'acknowledged': True, 'healthWhileDown': down_health})
        compose('up', '-d', '--no-deps', '--force-recreate', f'node{index + 1}')
        wait('three nodes including target version', lambda: len(nodes(coordinator)) == 3 and nodes(coordinator)[index][1] == version)
        ok(sql("SET GLOBAL TRANSIENT \"cluster.routing.allocation.enable\" = 'all'", node=coordinator))
        wait('all copies started and green', lambda: healthy(coordinator))
        for read_node in range(3):
            for write in REPORT['writes']:
                assert ok(sql('SELECT n FROM doc.auth_upgrade_probe WHERE id = ?', [write['id']], node=read_node))['rows'] == [[1]]
        policy = subprocess.check_output(['docker', '--host', ENV['DOCKER_HOST'], 'inspect', f'goodwatch-upgrade-547-node{index + 1}-1', '--format', '{{.HostConfig.RestartPolicy.Name}}'], env=ENV, text=True).strip()
        assert policy == 'always', policy
        record(f'{label}-node{index + 1}', coordinator)


try:
    compose('up', '-d')
    baseline_version = '5.10.16' if START_AUTH else '5.10.9'
    wait('three baseline nodes', lambda: nodes() == [[f'node{i}', baseline_version] for i in (1, 2, 3)])
    ok(sql('CREATE TABLE doc.auth_upgrade_probe (id TEXT PRIMARY KEY, n INTEGER) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = \'2\', "write.wait_for_active_shards" = 1, "translog.durability" = \'REQUEST\')'))
    ok(sql('CREATE TABLE doc.catalog_probe (id TEXT PRIMARY KEY) CLUSTERED INTO 1 SHARDS WITH (number_of_replicas = \'2\')'))
    wait('baseline green', healthy)
    record('baseline')
    if not START_AUTH:
        roll(NEW, 'upgrade')
    ok(sql('CREATE USER goodwatch_auth WITH (password = ?)', ['local-rehearsal-only-547']))
    ok(sql('GRANT DQL, DML ON TABLE doc.auth_upgrade_probe TO goodwatch_auth'))
    if not START_AUTH and not HBA_FROM_START:
        REPORT['authWithoutHba'] = sql('SELECT current_user', user='crate', password='wrong-password')
        assert REPORT['authWithoutHba']['rows'] == [['crate']]
        # Local-only demonstration; not a production client migration.
        ENV['LOCAL_HBA_ENABLED'] = 'true'
        roll(NEW, 'local-hba-enable')
    else:
        REPORT['hbaEvidence'] = 'upgrade-policy-observations.json (prior local HBA roll)'
    auth_results = []
    for index in range(3):
        assert sql('SELECT current_user', node=index, user='goodwatch_auth', password='wrong-password')['status'] == 401
        who = ok(sql('SELECT current_user', node=index, user='goodwatch_auth', password='local-rehearsal-only-547'))
        assert who['rows'] == [['goodwatch_auth']]
        allowed = ok(sql('SELECT n FROM doc.auth_upgrade_probe WHERE id = ?', ['upgrade-down-0'], node=index, user='goodwatch_auth', password='local-rehearsal-only-547'))
        denied = sql('SELECT * FROM doc.catalog_probe', node=index, user='goodwatch_auth', password='local-rehearsal-only-547')
        denied_ddl = sql('CREATE TABLE doc.auth_forbidden (id TEXT)', node=index, user='goodwatch_auth', password='local-rehearsal-only-547')
        # Unauthorized objects can deliberately be concealed as unknown schemas.
        for refusal in (denied, denied_ddl):
            assert refusal.get('status') in (401, 403, 404) and refusal.get('error'), refusal
        visible_to_admin = ok(sql("SELECT table_name FROM information_schema.tables WHERE table_schema = 'doc' AND table_name IN ('catalog_probe', 'auth_forbidden') ORDER BY table_name"))
        assert visible_to_admin['rows'] == [['catalog_probe']], visible_to_admin
        credentials = dict(node=index, user='goodwatch_auth', password='local-rehearsal-only-547')
        key = f'auth-crud-{index}'
        created = ok(sql('INSERT INTO doc.auth_upgrade_probe (id, n) VALUES (?, 1)', [key], **credentials))
        updated = ok(sql('UPDATE doc.auth_upgrade_probe SET n = 2 WHERE id = ?', [key], **credentials))
        assert created['rowcount'] == updated['rowcount'] == 1
        assert ok(sql('SELECT n FROM doc.auth_upgrade_probe WHERE id = ?', [key], **credentials))['rows'] == [[2]]
        deleted = ok(sql('DELETE FROM doc.auth_upgrade_probe WHERE id = ?', [key], **credentials))
        assert deleted['rowcount'] == 1
        assert ok(sql('SELECT n FROM doc.auth_upgrade_probe WHERE id = ?', [key], **credentials))['rows'] == []
        auth_results.append({'node': index, 'identity': who, 'allowed': allowed, 'catalogDenied': denied, 'ddlDenied': denied_ddl, 'crudRowcounts': [created['rowcount'], updated['rowcount'], deleted['rowcount']]})
    REPORT['authEnforced'] = auth_results
    (ROOT / 'results/rolling-observations.json').write_text(json.dumps(REPORT, indent=2) + '\n')
    roll(OLD, 'rollback')
    assert nodes() == [[f'node{i}', '5.10.9'] for i in (1, 2, 3)]
    REPORT['userAfterRollback'] = ok(sql('SELECT current_user', user='goodwatch_auth', password='local-rehearsal-only-547'))
    roll(NEW, 'reupgrade')
    REPORT['finalSettings'] = ok(sql("SELECT settings FROM information_schema.tables WHERE table_name = 'auth_upgrade_probe'"))
    REPORT['finalPrivileges'] = ok(sql("SELECT * FROM sys.privileges WHERE grantee = 'goodwatch_auth'"))
    if '--skip-cas' in sys.argv:
        previous = json.loads((ROOT / 'cas-observations.json').read_text())
        assert previous['passed'] and all(row[1] == '5.10.16' for row in previous['nodes'])
        REPORT['casEvidence'] = 'cas-observations.json (prior passing run, same pinned target)'
    else:
        # Fault injection last: abandoned server operations can delay later drains.
        ENV['LOCAL_HBA_ENABLED'] = 'false'
        roll(NEW, 'local-hba-disable-before-faults')
        subprocess.run(['node', str(ROOT / 'verify.mjs'), str(ROOT / 'results/cas-observations.json')], env=ENV, check=True, timeout=1200)
        wait('green after CAS faults', healthy)
        REPORT['casEvidence'] = 'results/cas-observations.json'
    REPORT['passed'] = True
except BaseException as error:
    REPORT['failure'] = str(error)
    raise
finally:
    REPORT['finishedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    (ROOT / 'results/rolling-observations.json').write_text(json.dumps(REPORT, indent=2) + '\n')
