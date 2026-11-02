"""Report delivery must succeed before advancing the last-delivered baseline."""
import json
from pathlib import Path
from subprocess import CompletedProcess, TimeoutExpired
import sys
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parents[1] / "scripts"))
import letterboxd_report


class ReportTests(unittest.TestCase):
    def snapshot(self):
        return {"checked_at": "2026-11-01T16:41:00+00:00", "mongo": {"scored": 120, "attempted": 130,
                "queued": 1000, "unrated": 8, "error": 2}, "crate": {"scored": 115, "with_vote_count": 115,
                "with_url": 123}, "source_block": None, "score_count_gap": 5}

    def test_delivered_report_contains_deltas_and_updates_baseline(self):
        with TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            state.write_text(json.dumps({"checked_at": "2026-11-01T14:41:00+00:00",
                                         "mongo": {"scored": 100}, "crate": {"scored": 90}}))
            responses = [CompletedProcess([], 0, json.dumps(self.snapshot())),
                         CompletedProcess([], 0, json.dumps({"ok": True, "feed": {"items": [
                             {"sessionId": "target", "title": "Letterboxd: Mongo 120 / Crate 115", "id": "notification"}]}})),
                         CompletedProcess([], 0, '{"ok":true,"sendRequestId":"chat-request"}')]
            with patch.object(letterboxd_report.subprocess, "run", side_effect=responses) as run:
                result = letterboxd_report.report("ghostex", "target", state)
            self.assertEqual(result["last_notification"]["id"], "notification")
            self.assertEqual(result["last_chat_delivery"]["send_request_id"], "chat-request")
            self.assertEqual(json.loads(state.read_text())["crate"]["scored"], 115)
            body = run.call_args.args[0][-1]
            self.assertIn("Mongo +20; Crate +25", body)
            self.assertIn("17:41 CET", body)

    def test_a_bell_receipt_without_chat_delivery_does_not_advance_baseline(self):
        with TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            original = '{"checked_at":"before", "mongo":{"scored":100}, "crate":{"scored":90}}'
            state.write_text(original)
            responses = [CompletedProcess([], 0, json.dumps(self.snapshot())),
                         CompletedProcess([], 0, '{"ok":true}'), CompletedProcess([], 1, '')]
            with patch.object(letterboxd_report.subprocess, "run", side_effect=responses):
                with self.assertRaises(RuntimeError):
                    letterboxd_report.report("ghostex", "target", state)
            self.assertEqual(state.read_text(), original)

    def test_failed_notification_preserves_baseline(self):
        with TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            original = '{"checked_at":"before", "mongo":{"scored":100}, "crate":{"scored":90}}'
            state.write_text(original)
            responses = [CompletedProcess([], 0, json.dumps(self.snapshot())), CompletedProcess([], 1, "")]
            with patch.object(letterboxd_report.subprocess, "run", side_effect=responses):
                with self.assertRaises(RuntimeError):
                    letterboxd_report.report("ghostex", "target", state)
            self.assertEqual(state.read_text(), original)

    def test_failed_live_query_sends_failure_notification_without_advancing_baseline(self):
        with TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            responses = [CompletedProcess([], 1, '{"error":"ConnectionFailure"}'),
                         CompletedProcess([], 0, '{"ok":true}'),
                         CompletedProcess([], 0, '{"ok":true,"sendRequestId":"failure-report"}')]
            with patch.object(letterboxd_report.subprocess, "run", side_effect=responses):
                with self.assertRaises(RuntimeError):
                    letterboxd_report.report("ghostex", "target", state)
            self.assertFalse(state.exists())

    def test_timed_out_count_query_is_reported_in_chat(self):
        with TemporaryDirectory() as directory:
            state = Path(directory) / "state.json"
            responses = [TimeoutExpired("count-helper", 180), CompletedProcess([], 0, '{"ok":true}'),
                         CompletedProcess([], 0, '{"ok":true,"sendRequestId":"timeout-report"}')]
            with patch.object(letterboxd_report.subprocess, "run", side_effect=responses) as run:
                with self.assertRaises(RuntimeError):
                    letterboxd_report.report("ghostex", "target", state)
            self.assertIn("send-session-chat-message", run.call_args.args[0])
            self.assertIn("TimeoutExpired", run.call_args.args[0][-1])
            self.assertFalse(state.exists())


if __name__ == "__main__":
    unittest.main()
