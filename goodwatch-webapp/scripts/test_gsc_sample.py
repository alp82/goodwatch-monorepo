"""Run with: python3 -m unittest test_gsc_sample (in this directory)."""
import datetime
import os
import tempfile
import unittest

from gsc_sample import (
    INDEX_COLUMNS,
    SAMPLE_SIZE,
    SHAPES,
    already_recorded,
    append_rows,
    index_row,
    read_sample,
    sitemap_rows,
    traffic_rows,
    traffic_window,
    url_shape,
    with_one_retry,
)

RUN_DATE = datetime.date(2026, 10, 10)


class UrlShapeTest(unittest.TestCase):
    def test_names_the_shape_of_each_kind_of_page(self):
        for url, shape in {
            "https://goodwatch.app/": "start",
            "https://goodwatch.app/?utm_source=x": "start",
            "https://goodwatch.app/movie/238-the-godfather": "title_movie",
            "https://goodwatch.app/movie/238-the-godfather/": "title_movie",
            "https://goodwatch.app/show/1100-how-i-met-your-mother?tab=streaming": "title_show",
            "https://goodwatch.app/person/287-brad-pitt": "person",
            "https://goodwatch.app/movies": "category_hub",
            "https://goodwatch.app/movies/": "category_hub",
            "https://goodwatch.app/shows/genres/drama": "category_hub",
            "https://goodwatch.app/discover": "category_hub",
            "https://goodwatch.app/explorer": "category_hub",
        }.items():
            self.assertEqual(url_shape(url), shape, url)

    def test_counts_old_shapes_and_other_hosts_as_other(self):
        for url in (
            "https://goodwatch.app/tv/31252-asi",
            "https://goodwatch.app/explore/movies/moods/scary",
            "https://goodwatch.app/discover/all?withCast=2440",
            "https://goodwatch.app/about",
            "http://goodwatch.app/",
            "https://www.goodwatch.app/",
            "https://www.goodwatch.app/movie/238-the-godfather",
        ):
            self.assertEqual(url_shape(url), "other", url)


class RowTest(unittest.TestCase):
    def test_index_row_keeps_the_inspection_fields(self):
        inspection = {
            "inspectionResult": {
                "indexStatusResult": {
                    "verdict": "PASS",
                    "coverageState": "Submitted and indexed",
                    "lastCrawlTime": "2026-10-09T01:02:03Z",
                    "googleCanonical": "https://goodwatch.app/",
                    "sitemap": ["ignored"],
                }
            }
        }
        row = index_row(RUN_DATE, "start", "https://goodwatch.app/", inspection)
        self.assertEqual(list(row), INDEX_COLUMNS)
        self.assertEqual(row["run_date"], "2026-10-10")
        self.assertEqual(row["coverageState"], "Submitted and indexed")
        self.assertEqual(row["lastCrawlTime"], "2026-10-09T01:02:03Z")
        self.assertEqual(row["userCanonical"], "")

    def test_index_row_of_an_empty_answer_has_empty_fields(self):
        row = index_row(RUN_DATE, "person", "https://goodwatch.app/person/1-x", {})
        self.assertEqual(row["coverageState"], "")
        self.assertEqual(row["lastCrawlTime"], "")

    def test_traffic_window_is_seven_days_ending_three_days_before_the_run(self):
        start, end = traffic_window(RUN_DATE)
        self.assertEqual((start, end), (datetime.date(2026, 10, 1), datetime.date(2026, 10, 7)))

    def test_traffic_rows_sum_per_shape_and_list_every_shape(self):
        start, end = traffic_window(RUN_DATE)
        rows = traffic_rows(
            RUN_DATE,
            start,
            end,
            [
                {"keys": ["https://goodwatch.app/"], "impressions": 10, "clicks": 2},
                {"keys": ["https://goodwatch.app/movie/1-a"], "impressions": 3, "clicks": 1},
                {"keys": ["https://goodwatch.app/movie/2-b"], "impressions": 4, "clicks": 0},
                {"keys": ["https://goodwatch.app/tv/3-c"], "impressions": 5},
            ],
        )
        self.assertEqual([row["shape"] for row in rows], SHAPES)
        by_shape = {row["shape"]: row for row in rows}
        self.assertEqual(
            by_shape["title_movie"],
            {
                "run_date": "2026-10-10",
                "startDate": "2026-10-01",
                "endDate": "2026-10-07",
                "shape": "title_movie",
                "pages": 2,
                "impressions": 7,
                "clicks": 1,
            },
        )
        self.assertEqual(by_shape["other"]["clicks"], 0)
        self.assertEqual(by_shape["person"]["pages"], 0)

    def test_sitemap_rows_keep_the_download_date(self):
        rows = sitemap_rows(
            RUN_DATE,
            {
                "sitemap": [
                    {
                        "path": "https://goodwatch.app/sitemaps/sitemap.xml",
                        "lastSubmitted": "2025-01-01T00:00:00.000Z",
                        "lastDownloaded": "2026-10-09T00:00:00.000Z",
                        "isPending": False,
                        "errors": "0",
                        "warnings": "1",
                        "contents": [],
                    }
                ]
            },
        )
        self.assertEqual(
            rows,
            [
                {
                    "run_date": "2026-10-10",
                    "path": "https://goodwatch.app/sitemaps/sitemap.xml",
                    "lastSubmitted": "2025-01-01T00:00:00.000Z",
                    "lastDownloaded": "2026-10-09T00:00:00.000Z",
                    "isPending": False,
                    "errors": "0",
                    "warnings": "1",
                }
            ],
        )
        self.assertEqual(sitemap_rows(RUN_DATE, {}), [])


class RecordFileTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.dir.cleanup)
        self.path = os.path.join(self.dir.name, "record.csv")

    def test_header_is_written_once_and_rows_are_appended(self):
        append_rows(self.path, ["run_date", "url"], [{"run_date": "2026-10-10", "url": "a"}])
        append_rows(self.path, ["run_date", "url"], [{"run_date": "2026-10-17", "url": "a"}])
        with open(self.path) as file:
            self.assertEqual(file.read(), "run_date,url\n2026-10-10,a\n2026-10-17,a\n")

    def test_a_date_is_recorded_only_in_files_that_hold_it(self):
        missing = os.path.join(self.dir.name, "missing.csv")
        self.assertEqual(already_recorded(RUN_DATE, [self.path, missing]), [])
        append_rows(self.path, ["run_date", "url"], [{"run_date": "2026-10-10", "url": "a"}])
        self.assertEqual(already_recorded(RUN_DATE, [self.path, missing]), [self.path])
        self.assertEqual(already_recorded(datetime.date(2026, 10, 17), [self.path, missing]), [])

    def test_the_committed_sample_has_fifty_urls_in_the_agreed_mix(self):
        counts = {}
        for kind, _ in read_sample():
            counts[kind] = counts.get(kind, 0) + 1
        self.assertEqual(sum(counts.values()), SAMPLE_SIZE)
        self.assertEqual(counts, {"start": 1, "hub": 6, "category": 8, "title": 25, "person": 5, "old_shape": 5})


class Failure(Exception):
    def __init__(self, status):
        self.response = type("Response", (), {"status_code": status})()


class RetryTest(unittest.TestCase):
    def calls(self, *outcomes):
        outcomes = list(outcomes)
        seen = []

        def call():
            seen.append(1)
            outcome = outcomes.pop(0)
            if isinstance(outcome, Exception):
                raise outcome
            return outcome

        return call, seen

    def test_retries_once_after_a_rate_limit_or_server_error(self):
        for status in (429, 500, 503):
            call, seen = self.calls(Failure(status), "ok")
            waits = []
            self.assertEqual(with_one_retry(call, wait=7, sleep=waits.append), "ok")
            self.assertEqual((len(seen), waits), (2, [7]))

    def test_gives_up_after_the_second_failure(self):
        call, seen = self.calls(Failure(429), Failure(429))
        with self.assertRaises(Failure):
            with_one_retry(call, sleep=lambda _: None)
        self.assertEqual(len(seen), 2)

    def test_does_not_retry_other_errors(self):
        for error in (Failure(403), ValueError("x")):
            call, seen = self.calls(error, "ok")
            with self.assertRaises(type(error)):
                with_one_retry(call, sleep=lambda _: None)
            self.assertEqual(len(seen), 1)


if __name__ == "__main__":
    unittest.main()
