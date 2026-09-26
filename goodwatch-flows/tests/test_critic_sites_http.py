"""The polite HTTP client the Rotten Tomatoes and Metacritic crawlers share (#152).

One request every 2 s per site across every worker, an honest User-Agent, and a
403, 429 or bot challenge stops the site's crawl until a recorded deadline.
"""
import sys
import unittest
from datetime import datetime, timedelta
from pathlib import Path

import mongomock
import requests

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.critic_sites import polite_http

NOW = datetime(2026, 9, 25, 12, 0, 0)


class FakeResponse:
    def __init__(self, status_code=200, text="<html></html>", headers=None, url=None):
        self.status_code = status_code
        self.text = text
        self.headers = headers or {}
        self.url = url


class FakeHttp:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def get(self, url, headers=None, timeout=None, allow_redirects=None):
        self.calls.append({"url": url, "headers": headers, "timeout": timeout, "allow_redirects": allow_redirects})
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        if response.url is None:
            response.url = url
        return response


class Clock:
    def __init__(self, now=NOW):
        self.now = now
        self.slept = []

    def __call__(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(round(seconds, 3))
        self.now += timedelta(seconds=seconds)


class PoliteClientTests(unittest.TestCase):
    def setUp(self):
        self.db = mongomock.MongoClient().db
        self.clock = Clock()

    def client(self, responses, site="rotten_tomatoes"):
        self.http = FakeHttp(responses)
        return polite_http.PoliteClient(self.db, site, http=self.http, sleep=self.clock.sleep, clock=self.clock)

    def test_requests_identify_the_crawler_and_time_out(self):
        page = self.client([FakeResponse(200, "ok", url="https://www.rottentomatoes.com/tv/the-mentalist")]).get(
            "https://www.rottentomatoes.com/tv/the_mentalist")
        call = self.http.calls[0]
        self.assertIn("GoodWatchBot", call["headers"]["User-Agent"])
        self.assertIn("goodwatch.app", call["headers"]["User-Agent"])
        self.assertEqual(call["timeout"], 15)
        self.assertTrue(call["allow_redirects"])
        self.assertEqual(page.url, "https://www.rottentomatoes.com/tv/the-mentalist")
        self.assertTrue(page.redirected)

    def test_a_site_can_name_its_own_user_agent_and_pace(self):
        # TV Tropes shares the block handling but identifies its own crawl and paces slower.
        self.http = FakeHttp([FakeResponse(), FakeResponse()])
        client = polite_http.PoliteClient(self.db, "tvtropes", http=self.http, sleep=self.clock.sleep,
                                          clock=self.clock, interval=6, user_agent="GoodWatchBot/0.1 tvtropes")
        client.get("https://tvtropes.org/pmwiki/pmwiki.php/Film/A")
        client.get("https://tvtropes.org/pmwiki/pmwiki.php/Film/B")
        self.assertEqual(self.http.calls[0]["headers"]["User-Agent"], "GoodWatchBot/0.1 tvtropes")
        self.assertEqual(self.clock.slept, [6.0])
        self.assertIn("critic-scores", polite_http.HEADERS["User-Agent"])

    def test_requests_are_spaced_two_seconds_apart_per_site(self):
        client = self.client([FakeResponse(), FakeResponse(), FakeResponse()])
        client.get("https://www.rottentomatoes.com/a")
        client.get("https://www.rottentomatoes.com/b")
        client.get("https://www.rottentomatoes.com/c")
        self.assertEqual(self.clock.slept, [2.0, 2.0])

    def test_pacing_is_shared_between_clients_of_the_same_site(self):
        first = self.client([FakeResponse()])
        first.get("https://www.rottentomatoes.com/a")
        second = self.client([FakeResponse()])
        second.get("https://www.rottentomatoes.com/b")
        self.assertEqual(self.clock.slept, [2.0])
        other_site = self.client([FakeResponse()], site="metacritic")
        other_site.get("https://www.metacritic.com/tv/x/")
        self.assertEqual(self.clock.slept, [2.0])

    def test_429_stops_the_site_until_retry_after(self):
        client = self.client([FakeResponse(429, headers={"Retry-After": "7200"})])
        with self.assertRaises(polite_http.SiteBlocked) as raised:
            client.get("https://www.rottentomatoes.com/tv/x")
        self.assertEqual(raised.exception.until, NOW + timedelta(seconds=7200))
        self.assertEqual(polite_http.blocked_until(self.db, "rotten_tomatoes", NOW), NOW + timedelta(seconds=7200))
        log = self.db[polite_http.BLOCK_LOG].find_one()
        self.assertEqual((log["site"], log["status"], log["url"]), ("rotten_tomatoes", 429, "https://www.rottentomatoes.com/tv/x"))

    def test_short_retry_after_still_blocks_at_least_an_hour(self):
        client = self.client([FakeResponse(429, headers={"Retry-After": "5"})])
        with self.assertRaises(polite_http.SiteBlocked) as raised:
            client.get("https://www.rottentomatoes.com/tv/x")
        self.assertEqual(raised.exception.until, NOW + timedelta(hours=1))

    def test_403_and_challenges_block_for_a_day(self):
        for response in (FakeResponse(403),
                         FakeResponse(503, headers={"cf-mitigated": "challenge"}),
                         FakeResponse(200, "<html><head><title>Just a moment...</title></head></html>"),
                         FakeResponse(202, "")):
            self.db[polite_http.STATE].delete_many({})
            with self.assertRaises(polite_http.SiteBlocked) as raised:
                self.client([response], site="metacritic").get("https://www.metacritic.com/tv/x/")
            self.assertEqual(raised.exception.until, self.clock.now + timedelta(hours=24))

    def test_a_blocked_site_sends_no_request(self):
        self.db[polite_http.STATE].insert_one({"_id": "metacritic", "blocked_until": NOW + timedelta(hours=3)})
        client = self.client([FakeResponse()], site="metacritic")
        with self.assertRaises(polite_http.SiteBlocked):
            client.get("https://www.metacritic.com/tv/x/")
        self.assertEqual(self.http.calls, [])

    def test_a_page_mentioning_the_challenge_script_is_not_a_block(self):
        text = "<html><title>The Bear</title><script>a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js'</script>"
        page = self.client([FakeResponse(200, text)], site="metacritic").get("https://www.metacritic.com/tv/x/")
        self.assertEqual(page.status, 200)

    def test_404_and_server_errors_are_returned_not_raised(self):
        client = self.client([FakeResponse(404), FakeResponse(500)])
        self.assertEqual(client.get("https://www.rottentomatoes.com/tv/x").status, 404)
        self.assertEqual(client.get("https://www.rottentomatoes.com/tv/y").status, 500)

    def test_network_errors_raise_fetch_error(self):
        client = self.client([requests.exceptions.ReadTimeout("slow")])
        with self.assertRaises(polite_http.FetchError):
            client.get("https://www.rottentomatoes.com/tv/x")


if __name__ == "__main__":
    unittest.main()
