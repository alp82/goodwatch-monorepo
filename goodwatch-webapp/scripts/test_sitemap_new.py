import json
import unittest
from datetime import date

import sitemap_new
from sitemap_new import MIN_TITLES, PAGES_INDEX, select_new_pages

DAY = 1792800000000  # 2026-10-24 UTC, as the index gives days


def index(pages):
    return json.dumps({"pages": pages}).encode()


class NewPagesTest(unittest.TestCase):
    def test_pages_from_the_sites_index_with_their_latest_arrival(self):
        asked = []

        def fetch(url):
            asked.append(url)
            return index([
                {"path": "/new/us/netflix", "titles": 40, "latest": DAY},
                {"path": "/new/us", "titles": 41, "latest": DAY},
                {"path": "/new/de/hulu", "titles": 5, "latest": DAY - 86400000},
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

    def test_the_index_is_read_from_the_live_site(self):
        self.assertEqual(PAGES_INDEX, "https://goodwatch.app/api/new-on-services/pages")
        self.assertTrue(callable(sitemap_new.fetch_index))


if __name__ == "__main__":
    unittest.main()
