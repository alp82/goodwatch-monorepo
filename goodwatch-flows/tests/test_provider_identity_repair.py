"""Actual replica-set tests: PROVIDER_REPAIR_TEST_URI must identify an isolated DB server."""
import os
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

from bson import ObjectId, Binary, Decimal128
from pymongo import MongoClient
from pymongo.errors import OperationFailure, DuplicateKeyError

sys.path.insert(0, str(Path(__file__).parents[1] / 'scripts'))
import provider_identity_repair as repair
from f.tmdb_web import country_state
from test_streaming_publication import load_copy, availability


@unittest.skipUnless(os.environ.get('PROVIDER_REPAIR_TEST_URI'), 'requires isolated replica-set MongoDB')
class RepairIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = MongoClient(os.environ['PROVIDER_REPAIR_TEST_URI'])
        self.db = self.client['repair_test_' + uuid4().hex]
        for media in repair.MEDIA:
            self.db.create_collection(f'tmdb_{media}_providers')
            country_state.ensure_indexes(self.db[f'tmdb_{media}_providers'])
        self.col = self.db.tmdb_movie_providers
        self.output = TemporaryDirectory()
        self.published = [availability(country='AU', media_tmdb_id=42, media_type='movie', stream_url='old')]
        self.read = lambda media, identity: self.published

    def tearDown(self):
        self.client.drop_database(self.db.name)
        self.client.close()
        self.output.cleanup()

    def duplicates(self, media='movie'):
        col = self.db[f'tmdb_{media}_providers']
        now = datetime.utcnow() - timedelta(days=100)
        col.insert_many([
            {'_id': ObjectId(), 'tmdb_id': 42, 'tmdb_watch_url': f'https://www.themoviedb.org/{media}/42-old/watch?locale=AU',
             'streaming_links': [{'provider_name': 'Old'}], 'updated_at': now,
             'opaque': {'binary': Binary(b'\x00\xff'), 'decimal': Decimal128('12.50')}},
            {'_id': ObjectId(), 'tmdb_id': 42, 'tmdb_watch_url': f'https://www.themoviedb.org/{media}/42-new/watch?locale=AU',
             'country_code': 'AU', 'country_identity_ready': True, 'streaming_links': [], 'updated_at': now + timedelta(days=1)}])
        return repair.plan_title(self.db, media, 42)

    def test_duplicate_conflicting_snapshots_archive_transaction_resume_and_rollback(self):
        plan = self.duplicates()
        self.assertTrue(country_state.identity_map(plan['documents'], 'movie')[1])
        repair.begin_maintenance(self.db)
        receipt = repair.apply_title(self.db, plan, self.output.name, self.read)
        self.assertEqual(repair.apply_title(self.db, plan, self.output.name, self.read), receipt)
        current = list(self.col.find())
        self.assertEqual(len(current), 1)
        self.assertFalse(country_state.identity_map(current, 'movie')[1])
        self.assertEqual(current[0]['streaming_links'], [])
        self.assertTrue(current[0]['identity_repair_pending'])
        archive = repair.json_util.loads(Path(receipt['archive_path']).read_bytes())
        self.assertEqual(archive['plan']['documents'], plan['documents'])
        self.assertEqual(archive['published'], self.published)
        repair.rollback_title(self.db, plan['id'], self.read)
        self.assertEqual(list(self.col.find().sort('_id', 1)), plan['documents'])
        repair.rollback_title(self.db, plan['id'], self.read)
        with self.assertRaises(RuntimeError):
            repair.apply_title(self.db, plan, self.output.name, self.read)

    def test_changed_plan_and_active_leases_rejected(self):
        plan = self.duplicates()
        self.col.update_one({'_id': plan['documents'][0]['_id']}, {'$set': {'lease_expires_at': datetime.utcnow() + timedelta(minutes=1)}})
        with self.assertRaisesRegex(RuntimeError, 'source leases'):
            repair.begin_maintenance(self.db)
        self.col.update_many({}, {'$unset': {'lease_expires_at': ''}}, bypass_document_validation=True)
        self.col.update_one({'_id': plan['documents'][0]['_id']}, {'$set': {'streaming_links': []}}, bypass_document_validation=True)
        with self.assertRaisesRegex(RuntimeError, 'changed since plan'):
            repair.apply_title(self.db, plan, self.output.name, self.read)
        self.assertEqual(self.col.count_documents({}), 2)

    def test_transaction_failure_rolls_back_deletion_and_restart_succeeds(self):
        plan = self.duplicates()
        repair.begin_maintenance(self.db)
        self.db.create_collection('provider_identity_repairs', validator=repair.FREEZE)
        with self.assertRaises(OperationFailure):
            repair.apply_title(self.db, plan, self.output.name, self.read)
        self.assertEqual(list(self.col.find().sort('_id', 1)), plan['documents'])
        self.db.command('collMod', 'provider_identity_repairs', validator={})
        repair.apply_title(self.db, plan, self.output.name, self.read)
        self.assertEqual(self.col.count_documents({}), 1)

    def test_freeze_blocks_old_writers_and_publication_then_final_invariant(self):
        plan = self.duplicates()
        repair.begin_maintenance(self.db)
        with self.assertRaises(OperationFailure):
            self.col.insert_one({'tmdb_id': 42})
        with self.assertRaises(OperationFailure):
            self.col.update_one({}, {'$set': {'streaming_links': []}})
        lease = load_copy(self.db).__globals__['publication_lease']
        with self.assertRaisesRegex(RuntimeError, 'maintenance'):
            with lease(self.db, 'movie', 42):
                self.fail('must not acquire')
        repair.apply_title(self.db, plan, self.output.name, self.read)
        repair.finish_maintenance(self.db, final=True)
        country_state.ensure_indexes(self.col)
        for row in [{'tmdb_id': 42}, {'tmdb_id': True, 'country_code': 'AU', 'country_identity_ready': True, 'tmdb_watch_url': 'x'},
                    {'tmdb_id': 45, 'country_code': 'AU\n', 'country_identity_ready': True, 'tmdb_watch_url': 'x'},
                    {'tmdb_id': 44, 'country_code': 'au', 'country_identity_ready': True, 'tmdb_watch_url': 'x'}]:
            with self.assertRaises(OperationFailure):
                self.col.insert_one(row)
        with self.assertRaises(DuplicateKeyError):
            self.col.insert_one({'tmdb_id': 42, 'country_code': 'AU', 'country_identity_ready': True, 'tmdb_watch_url': 'x'})

    def test_existing_publisher_loses_permission_when_maintenance_starts(self):
        lease = load_copy(self.db).__globals__['publication_lease']
        with self.assertRaisesRegex(RuntimeError, 'maintenance'):
            with lease(self.db, 'movie', 42) as check_owned:
                with self.assertRaisesRegex(RuntimeError, 'publication leases'):
                    repair.begin_maintenance(self.db)
                check_owned()
        self.assertEqual(self.db.streaming_publication_leases.count_documents({}), 0)
        repair.assert_maintenance(self.db)

    def test_changed_slug_concurrent_initializers_and_media_overlap(self):
        # Final constraint makes even concurrent insertion through real writers safe.
        repair.begin_maintenance(self.db)
        repair.finish_maintenance(self.db, final=True)
        def initialize(media, slug):
            return country_state.initialize_countries(self.db[f'tmdb_{media}_providers'], 42,
                {'AU': {'link': f'https://www.themoviedb.org/{media}/42-{slug}/watch?locale=AU'}}, media)
        with ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda i: initialize('movie', str(i)), range(16)))
        initialize('movie', 'latest')
        initialize('tv', 'different-title')
        self.assertEqual(self.col.count_documents({}), 1)
        self.assertIn('-latest/', self.col.find_one()['tmdb_watch_url'])
        self.assertEqual(self.db.tmdb_tv_providers.count_documents({}), 1)

    def test_pending_failure_freezes_api_and_successful_empty_clears_marker(self):
        plan = self.duplicates()
        repair.begin_maintenance(self.db)
        repair.apply_title(self.db, plan, self.output.name, self.read)
        repair.finish_maintenance(self.db)
        reconcile = load_copy(self.db).__globals__['reconcile_availability']
        details = {'updated_at': datetime.utcnow(), 'watch_providers': {'results': {'AU': {'flatrate': [], 'link': 'new'}}}}
        def snapshot():
            return reconcile(42, 'movie', self.published, details, list(self.col.find()), {})
        rows, verified, api = snapshot()
        self.assertFalse(verified)
        self.assertFalse(api)
        self.assertEqual(next(iter(rows.values()))['stream_url'], 'old')
        document = country_state.claim(self.db, self.col, self.col.find_one()['_id'])
        self.assertIsNotNone(document)
        country_state.save_failure(self.db, self.col, document, '502')
        self.assertTrue(self.col.find_one()['identity_repair_pending'])
        self.assertEqual(next(iter(snapshot()[0].values()))['stream_url'], 'old')
        self.col.update_one({}, {'$set': {'next_fetch_at': datetime.utcnow()}})
        document = country_state.claim(self.db, self.col, self.col.find_one()['_id'])
        self.assertTrue(country_state.save_success(self.col, document, []))
        self.assertNotIn('identity_repair_pending', self.col.find_one())
        self.assertEqual(snapshot()[0], {})

    def test_partial_finish_restart_preserves_original_validator_and_archive_corruption_blocks_rollback(self):
        plan = self.duplicates()
        repair.begin_maintenance(self.db)
        receipt = repair.apply_title(self.db, plan, self.output.name, self.read)
        # Simulate process loss after first collection's validator reopened.
        self.db.command('collMod', self.col.name, validator={})
        repair.finish_maintenance(self.db)
        self.assertFalse(self.db.provider_identity_maintenance.find_one()['active'])
        self.assertEqual(self.col.options().get('validator', {}), {})
        repair.begin_maintenance(self.db)
        Path(receipt['archive_path']).write_text('{}')
        with self.assertRaisesRegex(RuntimeError, 'Archive hash mismatch'):
            repair.rollback_title(self.db, plan['id'], self.read)
        self.assertEqual(self.col.count_documents({}), 1)

    def test_bulk_slug_refresh_normalizes_legacy_singleton_in_unordered_batch(self):
        from f.tmdb_web.tmdb_init_providers.main import initialize_batch
        self.col.insert_one({'tmdb_id': 42, 'tmdb_watch_url': 'https://www.themoviedb.org/movie/42-old/watch?locale=AU'})
        result = initialize_batch(self.col, [{'tmdb_id': 42, 'watch_providers': {'results': {
            'AU': {'link': 'https://www.themoviedb.org/movie/42-new/watch?locale=AU'}}}}], 'movie')
        self.assertFalse(result['errors'])
        row = self.col.find_one()
        self.assertEqual(self.col.count_documents({}), 1)
        self.assertTrue(row['country_identity_ready'])
        self.assertIn('-new/', row['tmdb_watch_url'])

    def test_invalid_country_rejected_and_backoff_preserved(self):
        plan = self.duplicates()
        deadline = datetime.utcnow() + timedelta(hours=2)
        self.col.update_one({'_id': plan['documents'][0]['_id']}, {'$set': {'next_fetch_at': deadline, 'consecutive_failures': 2}})
        plan = repair.plan_title(self.db, 'movie', 42)
        repair.begin_maintenance(self.db)
        repair.apply_title(self.db, plan, self.output.name, self.read)
        self.assertEqual(self.col.find_one()['next_fetch_at'], plan['documents'][0]['next_fetch_at'])
        self.assertEqual(self.col.find_one()['consecutive_failures'], 2)
        repair.finish_maintenance(self.db)
        self.assertIsNone(country_state.claim(self.db, self.col, self.col.find_one()['_id']))
        self.col.update_one({}, {'$set': {'country_code': 'GB'}})
        with self.assertRaises(ValueError):
            repair.plan_title(self.db, 'movie', 42)

    def test_quarantine_is_lossless_idempotent_and_freezes_api_publication(self):
        from test_streaming_publication import Crate
        original = {'_id': ObjectId(), 'tmdb_id': 42, 'country_code': 'AU',
                    'tmdb_watch_url': 'https://www.themoviedb.org/movie/99-other/watch?locale=AU',
                    'streaming_links': [], 'opaque': Binary(b'\x00\xff')}
        self.col.insert_one(original)
        original = self.col.find_one({'_id': original['_id']})
        self.db.tmdb_movie_details.insert_one({'tmdb_id': 42, 'updated_at': datetime.utcnow(),
                                               'watch_providers': {'results': {'AU': {}}}})
        repair.begin_maintenance(self.db)
        receipt = repair.quarantine_title(self.db, 'movie', 42, self.output.name, self.read)
        self.assertEqual(repair.quarantine_title(self.db, 'movie', 42, self.output.name, self.read), receipt)
        self.assertEqual(self.col.count_documents({}), 0)
        self.assertEqual(self.db.provider_identity_quarantine.find_one()['original'], original)
        archive = repair.json_util.loads(Path(receipt['archive_path']).read_bytes())
        self.assertEqual(archive['documents'], [original])
        self.assertEqual(archive['published'], self.published)
        repair.finish_maintenance(self.db, final=True)
        with self.assertRaises(OperationFailure):
            self.col.insert_one(original)
        with self.assertRaisesRegex(ValueError, 'Quarantined'):
            country_state.initialize_countries(self.col, 42, {
                'AU': {'link': 'https://www.themoviedb.org/movie/42/watch?locale=AU'}}, 'movie')
        from f.tmdb_web.tmdb_init_providers.main import initialize_batch
        initialized = initialize_batch(self.col, [{'tmdb_id': 42, 'watch_providers': {'results': {
            'AU': {'link': 'https://www.themoviedb.org/movie/42/watch?locale=AU'}}}}], 'movie')
        self.assertTrue(initialized['errors'])
        self.assertEqual(self.col.count_documents({}), 0)
        connector = Crate(self.published)
        result = load_copy(self.db)(connector, {'tmdb_id': {'$in': [42]}}, 'movie', recent_only=False)
        self.assertEqual(connector.rows, self.published)
        self.assertEqual(connector.writes, [])
        self.assertEqual(result['publication']['status'], 'partial_success')
        self.assertEqual(result['publication']['titles']['42']['provider_state'], 'quarantined')
        report = repair.verify(self.db)['movie']
        self.assertEqual(report['quarantined_unresolved_titles'], 1)
        self.assertEqual(report['quarantined_documents'], 1)

    def test_repair_lane_preserves_backoff_and_ordinary_fairness(self):
        now = datetime.utcnow()
        ordinary, pending = [], []
        for index in range(12):
            row = {'tmdb_id': index + 1, 'country_code': 'AU', 'country_identity_ready': True,
                   'tmdb_watch_url': f'https://www.themoviedb.org/movie/{index + 1}/watch?locale=AU',
                   'next_fetch_at': now - timedelta(days=10 if index < 6 else 20)}
            if index >= 6:
                row['identity_repair_pending'] = 'repair'
            identity = self.col.insert_one(row).inserted_id
            (ordinary if index < 6 else pending).append(str(identity))
        selected = country_state.select_country_ids(self.col, now)
        self.assertEqual(len(selected), 5)
        self.assertEqual(len(set(selected) & set(pending)), 2)
        self.assertEqual(len(set(selected) & set(ordinary)), 3)
        self.col.update_many({'identity_repair_pending': 'repair'}, {'$set': {'next_fetch_at': now + timedelta(hours=1)}})
        self.assertFalse(set(country_state.select_country_ids(self.col, now)) & set(pending))
        self.col.update_many({'identity_repair_pending': 'repair'}, {'$set': {'next_fetch_at': now, 'lease_expires_at': now + timedelta(minutes=1)}})
        self.assertFalse(set(country_state.select_country_ids(self.col, now)) & set(pending))

    def test_monitor_counts_pending_backoff_and_quarantines_independently(self):
        from f.monitoring.backlog_collection import collect_identity_repairs
        now = datetime.utcnow()
        self.col.insert_one({'tmdb_id': 42, 'identity_repair_pending': 'repair',
                             'next_fetch_at': now + timedelta(hours=1), 'consecutive_failures': 2})
        self.db.tmdb_streaming_upstream.insert_one({'_id': 'tmdb_watch', 'blocked_until': now + timedelta(hours=1)})
        self.db.provider_identity_unresolved.insert_one({'_id': 'movie:99', 'media': 'movie',
            'tmdb_id': 99, 'status': 'unresolved', 'source_document_count': 3})
        result = collect_identity_repairs(self.db, now)
        self.assertTrue(result['complete'])
        self.assertEqual(result['partitions'][0]['pending_count'], 1)
        self.assertEqual(result['partitions'][0]['pending_backoff_count'], 1)
        self.assertEqual(result['partitions'][0]['pending_failed_count'], 1)
        self.assertEqual(result['unresolved_quarantines'][0]['tmdb_id'], 99)

    def test_server_verifier_matches_parser_for_variants_and_malformed_bson(self):
        self.col.drop_index('validated_country_identity')
        base = {'tmdb_id': 42, 'country_code': 'AU', 'country_identity_ready': True,
                'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=AU'}
        variants = [
            {}, {'tmdb_watch_url': 'https://www.themoviedb.org/movie/42-élan/watch?locale=AU'},
            {'tmdb_watch_url': 'HTTPS://WWW.THEMOVIEDB.ORG/movie/42/watch?locale=AU'},
            {'tmdb_watch_url': 'https://themoviedb.org:443/movie/42/watch/?locale=AU'},
            {'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=%41%55'},
            {'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?x=y&locale=AU#fragment'},
            {'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=AU\n'},
            {'tmdb_watch_url': 'https://www.themoviedb.org/movie/42-name?query/watch?locale=AU'},
            {'tmdb_watch_url': 'https://www.themoviedb.org/movie/42-name#fragment/watch?locale=AU'},
            {'tmdb_watch_url': 'https://www.themoviedb.org:444/movie/42/watch?locale=AU'},
            {'tmdb_watch_url': 'https://www.themoviedb.org/tv/42/watch?locale=AU'},
            {'tmdb_id': 43}, {'tmdb_id': True}, {'tmdb_id': 42.0}, {'tmdb_id': '42'},
            {'tmdb_id': None}, {'country_code': 'GB'}, {'country_code': 'AU\n'},
            {'country_code': 'au'}, {'country_code': None}, {'country_code': ['AU']},
            {'tmdb_watch_url': []}, {'tmdb_watch_url': None}, {'country_identity_ready': False},
        ]
        documents = [{**base, **variant} for variant in variants]
        self.col.insert_many(documents)
        invalid = 0
        for row in documents:
            try:
                country = country_state.country_from_url(row.get('tmdb_watch_url'), row.get('tmdb_id'), 'movie')
                if country != row.get('country_code'):
                    raise ValueError('Country mismatch')
            except (ValueError, TypeError):
                invalid += 1
        report = repair.verify(self.db)['movie']
        self.assertEqual(report['documents'], len(documents))
        self.assertEqual(report['invalid'], invalid)
        self.assertEqual(report['unready'], 1)
        self.assertGreater(report['duplicates'], 0)


if __name__ == '__main__':
    unittest.main()
