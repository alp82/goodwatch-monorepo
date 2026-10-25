# extra_requirements:
# crate==2.2.1
# mongoengine==0.29.3
# pymongo==4.18.1
# requests==2.34.2
# wmill==1.815.0
# pydantic==2.13.5
# qdrant-client==1.19.1
"""Checkpoints and serialized history publication for daily discover reads."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4
import time
import threading

from f.sync.availability_history import publish_history, read_history, select_transitions, title_writes
from f.tmdb_api.provider_evidence import utc_ms, utc_day


class LeaseBusy(RuntimeError):
    pass


class LeaseLost(RuntimeError):
    pass


class ListStorage:
    def __init__(self, *, dry_run=True, db=None, connector=None):
        self.owns_connections = db is None
        if db is None:
            from f.db.mongodb import init_mongodb
            from mongoengine import get_db
            init_mongodb()
            db = get_db()
        if connector is None:
            from f.db.cratedb import CrateConnector
            connector = CrateConnector()
        self.db, self.connector, self.dry_run = db, connector, dry_run is not False
        self.buffer = []
        self.run_owned = lambda: None
        self.lease_index_ready = False
        self.checkpoint_buffer = None
        self.stats = dict(planned_rows=0, published_titles=0, planned_exact_arrivals=0,
                          planned_unknown_arrivals=0, planned_exact_drops=0, planned_unknown_drops=0)

    def countries(self):
        return {row['_id'].split(':')[0]
                for collection in (self.db.tmdb_daily_provider_lists, self.db.tmdb_daily_provider_list_pending)
                for row in collection.find({}, {'_id': 1})}

    def open_ids(self, country, media_type, service_id):
        rows = self.connector.select('SELECT DISTINCT media_tmdb_id FROM availability_history '
            'WHERE media_type = ? AND country_code = ? AND streaming_service_id = ? '
            "AND streaming_type IN ('flatrate', 'free', 'ads') AND dropped_on IS NULL",
            (media_type, country, service_id))
        return {row['media_tmdb_id'] for row in rows}

    def load(self, identity):
        return self.db.tmdb_daily_provider_lists.find_one({'_id': identity})

    def inventory(self):
        return {row['_id']: row for row in self.db.tmdb_daily_provider_lists.find(
            {}, {'ids': 1, 'retry_ids': 1, 'checked_at': 1})}

    @contextmanager
    def checkpoint_batch(self):
        if self.dry_run:
            yield
            return
        self.checkpoint_buffer = {}
        try:
            yield
            snapshots = self.checkpoint_buffer
            # Commit a completed list's checkpoint and pending-marker cleanup
            # together. History writes precede this; intents preserve partial work.
            with self.db.client.start_session() as session:
                def commit(owned_session):
                    self.run_owned()
                    for identity, snapshot in snapshots.items():
                        self.db.tmdb_daily_provider_lists.replace_one(
                            {'_id': identity}, dict(snapshot, _id=identity), upsert=True, session=owned_session)
                    self.db.tmdb_daily_provider_list_pending.delete_many(
                        {'_id': {'$in': list(snapshots)}}, session=owned_session)
                    self.run_owned()
                session.with_transaction(commit)
        finally:
            self.checkpoint_buffer = None

    def pending(self, identity):
        intent = self.db.tmdb_daily_provider_list_pending.find_one({'_id': identity})
        return set((intent or {}).get('ids', []))

    def record_failure(self, identity, at, failure):
        """Persist calendar-day streaks with existing retry intents, never in previews."""
        collection = self.db.tmdb_daily_provider_list_pending
        previous = collection.find_one({'_id': identity}) or {}
        today, last = utc_day(at), previous.get('failure_day')
        count = previous.get('consecutive_failure_days', 0)
        if last != today:
            count = count + 1 if last == today - 86400000 else 1
        if not self.dry_run:
            collection.update_one({'_id': identity}, {'$set': dict(failure_day=today,
                consecutive_failure_days=count, last_failure=failure)}, upsert=True)
        return count

    def details(self, media_type, ids):
        collection = self.db.tmdb_tv_details if media_type == 'show' else self.db.tmdb_movie_details
        projection = {field: 1 for field in ('tmdb_id', 'networks', 'first_air_date', 'production_companies', 'release_dates')}
        return {row['tmdb_id']: row for row in collection.find({'tmdb_id': {'$in': ids}}, projection)}

    def stage(self, identity, ids):
        if not self.dry_run and ids:
            self.db.tmdb_daily_provider_list_pending.update_one({'_id': identity},
                {'$addToSet': {'ids': {'$each': sorted(ids)}}}, upsert=True)

    @contextmanager
    def mongo_lease(self, identity, *, heartbeat=False):
        from pymongo.errors import DuplicateKeyError
        leases = self.db.tmdb_daily_provider_list_leases
        if not self.lease_index_ready:
            leases.create_index('expires_at', expireAfterSeconds=0)
            self.lease_index_ready = True
        token = uuid4().hex
        now = datetime.now(timezone.utc)
        try:
            leases.update_one({'_id': identity, 'expires_at': {'$lte': now}},
                {'$set': {'token': token, 'expires_at': now + timedelta(minutes=15)}}, upsert=True)
        except DuplicateKeyError:
            raise LeaseBusy('Daily list lease is already held') from None
        lost = []
        stopped = threading.Event()

        def check_owned():
            if lost:
                raise LeaseLost('Daily run lease renewal failed') from lost[0]
            now = datetime.now(timezone.utc)
            updated = leases.update_one({'_id': identity, 'token': token,
                'expires_at': {'$gt': now + timedelta(minutes=3)}},
                {'$set': {'expires_at': now + timedelta(minutes=15)}})
            if updated.matched_count != 1:
                raise LeaseLost('Daily list lease expired or was lost')

        def renew():
            while not stopped.wait(60):
                try:
                    check_owned()
                except Exception as error:
                    lost.append(error)
                    return
        worker = threading.Thread(target=renew, daemon=True) if heartbeat else None
        try:
            if worker:
                worker.start()
            yield check_owned
            check_owned()
        finally:
            stopped.set()
            if worker:
                worker.join(timeout=5)
            leases.delete_one({'_id': identity, 'token': token})

    @contextmanager
    def run_lease(self):
        # Also serialize live previews: CE does not enforce concurrent_limit.
        # This operational lease is the only Mongo write in a live dry run.
        with self.mongo_lease('run', heartbeat=True) as owned:
            self.run_owned = owned
            try:
                yield owned
            finally:
                self.run_owned = lambda: None

    @contextmanager
    def lease(self, identity):
        self.buffer = []
        if self.dry_run:
            yield self.run_owned
            return
        try:
            with self.mongo_lease(identity) as list_owned:
                def check_owned():
                    self.run_owned()
                    list_owned()
                yield check_owned
        finally:
            self.buffer = []

    def publish(self, media_type, title, check_owned):
        self.buffer.append((media_type, title, check_owned))
        if len(self.buffer) >= 200:
            self.flush()

    def flush(self):
        if not self.buffer:
            return
        media_type = self.buffer[0][0]
        titles = [item[1] for item in self.buffer]
        list_owned = self.buffer[0][2]
        if self.dry_run:
            # Do not REFRESH: even the preview's SQL is exclusively SELECT.
            previous = read_history(self.connector, media_type, titles)
            by_title = {}
            for row in previous:
                by_title.setdefault(row['media_tmdb_id'], []).append(row)
            for transition in select_transitions(titles, set(), media_type):
                rows = title_writes(transition, by_title.get(transition.title.tmdb_id, []), media_type,
                                    set(), utc_ms(datetime.now(timezone.utc)))
                self.stats['planned_rows'] += len(rows)
                for row in rows:
                    if row.dropped_on is None:
                        self.stats[f'planned_{row.appeared_precision}_arrivals'] += 1
                    else:
                        self.stats[f'planned_{row.dropped_precision}_drops'] += 1
        else:
            from f.sync.copy.tmdb_streaming import publication_leases
            remaining = {title.tmdb_id: title for title in titles}
            for attempt in range(5):
                list_owned()
                with publication_leases(self.db, media_type, list(remaining)) as (owned, title_owned):
                    def check_owned():
                        list_owned()
                        title_owned()
                    if owned:
                        # Durable handoff precedes history and its checkpoint.
                        # Consumer refetches once per title, deduplicating scopes.
                        from f.tmdb_api.list_offer_refresh import enqueue_list_mismatches
                        enqueue_list_mismatches(self.db, self.connector, media_type,
                                                [remaining[tmdb_id] for tmdb_id in owned])
                        result = publish_history(self.connector, media_type,
                                                 [remaining[tmdb_id] for tmdb_id in owned], check_owned)
                        if result.errors:
                            raise RuntimeError('History publication failed; checkpoint retained for retry')
                        check_owned()
                        self.stats['published_titles'] += len(owned)
                        for tmdb_id in owned:
                            del remaining[tmdb_id]
                if not remaining:
                    break
                if attempt == 4:
                    raise RuntimeError('Changed titles remain busy; checkpoint retained for retry')
                time.sleep(min(30, 5 * 2 ** attempt))
        self.buffer = []

    def save(self, identity, snapshot):
        if self.dry_run:
            raise RuntimeError('Read-only storage cannot save checkpoints')
        if self.checkpoint_buffer is not None:
            self.checkpoint_buffer[identity] = snapshot
            return
        self.db.tmdb_daily_provider_lists.replace_one({'_id': identity}, dict(snapshot, _id=identity), upsert=True)
        self.db.tmdb_daily_provider_list_pending.delete_one({'_id': identity})

    def close(self):
        if self.owns_connections:
            from f.db.mongodb import close_mongodb
            self.connector.disconnect()
            close_mongodb()


def main():
    pass
