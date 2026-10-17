"""Read daily provider lists; publish only availability history and list checkpoints."""
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
import threading
import time
import json
import sqlite3
import tempfile
import zlib
from email.utils import parsedate_to_datetime
from uuid import uuid4

from f.sync.availability_history import HistoryTitle, ListRead, OfferKey
from f.tmdb_api.provider_evidence import HISTORY_OFFER_TYPES, capture_provider_check, utc_day, utc_ms, validated_results

# The research's 15 provider identities (brands and their direct tiers).
BIG_BRANDS = {
    8: 'Netflix', 1796: 'Netflix Standard with Ads',
    9: 'Amazon Prime Video', 119: 'Amazon Prime Video', 2100: 'Amazon Prime Video with Ads',
    337: 'Disney Plus', 1899: 'HBO Max', 350: 'Apple TV', 15: 'Hulu',
    386: 'Peacock Premium', 387: 'Peacock Premium Plus',
    531: 'Paramount Plus', 2303: 'Paramount Plus Premium', 283: 'Crunchyroll', 11: 'MUBI',
}


class TMDBReadError(RuntimeError):
    pass


class RequestBudgetExceeded(TMDBReadError):
    pass


class TMDBClient:
    """One paced budget shared by all six HTTP workers, including retries."""
    def __init__(self, requests_per_second=15, max_requests=350000):
        import wmill
        if not 0 < requests_per_second <= 20:
            raise ValueError('requests_per_second must be greater than zero and at most 20')
        self.key = wmill.get_variable('u/Alp/TMDB_API_KEY')
        self.interval, self.max_requests = 1 / requests_per_second, max_requests
        self.lock, self.local = threading.Lock(), threading.local()
        self.next_request = 0
        self.stats = dict(requests=0, retries=0, refused=0, discover=0, title=0, catalog=0)

    def get(self, path, **params):
        import requests
        if not hasattr(self.local, 'session'):
            self.local.session = requests.Session()
        for attempt in range(6):
            with self.lock:
                if self.stats['requests'] >= self.max_requests:
                    raise RequestBudgetExceeded('Daily list request budget exhausted')
                while self.next_request > time.monotonic():
                    time.sleep(max(0, min(1, self.next_request - time.monotonic())))
                self.next_request = time.monotonic() + self.interval
                self.stats['requests'] += 1
                self.stats['discover' if path.startswith('/discover/') else 'title' if path.endswith('/watch/providers') else 'catalog'] += 1
            try:
                response = self.local.session.get('https://api.themoviedb.org/3' + path,
                    params=dict(params, api_key=self.key, cb=uuid4().hex), timeout=(5, 30))
            except requests.RequestException:
                response = None
            if response is not None and response.status_code == 200:
                try:
                    return response.json()
                except ValueError:
                    raise TMDBReadError('Invalid TMDB JSON') from None
            status = response.status_code if response is not None else None
            if status is not None and status != 429 and status < 500:
                raise TMDBReadError(f'TMDB HTTP {status}')
            if attempt == 5:
                raise TMDBReadError('TMDB retry budget exhausted')
            delay = 2 ** attempt
            with self.lock:
                self.stats['retries'] += 1
                if status == 429:
                    self.stats['refused'] += 1
                    try:
                        delay = max(delay, float(response.headers.get('Retry-After', 1)))
                    except ValueError:
                        try:
                            retry_at = parsedate_to_datetime(response.headers['Retry-After'])
                            delay = max(delay, retry_at.timestamp() - time.time())
                        except (ValueError, TypeError, KeyError):
                            pass
                self.next_request = max(self.next_request, time.monotonic() + delay)


def ListStorage(dry_run=True):
    # Keep DB setup out of imports and inert previews.
    from f.tmdb_api.daily_list_storage import ListStorage as Storage
    return Storage(dry_run=dry_run)


def get_many(client, calls):
    with ThreadPoolExecutor(max_workers=6) as workers:
        return list(workers.map(lambda call: client.get(call[0], **call[1]), calls))


def title_checks(client, api_media, ids, clock):
    def read(tmdb_id):
        payload = client.get(f'/{api_media}/{tmdb_id}/watch/providers')
        if type(payload.get('id')) is not int or payload['id'] != tmdb_id or validated_results(payload) is None:
            raise TMDBReadError('Invalid provider response or mismatched title identity')
        return tmdb_id, payload, capture_provider_check(
            {'id': payload['id'], 'watch/providers': payload}, tmdb_id, clock(), bypass_cache=True)
    with ThreadPoolExecutor(max_workers=6) as workers:
        return list(workers.map(read, ids))


class ProviderChecks:
    """Deduplicate all-country title checks in a disposable, bounded-memory cache."""
    def __init__(self, client, clock):
        self.client, self.clock = client, clock

    def __enter__(self):
        self.directory = tempfile.TemporaryDirectory(prefix='goodwatch-list-checks-')
        self.db = sqlite3.connect(self.directory.name + '/checks.sqlite')
        self.db.execute('CREATE TABLE checks (media TEXT, id INTEGER, payload BLOB, PRIMARY KEY(media, id))')
        return self

    def __exit__(self, *args):
        self.db.close()
        self.directory.cleanup()

    def read(self, media, ids, country, provider, listed, list_at):
        found, missing = {}, []
        for tmdb_id in ids:
            row = self.db.execute('SELECT payload FROM checks WHERE media = ? AND id = ?', (media, tmdb_id)).fetchone()
            if row:
                _, payload, proof = json.loads(zlib.decompress(row[0]))
                matches = any(p['provider_id'] == provider for kind in HISTORY_OFFER_TYPES
                              for p in payload['results'].get(country, {}).get(kind, []))
                # Reuse today's one all-country check, but recheck a conflict
                # discovered after it. Retain the actual HTTP observation time.
                if (utc_day(proof['checked_at']) == utc_day(list_at)
                        and (proof['checked_at'] >= list_at or matches == (tmdb_id in listed))):
                    found[tmdb_id] = (tmdb_id, payload, proof)
                    continue
            missing.append(tmdb_id)
        for result in title_checks(self.client, media, missing, self.clock):
            found[result[0]] = result
            self.db.execute('INSERT OR REPLACE INTO checks VALUES (?, ?, ?)',
                            (media, result[0], zlib.compress(json.dumps(result).encode())))
        self.db.commit()
        return [found[tmdb_id] for tmdb_id in ids]


class IncompleteList(ValueError):
    pass


def read_list(client, country, media_type, provider, diagnostics=None):
    """Accept a stable total and that many distinct IDs, using both sorts if needed."""
    api_media = 'tv' if media_type == 'show' else 'movie'
    sorts = ('name.asc', 'first_air_date.desc') if media_type == 'show' else ('title.asc', 'primary_release_date.desc')
    params = dict(watch_region=country, with_watch_providers=provider,
                  with_watch_monetization_types='flatrate|free|ads', include_adult='false')
    diagnostics = {} if diagnostics is None else diagnostics
    diagnostics.update(sort_fallbacks=0, partitions=0)
    def read_range(lo=None, hi=None):
        extra = {}
        if lo is not None:
            extra['vote_count.gte'] = lo
        if hi is not None:
            extra['vote_count.lte'] = hi
        ids, expected = set(), None
        for index, sort in enumerate(sorts):
            if index:
                diagnostics['sort_fallbacks'] += 1
            first = client.get('/discover/' + api_media, **params, **extra, sort_by=sort, page=1)
            total, pages = first['total_results'], first['total_pages']
            if expected is not None and total != expected:
                raise IncompleteList('Total changed between sorts')
            expected = total
            if pages > 500:
                diagnostics['partitions'] += 1
                # Integer vote bins include undated titles, unlike date splits.
                if lo == hi and lo is not None:
                    raise IncompleteList('An indivisible vote-count bin exceeds 500 pages')
                cut = ((lo or 0) + hi + 1) // 2 if hi is not None else max(100, (lo or 0) * 2)
                left, right = set(read_range(lo, cut - 1)), set(read_range(cut, hi))
                if left & right or (total < 20001 and len(left | right) != total):
                    raise IncompleteList('Partition totals changed during read')
                return sorted(left | right)
            rest = get_many(client, [('/discover/' + api_media, dict(params, **extra, sort_by=sort, page=page))
                                     for page in range(2, pages + 1)])
            for page, result in enumerate([first, *rest], 1):
                if result['total_results'] != expected or result['total_pages'] != pages or result['page'] != page:
                    raise IncompleteList('Paging metadata changed during read')
                ids.update(row['id'] for row in result['results'])
            if len(ids) == expected:
                return sorted(ids)
        raise IncompleteList(f'Expected {expected} distinct titles, read {len(ids)}')

    return read_range()


def run_daily_lists(client, store, *, countries, provider_ids, media_types=('movie', 'show'),
                    dry_run=True, now=None):
    dry_run = dry_run is not False
    clock = (lambda: now) if now else (lambda: datetime.now(timezone.utc))
    report = {'lists_completed': 0, 'lists_failed': 0, 'lists_skipped': 0, 'dry_run': dry_run, 'lists': []}
    with ProviderChecks(client, clock) as provider_reads:
        for country in countries:
            for media_type in media_types:
                api_media = 'tv' if media_type == 'show' else 'movie'
                for provider in provider_ids:
                    identity = f'{country}:{media_type}:{provider}'
                    try:
                        with store.lease(identity, dry_run) as check_owned:
                            at = utc_ms(clock())
                            previous = store.load(identity)
                            if previous and utc_day(previous['checked_at']) >= utc_day(at):
                                report['lists_skipped'] += 1
                                continue
                            diagnostics = {}
                            ids = read_list(client, country, media_type, provider, diagnostics)
                            members = dict((previous or {}).get('members', {}))
                            old_ids = set((previous or {}).get('ids', []))
                            pending = store.pending(identity)
                            candidates = (((set(ids) ^ old_ids) | set(previous.get('retry_ids', []))) if previous else set(ids)) | pending
                            store.stage(identity, candidates, dry_run)
                            retry_ids = []
                            candidates = sorted(candidates)
                            for offset in range(0, len(candidates), 200):
                                batch = candidates[offset:offset + 200]
                                metadata = store.details(media_type, batch)
                                checks = provider_reads.read(api_media, batch, country, provider, set(ids), at)
                                for tmdb_id, payload, proof in checks:
                                    if utc_day(proof['checked_at']) != utc_day(at):
                                        raise IncompleteList('List read crossed UTC midnight')
                                    details = metadata.get(tmdb_id, {}) | {'watch_providers': payload, 'watch_providers_check': proof}
                                    rows = {}
                                    kinds = []
                                    for kind in HISTORY_OFFER_TYPES:
                                        if any(p['provider_id'] == provider for p in payload['results'].get(country, {}).get(kind, [])):
                                            key = OfferKey(tmdb_id, media_type, country, provider, kind)
                                            rows[key] = key._asdict()
                                            kinds.append(kind)
                                    members[str(tmdb_id)] = kinds
                                    if bool(kinds) != (tmdb_id in ids):
                                        retry_ids.append(tmdb_id)
                                    prior_kinds = (previous or {}).get('members', {}).get(str(tmdb_id), [])
                                    # Pending intents also find stays committed before an
                                    # interrupted checkpoint, even if the source changed again.
                                    removed = [OfferKey(tmdb_id, media_type, country, provider, kind)
                                               for kind in HISTORY_OFFER_TYPES if kind not in kinds
                                               and (previous is not None or tmdb_id in pending)]
                                    title = HistoryTitle(tmdb_id, details, rows, {}, [], removed,
                                        ListRead(country, provider, at, (previous or {}).get('checked_at'),
                                                 tuple(prior_kinds), bool(prior_kinds),
                                                 (previous or {}).get('complete') is True,
                                                 (previous or {}).get('cache_bypassed') is True))
                                    store.publish(media_type, title, check_owned, dry_run)
                            if utc_day(utc_ms(clock())) != utc_day(at):
                                raise IncompleteList('List read crossed UTC midnight')
                            store.flush(dry_run)
                            check_owned()
                            if not dry_run:
                                store.save(identity, {'checked_at': at, 'ids': ids,
                                    'members': {key: kinds for key, kinds in members.items() if kinds}, 'retry_ids': retry_ids,
                                    'version': 1, 'complete': True, 'cache_bypassed': True})
                            report['lists_completed'] += 1
                            report['lists'].append({'key': identity, 'titles': len(ids), 'changes_checked': len(candidates),
                                                    'baseline': previous is None, 'retry_titles': len(retry_ids), **diagnostics})
                            print(json.dumps(report['lists'][-1]), flush=True)
                    except RequestBudgetExceeded:
                        raise
                    except Exception as error:
                        report['lists_failed'] += 1
                        failure = {'key': identity, 'error': type(error).__name__}
                        if isinstance(error, (IncompleteList, TMDBReadError)):
                            failure['reason'] = str(error)
                        report['lists'].append(failure)
                        print(json.dumps(failure), flush=True)
    return report


def main(countries: list[str] | None = None, provider_ids: list[int] | None = None,
         dry_run: bool = True, requests_per_second: float = 15, max_requests: int = 350000):
    dry_run = dry_run is not False
    started = time.monotonic()
    client = TMDBClient(requests_per_second, max_requests)
    store = ListStorage(dry_run=dry_run)
    try:
        if countries is None:
            regions = client.get('/watch/providers/regions')['results']
            countries = sorted({region['iso_3166_1'] for region in regions} | set(store.countries()))
        providers = list(BIG_BRANDS) if provider_ids is None else provider_ids
        if any(type(provider) is not int or provider <= 0 for provider in providers):
            raise ValueError('Provider IDs must be positive integers')
        if any(len(country) != 2 or not country.isascii() or not country.isupper() or not country.isalpha() for country in countries):
            raise ValueError('Countries must be uppercase two-letter codes')
        report = run_daily_lists(client, store, countries=sorted(set(countries)),
                                 provider_ids=sorted(set(providers)), dry_run=dry_run)
        report['seconds'] = round(time.monotonic() - started, 3)
        report['requests'] = getattr(client, 'stats', {})
        report['history'] = getattr(store, 'stats', {})
        report['countries'] = countries
        return report
    finally:
        store.close()
