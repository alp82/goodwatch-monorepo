"""Crate shard checkpoint, translog and disk watermark incidents."""

import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.monitoring.cluster_collection import collect_cluster
from f.monitoring.cluster_health import assess_cluster, shard_summaries

NOW = datetime(2026, 9, 26, 12, tzinfo=timezone.utc)
GB = 1_000_000_000


def copy_row(shard, primary, node, local, global_, translog=0, table="movie"):
    return {
        "schema_name": "doc",
        "table_name": table,
        "id": shard,
        "primary": primary,
        "node": node,
        "routing_state": "STARTED",
        "local_checkpoint": local,
        "global_checkpoint": global_,
        "translog_bytes": translog,
    }


HEALTHY_SHARDS = [
    copy_row(1, True, "crate-02", 74_000_000, 74_000_000, 40_000_000),
    copy_row(1, False, "crate-03", 74_000_000, 74_000_000, 40_000_000),
]
STUCK_SHARDS = [
    copy_row(8, True, "crate-02", 74_002_505, 68_595_116, 7_200_000_000),
    copy_row(8, False, "crate-03", 68_595_116, 68_595_116, 7_210_000_000),
]
NODES = [
    {"name": "crate-01", "total_bytes": 322 * GB, "available_bytes": 200 * GB},
    {"name": "crate-02", "total_bytes": 322 * GB, "available_bytes": 120 * GB},
]
WATERMARKS = {"low": "85%", "high": "90%", "flood_stage": "95%"}


def snapshot(rows, nodes=NODES):
    return {
        "complete": True,
        "shards": shard_summaries(rows),
        "nodes": nodes,
        "watermarks": WATERMARKS,
    }


def report(result, path):
    return next(r for r in result["reports"] if r["path"] == path)


class ShardSummaryTests(unittest.TestCase):
    def test_lag_is_primary_local_checkpoint_minus_global_checkpoint(self) -> None:
        [summary] = shard_summaries(STUCK_SHARDS)
        self.assertEqual(summary["shard"], "doc.movie#8")
        self.assertEqual(summary["checkpoint_lag"], 5_407_389)
        self.assertEqual(summary["global_checkpoint"], 68_595_116)
        self.assertEqual(summary["translog_bytes"], 7_210_000_000)
        self.assertEqual(summary["primary_node"], "crate-02")
        self.assertEqual(summary["replica_nodes"], ["crate-03"])

    def test_recovering_copies_and_missing_primaries_are_not_lag(self) -> None:
        rows = [
            copy_row(8, True, "crate-02", 74_000_000, 74_000_000, 5_000_000),
            {
                **copy_row(8, False, "crate-03", 0, 0, 7_000_000_000),
                "routing_state": "INITIALIZING",
            },
            copy_row(9, False, "crate-03", 10, 10),
        ]
        summaries = {s["shard"]: s for s in shard_summaries(rows)}
        self.assertEqual(summaries["doc.movie#8"]["checkpoint_lag"], 0)
        self.assertEqual(summaries["doc.movie#8"]["translog_bytes"], 5_000_000)
        self.assertNotIn("doc.movie#9", summaries)


class ClusterAssessmentTests(unittest.TestCase):
    def test_healthy_cluster_reports_both_scopes_healthy(self) -> None:
        result = assess_cluster(snapshot(HEALTHY_SHARDS), None, NOW)
        self.assertEqual(
            [r["path"] for r in result["reports"]],
            ["f/monitoring/crate_shards", "f/monitoring/crate_disk"],
        )
        self.assertEqual({r["status"] for r in result["reports"]}, {"healthy"})

    def test_large_lag_and_translog_open_one_grouped_shard_incident(self) -> None:
        result = assess_cluster(snapshot(HEALTHY_SHARDS + STUCK_SHARDS), None, NOW)
        shards = report(result, "f/monitoring/crate_shards")
        self.assertEqual(shards["status"], "unhealthy")
        self.assertEqual(
            shards["causes"], ["crate_checkpoint_lag", "crate_translog_oversized"]
        )
        self.assertEqual(shards["checkpoint_lag_ops"], 5_407_389)
        self.assertEqual(shards["translog_mb"], 7210)
        self.assertIn("doc.movie#8", shards["detail"])
        self.assertIn("crate-03", shards["detail"])
        self.assertEqual(
            [s["shard"] for s in shards["affected_shards"]], ["doc.movie#8"]
        )

    def test_small_lag_that_does_not_move_for_an_hour_is_a_stall(self) -> None:
        rows = [
            copy_row(7, True, "crate-03", 74_091_270, 74_009_970),
            copy_row(7, False, "crate-01", 74_009_970, 74_009_970),
        ]
        first = assess_cluster(snapshot(rows), None, NOW)
        self.assertEqual(report(first, "f/monitoring/crate_shards")["status"], "healthy")
        half = assess_cluster(snapshot(rows), first["progress"], NOW + timedelta(minutes=30))
        self.assertEqual(report(half, "f/monitoring/crate_shards")["status"], "healthy")
        later = assess_cluster(snapshot(rows), half["progress"], NOW + timedelta(hours=1))
        shards = report(later, "f/monitoring/crate_shards")
        self.assertEqual(shards["status"], "unhealthy")
        self.assertEqual(shards["causes"], ["crate_checkpoint_stalled"])
        self.assertEqual(shards["checkpoint_lag_ops"], 81_300)

    def test_moving_global_checkpoint_is_not_a_stall(self) -> None:
        first = assess_cluster(
            snapshot([copy_row(7, True, "crate-03", 1_000_000, 990_000)]), None, NOW
        )
        later = assess_cluster(
            snapshot([copy_row(7, True, "crate-03", 2_000_000, 1_990_000)]),
            first["progress"],
            NOW + timedelta(hours=2),
        )
        self.assertEqual(report(later, "f/monitoring/crate_shards")["status"], "healthy")

    def test_tiny_write_lag_is_ignored(self) -> None:
        rows = [copy_row(3, True, "crate-02", 1_000_010, 1_000_000)]
        first = assess_cluster(snapshot(rows), None, NOW)
        later = assess_cluster(snapshot(rows), first["progress"], NOW + timedelta(hours=3))
        self.assertEqual(report(later, "f/monitoring/crate_shards")["status"], "healthy")

    def test_disk_near_and_past_low_watermark(self) -> None:
        near = [{"name": "crate-03", "total_bytes": 100 * GB, "available_bytes": 22 * GB}]
        past = [{"name": "crate-03", "total_bytes": 100 * GB, "available_bytes": 12 * GB}]
        disk = report(assess_cluster(snapshot(HEALTHY_SHARDS, near), None, NOW), "f/monitoring/crate_disk")
        self.assertEqual(disk["causes"], ["crate_disk_near_watermark"])
        self.assertEqual(disk["disk_used_percent"], 78)
        disk = report(assess_cluster(snapshot(HEALTHY_SHARDS, past), None, NOW), "f/monitoring/crate_disk")
        self.assertEqual(disk["causes"], ["crate_disk_watermark"])
        self.assertEqual(disk["disk_used_percent"], 88)
        self.assertIn("crate-03 88%", disk["detail"])
        self.assertIn("low watermark 85%", disk["detail"])

    def test_absolute_watermarks_fall_back_to_default_percentages(self) -> None:
        past = [{"name": "crate-03", "total_bytes": 100 * GB, "available_bytes": 12 * GB}]
        snap = {**snapshot(HEALTHY_SHARDS, past), "watermarks": {"low": "50gb"}}
        disk = report(assess_cluster(snap, None, NOW), "f/monitoring/crate_disk")
        self.assertEqual(disk["causes"], ["crate_disk_watermark"])

    def test_incomplete_snapshot_is_unknown_and_keeps_progress(self) -> None:
        rows = [copy_row(7, True, "crate-03", 74_091_270, 74_009_970)]
        first = assess_cluster(snapshot(rows), None, NOW)
        gap = assess_cluster({"complete": False}, first["progress"], NOW + timedelta(minutes=40))
        self.assertEqual({r["status"] for r in gap["reports"]}, {"unknown"})
        self.assertEqual(gap["progress"], first["progress"])
        later = assess_cluster(snapshot(rows), gap["progress"], NOW + timedelta(hours=1))
        self.assertEqual(report(later, "f/monitoring/crate_shards")["status"], "unhealthy")


class FakeDb:
    def __init__(self, fail=False):
        self.fail = fail
        self.sql = []

    def select(self, sql, params=None):
        self.sql.append(sql)
        if self.fail:
            raise RuntimeError("password=secret")
        if "sys.shards" in sql:
            return HEALTHY_SHARDS + STUCK_SHARDS
        if "sys.nodes" in sql:
            return NODES
        if "sys.cluster" in sql:
            return [{"watermark": WATERMARKS}]
        raise AssertionError(sql)


class ClusterCollectionTests(unittest.TestCase):
    def test_collects_read_only_system_tables(self) -> None:
        db = FakeDb()
        result = collect_cluster(db)
        self.assertTrue(result["complete"])
        self.assertEqual(len(result["shards"]), 2)
        self.assertEqual(result["watermarks"]["low"], "85%")
        self.assertTrue(all(sql.lstrip().upper().startswith("SELECT") for sql in db.sql))

    def test_query_failure_is_incomplete_without_leaking_errors(self) -> None:
        result = collect_cluster(FakeDb(fail=True))
        self.assertEqual(result, {"complete": False})


if __name__ == "__main__":
    unittest.main()
