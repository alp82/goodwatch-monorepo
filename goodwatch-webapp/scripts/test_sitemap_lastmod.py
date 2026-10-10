"""Run with: python3 -m unittest test_sitemap_lastmod (in this directory)."""
import unittest
from datetime import date, datetime, timezone

from sitemap_lastmod import TITLE_PAGE_REBUILT_ON, latest_date, title_lastmod


def millis(year: int, month: int, day: int, hour: int = 12) -> int:
    return int(datetime(year, month, day, hour, tzinfo=timezone.utc).timestamp() * 1000)


class TitleLastmodTest(unittest.TestCase):
    def test_the_floor_is_the_day_the_title_pages_were_rebuilt(self):
        self.assertEqual(TITLE_PAGE_REBUILT_ON, date(2026, 9, 25))

    def test_data_older_than_the_rebuild_reports_the_rebuild(self):
        self.assertEqual(title_lastmod(millis(2025, 3, 1), millis(2026, 9, 24)), TITLE_PAGE_REBUILT_ON)

    def test_data_newer_than_the_rebuild_reports_its_own_date(self):
        self.assertEqual(title_lastmod(millis(2026, 10, 7), millis(2026, 1, 1)), date(2026, 10, 7))
        self.assertEqual(title_lastmod(millis(2026, 1, 1), millis(2026, 10, 7)), date(2026, 10, 7))

    def test_data_from_the_day_of_the_rebuild_reports_that_day(self):
        self.assertEqual(title_lastmod(millis(2026, 9, 25, hour=0)), TITLE_PAGE_REBUILT_ON)
        self.assertEqual(title_lastmod(millis(2026, 9, 25, hour=23)), TITLE_PAGE_REBUILT_ON)

    def test_a_title_without_timestamps_reports_the_rebuild(self):
        self.assertEqual(title_lastmod(None, None), TITLE_PAGE_REBUILT_ON)
        self.assertEqual(title_lastmod(None, millis(2026, 10, 2)), date(2026, 10, 2))

    def test_latest_date_has_no_floor(self):
        self.assertEqual(latest_date(millis(2025, 3, 1), None), date(2025, 3, 1))
        self.assertIsNone(latest_date(None, None))


if __name__ == "__main__":
    unittest.main()
