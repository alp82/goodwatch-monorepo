import socket
"""Shared upstream gate regressions; no real network or database writes."""
import sys
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / 'windmill'))
from f.tmdb_web import country_state as state
from f.tmdb_web.tmdb_crawl_providers import fetch

NOW = datetime(2026, 10, 17, 12)


class UpstreamTests(unittest.TestCase):
    def setUp(self):
        guard = patch.object(socket.socket, "connect", side_effect=AssertionError("Network forbidden in tests"))
        guard.start()
        self.addCleanup(guard.stop)
        self.db = mongomock.MongoClient().test

    def test_classification_and_honest_identity(self):
        for code, text, reason in [
            (403, '<title>Just a moment...</title>', 'challenge'),
            (403, '<title>Access denied</title>', 'forbidden'),
            (429, '', 'rate_limited'), (503, '', 'server_error'),
            (200, '<title>Please Wait...</title>', 'challenge'),
        ]:
            with self.subTest(code=code, reason=reason):
                response = SimpleNamespace(status_code=code, text=text, headers={})
                with patch.object(fetch.httpx.Client, 'get', return_value=response) as http:
                    result = fetch.crawl_tmdb_watch_page({'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=US', 'country_code': 'US'}, request=fetch.httpx.Client.get)
                self.assertEqual(result.block_reason, reason)
                self.assertTrue(http.call_args.kwargs['headers']['User-Agent'].startswith('GoodWatchBot/'))

    def test_backoff_is_shared_across_fresh_titles_and_resets_only_on_success(self):
        now = NOW
        for minutes in [30, 60, 120, 240, 480, 960, 1440, 1440]:
            permit = state.acquire_upstream(self.db, now)
            self.assertIsNotNone(permit)
            saved = state.block_upstream(self.db, permit, 'challenge', now=now)
            self.assertEqual(saved['blocked_until'], now + timedelta(minutes=minutes))
            self.assertEqual(saved['blocked_since'], NOW)
            self.assertIsNone(state.acquire_upstream(self.db, now))
            now = saved['blocked_until']
        permit = state.acquire_upstream(self.db, now)
        self.assertTrue(state.reopen_upstream(self.db, permit, now))
        saved = self.db.tmdb_streaming_upstream.find_one()
        self.assertEqual(saved['consecutive_blocks'], 0)
        self.assertIsNone(saved.get('blocked_until'))
        self.assertEqual(saved['last_success_at'], now)
        permit = state.acquire_upstream(self.db, now)
        self.assertEqual(state.block_upstream(self.db, permit, 'forbidden', now=now)['consecutive_blocks'], 1)

    def test_expired_block_allows_exactly_one_probe_and_recovers_abandoned_probe(self):
        permit = state.acquire_upstream(self.db, NOW)
        blocked = state.block_upstream(self.db, permit, 'challenge', now=NOW)
        now = blocked['blocked_until']
        barrier = Barrier(12)
        def acquire(_):
            barrier.wait()
            return state.acquire_upstream(self.db, now)
        with ThreadPoolExecutor(max_workers=12) as executor:
            permits = [p for p in executor.map(acquire, range(12)) if p is not None]
        self.assertEqual(len(permits), 1)
        self.assertIsNotNone(state.upstream_deadline(self.db, now))
        replacement = state.acquire_upstream(self.db, now + state.UPSTREAM_PROBE_LEASE)
        self.assertIsNotNone(replacement)
        self.assertFalse(state.reopen_upstream(self.db, permits[0], now + state.UPSTREAM_PROBE_LEASE))
        self.assertTrue(state.reopen_upstream(self.db, replacement, now + state.UPSTREAM_PROBE_LEASE))

    def test_stale_inflight_success_and_block_cannot_change_new_gate(self):
        first = state.acquire_upstream(self.db, NOW)
        stale = state.acquire_upstream(self.db, NOW)
        state.block_upstream(self.db, first, 'challenge', now=NOW)
        self.assertFalse(state.reopen_upstream(self.db, stale, NOW))
        state.block_upstream(self.db, stale, 'challenge', now=NOW)
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one()['consecutive_blocks'], 1)

    def test_retry_after_is_honoured(self):
        permit = state.acquire_upstream(self.db, NOW)
        retry = NOW + timedelta(hours=30)
        self.assertEqual(state.block_upstream(self.db, permit, 'rate_limited', retry_at=retry, now=NOW)['blocked_until'], retry)

    def test_failed_probe_never_opens_gate_or_fails_title(self):
        for response in [SimpleNamespace(status_code=200, text='<html>invalid</html>', headers={}),
                         SimpleNamespace(status_code=404, text='', headers={})]:
            with self.subTest(status=response.status_code):
                self.db.tmdb_streaming_upstream.delete_many({})
                self.db.tmdb_movie_providers.delete_many({})
                now = datetime.utcnow()
                self.db.tmdb_streaming_upstream.insert_one({
                    '_id': 'tmdb_watch', 'generation': 4, 'consecutive_blocks': 3,
                    'blocked_until': now - timedelta(seconds=1),
                    'blocked_since': now - timedelta(hours=5)})
                identity = self.db.tmdb_movie_providers.insert_one({
                    'tmdb_id': 42, 'country_code': 'US',
                    'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=US'}).inserted_id
                with patch.object(fetch, 'init_mongodb'), patch.object(fetch, 'close_mongodb'), patch.object(fetch, 'get_db', return_value=self.db), patch.object(fetch.httpx.Client, 'get', return_value=response):
                    result = fetch.main({'id': str(identity), 'type': 'movie'})
                self.assertEqual(result['outcome'], 'upstream_blocked')
                self.assertEqual(result['block_reason'], 'probe_failed')
                gate = self.db.tmdb_streaming_upstream.find_one()
                self.assertEqual(gate['consecutive_blocks'], 4)
                self.assertGreater(gate['blocked_until'], now)
                self.assertNotIn('failed_at', self.db.tmdb_movie_providers.find_one({'_id': identity}))

    def test_legacy_gate_probes_once_without_losing_existing_deadline(self):
        deadline = NOW + timedelta(hours=1)
        self.db.tmdb_streaming_upstream.insert_one({'_id': 'tmdb_watch', 'blocked_until': deadline})
        self.assertIsNone(state.acquire_upstream(self.db, NOW))
        permit = state.acquire_upstream(self.db, deadline)
        self.assertIsNotNone(permit)
        self.assertIsNone(state.acquire_upstream(self.db, deadline))
        self.assertTrue(state.reopen_upstream(self.db, permit, deadline))
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one()['consecutive_blocks'], 0)

    def test_retry_after_accepts_seconds_http_date_and_invalid_values(self):
        from email.utils import format_datetime
        from datetime import timezone
        later = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(hours=10)
        self.assertEqual(fetch.retry_deadline(format_datetime(later)), later.replace(tzinfo=None))
        self.assertGreater(fetch.retry_deadline('36000'), datetime.utcnow() + timedelta(hours=9))
        self.assertIsNone(fetch.retry_deadline('invalid'))
        self.assertIsNone(fetch.retry_deadline(None))

    def test_block_does_not_fail_or_reschedule_country(self):
        from f.tmdb_web.page_admission import initialize
        initialize(self.db)
        collection = self.db.tmdb_movie_providers
        before = {'tmdb_id': 42, 'country_code': 'US', 'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=US', 'updated_at': NOW - timedelta(days=8), 'next_fetch_at': NOW - timedelta(days=1), 'streaming_links': [{'provider_name': 'Old'}], 'consecutive_failures': 2}
        identity = collection.insert_one(before).inserted_id
        original = collection.find_one({'_id': identity})
        with patch.object(fetch, 'init_mongodb'), patch.object(fetch, 'close_mongodb'), patch.object(fetch, 'get_db', return_value=self.db), patch.object(fetch.httpx.Client, 'get', return_value=SimpleNamespace(status_code=403, text='<title>Just a moment...</title>', headers={})):
            result = fetch.main({'id': str(identity), 'type': 'movie'})
        self.assertEqual(result['outcome'], 'upstream_blocked')
        self.assertEqual(result['block_reason'], 'challenge')
        saved = collection.find_one({'_id': identity})
        for key in ['updated_at', 'next_fetch_at', 'streaming_links', 'consecutive_failures']:
            self.assertEqual(saved[key], original[key])
        self.assertNotIn('failed_at', saved)
        self.assertNotIn('lease_token', saved)


if __name__ == '__main__':
    unittest.main()
