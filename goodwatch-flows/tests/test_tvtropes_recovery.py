"""Recovery runner safety checks; no network or database access."""

import argparse
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "recover_tvtropes", Path(__file__).parents[1] / "scripts/recover_tvtropes.py"
)
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class RecoveryTests(unittest.IsolatedAsyncioTestCase):
    def test_forbidden_is_not_reported_as_rate_limiting(self):
        self.assertEqual(recovery.blocked_status([{"status": 403}]), "source_access_blocked")
        self.assertEqual(recovery.blocked_status([{"status": 429}]), "rate_limited")

    async def test_changed_manifest_is_rejected_before_network_or_result_mutation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = root / "cohort.json"
            manifest.write_text(json.dumps([
                {"media_type": "movie", "tmdb_id": 1, "votes": 200000}
            ]))
            output = root / "run"
            output.mkdir()
            (output / "manifest.sha256").write_text("original manifest hash\n")
            (output / "results.jsonl").write_text("preserved results\n")
            with patch.object(recovery, "async_playwright") as browser:
                with self.assertRaisesRegex(ValueError, "different manifest"):
                    await recovery.run(argparse.Namespace(
                        manifest=manifest, output=output, delay=4, max_requests=1
                    ))
                browser.assert_not_called()
            self.assertEqual((output / "results.jsonl").read_text(), "preserved results\n")
            self.assertEqual((output / "manifest.sha256").read_text(), "original manifest hash\n")


if __name__ == "__main__":
    unittest.main()
