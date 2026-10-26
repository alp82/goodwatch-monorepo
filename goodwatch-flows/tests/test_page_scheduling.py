"""Local-only page scheduling proofs; optional real disposable Mongo endpoint."""
import os
import socket
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier
from types import SimpleNamespace
from unittest.mock import patch

import mongomock
from pymongo import MongoClient
from f.tmdb_web import page_admission as admission, country_state as countries
from f.tmdb_web.availability_selector import select
from f.tmdb_web.tmdb_crawl_providers import fetch, batch

NOW = datetime(2026, 10, 26, 12)
VALID = '''<title>Just a Moment (2026) — The Movie Database</title>
<script>$("#ott_country_filter").kendoDropDownList({value:"DO",dataValueField:"country_code"})</script>
<div id="ott_offers_window"><p class="no_offers">None</p></div>'''


class PageTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().test
        admission.initialize(self.db)
        # A missing HTTP mock must fail before DNS/network access.
        self.guard = patch.object(socket.socket, 'connect', side_effect=AssertionError('Network forbidden'))
        self.guard.start()
        self.addCleanup(self.guard.stop)

    def test_ordinary_title_empty_and_challenge(self):
        response = SimpleNamespace(status_code=200, text=VALID, headers={})
        with patch.object(fetch.httpx.Client, 'get', return_value=response):
            result = fetch.crawl_tmdb_watch_page({'tmdb_watch_url':'https://example.test', 'country_code':'DO'}, request=fetch.httpx.Client.get)
        self.assertEqual(result.streaming_links, [])
        response.headers = {'cf-mitigated':'challenge'}
        with patch.object(fetch.httpx.Client, 'get', return_value=response):
            self.assertEqual(fetch.crawl_tmdb_watch_page({'tmdb_watch_url':'https://example.test','country_code':'DO'}, request=fetch.httpx.Client.get).block_reason, 'challenge')

    def test_mixed_valid_and_broken_offer_blocks_never_become_partial_success(self):
        html = '''<script>$("#ott_country_filter").kendoDropDownList({value:"DO",dataValueField:"country_code"})</script>
        <div id="ott_offers_window"><div class="ott_provider"><h3>Stream</h3><li class="changed_markup">Broken</li></div>
        <div class="ott_provider"><h3>Rent</h3><li class="ott_filter_best_price"><a title="Watch on Netflix" href="https://example.test/watch">Watch</a></li></div></div>'''
        with self.assertRaisesRegex(ValueError, 'no parseable provider rows'):
            fetch.crawl_tmdb_watch_page({'tmdb_watch_url': 'https://example.test', 'country_code': 'DO'},
                request=lambda *a, **k: SimpleNamespace(status_code=200, text=html, headers={}))

    def test_expired_probe_cannot_admit_redirect_or_reopen_gate(self):
        ordinary = countries.acquire_upstream(self.db, NOW)
        state = countries.block_upstream(self.db, ordinary, 'challenge', now=NOW)
        probe_time = state['blocked_until']
        probe = countries.acquire_upstream(self.db, probe_time)
        self.assertIsNotNone(probe)
        expired = probe_time + countries.UPSTREAM_PROBE_LEASE + timedelta(milliseconds=1)
        self.assertIsNone(admission.try_acquire(self.db, now=expired, upstream_permit=probe, sweep_pending=False))
        self.assertFalse(countries.reopen_upstream(self.db, probe, expired))
        replacement = countries.acquire_upstream(self.db, expired)
        self.assertIsNotNone(replacement)
        self.assertNotEqual(replacement['probe_token'], probe['probe_token'])

    def test_caps_and_sweep_reservation(self):
        for _ in range(20000):
            self.assertTrue(admission.charge_pair(self.db, 'opened', NOW))
        self.assertFalse(admission.charge_pair(self.db, 'opened', NOW))
        self.assertTrue(admission.charge_pair(self.db, 'opened', NOW + timedelta(days=1)))
        self.db.tmdb_streaming_upstream.update_one({'_id':'page_pairs:2026-10-26'},{'$set':{'changed':29999}})
        self.assertTrue(admission.charge_pair(self.db,'changed',NOW))
        self.assertFalse(admission.charge_pair(self.db,'changed',NOW))
        self.db.tmdb_streaming_upstream.update_one({'_id':'tmdb_watch'},{'$set':{'fairness_count':9,'fairness_sweep_count':0}})
        self.assertIsNone(admission.try_acquire(self.db, tier='opened', sweep_pending=True, now=NOW))
        self.assertIsNotNone(admission.try_acquire(self.db, tier='sweep', sweep_pending=True, now=NOW))

    def test_tiers_dedup_and_revision_fence(self):
        col = self.db.tmdb_movie_providers
        key=col.insert_one({'tmdb_id':42,'country_code':'US','provider_title_observed_at':NOW,'updated_at':NOW-timedelta(days=8),'provider_change_pending':True,'provider_change_revision':'a','popularity':25}).inserted_id
        rows=select(col,NOW,20,[42]);self.assertEqual(len(rows),1)
        claim=countries.claim(self.db,col,key,now=NOW,availability_tier='opened')
        self.assertIsNotNone(claim)
        col.update_one({'_id':key},{'$set':{'provider_change_revision':'b'}})
        self.assertTrue(countries.save_success(col,claim,[],now=NOW))
        self.assertTrue(col.find_one({'_id':key})['provider_change_pending'])
        col.update_one({'_id':key},{'$set':{'country_code':'NE','updated_at':None}})
        self.assertEqual(select(col,NOW),[])
        col.update_one({'_id':key},{'$set':{'country_code':'US','provider_verified_empty':True}})
        self.assertEqual(select(col,NOW),[])

    def test_only_validated_titles_are_released_including_unknown_country(self):
        col=self.db.tmdb_movie_providers
        key=col.insert_one({'tmdb_id':42,'country_code':'DO'}).inserted_id
        self.assertEqual(select(col,NOW),[])
        # Title proof can release the page; country omission remains unknown.
        col.update_one({'_id':key},{'$set':{'provider_title_observed_at':NOW}})
        self.assertEqual(len(select(col,NOW)),1)
        self.assertNotIn('provider_observed_at',col.find_one({'_id':key}))
        self.assertNotIn('provider_verified_empty',col.find_one({'_id':key}))

    def test_redirects_each_charge_wire_and_404_requests_api_confirmation(self):
        col = self.db.tmdb_movie_providers
        key = col.insert_one({'tmdb_id':42,'country_code':'DO','tmdb_watch_url':'https://www.themoviedb.org/movie/42/watch?locale=DO'}).inserted_id
        client = SimpleNamespace(get=lambda *a, **kw: None)
        responses = iter([SimpleNamespace(status_code=302,headers={'location':'/movie/42-name/watch?locale=DO'}),
                          SimpleNamespace(status_code=200,headers={},text=VALID)])
        client.get = lambda *a, **kw: next(responses)
        result = fetch.fetch_one(self.db,{'id':str(key),'type':'movie'},client=client)
        self.assertEqual(result['outcome'],'fetched')
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one({'_id':'tmdb_watch'})['wire_count'],2)
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one({'_id':'tmdb_watch'})['wire_permits'],[])
        col.update_one({'_id':key},{'$set':{'updated_at':None,'next_fetch_at':datetime(1970,1,1)}})
        client.get = lambda *a, **kw: SimpleNamespace(status_code=404,headers={},text='')
        result = fetch.fetch_one(self.db,{'id':str(key),'type':'movie'},client=client)
        self.assertEqual(result['outcome'],'page_not_found')
        self.assertTrue(col.find_one({'_id':key})['api_confirmation_pending'])
        self.assertFalse(col.find_one({'_id':key}).get('tmdb_deleted',False))

    def test_api_deleted_while_claimed_cannot_publish_page(self):
        col=self.db.tmdb_movie_providers
        key=col.insert_one({'tmdb_id':42,'country_code':'DO'}).inserted_id
        claimed=countries.claim(self.db,col,key,now=NOW)
        col.update_one({'_id':key},{'$set':{'tmdb_deleted':True}})
        self.assertFalse(countries.save_success(col,claimed,[],now=NOW))
        self.assertNotIn('updated_at',col.find_one({'_id':key}))

    def test_parse_failure_is_explicit_and_verified_success_clears_it(self):
        col = self.db.tmdb_movie_providers
        key = col.insert_one({'tmdb_id': 42, 'country_code': 'DO',
                             'tmdb_watch_url': 'https://www.themoviedb.org/movie/42/watch?locale=DO'}).inserted_id
        client = SimpleNamespace(get=lambda *a, **kw: SimpleNamespace(
            status_code=200, headers={}, text='<html>Unrecognized markup</html>'))
        result = fetch.fetch_one(self.db, {'id': str(key), 'type': 'movie'}, client=client)
        self.assertEqual(result['failure_classification'], 'parse')
        self.assertEqual(col.find_one({'_id': key})['failure_classification'], 'parse')
        parse_at = col.find_one({'_id': key})['parse_failed_at']
        self.assertNotIn('updated_at', col.find_one({'_id': key}))
        col.update_one({'_id': key}, {'$set': {'next_fetch_at': datetime.utcnow() - timedelta(seconds=1)}})
        retry = countries.claim(self.db, col, key)
        self.assertIsNotNone(retry)
        self.assertTrue(countries.save_failure(self.db, col, retry, '503', failure_classification='http'))
        self.assertEqual(col.find_one({'_id': key})['failure_classification'], 'http')
        self.assertEqual(col.find_one({'_id': key})['parse_failed_at'], parse_at)
        col.update_one({'_id': key}, {'$set': {'next_fetch_at': datetime.utcnow() - timedelta(seconds=1)}})
        client.get = lambda *a, **kw: SimpleNamespace(status_code=200, headers={}, text=VALID)
        self.assertEqual(fetch.fetch_one(self.db, {'id': str(key), 'type': 'movie'}, client=client)['outcome'], 'fetched')
        self.assertNotIn('failure_classification', col.find_one({'_id': key}))
        self.assertNotIn('parse_failed_at', col.find_one({'_id': key}))

    def test_bounded_server_retries_are_wire_charged(self):
        key=self.db.tmdb_movie_providers.insert_one({'tmdb_id':42,'country_code':'DO','tmdb_watch_url':'https://www.themoviedb.org/movie/42/watch?locale=DO'}).inserted_id
        responses=iter([SimpleNamespace(status_code=503,headers={},text=''),SimpleNamespace(status_code=503,headers={},text=''),SimpleNamespace(status_code=200,headers={},text=VALID)])
        client=SimpleNamespace(get=lambda *a, **kw:next(responses))
        result=fetch.fetch_one(self.db,{'id':str(key),'type':'movie'},client=client)
        self.assertEqual(result['outcome'],'fetched')
        self.assertEqual(self.db.tmdb_streaming_upstream.find_one({'_id':'tmdb_watch'})['wire_count'],3)

    def test_missing_shared_state_fails_closed(self):
        self.db.tmdb_streaming_upstream.delete_one({'_id':'tmdb_watch'})
        with self.assertRaises(RuntimeError):
            admission.try_acquire(self.db, now=NOW)
        self.assertIsNone(self.db.tmdb_streaming_upstream.find_one({'_id':'tmdb_watch'}))

    def test_batch_shadow_has_no_writes_and_is_bounded(self):
        self.assertEqual(batch.main([{'id':'x'}])[0]['outcome'],'selected_shadow')
        with self.assertRaises(ValueError):batch.main([{}]*21)


@unittest.skipUnless(os.environ.get('PAGE_TEST_MONGO_URI'), 'disposable Mongo URI required')
class SharedStoreTests(unittest.TestCase):
    def setUp(self):
        uri=os.environ['PAGE_TEST_MONGO_URI']
        if not uri.startswith('mongodb://127.0.0.1:27189/'):
            raise ValueError('Only disposable localhost Mongo allowed')
        self.client=MongoClient(uri,serverSelectionTimeoutMS=3000)
        self.db=self.client.get_database('page_scheduling_test')
        self.client.drop_database(self.db.name)
        admission.initialize(self.db)
        self.addCleanup(self.client.close)
        self.addCleanup(lambda:self.client.drop_database(self.db.name))

    def test_twelve_claimers_permits_expiry_and_fences(self):
        barrier=Barrier(12)
        def claim(_):
            barrier.wait()
            return admission.try_acquire(self.db,now=NOW,sweep_pending=False)
        with ThreadPoolExecutor(max_workers=12) as pool:
            permits=[p for p in pool.map(claim,range(12)) if p]
        self.assertEqual(len(permits),1)
        for i in range(1,6):
            self.assertIsNotNone(admission.try_acquire(self.db,now=NOW+timedelta(seconds=i),sweep_pending=False))
        self.assertIsNone(admission.try_acquire(self.db,now=NOW+timedelta(seconds=6),sweep_pending=False))
        self.assertIsNotNone(admission.try_acquire(self.db,now=NOW+timedelta(seconds=51),sweep_pending=False))
        admission.release(self.db,permits[0])
        self.assertEqual(len(self.db.tmdb_streaming_upstream.find_one({'_id':'tmdb_watch'})['wire_permits']),1)
        key=self.db.tmdb_movie_providers.insert_one({'tmdb_id':1,'country_code':'US'}).inserted_id
        first=countries.claim(self.db,self.db.tmdb_movie_providers,key,now=NOW)
        second=countries.claim(self.db,self.db.tmdb_movie_providers,key,now=NOW+countries.LEASE_DURATION)
        self.assertFalse(countries.save_success(self.db.tmdb_movie_providers,first,[],NOW+countries.LEASE_DURATION))
        self.assertTrue(countries.save_success(self.db.tmdb_movie_providers,second,[],NOW+countries.LEASE_DURATION))

    def test_shared_wire_clock_actual_interval(self):
        from time import monotonic
        stamps = []
        for _ in range(8):
            permit = admission.acquire(self.db, sweep_pending=False)
            self.assertIsNotNone(permit)
            stamps.append(monotonic())
            admission.release(self.db, permit)
        actual = (len(stamps) - 1) / (stamps[-1] - stamps[0])
        self.assertGreaterEqual(actual, 1.3 * .9)
        self.assertLessEqual(actual, 1.3 * 1.1)

    def test_block_single_probe_and_slowstart(self):
        permit=admission.try_acquire(self.db,now=NOW,sweep_pending=False)
        blocked=countries.block_upstream(self.db,permit,'challenge',now=NOW)
        self.assertIsNone(admission.try_acquire(self.db,now=NOW+timedelta(seconds=10),sweep_pending=False))
        barrier=Barrier(12)
        def probe(_):
            barrier.wait()
            return admission.try_acquire(self.db,now=blocked['blocked_until'],sweep_pending=False)
        with ThreadPoolExecutor(max_workers=12) as pool:
            permits=[p for p in pool.map(probe,range(12)) if p]
        self.assertEqual(len(permits),1)
        self.assertTrue(countries.reopen_upstream(self.db,permits[0],blocked['blocked_until']))
        state=self.db.tmdb_streaming_upstream.find_one({'_id':'tmdb_watch'})
        self.assertEqual(admission.rate(state,blocked['blocked_until']),.325)
        self.assertEqual(admission.rate(state,blocked['blocked_until']+timedelta(minutes=10)),.42500000000000004)
        self.assertEqual(admission.rate(state,blocked['blocked_until']+timedelta(hours=3)),1.3)
