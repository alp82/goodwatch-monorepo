"""Daily list entrypoint, with TMDB and storage replaced at their boundaries."""
from copy import deepcopy
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
import sys
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from test_availability_history import HistoryCrate as BaseHistoryCrate, day
from f.sync.availability_history import publish_history
from f.tmdb_api import daily_provider_lists as job


class HistoryCrate(BaseHistoryCrate):
    def select(self, sql, params=None):
        if sql.startswith('SELECT DISTINCT media_tmdb_id FROM availability_history'):
            return [{'media_tmdb_id': row['media_tmdb_id']} for row in self.history.values()
                    if (row['media_type'], row['country_code'], row['streaming_service_id']) == tuple(params)
                    and row['streaming_type'] in ('flatrate', 'free', 'ads') and row['dropped_on'] is None]
        return super().select(sql, params)


class TMDB:
    def __init__(self, ids=(42,)):
        self.ids = list(ids)
        self.calls = []
        self.results = {'US': {'flatrate': [{'provider_id': 8}]}}

    def get(self, path, **params):
        self.calls.append((path, params))
        if path == '/watch/providers/regions':
            return {'results': [{'iso_3166_1': 'US'}]}
        if path.startswith('/discover/'):
            return {'page': params['page'], 'total_pages': 1 if self.ids else 0,
                    'total_results': len(self.ids), 'results': [{'id': i} for i in self.ids]}
        return {'id': int(path.split('/')[2]), 'results': deepcopy(self.results)}


class Storage:
    def __init__(self):
        self.dry_run = True
        self.snapshots = {}
        self.intents = {}
        self.metadata = {}
        self.crate = HistoryCrate()
        self.commits = 0

    @contextmanager
    def run_lease(self):
        yield lambda: None

    @contextmanager
    def lease(self, identity):
        yield lambda: None

    def open_ids(self, country, media_type, service):
        return {row['media_tmdb_id'] for row in self.crate.history.values()
                if (row['country_code'], row['media_type'], row['streaming_service_id']) == (country, media_type, service)
                and row['dropped_on'] is None}

    def load(self, identity):
        return deepcopy(self.snapshots.get(identity))

    def publish(self, media_type, title, check_owned):
        if self.dry_run:
            return
        result = publish_history(self.crate, media_type, [title], check_owned)
        if result.errors:
            raise RuntimeError(str(result.errors))

    def save(self, identity, snapshot):
        self.snapshots[identity] = deepcopy(snapshot)
        self.intents.pop(identity, None)
        self.commits += 1

    def pending(self, identity):
        return set(self.intents.get(identity, []))

    def details(self, media_type, ids):
        return {tmdb_id: self.metadata.get(tmdb_id, {}) for tmdb_id in ids}

    def stage(self, identity, ids):
        if not self.dry_run:
            self.intents[identity] = sorted(set(ids) | self.pending(identity))

    def flush(self):
        pass

    def countries(self):
        return [identity.split(':')[0] for identity in self.snapshots]

    def close(self):
        pass


class DailyListTests(unittest.TestCase):
    def setUp(self):
        self.api, self.store = TMDB(), Storage()

    def run_day(self, date, **kwargs):
        dry_run = kwargs.pop('dry_run', True)
        if isinstance(self.store, Storage):
            self.store.dry_run = dry_run is not False
        return job.run_daily_lists(self.api, self.store, countries=['US'], service_ids=[8],
                                   media_types=['show'], now=datetime.fromisoformat(date), **kwargs)

    def test_first_read_records_unknown_baseline_and_dry_run_is_inert(self):
        report = self.run_day('2026-10-14T20:00:00', dry_run=True)
        self.assertEqual(report['lists_completed'], 1)
        self.assertEqual(self.store.snapshots, {})
        self.assertEqual(self.store.crate.history, {})
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        stay = next(iter(self.store.crate.history.values()))
        self.assertEqual(stay['appeared_source'], 'title')
        self.assertEqual(stay['appeared_precision'], 'unknown')
        self.assertEqual(stay['appeared_on'], day('2026-10-14'))
        self.assertEqual(self.store.crate.writes, ['REFRESH TABLE availability_history', 'availability_history'])

    def test_consecutive_lists_date_arrivals_drops_and_returns_including_absent_country(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids = [42]
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.api.ids = []
        self.api.results = {}  # TMDB drops the whole country, not just its offer.
        self.run_day('2026-10-15T20:00:00', dry_run=False)
        self.api.ids = [42]
        self.api.results = {'US': {'flatrate': [{'provider_id': 8}]}}
        self.run_day('2026-10-16T20:00:00', dry_run=False)
        stays = list(self.store.crate.history.values())
        self.assertEqual(len(stays), 2)
        self.assertEqual(stays[0]['appeared_precision'], 'exact')
        self.assertEqual(stays[0]['appeared_after'], day('2026-10-13'))
        self.assertEqual(stays[0]['dropped_on'], day('2026-10-15'))
        self.assertEqual(stays[0]['dropped_precision'], 'exact')
        self.assertEqual(stays[0]['last_seen_on'], day('2026-10-14'))
        self.assertEqual(stays[1]['appeared_on'], day('2026-10-16'))
        self.assertEqual(stays[1]['appeared_precision'], 'exact')

    def test_title_check_rejects_false_drop_and_retries_even_when_list_stays_empty(self):
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.api.ids = []
        self.run_day('2026-10-15T20:00:00', dry_run=False)
        self.assertIsNone(next(iter(self.store.crate.history.values()))['dropped_on'])
        self.api.results = {}
        self.run_day('2026-10-16T20:00:00', dry_run=False)
        stay = next(iter(self.store.crate.history.values()))
        self.assertEqual(stay['dropped_on'], day('2026-10-16'))
        self.assertEqual(stay['dropped_precision'], 'exact')

    def test_title_sort_shortfall_uses_second_sort_union_before_checkpoint(self):
        original = self.api.get
        def paging(path, **params):
            if path.startswith('/discover/'):
                ids = [41, 42] if params['sort_by'] == 'name.asc' else [42, 43]
                return {'page': 1, 'total_pages': 1, 'total_results': 3,
                        'results': [{'id': i} for i in ids]}
            return original(path, **params)
        self.api.get = paging
        report = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(report['lists_completed'], 1)
        self.assertEqual(next(iter(self.store.snapshots.values()))['ids'], [41, 42, 43])
        self.assertEqual(len(self.store.crate.history), 3)
        self.assertEqual(report['lists'][0]['sort_fallbacks'], 1)

    def test_short_list_or_failed_title_check_never_advances_checkpoint(self):
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        baseline = deepcopy(self.store.snapshots)
        history = deepcopy(self.store.crate.history)
        original = self.api.get
        for failure in ('short', 'title'):
            with self.subTest(failure=failure):
                def failed(path, **params):
                    if path.startswith('/discover/'):
                        return {'page': 1, 'total_pages': 1, 'total_results': 2 if failure == 'short' else 1,
                                'results': [{'id': 43}]}
                    raise TimeoutError('TMDB timeout')
                self.api.get = failed
                report = self.run_day('2026-10-15T20:00:00', dry_run=False)
                self.assertEqual(report['lists_failed'], 1)
                self.assertEqual(self.store.snapshots, baseline)
                self.assertEqual(self.store.crate.history, history)
        self.api.get = original

    def test_paging_metadata_change_tries_a_clean_second_sort(self):
        original = self.api.get
        def changing(path, **params):
            if not path.startswith('/discover/'):
                return original(path, **params)
            if params['sort_by'] == 'name.asc':
                return {'page': params['page'], 'total_pages': 2,
                        'total_results': 2 if params['page'] == 1 else 3,
                        'results': [{'id': 42}]}
            return {'page': 1, 'total_pages': 1, 'total_results': 1, 'results': [{'id': 43}]}
        self.api.get = changing
        result = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(result['lists_completed'], 1)
        self.assertEqual(next(iter(self.store.snapshots.values()))['ids'], [43])
        self.assertEqual(result['lists'][0]['sort_fallbacks'], 1)

    def test_two_torn_sorts_report_the_last_distinct_count_read(self):
        def torn(path, **params):
            count = 2 if params['sort_by'] == 'name.asc' else 3
            return dict(page=params['page'], total_pages=2,
                        total_results=5 if params['page'] == 1 else 6,
                        results=[{'id': 40 + i} for i in range(count)])
        self.api.get = torn
        result = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(result['lists_failed'], 1)
        self.assertIn('read 3', result['lists'][0]['reason'])
        self.assertEqual(self.store.snapshots, {})
        self.assertEqual(self.store.crate.history, {})
        self.assertEqual(self.store.intents, {})

    def test_large_lists_are_partitioned_without_losing_titles_with_no_release_date(self):
        original = self.api.get
        def partitioned(path, **params):
            if not path.startswith('/discover/'):
                return original(path, **params)
            if 'vote_count.lte' not in params and 'vote_count.gte' not in params:
                return {'page': 1, 'total_pages': 1001, 'total_results': 20001, 'results': [{'id': 42}]}
            ids = [42] if 'vote_count.lte' in params else [43]
            return {'page': 1, 'total_pages': 1, 'total_results': 1, 'results': [{'id': i} for i in ids]}
        self.api.get = partitioned
        report = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(report['lists_completed'], 1)
        self.assertEqual(next(iter(self.store.snapshots.values()))['ids'], [42, 43])

    def test_vote_count_growth_can_overlap_partitions_without_losing_completeness(self):
        original = self.api.get
        def growing(path, **params):
            if not path.startswith('/discover/'):
                return original(path, **params)
            if 'vote_count.lte' not in params and 'vote_count.gte' not in params:
                return {'page': 1, 'total_pages': 501, 'total_results': 3, 'results': []}
            ids = [41, 42] if 'vote_count.lte' in params else [42, 43]
            return {'page': 1, 'total_pages': 1, 'total_results': 2, 'results': [{'id': i} for i in ids]}
        self.api.get = growing
        result = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(result['lists_completed'], 1)
        self.assertEqual(next(iter(self.store.snapshots.values()))['ids'], [41, 42, 43])

    def test_same_day_rerun_is_inert_but_gap_cannot_claim_exact_day(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids = [42]
        same_day = self.run_day('2026-10-13T21:00:00', dry_run=False)
        self.assertEqual(self.store.commits, 1)
        self.assertEqual(self.store.crate.history, {})
        self.assertEqual(same_day['lists_skipped'], 1)
        self.run_day('2026-10-15T20:00:00', dry_run=False)
        self.assertEqual(next(iter(self.store.crate.history.values()))['appeared_precision'], 'unknown')

    def test_previous_checkpoint_must_carry_fresh_complete_read_provenance(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        for snapshot in self.store.snapshots.values():
            snapshot['cache_bypassed'] = False
        self.api.ids = [42]
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(next(iter(self.store.crate.history.values()))['appeared_precision'], 'unknown')

    def test_later_list_evidence_refines_the_title_writers_unknown_arrival(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids = [42]
        # The ordinary title publisher can discover today's change first.
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        payload = {'results': deepcopy(self.api.results)}
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 14, 12), bypass_cache=True)
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                             {key: key._asdict()}, {}, [], [])
        publish_history(self.store.crate, 'show', [title], lambda: None)
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        stays = list(self.store.crate.history.values())
        self.assertEqual(len(stays), 1)
        self.assertEqual(stays[0]['appeared_precision'], 'exact')
        self.assertEqual(stays[0]['appeared_source'], 'title')

    def test_list_evidence_refines_a_drop_published_earlier_today(self):
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        payload = {'results': {'US': {}}}
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 14, 12), bypass_cache=True)
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                             {}, {}, [key._asdict()], [key])
        publish_history(self.store.crate, 'show', [title], lambda: None)
        self.assertEqual(next(iter(self.store.crate.history.values()))['dropped_precision'], 'unknown')
        self.api.ids, self.api.results = [], {}
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(next(iter(self.store.crate.history.values()))['dropped_precision'], 'exact')

    def test_an_older_pending_title_publication_cannot_reopen_a_confirmed_exact_drop(self):
        import mongomock
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        payload = {'results': deepcopy(self.api.results)}
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 13, 12), bypass_cache=True)
        self.api.ids, self.api.results = [], {}
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                             {key: key._asdict()}, {}, [key._asdict()], [])
        pending = mongomock.MongoClient().db.streaming_history_pending
        pending.insert_one({'_id': 'show:42'})
        publish_history(self.store.crate, 'show', [title], lambda: None, pending)
        rows = list(self.store.crate.history.values())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['dropped_precision'], 'exact')

    def test_pending_repair_preserves_the_live_publishers_genuine_removal(self):
        import mongomock
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        # The stay's scrape observation is newer than the publisher's API check.
        initial = HistoryTitle(42, {}, {key: key._asdict()},
                               {'US': {'updated_at': datetime(2026, 10, 14, 14)}}, [], [])
        publish_history(self.store.crate, 'show', [initial], lambda: None)
        payload = {'results': {'US': {'flatrate': [{'provider_id': 337}]}}}
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 14, 10), bypass_cache=True)
        title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                             {}, {}, [key._asdict()], [key])
        pending = mongomock.MongoClient().db.streaming_history_pending
        pending.insert_one({'_id': 'show:42'})
        result = publish_history(self.store.crate, 'show', [title], lambda: None, pending)
        self.assertEqual(result.errors, {})
        rows = list(self.store.crate.history.values())
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['dropped_on'], day('2026-10-14'))
        self.assertEqual(rows[0]['dropped_precision'], 'unknown')

    def test_pending_retained_offer_cannot_reopen_an_unknown_baseline_drop(self):
        import mongomock
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        self.run_day('2026-10-10T20:00:00', dry_run=False)
        self.store.snapshots.clear()
        self.api.ids, self.api.results = [], {}
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        before = deepcopy(self.store.crate.history)
        self.assertEqual(next(iter(before.values()))['dropped_precision'], 'unknown')
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        payload = {'results': {}}  # Reconciliation retained the omitted country's offer.
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 14, 12), bypass_cache=True)
        title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                             {key: key._asdict()}, {}, [key._asdict()], [])
        pending = mongomock.MongoClient().db.streaming_history_pending
        pending.insert_one({'_id': 'show:42'})
        publish_history(self.store.crate, 'show', [title], lambda: None, pending)
        self.assertEqual(self.store.crate.history, before)
        self.api.calls.clear()
        self.run_day('2026-10-15T20:00:00', dry_run=False)
        self.assertEqual(sum(path.endswith('/watch/providers') for path, _ in self.api.calls), 0)
        self.assertEqual(self.store.crate.history, before)

    def test_pending_returns_need_positive_support_and_preserve_the_exact_drop_day_guard(self):
        import mongomock
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        cases = [('unknown', 'api', 14, 2), ('unknown', 'scrape', 14, 2),
                 ('exact', 'api', 11, 1), ('exact', 'api', 12, 2), ('exact', 'scrape', 12, 1)]
        for precision, source, checked_day, expected_stays in cases:
            with self.subTest(precision=precision, source=source, checked_day=checked_day):
                self.api, self.store = TMDB(), Storage()
                self.run_day('2026-10-10T20:00:00', dry_run=False)
                if precision == 'unknown':
                    self.store.snapshots.clear()
                self.api.ids, self.api.results = [], {}
                drop_day = 13 if precision == 'unknown' else 11
                self.run_day(f'2026-10-{drop_day}T20:00:00', dry_run=False)
                checked_at = datetime(2026, 10, checked_day, 21)
                key = OfferKey(42, 'show', 'US', 8, 'flatrate')
                payload = {'results': {'US': {'flatrate': [{'provider_id': 8}]}} if source == 'api' else {}}
                proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                               checked_at, bypass_cache=True)
                verified = {'US': {'updated_at': checked_at}} if source == 'scrape' else {}
                title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                                     {key: key._asdict()}, verified, [key._asdict()], [])
                pending = mongomock.MongoClient().db.streaming_history_pending
                pending.insert_one({'_id': 'show:42'})
                result = publish_history(self.store.crate, 'show', [title], lambda: None, pending)
                self.assertEqual(result.errors, {})
                rows = list(self.store.crate.history.values())
                self.assertEqual(len(rows), expected_stays)
                self.assertEqual(rows[0]['dropped_precision'], precision)
                if expected_stays == 2:
                    self.assertIsNone(rows[1]['dropped_on'])

    def test_pending_country_omission_cannot_reopen_an_exact_list_drop(self):
        import mongomock
        from f.sync.availability_history import HistoryTitle, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids, self.api.results = [], {}
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        # Reconciliation retains the old offer when TMDB omits the country.
        # Even a newer copy time or HTTP response cannot substantiate a return.
        for checked_at in (datetime(2026, 10, 13, 12), datetime(2026, 10, 15, 12)):
            payload = {'results': {}}
            proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                           checked_at, bypass_cache=True)
            title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof},
                                 {key: key._asdict()}, {}, [key._asdict()], [])
            pending = mongomock.MongoClient().db.streaming_history_pending
            pending.insert_one({'_id': 'show:42'})
            publish_history(self.store.crate, 'show', [title], lambda: None, pending)
            rows = list(self.store.crate.history.values())
            self.assertEqual(len(rows), 1)
            self.assertEqual(rows[0]['dropped_precision'], 'exact')

    def test_pending_stale_absence_cannot_close_a_newer_list_arrival(self):
        import mongomock
        from f.sync.availability_history import HistoryTitle
        from f.tmdb_api.provider_evidence import capture_provider_check
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids = [42]
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        payload = {'results': {'US': {}}}
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 13, 12), bypass_cache=True)
        title = HistoryTitle(42, {'watch_providers': payload, 'watch_providers_check': proof}, {}, {}, [], [])
        pending = mongomock.MongoClient().db.streaming_history_pending
        pending.insert_one({'_id': 'show:42'})
        publish_history(self.store.crate, 'show', [title], lambda: None, pending)
        rows = list(self.store.crate.history.values())
        self.assertEqual(len(rows), 1)
        self.assertIsNone(rows[0]['dropped_on'])
        self.assertEqual(rows[0]['appeared_precision'], 'exact')

    def test_default_entrypoint_covers_regions_and_stored_countries_even_if_tmdb_drops_them(self):
        with patch.object(job, 'TMDBClient', return_value=self.api), patch.object(job, 'create_list_storage', return_value=self.store):
            report = job.main(service_ids=[8])
        self.assertEqual(report['lists_completed'], 2)
        self.assertTrue(report['dry_run'])
        self.assertEqual(self.store.snapshots, {})
        self.assertEqual(len(job.SERVICE_NAMES), 15)

    def test_null_dry_run_input_from_a_flow_cannot_enable_writes(self):
        with patch.object(job, 'TMDBClient', return_value=self.api), patch.object(job, 'create_list_storage', return_value=self.store):
            report = job.main(service_ids=[8], dry_run=None)
        self.assertIs(report['dry_run'], True)
        self.assertEqual(self.store.snapshots, {})
        self.assertEqual(self.store.crate.history, {})

    def test_held_run_lease_skips_before_any_tmdb_request(self):
        import mongomock
        from datetime import timedelta
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        db.tmdb_daily_provider_list_leases.insert_one({'_id': 'run', 'token': 'other',
                                                       'expires_at': datetime.now() + timedelta(minutes=15)})
        store = ListStorage(db=db, connector=HistoryCrate(), dry_run=True)
        with patch.object(job, 'TMDBClient', return_value=self.api), patch.object(job, 'create_list_storage', return_value=store):
            result = job.main(service_ids=[8])
        self.assertTrue(result['run_skipped'])
        self.assertEqual(db.tmdb_daily_provider_list_leases.index_information()['expires_at_1']['expireAfterSeconds'], 0)
        self.assertEqual(self.api.calls, [])
        self.assertEqual(db.tmdb_daily_provider_list_leases.find_one({'_id': 'run'})['token'], 'other')

    def test_held_list_lease_is_skipped_not_failed(self):
        import mongomock
        from datetime import timedelta
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        db.tmdb_daily_provider_list_leases.insert_one({'_id': 'US:show:8', 'token': 'other',
                                                       'expires_at': datetime.now() + timedelta(minutes=15)})
        self.store = ListStorage(db=db, connector=HistoryCrate(), dry_run=False)
        result = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(result['lists_skipped'], 1)
        self.assertEqual(result['lists_failed'], 0)
        self.assertEqual(self.api.calls, [])

    def test_a_country_removed_from_regions_is_still_read_when_it_has_pending_history(self):
        import mongomock
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        db.tmdb_daily_provider_list_pending.insert_one({'_id': 'DE:show:8', 'ids': [42]})
        store = ListStorage(db=db, connector=HistoryCrate(), dry_run=True)
        with patch.object(job, 'TMDBClient', return_value=self.api), patch.object(job, 'create_list_storage', return_value=store):
            report = job.main(service_ids=[8])
        self.assertEqual(report['countries'], ['DE', 'US'])

    def test_storage_adapter_preview_reads_history_without_writes_or_leases(self):
        import mongomock
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        self.store = ListStorage(db=db, connector=HistoryCrate(), dry_run=True)
        report = self.run_day('2026-10-14T20:00:00', dry_run=True)
        self.assertEqual(report['lists_completed'], 1)
        self.assertEqual(self.store.stats['planned_rows'], 1)
        self.assertEqual(self.store.stats['planned_exact_arrivals'], 0)
        self.assertEqual(self.store.stats['planned_unknown_arrivals'], 1)
        self.assertEqual(self.store.connector.writes, [])
        self.assertEqual(db.list_collection_names(), [])

    def test_read_only_adapter_refuses_checkpoint_writes(self):
        import mongomock
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        store = ListStorage(db=db, connector=HistoryCrate(), dry_run=True)
        with self.assertRaisesRegex(RuntimeError, 'Read-only storage'):
            store.save('US:show:8', {})
        self.assertEqual(db.list_collection_names(), [])

    def test_storage_adapter_serializes_history_and_checkpoints_without_offer_writes(self):
        import mongomock
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        self.store = ListStorage(db=db, connector=HistoryCrate(), dry_run=False)
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.api.ids, self.api.results = [], {}
        report = self.run_day('2026-10-15T20:00:00', dry_run=False)
        self.assertEqual(report['lists_failed'], 0)
        self.assertEqual(db.tmdb_daily_provider_list_leases.count_documents({}), 0)
        self.assertEqual(db.streaming_publication_leases.count_documents({}), 0)
        self.assertEqual(db.tmdb_daily_provider_lists.find_one({})['ids'], [])
        stay = next(iter(self.store.connector.history.values()))
        self.assertEqual(stay['dropped_precision'], 'exact')
        self.assertTrue(all('availability_history' in write for write in self.store.connector.writes))

    def test_busy_titles_are_retried_after_free_titles_are_published(self):
        import mongomock
        from datetime import timedelta
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        self.api.ids = [42, 43]
        self.store = ListStorage(db=db, connector=HistoryCrate(), dry_run=False)
        db.streaming_publication_leases.insert_one({'_id': 'show:42', 'token': 'other',
                                                     'expires_at': datetime.now() + timedelta(minutes=15)})
        def release(seconds):
            self.assertGreaterEqual(seconds, 5)
            self.assertEqual({r['media_tmdb_id'] for r in self.store.connector.history.values()}, {43})
            db.streaming_publication_leases.delete_one({'_id': 'show:42'})
        with patch('time.sleep', side_effect=release) as sleep:
            result = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(result['lists_completed'], 1)
        self.assertEqual(sleep.call_count, 1)
        self.assertEqual({r['media_tmdb_id'] for r in self.store.connector.history.values()}, {42, 43})
        self.assertEqual(db.tmdb_daily_provider_list_pending.count_documents({}), 0)

    def test_exhausted_title_retries_retain_intents_and_replay_only_once(self):
        import mongomock
        from datetime import timedelta
        from f.tmdb_api.daily_list_storage import ListStorage
        db = mongomock.MongoClient().db
        self.api.ids = [42, 43]
        self.store = ListStorage(db=db, connector=HistoryCrate(), dry_run=False)
        db.streaming_publication_leases.insert_one({'_id': 'show:42', 'token': 'other',
                                                     'expires_at': datetime.now() + timedelta(minutes=15)})
        with patch('time.sleep') as sleep:
            failed = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(failed['lists_failed'], 1)
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [5, 10, 20, 30])
        self.assertEqual(db.tmdb_daily_provider_lists.count_documents({}), 0)
        self.assertEqual(set(db.tmdb_daily_provider_list_pending.find_one({})['ids']), {42, 43})
        self.assertEqual(len(self.store.connector.history), 1)
        db.streaming_publication_leases.delete_one({'_id': 'show:42'})
        result = self.run_day('2026-10-14T21:00:00', dry_run=False)
        self.assertEqual(result['lists_completed'], 1)
        self.assertEqual(len(self.store.connector.history), 2)
        self.assertEqual(db.tmdb_daily_provider_list_pending.count_documents({}), 0)

    def test_mismatched_or_malformed_title_payload_does_not_confirm_a_change(self):
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.api.ids = []
        old = deepcopy(self.store.snapshots)
        original = self.api.get
        for payload in ({'id': 999, 'results': {}}, {'id': 42, 'results': None}):
            with self.subTest(payload=payload):
                self.api.get = lambda path, **kw: original(path, **kw) if path.startswith('/discover/') else payload
                result = self.run_day('2026-10-15T20:00:00', dry_run=False)
                self.assertEqual(result['lists_failed'], 1)
                self.assertEqual(self.store.snapshots, old)
                self.assertIsNone(next(iter(self.store.crate.history.values()))['dropped_on'])

    def test_one_title_check_covers_multiple_provider_lists(self):
        self.api.results['US']['flatrate'].append({'provider_id': 11})
        self.store.dry_run = False
        result = job.run_daily_lists(self.api, self.store, countries=['US'], service_ids=[8, 11],
            media_types=['show'],  now=datetime(2026, 10, 14, 20))
        self.assertEqual(result['lists_completed'], 2)
        self.assertEqual(sum(path.endswith('/watch/providers') for path, _ in self.api.calls), 1)
        self.assertEqual(len(self.store.crate.history), 2)

    def test_failed_checkpoint_is_replayed_without_duplicating_history(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids = [42]
        original = self.store.save
        self.store.save = lambda *args: (_ for _ in ()).throw(TimeoutError('Checkpoint write failed'))
        failed = self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.assertEqual(failed['lists_failed'], 1)
        self.store.save = original
        self.run_day('2026-10-14T21:00:00', dry_run=False)
        self.assertEqual(len(self.store.crate.history), 1)
        self.assertEqual(next(iter(self.store.crate.history.values()))['appeared_precision'], 'exact')

    def test_interrupted_publication_is_reconciled_if_source_changes_before_retry(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.api.ids = [42]
        original = self.store.save
        self.store.save = lambda *args: (_ for _ in ()).throw(TimeoutError('Checkpoint failed'))
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.store.save = original
        self.api.ids, self.api.results = [], {}
        report = self.run_day('2026-10-15T20:00:00', dry_run=False)
        self.assertEqual(report['lists_failed'], 0)
        stay = next(iter(self.store.crate.history.values()))
        self.assertEqual(stay['dropped_on'], day('2026-10-15'))
        self.assertEqual(stay['dropped_precision'], 'unknown')
        self.assertEqual(self.store.intents, {})

    def test_baseline_closes_stuck_stays_unknown_only_after_a_title_check(self):
        # A dropped-country offer can remain open from before list monitoring.
        self.run_day('2026-10-10T20:00:00', dry_run=False)
        self.store.snapshots.clear()
        self.api.ids, self.api.results = [], {}
        self.api.calls.clear()
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        stay = next(iter(self.store.crate.history.values()))
        self.assertEqual(stay['dropped_on'], day('2026-10-13'))
        self.assertEqual(stay['dropped_precision'], 'unknown')
        self.assertEqual(sum(path.endswith('/watch/providers') for path, _ in self.api.calls), 1)
        self.api.ids, self.api.results = [42], {'US': {'flatrate': [{'provider_id': 8}]}}
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        stays = list(self.store.crate.history.values())
        self.assertEqual(len(stays), 2)
        self.assertEqual(stays[1]['appeared_precision'], 'exact')

    def test_flow_defaults_to_preview_and_has_one_concurrent_run(self):
        from windmill_preview import load_flow
        flow = load_flow('f/tmdb_api/read_daily_provider_lists')
        self.assertEqual(flow['value']['concurrent_limit'], 1)
        self.assertTrue(flow['schema']['properties']['dry_run']['default'])
        module = flow['value']['modules'][0]
        self.assertEqual(module['value']['path'], 'f/tmdb_api/daily_provider_lists')
        self.assertEqual(module['value']['input_transforms']['dry_run']['expr'], 'flow_input.dry_run')

    def test_flow_report_surfaces_incomplete_lists_as_failed_run(self):
        from windmill_preview import load_flow
        flow = load_flow('f/tmdb_api/read_daily_provider_lists')
        namespace = {}
        exec(flow['value']['modules'][-1]['value']['content'], namespace)
        with self.assertRaisesRegex(RuntimeError, '1 daily lists failed'):
            namespace['main']({'lists_failed': 1, 'lists': [{'key': 'US:show:8', 'error': 'IncompleteList'}]})
        report = {'lists_failed': 0, 'lists_completed': 1}
        self.assertEqual(namespace['main'](report), report)

    def test_flow_report_rejects_a_run_skipped_for_a_held_lease(self):
        from windmill_preview import load_flow
        flow = load_flow('f/tmdb_api/read_daily_provider_lists')
        namespace = {}
        exec(flow['value']['modules'][-1]['value']['content'], namespace)
        with self.assertRaisesRegex(RuntimeError, 'run skipped'):
            namespace['main'](dict(run_skipped=True, lists_failed=0, lists_completed=0, lists=[]))

    def test_authentication_failure_stops_the_public_job_after_one_request(self):
        for status in (401, 403):
            with self.subTest(status=status):
                session = Mock()
                session.get.return_value = Mock(status_code=status)
                with patch('wmill.get_variable', return_value='fixture-key'), \
                     patch('requests.Session', return_value=session), \
                     patch.object(job, 'create_list_storage', return_value=self.store):
                    with self.assertRaisesRegex(job.TMDBReadError, f'TMDB HTTP {status}'):
                        job.main(countries=['US'], service_ids=list(range(1, 26)))
                self.assertEqual(session.get.call_count, 1)

    def test_authentication_failure_stops_queued_title_checks(self):
        clock = [0.0]
        def sleep(seconds):
            clock[0] += seconds
        session = Mock()
        def response(url, **kwargs):
            if '/discover/' in url:
                return Mock(status_code=200, json=lambda: dict(page=1, total_pages=1, total_results=200,
                            results=[{'id': i} for i in range(1, 201)]))
            return Mock(status_code=401)
        session.get.side_effect = response
        with patch('wmill.get_variable', return_value='fixture-key'), \
             patch('requests.Session', return_value=session), \
             patch.object(job, 'create_list_storage', return_value=self.store), \
             patch.object(job.time, 'monotonic', side_effect=lambda: clock[0]), \
             patch.object(job.time, 'sleep', side_effect=sleep):
            with self.assertRaisesRegex(job.TMDBReadError, 'TMDB HTTP 401'):
                job.main(countries=['US'], service_ids=[8])
        # One discover request plus at most the six already in-flight checks.
        self.assertLessEqual(session.get.call_count, 7)
        self.assertEqual(self.store.snapshots, {})

    def test_twenty_consecutive_tmdb_list_failures_stop_the_run(self):
        def failed(path, **params):
            self.api.calls.append((path, params))
            raise job.TMDBReadError('TMDB retry budget exhausted')
        self.api.get = failed
        with self.assertRaisesRegex(job.TMDBReadError, '20 consecutive'):
            job.run_daily_lists(self.api, self.store, countries=['US'], service_ids=list(range(1, 26)),
                                media_types=['show'],  now=datetime(2026, 10, 14, 20))
        self.assertEqual(len(self.api.calls), 20)
        self.assertEqual(self.store.snapshots, {})

    def test_http_client_bypasses_cache_and_honors_429_for_the_whole_job(self):
        clock = [0.0]
        def sleep(seconds):
            clock[0] += seconds
        responses = [Mock(status_code=429, headers={'Retry-After': '120'}),
                     Mock(status_code=200, json=lambda: {'results': [{'iso_3166_1': 'US'}]}),
                     Mock(status_code=200, json=lambda: {'page': 1, 'total_pages': 0, 'total_results': 0, 'results': []}),
                     Mock(status_code=200, json=lambda: {'page': 1, 'total_pages': 0, 'total_results': 0, 'results': []})]
        session = Mock()
        session.get.side_effect = responses
        with patch('wmill.get_variable', return_value='test-key'), patch('requests.Session', return_value=session), \
             patch.object(job, 'create_list_storage', return_value=self.store), \
             patch.object(job.time, 'monotonic', side_effect=lambda: clock[0]), patch.object(job.time, 'sleep', side_effect=sleep):
            report = job.main(service_ids=[8])
        self.assertGreaterEqual(clock[0], 120)
        self.assertEqual(report['requests']['requests'], 4)
        self.assertEqual(report['requests']['refused'], 1)
        query_params = [call.kwargs['params'] for call in session.get.call_args_list]
        self.assertEqual(len({params['cb'] for params in query_params}), 4)

    def test_offer_type_switch_while_still_listed_cannot_get_a_fabricated_exact_day(self):
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        self.api.ids = []  # A missing discover entry triggers the per-title check.
        self.api.results = {'US': {'ads': [{'provider_id': 8}]}}
        self.run_day('2026-10-15T20:00:00', dry_run=False)
        rows = list(self.store.crate.history.values())
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]['dropped_precision'], 'unknown')
        self.assertEqual(rows[1]['appeared_precision'], 'unknown')

    def test_daily_arrivals_reuse_the_writers_existing_original_premiere_rule(self):
        self.api.ids = []
        self.run_day('2026-10-13T20:00:00', dry_run=False)
        self.store.metadata[42] = {'networks': [{'id': 213}], 'first_air_date': '2026-10-12'}
        self.api.ids = [42]
        self.run_day('2026-10-14T20:00:00', dry_run=False)
        stay = next(iter(self.store.crate.history.values()))
        self.assertEqual(stay['appeared_on'], day('2026-10-12'))
        self.assertEqual(stay['appeared_source'], 'premiere')


class ListEvidenceWriterTests(unittest.TestCase):
    def test_baseline_never_substitutes_a_premiere_day(self):
        from f.sync.availability_history import HistoryTitle, ListRead, OfferKey
        from f.tmdb_api.provider_evidence import capture_provider_check
        crate = HistoryCrate()
        payload = {'results': {'US': {'flatrate': [{'provider_id': 8}]}}}
        proof = capture_provider_check({'id': 42, 'watch/providers': payload}, 42,
                                       datetime(2026, 10, 14, 20), bypass_cache=True)
        key = OfferKey(42, 'show', 'US', 8, 'flatrate')
        details = {'watch_providers': payload, 'watch_providers_check': proof,
                   'networks': [{'id': 213}], 'first_air_date': '2026-10-14'}
        title = HistoryTitle(42, details, {key: key._asdict()}, {}, [], [],
                             ListRead('US', 8, proof['checked_at']))
        publish_history(crate, 'show', [title], lambda: None)
        self.assertEqual(next(iter(crate.history.values()))['appeared_precision'], 'unknown')


if __name__ == '__main__':
    unittest.main()
