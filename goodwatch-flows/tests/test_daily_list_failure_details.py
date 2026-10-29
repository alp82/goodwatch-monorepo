"""Bounded diagnostics at the daily reread, baseline and refresh boundaries."""
import json
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.tmdb_api import daily_provider_lists as job, daily_list_ramp as ramp
from test_daily_provider_lists import Storage, TMDB


class FailureDetailsTests(unittest.TestCase):
    def test_reread_and_baseline_keep_the_same_runtime_details_in_results_and_mongo(self):
        def broken_history(*args, **kwargs):
            secret_local = 'LOCAL_VALUE_MUST_NEVER_APPEAR'
            raise RuntimeError('History publication failed; checkpoint retained for retry')

        now = datetime(2026, 10, 29, 14)
        store = Storage()
        store.dry_run = False
        with patch.object(job, 'read_daily_list', side_effect=broken_history):
            result = job.run_daily_lists(TMDB(), store, countries=['IT'], service_ids=[531],
                                         media_types=['movie'], now=now)
        failed = result['lists'][0]
        self.assertEqual((result['lists_failed'], result['lists_completed']), (1, 0))
        self.assertEqual(failed['error'], 'RuntimeError')
        self.assertEqual(failed['message'], 'History publication failed; checkpoint retained for retry')
        self.assertIn('broken_history', failed['traceback'])
        self.assertNotIn('secret_local', failed['traceback'])
        self.assertNotIn('LOCAL_VALUE_MUST_NEVER_APPEAR', json.dumps(failed))
        pending = store.db.tmdb_daily_provider_list_pending.find_one({'_id': 'IT:movie:531'})
        for field in ('error', 'message', 'traceback'):
            self.assertEqual(pending['last_failure'][field], failed[field])
        try:
            broken_history()
        except RuntimeError as error:
            baseline = dict(lists_failed=0, lists=[])
            ramp.record_baseline_failure(TMDB(), store, baseline, 'LU', 'movie', 119,
                                         error, lambda: now)
        failed = baseline['lists'][0]
        pending = store.db.tmdb_daily_provider_list_pending.find_one({'_id': 'LU:movie:119'})
        self.assertEqual(failed['message'], 'History publication failed; checkpoint retained for retry')
        self.assertIn('broken_history', pending['last_failure']['traceback'])
        self.assertEqual(pending['last_failure']['message'], failed['message'])

    def test_credentials_headers_urls_and_payloads_are_not_copied(self):
        samples = [
            ('password=do-not-copy failure', 'do-not-copy'),
            ('api_key: "do-not-copy" failure', 'do-not-copy'),
            ('api key: "do-not-copy" failure', 'do-not-copy'),
            ('CRATE_PASS=do-not-copy failure', 'do-not-copy'),
            ('access_token=do-not-copy failure', 'do-not-copy'),
            ('Authorization: Bearer do-not-copy', 'do-not-copy'),
            ('Cookie: session=do-not-copy', 'do-not-copy'),
            ('Bearer do-not-copy', 'do-not-copy'),
            ('failed https://host.invalid/path/do-not-copy?api_key=other', 'do-not-copy'),
            ('failed mongodb://user:do-not-copy@host/database', 'do-not-copy'),
            ('failed {"payload":"do-not-copy"}', 'do-not-copy'),
            ('failed response=do-not-copy', 'do-not-copy'),
            ("failed ('do-not-copy', 'payload')", 'do-not-copy'),
            ('failed SELECT do-not-copy FROM responses', 'do-not-copy'),
            ('failed sk-1234567890abcdefghijklmnopqrstuvwxyz', 'sk-1234567890abcdefghijklmnopqrstuvwxyz'),
            ('failed sk-abcdefghijklmnopqrstuvwxyz', 'sk-abcdefghijklmnopqrstuvwxyz'),
        ]
        for message, secret in samples:
            with self.subTest(message=message):
                failed = job.list_failure('IT', 'movie', 531, RuntimeError(message))
                self.assertNotIn(secret, json.dumps(failed))
                self.assertTrue(failed['traceback'])

    def test_unicode_message_and_deep_trace_are_bounded_without_source_or_locals(self):
        def recurse(depth):
            if depth:
                return recurse(depth - 1)
            raise RuntimeError('雪' * 5000)
        try:
            recurse(100)
        except RuntimeError as error:
            failed = job.list_failure('IT', 'movie', 531, error)
        self.assertLessEqual(len(failed['message'].encode('utf-8')), 1024)
        self.assertLessEqual(len(failed['traceback'].encode('utf-8')), 4096)
        self.assertTrue(failed['message'])
        self.assertIn('recurse', failed['traceback'])
        self.assertNotIn('raise RuntimeError', failed['traceback'])
        self.assertNotIn(str(Path(__file__).parent), failed['traceback'])
        json.dumps(failed)

    def test_known_reason_and_attempt_diagnostics_stay_safe_and_bounded(self):
        error = job.IncompleteList('Expected 2205 distinct titles, read 2203 {"token":"PRIVATE_PAYLOAD"}')
        error.endpoint = '/discover/movie?api_key=PRIVATE_QUERY'
        error.read_attempts = [dict(sort='title.asc', vote_min=0, vote_max=None,
            reported_total=2205, returned_total=2203, duplicate_count=0,
            metadata_values=[(2205, 111)], rejection='needs_independent_agreement',
            response={'private': 'PRIVATE_PAYLOAD'}) for _ in range(100)]
        failed = job.list_failure('IT', 'movie', 531, error)
        self.assertEqual(failed['reason'], failed['message'])
        self.assertIn('Expected 2205 distinct titles, read 2203', failed['reason'])
        self.assertEqual(failed['endpoint'], '/discover/movie')
        self.assertNotIn('PRIVATE', json.dumps(failed))
        self.assertLessEqual(len(failed['read_attempts']), 8)
        self.assertLessEqual(len(json.dumps(failed['read_attempts']).encode('utf-8')), 2048)
        self.assertEqual(failed['read_attempts'][0]['metadata_values'], [[2205, 111]])

    def test_broken_exception_string_cannot_mask_the_original_error(self):
        class Broken(RuntimeError):
            def __str__(self):
                raise ValueError('broken string')
        failed = job.list_failure('IT', 'movie', 531, Broken())
        self.assertEqual(failed['error'], 'Broken')
        self.assertEqual(failed['message'], '[exception message unavailable]')


if __name__ == '__main__':
    unittest.main()
