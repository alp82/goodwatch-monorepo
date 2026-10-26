# py: 3.12
# requirements:
# annotated-types==0.8.0
# anyio==4.15.1
# certifi==2026.10.23
# charset-normalizer==3.5.2
# crate==2.2.1
# dnspython==2.9.0
# grpcio==1.84.1
# h11==0.16.0
# h2==4.4.1
# hpack==4.2.0
# httpcore==1.0.9
# httpx==0.28.1
# hyperframe==6.1.0
# idna==3.20
# mongoengine==0.29.3
# numpy==2.5.4
# orjson==3.13.0
# portalocker==3.2.0
# protobuf==7.36.2
# pydantic==2.13.5
# pydantic-core==2.46.5
# pymongo==4.18.1
# qdrant-client==1.19.1
# requests==2.34.2
# typing-extensions==4.16.0
# typing-inspection==0.4.4
# urllib3==2.8.0
# verlib2==26.2
# wmill==1.815.0
"""Bounded provider detector over the streaming registry, read-only by default.

Uses existing details records for sticky membership, due work and publication
intents. API retries remain owned by the daily-list client's HTTP implementation.
"""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import hashlib
import time
from uuid import uuid4

from pymongo import ReturnDocument

from f.data_source.title_identity import canonical_title_id
from f.tmdb_api import provider_observations as evidence
from f.tmdb_api.daily_provider_lists import TMDBClient, title_checks, RequestBudgetExceeded, TMDBAccessDenied
from f.tmdb_api.provider_evidence import DAY, utc_ms

CONTROL_ID = 'tmdb_api_detector'
DAY_LIMIT = 100_000
RATE = 3
RUN_LEASE = timedelta(minutes=2)
BATCH = 500


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def naive(value):
    return value.astimezone(timezone.utc).replace(tzinfo=None) if value.tzinfo else value


def day_slot(media_type, tmdb_id):
    key = f'{media_type}:{canonical_title_id(media_type, tmdb_id)}'
    return int.from_bytes(hashlib.sha256(key.encode()).digest()[:8], 'big') % 7


def list_running(db, now):
    return db.tmdb_daily_provider_list_leases.find_one({'_id': 'run', 'expires_at': {'$gt': now}}) is not None


class DetectorStopped(RequestBudgetExceeded):
    pass


class Admission:
    """One renewable run owner plus atomic UTC budget and shared request spacing."""
    def __init__(self, db, *, clock=utc_now, sleeper=time.sleep, max_requests=DAY_LIMIT):
        self.db, self.clock, self.sleeper = db, clock, sleeper
        self.max_requests = min(max_requests, DAY_LIMIT)
        self.control = db.tmdb_streaming_upstream
        self.token = None

    def allowed(self):
        now = naive(self.clock())
        if now.hour >= 12:
            raise DetectorStopped('window_closed')
        if list_running(self.db, now):
            raise DetectorStopped('daily_list_active')
        return now

    def owned(self):
        now = self.allowed()
        if not self.token or self.control.update_one({'_id': CONTROL_ID, 'lease_token': self.token,
                'lease_expires_at': {'$gt': now}}, {'$set': {'lease_expires_at': now + RUN_LEASE}}).matched_count != 1:
            raise DetectorStopped('run_lease_lost')
        return now

    @contextmanager
    def lease(self):
        now = self.allowed()
        self.control.update_one({'_id': CONTROL_ID}, {'$setOnInsert': {'requests': 0}}, upsert=True)
        token = uuid4().hex
        owner = self.control.find_one_and_update({'_id': CONTROL_ID, '$or': [
            {'lease_expires_at': {'$lte': now}}, {'lease_expires_at': None},
        ]}, {'$set': {'lease_token': token, 'lease_expires_at': now + RUN_LEASE}}, return_document=ReturnDocument.AFTER)
        if owner is None:
            raise DetectorStopped('run_active')
        self.token = token
        try:
            yield self
        finally:
            self.control.update_one({'_id': CONTROL_ID, 'lease_token': token},
                {'$unset': {'lease_token': '', 'lease_expires_at': ''}})
            self.token = None

    def before_request(self):
        for _ in range(20):
            now = self.owned()
            source = self.control.find_one({'_id': CONTROL_ID})
            if source is None:
                raise DetectorStopped('shared_state_missing')
            next_at = source.get('next_request_at')
            if next_at and next_at > now:
                self.sleeper(min(1, (next_at - now).total_seconds()))
                continue
            day = utc_ms(now) // DAY
            count = source.get('requests', 0) if source.get('request_day') == day else 0
            if count >= self.max_requests:
                raise DetectorStopped('daily_budget_exhausted')
            saved = self.control.update_one({'_id': CONTROL_ID, 'lease_token': self.token,
                'lease_expires_at': {'$gt': now}, 'request_day': source.get('request_day'),
                'requests': source.get('requests', 0), 'next_request_at': source.get('next_request_at')},
                {'$set': {'request_day': day, 'requests': count + 1,
                          'next_request_at': now + timedelta(seconds=1 / RATE)}})
            if saved.matched_count == 1:
                return
        raise DetectorStopped('admission_contention')


def ensure_registry_indexes(db):
    """Explicit rollout preparation; normal detector runs never build indexes."""
    for media in ('movie', 'show'):
        sources, countries = evidence.collections(db, media)
        sources.create_index(
            [('provider_detector_registered', 1), ('tmdb_id', 1), ('popularity', 1)],
            partialFilterExpression={'provider_detector_registered': True},
            name='provider_detector_registered')
        countries.create_index(
            [('api_confirmation_pending', 1), ('tmdb_id', 1)],
            partialFilterExpression={'api_confirmation_pending': True},
            name='provider_detector_confirmation')


def registry(db, connector, now):
    """Current offers/prior check stamps, sticky observations, accepted opens and 404s."""
    result = {}
    for media in ('movie', 'show'):
        sources, countries = evidence.collections(db, media)
        rows = connector.select(f'''SELECT tmdb_id, popularity, tmdb_url FROM {media}
            WHERE tmdb_providers_updated_at IS NOT NULL OR tmdb_id IN
              (SELECT media_tmdb_id FROM streaming_availability WHERE media_type = ?)''', (media,))
        opened = {canonical_title_id(media, row['tmdb_id']) for row in connector.select(
            '''SELECT tmdb_id FROM crawl_priority WHERE media_type = ? AND last_opened_at >= ?''',
            (media, utc_ms(now - timedelta(days=1))))}
        confirmed = {canonical_title_id(media, row['tmdb_id']) for row in countries.find(
            {'api_confirmation_pending': True}, {'_id': 0, 'tmdb_id': 1})}
        for row in rows:
            key = (media, canonical_title_id(media, row['tmdb_id']))
            result[key] = dict(row, tmdb_id=key[1], opened=key[1] in opened,
                               confirmation=key[1] in confirmed)
        for row in sources.find({'provider_detector_registered': True}, {'_id': 0, 'tmdb_id': 1, 'popularity': 1}):
            key = (media, canonical_title_id(media, row['tmdb_id']))
            result.setdefault(key, dict(row, tmdb_id=key[1], opened=key[1] in opened,
                                        confirmation=key[1] in confirmed))
        for tmdb_id in opened | confirmed:
            result.setdefault((media, tmdb_id), dict(tmdb_id=tmdb_id, opened=tmdb_id in opened,
                                                   confirmation=tmdb_id in confirmed))
    return result


def selection(db, registered, now, *, shadow=False, persist=False, owned=lambda: None):
    """Stream bounded source batches; invalid observations are always due."""
    candidates, fresh = [], 0
    due_field = 'provider_detector_shadow_due_at' if shadow else 'provider_detector_due_at'
    for media in ('movie', 'show'):
        details, _ = evidence.collections(db, media)
        ids = sorted(tmdb_id for kind, tmdb_id in registered if kind == media)
        for offset in range(0, len(ids), BATCH):
            owned()
            batch = ids[offset:offset + BATCH]
            selector = {'tmdb_id': {'$in': batch}, 'tmdb_deleted': {'$ne': True}}
            if persist:
                details.update_many({**selector, 'provider_detector_registered': {'$ne': True}},
                                    {'$set': {'provider_detector_registered': True}})
            # Metadata includes large credits/images/recommendation payloads.
            # Selection needs only provider evidence and scheduling fields.
            sources = details.find(selector, {field: 1 for field in (
                'tmdb_id', 'popularity', 'watch_providers', 'watch_providers_check',
                'watch_providers_shadow', 'watch_providers_publication_pending', due_field)})
            initial_due = []
            for source in sources:
                tmdb_id = source['tmdb_id']
                key = (media, tmdb_id)
                info = registered[key]
                live = evidence.observation(source)
                prior_shadow = evidence.observation(source | source['watch_providers_shadow']) if shadow and source.get('watch_providers_shadow') else None
                observed = max((item for item in (live, prior_shadow) if item),
                               key=lambda item: item['checked_at'], default=None) if shadow else live
                copy_live = shadow and live is not None and (prior_shadow is None or live['checked_at'] > prior_shadow['checked_at'])
                last = observed['checked_at'] if observed else None
                popular = max(info.get('popularity') or 0, source.get('popularity') or 0) >= 5
                daily = info['opened'] or popular
                tier = 'confirmation' if info['confirmation'] else 'opened' if info['opened'] else 'popular' if popular else 'sweep'
                due_at = source.get(due_field)
                # Missing baseline cohorts acquire a durable due marker before
                # runtime/title limits can defer them past their original slot.
                due = (info['confirmation'] or (last is not None and utc_ms(now) - last >= (DAY if daily else 7 * DAY))
                       or (last is None and (daily or due_at is not None or day_slot(media, tmdb_id) == utc_ms(now) // DAY % 7)))
                if last is None and due and due_at is None and persist:
                    due_at = now
                    initial_due.append(tmdb_id)
                pending = source.get('watch_providers_publication_pending') if not shadow else None
                if due or pending or copy_live:
                    candidates.append(dict(media_type=media, tmdb_id=tmdb_id, tier=tier, due=due,
                                           last_checked_at=last, publication_revision=pending,
                                           tmdb_url=info.get('tmdb_url'), due_at=due_at, copy_live=copy_live))
                else:
                    fresh += 1
            if initial_due:
                details.update_many({'tmdb_id': {'$in': initial_due}, due_field: None},
                                    {'$set': {due_field: now}})
    rank = {'confirmation': 0, 'opened': 1, 'popular': 2, 'sweep': 3}
    candidates.sort(key=lambda item: (rank[item['tier']], item['last_checked_at'] or 0,
                                      item['media_type'], item['tmdb_id']))
    return candidates, fresh


def initialize_observed(db, candidate, observation, now):
    from f.tmdb_web.country_state import initialize_countries, country_from_url
    media, tmdb_id = candidate['media_type'], candidate['tmdb_id']
    details, countries = evidence.collections(db, media)
    source = details.find_one({'tmdb_id': tmdb_id}) or {}
    api_media = 'movie' if media == 'movie' else 'tv'
    initialize_countries(countries, tmdb_id, observation['payload']['results'], api_media,
                         original_title=source.get('original_title'), popularity=source.get('popularity'))
    evidence.propagate_pending(db, media, tmdb_id)
    for country in countries.find({'tmdb_id': tmdb_id, 'api_confirmation_pending': True}):
        code = country['country_code']
        url = observation['payload']['results'].get(code, {}).get('link')
        if not url:
            base = candidate.get('tmdb_url') or f'https://www.themoviedb.org/{api_media}/{tmdb_id}'
            url = base.rstrip('/') + '/watch?locale=' + code
        if country_from_url(url, tmdb_id, api_media) != code:
            raise ValueError('Canonical API watch URL country mismatch')
        countries.update_one({'_id': country['_id'], 'api_confirmation_pending': True},
            {'$set': {'tmdb_watch_url': url},
             '$unset': {'api_confirmation_pending': ''}})


def run_detector(db, connector, *, mode='preview', max_titles=100_000, max_requests=DAY_LIMIT,
                 max_seconds=3600, clock=utc_now, sleeper=time.sleep, client=None, publish=None):
    if mode not in ('preview', 'shadow', 'publish'):
        raise ValueError('mode must be preview, shadow or publish')
    if not 1 <= max_titles <= 100_000 or not 1 <= max_requests <= DAY_LIMIT or max_seconds <= 0:
        raise ValueError('Invalid detector bounds')
    report = dict(mode=mode, registered=0, fresh=0, due=0, selected=0, observed=0, reused=0,
                  deleted=0, invalid=0, failed=0, published=0, changed_pairs={}, gaps_ms=[], failures=[])
    now = naive(clock())
    if now.hour >= 12 or list_running(db, now):
        report['deferred_reason'] = 'window_closed' if now.hour >= 12 else 'daily_list_active'
        return report
    started = time.monotonic()
    shadow = mode == 'shadow'
    registered = registry(db, connector, now)
    report['registered'] = len(registered)
    admission = Admission(db, clock=clock, sleeper=sleeper, max_requests=max_requests)
    def owned():
        if time.monotonic() - started >= max_seconds:
            raise DetectorStopped('runtime_budget')
        return admission.owned()

    def before_request():
        owned()
        admission.before_request()

    if mode == 'preview':
        candidates, report['fresh'] = selection(db, registered, now, shadow=False)
        report['due'] = sum(item['due'] for item in candidates)
        report['candidates'] = candidates[:max_titles]
        # ISO timestamps keep the Windmill result serializable.
        for item in report['candidates']:
            if item['due_at']:
                item['due_at'] = item['due_at'].isoformat()
        return report
    try:
        with admission.lease():
            candidates, report['fresh'] = selection(db, registered, now, shadow=shadow,
                                                   persist=True, owned=owned)
            report['due'] = sum(item['due'] for item in candidates)
            if client is None:
                client = TMDBClient(requests_per_second=RATE, max_requests=max_requests,
                                    before_request=before_request)
            else:
                client.before_request = before_request
            for item in candidates[:max_titles]:
                if time.monotonic() - started >= max_seconds:
                    report['deferred_reason'] = 'runtime_budget'
                    break
                owned()
                report['selected'] += 1
                media, tmdb_id = item['media_type'], item['tmdb_id']
                details, _ = evidence.collections(db, media)
                due_field = 'provider_detector_shadow_due_at' if shadow else 'provider_detector_due_at'
                try:
                    current = evidence.read_observation(db, media, tmdb_id, shadow=shadow)
                    copied_live = False
                    if shadow:
                        live = evidence.read_observation(db, media, tmdb_id)
                        if live and (item['copy_live'] or current is None or live['checked_at'] > current['checked_at']):
                            copied = evidence.save_observation(db, media, tmdb_id, live['payload'], live['checked_at'],
                                cache_bypassed=live['proof'].get('cache_bypassed') is True, shadow=True)
                            if copied['status'] in ('saved', 'reused'):
                                current, copied_live = copied, True
                                report['reused'] += 1
                                report['changed_pairs'][item['tier']] = report['changed_pairs'].get(item['tier'], 0) + len(copied['changed_countries'])
                    interval = DAY if item['tier'] != 'sweep' else 7 * DAY
                    needs_http = item['tier'] == 'confirmation' or current is None or utc_ms(naive(clock())) - current['checked_at'] >= interval
                    if item['due'] and needs_http:
                        api_media = 'movie' if media == 'movie' else 'tv'
                        _, payload, proof = title_checks(client, api_media, [tmdb_id], clock)[0]
                        owned()
                        if proof.get('deleted'):
                            if not shadow:
                                result = evidence.save_deleted_observation(db, media, tmdb_id, proof['checked_at'])
                                if result['status'] == 'deleted':
                                    from f.tmdb_api.deleted_propagation import propagate_tmdb_deleted
                                    propagate_tmdb_deleted(api_media, [tmdb_id], True)
                            else:
                                details.update_one({'tmdb_id': tmdb_id}, {'$set': {'provider_detector_shadow_error': 'tmdb_not_found',
                                                                                             'provider_detector_shadow_attempted_at': naive(clock())}})
                            report['deleted'] += 1
                            continue
                        result = evidence.save_observation(db, media, tmdb_id, payload, proof['checked_at'],
                                                           cache_bypassed=True, shadow=shadow)
                        if result['status'] == 'invalid':
                            report['invalid'] += 1
                            continue
                        if result['status'] in ('missing', 'stale'):
                            continue
                        report['observed'] += 1
                        changes = len(result['changed_countries'])
                        report['changed_pairs'][item['tier']] = report['changed_pairs'].get(item['tier'], 0) + changes
                        if item['last_checked_at'] is not None:
                            report['gaps_ms'].append(result['checked_at'] - item['last_checked_at'])
                        current = result
                    elif current is not None and not copied_live:
                        report['reused'] += 1
                    if current is None:
                        continue
                    owned()
                    details.update_one({'tmdb_id': tmdb_id}, {'$unset': {due_field: ''}})
                    if shadow:
                        continue
                    initialize_observed(db, item, current, naive(clock()))
                    pending = details.find_one({'tmdb_id': tmdb_id}, {'watch_providers_publication_pending': 1}) or {}
                    revision = pending.get('watch_providers_publication_pending')
                    if revision:
                        owned()
                        failed = (publish or evidence.publish_observations)(connector, media, [tmdb_id])
                        owned()
                        if tmdb_id in failed:
                            raise RuntimeError(str(failed[tmdb_id]))
                        evidence.acknowledge_publication(db, media, tmdb_id, revision)
                        report['published'] += 1
                except RequestBudgetExceeded:
                    raise
                except TMDBAccessDenied:
                    raise
                except Exception as error:
                    owned()
                    report['failed'] += 1
                    prefix = 'provider_detector_shadow' if shadow else 'provider_detector'
                    details.update_one({'tmdb_id': tmdb_id}, {'$set': {prefix + '_error': type(error).__name__,
                                                                 prefix + '_attempted_at': naive(clock())}})
                    if len(report['failures']) < 20:
                        report['failures'].append(dict(media_type=media, tmdb_id=tmdb_id, error=type(error).__name__))
    except (RequestBudgetExceeded, TMDBAccessDenied) as error:
        report['deferred_reason'] = str(error)
    if client is not None:
        report['requests'] = client.stats
        latencies = sorted(getattr(client, 'latencies_ms', []))
        if latencies:
            report['request_p95_ms'] = round(latencies[max(0, (len(latencies) * 95 + 99) // 100 - 1)], 2)
    report['seconds'] = round(time.monotonic() - started, 3)
    return report


def main(mode: str = 'preview', max_titles: int = 100000, max_requests: int = 100000, max_seconds: int = 3600):
    from f.tmdb_api.daily_list_storage import ListStorage
    store = ListStorage(dry_run=True)
    try:
        return run_detector(store.db, store.connector, mode=mode, max_titles=max_titles,
                            max_requests=max_requests, max_seconds=max_seconds)
    finally:
        store.close()
