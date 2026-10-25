# extra_requirements:
# crate==2.2.1
# mongoengine==0.29.3
# pymongo==4.18.1
# requests==2.34.2
# wmill==1.815.0
# pydantic==2.13.5
# qdrant-client==1.19.1
"""Read daily lists, publish history/checkpoints and queue the shared title publisher."""
from datetime import datetime, timezone
from itertools import product
from concurrent.futures import ThreadPoolExecutor
import threading
import time
import json
import sqlite3
import tempfile
import zlib
from email.utils import parsedate_to_datetime
from uuid import uuid4
from contextlib import nullcontext

from f.sync.availability_history import HistoryTitle, ListRead, OfferKey
from f.tmdb_api.daily_list_storage import LeaseBusy, LeaseLost
from f.tmdb_api.provider_evidence import HISTORY_OFFER_TYPES, capture_provider_check, utc_day, utc_ms, validated_results, is_tmdb_deleted_response

# TMDB service IDs and names, including each brand's direct tiers.
SERVICE_NAMES = {
    8: 'Netflix', 1796: 'Netflix Standard with Ads',
    9: 'Amazon Prime Video', 119: 'Amazon Prime Video', 2100: 'Amazon Prime Video with Ads',
    337: 'Disney Plus', 1899: 'HBO Max', 350: 'Apple TV', 15: 'Hulu',
    386: 'Peacock Premium', 387: 'Peacock Premium Plus',
    531: 'Paramount Plus', 2303: 'Paramount Plus Premium', 283: 'Crunchyroll', 11: 'MUBI',
}


class TMDBReadError(RuntimeError):
    def __init__(self, message, *, endpoint=None, http_status=None):
        super().__init__(message)
        self.endpoint, self.http_status = endpoint, http_status
        parts = (endpoint or '').strip('/').split('/')
        self.tmdb_id = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else None


class TMDBDeletedTitle(TMDBReadError):
    pass


class TMDBAccessDenied(TMDBReadError):
    pass


class RequestBudgetExceeded(TMDBReadError):
    pass


class BaselineBudgetExceeded(RequestBudgetExceeded):
    pass


class TMDBClient:
    """One paced budget shared by all six HTTP workers, including retries."""
    def __init__(self, requests_per_second=15, max_requests=350000):
        import wmill
        if not 0 < requests_per_second <= 20:
            raise ValueError('requests_per_second must be greater than zero and at most 20')
        if type(max_requests) is not int or not 1 <= max_requests <= 350000:
            raise ValueError('max_requests must be an integer between 1 and 350000')
        self.key = wmill.get_variable('u/Alp/TMDB_API_KEY')
        self.interval, self.max_requests = 1 / requests_per_second, max_requests
        self.lock, self.local = threading.Lock(), threading.local()
        self.next_request = 0
        self.access_denied = None
        self.baseline_limit = None
        self.stats = dict(requests=0, retries=0, refused=0, discover=0, title=0, catalog=0, deleted_responses=0)

    def get(self, path, **params):
        import requests
        if not hasattr(self.local, 'session'):
            self.local.session = requests.Session()
        for attempt in range(6):
            with self.lock:
                if self.stats['requests'] >= self.max_requests:
                    raise RequestBudgetExceeded('Daily list request budget exhausted', endpoint=path)
                if self.baseline_limit is not None and self.stats['requests'] >= self.baseline_limit:
                    raise BaselineBudgetExceeded('New baseline request budget exhausted', endpoint=path)
                while self.next_request > time.monotonic():
                    time.sleep(max(0, min(1, self.next_request - time.monotonic())))
                if self.access_denied is not None:
                    raise self.access_denied
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
                    raise TMDBReadError('Invalid TMDB JSON', endpoint=path, http_status=200) from None
            status = response.status_code if response is not None else None
            if path.endswith('/watch/providers') and is_tmdb_deleted_response(response):
                self.stats['deleted_responses'] += 1
                raise TMDBDeletedTitle('TMDB deleted title (HTTP 404, status 34)', endpoint=path, http_status=404)
            if status in (401, 403):
                self.access_denied = TMDBAccessDenied(f'TMDB HTTP {status}', endpoint=path, http_status=status)
                raise self.access_denied
            if status is not None and status != 429 and status < 500:
                raise TMDBReadError(f'TMDB HTTP {status}', endpoint=path, http_status=status)
            if attempt == 5:
                raise TMDBReadError('TMDB retry budget exhausted', endpoint=path, http_status=status)
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


def create_list_storage(dry_run=True):
    # Keep DB setup out of imports and inert previews.
    from f.tmdb_api.daily_list_storage import ListStorage as Storage
    return Storage(dry_run=dry_run)


def get_many(client, calls):
    with ThreadPoolExecutor(max_workers=6) as workers:
        return list(workers.map(lambda call: client.get(call[0], **call[1]), calls))


def title_checks(client, api_media, ids, clock):
    def read(tmdb_id):
        endpoint = f'/{api_media}/{tmdb_id}/watch/providers'
        try:
            payload = client.get(endpoint)
            if (not isinstance(payload, dict) or type(payload.get('id')) is not int
                    or payload['id'] != tmdb_id or validated_results(payload) is None):
                raise TMDBReadError('Invalid service response or mismatched title identity', endpoint=endpoint)
            return tmdb_id, payload, capture_provider_check(
                {'id': payload['id'], 'watch/providers': payload}, tmdb_id, clock(), bypass_cache=True)
        except TMDBDeletedTitle:
            return tmdb_id, None, {'checked_at': utc_ms(clock()), 'deleted': True}
        except Exception as error:
            if getattr(error, 'endpoint', None) is None:
                error.endpoint, error.tmdb_id = endpoint, tmdb_id
            raise
    with ThreadPoolExecutor(max_workers=6) as workers:
        return list(workers.map(read, ids))


def eligible_kinds(payload, country, service_id):
    return [kind for kind in HISTORY_OFFER_TYPES
            if any(offer['provider_id'] == service_id for offer in payload['results'].get(country, {}).get(kind, []))]


class TitleChecks:
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

    def read(self, media, ids, country, service_id, listed, list_at):
        found, missing = {}, []
        for tmdb_id in ids:
            row = self.db.execute('SELECT payload FROM checks WHERE media = ? AND id = ?', (media, tmdb_id)).fetchone()
            if row:
                _, payload, proof = json.loads(zlib.decompress(row[0]))
                if proof.get('deleted'):
                    if utc_day(proof['checked_at']) == utc_day(list_at):
                        found[tmdb_id] = (tmdb_id, payload, proof)
                    else:
                        missing.append(tmdb_id)
                    continue
                matches = bool(eligible_kinds(payload, country, service_id))
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


def read_list(client, country, media_type, service_id, diagnostics=None):
    """Read one stable traversal, or two agreeing sorts with a tiny count overstatement."""
    api_media = 'tv' if media_type == 'show' else 'movie'
    sorts = ('name.asc', 'first_air_date.desc') if media_type == 'show' else ('title.asc', 'primary_release_date.desc')
    params = dict(watch_region=country, with_watch_providers=service_id,
                  with_watch_monetization_types='flatrate|free|ads', include_adult='false')
    diagnostics = {} if diagnostics is None else diagnostics
    diagnostics.update(sort_fallbacks=0, partitions=0, query_retries=0)
    equivalent_query = False
    attempts = []
    def read_range(lo=None, hi=None):
        extra = {}
        if lo is not None:
            # Introduce integer zero at the root; its decimal spelling can
            # retain another mixed origin snapshot. Bounded leaves still need
            # a fresh spelling of their existing floor (50 -> 50.0).
            root_zero = lo == 0 and hi is None
            extra['vote_count.gte'] = float(lo) if equivalent_query and not root_zero else lo
        if hi is not None:
            extra['vote_count.lte'] = hi
        previous_read, expected, last_count = None, None, 0
        for index, sort in enumerate(sorts):
            if index:
                diagnostics['sort_fallbacks'] += 1
            first = client.get('/discover/' + api_media, **params, **extra, sort_by=sort, page=1)
            total, pages = first['total_results'], first['total_pages']
            expected = total
            if pages > 500:
                diagnostics['partitions'] += 1
                # Integer vote bins include undated titles, unlike date splits.
                if lo == hi and lo is not None:
                    raise IncompleteList('An indivisible vote-count bin exceeds 500 pages')
                cut = ((lo or 0) + hi + 1) // 2 if hi is not None else max(100, (lo or 0) * 2)
                left_ids, left_gaps = read_range(lo, cut - 1)
                right_ids, right_gaps = read_range(cut, hi)
                left, right = set(left_ids), set(right_ids)
                gaps = left_gaps + right_gaps
                # TMDB caps reported total_results at 20,001 (research §1).
                # Read the lower bin first: growing vote counts can repeat a
                # title in the upper bin, so union the independently complete bins.
                if total < 20001 and len(left | right) + sum(gap['missing_count'] for gap in gaps) != total:
                    raise IncompleteList('Partition totals changed during read')
                return sorted(left | right), gaps
            rest = get_many(client, [('/discover/' + api_media, dict(params, **extra, sort_by=sort, page=page))
                                     for page in range(2, pages + 1)])
            results = [first, *rest]
            rows = [row['id'] for result in results for row in result['results']]
            read_ids = set(rows)
            last_count = len(read_ids)
            metadata_changed = any(result['total_results'] != expected or result['total_pages'] != pages
                                   or result['page'] != page for page, result in enumerate(results, 1))
            attempt = dict(sort=sort, vote_min=extra.get('vote_count.gte'), vote_max=hi, equivalent_query=equivalent_query,
                           reported_total=expected, returned_total=last_count,
                           duplicate_count=len(rows) - last_count,
                           metadata_values=sorted({(result['total_results'], result['total_pages']) for result in results}),
                           rejection=None)
            attempts.append(attempt)
            if metadata_changed:
                attempt['rejection'] = 'paging_metadata_changed'
                previous_read = None  # Do not mix a torn page traversal into the fallback.
                continue
            if len(rows) != len(read_ids):
                attempt['rejection'] = 'duplicate_ids'
                previous_read = None  # Duplicated IDs can hide omissions even at a matching total.
                continue
            if len(read_ids) == expected:
                return sorted(read_ids), []
            missing = expected - len(read_ids)
            # TMDB can count a title that neither sort returns. Never union
            # partial traversals: require the very same set and total twice.
            # Both an absolute and relative bound prevent truncated small lists.
            if (previous_read == (expected, read_ids)
                    and 0 < missing <= 5 and missing * 1000 <= expected):
                return sorted(read_ids), [dict(vote_min=lo, vote_max=hi,
                    reported_total=expected, returned_total=len(read_ids), missing_count=missing)]
            attempt['rejection'] = ('sorts_disagree' if previous_read is not None and previous_read != (expected, read_ids)
                                    else 'shortfall_outside_bound' if not (0 < missing <= 5 and missing * 1000 <= expected)
                                    else 'needs_independent_agreement')
            previous_read = (expected, read_ids)
        raise IncompleteList(f'Expected {expected} distinct titles, read {last_count}')

    try:
        ids, gaps = read_range()
    except IncompleteList:
        # cb bypasses the CDN, but TMDB can retain mixed origin page snapshots.
        # A nonnegative vote floor keeps the same catalog on another query key.
        # Discard both failed traversals. Judge the retry by its own snapshot;
        # a live catalog need not keep the first traversal's total.
        diagnostics['query_retries'] = 1
        equivalent_query = True
        try:
            ids, gaps = read_range(0)
        except IncompleteList as error:
            error.read_attempts = attempts
            raise
    diagnostics.update(count_shortfall=sum(gap['missing_count'] for gap in gaps),
                       count_agreements=gaps)
    return ids


def list_candidates(store, identity, previous, listed, country, media_type, service_id):
    if previous is None:
        candidates = listed | store.open_ids(country, media_type, service_id)
    else:
        candidates = (listed ^ set(previous['ids'])) | set(previous.get('retry_ids', []))
    candidates |= store.pending(identity)
    store.stage(identity, candidates)
    return sorted(candidates)


def confirm_list(title_reads, country, media_type, service_id, listed, at, candidates, clock, owned=None):
    """Validate every source response before this list can publish any history."""
    api_media = 'tv' if media_type == 'show' else 'movie'
    for offset in range(0, len(candidates), 200):
        if owned is not None:
            owned()
        reads = title_reads.read(api_media, candidates[offset:offset + 200], country, service_id, listed, at)
        for tmdb_id, _, proof in reads:
            if utc_day(proof['checked_at']) != utc_day(at):
                error = IncompleteList('List read crossed UTC midnight')
                error.tmdb_id, error.endpoint = tmdb_id, f'/{api_media}/{tmdb_id}/watch/providers'
                raise error
    if utc_day(utc_ms(clock())) != utc_day(at):
        raise IncompleteList('List read crossed UTC midnight')


def publish_list_changes(store, title_reads, country, media_type, service_id, listed, previous, at, candidates, owned):
    prior = previous or {}
    members, retry_ids = dict(prior.get('members', {})), []
    api_media = 'tv' if media_type == 'show' else 'movie'
    for offset in range(0, len(candidates), 200):
        owned()
        batch = candidates[offset:offset + 200]
        metadata = store.details(media_type, batch)
        for tmdb_id, payload, proof in title_reads.read(api_media, batch, country, service_id, listed, at):
            if utc_day(proof['checked_at']) != utc_day(at):
                error = IncompleteList('List read crossed UTC midnight')
                error.tmdb_id, error.endpoint = tmdb_id, f'/{api_media}/{tmdb_id}/watch/providers'
                raise error
            if proof.get('deleted'):
                listed_conflict = tmdb_id in listed
                print(json.dumps(dict(event='tmdb_missing_conflict' if listed_conflict else 'tmdb_missing',
                    key=f'{country}:{media_type}:{service_id}', media_type=media_type, tmdb_id=tmdb_id,
                    endpoint=f'/{api_media}/{tmdb_id}/watch/providers', http_status=404, tmdb_status_code=34)), flush=True)
                if listed_conflict:
                    retry_ids.append(tmdb_id)
                    continue  # Discover still lists it: preserve members and publish nothing.
                # Only the omitted list's keys are removal intents. A 404 cannot
                # establish an exact day or signal a title-wide deletion here.
                details = {'updated_at': datetime.fromtimestamp(proof['checked_at'] / 1000, timezone.utc),
                           'watch_providers_check': proof}
                kinds = []
            else:
                details = metadata.get(tmdb_id, {}) | {'watch_providers': payload, 'watch_providers_check': proof}
                kinds = eligible_kinds(payload, country, service_id)
            keys = [OfferKey(tmdb_id, media_type, country, service_id, kind) for kind in kinds]
            rows = {key: key._asdict() for key in keys}
            members[str(tmdb_id)] = kinds
            if bool(kinds) != (tmdb_id in listed):
                retry_ids.append(tmdb_id)
            prior_kinds = prior.get('members', {}).get(str(tmdb_id), [])
            # Include absent kinds on the baseline and recovery path too. The
            # shared writer alone decides whether a stay exists and its precision.
            removed = [OfferKey(tmdb_id, media_type, country, service_id, kind)
                       for kind in HISTORY_OFFER_TYPES if kind not in kinds]
            title = HistoryTitle(tmdb_id, details, rows, {}, [], removed,
                ListRead(country, service_id, at, prior.get('checked_at'), tuple(prior_kinds),
                         bool(prior_kinds) or tmdb_id in prior.get('ids', []),
                         prior.get('complete') is True, prior.get('cache_bypassed') is True))
            store.publish(media_type, title, owned)
    return members, retry_ids


def read_daily_list(client, store, title_reads, country, media_type, service_id, clock):
    identity = f'{country}:{media_type}:{service_id}'
    with store.lease(identity) as owned:
        at = utc_ms(clock())
        previous = store.load(identity)
        if previous and utc_day(previous['checked_at']) >= utc_day(at):
            return None
        diagnostics = {}
        try:
            ids = read_list(client, country, media_type, service_id, diagnostics)
        except Exception as error:
            if getattr(error, 'endpoint', None) is None:
                error.endpoint = '/discover/' + ('tv' if media_type == 'show' else 'movie')
            raise
        listed = set(ids)
        candidates = list_candidates(store, identity, previous, listed, country, media_type, service_id)
        confirm_list(title_reads, country, media_type, service_id, listed, at, candidates, clock, owned)
        members, retry_ids = publish_list_changes(store, title_reads, country, media_type, service_id,
                                                  listed, previous, at, candidates, owned)
        if utc_day(utc_ms(clock())) != utc_day(at):
            raise IncompleteList('List read crossed UTC midnight')
        store.flush()
        owned()
        if not store.dry_run:
            store.save(identity, {'checked_at': at, 'ids': ids,
                'members': {key: kinds for key, kinds in members.items() if kinds}, 'retry_ids': retry_ids,
                'version': 1, 'complete': diagnostics['count_shortfall'] == 0, 'cache_bypassed': True})
        return dict(key=identity, titles=len(ids), changes_checked=len(candidates), baseline=previous is None,
                    retry_titles=len(retry_ids), **diagnostics)


def list_failure(country, media_type, service_id, error):
    endpoint = getattr(error, 'endpoint', None)
    if endpoint is None and isinstance(error, IncompleteList):
        endpoint = '/discover/' + ('tv' if media_type == 'show' else 'movie')
    failure = dict(key=f'{country}:{media_type}:{service_id}', media_type=media_type,
                   tmdb_id=getattr(error, 'tmdb_id', None), endpoint=endpoint,
                   http_status=getattr(error, 'http_status', None), error=type(error).__name__)
    if isinstance(error, (IncompleteList, TMDBReadError)):
        failure['reason'] = str(error)
    if hasattr(error, 'read_attempts'):
        failure['read_attempts'] = error.read_attempts
    return failure


def run_daily_lists(client, store, *, countries, service_ids, media_types=('movie', 'show'), now=None,
                    scopes=None, title_reads=None, report=None):
    clock = (lambda: now) if now else (lambda: datetime.now(timezone.utc))
    if report is None:
        report = dict(lists_completed=0, lists_failed=0, lists_skipped=0, dry_run=store.dry_run, lists=[])
    with (nullcontext(title_reads) if title_reads is not None else TitleChecks(client, clock)) as title_reads:
        for country, media_type, service_id in (product(countries, media_types, service_ids) if scopes is None else scopes):
            try:
                summary = read_daily_list(client, store, title_reads, country, media_type, service_id, clock)
                if summary is None:
                    report['lists_skipped'] += 1
                    continue
                client.consecutive_list_failures = 0
                report['lists_completed'] += 1
                report['lists'].append(summary)
                print(json.dumps(summary), flush=True)
            except LeaseBusy:
                report['lists_skipped'] += 1
            except (RequestBudgetExceeded, TMDBAccessDenied, LeaseLost) as error:
                print(json.dumps(list_failure(country, media_type, service_id, error)), flush=True)
                raise
            except Exception as error:
                report['lists_failed'] += 1
                failure = list_failure(country, media_type, service_id, error)
                failure['consecutive_failure_days'] = store.record_failure(failure['key'], utc_ms(clock()), failure)
                report['lists'].append(failure)
                print(json.dumps(failure), flush=True)
                client.consecutive_list_failures = (getattr(client, 'consecutive_list_failures', 0) + 1
                                                    if isinstance(error, TMDBReadError) else 0)
                if client.consecutive_list_failures >= 20:
                    raise TMDBReadError('Stopping after 20 consecutive TMDB list failures') from error
    return report


def main(countries: list[str] | None = None, service_ids: list[int] | None = None,
         dry_run: bool = True, requests_per_second: float = 15, max_requests: int = 350000,
         baseline_max_requests: int = 120000, baseline_max_memberships: int = 570000):
    from f.tmdb_api.daily_list_ramp import run_daily_job
    return run_daily_job(countries=countries, service_ids=service_ids, dry_run=dry_run,
                         requests_per_second=requests_per_second, max_requests=max_requests,
                         baseline_max_requests=baseline_max_requests,
                         baseline_max_memberships=baseline_max_memberships)
