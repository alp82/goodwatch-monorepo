"""Read-only helpers for production Crate and Qdrant. Every call is guarded and throttled."""
import json, time, requests

ENV = {}
for line in open('/home/alp/dev/projects/goodwatch/goodwatch-monorepo/goodwatch-webapp/.env'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        ENV[k] = v.strip().strip('"').strip("'")
CRATE = f"http://{ENV['CRATE_HOSTS'].split(',')[0]}:{ENV['CRATE_PORT']}/_sql"
CAUTH = (ENV['CRATE_USER'], ENV['CRATE_PASS'])
QD = ENV['QDRANT_URL'].replace(':6334', ':6333')
QH = {'api-key': ENV.get('QDRANT_API_KEY', '')}
QCALLS = 0
QMAX = 600
S = requests.Session()


def sql(stmt, args=None):
    s = stmt.strip().lower()
    assert s.startswith('select') or s.startswith('with'), 'read only'
    r = S.post(CRATE, json={'stmt': stmt, 'args': args or []}, auth=CAUTH, timeout=60)
    r.raise_for_status()
    d = r.json()
    return [dict(zip(d['cols'], row)) for row in d['rows']]


READ_PATHS = ('/points', '/points/recommend', '/points/scroll', '/points/count', '/points/query')


def qpost(path, body, sleep=0.25):
    global QCALLS
    assert any(path.endswith(p) for p in READ_PATHS), path
    QCALLS += 1
    assert QCALLS <= QMAX, 'call cap'
    time.sleep(sleep)
    r = S.post(QD + path, json=body, headers=QH, timeout=30)
    r.raise_for_status()
    return r.json()['result']


def qget(path):
    global QCALLS
    QCALLS += 1
    assert QCALLS <= QMAX
    time.sleep(0.25)
    r = S.get(QD + path, headers=QH, timeout=30)
    r.raise_for_status()
    return r.json()['result']


def pid(mt, tid):
    return (1_000_000_000_000 if mt == 'movie' else 2_000_000_000_000) + int(tid)
