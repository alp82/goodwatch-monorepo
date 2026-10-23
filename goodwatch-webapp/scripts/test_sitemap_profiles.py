import unittest
from datetime import date
from unittest.mock import Mock
from sitemap_profiles import MIN_SCORES, scores_public, select_profiles, valid_handle

DAY = 1792713600000  # 2026-10-21 UTC, as Crate returns timestamps


class ProfilesTest(unittest.TestCase):
    def cursor(self, members, settings):
        cursor = Mock()
        cursor.fetchall.side_effect = [members, settings]
        return cursor

    def test_public_profiles_listed_by_handle(self):
        cursor = self.cursor(
            [("u1", "zed", 40, DAY), ("u2", "amy", 30, DAY), ("u3", "hidden", 50, DAY)],
            [("u3", '{"scores": "me"}'), ("u2", '{"wishlist": "me"}')],
        )
        self.assertEqual(select_profiles(cursor), [
            ("https://goodwatch.app/u/amy", date.fromtimestamp(DAY / 1000)),
            ("https://goodwatch.app/u/zed", date.fromtimestamp(DAY / 1000)),
        ])
        self.assertEqual(cursor.execute.call_args_list[0].args[1], [MIN_SCORES])
        self.assertIn("deleted_at IS NULL", cursor.execute.call_args_list[0].args[0])
        self.assertEqual(sorted(cursor.execute.call_args_list[1].args[1][0]), ["u1", "u2", "u3"])

    def test_members_only_scores_are_left_out(self):
        cursor = self.cursor([("u1", "amy", 30, DAY)], [("u1", '{"scores": "members"}')])
        self.assertEqual(select_profiles(cursor), [])

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
