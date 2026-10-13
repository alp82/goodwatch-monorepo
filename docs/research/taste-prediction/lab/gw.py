"""Read-only helper for production Crate."""
import requests
ENV = {}
for line in open('/home/alper/projects/goodwatch-monorepo/goodwatch-webapp/.env'):
    line = line.strip()
    if '=' in line and not line.startswith('#'):
        k, v = line.split('=', 1)
        ENV[k] = v.strip().strip('"').strip("'")
CRATE = f"http://{ENV['CRATE_HOSTS'].split(',')[0]}:{ENV['CRATE_PORT']}/_sql"
CAUTH = (ENV['CRATE_USER'], ENV['CRATE_PASS'])
S = requests.Session()

def sql(stmt, args=None):
    s = stmt.strip().lower()
    assert s.startswith('select') or s.startswith('with') or s.startswith('show'), 'read only'
    r = S.post(CRATE, json={'stmt': stmt, 'args': args or []}, auth=CAUTH, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(r.text[:500])
    d = r.json()
    return [dict(zip(d['cols'], row)) for row in d['rows']]

def pid(mt, tid):
    return (1_000_000_000_000 if mt == 'movie' else 2_000_000_000_000) + int(tid)
