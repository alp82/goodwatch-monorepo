#!/usr/bin/env python3
"""Real loopback-only Traefik privacy test; no production requests."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import urllib.request
spec = importlib.util.spec_from_file_location('prepare', Path(__file__).with_name('prepare-access-log.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
# Include a sensitive fixture setting to verify exact preservation without printing it.
fixture = '''services:
  traefik:
    image: traefik:v2.10
    command:
      - --ping=true
      - --private.fixture=preserve-credential
    labels:
      example: preserve
networks:
  coolify:
    external: true
'''
for version in ['2.10.7', '3.6.25']:
    candidate = module.prepare(fixture, version)
    assert candidate.replace(''.join('      - '+s+'\n' for s in module.flags(version)), '') == fixture
try:
    module.prepare(fixture.replace('--ping=true', '--accesslog=true'), '2.10.7')
    raise AssertionError('Should reject preexisting logging')
except ValueError:
    pass
results = []
for version, binary in [('2.10.7', sys.argv[1]), ('3.6.25', sys.argv[2])]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        port = 39427 if version == '2.10.7' else 39428
        config = root / 'dynamic.yml'
        config.write_text('''http:
  routers:
    gw-search-fixture:
      rule: PathPrefix(`/`)
      service: unavailable
  services:
    unavailable:
      loadBalancer:
        servers:
          - url: http://127.0.0.1:1
''')
        log = root / 'access.ndjson'
        stderr = root / 'stderr'
        with stderr.open('wb') as errors:
            process = subprocess.Popen([binary, '--entrypoints.test.address=127.0.0.1:'+str(port), '--providers.file.filename='+str(config), '--accesslog.filepath='+str(log), *module.flags(version)], stdout=errors, stderr=errors)
            try:
                ready = False
                for _ in range(100):
                    if process.poll() is not None:
                        raise RuntimeError('Traefik exited before test')
                    request = urllib.request.Request('http://127.0.0.1:'+str(port)+'/private-fixture?secret=private-query', data=b'private-body', headers={'Authorization':'private-token','Cookie':'private-cookie','Referer':'private-referrer','User-Agent':'private-agent'})
                    try:
                        urllib.request.urlopen(request, timeout=.3)
                    except urllib.error.HTTPError as e:
                        if e.code == 404:
                            time.sleep(.05)
                            continue
                        assert e.code == 502
                        ready = True
                    except urllib.error.URLError:
                        time.sleep(.05)
                        continue
                    if ready:
                        break
                assert ready, stderr.read_text()
                for _ in range(100):
                    if log.exists() and log.stat().st_size:
                        break
                    time.sleep(.02)
                all_records = [json.loads(s) for s in log.read_text().splitlines()]
                allowed = {'StartUTC','RouterName','RequestMethod','DownstreamStatus','level','msg','time'}
                for record in all_records:
                    assert set(record) <= allowed, 'Unexpected access fields'
                    assert not any('private-' in str(value) for value in record.values())
                records = [r for r in all_records if r.get('RouterName') == 'gw-search-fixture@file']
                assert records
                allowed = {'StartUTC','RouterName','RequestMethod','DownstreamStatus','level','msg','time'}
                for record in records:
                    assert set(record) <= allowed, 'Unexpected access fields'
                    assert record['RouterName'] == 'gw-search-fixture@file'
                    assert record['RequestMethod'] == 'POST'
                    assert record['DownstreamStatus'] == 502
                    assert not any('private-' in str(value) for value in record.values())
                    if 'msg' in record:
                        assert record['msg'] == ''
                results.append({'version':version,'keys':sorted(records[0]),'status':502,'privacy_pass':True})
            finally:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
print(json.dumps({'compose_preservation_pass':True,'tests':results},indent=2))
