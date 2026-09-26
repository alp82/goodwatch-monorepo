# Runs on the webapp host (stdlib only). Read-only Crate timings for the refresh path and a catalog page.
import json, time, base64, urllib.request
CFG = json.loads(base64.b64decode('__CFG__'))
auth = 'Basic ' + base64.b64encode(f"{CFG['cuser']}:{CFG['cpass']}".encode()).decode()


def sql(stmt, args):
    assert stmt.strip().upper().startswith('SELECT')
    req = urllib.request.Request(CFG['crate'], data=json.dumps({'stmt': stmt, 'args': args}).encode(),
                                 headers={'Content-Type': 'application/json', 'Authorization': auth})
    t = time.perf_counter()
    with urllib.request.urlopen(req, timeout=120) as r:
        body = r.read()
    return (time.perf_counter() - t) * 1000, json.loads(body)['rowcount'], len(body)


def pct(xs, p):
    xs = sorted(xs)
    return round(xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))], 1)


out = {}
RATINGS = """SELECT tmdb_id, media_type, score FROM user_score WHERE user_id = ?
             UNION ALL SELECT tmdb_id, media_type, 0 FROM user_wishlist WHERE user_id = ?"""
for label, uid in CFG['users'].items():
    ts, n = [], 0
    for _ in range(10):
        ms, n, _b = sql(RATINGS, [uid, uid])
        ts.append(ms)
        time.sleep(0.2)
    out[f'ratings_and_wishlist_{label}'] = {'rows': n, 'p50_ms': pct(ts, 50), 'p95_ms': pct(ts, 95)}
ms, n, size = sql('SELECT tmdb_id, fingerprint_scores FROM movie WHERE fingerprint_scores IS NOT NULL AND tmdb_id > ? '
                  'ORDER BY tmdb_id LIMIT 20000', [-1])
out['catalog_page_20000_rows'] = {'ms': round(ms), 'rows': n, 'mb': round(size / 2 ** 20, 1)}
print(json.dumps(out))
