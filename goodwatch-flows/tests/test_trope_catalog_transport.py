"""Catalog transport fails closed on partial bulk writes and ambiguous transport failures."""
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import URLError

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/import_trope_catalog.py"
spec = importlib.util.spec_from_file_location("trope_catalog_cli_test", SCRIPT)
cli = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cli)


def response(document):
    return io.BytesIO(json.dumps(document).encode())


class CatalogTransportTests(unittest.TestCase):
    def client(self):
        return cli.Crate({"CRATE_HOSTS": "http://127.0.0.1:4200,http://127.0.0.1:4201", "CRATE_USER": "crate", "CRATE_PASS": ""})

    def test_bulk_writes_send_every_row_and_check_every_result(self):
        with patch.object(cli, "urlopen", return_value=response({"results": [{"rowcount": 1}, {"rowcount": 1}]})) as opened:
            self.client().run_many("INSERT INTO example (x) VALUES (?)", [(1,), (2,)])
            payload = json.loads(opened.call_args.args[0].data)
            self.assertEqual(payload["bulk_args"], [[1], [2]])
            self.assertNotIn("args", payload)

    def test_partial_bulk_failures_are_not_reported_as_success(self):
        for results in ([{"rowcount": 1}, {"rowcount": -2, "error": {"code": 4000}}], [{"rowcount": 1}]):
            with self.subTest(results=results), patch.object(cli, "urlopen", return_value=response({"results": results})):
                with self.assertRaisesRegex(RuntimeError, "bulk import failed"):
                    self.client().run_many("INSERT INTO example (x) VALUES (?)", [(1,), (2,)])

    def test_ambiguous_writes_never_retry_against_another_coordinator(self):
        with patch.object(cli, "urlopen", side_effect=URLError("connection closed")) as opened:
            with self.assertRaisesRegex(RuntimeError, "write transport failed"):
                self.client().run("INSERT INTO example (x) VALUES (?)", [1])
            self.assertEqual(opened.call_count, 1)

    def test_reads_can_move_to_another_coordinator(self):
        with patch.object(cli, "urlopen", side_effect=[URLError("connection closed"), response({"cols": ["n"], "rows": [[1]]})]) as opened:
            self.assertEqual(self.client().select("SELECT 1 AS n"), [{"n": 1}])
            self.assertEqual(opened.call_count, 2)


if __name__ == "__main__":
    unittest.main()
