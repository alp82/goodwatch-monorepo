"""Offline adapter and publication checks. No connectors or external data are opened."""
import gzip
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
        kwargs.setdefault("dry_run", False)
        with patch.object(job, "read_members", return_value=(tables(), {"preview": 0})), \
             patch.object(job, "read_titles", return_value=self.t), \
             patch.object(job, "b5_predict", return_value={"rank": np.array([0.0, 1.0])}), \
             patch.object(job, "taste_vector", return_value=np.array([1.0, 0.0])):
            return job.run(self.redis, self.select, ["preview"], ["a", "b"], now=self.now, **kwargs)

    def test_only_member_key_is_written_with_expiry(self):
        self.run_job(ttl_seconds=600)
        self.redis.set.assert_called_once()
        args, kwargs = self.redis.set.call_args
        self.assertEqual(args[0], "g1:v2:preview")
        self.assertEqual(kwargs, {"ex": 600})
        data = json.loads(gzip.decompress(args[1]))
        self.assertEqual(data["pointIds"], sorted(data["pointIds"]))
        self.assertEqual(data["snapshotVersion"], "snapshot-test")
        self.assertEqual(data["modelHash"], job.MODEL_HASH)
        self.assertEqual(data["othersCount"], 1)
        self.assertEqual(data["builtAt"], "2026-10-14T00:00:00.000Z")
        self.redis.delete.assert_not_called()

    def test_dry_run_has_no_writes(self):
        self.assertFalse(self.run_job(dry_run=True)["published"])
        self.redis.set.assert_not_called()

    def test_none_ttl_uses_default_expiry(self):
        result = self.run_job(ttl_seconds=None)
        self.assertEqual(result["members"][0]["status"], "built")
        self.assertEqual(self.redis.set.call_args.kwargs, {"ex": job.TTL_SECONDS})

    def test_changed_snapshot_fails_before_publication(self):
        self.redis.get.side_effect = [self.redis.get.return_value, '{"version":"new"}']
        with self.assertRaises(RuntimeError):
            self.run_job()
        self.redis.set.assert_not_called()

    def test_invalid_members_rejected_before_any_io(self):
        for members in (42, ["all"], ["*"], [""], ["a", "a"]):
            with self.assertRaises(ValueError):
                job.run(self.redis, self.select, members, ["a", "b"])
        self.redis.get.assert_not_called()
        self.select.assert_not_called()


class Rollout(unittest.TestCase):
    def setUp(self):
        self.redis = Mock()
        self.redis.get.return_value = json.dumps({"version": "snapshot-test", "keyOrder": ["a", "b"]})
        self.redis.scan_iter.return_value = [b"g1:v2:orphan"]
        self.t = job.build_titles(records(), ["a", "b"])

    def run_job(self, members="all", **kwargs):
        with patch.object(job, "read_members", return_value=(tables(), {"eligible": 0, "ineligible": 1})) as read_members, \
             patch.object(job, "read_titles", return_value=self.t) as read_titles, \
             patch.object(job, "taste_vector", side_effect=lambda v: np.ones(2) if len(v["me"]["ratings"]["title"]) and v["titles"]["key"][v["me"]["ratings"]["title"][0]] == 2 * 10**12 + 3 else None), \
             patch.object(job, "b5_predict", return_value={"rank": np.array([0.0, 1.0])}):
            result = job.run(self.redis, Mock(), members, ["a", "b"], **kwargs)
            read_members.assert_called_once()
            read_titles.assert_called_once()
            return result

    def test_all_discovers_eligible_members_and_deletes_ineligible_and_orphaned_keys(self):
        result = self.run_job(dry_run=False)
        self.assertEqual([s["status"] for s in result["members"]], ["built", "ineligible", "ineligible"])
        self.redis.set.assert_called_once()
        self.assertEqual(self.redis.set.call_args.args[0], "g1:v2:eligible")
        self.assertEqual(self.redis.set.call_args.kwargs, {"ex": job.TTL_SECONDS})
        self.assertEqual({c.args[0] for c in self.redis.delete.call_args_list}, {"g1:v2:ineligible", "g1:v2:orphan"})

    def test_dry_run_computes_eligibility_without_any_writes(self):
        self.run_job()  # run() also defaults to dry run.
        self.redis.set.assert_not_called()
        self.redis.delete.assert_not_called()
        self.redis.sadd.assert_not_called()

    def test_one_member_failure_is_isolated_and_requeued(self):
        self.redis.set.side_effect = RuntimeError("publish failed")
        result = self.run_job(dry_run=False)
        self.assertEqual([s["status"] for s in result["members"]], ["failed", "ineligible", "ineligible"])
        self.redis.sadd.assert_called_once_with("g1:dirty", "eligible")
        self.assertEqual(self.redis.delete.call_count, 2)

    def test_dirty_run_claims_once_and_leaves_members_outside_rollout(self):
        self.redis.scard.return_value = 3
        self.redis.spop.return_value = [b"eligible", b"ineligible", b"outsider"]
        result = self.run_job(["eligible", "ineligible"], dirty_only=True, dry_run=False)
        self.redis.spop.assert_called_once_with("g1:dirty", 3)
        self.redis.sadd.assert_called_once_with("g1:dirty", "outsider")
        self.assertEqual([s["member"] for s in result["members"]], ["eligible", "ineligible"])
        self.redis.scan_iter.assert_not_called()

    def test_a_new_dirty_mark_during_publication_survives_for_the_next_run(self):
        dirty = {b"eligible"}
        self.redis.scard.side_effect = lambda _: len(dirty)
        self.redis.spop.side_effect = lambda _key, _count: [dirty.pop()]
        self.redis.set.side_effect = lambda *_args, **_kwargs: dirty.add(b"eligible")
        result = self.run_job("all", dirty_only=True, dry_run=False)
        self.assertEqual(result["members"][0]["status"], "built")
        self.assertEqual(dirty, {b"eligible"})
        self.redis.spop.assert_called_once()
        self.redis.srem.assert_not_called()  # Never clear a newer interaction after compute.

    def test_dirty_dry_run_inspects_without_consuming(self):
        self.redis.scard.return_value = 2
        self.redis.smembers.return_value = {b"eligible", b"outsider"}
        result = self.run_job(["eligible"], dirty_only=True, dry_run=True)
        self.assertEqual(len(result["members"]), 1)
        self.redis.spop.assert_not_called()
        self.redis.sadd.assert_not_called()
        self.redis.set.assert_not_called()
        self.redis.delete.assert_not_called()

    def test_none_dry_run_inspects_without_consuming_or_writing(self):
        self.redis.scard.return_value = 2
        self.redis.smembers.return_value = {b"eligible", b"ineligible"}
        self.redis.spop.return_value = [b"eligible", b"ineligible"]
        result = self.run_job(dirty_only=True, dry_run=None)
        self.assertFalse(result["published"])
        self.assertEqual([s["status"] for s in result["members"]], ["built", "ineligible"])
        self.redis.spop.assert_not_called()
        self.redis.sadd.assert_not_called()
        self.redis.set.assert_not_called()
        self.redis.delete.assert_not_called()

    def test_complete_raw_dirty_claim_is_restored_after_any_post_pop_failure(self):
        for stage in ("decode", "excluded", "read"):
            with self.subTest(stage=stage):
                claim = {b"eligible", b"outsider"}
                if stage == "decode":
                    claim.add(b"\xff")
                dirty = claim.copy()
                redis = Mock()
                redis.scard.side_effect = lambda _key: len(dirty)

                def pop(_key, _count):
                    members = sorted(dirty)
                    dirty.clear()
                    return members

                def restore(_key, *members):
                    if stage == "excluded" and redis.sadd.call_count == 1:
                        raise RuntimeError("restore failed")
                    dirty.update(m.encode() if isinstance(m, str) else m for m in members)

                redis.spop.side_effect = pop
                redis.sadd.side_effect = restore
                redis.get.return_value = self.redis.get.return_value
                with patch.object(job, "read_members", side_effect=RuntimeError("read failed")):
                    error = UnicodeDecodeError if stage == "decode" else RuntimeError
                    with self.assertRaises(error):
                        job.run(redis, Mock(), ["eligible"], ["a", "b"], dirty_only=True, dry_run=False)
                self.assertEqual(dirty, claim)
                self.assertEqual(set(redis.sadd.call_args.args[1:]), claim)
                redis.set.assert_not_called()
                redis.delete.assert_not_called()

    def test_empty_dirty_set_does_not_load_shared_inputs(self):
        self.redis.scard.return_value = 0
        with patch.object(job, "read_members") as read:
            self.assertEqual(job.run(self.redis, Mock(), "all", ["a", "b"], dirty_only=True)["members"], [])
            read.assert_not_called()
        self.redis.get.assert_not_called()

    def test_dirty_members_survive_shared_read_failure_and_snapshot_change(self):
        for changed in (False, True):
            with self.subTest(changed=changed):
                self.redis.reset_mock(side_effect=True)
                manifest = json.dumps({"version": "snapshot-test", "keyOrder": ["a", "b"]})
                self.redis.get.side_effect = [manifest, '{"version":"new"}'] if changed else None
                self.redis.get.return_value = manifest
                self.redis.scard.return_value = 1
                self.redis.spop.return_value = [b"eligible"]
                with patch.object(job, "read_members", return_value=(tables(), {"eligible": 0}),
                                  side_effect=None if changed else RuntimeError("read failed")), \
                     patch.object(job, "read_titles", return_value=self.t), \
                     patch.object(job, "taste_vector", return_value=None):
                    with self.assertRaises(RuntimeError):
                        job.run(self.redis, Mock(), "all", ["a", "b"], dirty_only=True, dry_run=False)
                self.redis.sadd.assert_called_with("g1:dirty", b"eligible")
                self.redis.set.assert_not_called()
                self.redis.delete.assert_not_called()

    def test_real_taste_eligibility_needs_five_usable_liked_ratings(self):
        recs = [{"key": 10**12 + i, "has_poster": True,
                 "fingerprint_scores": {"a": 8, "b": 2},
                 "goodwatch_overall_score_normalized_percent": 80,
                 "goodwatch_overall_score_voting_count": 1000} for i in range(1, 7)]
        titles = job.build_titles(recs, ["a", "b"])
        for liked, eligible in [(0, False), (4, False), (5, True)]:
            with self.subTest(liked=liked):
                data = {name: {"member": np.zeros(0, np.int32), "title_key": np.zeros(0, np.int64)} for name in job.TABLES}
                data["ratings"] = {"member": np.zeros(liked, np.int32), "title_key": np.arange(1, liked + 1) + 10**12,
                                   "score": np.full(liked, 8, np.int8)}
                self.assertEqual(job.taste_vector(job.build_view(titles, data, 0)) is not None, eligible)

    def test_consecutive_runs_use_new_title_statistics_before_eligibility(self):
        recs = [{"key": 10**12 + i, "has_poster": True,
                 "fingerprint_scores": {"a": 8, "b": 2},
                 "goodwatch_overall_score_normalized_percent": 80,
                 "goodwatch_overall_score_voting_count": 1000} for i in range(1, 7)]
        first = job.build_titles(recs, ["a", "b"])
        recs[-1]["fingerprint_scores"] = {"a": 2, "b": 8}
        second = job.build_titles(recs, ["a", "b"])
        data = {name: {"member": np.zeros(0, np.int32), "title_key": np.zeros(0, np.int64)}
                for name in job.TABLES}
        data["ratings"] = {"member": np.zeros(5, np.int32),
                           "title_key": np.arange(1, 6) + 10**12, "score": np.full(5, 8, np.int8)}
        with patch.dict(job._POOL, clear=True), \
             patch.object(job, "read_members", return_value=(data, {"eligible": 0})), \
             patch.object(job, "read_titles", side_effect=[first, second]), \
             patch.object(job, "b5_predict", return_value={"rank": np.array([1.0])}):
            results = [job.run(self.redis, Mock(), ["eligible"], ["a", "b"], dry_run=False)
                       for _ in range(2)]
        self.assertEqual([r["members"][0]["status"] for r in results], ["ineligible", "built"])
        self.redis.delete.assert_called_once_with("g1:v2:eligible")
        self.redis.set.assert_called_once()
        self.assertEqual(self.redis.set.call_args.args[0], "g1:v2:eligible")


class Reads(unittest.TestCase):
    def test_manual_calls_reject_unlisted_members_before_connector_imports(self):
        for raw, members in [(None, ["owner"]), ("[]", ["owner"]), ('["owner"]', ["stranger"]),
                             ('["owner"]', ["owner", "stranger"]), ('["owner"]', "all"), ('["all"]', ["owner"]),
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

    def test_all_rollout_and_omitted_arguments_are_authorized_before_shared_run(self):
        for raw, requested, selected in [("all", None, "all"), ('["owner"]', None, ["owner"]),
                                         ('"all"', ["new-member"], ["new-member"])]:
            with self.subTest(raw=raw), patch.dict(sys.modules, {
                "wmill": SimpleNamespace(get_variable=Mock(return_value=raw)),
                "f.db.cratedb": SimpleNamespace(CrateConnector=Mock(return_value=Mock())),
                "f.db.redis": SimpleNamespace(RedisConnector=Mock(return_value=Mock(get_redis=Mock(return_value=Mock())))),
                "f.dna.models": SimpleNamespace(CoreScores=SimpleNamespace(model_fields={"a": None})),
            }), patch.object(job, "run", return_value={"published": False}) as run:
                job.main(requested, ttl_seconds=None, dry_run=None, dirty_only=None)
                self.assertEqual(run.call_args.args[2], selected)
                self.assertEqual(run.call_args.kwargs, {"ttl_seconds": job.TTL_SECONDS, "dry_run": True, "dirty_only": False})

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


class OmittedArguments(unittest.TestCase):
    """Windmill passes None for arguments a caller leaves out (seen on the first production dry run)."""

    def test_missing_ttl_takes_the_default_and_missing_dry_run_means_dry(self):
        self.assertEqual(job.main_defaults(None, None), (job.TTL_SECONDS, True))

    def test_given_values_are_kept(self):
        self.assertEqual(job.main_defaults(60, False), (60, False))
