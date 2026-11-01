"""Offline Letterboxd contracts: identity, exact counts, pacing, backoff and publication."""
import json
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import Mock, patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.critic_sites import polite_http
from f.letterboxd import backfill, crawl, http, pages, seed

NOW = datetime(2026, 11, 1, 12)
URL = "https://letterboxd.com/film/inception/"
LOOKUP = "https://letterboxd.com/imdb/tt1375666/"


def html(score=4.24, votes=4570122, tmdb=27205, imdb="tt1375666", media="movie", aggregate=True):
    movie = {"@type": "Movie", "url": URL}
    if aggregate:
        movie["aggregateRating"] = {"ratingValue": score, "ratingCount": votes, "bestRating": 5, "worstRating": 0.5}
    return (f'<link rel="canonical" href="{URL}">'
            '<script type="application/ld+json">/* <![CDATA[ */'
            + json.dumps({"@graph": [movie]}) + '/* ]]> */</script>'
            f'<a href="https://www.imdb.com/title/{imdb}/">IMDb</a>'
            f'<a href="https://www.themoviedb.org/{media}/{tmdb}/">TMDB</a>'
            '<a href="https://boxd.it/1skk">Share</a>')


class ParserTests(unittest.TestCase):
    def test_observed_real_markup_uses_open_graph_url_and_imdb_maindetails(self):
        body = (Path(__file__).parent / "fixtures/letterboxd/inception.html").read_text()
        parsed = pages.parse(body, URL, 27205, "tt1375666")
        self.assertEqual((parsed.score, parsed.votes, parsed.lid), (4.24, 4570122, "1skk"))

    def test_native_score_exact_count_and_share_id(self):
        parsed = pages.parse(html(), URL, 27205, "tt1375666")
        self.assertEqual((parsed.score, parsed.votes, parsed.lid), (4.24, 4570122, "1skk"))

    def test_unrated_movie_is_distinct_from_malformed_score(self):
        self.assertIsNone(pages.parse(html(aggregate=False), URL, 27205, "tt1375666").score)
        for kwargs in ({"votes": "4.5M"}, {"votes": 1.1}, {"score": 5.5}, {"score": True}, {"score": float("nan")}):
            with self.subTest(kwargs=kwargs), self.assertRaises((ValueError, TypeError)):
                pages.parse(html(**kwargs), URL, 27205, "tt1375666")

    def test_mismatched_external_ids_or_same_numeric_tv_id_are_rejected(self):
        for kwargs in ({"tmdb": 603}, {"imdb": "tt0133093"}, {"media": "tv"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(pages.IdentityMismatch):
                pages.parse(html(**kwargs), URL, 27205, "tt1375666")

    def test_wrong_or_missing_movie_node_is_not_unrated(self):
        for body in ("<html>oops</html>", html().replace('"Movie"', '"WebPage"')):
            with self.assertRaises(ValueError):
                pages.parse(body, URL, 27205, "tt1375666")

    def test_canonical_disagreement_is_rejected(self):
        with self.assertRaises(ValueError):
            pages.parse(html(), "https://letterboxd.com/film/other/", 27205, "tt1375666")


class TransportTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = NOW
        self.session = Mock()
        self.client = http.Client(self.db, self.session, clock=lambda: self.now, sleep=self.sleep)

    def sleep(self, seconds):
        self.now += timedelta(seconds=seconds)

    def response(self, status, headers=None, body=""):
        return Mock(status_code=status, headers=headers or {}, text=body)

    def test_each_redirect_has_a_separate_paced_slot(self):
        self.session.get.side_effect = [self.response(302, {"Location": URL}), self.response(200, body=html())]
        result = self.client.get(LOOKUP)
        self.assertEqual((result.url, result.status, self.client.requests), (URL, 200, 2))
        self.assertEqual(self.now, NOW + timedelta(seconds=2))
        self.assertTrue(all(not call.kwargs["allow_redirects"] for call in self.session.get.call_args_list))

    def test_block_stops_other_clients_without_new_http(self):
        self.session.get.return_value = self.response(429, {"Retry-After": "7200"})
        with self.assertRaises(polite_http.SiteBlocked):
            self.client.get(URL)
        other = http.Client(self.db, self.session, clock=lambda: self.now, sleep=self.sleep)
        with self.assertRaises(polite_http.SiteBlocked):
            other.get(URL)
        self.assertEqual(self.session.get.call_count, 1)
        self.assertEqual(self.db.critic_site_state.find_one()["blocked_until"], NOW + timedelta(hours=2))

    def test_redirect_cannot_fetch_another_host(self):
        self.session.get.return_value = self.response(302, {"Location": "https://other.example/"})
        with self.assertRaises(polite_http.FetchError):
            self.client.get(URL)
        self.assertEqual(self.session.get.call_count, 1)

    def test_a_block_recorded_during_slot_wait_prevents_the_request(self):
        self.db.critic_site_state.insert_one({"_id": http.SITE, "next_request_at": NOW + timedelta(seconds=5)})
        def blocked_sleep(seconds):
            self.sleep(seconds)
            self.db.critic_site_state.update_one({"_id": http.SITE}, {"$set": {"blocked_until": NOW + timedelta(days=1)}})
        self.client.sleep = blocked_sleep
        with self.assertRaises(polite_http.SiteBlocked):
            self.client.get(URL)
        self.session.get.assert_not_called()


class CrawlTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        seed.ensure_indexes(self.db)
        self.db.tmdb_movie_details.insert_one({"tmdb_id": 27205, "imdb_id": "tt1375666",
                                               "release_date": "2010-07-15"})
        self.db[seed.COLLECTION].insert_one({"tmdb_id": 27205, "next_crawl_at": seed.EPOCH, "popularity": 10})
        self.client = Mock(requests=1)
        self.client.get.return_value = polite_http.Page(200, URL, html(), LOOKUP)

    def doc(self):
        return self.db[seed.COLLECTION].find_one({"tmdb_id": 27205})

    def run_crawl(self, **kwargs):
        return crawl.run(self.db, self.client, clock=lambda: NOW, **kwargs)

    def test_crawl_publishes_then_refreshes_direct_url_and_preserves_precision(self):
        publish = Mock()
        result = self.run_crawl(publish=publish)
        self.assertEqual((result["ok"], result["published"]), (1, 1))
        publish.assert_called_once_with([27205])
        doc = self.doc()
        self.assertEqual(doc["user_score_normalized_percent"], 84.8)
        self.assertEqual(doc["user_score_vote_count"], 4570122)
        self.assertEqual(doc["next_crawl_at"], NOW + timedelta(days=90))
        crawl.crawl_one(self.db, self.client, doc, NOW + timedelta(days=91))
        self.client.get.assert_called_with(URL)

    def test_parse_error_preserves_last_good_score(self):
        self.run_crawl()
        self.client.get.return_value = polite_http.Page(200, URL, "broken markup", URL)
        crawl.crawl_one(self.db, self.client, self.doc(), NOW + timedelta(days=91))
        self.assertEqual(self.doc()["user_score_original"], 4.24)
        self.assertEqual(self.doc()["updated_at"], NOW)
        self.assertEqual(self.doc()["crawl_status"], "error")

    def test_gone_page_clears_scores_and_backs_them_up(self):
        self.run_crawl()
        self.client.get.return_value = polite_http.Page(404, URL, "gone", URL)
        crawl.crawl_one(self.db, self.client, self.doc(), NOW + timedelta(days=91))
        self.assertIsNone(self.doc()["user_score_original"])
        self.assertIsNone(self.doc()["letterboxd_url"])
        self.assertEqual(self.db.letterboxd_rating_history.find_one()["previous"]["user_score_original"], 4.24)

    def test_missing_imdb_does_not_try_force_import_url(self):
        self.db.tmdb_movie_details.update_one({}, {"$unset": {"imdb_id": ""}})
        self.assertEqual(self.run_crawl()["unavailable"], 1)
        self.client.get.assert_not_called()

    def test_site_block_keeps_old_data_and_leaves_other_titles_due(self):
        self.db[seed.COLLECTION].insert_one({"tmdb_id": 603, "next_crawl_at": seed.EPOCH, "popularity": 1})
        self.db[seed.COLLECTION].update_one({"tmdb_id": 27205}, {"$set": {"user_score_original": 4.2}})
        self.client.get.side_effect = polite_http.SiteBlocked(http.SITE, NOW + timedelta(days=1), "HTTP 403")
        result = self.run_crawl()
        self.assertIsNotNone(result["blocked"])
        self.assertEqual(self.doc()["user_score_original"], 4.2)
        self.assertEqual(self.db[seed.COLLECTION].find_one({"tmdb_id": 603})["next_crawl_at"], seed.EPOCH)
        self.assertNotIn("crawl_token", self.db.critic_site_state.find_one())

    def test_run_lease_prevents_overlapping_workers(self):
        self.db.critic_site_state.insert_one({"_id": http.SITE, "crawl_lease_until": NOW + timedelta(hours=1)})
        self.assertIn("another crawler", self.run_crawl()["stopped"])
        self.client.get.assert_not_called()

    def test_imdb_change_invalidates_cached_url(self):
        self.run_crawl()
        self.db.tmdb_movie_details.update_one({}, {"$set": {"imdb_id": "tt0133093"}})
        crawl.crawl_one(self.db, self.client, self.doc(), NOW + timedelta(days=91))
        self.client.get.assert_called_with("https://letterboxd.com/imdb/tt0133093/")

    def test_wikidata_hint_skips_imdb_redirect_and_still_verifies_page(self):
        self.db[seed.COLLECTION].update_one({}, {"$set": {"wikidata_url": URL}})
        self.assertEqual(self.run_crawl()["ok"], 1)
        self.client.get.assert_called_once_with(URL)

    def test_stale_wikidata_hint_falls_back_to_imdb_and_is_marked_rejected(self):
        stale = "https://letterboxd.com/film/old-slug/"
        self.db[seed.COLLECTION].update_one({}, {"$set": {"wikidata_url": stale}})
        self.client.get.side_effect = [polite_http.Page(404, stale, "gone", stale),
                                       polite_http.Page(200, URL, html(), LOOKUP)]
        self.assertEqual(self.run_crawl()["ok"], 1)
        self.assertEqual([call.args[0] for call in self.client.get.call_args_list], [stale, LOOKUP])
        self.assertEqual(self.doc()["rejected_mapping_url"], stale)

    def test_wrong_identity_in_mapping_cannot_replace_the_movie_score(self):
        self.db[seed.COLLECTION].update_one({}, {"$set": {"wikidata_url": URL}})
        self.client.get.side_effect = [polite_http.Page(200, URL, html(tmdb=603), URL),
                                       polite_http.Page(200, URL, html(), LOOKUP)]
        self.assertEqual(self.run_crawl()["ok"], 1)
        self.assertEqual(self.doc()["user_score_original"], 4.24)
        self.assertEqual(self.doc()["rejected_mapping_url"], URL)
        self.assertEqual(self.client.get.call_count, 2)

    def test_cold_backfill_does_not_recrawl_a_previously_attempted_movie(self):
        self.db[seed.COLLECTION].update_one({}, {"$set": {"crawled_at": NOW - timedelta(days=100)}})
        self.assertEqual(self.run_crawl(only_unseen=True)["titles"], 0)
        self.client.get.assert_not_called()


class BackfillTests(unittest.TestCase):
    def test_segments_run_continuously_with_shared_client_and_correct_totals(self):
        now = [NOW]
        client = Mock()
        def segment(*args, **kwargs):
            now[0] += timedelta(seconds=kwargs["max_seconds"])
            self.assertFalse(kwargs.get("only_unseen", False))
            self.assertIs(args[1], client)
            return {"titles": 100, "ok": 100, "requests": 200, "published": 100}
        with patch.object(backfill, "run", side_effect=segment) as run:
            result = backfill.backfill(Mock(), client, 1, 100, Mock(), clock=lambda: now[0])
        self.assertEqual(run.call_count, 3)
        self.assertEqual((result["titles"], result["requests"], result["seconds"]), (300, 600, 3600))

    def test_waits_for_another_owner_then_stops_on_shared_source_block(self):
        now = [NOW]
        def sleep(seconds):
            now[0] += timedelta(seconds=seconds)
        with patch.object(backfill, "run", side_effect=[
                {"stopped": "another crawler holds the lease"},
                {"blocked": {"reason": "HTTP 403", "until": "tomorrow"}}]) as run:
            result = backfill.backfill(Mock(), Mock(), 1, 100, Mock(), clock=lambda: now[0], sleep=sleep)
        self.assertEqual(run.call_count, 2)
        self.assertEqual(result["blocked"]["reason"], "HTTP 403")
        self.assertEqual(result["seconds"], 15)


class SeedTests(unittest.TestCase):
    def test_interrupted_initial_scan_resumes_after_last_committed_batch(self):
        db = mongomock.MongoClient().db
        seed.ensure_indexes(db)
        db.tmdb_movie_details.insert_many([{"tmdb_id": i, "imdb_id": f"tt{i}"} for i in range(1005)])
        batches = []
        fail = [True]
        def bulk(operations, **kwargs):
            batches.append(len(operations))
            if len(batches) == 2 and fail[0]:
                raise RuntimeError("interrupted")
            for operation in operations:
                db[seed.COLLECTION].update_one(operation._filter, operation._doc, upsert=operation._upsert)
        with patch.object(db[seed.COLLECTION], "bulk_write", side_effect=bulk):
            with self.assertRaisesRegex(RuntimeError, "interrupted"):
                seed.seed(db, now=NOW)
            self.assertEqual(db[seed.COLLECTION].count_documents({}), 1000)
            fail[0] = False
            self.assertEqual(seed.seed(db, now=NOW + timedelta(days=1))["queued_or_refreshed"], 5)
        self.assertEqual(db[seed.COLLECTION].count_documents({}), 1005)
        state = db.critic_site_state.find_one()
        self.assertEqual(state["seeded_through"], NOW)
        self.assertNotIn("seed_scan_after", state)

    def test_seed_is_idempotent_keeps_crawl_results_and_resumes_from_last_success(self):
        db = mongomock.MongoClient().db
        seed.ensure_indexes(db)
        db.tmdb_movie_details.insert_many([
            {"tmdb_id": 1, "imdb_id": "tt1", "updated_at": NOW, "popularity": 5},
            {"tmdb_id": 2, "imdb_id": "not-an-imdb-id", "updated_at": NOW}])
        # mongomock has not yet implemented PyMongo's new UpdateOne sort keyword.
        def bulk(operations, **kwargs):
            for operation in operations:
                db[seed.COLLECTION].update_one(operation._filter, operation._doc, upsert=operation._upsert)
        with patch.object(db[seed.COLLECTION], "bulk_write", side_effect=bulk):
            self.assertEqual(seed.seed(db, now=NOW)["queued_or_refreshed"], 1)
            db[seed.COLLECTION].update_one({"tmdb_id": 1}, {"$set": {"user_score_original": 4,
                                                                                    "next_crawl_at": NOW + timedelta(days=90)}})
            db.tmdb_movie_details.update_one({"tmdb_id": 1}, {"$set": {"popularity": 50}})
            seed.seed(db, now=NOW + timedelta(days=1))
            self.assertEqual(db[seed.COLLECTION].count_documents({}), 1)
            doc = db[seed.COLLECTION].find_one()
            self.assertEqual((doc["popularity"], doc["user_score_original"]), (50, 4))
            self.assertEqual(doc["next_crawl_at"], NOW + timedelta(days=90))
            # A delayed daily seed must not miss updates older than two days ago.
            db.tmdb_movie_details.insert_one({"tmdb_id": 3, "imdb_id": "tt3", "updated_at": NOW + timedelta(days=2)})
            seed.seed(db, now=NOW + timedelta(days=8))
            self.assertIsNotNone(db[seed.COLLECTION].find_one({"tmdb_id": 3}))


if __name__ == "__main__":
    unittest.main()
