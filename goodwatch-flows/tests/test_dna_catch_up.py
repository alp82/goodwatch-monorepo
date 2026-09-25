"""The DNA copy's catch-up finds analyses that never reached Crate or are older there (#171)."""
import sys
import unittest
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import dna_data
from f.sync.copy.dna_data import PUBLISHABLE_DNA, dna_missing_from_crate, to_timestamp


class FakeCursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction):
        return iter(sorted(self.docs, key=lambda doc: doc[key], reverse=direction < 0))


class FakeDna:
    """A Mongo collection that returns every document for the catch-up's query."""

    def __init__(self, docs):
        self.docs = docs
        self.queries = []

    def find(self, query, projection):
        self.queries.append(query)
        return FakeCursor(self.docs)


class FakeCrate:
    """Crate rows by tmdb id; answers the catch-up's `tmdb_id = ANY(?)` select."""

    def __init__(self, rows):
        self.rows = rows
        self.batches = []

    def select(self, sql, params):
        (ids,) = params
        self.batches.append(list(ids))
        return [{"tmdb_id": i, "dna_updated_at": self.rows[i]} for i in ids if i in self.rows]


def ms(moment: datetime) -> int:
    return int(to_timestamp(moment) * 1000)


class DnaMissingFromCrateTest(unittest.TestCase):
    def test_finds_missing_and_older_analyses_of_existing_rows(self):
        updated = datetime(2025, 9, 1, 12, 0, 0, 123000)
        docs = [{"tmdb_id": i, "updated_at": updated} for i in (1, 2, 3, 4, 5)]
        crate = FakeCrate({
            1: None,                                     # never copied
            2: ms(datetime(2025, 6, 1)),                 # an older analysis
            3: ms(updated),                              # up to date
            4: ms(updated) - 500,                        # rounding, still up to date
            # 5 has no Crate row yet
        })
        self.assertEqual(dna_missing_from_crate(crate, FakeDna(docs), "movie"), [1, 2])

    def test_reads_only_publishable_analyses(self):
        mongo = FakeDna([])
        dna_missing_from_crate(FakeCrate({}), mongo, "show")
        self.assertEqual(mongo.queries, [PUBLISHABLE_DNA])
        self.assertEqual(set(PUBLISHABLE_DNA), {"dna", "vector_fingerprint", "updated_at"})

    def test_checks_crate_in_batches(self):
        updated = datetime(2025, 9, 1)
        docs = [{"tmdb_id": i, "updated_at": updated} for i in range(1, 8)]
        crate = FakeCrate({i: None for i in range(1, 8)})
        original = dna_data.BATCH_SIZE
        dna_data.BATCH_SIZE = 3
        try:
            missing = dna_missing_from_crate(crate, FakeDna(docs), "movie")
        finally:
            dna_data.BATCH_SIZE = original
        self.assertEqual(missing, list(range(1, 8)))
        self.assertEqual(crate.batches, [[1, 2, 3], [4, 5, 6], [7]])


if __name__ == "__main__":
    unittest.main()
