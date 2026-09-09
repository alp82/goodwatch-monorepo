"""Exercise races at the database boundary without requiring a live cluster."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
import sys
from unittest.mock import patch
from types import ModuleType

PATH = Path(__file__).parents[1] / "windmill/f/priority/queue.py"
spec = importlib.util.spec_from_file_location("priority_queue", PATH)
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)


class MemoryCrate:
    def __init__(self):
        self.row = dict(
            demand=10,
            acknowledged_demand=0,
            claimed_demand=0,
            lease_token=None,
            lease_expires_ms=None,
            last_success_ms=None,
            now_ms=1_000_000_000,
            _seq_no=1,
            _primary_term=1,
        )
        self.cur = SimpleNamespace(rowcount=0)
        self.before_write = None

    def select(self, sql, params):
        # Returning a copy models the snapshot taken before a competing writer.
        return [dict(self.row)]

    def run(self, sql, params):
        if self.before_write:
            callback, self.before_write = self.before_write, None
            callback()
        self.cur.rowcount = 0
        if sql.lstrip().startswith("INSERT"):
            return
        if (self.row["_seq_no"], self.row["_primary_term"]) != params[-2:]:
            return
        if "SET lease_token" in sql:
            self.row.update(
                lease_token=params[0],
                lease_expires_ms=params[1],
                claimed_demand=params[2],
            )
        else:
            self.row.update(
                acknowledged_demand=params[0],
                last_success_ms=self.row["now_ms"],
                lease_token=None,
                lease_expires_ms=None,
            )
        self.row["_seq_no"] += 1
        self.cur.rowcount = 1

    def impression(self):
        self.row["demand"] += 1
        self.row["_seq_no"] += 1


class PriorityQueueTests(unittest.TestCase):
    def test_concurrent_claim_has_one_owner(self):
        db = MemoryCrate()
        winner = []
        db.before_write = lambda: winner.append(queue.claim(db, "movie", 1))
        loser = queue.claim(db, "movie", 1)
        self.assertIsNone(loser)
        self.assertEqual(db.row["lease_token"], winner[0]["lease_token"])

    def test_claim_retries_impression_race_and_captures_latest_demand(self):
        db = MemoryCrate()
        db.before_write = db.impression
        lease = queue.claim(db, "movie", 1)
        self.assertEqual(lease["claimed_demand"], 11)

    def test_ack_preserves_impressions_during_crawl_and_ack_race(self):
        db = MemoryCrate()
        lease = queue.claim(db, "show", 2)
        db.impression()
        db.before_write = db.impression
        queue.acknowledge(db, lease)
        self.assertEqual(db.row["demand"] - db.row["acknowledged_demand"], 2)
        self.assertIsNone(db.row["lease_token"])

    def test_expired_claim_retried_and_old_worker_cannot_ack(self):
        db = MemoryCrate()
        old = queue.claim(db, "movie", 1)
        db.row["now_ms"] += queue.LEASE_MS + 1
        new = queue.claim(db, "movie", 1)
        self.assertNotEqual(old["lease_token"], new["lease_token"])
        with self.assertRaises(RuntimeError):
            queue.acknowledge(db, old)
        self.assertEqual(db.row["acknowledged_demand"], 0)
        queue.acknowledge(db, new)

    def test_expired_lease_cannot_ack_even_before_reclaimed(self):
        db = MemoryCrate()
        lease = queue.claim(db, "movie", 1)
        db.row["now_ms"] += queue.LEASE_MS
        with self.assertRaises(RuntimeError):
            queue.acknowledge(db, lease)

    def test_cooldown_and_zero_demand_block_scheduled_but_allow_explicit(self):
        for changes in [dict(last_success_ms=999_999_999), dict(demand=0)]:
            db = MemoryCrate()
            db.row.update(changes)
            self.assertIsNone(queue.claim(db, "movie", 1))
            self.assertIsNotNone(queue.claim(db, "movie", 1, explicit=True))
            self.assertIsNone(queue.claim(db, "movie", 1, explicit=True))

    def test_primary_promotion_invalidates_claim_snapshot(self):
        db = MemoryCrate()

        def promote():
            db.row["_primary_term"] += 1

        db.before_write = promote
        self.assertIsNotNone(queue.claim(db, "movie", 1))
        self.assertEqual(db.row["_primary_term"], 2)


class SelectionTests(unittest.TestCase):
    def load_selector(self):
        modules = {}
        for name in ("mongoengine", "f.db.mongodb", "f.db.cratedb", "f.priority.queue"):
            modules[name] = ModuleType(name)
        modules["mongoengine"].get_db = lambda: None
        modules["f.db.mongodb"].init_mongodb = lambda: None
        modules["f.db.mongodb"].close_mongodb = lambda: None
        modules["f.db.cratedb"].CrateConnector = object
        modules["f.priority.queue"].candidate_ids = queue.candidate_ids
        modules["f.priority.queue"].claim = queue.claim
        modules["f.priority.queue"].release = queue.release
        modules["f.priority.queue"].CANDIDATE_PAGE_SIZE = queue.CANDIDATE_PAGE_SIZE
        spec = importlib.util.spec_from_file_location(
            "priority_next", PATH.with_name("next.py")
        )
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, modules):
            spec.loader.exec_module(module)
        return module

    def test_missing_mongo_mapping_never_claimed_or_returned(self):
        module = self.load_selector()
        with patch.object(module, "candidate_ids", return_value=[1]), patch.object(
            module, "mongo_id", return_value=None
        ), patch.object(module, "claim") as claim:
            result = module.select_batch(None, None)
            self.assertEqual(result["claims"], [])
            self.assertEqual(result["tmdb_ids"], {"movie_ids": [], "tv_ids": []})
            claim.assert_not_called()

    def test_explicit_missing_mapping_fails_before_claiming_other_title(self):
        module = self.load_selector()
        with patch.object(
            module, "mongo_id", side_effect=["object-id", None]
        ), patch.object(module, "claim") as claim:
            with self.assertRaises(ValueError):
                module.select_batch(None, None, "1", "2")
            claim.assert_not_called()

    def test_missing_first_page_does_not_starve_later_candidates(self):
        module = self.load_selector()

        def page(_db, media_type, offset):
            if media_type == "show":
                return []
            return list(range(1, 101)) if offset == 0 else [101]

        with patch.object(module, "candidate_ids", side_effect=page), patch.object(
            module,
            "mongo_id",
            side_effect=lambda _db, _type, id: "mapped" if id == 101 else None,
        ), patch.object(module, "claim", return_value={"tmdb_id": 101}):
            result = module.select_batch(None, None)
            self.assertEqual(result["tmdb_ids"]["movie_ids"], ["101"])

    def test_selection_failure_releases_previously_acquired_claim(self):
        module = self.load_selector()
        lease = {
            "media_type": "movie",
            "tmdb_id": 1,
            "lease_token": "token",
            "claimed_demand": 5,
        }
        with patch.object(module, "mongo_id", return_value="mapped"), patch.object(
            module, "claim", side_effect=[lease, None]
        ), patch.object(module, "release") as release:
            with self.assertRaises(RuntimeError):
                module.select_batch(None, None, "1", "2")
            release.assert_called_once_with(None, lease)

    def test_explicit_show_retains_crawler_tv_names_and_queue_show_type(self):
        module = self.load_selector()
        lease = {
            "media_type": "show",
            "tmdb_id": 2,
            "lease_token": "token",
            "claimed_demand": 5,
        }
        with patch.object(module, "mongo_id", return_value="object-id"), patch.object(
            module, "claim", return_value=lease
        ) as claim:
            result = module.select_batch(None, None, tv_tmdb_id="2")
            self.assertEqual(result["ids"], {"movie_ids": [], "tv_ids": ["object-id"]})
            self.assertEqual(result["tmdb_ids"], {"movie_ids": [], "tv_ids": ["2"]})
            self.assertEqual(result["claims"], [lease])
            claim.assert_called_once_with(None, "show", 2, explicit=True)


if __name__ == "__main__":
    unittest.main()
