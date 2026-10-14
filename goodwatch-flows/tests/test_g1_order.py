"""Offline adapter and publication checks. No connectors or external data are opened."""
import json
import sys
import unittest
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from unittest.mock import Mock, patch
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy import g1_order as job


def records():
    return [
        {"key": 10**12 + 1, "has_poster": True, "fingerprint_scores": {"a": 6.9, "b": None},
         "goodwatch_overall_score_normalized_percent": 80, "goodwatch_overall_score_voting_count": 1000,
         "genres": ["Drama"], "original_language_code": "en", "production_method": "Live Action",
         "movie_series_id": 10, "release_year": 2000},
        {"key": 10**12 + 2, "has_poster": True, "fingerprint_scores": {"a": 2, "b": 8},
         "goodwatch_overall_score_normalized_percent": 70, "goodwatch_overall_score_voting_count": 2000,
         "genres": ["Comedy"], "original_language_code": "ja", "production_method": "Animation"},
        {"key": 2 * 10**12 + 3, "has_poster": True, "fingerprint_scores": {"a": 7, "b": 3},
         "goodwatch_overall_score_normalized_percent": 90, "goodwatch_overall_score_voting_count": 999,
         "production_method": "Animation"},
        {"key": 2 * 10**12 + 4, "has_poster": True,
         "goodwatch_overall_score_normalized_percent": 90, "goodwatch_overall_score_voting_count": 1000},
    ]


def tables():
    result = {name: {"member": np.zeros(0, np.int32), "title_key": np.zeros(0, np.int64)} for name in job.TABLES}
    result["ratings"] = {"member": np.array([0, 1], np.int32),
                         "title_key": np.array([2 * 10**12 + 3, 10**12 + 1], np.int64),
                         "score": np.array([8, 7], np.int8)}
    result["want_to_see"] = {"member": np.array([0, 1], np.int32),
                            "title_key": np.array([10**12 + 2, 0], np.int64)}
    result["skip"] = {"member": np.array([0, 1], np.int32),
                     "title_key": np.array([10**12 + 1, 10**12 + 2], np.int64)}
    return result


class Arrays(unittest.TestCase):
    def test_copied_math_has_the_frozen_source_digest(self):
        copied = Path(job.__file__).read_text().split("# BEGIN COPIED B5", 1)[1].split("# END COPIED B3", 1)[0]
        self.assertEqual(sha256(copied.encode()).hexdigest(),
                         "0f77aa86e764cf193ae1a2c70e4c248dd25839ae4bcea4dabe79f28299dd2517")
        self.assertEqual(job.MODEL_HASH,
                         "e864bd47ced025f9641fdbfe041e3b7bd5717dac77f8d8d67cf26c9705feebd1")

    def test_missing_values_pool_and_all_ratings_mix(self):
        t = job.build_titles(records(), ["a", "b"], [10**12 + 5])
        np.testing.assert_array_equal(t["key"], [10**12 + 1, 10**12 + 2, 10**12 + 5, 2 * 10**12 + 3, 2 * 10**12 + 4])
        np.testing.assert_array_equal(t["fingerprint"][0], [6, 255])
        np.testing.assert_array_equal(t["in_pool"], [True, True, False, False, True])
        np.testing.assert_array_equal(t["has_fingerprint"], [True, True, False, True, False])
        self.assertEqual(t["num"]["release_year"].dtype, np.int64)
        self.assertTrue(np.isnan(t["num"]["imdb_user_score_normalized_percent"]).all())
        self.assertEqual(t["language_names"], ["en", "ja"])
        self.assertEqual(t["genre_names"], ["Comedy", "Drama"])
        v = job.build_view(t, tables(), 0)
        np.testing.assert_array_equal(v["targets"]["title"], [0, 1])  # Skip and Want to See stay candidates.
        np.testing.assert_array_equal(v["me"]["ratings"]["title"], [3])  # Outside pool stays history.
        np.testing.assert_array_equal(v["others"]["want_to_see"]["title"], [])
        np.testing.assert_array_equal(v["others"]["skip"]["title"], [1])
        with patch.object(job, "b5_predict", return_value={"rank": np.array([1.0, 1.0])}):
            c = job.components(v)
        self.assertEqual(c["b3Rank"].dtype, np.float32)
        np.testing.assert_array_equal(c["b5TopHalf"], [True, True])
        self.assertEqual(c["ownShares"], [1.0, 1.0])

    def test_candidates_and_missing_rated_titles_are_checked(self):
        t = job.build_titles(records(), ["a", "b"])
        with self.assertRaises(ValueError):
            job.build_view(t, tables(), 0, candidates=[0])
        bad = tables()
        bad["ratings"]["title_key"][0] = 10**12 + 999
        with self.assertRaises(ValueError):
            job.build_view(t, bad, 0)

    def test_empty_pool_and_no_history(self):
        t = job.build_titles([], ["a", "b"])
        empty = {name: {"member": np.zeros(0, np.int32), "title_key": np.zeros(0, np.int64)} for name in job.TABLES}
        empty["ratings"]["score"] = np.zeros(0, np.int8)
        v = job.build_view(t, empty, 0)
        c = job.components(v)
        self.assertEqual(c["ownShares"], None)
        self.assertEqual(len(c["pointIds"]), 0)
        self.assertEqual(job.request_order([], [], [], [], [], None)["order"].tolist(), [])

    def test_pool_cache_is_reset_for_each_dataset(self):
        t = job.build_titles(records(), ["a", "b"])
        job._POOL.update(mean=np.array([999, 999]), sd=np.ones(2))
        job.components(job.build_view(t, tables(), 0))
        self.assertLess(job._POOL["mean"].max(), 999)


class Request(unittest.TestCase):
    def test_filtered_franchise_pick_and_stable_ties(self):
        result = job.request_order([0.8, 0.8, 0.9, 0.9], [True, True, False, True],
                                   [10, 10, -1, -1], [False] * 4, [False] * 4, None)
        self.assertEqual(result["groups"].tolist(), [2, 1, 0, 2])
        self.assertEqual(result["order"].tolist(), [3, 0, 1, 2])
        # Once the global leader is filtered away, its remaining sibling becomes a leader.
        filtered = job.request_order([0.8, 0.9], [True, False], [10, -1], [False] * 2, [False] * 2, None)
        self.assertEqual(filtered["groups"].tolist(), [2, 0])

    def test_committed_stage_two_fixtures(self):
        fixtures = json.loads((Path(__file__).parent / "fixtures/g1_order.json").read_text())
        self.assertEqual(fixtures["modelHash"], job.MODEL_HASH)
        for case in fixtures["cases"]:
            with self.subTest(case=case["name"]):
                columns = case["components"]
                result = job.request_order(columns["b3Rank"], columns["b5TopHalf"], columns["movieSeriesId"],
                                           columns["show"], columns["animation"], case["ownShares"])
                self.assertEqual(result["groups"].tolist(), case["groups"])
                self.assertEqual([columns["pointIds"][i] for i in result["order"]], case["order"])
                self.assertEqual(result["mixCount"], case["mixCount"])


class Publication(unittest.TestCase):
    def setUp(self):
        self.redis = Mock()
        self.redis.get.return_value = json.dumps({"version": "snapshot-test", "keyOrder": ["a", "b"]})
        self.select = Mock()
        self.t = job.build_titles(records(), ["a", "b"])
        self.now = lambda: datetime(2026, 10, 14, tzinfo=timezone.utc)

    def run_job(self, **kwargs):
        with patch.object(job, "read_members", return_value=(tables(), {"preview": 0})), \
             patch.object(job, "read_titles", return_value=self.t), \
             patch.object(job, "b5_predict", return_value={"rank": np.array([0.0, 1.0])}):
            return job.run(self.redis, self.select, ["preview"], ["a", "b"], now=self.now, **kwargs)

    def test_only_member_key_is_written_with_expiry(self):
        self.run_job(ttl_seconds=600)
        self.redis.set.assert_called_once()
        args, kwargs = self.redis.set.call_args
        self.assertEqual(args[0], "g1:v1:preview")
        self.assertEqual(kwargs, {"ex": 600})
        data = json.loads(args[1])
        self.assertEqual(data["pointIds"], sorted(data["pointIds"]))
        self.assertEqual(data["snapshotVersion"], "snapshot-test")
        self.assertEqual(data["modelHash"], job.MODEL_HASH)
        self.assertEqual(data["othersCount"], 1)
        self.assertEqual(data["builtAt"], "2026-10-14T00:00:00.000Z")
        self.redis.delete.assert_not_called()

    def test_dry_run_has_no_writes(self):
        self.assertFalse(self.run_job(dry_run=True)["published"])
        self.redis.set.assert_not_called()

    def test_changed_snapshot_fails_before_publication(self):
        self.redis.get.side_effect = [self.redis.get.return_value, '{"version":"new"}']
        with self.assertRaises(RuntimeError):
            self.run_job()
        self.redis.set.assert_not_called()

    def test_explicit_members_required_before_any_io(self):
        for members in ([], "all", ["all"], ["*"], [""], ["a", "a"]):
            with self.assertRaises(ValueError):
                job.run(self.redis, self.select, members, ["a", "b"])
        self.redis.get.assert_not_called()
        self.select.assert_not_called()


class Reads(unittest.TestCase):
    def test_manual_calls_reject_unlisted_members_before_connector_imports(self):
        for raw, members in [(None, ["owner"]), ("[]", ["owner"]), ('["owner"]', ["stranger"]),
                             ('["owner"]', ["owner", "stranger"]), ('["all"]', ["owner"]),
                             ('["owner","owner"]', ["owner"]), ("bad json", ["owner"])]:
            with self.subTest(raw=raw, members=members), patch.dict(sys.modules, {
                "wmill": SimpleNamespace(get_variable=Mock(return_value=raw)),
                "f.db.cratedb": None, "f.db.redis": None,
            }):
                for dry_run in (True, False):
                    with self.assertRaises(ValueError):
                        job.main(members, dry_run=dry_run)

    def test_manual_listed_member_reaches_serialized_job_and_keeps_dry_run_default(self):
        crate, redis = Mock(), Mock()
        with patch.dict(sys.modules, {
            "wmill": SimpleNamespace(get_variable=Mock(return_value='["owner"]')),
            "f.db.cratedb": SimpleNamespace(CrateConnector=Mock(return_value=crate)),
            "f.db.redis": SimpleNamespace(RedisConnector=Mock(return_value=Mock(get_redis=Mock(return_value=redis)))),
            "f.dna.models": SimpleNamespace(CoreScores=SimpleNamespace(model_fields={"a": None})),
        }), patch.object(job, "run", return_value={"published": False}) as run:
            self.assertEqual(job.main(["owner"]), {"published": False})
            self.assertTrue(run.call_args.kwargs["dry_run"])
            self.assertEqual(run.call_args.args[2], ["owner"])
        crate.disconnect.assert_called_once()
        redis.close.assert_called_once()

    def test_four_tables_keyset_paging_and_entry_order(self):
        calls = []
        pages = [[['z', 3, 'show', 30, 30, 6], ['z', 5, 'movie', 10, 10, 8]],
                 [['z', 9, 'movie', 20, 20, 7]]]

        def select(sql, args):
            calls.append((sql, args))
            self.assertTrue(sql.startswith("SELECT "))
            return pages.pop(0) if "FROM user_score" in sql else []

        with patch.object(job, "PAGE_SIZE", 2):
            result, ids = job.read_members(select)
        self.assertEqual(len(calls), 5)
        self.assertEqual(calls[1][1], ['z', 'z', 5, 'z', 5, 'movie'])
        self.assertEqual(ids, {"z": 0})
        self.assertEqual(result["ratings"]["score"].tolist(), [8, 7, 6])
        self.assertEqual(result["ratings"]["title_key"].tolist(), [10**12 + 5, 10**12 + 9, 2 * 10**12 + 3])

    def test_title_reads_include_pool_without_dna_and_deleted_touched(self):
        calls = []

        def select(sql, args):
            calls.append((sql, args))
            self.assertTrue(sql.startswith("SELECT "))
            self.assertNotIn("dna_updated_at", sql)
            # tmdb, poster, 2 fingerprint values, 6 public facts, year, votes, series, tags.
            return [[1, True, 6, None, 80, None, None, None, None, None,
                     2000, 1000, 10, ["Drama"], "en", "Live Action"]] if "FROM movie WHERE poster" in sql else []

        t = job.read_titles(select, tables(), ["a", "b"])
        self.assertEqual(t["key"].tolist(), [10**12 + 1, 10**12 + 2, 2 * 10**12 + 3])
        self.assertEqual(t["num"]["movie_series_id"].tolist(), [10, -1, -1])
        self.assertTrue(any("ANY(?)" in sql for sql, _ in calls))


if __name__ == "__main__":
    unittest.main()
