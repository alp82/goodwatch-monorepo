import json
import unittest
from datetime import date

import sitemap_new
from sitemap_new import MAX_URLS, MIN_TITLES, PAGES_INDEX, select_new_pages

DAY = 1792800000000  # 2026-10-24 UTC, as the index gives days


def index(pages):
    return json.dumps({"pages": pages}).encode()


class NewPagesTest(unittest.TestCase):
    def test_pages_from_the_sites_index_with_their_latest_arrival(self):
        asked = []

        def fetch(url):
            asked.append(url)
            return index([
                {"path": "/new/us/netflix", "titles": MIN_TITLES + 20, "latest": DAY},
                {"path": "/new/us", "titles": MIN_TITLES + 21, "latest": DAY},
                {"path": "/new/de/hulu", "titles": MIN_TITLES, "latest": DAY - 86400000},
            ])

        self.assertEqual(select_new_pages(fetch), [
            ("https://goodwatch.app/new/de/hulu", date(2026, 10, 23)),
            ("https://goodwatch.app/new/us", date(2026, 10, 24)),
            ("https://goodwatch.app/new/us/netflix", date(2026, 10, 24)),
        ])
        self.assertEqual(asked, [PAGES_INDEX])

    def test_pages_below_the_minimum_and_empty_pages_are_left_out(self):
        pages = select_new_pages(lambda url: index([
            {"path": "/new/fr/netflix", "titles": MIN_TITLES - 1, "latest": DAY},
            {"path": "/new/fr/mubi", "titles": 0, "latest": None},
            {"path": "/new/fr", "titles": MIN_TITLES, "latest": None},
        ]))
        self.assertEqual(pages, [("https://goodwatch.app/new/fr", None)])

    def test_at_most_max_urls_pages_with_the_most_titles_ties_by_path(self):
        # MAX_URLS + 2 pages: the two smallest go, and of the two tied at the cut the later path goes.
        pages = [{"path": f"/new/zz/s{i}", "titles": MIN_TITLES + 10 + i, "latest": DAY}
                 for i in range(MAX_URLS - 1)]
        pages += [
            {"path": "/new/aa/tied-a", "titles": MIN_TITLES + 5, "latest": DAY},
            {"path": "/new/aa/tied-b", "titles": MIN_TITLES + 5, "latest": DAY},
            {"path": "/new/aa/least", "titles": MIN_TITLES + 1, "latest": DAY},
        ]
        picked = [url for url, _ in select_new_pages(lambda url: index(pages))]
        self.assertEqual(len(picked), MAX_URLS)
        self.assertIn("https://goodwatch.app/new/aa/tied-a", picked)
        self.assertNotIn("https://goodwatch.app/new/aa/tied-b", picked)
        self.assertNotIn("https://goodwatch.app/new/aa/least", picked)
        self.assertEqual(picked, sorted(picked))

    def test_only_new_on_services_addresses_are_taken(self):
        pages = select_new_pages(lambda url: index([
            {"path": "/movies/best", "titles": 10, "latest": DAY},
            {"path": "https://example.com/new/us", "titles": 10, "latest": DAY},
            {"path": "/new/us/../../admin", "titles": 10, "latest": DAY},
        ]))
        self.assertEqual(pages, [])

    def test_an_unreadable_index_fails_the_run(self):
        with self.assertRaises(ValueError):
            select_new_pages(lambda url: b"<html>busy</html>")
        with self.assertRaises(ValueError):
            select_new_pages(lambda url: json.dumps({"nope": []}).encode())

    def test_an_incomplete_or_empty_index_is_refused_so_the_last_file_stays(self):
        page = {"path": "/new/us/netflix", "titles": MIN_TITLES, "latest": DAY}
        with self.assertRaises(ValueError):
            select_new_pages(lambda url: json.dumps({"pages": [page], "failed": ["SE"]}).encode())
        with self.assertRaises(ValueError):
            select_new_pages(lambda url: index([]))
        # An index with pages, none big enough, is complete: the sitemap then has no /new page.
        self.assertEqual(select_new_pages(lambda url: index([{**page, "titles": MIN_TITLES - 1}])), [])

    def test_the_index_is_read_from_the_live_site(self):
        self.assertEqual(PAGES_INDEX, "https://goodwatch.app/api/new-on-services/pages")
        self.assertTrue(callable(sitemap_new.fetch_index))


if __name__ == "__main__":
    unittest.main()
