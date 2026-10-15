#!/usr/bin/env python3
"""Run f/buzz locally using only new tables, or collect read-only evidence.

python goodwatch-flows/tools/run_buzz.py --env /path/to/webapp/.env --output /tmp/buzz-run.json
python goodwatch-flows/tools/run_buzz.py --env /path/to/webapp/.env --verify --output /tmp/buzz-evidence.json
"""
import argparse
import json
import math
from pathlib import Path
import re
import statistics
import sys
import time
from urllib.parse import urlparse

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.buzz.collect import Signals
from f.buzz.daily import run
from f.buzz.store import BuzzStore, TABLES


class LocalCrate:
    """HTTP equivalent of the existing connector with a strict write allowlist."""
    def __init__(self, env):
        host = env['CRATE_HOSTS'].split(',')[0].strip()
        if '://' not in host:
            host = 'http://' + host
        parsed = urlparse(host)
        self.url = f'{parsed.scheme}://{parsed.hostname}:{parsed.port or env.get("CRATE_PORT", "4200")}/_sql'
        self.http = requests.Session()
        self.http.auth = (env.get('CRATE_USER', ''), env.get('CRATE_PASS', ''))

    def request(self, sql, **params):
        if not sql.lstrip().upper().startswith('SELECT '):
            match = re.match(r'(?:CREATE TABLE IF NOT EXISTS|ALTER TABLE|REFRESH TABLE|INSERT INTO|UPDATE|DELETE FROM) doc\.(buzz_\w+)\b', sql)
            if not match or match[1] not in TABLES or ';' in sql:
                raise ValueError('Refused mutation outside the new buzz tables')
        try:
            response = self.http.post(self.url, json=dict(stmt=sql, **params), timeout=(5, 180))
        except requests.RequestException:
            raise RuntimeError('Crate transport failed') from None
        if not response.ok:
            raise RuntimeError(f'Crate HTTP {response.status_code}: {response.json().get("error", {}).get("message", "SQL failure")}')
        return response.json()

    def run(self, sql, params=()):
        return self.request(sql, args=list(params))

    def run_many(self, sql, params):
        payload = self.request(sql, bulk_args=params)
        results = payload.get('results', [])
        if len(results) != len(params) or any(r.get('error') or r.get('rowcount', -1) < 0 for r in results):
            raise RuntimeError('Crate bulk write failed or returned incomplete results')

    def select(self, sql, params=()):
        payload = self.run(sql, params)
        return [dict(zip(payload['cols'], row)) for row in payload['rows']]


def verify(crate):
    result = {'counts': {table: crate.select(f'SELECT count(*) AS n FROM doc.{table}')[0]['n'] for table in TABLES}}
    reads, durations, sizes = [], [], []
    for _ in range(30):
        started = time.perf_counter()
        payload = crate.request("SELECT day, generated_at, payload FROM doc.buzz_snapshot WHERE snapshot_key = 'current'", args=[])
        reads.append(1000 * (time.perf_counter() - started))
        durations.append(payload['duration'])
        sizes.append(len(payload['rows'][0][2].encode()))
    result['snapshot_read'] = dict(samples=30, roundtrip_ms_min=min(reads), roundtrip_ms_median=statistics.median(reads),
                                   roundtrip_ms_p95=sorted(reads)[28], roundtrip_ms_max=max(reads),
                                   crate_ms_median=statistics.median(durations), payload_bytes=sizes[0])
    result['snapshots'] = []
    for row in crate.select("SELECT snapshot_key, day, generated_at, payload FROM doc.buzz_snapshot WHERE snapshot_key != 'current' ORDER BY day DESC LIMIT 3"):
        row['payload'] = json.loads(row['payload'])
        result['snapshots'].append(row)
    result['pageview_range'] = crate.select('SELECT min(day) AS first_day, max(day) AS last_day, count(DISTINCT title_key) AS titles FROM doc.buzz_pageview')[0]
    result['candidate_kinds'] = crate.select('SELECT kind, count(*) AS n FROM doc.buzz_title GROUP BY kind ORDER BY kind')
    observations = {}
    for row in crate.select('SELECT title_key, day, views FROM doc.buzz_pageview LIMIT 100000'):
        observations.setdefault(row['title_key'], {})[row['day']] = row['views']
    scores = crate.select('SELECT day, title_key, score, views, mean28, sd28, z, eligible, rank FROM doc.buzz_score LIMIT 100000')
    ranked = {}
    import datetime as dt
    for row in scores:
        day = dt.date.fromisoformat(row['day'])
        series = observations[row['title_key']]
        values = [series[(day - dt.timedelta(days=i)).isoformat()] for i in range(1, 29)]
        today = series[row['day']]
        # Independent arithmetic from raw production observations, not rank_day.
        mean = math.fsum(values) / 28
        sd = math.sqrt(math.fsum((value - mean) ** 2 for value in values) / 28)
        for actual, expected in ((row['mean28'], mean), (row['sd28'], sd), (row['score'], today / max(mean, 1))):
            if not math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-10):
                raise RuntimeError('Stored score disagrees with independent observation audit')
        if row['views'] != today or row['eligible'] != (today >= 1000 and today - mean >= 500):
            raise RuntimeError('Stored volume gates disagree with observations')
        if sd == 0:
            if row['z'] is not None:
                raise RuntimeError('Flat baseline has a stored z-score')
        elif not math.isclose(row['z'], (today - mean) / sd, rel_tol=1e-10, abs_tol=1e-10):
            raise RuntimeError('Stored diagnostic z disagrees with observations')
        if row['eligible']:
            ranked.setdefault(row['day'], []).append(row)
        elif row['rank'] is not None:
            raise RuntimeError('Ineligible score has a rank')
    for rows in ranked.values():
        rows.sort(key=lambda r: (-r['score'], -r['views'], r['title_key']))
        if [r['rank'] for r in rows] != list(range(1, len(rows) + 1)):
            raise RuntimeError('Non-deterministic or non-contiguous eligible ranks')
    for snapshot in result['snapshots']:
        expected = [r['title_key'] for r in ranked[snapshot['day']][:20]]
        actual = [r['title_key'] for r in snapshot['payload']['top20']]
        if expected != actual:
            raise RuntimeError('Published snapshot disagrees with stored ranks')
    result['independent_audit'] = {'scores_checked': len(scores), 'ranked_days': len(ranked), 'snapshots_checked': len(result['snapshots']), 'passed': True}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    env = {}
    for line in Path(args.env).read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            key, value = line.split('=', 1)
            env[key.strip()] = value.strip().strip('"').strip("'")
    crate = LocalCrate(env)
    started = time.monotonic()
    result = verify(crate) if args.verify else run(BuzzStore(crate), Signals(env['TMDB_API_KEY']))
    result['elapsed_seconds'] = round(time.monotonic() - started, 2)
    Path(args.output).write_text(json.dumps(result, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'snapshots'}, indent=2, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
