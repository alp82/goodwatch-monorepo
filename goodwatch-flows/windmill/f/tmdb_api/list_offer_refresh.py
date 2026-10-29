# extra_requirements:
# crate==2.2.1
# mongoengine==0.29.3
# pymongo==4.18.1
# requests==2.34.2
# wmill==1.815.0
# pydantic==2.13.5
# qdrant-client==1.19.1
"""Durable list-to-title handoff. The shared streaming copier owns offer writes."""
from datetime import datetime, timezone
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
import re
import threading
import time
from uuid import uuid4

from f.tmdb_api.provider_evidence import capture_provider_check, utc_day, utc_ms


class RefreshDeferred(RuntimeError):
    """Stable operational reason, safe to include in reports without credentials."""


QUEUE_SORT = [('priority', -1), ('last_attempt_at', 1), ('_id', 1)]
PUBLISH_BATCH_SIZE = 20
MAX_CONSECUTIVE_FAILURES = 20
PREPARE_WORKERS = 6


@contextmanager
def timed_stage(timings, name, lock=None):
    started = time.perf_counter()
    try:
        yield
    finally:
        seconds = time.perf_counter() - started
        if lock is None:
            timings[name] = timings.get(name, 0) + seconds
        else:
            with lock:
                timings[name] = timings.get(name, 0) + seconds


class PublicationTimings:
    """Measure actual Crate I/O without changing the shared writer's behavior."""
    def __init__(self, connector, timings):
        self.connector, self.timings = connector, timings

    def __getattr__(self, name):
        method = getattr(self.connector, name)
        if name not in ('select', 'run', 'run_many', 'upsert_many'):
            return method
        def measured(*args, **kwargs):
            with timed_stage(self.timings, 'crate_' + name):
                return method(*args, **kwargs)
        return measured


def enqueue_list_mismatches(db, connector, media_type, titles, *, dry_run=False):
    """Queue verified changes and scopes whose child or aggregate offers need repair."""
    titles = [title for title in titles if title.list_read
              and not (title.details.get('watch_providers_check') or {}).get('deleted')]
    if not titles:
        return []
    ids = [title.tmdb_id for title in titles]
    scopes = {(title.list_read.country_code, title.list_read.service_id) for title in titles}
    if len(scopes) != 1:
        raise ValueError('Expected one list scope per publication batch')
    country, service = next(iter(scopes))
    actual, any_offer = {}, set()
    for row in connector.select(
        'SELECT media_tmdb_id,streaming_type FROM streaming_availability '
        'WHERE media_tmdb_id = ANY(?) AND media_type = ? AND country_code = ? AND streaming_service_id = ?',
        (ids, media_type, country, service)):
        any_offer.add(row['media_tmdb_id'])
        if row['streaming_type'] in ('flatrate', 'free', 'ads'):
            actual.setdefault(row['media_tmdb_id'], set()).add(row['streaming_type'])
    parents = {row['tmdb_id']: row for row in connector.select(
        f'SELECT tmdb_id, ? = ANY(streaming_availabilities) AS has_offer, '
        f'? = ANY(streaming_country_codes) AS has_country, ? = ANY(streaming_service_ids) AS has_service '
        f'FROM {media_type} WHERE tmdb_id = ANY(?)', (f'{country}_{service}', country, service, ids))}
    planned = []
    for title in titles:
        expected = {key.streaming_type for key in title.rows}
        parent = parents.get(title.tmdb_id, {})
        verified_change = (title.list_read.previous_at is not None and
                           (expected != set(title.list_read.previous_offers)
                            or bool(expected) != title.list_read.previous_present))
        needs_aggregate = (bool(expected) and not all(parent.get(field) for field in ('has_offer', 'has_country', 'has_service'))
                           or not expected and title.tmdb_id not in any_offer and parent.get('has_offer'))
        if verified_change or expected != actual.get(title.tmdb_id, set()) or needs_aggregate:
            scopes = {f'{country}_{service}': title.details['watch_providers_check']['checked_at']}
            planned.append(dict(media_type=media_type, tmdb_id=title.tmdb_id, scopes=scopes))
            if not dry_run:
                enqueue(db, media_type, title.tmdb_id, scopes, priority=1)
    return planned


def enqueue(db, media_type, tmdb_id, scopes, *, priority=0):
    """Stage before history/checkpoint writes; a crash can only cause a safe recheck.

    Replacing the version fences acknowledgment of newer list work. Keep scopes
    after success, both for audit and to merge later service checks cheaply.
    """
    if media_type not in ('movie', 'show') or type(tmdb_id) is not int or tmdb_id <= 0 or not scopes:
        raise ValueError('Invalid refresh identity or empty scopes')
    if any(not re.fullmatch(r'[A-Z]{2}_[1-9][0-9]*', scope)
           or not isinstance(at, int) or isinstance(at, bool) or at <= 0
           for scope, at in scopes.items()):
        raise ValueError('Invalid verified scope or check timestamp')
    db.tmdb_list_offer_refresh.update_one({'_id': f'{media_type}:{tmdb_id}'}, {
        '$set': {'media_type': media_type, 'tmdb_id': tmdb_id, 'pending': True, 'version': uuid4().hex},
        '$max': {'priority': priority, **{f'scopes.{scope}': at for scope, at in scopes.items()}},
    }, upsert=True)


def publish_offers(connector, media_type, tmdb_ids, *, timings=None):
    # Reuse both existing writers, including their shared leases and strict
    # Qdrant writes. Never run the unrelated details/ratings/DNA crawlers.
    from f.sync.copy.tmdb_streaming import copy_media
    from f.sync.copy.vector_data import copy_to_qdrant
    from f.db.qdrant import QdrantConnector
    from f.sync.copy.qdrant_retry import REQUEST_TIMEOUT_SECONDS
    selector = {'tmdb_id': {'$in': tmdb_ids}}
    timings = timings if timings is not None else {}
    connector = PublicationTimings(connector, timings)
    with timed_stage(timings, 'streaming_publication'):
        result = copy_media(connector, selector, media_type, recent_only=False,
                            mapping_refresh_limit=0, targeted_batch=True, defer_busy=True)
    publication = result.get('publication', {})
    failed = {}
    for tmdb_id in tmdb_ids:
        title = publication.get('titles', {}).get(str(tmdb_id), {})
        if tmdb_id in publication.get('busy_ids', []):
            failed[tmdb_id] = 'publication_busy'
        elif tmdb_id in publication.get('history_errors', {}):
            failed[tmdb_id] = 'history_publication_failed'
        elif title.get('provider_state') == 'quarantined' or title.get('streaming_availability') is None:
            failed[tmdb_id] = 'quarantined_or_unpublishable'
    eligible = [tmdb_id for tmdb_id in tmdb_ids if tmdb_id not in failed]
    if not eligible:
        return failed
    with timed_stage(timings, 'vector_publication'):
        qdrant = QdrantConnector(timeout=REQUEST_TIMEOUT_SECONDS)
        try:
            result = copy_to_qdrant(qdrant, media_type, {'tmdb_id': {'$in': eligible}}, recent_only=False,
                                   strict_writes=True, streaming_connector=connector,
                                   delete_flagged=False, defer_busy=True) or {}
            for tmdb_id in result.get('busy_ids', []):
                failed[tmdb_id] = 'publication_busy'
        finally:
            qdrant.close()
    return failed


def source_snapshot(previous, payload, proof, scopes):
    """Normalize one checked payload identically for preview and execution."""
    from f.tmdb_api.models import WatchProviders
    tmdb_id = previous['tmdb_id']
    payload = WatchProviders(results=payload['results']).to_mongo().to_dict()
    proof = capture_provider_check({'id': tmdb_id, 'watch/providers': payload}, tmdb_id,
        datetime.fromtimestamp(proof['checked_at'] / 1000, timezone.utc),
        previous=previous.get('watch_providers_check'), bypass_cache=True)
    checks = {}
    for scope in scopes:
        country, service = scope.split('_')
        checks[scope] = dict(checked_at=proof['checked_at'], kinds=[kind for kind in ('flatrate', 'free', 'ads')
            if any(offer['provider_id'] == int(service)
                   for offer in payload['results'].get(country, {}).get(kind, []))])
    return payload, proof, checks


def preview_pending(client, db, connector, *, limit=1000, clock=lambda: datetime.now(timezone.utc)):
    """SELECT/find + budgeted HTTP only; show exact source/Crate offer/history diffs."""
    from f.tmdb_api.daily_provider_lists import title_checks, TMDBAccessDenied, RequestBudgetExceeded
    from f.sync.copy import tmdb_streaming as streaming
    from f.sync.availability_history import HistoryTitle, read_history, select_transitions, title_writes
    report = dict(dry_run=True, selected=0, failed=0, plans=[], failures=[])
    catalogs = {}
    for item in db.tmdb_list_offer_refresh.find({'pending': True}).sort(QUEUE_SORT).limit(limit):
        report['selected'] += 1
        media, tmdb_id = item['media_type'], item['tmdb_id']
        details = db.tmdb_movie_details if media == 'movie' else db.tmdb_tv_details
        providers_collection = db.tmdb_movie_providers if media == 'movie' else db.tmdb_tv_providers
        try:
            sources = list(details.find({'tmdb_id': tmdb_id}).limit(2))
            if len(sources) != 1 or sources[0].get('tmdb_deleted'):
                raise RefreshDeferred('missing_deleted_or_duplicate_details')
            if db.provider_identity_unresolved.find_one({'media': 'movie' if media == 'movie' else 'tv',
                    'tmdb_id': tmdb_id, 'status': {'$in': ['unresolved', 'resolved_alias']}}):
                raise RefreshDeferred('quarantined')
            if not connector.select(f'SELECT tmdb_id FROM {media} WHERE tmdb_id = ?', (tmdb_id,)):
                raise RefreshDeferred('catalog_title_missing')
            _, payload, proof = title_checks(client, 'tv' if media == 'show' else 'movie', [tmdb_id], clock)[0]
            if proof.get('deleted'):
                raise RefreshDeferred('provider_reports_deleted')
            payload, proof, checks = source_snapshot(sources[0], payload, proof, item['scopes'])
            scopes = (sources[0].get('watch_providers_list_scopes') or {}) | checks
            source = sources[0] | dict(watch_providers=payload, watch_providers_check=proof,
                                      watch_providers_error='', watch_providers_list_scopes=scopes)
            if media not in catalogs:
                catalogs[media] = defaultdict(list)
                for service in connector.select(
                    'SELECT tmdb_id,name,media_type,order_by_country FROM streaming_service WHERE media_type = ?', (media,)):
                    catalogs[media][service['name']].append(service)
            catalog = catalogs[media]
            existing = connector.select('SELECT * FROM streaming_availability WHERE media_tmdb_id = ANY(?) AND media_type = ?',
                                        ([tmdb_id], media))
            providers = list(providers_collection.find({'tmdb_id': tmdb_id}))
            (rows, verified, api), deferred = streaming.reconcile_deferring_unmapped(
                tmdb_id, media, existing, source, providers, catalog)
            evidence, changed, removed, aggregate = streaming.publication_writes(
                tmdb_id, media, streaming.Movie if media == 'movie' else streaming.Show,
                existing, source, providers, rows, verified, api, catalog,
                [r['country_code'] for r in existing])
            title = HistoryTitle(tmdb_id, source, rows, verified, existing, removed)
            pending = {item['_id']} if db.streaming_history_pending.find_one({'_id': item['_id']}) else set()
            previous = read_history(connector, media, [title])
            history = [row.model_dump() for transition in select_transitions([title], pending, media)
                       for row in title_writes(transition, previous, media, pending, utc_ms(clock()))]
            report['plans'].append(dict(identity=item['_id'], queue_version=item['version'],
                source_fields=dict(watch_providers=payload, watch_providers_check=proof, watch_providers_list_scopes=checks,
                                   watch_providers_error='', watch_providers_attempted_at=clock().isoformat()),
                offers_upsert=[r.model_dump() for r in changed], offers_delete=[list(key) for key in removed],
                aggregate=aggregate.model_dump(exclude_none=True) if aggregate is not None else None,
                vector_streaming_availability=sorted({f"{r['streaming_service_id']}_{r['country_code']}" for r in rows.values()}),
                evidence_upsert=[r.model_dump() for r in evidence], history_upsert=history,
                deferred_countries=sorted(deferred)))
        except (TMDBAccessDenied, RequestBudgetExceeded):
            raise
        except Exception as error:
            from f.tmdb_api.daily_provider_lists import failure_details
            failure = dict(identity=item['_id'], **failure_details(error))
            if isinstance(error, RefreshDeferred):
                failure['reason'] = failure['message']
            report['failures'].append(failure)
            report['failed'] += 1
    report['requests'] = client.stats
    return report


def drain(client, db, connector, *, dry_run=True, limit=20000, max_seconds=None, check_owned=lambda: None,
          publish=None, clock=lambda: datetime.now(timezone.utc)):
    from f.tmdb_api.daily_provider_lists import (
        title_checks, TMDBAccessDenied, RequestBudgetExceeded, LeaseLost,
    )
    dry_run = dry_run is not False
    report = dict(selected=0, published=0, failed=0, remaining=0, max_failure_days=0,
                  publication_batches=0, failures=[], deferred=0, deferrals=[], dry_run=dry_run, timings={})
    timings, timing_lock = report['timings'], threading.Lock()
    work = db.tmdb_list_offer_refresh
    started = time.monotonic()
    if not dry_run:
        work.create_index([('pending', 1), *QUEUE_SORT])
    # Freeze this bounded selection before changing indexed sort keys. Otherwise
    # a failed item moved to the end of the index can be read again in this run.
    items = list(work.find({'pending': True}).sort(QUEUE_SORT).limit(limit))
    consecutive_failures = 0

    def out_of_time():
        if max_seconds is not None and time.monotonic() - started >= max_seconds:
            report['deferred_reason'] = 'runtime_budget'
            return True
        return False

    def advance_failure_streak():
        nonlocal consecutive_failures
        consecutive_failures += 1
        if consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
            report['deferred_reason'] = 'consecutive_failures'

    def record_failure(item, error, *, advance_streak=True):
        check_owned()
        day = utc_day(utc_ms(clock()))
        streak = item.get('consecutive_failure_days', 0)
        if item.get('failure_day') != day:
            streak = streak + 1 if item.get('failure_day') == day - 86400000 else 1
        from f.tmdb_api.daily_provider_lists import failure_details
        failure = dict(identity=item['_id'], consecutive_failure_days=streak, **failure_details(error))
        if isinstance(error, RefreshDeferred):
            failure['reason'] = failure['message']
        work.update_one({'_id': item['_id'], 'version': item['version']}, {
            '$set': {'error': failure['error'], 'message': failure['message'], 'traceback': failure['traceback'],
                     'failure_day': day, 'consecutive_failure_days': streak,
                     'last_attempt_at': utc_ms(clock())}})
        report['failed'] += 1
        report['max_failure_days'] = max(report['max_failure_days'], streak)
        if len(report['failures']) < 20:
            report['failures'].append(failure)
        if advance_streak:
            advance_failure_streak()

    def record_batch_failure(batch, error):
        for item in batch:
            record_failure(item, error, advance_streak=False)
        advance_failure_streak()

    def record_busy(item):
        check_owned()
        work.update_one({'_id': item['_id'], 'version': item['version']}, {
            '$set': {'last_attempt_at': utc_ms(clock())}})
        report['deferred'] += 1
        if len(report['deferrals']) < 20:
            report['deferrals'].append(dict(identity=item['_id'], reason='publication_busy'))

    stopped = threading.Event()

    def prepare(item):
        # PyMongo collections and the client's thread-local HTTP sessions are
        # thread safe. The Crate cursor and queue acknowledgment stay on the
        # caller thread. Every HTTP attempt still uses the ONE shared client.
        if stopped.is_set() or (max_seconds is not None and time.monotonic() - started >= max_seconds):
            return None
        check_owned()
        media, tmdb_id = item['media_type'], item['tmdb_id']
        details = db.tmdb_movie_details if media == 'movie' else db.tmdb_tv_details
        try:
            with timed_stage(timings, 'source_read_worker_seconds', timing_lock):
                sources = list(details.find({'tmdb_id': tmdb_id}, {'_id': 1, 'tmdb_deleted': 1}).limit(2))
            if len(sources) > 1:
                raise RefreshDeferred('duplicate_details_identity')
            if not sources or sources[0].get('tmdb_deleted') is True:
                raise RefreshDeferred('active_details_missing')
            source = sources[0]
            with timed_stage(timings, 'tmdb_worker_seconds', timing_lock):
                _, payload, proof = title_checks(client, 'tv' if media == 'show' else 'movie', [tmdb_id], clock)[0]
            if proof.get('deleted'):
                raise RefreshDeferred('provider_reports_deleted')
            check_owned()
            from f.tmdb_api.provider_observations import save_observation
            with timed_stage(timings, 'source_write_worker_seconds', timing_lock):
                saved = save_observation(db, media, tmdb_id, payload, proof['checked_at'], cache_bypassed=True)
                if saved['status'] not in ('saved', 'reused'):
                    raise RefreshDeferred('newer_source_won' if saved['status'] == 'stale' else 'invalid_provider_source')
                # List scopes are independent evidence. Advance each one only
                # while the exact all-country observation still owns the source.
                payload, proof, checks = source_snapshot({'tmdb_id': tmdb_id,
                    'watch_providers_check': saved['proof']}, saved['payload'], saved['proof'], item['scopes'])
                for scope, value in checks.items():
                    details.update_one({'_id': source['_id'],
                        'watch_providers_check.checked_at': saved['checked_at'], '$or': [
                            {f'watch_providers_list_scopes.{scope}.checked_at': {'$lte': value['checked_at']}},
                            {f'watch_providers_list_scopes.{scope}.checked_at': None},
                        ]}, {'$set': {f'watch_providers_list_scopes.{scope}': value}})
            check_owned()
            return item
        except (TMDBAccessDenied, RequestBudgetExceeded, LeaseLost):
            stopped.set()
            raise

    offset = 0
    while offset < len(items):
        ready = defaultdict(list)
        # Prepared titles might all fail publication. Reserve only the attempts
        # remaining before the consecutive-failure stop, even across batches.
        candidates = []
        while (offset < len(items) and len(candidates)
               < min(PUBLISH_BATCH_SIZE, MAX_CONSECUTIVE_FAILURES - consecutive_failures)):
            item = items[offset]
            if out_of_time() or consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                break
            offset += 1
            report['selected'] += 1
            if dry_run:
                continue
            candidates.append(item)
        if candidates:
            catalog_ids = {}
            for media in {item['media_type'] for item in candidates}:
                check_owned()
                try:
                    with timed_stage(timings, 'catalog_reads'):
                        ids = [item['tmdb_id'] for item in candidates if item['media_type'] == media]
                        catalog_ids[media] = {row['tmdb_id'] for row in connector.select(
                            f'SELECT tmdb_id FROM {media} WHERE tmdb_id = ANY(?)', (ids,))}
                except (TMDBAccessDenied, RequestBudgetExceeded, LeaseLost):
                    raise
                except Exception as error:
                    record_batch_failure([item for item in candidates if item['media_type'] == media], error)
            valid = []
            for item in candidates:
                if item['media_type'] not in catalog_ids:
                    continue
                if item['tmdb_id'] in catalog_ids[item['media_type']]:
                    valid.append(item)
                else:
                    record_failure(item, RefreshDeferred('catalog_title_missing'))
            with timed_stage(timings, 'prepare_wall'):
                with ThreadPoolExecutor(max_workers=PREPARE_WORKERS) as workers:
                    futures = [workers.submit(prepare, item) for item in valid]
                    try:
                        # Preserve queue order and failure-streak semantics even
                        # when HTTP responses complete in a different order.
                        for item, future in zip(valid, futures):
                            try:
                                prepared = future.result()
                                if prepared is not None:
                                    ready[item['media_type']].append(prepared)
                            except (TMDBAccessDenied, RequestBudgetExceeded, LeaseLost):
                                raise
                            except Exception as error:
                                record_failure(item, error)
                    finally:
                        stopped.set()
                        for future in futures:
                            future.cancel()
                stopped.clear()
        if out_of_time():
            break
        for media, batch in ready.items():
            if out_of_time() or consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                break
            check_owned()
            try:
                with timed_stage(timings, 'publication_wall'):
                    ids = [item['tmdb_id'] for item in batch]
                    failed = (publish(connector, media, ids) if publish is not None else
                              publish_offers(connector, media, ids, timings=timings)) or {}
                check_owned()
                report['publication_batches'] += 1
            except (TMDBAccessDenied, RequestBudgetExceeded, LeaseLost):
                raise
            except Exception as error:
                record_batch_failure(batch, error)
                continue
            acknowledged = []
            for item in batch:
                reason = failed.get(item['tmdb_id'])
                if reason == 'publication_busy':
                    record_busy(item)
                    continue
                if reason:
                    record_failure(item, RefreshDeferred(reason))
                    continue
                acknowledged.append(item)
                consecutive_failures = 0
            if acknowledged:
                # Every predicate keeps its own version fence. One Mongo call
                # replaces per-title acknowledgment/lease-renewal round trips.
                with timed_stage(timings, 'queue_acknowledgment'):
                    check_owned()
                    work.update_many({'$or': [{'_id': item['_id'], 'version': item['version']}
                                             for item in acknowledged]}, {
                        '$set': {'pending': False, 'published_at': utc_ms(clock()), 'last_attempt_at': utc_ms(clock()),
                                 'consecutive_failure_days': 0},
                        '$unset': {'error': '', 'failure_day': ''}})
                    check_owned()
                report['published'] += len(acknowledged)
        if report.get('deferred_reason'):
            break
    report['remaining'] = work.count_documents({'pending': True})
    report['seconds'] = round(time.monotonic() - started, 6)
    report['seconds_per_published_title'] = (round(report['seconds'] / report['published'], 6)
                                           if report['published'] else None)
    report['timings'] = {name: round(seconds, 6) for name, seconds in timings.items()}
    return report


def main(dry_run: bool = True, max_requests: int = 350000, limit: int = 20000, preview_offers: bool = False):
    """Manual retry after review. Default preview performs SELECT/find only."""
    from f.tmdb_api.daily_provider_lists import TMDBClient
    from f.tmdb_api.daily_list_storage import ListStorage
    dry_run = dry_run is not False
    if type(limit) is not int or not 1 <= limit <= 30000:
        raise ValueError('limit must be between 1 and 30000')
    if preview_offers and not dry_run:
        raise ValueError('preview_offers requires dry_run=true')
    store = ListStorage(dry_run=dry_run)
    try:
        if dry_run:
            if preview_offers:
                return preview_pending(TMDBClient(max_requests=max_requests), store.db, store.connector, limit=limit)
            return drain(None, store.db, store.connector, dry_run=True, limit=limit)
        with store.run_lease() as owned:
            client = TMDBClient(max_requests=max_requests)
            report = drain(client, store.db, store.connector, dry_run=False, limit=limit,
                           max_seconds=27000, check_owned=owned)
            report['requests'] = client.stats
            return report
    finally:
        store.close()
