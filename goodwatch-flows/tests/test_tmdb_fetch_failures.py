"""Per-title failure isolation, secret redaction and the batch failure policy."""
import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

import requests

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.tmdb_api.models import TmdbMovieDetails, TmdbTvDetails

API_KEY = "sekret-key-123"

with patch("wmill.get_variable", return_value="unused"):
    from f.tmdb_api.tmdb_fetch_details_from_api import fetch


def http_error(status, body=None):
    response = MagicMock(status_code=status)
    if body is None:
        response.json.side_effect = ValueError("no json")
    else:
        response.json.return_value = body
    url = f"https://api.themoviedb.org/3/movie/1?api_key={API_KEY}&append_to_response=x"
    return requests.HTTPError(f"{status} Server Error for url: {url}", response=response)


class TmdbFetchFailureTests(unittest.TestCase):
    def run_batch(self, entries, errors):
        """errors maps tmdb_id to the exception its fetch raises."""

        def fetch_data(entry):
            if entry.tmdb_id in errors:
                raise errors[entry.tmdb_id]
            return {"id": entry.tmdb_id, "title": "T", "name": "T"}, entry

        with patch.object(fetch, "TMDB_API_KEY", API_KEY), patch.object(
            fetch, "fetch_movie_data", side_effect=fetch_data
        ), patch.object(fetch, "fetch_tv_data", side_effect=fetch_data), patch.object(
            TmdbMovieDetails, "update"
        ) as update, patch.object(TmdbTvDetails, "update"), patch.object(
            TmdbMovieDetails, "save"
        ) as save, patch.object(TmdbTvDetails, "save"), patch.object(
            fetch, "propagate_tmdb_deleted"
        ) as propagate, patch("builtins.print") as printed:
            try:
                result = asyncio.run(fetch.tmdb_fetch_details_from_api(entries))
            except RuntimeError as error:
                result = error
        logs = " ".join(str(call) for call in printed.call_args_list)
        return result, update, save, propagate, logs

    def test_one_failing_title_keeps_the_others(self):
        entries = [TmdbMovieDetails(tmdb_id=i) for i in (1, 2, 3)]
        result, update, save, _, logs = self.run_batch(
            entries, {2: http_error(500, {"status_code": 11, "status_message": "Internal error"})}
        )
        self.assertEqual(result["count_new_entries"], 2)
        self.assertEqual(save.call_count, 2)
        self.assertEqual(result["count_failed_entries"], 1)
        self.assertEqual(
            result["failed_entries"],
            [
                {
                    "media_type": "movie",
                    "tmdb_id": 2,
                    "error": "HTTPError",
                    "http_status": 500,
                    "tmdb_status_code": 11,
                    "message": "Internal error",
                }
            ],
        )
        # Bookkeeping is kept, then the title is released.
        bookkeeping, release = [call.kwargs for call in update.call_args_list]
        self.assertEqual(bookkeeping["set__watch_providers_error"], "provider_request_failed")
        self.assertIn("set__watch_providers_attempted_at", bookkeeping)
        self.assertEqual(release, {"set__is_selected": False})
        self.assertIn("'tmdb_id': 2", logs)
        self.assertNotIn(API_KEY, logs)
        self.assertNotIn(API_KEY, str(result))

    def test_connection_error_message_is_redacted(self):
        entries = [TmdbMovieDetails(tmdb_id=i) for i in (1, 2, 3)]
        error = requests.ConnectionError(f"Max retries: /3/movie/2?api_key={API_KEY}&x=1")
        result, _, _, _, logs = self.run_batch(entries, {2: error})
        self.assertIn("api_key=REDACTED&x=1", result["failed_entries"][0]["message"])
        self.assertNotIn(API_KEY, str(result))
        self.assertNotIn(API_KEY, logs)

    def test_save_and_identity_errors_are_isolated(self):
        entries = [TmdbMovieDetails(tmdb_id=1), TmdbMovieDetails(tmdb_id=2), TmdbTvDetails(tmdb_id=3)]
        with patch.object(
            fetch, "capture_provider_check", side_effect=[ValueError("identity"), None, None]
        ):
            result, update, _, _, _ = self.run_batch(entries, {})
        self.assertEqual(result["count_new_entries"], 2)
        self.assertEqual(result["failed_entries"][0]["error"], "ValueError")
        self.assertEqual(
            update.call_args_list[0].kwargs["set__watch_providers_error"], "identity_mismatch"
        )

    def test_all_failed_raises_without_the_key(self):
        entries = [TmdbMovieDetails(tmdb_id=1), TmdbMovieDetails(tmdb_id=2)]
        result, _, _, _, _ = self.run_batch(entries, {1: http_error(503), 2: http_error(503)})
        self.assertIsInstance(result, RuntimeError)
        self.assertIn("2 failed, 0 saved, 0 deleted of 2", str(result))
        self.assertNotIn(API_KEY, str(result))

    def test_over_half_failed_raises_after_saving_the_good_ones(self):
        entries = [TmdbMovieDetails(tmdb_id=i) for i in (1, 2, 3, 4, 5)]
        result, _, save, _, _ = self.run_batch(entries, {i: http_error(500) for i in (1, 2, 3)})
        self.assertIsInstance(result, RuntimeError)
        self.assertIn("3 failed, 2 saved", str(result))
        self.assertEqual(save.call_count, 2)

    def test_exactly_half_failed_returns(self):
        entries = [TmdbMovieDetails(tmdb_id=i) for i in (1, 2, 3, 4)]
        result, _, _, _, _ = self.run_batch(entries, {i: http_error(429) for i in (1, 2)})
        self.assertEqual(result["count_failed_entries"], 2)
        self.assertEqual(result["count_new_entries"], 2)

    def test_single_401_raises_after_saving(self):
        entries = [TmdbMovieDetails(tmdb_id=i) for i in (1, 2, 3, 4)]
        body = {"status_code": 7, "status_message": "Invalid API key"}
        result, _, save, _, _ = self.run_batch(entries, {1: http_error(401, body)})
        self.assertIsInstance(result, RuntimeError)
        self.assertIn("[401]", str(result))
        self.assertEqual(save.call_count, 3)

    def test_deleted_titles_are_not_failures(self):
        entries = [TmdbMovieDetails(tmdb_id=i) for i in (1, 2, 3)]
        deleted = {i: http_error(404, {"status_code": 34}) for i in (1, 2, 3)}
        result, _, _, propagate, _ = self.run_batch(entries, deleted)
        self.assertEqual(result["count_failed_entries"], 0)
        self.assertEqual(result["count_deleted_entries"], 3)
        # Deleted ones are propagated before a failing remainder raises.
        deleted.pop(3)
        result, _, _, propagate, _ = self.run_batch(entries, deleted | {3: http_error(500)})
        self.assertIsInstance(result, RuntimeError)
        self.assertEqual(propagate.call_args_list[0].args, ("movie", [1, 2], True))


if __name__ == "__main__":
    unittest.main()
