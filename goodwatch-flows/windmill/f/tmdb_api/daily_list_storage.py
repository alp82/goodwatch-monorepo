"""Checkpoints and serialized history publication for daily discover reads."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from f.sync.availability_history import publish_history, read_history, select_transitions, title_writes
from f.tmdb_api.provider_evidence import utc_ms


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
        self.db, self.connector, self.dry_run = db, connector, dry_run
        self.buffer = []
        self.stats = dict(planned_rows=0, published_titles=0, planned_exact_arrivals=0,
                          planned_unknown_arrivals=0, planned_exact_drops=0, planned_unknown_drops=0)

    def countries(self):
        return {row['_id'].split(':')[0]
                for collection in (self.db.tmdb_daily_provider_lists, self.db.tmdb_daily_provider_list_pending)
                for row in collection.find({}, {'_id': 1})}

    def load(self, identity):
        return self.db.tmdb_daily_provider_lists.find_one({'_id': identity})

    def pending(self, identity):
        intent = self.db.tmdb_daily_provider_list_pending.find_one({'_id': identity})
        return set((intent or {}).get('ids', []))

    def details(self, media_type, ids):
        collection = self.db.tmdb_tv_details if media_type == 'show' else self.db.tmdb_movie_details
        projection = {field: 1 for field in ('tmdb_id', 'networks', 'first_air_date', 'production_companies', 'release_dates')}
        return {row['tmdb_id']: row for row in collection.find({'tmdb_id': {'$in': ids}}, projection)}

    def stage(self, identity, ids, dry_run):
        if not dry_run and ids:
            if self.dry_run:
                raise RuntimeError('Read-only storage cannot stage intents')
            self.db.tmdb_daily_provider_list_pending.update_one({'_id': identity},
                {'$addToSet': {'ids': {'$each': sorted(ids)}}}, upsert=True)

    @contextmanager
    def lease(self, identity, dry_run):
        self.buffer = []
        if self.dry_run and not dry_run:
            raise RuntimeError('Read-only storage cannot acquire write leases')
        if dry_run:
            yield lambda: None
            return
        from pymongo.errors import DuplicateKeyError
        leases = self.db.tmdb_daily_provider_list_leases
        token = uuid4().hex
        now = datetime.now(timezone.utc)
        try:
            leases.update_one({'_id': identity, 'expires_at': {'$lte': now}},
                {'$set': {'token': token, 'expires_at': now + timedelta(minutes=15)}}, upsert=True)
        except DuplicateKeyError:
            raise RuntimeError('Daily list is already running') from None

        def check_owned():
            now = datetime.now(timezone.utc)
            updated = leases.update_one({'_id': identity, 'token': token,
                'expires_at': {'$gt': now + timedelta(minutes=3)}},
                {'$set': {'expires_at': now + timedelta(minutes=15)}})
            if updated.matched_count != 1:
                raise RuntimeError('Daily list lease expired or was lost')
        try:
            yield check_owned
            check_owned()
        finally:
            self.buffer = []
            leases.delete_one({'_id': identity, 'token': token})

    def publish(self, media_type, title, check_owned, dry_run):
        self.buffer.append((media_type, title, check_owned))
        if len(self.buffer) >= 200:
            self.flush(dry_run)

    def flush(self, dry_run):
        if not self.buffer:
            return
        media_type = self.buffer[0][0]
        titles = [item[1] for item in self.buffer]
        list_owned = self.buffer[0][2]
        if dry_run:
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
            if self.dry_run:
                raise RuntimeError('Read-only storage cannot publish')
            from f.sync.copy.tmdb_streaming import publication_leases
            with publication_leases(self.db, media_type, [title.tmdb_id for title in titles]) as (owned, title_owned):
                if set(owned) != {title.tmdb_id for title in titles}:
                    raise RuntimeError('A changed title is busy; checkpoint retained for retry')
                def check_owned():
                    list_owned()
                    title_owned()
                result = publish_history(self.connector, media_type, titles, check_owned)
                if result.errors:
                    raise RuntimeError('History publication failed; checkpoint retained for retry')
                check_owned()
            self.stats['published_titles'] += len(titles)
        self.buffer = []

    def save(self, identity, snapshot):
        if self.dry_run:
            raise RuntimeError('Read-only storage cannot save checkpoints')
        self.db.tmdb_daily_provider_lists.replace_one({'_id': identity}, dict(snapshot, _id=identity), upsert=True)
        self.db.tmdb_daily_provider_list_pending.delete_one({'_id': identity})

    def close(self):
        if self.owns_connections:
            from f.db.mongodb import close_mongodb
            self.connector.disconnect()
            close_mongodb()


def main():
    pass
