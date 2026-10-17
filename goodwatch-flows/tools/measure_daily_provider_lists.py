"""Read-only production dry run of #682; credentials remain outside the report.

Uses the local Windmill CLI's goodwatch remote for variable GETs and the checkout
public coordinator with read-only storage (no live run lease). Never deploys or changes production state.
"""
import argparse
import contextlib
from datetime import datetime
import gzip
import hashlib
import json
from pathlib import Path
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'windmill'))
from f.tmdb_api import daily_provider_lists as job


def census(client):
    """Size all lists using page-one metadata; no full lists or title checks."""
    regions = sorted(row['iso_3166_1'] for row in client.get('/watch/providers/regions')['results'])
    def one_list(item):
        country, media, service_id = item
        def cost(lo=None, hi=None):
            params = dict(watch_region=country, with_watch_providers=service_id,
                          with_watch_monetization_types='flatrate|free|ads', include_adult='false',
                          sort_by='name.asc' if media == 'show' else 'title.asc', page=1)
            if lo is not None:
                params['vote_count.gte'] = lo
            if hi is not None:
                params['vote_count.lte'] = hi
            response = client.get('/discover/' + ('tv' if media == 'show' else 'movie'), **params)
            pages, total = response['total_pages'], response['total_results']
            if pages <= 500:
                return max(1, pages), total
            if lo == hi and lo is not None:
                raise RuntimeError('Unsplittable list')
            cut = ((lo or 0) + hi + 1) // 2 if hi is not None else max(100, (lo or 0) * 2)
            left, right = cost(lo, cut - 1), cost(cut, hi)
            return 1 + left[0] + right[0], left[1] + right[1]
        requests, total = cost()
        return {'key': f'{country}:{media}:{service_id}', 'primary_requests': requests, 'titles': total}
    items = [(country, media, service_id) for country in regions for media in ('movie', 'show') for service_id in job.SERVICE_NAMES]
    with ThreadPoolExecutor(max_workers=6) as pool:
        lists = list(pool.map(one_list, items))
    return {'countries': regions, 'lists': lists, 'primary_discover_requests': sum(row['primary_requests'] for row in lists),
            'entries': sum(row['titles'] for row in lists), 'requests': client.stats, 'mode': 'page_one_census'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--countries', nargs='+', default=['BR', 'DE', 'NG'])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--census', action='store_true')
    parser.add_argument('--previous-panel', type=Path,
                        help='Compare only matching research-panel lists against this earlier fresh snapshot')
    args = parser.parse_args()
    remotes = Path.home() / '.config/windmill/remotes.ndjson'
    remote = next(row for row in map(json.loads, remotes.read_text().splitlines()) if row['name'] == 'goodwatch')
    variables = {}
    def variable(name):
        if name not in variables:
            request = Request(remote['remote'].rstrip('/') + '/api/w/' + remote['workspaceId'] + '/variables/get_value/' + name,
                              headers={'Authorization': 'Bearer ' + remote['token']})
            with urlopen(request, timeout=30) as response:
                variables[name] = json.load(response)
        return variables[name]

    from f.db.cratedb import CrateConnector
    original = CrateConnector.run
    def read_only(self, sql, params=None):
        if not sql.strip().upper().startswith('SELECT '):
            raise AssertionError('Production measurement only permits SELECT')
        return original(self, sql, params)
    def refuse_write(*args, **kwargs):
        raise AssertionError('Production measurement refuses Crate writes')
    original_get = job.TMDBClient.get
    last = [0]
    def get(self, path, **params):
        result = original_get(self, path, **params)
        if self.stats['requests'] // 1000 > last[0]:
            last[0] = self.stats['requests'] // 1000
            print(json.dumps(self.stats | {'elapsed_seconds': round(time.time() - started, 3)}),
                  file=sys.stderr, flush=True)
        return result
    started = time.time()
    original_storage = job.create_list_storage
    storage = original_storage
    panel = None
    if args.previous_panel:
        panel = json.loads(gzip.decompress(args.previous_panel.read_bytes()))
        at = int(datetime.fromisoformat(panel['at']).timestamp() * 1000)
        previous = {f"{row['reg']}:{'show' if row['media'] == 'tv' else 'movie'}:{row['pid']}": row for row in panel['lists']}
        def storage(dry_run=True):
            store = original_storage(dry_run=True)
            def load(identity):
                if identity not in previous:
                    # Only sample the earlier panel; do not baseline other lists.
                    return {'checked_at': int(time.time() * 1000)}
                country, media, service_id = identity.split(':')
                row = previous[identity]
                # Carry existing kinds only for planning. The request measurement
                # depends on the fresh panel's IDs, not on this projection.
                history = store.connector.select('SELECT media_tmdb_id, streaming_type FROM availability_history '
                    'WHERE country_code = ? AND media_type = ? AND streaming_service_id = ? '
                    'AND observed_at <= ? AND (dropped_on IS NULL OR dropped_on >= ?)',
                    (country, media, int(service_id), at, at // 86400000 * 86400000))
                members = {}
                ids = set(row['ids'])
                for stay in history:
                    if stay['media_tmdb_id'] in ids:
                        members.setdefault(str(stay['media_tmdb_id']), []).append(stay['streaming_type'])
                # The research reader split by dates and can omit undated titles.
                # This is a cost comparison, never trusted absence/precision proof.
                return dict(checked_at=at, ids=row['ids'], members=members, retry_ids=[], version=1,
                            cache_bypassed=True, complete=False)
            store.load = load
            return store
    with patch('wmill.get_variable', side_effect=variable), patch.object(CrateConnector, 'run', read_only), \
         patch.object(CrateConnector, 'upsert_many', refuse_write), patch.object(CrateConnector, 'run_many', refuse_write), \
         patch.object(job.TMDBClient, 'get', get), contextlib.redirect_stdout(sys.stderr):
        if args.census:
            report = census(job.TMDBClient(requests_per_second=10))
        else:
            # Live main takes an operational Mongo lease. This measurement must
            # stay SELECT-only, so use the same public coordinator without main.
            from pymongo.synchronous.collection import Collection
            with contextlib.ExitStack() as guards:
                for method in ('insert_one', 'insert_many', 'update_one', 'update_many',
                               'replace_one', 'delete_one', 'delete_many', 'create_index'):
                    guards.enter_context(patch.object(Collection, method, refuse_write))
                store = storage(dry_run=True)
                try:
                    client = job.TMDBClient()
                    report = job.run_daily_lists(client, store, countries=args.countries,
                                                  service_ids=list(job.SERVICE_NAMES))
                    report.update(requests=client.stats, history=store.stats, countries=args.countries)
                    report['mode'] = 'research_panel_comparison' if panel else 'initial_baseline'
                    report['title_candidates'] = sum(row.get('changes_checked', 0) for row in report['lists'])
                finally:
                    store.close()
    report['seconds'] = round(time.time() - started, 3)
    report['started_at_epoch'] = started
    report['production_data_writes'] = 0
    if panel:
        report['comparison'] = dict(source=str(args.previous_panel), at=panel['at'],
                                   sha256=hashlib.sha256(args.previous_panel.read_bytes()).hexdigest(),
                                   note='Cost comparison only: prior fresh IDs used date partitions that may omit undated titles; prior kinds are projected from history. Prior absence is untrusted and cannot establish exact days.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({key: value for key, value in report.items() if key != 'lists'}, indent=2))


if __name__ == '__main__':
    main()
