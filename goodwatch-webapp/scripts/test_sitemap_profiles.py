import unittest
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from test_sitemap_blog import create_sitemaps
from unittest.mock import Mock, patch
from sitemap_profiles import MIN_SCORES, PUBLIC_SINCE_MS, scores_public, select_profiles, valid_handle

DAY = 1792713600000  # 2026-10-21 UTC, as Crate returns timestamps
NEW = PUBLIC_SINCE_MS  # a profile created with the release or later
OLD = DAY  # a profile that went public with the release


class ProfilesHoldTest(unittest.TestCase):
    def test_stale_profiles_cannot_be_written_or_reintroduced_in_the_index(self):
        with TemporaryDirectory() as directory, patch.object(create_sitemaps, "SITEMAP_DIR", directory):
            stale = Path(directory) / "sitemap_profiles.xml"
            stale.write_text("old profiles")
            result = create_sitemaps.write_profile_sitemap([("https://goodwatch.app/u/example", date.today())])
            self.assertEqual(result, {"total_url_count": 0, "lastmod": None, "profiles": []})
            self.assertFalse(stale.exists())
            lastmods = dict.fromkeys(["movie", "show", "static", "categories", "people", "profiles", "new"], date.today())
            create_sitemaps.create_master_sitemap_index(lastmods)
            index = (Path(directory) / "sitemap.xml").read_text()
            self.assertNotIn("sitemap_profiles", index)
            self.assertEqual(index.count("<sitemap>"), 6)
            self.assertIn("sitemap_new.xml", index)

    def test_profiles_are_held_without_reading_member_data(self):
        cursor = Mock()
        self.assertEqual(select_profiles(cursor), [])
        cursor.execute.assert_not_called()


class ProfilesTest(unittest.TestCase):
    # Keep the eligibility coverage for when the discovery route is ready.
    def setUp(self):
        flag = patch("sitemap_profiles.PROFILES_IN_SITEMAP", True)
        flag.start()
        self.addCleanup(flag.stop)

    def cursor(self, members, settings):
        cursor = Mock()
        cursor.fetchall.side_effect = [members, settings]
        return cursor

    def test_public_profiles_listed_by_handle(self):
        cursor = self.cursor(
            [("u1", "zed", 40, DAY, NEW), ("u2", "amy", 30, DAY, NEW), ("u3", "hidden", 50, DAY, NEW)],
            [("u3", "profile_visibility", '{"scores": "me"}'), ("u2", "profile_visibility", '{"wishlist": "me"}')],
        )
        self.assertEqual(select_profiles(cursor), [
            ("https://goodwatch.app/u/amy", date.fromtimestamp(DAY / 1000)),
            ("https://goodwatch.app/u/zed", date.fromtimestamp(DAY / 1000)),
        ])
        self.assertEqual(cursor.execute.call_args_list[0].args[1], [MIN_SCORES])
        self.assertIn("deleted_at IS NULL", cursor.execute.call_args_list[0].args[0])
        self.assertEqual(sorted(cursor.execute.call_args_list[1].args[1][0]), ["u1", "u2", "u3"])

    def test_members_only_scores_are_left_out(self):
        cursor = self.cursor([("u1", "amy", 30, DAY, NEW)], [("u1", "profile_visibility", '{"scores": "members"}')])
        self.assertEqual(select_profiles(cursor), [])

    def test_profiles_from_before_the_release_wait_for_confirmation(self):
        cursor = self.cursor(
            [("u1", "amy", 30, DAY, OLD), ("u2", "bob", 30, DAY, OLD), ("u3", "cat", 30, DAY, None)],
            [("u2", "profile_public_notice_seen", "yes"), ("u3", "profile_public_notice_seen", "no")],
        )
        self.assertEqual(select_profiles(cursor), [("https://goodwatch.app/u/bob", date.fromtimestamp(DAY / 1000))])

    def test_no_member_means_no_settings_read(self):
        cursor = self.cursor([], [])
        self.assertEqual(select_profiles(cursor), [])
        self.assertEqual(cursor.execute.call_count, 1)

    def test_visibility_defaults_to_public(self):
        for raw in (None, "", "not json", "[]", '{"scores": "everyone"}', '{"scores": "nonsense"}'):
            self.assertTrue(scores_public(raw), raw)

    def test_bad_handles_are_skipped(self):
        self.assertTrue(valid_handle("alp_82"))
        for handle in (None, "ab", "1abc", "Alp", "a" * 31, "a-b"):
            self.assertFalse(valid_handle(handle), handle)


if __name__ == "__main__":
    unittest.main()
