"""Bounded diagnostics at the daily reread, baseline and refresh boundaries."""
import json
import sys
import unittest
import io
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.tmdb_api import daily_provider_lists as job, daily_list_ramp as ramp
from test_daily_provider_lists import Storage, TMDB


class FailureDetailsTests(unittest.TestCase):
    def test_explicit_cause_and_implicit_context_keep_sanitized_inner_diagnostics(self):
        for explicit in (True, False):
            try:
                try:
                    raise ValueError('Inner history failure password=PRIVATE_CAUSE')
                except ValueError as inner:
                    if explicit:
                        raise RuntimeError('Outer history failure') from inner
                    raise RuntimeError('Outer history failure')
            except RuntimeError as error:
                failed = job.list_failure('IT', 'movie', 119, error)
            self.assertEqual(failed['causes'][0]['error'], 'ValueError')
            self.assertIn('Inner history failure', failed['causes'][0]['message'])
            self.assertNotIn('PRIVATE_CAUSE', json.dumps(failed))
            self.assertIn('ValueError', failed['traceback'])
            self.assertLessEqual(len(failed['traceback'].encode()), 4096)

    def test_exception_chain_depth_cycles_and_suppressed_context_are_bounded(self):
        root = RuntimeError('outer')
        current = root
        for _ in range(20):
            current.__cause__ = ValueError('inner ' + '雪' * 1000)
            current = current.__cause__
        current.__cause__ = root
        details = job.failure_details(root)
        self.assertEqual(len(details['causes']), 3)
        self.assertTrue(all(len(cause['message'].encode()) <= 512 for cause in details['causes']))
        root.__cause__ = root
        self.assertEqual(job.failure_details(root)['causes'], [])
        root.__cause__ = None
        root.__context__ = ValueError('suppressed')
        root.__suppress_context__ = True
        self.assertEqual(job.failure_details(root)['causes'], [])

    def test_validation_passed_is_not_a_password_and_redaction_is_idempotent(self):
        self.assertEqual(job._failure_message('Validation passed 3 titles'), 'Validation passed 3 titles')
        for text in ('password=PRIVATE', 'passwd=PRIVATE', 'CRATE_PASS=PRIVATE',
                     'failure {"token":"PRIVATE"}'):
            once = job._failure_message(text)
            self.assertNotIn('PRIVATE', once)
            self.assertEqual(job._failure_message(once), once)

    def test_result_samples_are_shared_by_rereads_and_baselines_without_losing_pending_details(self):
        now = datetime(2026, 10, 29, 14)
        store = Storage()
        store.dry_run = False
        def fail(*args, **kwargs):
            error = RuntimeError('History failure ' + 'diagnostic ' * 200)
            error.read_attempts = [dict(reported_total=10, returned_total=9)]
            raise error
        with redirect_stdout(io.StringIO()), patch.object(job, 'read_daily_list', side_effect=fail):
            report = job.run_daily_lists(TMDB(), store, countries=['IT'],
                                         service_ids=range(1, 23), media_types=['movie'], now=now)
            try:
                fail()
            except RuntimeError as error:
                ramp.record_baseline_failure(TMDB(), store, report, 'LU', 'movie', 119,
                                             error, lambda: now)
        self.assertEqual(report['lists_failed'], 23)
        self.assertEqual(len(report['lists']), 23)
        self.assertEqual(sum('traceback' in failure for failure in report['lists']), 20)
        for failure in report['lists'][20:]:
            self.assertNotIn('causes', failure)
            self.assertNotIn('read_attempts', failure)
            self.assertLessEqual(len(failure['message'].encode()), 256)
            self.assertEqual(failure['error'], 'RuntimeError')
            self.assertEqual(failure['consecutive_failure_days'], 1)
        pending = store.db.tmdb_daily_provider_list_pending.find_one({'_id': 'LU:movie:119'})
        self.assertTrue(pending['last_failure']['traceback'])
        self.assertGreater(len(pending['last_failure']['message'].encode()), 256)

    def test_full_bad_day_result_stays_bounded(self):
        report = dict(lists_failed=0, lists=[])
        for index in range(4170):
            report['lists_failed'] += 1
            job.append_list_failure(report, dict(key=f'IT:movie:{index}', error='RuntimeError',
                message='x ' * 512, traceback='x' * 4096, causes=[], consecutive_failure_days=1))
        self.assertEqual(len(report['lists']), 4170)
        self.assertEqual(sum('traceback' in failure for failure in report['lists']), 20)
        self.assertLess(len(json.dumps(report).encode()), 2_000_000)

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
