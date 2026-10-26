"""Local-only watcher checks; no HTTP, SSH or SQL."""
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("q43_watch", Path(__file__).with_name("q40-page-watch.py"))
watcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(watcher)


class PageWatchTests(unittest.TestCase):
    def test_expected_mcp_401_is_healthy(self):
        self.assertEqual(watcher.assess(401, .2, 0, 0, 401), (0, False))

    def test_unexpected_mcp_200_is_an_alarm(self):
        self.assertEqual(watcher.assess(200, .2, 0, 0, 401), (1, True))

    def test_first_page_failure_triggers(self):
        self.assertEqual(watcher.assess(503, .2, 0, 0), (1, True))

    def test_transport_failure_triggers(self):
        self.assertEqual(watcher.assess(0, 5, 28, 0), (1, True))

    def test_slow_healthy_page_triggers(self):
        self.assertEqual(watcher.assess(200, 3.001, 0, 0), (0, True))

    def test_three_seconds_is_not_over_threshold(self):
        self.assertEqual(watcher.assess(200, 3, 0, 0), (0, False))

    def test_recovery_resets_streak_but_does_not_erase_marker(self):
        self.assertEqual(watcher.assess(200, .2, 0, 4), (0, False))
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "alarm"
            watcher.marker(path, {"first": True})
            watcher.marker(path, {"first": False})
            self.assertEqual(json.loads(path.read_text()), {"first": True})

    def test_probe_accepts_401_and_uses_five_second_curl_budget(self):
        with patch.object(watcher.subprocess, "run", return_value=types.SimpleNamespace(stdout="401 0.25", returncode=0)) as call:
            result = watcher.probe("/mcp", 401)
        self.assertEqual(result[:5], ("/mcp", 401, 401, .25, 0))
        self.assertIn("5", call.call_args.args[0])
        self.assertNotIn("--fail", call.call_args.args[0])

    def test_invalid_probe_output_is_failure(self):
        with patch.object(watcher.subprocess, "run", return_value=types.SimpleNamespace(stdout="", returncode=7)):
            _, expected, status, seconds, code, _ = watcher.probe("/discover", 200)
        self.assertTrue(watcher.assess(status, seconds, code, 0, expected)[1])

    def test_five_expected_endpoints(self):
        self.assertEqual(len(watcher.ENDPOINTS), 5)
        self.assertEqual(dict(watcher.ENDPOINTS)["/mcp"], 401)
        self.assertEqual(dict(watcher.ENDPOINTS)["/.well-known/oauth-protected-resource/mcp"], 200)


if __name__ == "__main__":
    unittest.main()
