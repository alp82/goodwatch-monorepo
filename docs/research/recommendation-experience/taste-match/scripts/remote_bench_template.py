# Runs on the app host (stdlib only). Secrets and id sets are injected in memory by make_remote.py.
import json, time, base64, socket, urllib.request, random, statistics
CFG = json.loads(base64.b64decode('__CFG__'))
SETS = CFG['sets']
RUNS = len(SETS)


def pct(xs, p):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))], 2)


def post(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', **headers})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())


out = {}
# Qdrant: fetch 100 vectors by point id in one call (read-only).
qd = []
for ids in SETS:
    t = time.perf_counter()
    res = post(CFG['qdrant'] + '/collections/media_fingerprint_v1/points',
               {'ids': ids, 'with_vector': ['fingerprint_v1'], 'with_payload': False}, {'api-key': CFG['qkey']})
    qd.append((time.perf_counter() - t) * 1000)
    assert len(res['result']) > 50
    time.sleep(0.5)
out['qdrant_get_100'] = {'p50': pct(qd, 50), 'p95': pct(qd, 95), 'max': pct(qd, 100), 'runs': len(qd)}

# Crate: read fingerprint_scores for the same 100 titles in one statement (read-only).
auth = 'Basic ' + base64.b64encode(f"{CFG['cuser']}:{CFG['cpass']}".encode()).decode()
cr = []
for ids in SETS:
    movies = [i - 1_000_000_000_000 for i in ids if i < 2_000_000_000_000]
    shows = [i - 2_000_000_000_000 for i in ids if i >= 2_000_000_000_000]
    t = time.perf_counter()
    res = post(CFG['crate'], {'stmt': "SELECT 'movie' AS t, tmdb_id, fingerprint_scores FROM movie WHERE tmdb_id = ANY(?) "
                                      "UNION ALL SELECT 'show', tmdb_id, fingerprint_scores FROM show WHERE tmdb_id = ANY(?)",
                              'args': [movies, shows]}, {'Authorization': auth})
    cr.append((time.perf_counter() - t) * 1000)
    assert res['rowcount'] > 50
    time.sleep(0.3)
out['crate_select_100'] = {'p50': pct(cr, 50), 'p95': pct(cr, 95), 'max': pct(cr, 100), 'runs': len(cr)}

# Redis: round trip of a GET on a key that does not exist (read-only), the cost of loading a stored taste vector.
s = socket.create_connection((CFG['rhost'], CFG['rport']), timeout=5)
f = s.makefile('rb')


def cmd(*parts):
    msg = f'*{len(parts)}\r\n' + ''.join(f'${len(str(p).encode())}\r\n{p}\r\n' for p in parts)
    s.sendall(msg.encode())
    line = f.readline()
    if line.startswith(b'$') and int(line[1:]) >= 0:
        f.read(int(line[1:]) + 2)
    return line


cmd('AUTH', CFG['rpass'])
rd = []
for _ in range(RUNS):
    t = time.perf_counter()
    cmd('GET', 'taste-match-measurement:nonexistent-key')
    rd.append((time.perf_counter() - t) * 1000)
    time.sleep(0.05)
out['redis_get'] = {'p50': pct(rd, 50), 'p95': pct(rd, 95), 'max': pct(rd, 100), 'runs': len(rd)}
print(json.dumps(out))
