"""Fresh rechecks use the shared bypass; ordinary queue reads stay cached."""
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlsplit

import mongomock
from mongoengine import connect, disconnect

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

with patch("wmill.get_variable", return_value="test-key"):
    from f.tmdb_api.tmdb_fetch_details_from_api import fetch


class RecheckCacheTests(unittest.TestCase):
    def setUp(self):
        disconnect()
        connect("recheck_cache", mongo_client_class=mongomock.MongoClient, uuidRepresentation="standard")
        self.addCleanup(disconnect)
        self.movie = TmdbMovieDetails(tmdb_id=123).save()
        self.show = TmdbTvDetails(tmdb_id=123).save()
        self.ids = {"movie_ids": [str(self.movie.id)], "tv_ids": [str(self.show.id)]}

    def run_fetch(self, **kwargs):
        def response(url, **options):
            result = MagicMock()
            result.json.return_value = {"id": 123, "title": "Movie", "name": "Show",
                                        "watch/providers": {"results": {}}}
            return result

        with patch.object(fetch, "init_mongodb"), patch.object(fetch, "close_mongodb"), \
                patch.object(fetch.requests, "get", side_effect=response) as get, patch("builtins.print"):
            result = fetch.main(self.ids, **kwargs)
        self.assertEqual(result["count_new_entries"], 2)
        return [(urlsplit(call.args[0]).path, parse_qs(urlsplit(call.args[0]).query)) for call in get.call_args_list]

    def test_recheck_bypasses_cache_for_both_media_types_and_each_retry(self):
        calls = self.run_fetch(bypass_cache=True) + self.run_fetch(bypass_cache=True)
        self.assertEqual([path for path, _ in calls], ["/3/movie/123", "/3/tv/123"] * 2)
        nonces = [query["cb"][0] for _, query in calls]
        self.assertEqual(len(set(nonces)), 4)
        for _, query in calls:
            self.assertIn("watch/providers", query["append_to_response"][0])
        for title in (self.movie, self.show):
            title.reload()
            self.assertTrue(title.watch_providers_check["cache_bypassed"])

    def test_regular_refresh_keeps_plain_urls_and_does_not_claim_a_fresh_check(self):
        self.run_fetch(bypass_cache=True)
        for options in ({}, {"bypass_cache": False}):
            for _, query in self.run_fetch(**options):
                self.assertEqual(set(query), {"api_key", "append_to_response"})
            for title in (self.movie, self.show):
                title.reload()
                self.assertFalse(title.watch_providers_check.get("cache_bypassed"))

    def test_list_monitored_title_uses_a_fresh_regular_read_without_an_extra_request(self):
        self.movie.watch_providers_list_scopes = {'DE_8': {'checked_at': 1, 'kinds': ['flatrate']}}
        self.movie.save()
        calls = self.run_fetch()
        self.assertEqual(len(calls), 2)
        self.assertIn('cb', calls[0][1])
        self.assertNotIn('cb', calls[1][1])


if __name__ == "__main__":
    unittest.main()
