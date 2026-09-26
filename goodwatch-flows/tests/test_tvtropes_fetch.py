"""The production per-title TV Tropes fetch (`f/priority/crawl_all` with crawl_tvtropes on).

It crawls only the stored URL, shares the site's pace and block state, and reports a
block instead of raising, so the flow never retries through it.
"""

import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.critic_sites import polite_http
from f.tvtropes_web.models import TropeData, TvTropesMovieTags, TvTropesTvTags
from f.tvtropes_web.title_variations import title_variations
from f.tvtropes_web.tv_tropes_crawl_tags import fetch

BASE = "https://tvtropes.org/pmwiki/pmwiki.php/"
NOW = datetime(2026, 9, 26, 12, 0, 0)
TROPE = '<li><a href="/pmwiki/pmwiki.php/Main/BigBad">Big Bad</a>: A villain.</li>'
WORK = f'<div id="main-article"><p>Example is a 2000 film.</p><h2>Tropes</h2><ul>{TROPE}</ul></div>'


class SlugTests(unittest.TestCase):
    def test_actual_broken_title_shapes(self):
        cases = {
            "12 Angry Men": "TwelveAngryMen",
            "300": "ThreeHundred",
            "2001: A Space Odyssey": "TwoThousandOneASpaceOdyssey",
            "(500) Days of Summer": "FiveHundredDaysOfSummer",
            "Fast & Furious 6": "FastAndFurious6",
            "Amélie": "Amelie",
            "Léon: The Professional": "LeonTheProfessional",
            "Kill Bill: Vol. 1": "KillBill",
            "Dr. Strangelove or: How I Learned to Stop Worrying": "DrStrangelove",
            "Marvel's Agents of S.H.I.E.L.D.": "AgentsOfSHIELD",
        }
        for title, expected in cases.items():
            with self.subTest(title=title):
                self.assertIn(expected, title_variations([title]))
        self.assertEqual(title_variations(["", "東京"]), [])

    def test_year_like_titles_also_get_the_year_reading(self):
        self.assertIn("NineteenSeventeen", title_variations(["1917"]))
        self.assertIn("OneThousandNineHundredSeventeen", title_variations(["1917"]))
        self.assertIn("NineteenFortyOneTheMovie", title_variations(["1941 The Movie"]))
        self.assertEqual(title_variations(["300"]), ["300", "ThreeHundred"])
        self.assertEqual(len(title_variations(["2001"])), 2)


class FakeResponse:
    def __init__(self, status_code=200, text=WORK, headers=None, url=None):
        self.status_code, self.text, self.headers, self.url = status_code, text, headers or {}, url


class FakeHttp:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, headers=None, timeout=None, allow_redirects=None):
        self.calls.append(url)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        response.url = response.url or url
        return response


class FetchTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.now = NOW
        save = patch.object(TvTropesMovieTags, "save")
        self.save = save.start()
        self.addCleanup(save.stop)

    def client(self, responses):
        self.http = FakeHttp(responses)
        return polite_http.PoliteClient(self.db, fetch.SITE, http=self.http, sleep=lambda s: None,
                                        clock=lambda: self.now, interval=fetch.REQUEST_INTERVAL_SECONDS,
                                        user_agent=fetch.crawl.USER_AGENT)

    def entry(self, **fields):
        fields = {"tmdb_id": 1, "original_title": "Example", "release_year": 2000, "is_selected": True,
                  "tvtropes_url": BASE + "Film/Example2000", **fields}
        return TvTropesMovieTags(**fields)

    def test_the_stored_url_is_crawled_and_stored(self):
        entry = self.entry()
        report = fetch.fetch_entry(entry, self.client([FakeResponse()]), self.now)
        self.assertEqual(self.http.calls, [BASE + "Film/Example2000"])
        self.assertEqual(report["status"], "recovered")
        self.assertEqual([t.name for t in entry.tropes], ["Big Bad"])
        self.assertEqual((entry.updated_at, entry.failed_at, entry.is_selected), (NOW, None, False))
        self.save.assert_called_once()

    def test_a_title_without_a_stored_url_is_never_guessed(self):
        entry = self.entry(tvtropes_url=None)
        report = fetch.fetch_entry(entry, self.client([]), self.now)
        self.assertEqual(report["status"], "no_known_url")
        self.assertEqual(self.http.calls, [])
        self.assertFalse(entry.is_selected)
        self.assertIsNone(entry.failed_at)

    def test_a_block_is_reported_not_raised_and_stops_the_site(self):
        old = datetime(2026, 1, 1)
        entry = self.entry(updated_at=old, tropes=[TropeData(name="Old")])
        report = fetch.fetch_entry(entry, self.client([FakeResponse(403)]), self.now)
        self.assertIn("HTTP 403", report["blocked"])
        self.assertEqual((entry.updated_at, entry.tropes[0].name), (old, "Old"))
        self.assertEqual(entry.failed_at, NOW)
        self.assertFalse(entry.is_selected)
        self.assertEqual(polite_http.blocked_until(self.db, fetch.SITE, NOW), NOW + timedelta(hours=24))
        self.assertEqual(self.db[polite_http.BLOCK_LOG].count_documents({"site": "tvtropes"}), 1)
        # The next title sends no request while the site is blocked.
        report = fetch.fetch_entry(self.entry(tmdb_id=2), self.client([FakeResponse()]), self.now)
        self.assertIn("blocked earlier", report["blocked"])
        self.assertEqual(self.http.calls, [])

    def test_a_challenge_page_is_a_block(self):
        challenge = FakeResponse(200, "<html><head><title>Just a moment...</title></head></html>")
        report = fetch.fetch_entry(self.entry(), self.client([challenge]), self.now)
        self.assertIn("challenge", report["blocked"])

    def test_a_crawl_error_is_recorded_not_raised(self):
        entry = self.entry(tropes=[TropeData(name="Old")])
        report = fetch.fetch_entry(entry, self.client([FakeResponse(503, "down")]), self.now)
        self.assertIn("HTTP 503", report["error"])
        self.assertEqual(entry.tropes[0].name, "Old")
        self.assertEqual(entry.failed_at, NOW)

    def test_a_missing_or_wrong_page_keeps_existing_data_for_review(self):
        entry = self.entry(tropes=[TropeData(name="Old")])
        report = fetch.fetch_entry(entry, self.client([FakeResponse(404, "gone")]), self.now)
        self.assertEqual(report["status"], "not_found")
        self.assertEqual((entry.tvtropes_url, entry.tropes[0].name), (BASE + "Film/Example2000", "Old"))
        self.assertEqual(entry.failed_at, NOW)
        self.assertIn("not_found", entry.error_message)

    def test_a_title_crawled_in_the_past_day_is_skipped(self):
        for field in ("updated_at", "failed_at"):
            entry = self.entry(**{field: NOW - timedelta(hours=3)})
            report = fetch.fetch_entry(entry, self.client([]), self.now)
            self.assertEqual(report["status"], "recently_crawled", field)
            self.assertFalse(entry.is_selected)
        self.assertEqual(self.http.calls, [])

    def test_shows_use_the_series_namespace(self):
        entry = TvTropesTvTags(tmdb_id=3, original_title="Example", release_year=2000,
                               tvtropes_url=BASE + "Film/Example2000")
        with patch.object(TvTropesTvTags, "save"):
            report = fetch.fetch_entry(entry, self.client([]), self.now)
        self.assertEqual(report["status"], "rejected")
        self.assertEqual(self.http.calls, [])


if __name__ == "__main__":
    unittest.main()
