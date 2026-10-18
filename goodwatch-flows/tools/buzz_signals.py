#!/usr/bin/env python3
"""Collect today, backfill TMDB exports, or backtest against dated Wikipedia snapshots."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import datetime as dt
import json
import math
from pathlib import Path
import re
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from run_buzz import LocalCrate
from f.buzz.signals import run, SOURCES
from f.buzz.signal_store import SignalStore, DDL


class SignalCrate(LocalCrate):
    def request(self, sql, **params):
        if not sql.lstrip().upper().startswith('SELECT '):
            match = re.match(r'(?:CREATE TABLE IF NOT EXISTS|REFRESH TABLE|INSERT INTO) doc\.(buzz_\w+)\b', sql)
            if not match or match[1] not in DDL or ';' in sql:
                raise ValueError('Refused mutation outside signal tables')
        try:
            response = self.http.post(self.url, json=dict(stmt=sql, **params), timeout=(5, 180))
        except Exception:
            raise RuntimeError('Crate transport failed') from None
        if not response.ok:
            raise RuntimeError(f'Crate HTTP {response.status_code}')
        return response.json()


def load_env(path):
    env = {}
    for line in Path(path).read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def lift(series, day, minimum=5.0, delta=2.5, baseline_floor=1.0):
    rows = []
    complete = 0
    days = [(day-dt.timedelta(days=i)).isoformat() for i in range(29)]
    for key, values in series.items():
        window = [values.get(d) for d in days]
        if any(v is None for v in window):
            continue
        complete += 1
        today, mean = window[0], math.fsum(window[1:])/28
        if today >= minimum and today-mean >= delta:
            rows.append((key, today/max(mean, baseline_floor), today))
    rows.sort(key=lambda r: (-r[1], -r[2], r[0]))
    return [r[0] for r in rows], complete


def correlation(left, right):
    """Spearman on shared titles: re-rank the intersection, no invented tail ranks."""
    common = set(left) & set(right)
    if len(common) < 2:
        return None
    x = {k: i for i, k in enumerate(k for k in left if k in common)}
    y = {k: i for i, k in enumerate(k for k in right if k in common)}
    n = len(common)
    return 1 - 6*sum((x[k]-y[k])**2 for k in common)/(n*(n*n-1))


def backtest(crate, minimum=5.0, delta=2.5):
    snapshots = crate.select("SELECT day, payload FROM doc.buzz_snapshot WHERE snapshot_key != 'current' ORDER BY day LIMIT 10000")
    report = ['# TMDB popularity lift backtest', '',
        f'Generated {dt.datetime.now(dt.timezone.utc).isoformat()}.', '',
        f'Lift = value / max(prior 28-day mean, 1); value ≥ {minimum:g}, increase ≥ {delta:g}. '
        'All 29 calendar days required; missing values are unknown, never zero. Export filename dates are used '
        'without shifting; the underlying popularity activity window is not documented.', '',
        'Overlap@k is |TMDB top k ∩ Wikipedia top k| / k (fixed denominator even for short lists). '
        'Spearman re-ranks only the intersection of the two top 20 lists; fewer than two matches gives N/A. '
        'This conditional correlation is not agreement over the entire catalog. '
        'Candidate retention is retrospective and may introduce selection bias; floors are exploratory, not tuned. '
        'The TMDB list covers retained exports, including titles outside the catalog; Wikipedia has its own candidate cohort.', '',
        '| Day | Complete baselines | Eligible | Wiki top20 with baseline | Overlap@8 | Overlap@20 | Shared20 | Spearman |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |']
    series = {}
    if snapshots:
        first = dt.date.fromisoformat(snapshots[0]['day'])-dt.timedelta(days=28)
        last = dt.date.fromisoformat(snapshots[-1]['day'])
        for offset in range((last-first).days+1):
            observation_day = (first+dt.timedelta(days=offset)).isoformat()
            last_key = ''
            while True:
                # Restrict each sort to one day, not the entire history table.
                rows = crate.select("SELECT title_key, value FROM doc.buzz_signal WHERE source = 'tmdb_popularity' AND day = ? AND title_key > ? ORDER BY title_key LIMIT 10000",
                    (observation_day, last_key))
                for r in rows:
                    series.setdefault(r['title_key'], {})[observation_day] = r['value']
                if len(rows) < 10000:
                    break
                last_key = rows[-1]['title_key']
    metrics = []
    for snapshot in snapshots:
        day = dt.date.fromisoformat(snapshot['day'])
        ranked, complete = lift(series, day, minimum, delta)
        wiki = [r['title_key'] for r in json.loads(snapshot['payload'])['top20']]
        coverage = sum(all((day-dt.timedelta(days=i)).isoformat() in series.get(k, {}) for i in range(29)) for k in wiki)
        top = ranked[:20]
        rho = correlation(top, wiki)
        overlap8 = len(set(ranked[:8]) & set(wiki[:8]))/8
        overlap20 = len(set(top) & set(wiki))/20
        shared = len(set(top) & set(wiki))
        metrics.append((overlap8, overlap20, rho, coverage, len(wiki)))
        rho_text = f'{rho:.3f}' if rho is not None else 'N/A'
        report.append(f'| {day} | {complete} | {len(ranked)} | {coverage}/{len(wiki)} | {overlap8:.3f} | {overlap20:.3f} | {shared} | {rho_text} |')
    if metrics:
        mean8 = math.fsum(m[0] for m in metrics)/len(metrics)
        mean20 = math.fsum(m[1] for m in metrics)/len(metrics)
        correlations = [m[2] for m in metrics if m[2] is not None]
        rho_text = f'{math.fsum(correlations)/len(correlations):.3f}' if correlations else 'N/A'
        report.extend(['', f'{len(metrics)} days: mean overlap@8 **{mean8:.3f}**, mean overlap@20 **{mean20:.3f}**. '
            f'Mean conditional Spearman **{rho_text}** across {len(correlations)} days with at least two common titles. '
            f'Wikipedia winner baseline coverage: {sum(m[3] for m in metrics)}/{sum(m[4] for m in metrics)} title-days.', '',
            'These are agreement diagnostics, not a quality label: Wikipedia reading and TMDB popularity '
            'measure different behavior. This backtest does not establish that a blended ranking is better.'])
    if not snapshots:
        report.extend(['', 'No dated Wikipedia snapshots available; no comparison can be measured.'])
    return '\n'.join(report)+'\n'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['collect', 'backfill', 'backtest'])
    parser.add_argument('--env', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--days', type=int, default=130, help='Probe beyond the observed roughly four-month retention boundary')
    parser.add_argument('--workers', type=int, default=3, help='Backfill only: 1–3 parallel dates')
    parser.add_argument('--force', action='store_true', help='Recollect completed export dates')
    parser.add_argument('--source', choices=SOURCES, action='append')
    parser.add_argument('--minimum', type=float, default=5)
    parser.add_argument('--delta', type=float, default=2.5)
    args = parser.parse_args()
    env = load_env(args.env)
    crate = SignalCrate(env)
    store = SignalStore(crate)
    if args.command == 'backtest':
        Path(args.output).write_text(backtest(crate, args.minimum, args.delta))
        return
    today = dt.datetime.now(dt.timezone.utc).date()
    results = []
    days = args.days if args.command == 'backfill' else 1
    if not 1 <= days <= 366:
        parser.error('--days must be between 1 and 366')
    if not 1 <= args.workers <= 3:
        parser.error('--workers must be between 1 and 3')
    store.initialize()
    completed = set()
    if args.command == 'backfill' and not args.force:
        completed = {r['day'] for r in crate.select("SELECT day FROM doc.buzz_signal_run WHERE source = 'tmdb_popularity' AND status = 'works' LIMIT 10000")}

    def collect_day(day):
        # A separate HTTP/Crate session per worker. At most three export streams.
        if day.isoformat() in completed:
            return dict(day=day.isoformat(), sources={'tmdb_popularity': {'status': 'already_collected'}})
        local_store = SignalStore(SignalCrate(env))
        return run(local_store, day=day, sources=('tmdb_popularity',) if args.command == 'backfill' else args.source or SOURCES,
                   trakt_id=env.get('TRAKT_CLIENT_ID'))

    with ThreadPoolExecutor(max_workers=args.workers if args.command == 'backfill' else 1) as executor:
        futures = [executor.submit(collect_day, today-dt.timedelta(days=i)) for i in range(days)]
        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            results.sort(key=lambda r: r['day'], reverse=True)
            Path(args.output).write_text(json.dumps(results, indent=2)+'\n')
            print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
