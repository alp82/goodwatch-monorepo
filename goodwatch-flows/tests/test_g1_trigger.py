"""Offline G1 trigger checks: fake Windmill and fake snapshot connectors only."""
import sys
import importlib.util
from types import SimpleNamespace
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))
from f.sync.copy.g1_trigger import start_preview_g1, MEMBERS_VARIABLE, G1_SCRIPT


class G1TriggerTests(unittest.TestCase):
    def test_only_explicit_members_are_queued(self):
        get = Mock(return_value='["owner"]')
        enqueue = Mock(return_value="job-1")
        self.assertEqual(start_preview_g1(get, enqueue), {"started": True, "job": "job-1"})
        get.assert_called_once_with(MEMBERS_VARIABLE)
        enqueue.assert_called_once_with(path=G1_SCRIPT, args={"member_ids": ["owner"], "dry_run": False})

    def test_invalid_missing_and_empty_configuration_never_queues(self):
        for raw in [None, "", "[]", '["all"]', '["*"]', '["a","a"]', '[" owner "]', '"owner"', "not json"]:
            with self.subTest(raw=raw):
                enqueue = Mock()
                self.assertFalse(start_preview_g1(lambda _: raw, enqueue)["started"])
                enqueue.assert_not_called()
        enqueue = Mock()
        self.assertFalse(start_preview_g1(Mock(side_effect=KeyError("missing")), enqueue)["started"])
        enqueue.assert_not_called()

    def test_enqueue_failure_is_contained(self):
        self.assertFalse(start_preview_g1(lambda _: '["owner"]', Mock(side_effect=RuntimeError("offline")))["started"])


def load_snapshot_without_connectors():
    # Only main's enqueue/cleanup path is under test, with no optional connector packages required.
    spec = importlib.util.spec_from_file_location("g1_snapshot_trigger_test", Path(__file__).parents[1] / "windmill/f/sync/copy/title_snapshot.py")
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {
        "f.db.cratedb": SimpleNamespace(CrateConnector=Mock()),
        "f.db.redis": SimpleNamespace(RedisConnector=Mock()),
        "f.dna.models": SimpleNamespace(CoreScores=SimpleNamespace(model_fields={f"score_{i}": None for i in range(74)})),
    }):
        spec.loader.exec_module(module)
    return module


class SnapshotG1TriggerTests(unittest.TestCase):
    def test_publish_and_nightly_no_change_enqueue_but_dry_runs_and_lock_contention_do_not(self):
        # Main's connectors are replaced before construction. No DB or Valkey opened.
        title_snapshot = load_snapshot_without_connectors()
        from f.sync.copy import g1_trigger
        for published, reason, dry_run, expected in [
            (True, None, False, True),
            (False, "no title analysis changed since the current version", False, True),
            (True, None, True, False),
            (False, "another publish is running", False, False),
        ]:
            with self.subTest(published=published, reason=reason, dry_run=dry_run):
                crate, redis = Mock(), Mock()
                with patch.object(title_snapshot, "CrateConnector", return_value=crate), \
                     patch.object(title_snapshot, "RedisConnector", return_value=Mock(get_redis=Mock(return_value=redis))), \
                     patch.object(title_snapshot, "run", return_value={"published": published, "reason": reason}), \
                     patch.object(g1_trigger, "main", return_value={"started": True}) as start:
                    result = title_snapshot.main(dry_run=dry_run)
                self.assertEqual(start.called, expected)
                self.assertEqual("g1" in result, expected)
                crate.disconnect.assert_called_once()
                redis.close.assert_called_once()

    def test_g1_failure_does_not_fail_snapshot_publish(self):
        title_snapshot = load_snapshot_without_connectors()
        from f.sync.copy import g1_trigger
        with patch.object(title_snapshot, "CrateConnector", return_value=Mock()), \
             patch.object(title_snapshot, "RedisConnector", return_value=Mock()), \
             patch.object(title_snapshot, "run", return_value={"published": True}), \
             patch.object(g1_trigger, "main", side_effect=RuntimeError("queue down")):
            result = title_snapshot.main()
        self.assertTrue(result["published"])
        self.assertFalse(result["g1"]["started"])
