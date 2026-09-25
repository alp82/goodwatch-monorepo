"""IMDb fetch acceptance at the script persistence boundary."""
import sys
import unittest
from datetime import datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.imdb_web.imdb_crawl_ratings import fetch
from f.imdb_web.models import ImdbMovieRating


class ImdbFetchTests(unittest.TestCase):
    def test_http_200_missing_or_wrong_page_identity_is_not_success(self) -> None:
        for html in ("<html>Challenge</html>", '<link rel="canonical" href="https://www.imdb.com/title/tt0000001/">'):
            with self.subTest(html=html), patch.object(fetch.requests, "get", return_value=SimpleNamespace(status_code=200, text=html)):
                with self.assertRaisesRegex(RuntimeError, "page identity"):
                    fetch.crawl_imdb_page("tt0111161")

    def test_identified_page_without_numeric_rating_remains_unverified(self) -> None:
        html = '<link rel="canonical" href="https://www.imdb.com/title/tt0111161/">'
        with patch.object(fetch.requests, "get", return_value=SimpleNamespace(status_code=200, text=html)):
            with self.assertRaisesRegex(RuntimeError, "no verified numeric rating"):
                fetch.crawl_imdb_page("tt0111161")

    def test_verified_numeric_rating_updates_source_and_clears_old_failure(self) -> None:
        html = '\n'.join([
            '<link rel="canonical" href="https://www.imdb.com/title/tt0111161/">',
            '<div><div data-testid="hero-rating-bar__aggregate-rating__score"><span>9.3</span></div>',
            '<div>out of 10</div><div>1.2M</div></div>',
        ])
        entry = ImdbMovieRating(tmdb_id=278, imdb_id="tt0111161", original_title="Example",
                                updated_at=datetime(2026, 9, 1), failed_at=datetime(2026, 9, 2),
                                error_message="IMDb HTTP 202", is_selected=True)
        with patch.object(fetch, "init_mongodb"), patch.object(fetch, "close_mongodb"), \
             patch.object(fetch, "get_document_for_id", return_value=entry), \
             patch.object(ImdbMovieRating, "save") as save, \
             patch.object(fetch.requests, "get", return_value=SimpleNamespace(status_code=200, text=html)) as request:
            result = fetch.main({"id": "unused", "type": "movie", "tmdb_id": 278})
        self.assertEqual(result["ratings"]["user_score_original"], 9.3)
        self.assertEqual(entry.user_score_vote_count, 1200000)
        self.assertGreater(entry.updated_at, datetime(2026, 9, 1))
        self.assertIsNone(entry.failed_at)
        self.assertIsNone(entry.error_message)
        self.assertFalse(entry.is_selected)
        self.assertEqual(request.call_args.kwargs["timeout"], 15)
        save.assert_called_once()

    def test_abbreviated_vote_counts_keep_their_decimal(self) -> None:
        """Before 2026-09-11 the parser dropped the dot, so "2.5M" became 25,000,000."""
        for text, expected in (("2.5M", 2_500_000), ("2.2K", 2_200), ("15K", 15_000),
                               ("1,234", 1_234), ("1.2B", 1_200_000_000)):
            html = '\n'.join([
                '<link rel="canonical" href="https://www.imdb.com/title/tt0903747/">',
                '<div><div data-testid="hero-rating-bar__aggregate-rating__score"><span>9.5</span></div>',
                f'<div>out of 10</div><div>{text}</div></div>',
            ])
            with self.subTest(text=text), patch.object(
                    fetch.requests, "get", return_value=SimpleNamespace(status_code=200, text=html)):
                self.assertEqual(fetch.crawl_imdb_page("tt0903747").user_score_vote_count, expected)

    def test_empty_http_202_does_not_refresh_previous_rating(self) -> None:
        previous = datetime(2026, 9, 1)
        entry = ImdbMovieRating(tmdb_id=278, imdb_id="tt0111161", original_title="Example",
                                updated_at=previous, user_score_original=9.3,
                                user_score_normalized_percent=93, user_score_vote_count=100,
                                is_selected=True)
        with patch.object(fetch, "init_mongodb"), patch.object(fetch, "close_mongodb") as close, \
             patch.object(fetch, "get_document_for_id", return_value=entry), \
             patch.object(ImdbMovieRating, "save") as save, \
             patch.object(fetch.requests, "get", return_value=SimpleNamespace(status_code=202, text="")):
            with self.assertRaisesRegex(RuntimeError, "IMDb HTTP 202"):
                fetch.main({"id": "unused", "type": "movie", "tmdb_id": 278})
        self.assertEqual(entry.updated_at, previous)
        self.assertEqual(entry.user_score_original, 9.3)
        self.assertEqual(entry.user_score_vote_count, 100)
        self.assertIsNotNone(entry.failed_at)
        self.assertFalse(entry.is_selected)
        save.assert_called_once()
        close.assert_called_once()


if __name__ == "__main__":
    unittest.main()
