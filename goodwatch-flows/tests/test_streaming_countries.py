"""Country scraping contracts at Mongo persistence and script entrypoints.

Run with: python -m unittest discover -s tests -p test_streaming_countries.py
Requires the flow dependencies and mongomock (local regression database).
"""

import importlib
import sys
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace

from bson import ObjectId
from typing import Any

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_web import country_state


def country_control(code: str) -> str:
    return '<script>$("#ott_country_filter").kendoDropDownList({value: "' + code + '", dataValueField: "country_code"});</script>'


class CountryStateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.db = mongomock.MongoClient().countries
        self.collection = self.db.tmdb_movie_providers
        self.now = datetime(2026, 9, 10, 12)

    def country(self, **values: Any) -> ObjectId:
        values = {
            "tmdb_id": 42,
            "country_code": "US",
            "tmdb_watch_url": "https://www.themoviedb.org/movie/42/watch?locale=US",
            **values,
        }
        return self.collection.insert_one(values).inserted_id

    def test_effective_country_mismatch_missing_or_ambiguous_control_preserves_previous_success(self) -> None:
        from f.tmdb_web.tmdb_crawl_providers import fetch
        empty = '<div id="ott_offers_window"><p class="no_offers">No offers</p></div>'
        controls = ['', '<script>$("#ott_country_filter").kendoDropDownList({value: "DE", dataValueField: "country_code"});</script>',
                    '<script>$("#ott_country_filter").kendoDropDownList({value: "NE", dataValueField: "country_code"});$("#ott_country_filter").kendoDropDownList({value: "DE", dataValueField: "country_code"});</script>']
        pages = [empty + control for control in controls]
        pages.append(country_control('NE') + '<div id="ott_offers_window"><div class="ott_provider"><h3>Stream</h3><li class="ott_filter_best_price"><a href="https://click.justwatch.com/a?uct_country=de" title="Watch on Old">Watch</a></li></div></div>')
        for page in pages:
            self.collection.delete_many({})
            identity = self.country(country_code='NE', tmdb_watch_url='https://www.themoviedb.org/movie/42/watch?locale=NE',
                                    updated_at=self.now, next_fetch_at=self.now, streaming_links=[{'provider_name': 'Old', 'stream_url': 'https://old'}])
            response = SimpleNamespace(status_code=200, text=page, headers={})
            with patch.object(fetch, 'init_mongodb'), patch.object(fetch, 'close_mongodb'), patch.object(fetch, 'get_db', return_value=self.db), patch.object(fetch.requests, 'get', return_value=response):
                result = fetch.main({'id': str(identity), 'type': 'movie'})
            self.assertEqual(result['outcome'], 'failed')
            self.assertTrue(result['retry_saved'])
            stored = self.collection.find_one({'_id': identity})
            self.assertEqual(stored['updated_at'], self.now)
            self.assertEqual(stored['streaming_links'], [{'provider_name': 'Old', 'stream_url': 'https://old'}])
            self.assertGreater(stored['consecutive_failures'], 0)

    def test_pending_country_is_claimed_once_and_success_is_reused_for_seven_days(
        self,
    ) -> None:
        identity = self.country()
        claim = country_state.claim(
            self.db, self.collection, identity, now=self.now
        )
        self.assertIsNotNone(claim)
        self.assertIsNone(
            country_state.claim(
                self.db, self.collection, identity, now=self.now
            )
        )
        self.assertTrue(
            country_state.save_success(
                self.collection, claim, [], now=self.now
            )
        )
        saved = self.collection.find_one({"_id": identity})
        self.assertEqual(saved["streaming_links"], [])
        self.assertEqual(saved["updated_at"], self.now)
        self.assertIsNone(
            country_state.claim(
                self.db,
                self.collection,
                identity,
                now=self.now + timedelta(days=6),
            )
        )
        self.assertIsNotNone(
            country_state.claim(
                self.db,
                self.collection,
                identity,
                now=self.now + timedelta(days=7),
            )
        )

    def test_mapping_refresh_can_claim_fresh_country_but_repeated_requests_back_off(self) -> None:
        identity = self.country(updated_at=self.now, next_fetch_at=self.now + timedelta(days=7))
        self.assertIsNone(country_state.claim(self.db, self.collection, identity, now=self.now))
        claimed = country_state.claim(self.db, self.collection, identity, now=self.now, refresh_for_mapping=True)
        self.assertIsNotNone(claimed)
        self.assertIsNone(country_state.claim(self.db, self.collection, identity, now=self.now, refresh_for_mapping=True))
        country_state.save_success(self.collection, claimed, [], now=self.now)
        self.assertIsNone(country_state.claim(self.db, self.collection, identity, now=self.now + timedelta(minutes=1), refresh_for_mapping=True))
        self.assertIsNotNone(country_state.claim(self.db, self.collection, identity, now=self.now + timedelta(minutes=30), refresh_for_mapping=True))

    def test_fetch_entrypoint_refreshes_fresh_unmapped_country_once(self) -> None:
        from f.tmdb_web.tmdb_crawl_providers import fetch
        now = datetime.utcnow()
        identity = self.country(updated_at=now, next_fetch_at=now + timedelta(days=7),
                                streaming_links=[{"provider_name": "Cineplex"}])
        page = country_control("US") + '<div id="ott_offers_window"><p class="no_offers">No offers</p></div>'
        response = SimpleNamespace(status_code=200, text=page, headers={})
        with patch.object(fetch, "init_mongodb"), patch.object(fetch, "close_mongodb"), patch.object(fetch, "get_db", return_value=self.db), patch.object(fetch.requests, "get", return_value=response) as request:
            result = fetch.main({"id": str(identity), "type": "movie"}, refresh_for_mapping=True)
            self.assertEqual(result["outcome"], "fetched")
            result = fetch.main({"id": str(identity), "type": "movie"}, refresh_for_mapping=True)
            self.assertEqual(result["outcome"], "deferred")
            request.assert_called_once()
        stored = self.collection.find_one({"_id": identity})
        self.assertEqual(stored["streaming_links"], [])
        self.assertGreater(stored["next_fetch_at"], now)

    def test_mapping_refresh_respects_failure_upstream_and_active_claim(self) -> None:
        for fields in (
            {"consecutive_failures": 1, "next_fetch_at": self.now + timedelta(hours=2)},
            {"lease_token": "other", "lease_expires_at": self.now + timedelta(minutes=4)},
            {"country_identity_error": "Invalid country"},
        ):
            identity = self.country(**fields)
            self.assertIsNone(country_state.claim(self.db, self.collection, identity, now=self.now, refresh_for_mapping=True))
        self.db.tmdb_streaming_upstream.insert_one({"_id": "tmdb_watch", "blocked_until": self.now + timedelta(hours=1)})
        identity = self.country()
        self.assertIsNone(country_state.claim(self.db, self.collection, identity, now=self.now, refresh_for_mapping=True))

    def test_failure_preserves_links_and_success_and_respects_shared_upstream_delay(
        self,
    ) -> None:
        last_success = self.now - timedelta(days=8)
        identity = self.country(
            updated_at=last_success,
            streaming_links=[{"stream_url": "https://old.example"}],
        )
        document = country_state.claim(
            self.db, self.collection, identity, now=self.now
        )
        retry_at = self.now + timedelta(hours=10)
        country_state.save_failure(
            self.db,
            self.collection,
            document,
            "429",
            rate_limited=True,
            retry_at=retry_at,
            now=self.now,
        )
        saved = self.collection.find_one({"_id": identity})
        self.assertEqual(
            saved["streaming_links"], [{"stream_url": "https://old.example"}]
        )
        self.assertEqual(saved["updated_at"], last_success)
        self.assertEqual(saved["next_fetch_at"], retry_at)
        other = self.country(country_code="DE")
        self.assertIsNone(
            country_state.claim(
                self.db,
                self.collection,
                other,
                now=self.now + timedelta(hours=9),
            )
        )
        self.assertIsNotNone(
            country_state.claim(self.db, self.collection, other, now=retry_at)
        )

    def test_expired_worker_cannot_overwrite_or_clear_replacement_lease(
        self,
    ) -> None:
        identity = self.country()
        old = country_state.claim(
            self.db, self.collection, identity, now=self.now
        )
        later = self.now + timedelta(minutes=6)
        replacement = country_state.claim(
            self.db, self.collection, identity, now=later
        )
        self.assertIsNotNone(replacement)
        self.assertFalse(
            country_state.save_success(self.collection, old, [], now=later)
        )
        self.assertFalse(
            country_state.save_failure(
                self.db, self.collection, old, "old failed", now=later
            )
        )
        self.assertEqual(
            self.collection.find_one({"_id": identity})["lease_token"],
            replacement["lease_token"],
        )
        self.assertTrue(
            country_state.save_success(
                self.collection, replacement, [], now=later
            )
        )

    def test_backoff_steps_have_positive_jitter_and_six_hour_floor_after_third_failure(
        self,
    ) -> None:
        identity = self.country()
        now = self.now
        for minimum, maximum in [(30, 33), (120, 132), (360, 396), (360, 396)]:
            claimed = country_state.claim(
                self.db, self.collection, identity, now=now
            )
            self.assertTrue(
                country_state.save_failure(
                    self.db, self.collection, claimed, "network", now=now
                )
            )
            saved = self.collection.find_one({"_id": identity})
            self.assertGreaterEqual(
                saved["next_fetch_at"], now + timedelta(minutes=minimum)
            )
            self.assertLessEqual(
                saved["next_fetch_at"], now + timedelta(minutes=maximum)
            )
            now = saved["next_fetch_at"]

    def test_backfill_normalizes_identity_preserves_success_and_is_idempotent(
        self,
    ) -> None:
        identity = self.country(
            country_code=None,
            updated_at=self.now - timedelta(days=2),
            streaming_links=[{"stream_url": "old"}],
        )
        result = country_state.backfill(self.collection, "movie")
        self.assertEqual(result["errors"], [])
        saved = self.collection.find_one({"_id": identity})
        self.assertEqual(saved["country_code"], "US")
        self.assertEqual(saved["next_fetch_at"], self.now + timedelta(days=5))
        self.assertEqual(saved["streaming_links"], [{"stream_url": "old"}])
        country_state.backfill(self.collection, "movie")
        self.assertEqual(self.collection.find_one({"_id": identity}), saved)

    def test_backfill_reports_duplicate_and_invalid_identity_without_merging(
        self,
    ) -> None:
        first = self.country(country_code=None)
        second = self.country(
            tmdb_watch_url="https://www.themoviedb.org/movie/42-slug/watch?locale=US"
        )
        bad = self.country(
            tmdb_id=43,
            tmdb_watch_url="https://example.com/movie/43/watch?locale=DE",
        )
        result = country_state.backfill(self.collection, "movie")
        self.assertEqual(len(result["errors"]), 3)
        self.assertEqual(self.collection.count_documents({}), 3)
        for identity in (first, second, bad):
            self.assertNotIn(
                "country_identity_ready",
                self.collection.find_one({"_id": identity}),
            )

    def test_targeted_initializer_resolves_existing_and_new_movie_and_tv_country_ids(
        self,
    ) -> None:
        from f.tmdb_web.tmdb_init_providers import update
        from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

        movie_id = self.country(country_code=None)
        movie = TmdbMovieDetails(
            tmdb_id=42,
            original_title="Movie",
            title="Movie",
            watch_providers={
                "results": {
                    "US": {
                        "link": "https://www.themoviedb.org/movie/42/watch?locale=US"
                    },
                    "DE": {
                        "link": "https://www.themoviedb.org/movie/42/watch?locale=DE"
                    },
                }
            },
        )
        show = TmdbTvDetails(
            tmdb_id=42,
            original_title="Show",
            title="Show",
            watch_providers={
                "results": {
                    "US": {
                        "link": "https://www.themoviedb.org/tv/42/watch?locale=US"
                    }
                }
            },
        )
        with patch.object(update, "get_db", return_value=self.db):
            first = update.initialize_documents([movie, show])
            second = update.initialize_documents([movie, show])
        self.assertEqual(len(first["movie_ids"]), 2)
        self.assertIn(str(movie_id), first["movie_ids"])
        self.assertEqual(len(first["tv_ids"]), 1)
        self.assertNotIn(first["tv_ids"][0], first["movie_ids"])
        self.assertEqual(first["movie_ids"], second["movie_ids"])
        self.assertEqual(second["count_new_movies"], 0)

    def test_fetch_entrypoint_verifies_empty_and_reuses_country_without_another_request(
        self,
    ) -> None:
        from f.tmdb_web.tmdb_crawl_providers import fetch

        identity = self.country()
        response = SimpleNamespace(
            status_code=200,
            text='<div id="ott_offers_window"><p class="no_offers">There are no offers.</p></div>' + country_control('US'),
            headers={},
        )
        with (
            patch.object(fetch, "init_mongodb"),
            patch.object(fetch, "close_mongodb"),
            patch.object(fetch, "get_db", return_value=self.db),
            patch.object(fetch.requests, "get", return_value=response) as http,
        ):
            first = fetch.main({"id": str(identity), "type": "movie"})
            second = fetch.main({"id": str(identity), "type": "movie"})
        self.assertEqual(first["outcome"], "fetched")
        self.assertEqual(first["providers"]["streaming_links"], [])
        self.assertEqual(second["outcome"], "fresh")
        self.assertEqual(http.call_count, 1)

    def test_unrecognized_200_page_is_failure_and_preserves_previous_links(
        self,
    ) -> None:
        from f.tmdb_web.tmdb_crawl_providers import fetch

        identity = self.country(
            updated_at=self.now - timedelta(days=8),
            streaming_links=[{"stream_url": "old"}],
        )
        response = SimpleNamespace(
            status_code=200, text="<html>Challenge</html>", headers={}
        )
        with (
            patch.object(fetch, "init_mongodb"),
            patch.object(fetch, "close_mongodb"),
            patch.object(fetch, "get_db", return_value=self.db),
            patch.object(fetch.requests, "get", return_value=response),
        ):
            result = fetch.main({"id": str(identity), "type": "movie"})
        self.assertEqual(result["outcome"], "failed")
        self.assertEqual(
            self.collection.find_one({"_id": identity})["streaming_links"],
            [{"stream_url": "old"}],
        )

    def test_concurrent_claimants_scrape_only_one_country(self) -> None:
        identity = self.country()
        barrier = Barrier(8)

        def select(_: int) -> dict | None:
            barrier.wait()
            return country_state.claim(
                self.db, self.collection, identity, now=self.now
            )

        with ThreadPoolExecutor(max_workers=8) as workers:
            winners = [
                result for result in workers.map(select, range(8)) if result
            ]
        self.assertEqual(len(winners), 1)

    def test_scheduled_and_priority_paths_share_pending_fresh_and_deferred_eligibility(
        self,
    ) -> None:
        from f.tmdb_web.tmdb_crawl_providers import iterate, fetch

        scheduled = importlib.import_module(
            "f.tmdb_web.tmdb_crawl_providers.next"
        )
        now = datetime.utcnow()
        pending = self.country(country_code="US")
        fresh = self.country(
            country_code="DE",
            tmdb_watch_url="https://www.themoviedb.org/movie/42/watch?locale=DE",
            updated_at=now,
            next_fetch_at=now + timedelta(days=7),
        )
        deferred = self.country(
            country_code="FR",
            tmdb_watch_url="https://www.themoviedb.org/movie/42/watch?locale=FR",
            next_fetch_at=now + timedelta(hours=1),
            consecutive_failures=1,
        )
        from contextlib import ExitStack

        with ExitStack() as stack:
            for module in (iterate, fetch, scheduled):
                for name in ("init_mongodb", "close_mongodb"):
                    stack.enter_context(patch.object(module, name))
                stack.enter_context(
                    patch.object(module, "get_db", return_value=self.db)
                )
            selected = scheduled.main()
            self.assertEqual(
                selected, {"movie_ids": [str(pending)], "tv_ids": []}
            )
            priority = iterate.main(
                {
                    "movie_ids": [str(pending), str(fresh), str(deferred)],
                    "tv_ids": [],
                }
            )
            response = SimpleNamespace(
                status_code=200,
                text='<div id="ott_offers_window"><p class="no_offers">No offers.</p></div>' + country_control('US'),
                headers={},
            )
            http = stack.enter_context(
                patch.object(fetch.requests, "get", return_value=response)
            )
            outcomes = [
                fetch.main(identity)["outcome"] for identity in priority
            ]
            self.assertEqual(outcomes, ["fetched", "fresh", "deferred"])
            self.assertEqual(http.call_count, 1)
            self.assertEqual(scheduled.main(), {"movie_ids": [], "tv_ids": []})

    def test_all_pending_countries_are_fetched_once_and_rate_limit_preserves_old_data(
        self,
    ) -> None:
        from f.tmdb_web.tmdb_crawl_providers import fetch

        ids = [
            self.country(
                country_code=code,
                tmdb_watch_url=f"https://www.themoviedb.org/movie/42/watch?locale={code}",
            )
            for code in ("US", "DE", "FR")
        ]
        html = '<div id="ott_offers_window"><div class="ott_provider"><h3>Stream</h3><li class="ott_filter_best_price"><a href="https://provider.example/watch" title="Watch on Example">Watch</a></li></div></div>'
        response = SimpleNamespace(status_code=200, text=html, headers={})
        with (
            patch.object(fetch, "init_mongodb"),
            patch.object(fetch, "close_mongodb"),
            patch.object(fetch, "get_db", return_value=self.db),
            patch.object(fetch.requests, "get", return_value=response) as http,
        ):
            for identity in ids:
                response.text = html + country_control(self.collection.find_one({"_id": identity})["country_code"])
                self.assertEqual(
                    fetch.main({"id": str(identity), "type": "movie"})[
                        "outcome"
                    ],
                    "fetched",
                )
            for identity in ids:
                response.text = html + country_control(self.collection.find_one({"_id": identity})["country_code"])
                self.assertEqual(
                    fetch.main({"id": str(identity), "type": "movie"})[
                        "outcome"
                    ],
                    "fresh",
                )
            self.assertEqual(http.call_count, 3)
            self.collection.update_one(
                {"_id": ids[0]},
                {"$set": {"next_fetch_at": datetime(1970, 1, 1)}},
            )
            old = self.collection.find_one({"_id": ids[0]})
            http.return_value = SimpleNamespace(
                status_code=429, text="", headers={"Retry-After": "36000"}
            )
            result = fetch.main({"id": str(ids[0]), "type": "movie"})
            self.assertTrue(result["retry_saved"])
            self.assertEqual(result["outcome"], "failed")
            saved = self.collection.find_one({"_id": ids[0]})
            self.assertEqual(saved["updated_at"], old["updated_at"])
            self.assertEqual(saved["streaming_links"], old["streaming_links"])
            self.assertGreater(
                saved["next_fetch_at"], datetime.utcnow() + timedelta(hours=9)
            )
            other = self.country(
                tmdb_id=43,
                tmdb_watch_url="https://www.themoviedb.org/movie/43/watch?locale=US",
            )
            self.assertEqual(
                fetch.main({"id": str(other), "type": "movie"})["outcome"],
                "deferred",
            )
            self.assertEqual(http.call_count, 4)

    def test_count_only_handoff_fails_loudly_before_database_access(
        self,
    ) -> None:
        from f.tmdb_web.tmdb_crawl_providers import iterate

        with patch.object(iterate, "init_mongodb") as connect:
            with self.assertRaisesRegex(ValueError, "movie_ids"):
                iterate.main({"count_new_movies": 5, "count_new_tv": 0})
            connect.assert_not_called()

    def test_backfill_dry_run_and_resume_do_not_change_completed_retry_state(
        self,
    ) -> None:
        first = self.country(
            next_fetch_at=self.now + timedelta(hours=2), consecutive_failures=2
        )
        second = self.country(
            tmdb_id=43,
            tmdb_watch_url="https://www.themoviedb.org/movie/43/watch?locale=US",
        )
        before = list(self.collection.find())
        preview = country_state.backfill(
            self.collection, "movie", batch_size=1, dry_run=True
        )
        self.assertEqual(list(self.collection.find()), before)
        self.assertFalse(preview["done"])
        from bson import ObjectId

        result = country_state.backfill(
            self.collection,
            "movie",
            after_id=ObjectId(preview["after_id"]),
            batch_size=1,
        )
        self.assertEqual(result["after_id"], str(second))
        self.assertEqual(self.collection.find_one({"_id": first}), before[0])
        country_state.backfill(self.collection, "movie")
        self.assertEqual(
            self.collection.find_one({"_id": first})["next_fetch_at"],
            self.now + timedelta(hours=2),
        )
        self.assertEqual(
            self.collection.find_one({"_id": first})["consecutive_failures"], 2
        )

    def test_invalid_batch_does_not_starve_the_next_valid_country(
        self,
    ) -> None:
        import importlib
        from f.tmdb_web.tmdb_crawl_providers import fetch

        selector = importlib.import_module(
            "f.tmdb_web.tmdb_crawl_providers.next"
        )
        invalid = [
            self.country(
                tmdb_id=n, tmdb_watch_url="https://invalid.example/watch"
            )
            for n in range(5)
        ]
        valid = self.country(
            tmdb_id=99,
            tmdb_watch_url="https://www.themoviedb.org/movie/99/watch?locale=US",
        )
        with (
            patch.object(selector, "init_mongodb"),
            patch.object(selector, "close_mongodb"),
            patch.object(selector, "get_db", return_value=self.db),
            patch.object(fetch, "init_mongodb"),
            patch.object(fetch, "close_mongodb"),
            patch.object(fetch, "get_db", return_value=self.db),
            patch.object(fetch.requests, "get") as http,
        ):
            first = selector.main()["movie_ids"]
            self.assertEqual(
                set(first), {str(identity) for identity in invalid}
            )
            for identity in first:
                self.assertEqual(
                    fetch.main({"type": "movie", "id": identity})["outcome"],
                    "failed",
                )
            self.assertIn(str(valid), selector.main()["movie_ids"])
            http.assert_not_called()
        self.assertEqual(self.collection.count_documents({}), 6)
        self.assertEqual(
            self.collection.count_documents(
                {"country_identity_error": {"$exists": True}}
            ),
            5,
        )


if __name__ == "__main__":
    unittest.main()
