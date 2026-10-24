import unittest
from datetime import date
from unittest.mock import Mock

from sitemap_new import (BRANDS_FILE, MIN_TITLES, counts_query, epoch_ms, read_brands, select_new_pages,
                         window_start)

DAY = 1792800000000  # 2026-10-24 UTC, as Crate returns timestamps
BRANDS = [{"slug": "netflix", "ids": [8, 1796]}, {"slug": "hulu", "ids": [15]}]


class NewPagesTest(unittest.TestCase):
    def cursor(self, countries, counts):
        cursor = Mock()
        cursor.fetchall.side_effect = [countries, counts]
        return cursor

    def test_pages_with_titles_are_listed_with_their_country_page(self):
        cursor = self.cursor(
            [("US",), ("DE",), ("FR",)],
            [("US", "netflix", 40, DAY), ("US", "hulu", 5, DAY - 86400000), ("DE", "netflix", 7, DAY),
             ("FR", "netflix", MIN_TITLES - 1, DAY)],
        )
        pages = select_new_pages(cursor, date(2026, 10, 25), BRANDS)
        self.assertEqual(pages, [
            ("https://goodwatch.app/new/de", date(2026, 10, 24)),
            ("https://goodwatch.app/new/de/netflix", date(2026, 10, 24)),
            ("https://goodwatch.app/new/us", date(2026, 10, 24)),
            ("https://goodwatch.app/new/us/hulu", date(2026, 10, 23)),
            ("https://goodwatch.app/new/us/netflix", date(2026, 10, 24)),
        ])

    def test_unknown_countries_and_brands_are_left_out(self):
        cursor = self.cursor([("US",)], [("XK", "netflix", 40, DAY), ("US", "tubi", 40, DAY)])
        self.assertEqual(select_new_pages(cursor, date(2026, 10, 25), BRANDS), [])

    def test_the_window_is_14_days_and_starts_no_earlier_than_the_launch(self):
        self.assertEqual(window_start(date(2026, 11, 20)), date(2026, 11, 7))
        self.assertEqual(window_start(date(2026, 10, 20)), date(2026, 10, 12))
        cursor = self.cursor([], [])
        select_new_pages(cursor, date(2026, 11, 20), BRANDS)
        self.assertEqual(cursor.execute.call_args_list[1].args[1], [epoch_ms(date(2026, 11, 7))])

    def test_backfill_is_never_counted_and_brands_fold_their_ids(self):
        sql = counts_query(BRANDS)
        self.assertIn("appeared_source <> 'backfill'", sql)
        self.assertIn("dropped_on IS NULL", sql)
        self.assertIn("WHEN streaming_service_id IN (8, 1796) THEN 'netflix'", sql)
        self.assertIn("streaming_service_id IN (8, 1796, 15)", sql)

    def test_the_pages_brand_list_reads(self):
        brands = read_brands(BRANDS_FILE)
        self.assertIn("netflix", [b["slug"] for b in brands])
        self.assertTrue(all(len(b["slug"]) > 2 for b in brands))


if __name__ == "__main__":
    unittest.main()
