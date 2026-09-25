"""TMDB 404 handling: only status_code 34 flags a title as deleted."""
import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.data_source.common import not_deleted_filter
from f.dna.models import DnaMovie
from f.imdb_web.models import ImdbTvRating
from f.tmdb_api import deleted_propagation
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails
from f.tmdb_daily.models import TmdbDailyDumpData

with patch("wmill.get_variable", return_value="unused"):
    from f.tmdb_api.tmdb_fetch_details_from_api import fetch


def http_error(status, body=None):
    response = MagicMock(status_code=status)
    if body is None:
        response.json.side_effect = ValueError("no json")
    else:
        response.json.return_value = body
    return requests.HTTPError(response=response)


class TmdbDeletedTests(unittest.TestCase):
    def run_fetch(self, entry, error):
        with patch.object(fetch, "fetch_movie_data", side_effect=error), patch.object(
            fetch, "fetch_tv_data", side_effect=error
        ), patch.object(type(entry), "update") as update:
            try:
                return asyncio.run(fetch.fetch_api_data(entry)), update
            except requests.HTTPError:
                return "raised", update

    def test_status_code_34_flags_deleted(self):
        for model in (TmdbMovieDetails, TmdbTvDetails):
            result, update = self.run_fetch(
                model(tmdb_id=42), http_error(404, {"success": False, "status_code": 34})
            )
            self.assertIsNone(result)
            kwargs = update.call_args.kwargs
            self.assertIs(kwargs["set__tmdb_deleted"], True)
            self.assertEqual(kwargs["set__tmdb_deleted_at"], kwargs["set__updated_at"])
            self.assertIs(kwargs["set__is_selected"], False)
            self.assertEqual(kwargs["set__watch_providers_error"], "tmdb_not_found")

    def test_other_failures_reraise_without_flag(self):
        for error in (
            http_error(404),
            http_error(404, {"status_code": 7}),
            http_error(404, ["unexpected"]),
            http_error(500, {"status_code": 34}),
        ):
            result, update = self.run_fetch(TmdbMovieDetails(tmdb_id=42), error)
            self.assertEqual(result, "raised")
            kwargs = update.call_args.kwargs
            self.assertNotIn("set__tmdb_deleted", kwargs)
            self.assertEqual(kwargs["set__watch_providers_error"], "provider_request_failed")

    def test_result_reports_deleted_ids_and_batch_survives(self):
        entries = [TmdbMovieDetails(tmdb_id=1), TmdbTvDetails(tmdb_id=2)]
        deleted = http_error(404, {"status_code": 34})
        with patch.object(fetch, "fetch_movie_data", side_effect=deleted), patch.object(
            fetch, "fetch_tv_data", side_effect=lambda entry: ({"id": 2, "name": "Show"}, entry)
        ), patch.object(TmdbMovieDetails, "update"), patch.object(TmdbTvDetails, "save"):
            result = asyncio.run(fetch.tmdb_fetch_details_from_api(entries))
        self.assertEqual(result["deleted_tmdb_ids"], {"movie_ids": [1], "tv_ids": []})
        self.assertEqual(result["count_deleted_entries"], 1)
        self.assertEqual(result["count_new_entries"], 1)

    def test_successful_save_clears_flag(self):
        entry = TmdbMovieDetails(tmdb_id=42, tmdb_deleted=True)
        with patch.object(TmdbMovieDetails, "save"):
            asyncio.run(fetch.convert_and_save_details(entry, {"id": 42}))
        self.assertIs(entry.tmdb_deleted, False)
        self.assertIsNone(entry.tmdb_deleted_at)

    def test_queue_filter_only_for_models_with_flag(self):
        self.assertEqual(
            not_deleted_filter(TmdbMovieDetails).to_query(TmdbMovieDetails),
            {"tmdb_deleted": {"$ne": True}},
        )
        self.assertEqual(not_deleted_filter(TmdbDailyDumpData).to_query(TmdbDailyDumpData), {})

    def test_source_models_carry_flag_and_provider_queue_filters_it(self):
        from f.tmdb_web.country_state import eligibility

        for model in (DnaMovie, ImdbTvRating):
            self.assertEqual(
                not_deleted_filter(model).to_query(model), {"tmdb_deleted": {"$ne": True}}
            )
        self.assertIn({"tmdb_deleted": {"$ne": True}}, eligibility()["$and"])


class TmdbDeletedPropagationTests(unittest.TestCase):
    def test_flagging_propagates_once_per_media_type(self):
        entries = [TmdbMovieDetails(tmdb_id=1), TmdbMovieDetails(tmdb_id=3), TmdbTvDetails(tmdb_id=2)]
        deleted = http_error(404, {"status_code": 34})
        with patch.object(fetch, "fetch_movie_data", side_effect=deleted), patch.object(
            fetch, "fetch_tv_data", side_effect=lambda entry: ({"id": 2, "name": "Show"}, entry)
        ), patch.object(TmdbMovieDetails, "update"), patch.object(TmdbTvDetails, "save"), patch.object(
            fetch, "propagate_tmdb_deleted"
        ) as propagate:
            asyncio.run(fetch.tmdb_fetch_details_from_api(entries))
        self.assertEqual(
            [call.args for call in propagate.call_args_list],
            [("movie", [1, 3], True), ("tv", [], True)],
        )

    def test_helper_updates_only_collections_of_the_media_type(self):
        db = MagicMock()
        with patch.object(deleted_propagation, "get_db", return_value=db):
            deleted_propagation.propagate_tmdb_deleted("tv", ["7", 8], True)
            deleted_propagation.propagate_tmdb_deleted("movie", [], True)
        self.assertEqual(
            [call.args[0] for call in db.__getitem__.call_args_list],
            [
                "imdb_tv_rating",
                "metacritic_tv_rating",
                "rotten_tomatoes_tv_rating",
                "tv_tropes_tv_tags",
                "tmdb_tv_providers",
                "dna_tv",
            ],
        )
        for call in db.__getitem__.return_value.update_many.call_args_list:
            self.assertEqual(
                call.args, ({"tmdb_id": {"$in": [7, 8]}}, {"$set": {"tmdb_deleted": True}})
            )

    def test_restore_propagates_only_on_flag_change(self):
        for was_deleted, model, expected in (
            (True, TmdbMovieDetails, [("movie", [42], False)]),
            (True, TmdbTvDetails, [("tv", [42], False)]),
            (False, TmdbMovieDetails, []),
        ):
            entry = model(tmdb_id=42, tmdb_deleted=was_deleted)
            with patch.object(model, "save"), patch.object(
                fetch, "propagate_tmdb_deleted"
            ) as propagate:
                asyncio.run(fetch.convert_and_save_details(entry, {"id": 42}))
            self.assertEqual([call.args for call in propagate.call_args_list], expected)

    def test_propagation_errors_do_not_fail_the_batch(self):
        db = MagicMock()
        db.__getitem__.return_value.update_many.side_effect = RuntimeError("mongo down")
        entries = [TmdbMovieDetails(tmdb_id=1), TmdbTvDetails(tmdb_id=2, tmdb_deleted=True)]
        deleted = http_error(404, {"status_code": 34})
        with patch.object(fetch, "fetch_movie_data", side_effect=deleted), patch.object(
            fetch, "fetch_tv_data", side_effect=lambda entry: ({"id": 2, "name": "Show"}, entry)
        ), patch.object(TmdbMovieDetails, "update"), patch.object(TmdbTvDetails, "save"), patch.object(
            deleted_propagation, "get_db", return_value=db
        ):
            result = asyncio.run(fetch.tmdb_fetch_details_from_api(entries))
        self.assertEqual(db.__getitem__.return_value.update_many.call_count, 12)
        self.assertEqual(result["count_deleted_entries"], 1)
        self.assertEqual(result["count_new_entries"], 1)


if __name__ == "__main__":
    unittest.main()
