"""The daily copy writes only changed titles, in small throttled requests."""
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import mongomock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import tmdb_daily


class Crate:
    """Holds title rows by table and id, and records every request."""

    def __init__(self, rows=None):
        self.rows = {"movie": {}, "show": {}} | (rows or {})
        self.selects = []
        self.upserts = []

    def select(self, sql, params=None):
        table = sql.split(" FROM ")[1].split()[0]
        ids = params[0]
        self.selects.append((table, ids))
        return [{"tmdb_id": i, **self.rows[table][i]} for i in ids if i in self.rows[table]]

    def upsert_many(self, *, table, records, conflict_columns, silent=False):
        self.upserts.append((table, [record.model_dump() for record in records]))
        for record in records:
            row = record.model_dump()
            self.rows[table][row.pop("tmdb_id")] = row
        return {"records_received": len(records), "rows_upserted": len(records)}


def dump(*docs):
    db = mongomock.MongoClient().db
    # The TMDB daily dump stores ids as strings.
    db.tmdb_daily_dump_data.insert_many([
        {"tmdb_id": str(tmdb_id), "type": media_type, "original_title": title, "popularity": popularity, "adult": False}
        for media_type, tmdb_id, title, popularity in docs
    ])
    return db


class DailyCopyTests(unittest.TestCase):
    def copy(self, db, crate, **settings):
        self.sleeps = []
        with patch.object(tmdb_daily, "get_db", return_value=db), patch.object(tmdb_daily, "sleep", self.sleeps.append):
            return tmdb_daily.copy_media(crate, **settings)

    def test_writes_only_the_columns_of_the_export(self):
        crate = Crate()
        self.copy(dump(("movie", 1, "One", 1.5), ("tv", 2, "Two", 0.3)), crate)
        self.assertEqual(crate.upserts, [
            ("movie", [{"tmdb_id": 1, "original_title": "One", "popularity": 1.5, "adult": False}]),
            ("show", [{"tmdb_id": 2, "original_title": "Two", "popularity": 0.3, "adult": False}]),
        ])

    def test_skips_rows_that_did_not_change(self):
        crate = Crate({"movie": {
            1: {"original_title": "One", "popularity": 1.5, "adult": False},
            2: {"original_title": "Two", "popularity": 2.0, "adult": False},
            3: {"original_title": "Old title", "popularity": 3.0, "adult": False},
            4: {"original_title": "Four", "popularity": 4.0, "adult": True},
        }})
        db = dump(("movie", 1, "One", 1.5), ("movie", 2, "Two", 2.5), ("movie", 3, "Three", 3.0),
                  ("movie", 4, "Four", 4.0), ("movie", 5, "Five", 5.0))
        result = self.copy(db, crate)
        self.assertEqual([row["tmdb_id"] for _, rows in crate.upserts for row in rows], [2, 3, 4, 5])
        self.assertEqual(result["movie_counts"], {"records_received": 5, "rows_upserted": 4, "rows_unchanged": 1})

    def test_a_second_run_on_the_same_dump_writes_nothing(self):
        crate = Crate()
        db = dump(("movie", 1, "One", 1.5), ("tv", 1, "One", 0.0))
        self.copy(db, crate)
        crate.upserts.clear()
        result = self.copy(db, crate)
        self.assertEqual(crate.upserts, [])
        self.assertEqual(self.sleeps, [])
        self.assertEqual(result["show_counts"], {"records_received": 1, "rows_upserted": 0, "rows_unchanged": 1})

    def test_a_value_missing_in_the_export_is_not_a_change(self):
        crate = Crate({"movie": {1: {"original_title": "One", "popularity": 1.5, "adult": True}}})
        db = dump(("movie", 1, "One", 1.5))
        db.tmdb_daily_dump_data.update_one({}, {"$unset": {"adult": "", "popularity": ""}})
        self.copy(db, crate)
        self.assertEqual(crate.upserts, [])

    def test_requests_hold_at_most_batch_size_rows_and_each_write_is_followed_by_a_pause(self):
        crate = Crate()
        db = dump(*[("movie", i, f"Title {i}", 1.0) for i in range(1, 6)])
        self.copy(db, crate, batch_size=2, pause_seconds=0.25)
        self.assertEqual([len(ids) for _, ids in crate.selects], [2, 2, 1])
        self.assertEqual([len(rows) for _, rows in crate.upserts], [2, 2, 1])
        self.assertEqual(self.sleeps, [0.25, 0.25, 0.25])

    def test_skip_unchanged_off_writes_every_row_without_reading(self):
        crate = Crate({"movie": {1: {"original_title": "One", "popularity": 1.5, "adult": False}}})
        result = self.copy(dump(("movie", 1, "One", 1.5)), crate, skip_unchanged=False, pause_seconds=0)
        self.assertEqual(crate.selects, [])
        self.assertEqual(result["movie_counts"]["rows_upserted"], 1)
        self.assertEqual(self.sleeps, [])

    def test_a_title_without_an_original_title_is_not_written(self):
        crate = Crate()
        self.copy(dump(("movie", 1, "", 1.5)), crate)
        self.assertEqual(crate.upserts, [])


if __name__ == "__main__":
    unittest.main()
