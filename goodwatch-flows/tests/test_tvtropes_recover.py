"""The local TV Tropes recovery runner: queue, pace, budget, blocks, negative cache,
resume and the review table the reviewed import reads. No network or database."""

import gzip
import json
import sys
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "windmill"))
import import_tvtropes_recovered as importer
import recover_tvtropes as runner

BASE = "https://tvtropes.org/pmwiki/pmwiki.php/"
NOW = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)
TROPE = '<li><a href="/pmwiki/pmwiki.php/Main/BigBad">Big Bad</a>: A villain.</li>'


def work(intro):
    return f'<div id="main-article"><p>{intro}</p><h2>Tropes</h2><ul>{TROPE}</ul></div>'


class FakeResponse:
    def __init__(self, status_code=200, text="", headers=None, url=None):
        self.status_code, self.text, self.headers, self.url = status_code, text, headers or {}, url
        self.content = text.encode()


class FakeHttp:
    """Pages by path; anything else is a 404. A value may be an exception to raise."""

    def __init__(self, pages):
        self.pages = pages
        self.calls = []
        self.headers = []

    def get(self, url, headers=None, timeout=None, allow_redirects=None):
        self.calls.append(url.removeprefix(BASE))
        self.headers.append(headers)
        response = self.pages.get(url.removeprefix(BASE), FakeResponse(404, "missing"))
        if isinstance(response, Exception):
            raise response
        response.url = response.url or url
        return response


class Clock:
    def __init__(self):
        self.t = 100.0
        self.slept = []

    def __call__(self):
        return self.t

    def sleep(self, seconds):
        self.slept.append(round(seconds, 3))
        self.t += seconds


def entry(tmdb_id, title, year, urls, popularity=1.0, media="movie"):
    return {"media_type": media, "tmdb_id": tmdb_id, "title": title, "release_year": year, "popularity": popularity,
            "title_variations": [], "candidates": [{"source": "stored", "url": BASE + u} for u in urls]}


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.queue = self.dir / "queue.json"
        self.state = self.dir / "state.json"
        self.out = self.dir / "run"
        self.clock = Clock()
        self.lines = []

    def run_queue(self, entries, pages, max_requests=30, now=NOW):
        self.queue.write_text(json.dumps({"entries": entries}))
        self.http = FakeHttp(pages)
        return runner.run(self.queue, self.out, self.state, 6, max_requests, http=self.http, sleep=self.clock.sleep,
                          clock=self.clock, now=lambda: now, out=self.lines.append)

    def results(self):
        return [json.loads(line) for line in (self.out / "results.jsonl").read_text().splitlines()]

    def test_titles_run_in_popularity_order_at_one_pace_with_an_honest_user_agent(self):
        summary = self.run_queue(
            [entry(1, "Alpha", 2000, ["Film/Alpha"], popularity=5), entry(2, "Beta", 2001, ["Film/Beta"], popularity=50)],
            {"Film/Alpha": FakeResponse(200, work("Alpha is a 2000 film.")),
             "Film/Beta": FakeResponse(200, work("Beta is a 2001 film."))})
        self.assertEqual(self.http.calls, ["Film/Beta", "Film/Alpha"])
        self.assertEqual(self.clock.slept, [6.0])
        self.assertRegex(self.http.headers[0]["User-Agent"], r"^GoodWatchBot/0\.1 \(\+https://goodwatch\.app; hello@goodwatch\.app\) tvtropes")
        self.assertEqual(summary["statuses"], {"recovered": 2})
        record = self.results()[0]
        self.assertEqual(record["result"]["url"], BASE + "Film/Beta")
        self.assertEqual(record["result"]["tropes"][0]["name"], "Big Bad")
        self.assertEqual(record["requests"][0]["status"], 200)
        source = self.out / record["requests"][0]["source_file"]
        self.assertIn(b"Beta is a 2001 film.", gzip.decompress(source.read_bytes()))

    def test_curated_urls_may_pass_the_known_url_rule(self):
        self.run_queue([entry(1, "Alpha", 1990, ["Series/Alpha"], media="show")],
                       {"Series/Alpha": FakeResponse(200, work("Alpha is a Dom Com that ran on NBC from 1990 to 2010."))})
        record = self.results()[0]
        self.assertEqual((record["status"], record["rule"]), ("recovered", "known_url"))

    def test_a_block_stops_the_run_is_logged_and_keeps_the_next_run_from_starting(self):
        summary = self.run_queue(
            [entry(1, "Alpha", 2000, ["Film/Alpha"], popularity=9), entry(2, "Beta", 2001, ["Film/Beta"])],
            {"Film/Alpha": FakeResponse(403, "<title>Just a moment...</title>", {"cf-mitigated": "challenge"})})
        self.assertEqual(self.http.calls, ["Film/Alpha"])
        self.assertIn("challenge", summary["stop_reason"])
        self.assertEqual(self.results()[0]["status"], "source_access_blocked")
        state = json.loads(self.state.read_text())
        self.assertEqual(state["blocked_until"], (NOW + timedelta(hours=24)).isoformat())
        self.assertEqual(state["blocks"][0]["url"], BASE + "Film/Alpha")
        with self.assertRaisesRegex(SystemExit, "not starting before"):
            self.run_queue([entry(2, "Beta", 2001, ["Film/Beta"])], {})
        self.assertEqual(self.http.calls, [])
        # After the deadline the same run resumes, starting with the blocked title.
        self.run_queue([entry(1, "Alpha", 2000, ["Film/Alpha"], popularity=9), entry(2, "Beta", 2001, ["Film/Beta"])],
                       {"Film/Alpha": FakeResponse(200, work("Alpha is a 2000 film."))}, now=NOW + timedelta(days=2))
        self.assertEqual(self.http.calls, ["Film/Alpha", "Film/Beta"])

    def test_429_waits_for_retry_after(self):
        self.run_queue([entry(1, "Alpha", 2000, ["Film/Alpha"])],
                       {"Film/Alpha": FakeResponse(429, "slow down", {"Retry-After": "7200"})})
        self.assertEqual(self.results()[0]["status"], "rate_limited")
        self.assertEqual(json.loads(self.state.read_text())["blocked_until"], (NOW + timedelta(hours=2)).isoformat())

    def test_not_found_and_rejected_urls_go_to_the_negative_cache(self):
        self.run_queue([entry(1, "Alpha", 2000, ["Film/Alpha", "Film/Alpha2000"]),
                        entry(2, "Beta", 2001, ["Film/Beta"])],
                       {"Film/Beta": FakeResponse(200, work("Beta is a 1990 film."))})
        self.assertEqual([r["status"] for r in self.results()], ["not_found", "rejected"])
        negative = json.loads(self.state.read_text())["negative"]
        self.assertEqual(negative[BASE + "Film/Alpha"]["outcome"], "not_found")
        self.assertEqual(negative[BASE + "Film/Beta"]["outcome"], "rejected")
        self.assertEqual(negative[BASE + "Film/Beta"]["until"], (NOW + timedelta(days=90)).isoformat())
        # Another run (another queue, same state) does not request them again before the date.
        self.out = self.dir / "run2"
        self.run_queue([entry(3, "Alpha", 2000, ["Film/Alpha"])], {})
        self.assertEqual(self.http.calls, [])
        self.assertEqual(self.results()[0]["status"], "no_known_url")

    def test_identity_rejections_expire_when_the_rules_change(self):
        state = runner.State(self.state)
        state.add_negative(BASE + "Series/A", "rejected", "identity", "show:1", NOW)
        state.add_negative(BASE + "Series/B", "not_found", "HTTP 404", "show:2", NOW)
        self.assertTrue(state.is_negative(BASE + "Series/A", NOW))
        state.negative[BASE + "Series/A"]["rules"] = "older rules"
        state.negative[BASE + "Series/B"]["rules"] = "older rules"
        self.assertFalse(state.is_negative(BASE + "Series/A", NOW))
        self.assertTrue(state.is_negative(BASE + "Series/B", NOW))

    def test_the_budget_stops_before_a_request_and_the_title_is_resumed(self):
        pages = {"Film/Alpha": FakeResponse(200, work("Alpha is a 2000 film.")),
                 "Film/Beta": FakeResponse(200, work("Beta is a 2001 film."))}
        entries = [entry(1, "Alpha", 2000, ["Film/Alpha"], popularity=9), entry(2, "Beta", 2001, ["Film/Beta"])]
        summary = self.run_queue(entries, pages, max_requests=1)
        self.assertEqual(self.http.calls, ["Film/Alpha"])
        self.assertIn("budget", summary["stop_reason"])
        self.assertEqual(summary["unattempted"], 1)
        self.run_queue(entries, pages, max_requests=5)
        self.assertEqual(self.http.calls, ["Film/Beta"])
        self.assertEqual([r["status"] for r in self.results()], ["recovered", "recovered"])

    def test_three_failures_in_a_row_stop_the_run(self):
        entries = [entry(i, f"T{i}", 2000, [f"Film/T{i}"], popularity=10 - i) for i in range(5)]
        summary = self.run_queue(entries, {f"Film/T{i}": requests.exceptions.ReadTimeout() for i in range(5)})
        self.assertEqual(len(self.http.calls), 3)
        self.assertIn("3 failures in a row", summary["stop_reason"])
        self.assertEqual([r["status"] for r in self.results()], ["failed"] * 3)

    def test_a_changed_queue_is_rejected_before_any_request(self):
        self.out.mkdir()
        (self.out / "manifest.sha256").write_text("another queue\n")
        with self.assertRaisesRegex(ValueError, "different queue"):
            self.run_queue([entry(1, "Alpha", 2000, ["Film/Alpha"])], {})
        self.assertEqual(self.http.calls if hasattr(self, "http") else [], [])

    def test_review_table_feeds_the_reviewed_import(self):
        self.run_queue([entry(1, "Alpha", 2000, ["Film/Alpha"], popularity=9), entry(2, "Beta", 2001, ["Film/Beta"])],
                       {"Film/Alpha": FakeResponse(200, work("Alpha is a 2000 film."))})
        path = runner.review(self.out)
        text = path.read_text()
        self.assertIn("| movie | 1 | Alpha | 2000 | Film/Alpha | 1 | stored (strict) |", text)
        self.assertIn("| movie | 2 | Beta | not_found |", text)
        # Unreviewed rows are not importable; a reviewer marks them ok.
        self.assertEqual(importer.parse_report_ok(path), {})
        path.write_text(text.replace("| review |", "| ok |"))
        manifest = importer.build_manifest([self.out], path, set(), expected=1)
        self.assertEqual([(e["media_type"], e["tmdb_id"], e["url"]) for e in manifest["entries"]],
                         [("movie", 1, BASE + "Film/Alpha")])


class QueueTests(unittest.TestCase):
    def test_queue_holds_titles_without_tropes_that_have_a_known_url(self):
        titles = [
            {"media_type": "movie", "tmdb_id": 1, "title": "Has Tropes", "popularity": 90, "trope_count": 5,
             "tvtropes_url": BASE + "Film/HasTropes"},
            {"media_type": "movie", "tmdb_id": 2, "title": "Pulp Fiction", "release_year": 1994, "popularity": 50,
             "trope_count": 0, "tvtropes_url": None, "imdb_id": "tt0110912"},
            {"media_type": "show", "tmdb_id": 3, "title": "Dark", "release_year": 2017, "popularity": 70,
             "trope_count": 0, "tvtropes_url": BASE + "Series/Dark"},
            {"media_type": "movie", "tmdb_id": 4, "title": "Unknown", "popularity": 80, "trope_count": 0},
        ]
        entries, counts = runner.build_queue(titles, {("movie", 2): "Film/PulpFiction", ("show", 3): "Series/Dark"},
                                             {"tt0110912": "PulpFiction1994"})
        self.assertEqual([(e["media_type"], e["tmdb_id"]) for e in entries], [("show", 3), ("movie", 2)])
        self.assertEqual(entries[1]["candidates"], [{"source": "wikidata", "url": BASE + "Film/PulpFiction"},
                                                    {"source": "tvtropes2imdb", "url": BASE + "Film/PulpFiction1994"}])
        self.assertEqual(entries[0]["candidates"], [{"source": "stored", "url": BASE + "Series/Dark"}])
        self.assertIn("PulpFiction", entries[1]["title_variations"])
        self.assertEqual((counts["with_tropes"], counts["no_known_url"], counts["queued"]), (1, 1, 2))

    def test_wikidata_rows_map_tmdb_ids_by_kind(self):
        class Http:
            def get(self, url, params=None, headers=None, timeout=None):
                self.headers = headers
                response = FakeResponse(200, "")
                response.raise_for_status = lambda: None
                response.json = lambda: {"results": {"bindings": [
                    {"tt": {"value": "Film/PulpFiction"}, "movie": {"value": "680"}},
                    {"tt": {"value": "Series/Dark"}, "show": {"value": "70523"}},
                    {"tt": {"value": "Film/Other"}, "movie": {"value": "680"}},
                ]}}
                return response

        http = Http()
        ids = runner.fetch_wikidata(http)
        self.assertEqual(ids, {("movie", 680): "Film/PulpFiction", ("show", 70523): "Series/Dark"})
        self.assertIn("GoodWatchBot", http.headers["User-Agent"])

    def test_the_mapping_file_is_the_cc0_film_list(self):
        mapping = runner.load_mapping()
        self.assertEqual(len(mapping), 9262)
        self.assertEqual(mapping["tt0075617"], "ABBATheMovie")


if __name__ == "__main__":
    unittest.main()
