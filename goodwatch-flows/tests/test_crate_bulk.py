import importlib.util
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock

from pydantic import BaseModel

PATH = Path(__file__).parents[1] / "windmill/f/db/cratedb.py"
SPEC = importlib.util.spec_from_file_location("crate_connector", PATH)
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)


class Record(BaseModel):
    id: int
    value: str


IO_ERROR = {"rowcount": -2, "error": {"code": 5000, "message": "IOException[null: NIOFSIndexInput(path=\"/data/_1.fdt\")]"}}


class BulkResultTest(unittest.TestCase):
    def setUp(self):
        self.sleeps = []
        self.executemany = Mock()

    def write(self, *results):
        self.executemany.side_effect = list(results)
        db = module.CrateConnector.__new__(module.CrateConnector)
        db.cur = SimpleNamespace(executemany=self.executemany)
        db.sleep = self.sleeps.append
        return db.upsert_many(
            "example", [Record(id=1, value="one"), Record(id=2, value="two")], ["id"], silent=True
        )

    def test_success_reports_confirmed_writes(self):
        self.assertEqual(self.write([{"rowcount": 1}, {"rowcount": 1}])["rows_upserted"], 2)

    def test_partial_failure_is_not_success(self):
        with self.assertRaisesRegex(RuntimeError, "Failed to upsert 1 of 2"):
            self.write([{"rowcount": 1}, {"rowcount": -2, "error_message": "invalid value"}])

    def test_incomplete_or_unconfirmed_results_fail(self):
        for result in [None, [], [{"rowcount": 1}], [{"rowcount": 1}, {"rowcount": 0}]]:
            with self.subTest(result=result), self.assertRaises(RuntimeError):
                self.write(result)

    def test_a_row_failing_with_a_transient_error_is_retried_alone(self):
        report = self.write([{"rowcount": 1}, IO_ERROR], [{"rowcount": 1}])
        self.assertEqual(report["rows_upserted"], 2)
        retried_rows = self.executemany.call_args_list[1].args[1]
        self.assertEqual([row[:2] for row in retried_rows], [[2, "two"]])
        self.assertEqual(self.sleeps, [1])

    def test_a_version_conflict_is_retried(self):
        conflict = {"rowcount": -2, "error_message": "VersionConflictEngineException[[1]: version conflict]"}
        self.assertEqual(self.write([conflict, {"rowcount": 1}], [{"rowcount": 1}])["rows_upserted"], 2)

    def test_transient_errors_fail_after_three_retries(self):
        with self.assertRaisesRegex(RuntimeError, "Failed to upsert 1 of 2 rows into example after 3 retries"):
            self.write([{"rowcount": 1}, IO_ERROR], [IO_ERROR], [IO_ERROR], [IO_ERROR])
        self.assertEqual(self.sleeps, [1, 4, 10])

    def test_other_row_errors_are_not_retried(self):
        with self.assertRaises(RuntimeError):
            self.write([{"rowcount": 1}, IO_ERROR], [{"rowcount": -2, "error_message": "invalid value"}])
        with self.assertRaises(RuntimeError):
            self.write([{"rowcount": -2, "error_message": "invalid value"}, IO_ERROR])
        self.assertEqual(self.executemany.call_count, 3)


if __name__ == "__main__":
    unittest.main()
