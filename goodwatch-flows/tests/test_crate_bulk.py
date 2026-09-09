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


class BulkResultTest(unittest.TestCase):
    def write(self, results):
        db = module.CrateConnector.__new__(module.CrateConnector)
        db.cur = SimpleNamespace(executemany=Mock(return_value=results))
        return db.upsert_many(
            "example", [Record(id=1, value="one"), Record(id=2, value="two")], ["id"]
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


if __name__ == "__main__":
    unittest.main()
