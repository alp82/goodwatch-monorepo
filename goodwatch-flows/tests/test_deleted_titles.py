"""Delete-on-sync: titles flagged tmdb_deleted are removed from the serving stores."""
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import deleted_titles
from f.sync.copy.deleted_titles import (
    TITLE_KEYED_TABLES,
    delete_titles_from_crate,
    delete_titles_from_qdrant,
    find_flagged_tmdb_ids,
    flagged_among,
)
from f.sync.models.crate_schemas import SCHEMAS

SHOW_CHILDREN = {name for name, spec in SCHEMAS.items() if "show_id" in spec["columns"]}
CALM = {"tripped": False}


class FakeConnector:
    def __init__(self):
        self.calls = []
        self.cur = SimpleNamespace(rowcount=0)
        self.missing = set()

    def run(self, sql, params=None):
        self.calls.append((sql, params))
        self.cur.rowcount = len(params[-1]) if sql.startswith("DELETE") else -1

    def select(self, sql, params=None):
        self.calls.append((sql, params))
        return [{"tmdb_id": tmdb_id} for tmdb_id in params[-1] if tmdb_id not in self.missing]

    def deletes(self):
        return [(sql, params) for sql, params in self.calls if sql.startswith("DELETE")]


class DeleteFromCrateTests(unittest.TestCase):
    def test_closes_open_stays_before_deleting_offers(self):
        connector = FakeConnector()
        deleted_titles.delete_title_rows(connector, "show", {"streaming_availability": [42]})
        updates = [(i, sql, args) for i, (sql, args) in enumerate(connector.calls)
                   if sql.startswith("UPDATE availability_history")]
        self.assertEqual(len(updates), 1)
        index, sql, args = updates[0]
        delete_index = next(i for i, (sql, _) in enumerate(connector.calls)
                            if sql.startswith("DELETE FROM streaming_availability"))
        self.assertLess(index, delete_index)
        self.assertIn("dropped_on IS NULL", sql)
        self.assertIn("'unknown'", sql)
        self.assertEqual(args, ("show", [42]))

    def test_movie_deletes_every_title_keyed_table_scoped_by_media_type(self):
        connector = FakeConnector()
        result = delete_titles_from_crate(connector, "movie", [7, "3", 7], spike=CALM)
        deletes = connector.deletes()
        self.assertEqual(
            [sql.split()[2] for sql, _ in deletes], [*TITLE_KEYED_TABLES, "movie"]
        )
        for sql, params in deletes[:-1]:
            self.assertIn("media_type = ? AND media_tmdb_id = ANY(?)", sql)
            self.assertEqual(params, ("movie", [3, 7]))
        self.assertEqual(deletes[-1], ("DELETE FROM movie WHERE tmdb_id = ANY(?)", ([3, 7],)))
        self.assertEqual(result["titles_deleted"], 2)
        self.assertEqual(result["rows_deleted"]["trope"], 2)
        self.assertIn(("REFRESH TABLE movie", None), connector.calls)

    def test_show_also_deletes_seasons_and_never_touches_movie(self):
        connector = FakeConnector()
        delete_titles_from_crate(connector, "show", [5], spike=CALM)
        tables = [sql.split()[2] for sql, _ in connector.deletes()]
        self.assertEqual(tables[-1], "show")
        self.assertIn("season", tables)
        self.assertNotIn("movie", tables)
        for sql, params in connector.deletes():
            self.assertTrue(params[0] == "show" or sql.split()[2] in (*SHOW_CHILDREN, "show"))

    def test_user_tables_are_untouched_and_all_derived_tables_are_covered(self):
        connector = FakeConnector()
        delete_titles_from_crate(connector, "show", [5], spike=CALM)
        self.assertFalse([sql for sql, _ in connector.calls if "user_" in sql])
        derived = {name for name, spec in SCHEMAS.items() if "media_tmdb_id" in spec["columns"]}
        # History is retained and closed, never deleted with the title.
        self.assertEqual(derived - {"availability_history"}, set(TITLE_KEYED_TABLES))

    def test_empty_list_issues_no_sql(self):
        connector = FakeConnector()
        result = delete_titles_from_crate(connector, "movie", [], spike=CALM)
        self.assertEqual(connector.calls, [])
        self.assertEqual(result["titles_deleted"], 0)

    def test_only_titles_still_published_are_deleted(self):
        connector = FakeConnector()
        connector.missing = set(range(2, 50))
        result = delete_titles_from_crate(connector, "movie", range(50), spike=CALM)
        self.assertEqual(result["titles_planned"], 2)
        self.assertTrue(all(params[-1] == [0, 1] for _, params in connector.deletes()))

    def test_nothing_published_issues_no_delete(self):
        connector = FakeConnector()
        connector.missing = {1, 2}
        delete_titles_from_crate(connector, "movie", [1, 2], spike=CALM)
        self.assertEqual(connector.deletes(), [])

    def test_ids_are_batched(self):
        connector = FakeConnector()
        delete_titles_from_crate(connector, "movie", range(deleted_titles.DELETE_BATCH_SIZE + 1), spike=CALM)
        movie_deletes = [params for sql, params in connector.deletes() if sql.startswith("DELETE FROM movie")]
        self.assertEqual([len(params[0]) for params in movie_deletes], [deleted_titles.DELETE_BATCH_SIZE, 1])

    def test_unknown_media_type_and_bad_ids_raise(self):
        with self.assertRaises(ValueError):
            delete_titles_from_crate(FakeConnector(), "tv", [1], spike=CALM)
        with self.assertRaises(ValueError):
            delete_titles_from_crate(FakeConnector(), "movie", ["1 OR 1=1"], spike=CALM)


class DeleteFromQdrantTests(unittest.TestCase):
    def test_deletes_by_media_scoped_point_id(self):
        client = MagicMock()
        client.retrieve.side_effect = lambda ids, **kwargs: [SimpleNamespace(id=point_id) for point_id in ids]
        result = delete_titles_from_qdrant(client, "media", "show", [2, 1], lambda media, tmdb_id: f"9{tmdb_id}", spike=CALM)
        # Points go in the given order, which is oldest flag first.
        client.delete.assert_called_once_with(collection_name="media", points_selector=[92, 91], wait=True)
        self.assertEqual(result["points_requested"], 2)

    def test_points_already_gone_are_not_deleted_again(self):
        client = MagicMock()
        client.retrieve.return_value = []
        delete_titles_from_qdrant(client, "media", "show", [1, 2], lambda media, tmdb_id: tmdb_id, spike=CALM)
        client.delete.assert_not_called()

    def test_empty_list_issues_no_request(self):
        client = MagicMock()
        delete_titles_from_qdrant(client, "media", "movie", [], int, spike=CALM)
        client.retrieve.assert_not_called()
        client.delete.assert_not_called()


class FlaggedLookupTests(unittest.TestCase):
    def test_selector_is_combined_with_flag(self):
        collection = MagicMock()
        collection.find.return_value = [{"tmdb_id": 9}, {"tmdb_id": 4}]
        self.assertEqual(find_flagged_tmdb_ids(collection, {"updated_at": {"$gte": 1}}), [4, 9])
        collection.find.assert_called_once_with(
            {"updated_at": {"$gte": 1}, "tmdb_deleted": True}, {"tmdb_id": 1, "_id": 0})

    def test_flagged_among_skips_query_for_empty_batch(self):
        collection = MagicMock()
        self.assertEqual(flagged_among(collection, []), set())
        collection.find.assert_not_called()


class ShowChildDeletionTests(unittest.TestCase):
    def test_every_catalog_show_child_is_registered(self):
        registered = {table.name for table in deleted_titles.title_tables("show")}
        self.assertFalse(SHOW_CHILDREN - registered)
        self.assertTrue(SHOW_CHILDREN.isdisjoint(
            table.name for table in deleted_titles.title_tables("movie")))

    def test_show_children_deleted_by_show_id_even_without_parent_row(self):
        from test_orphaned_title_rows import FakeCrate

        for title_row in (True, False):
            with self.subTest(title_row=title_row):
                crate = FakeCrate()
                crate.add_title("show", 5, children=[], title_row=title_row)
                crate.add_title("show", 6, children=[])
                crate.add_title("movie", 5)
                for table in SHOW_CHILDREN:
                    # Multiple rows per deleted show; overlapping child ids across shows.
                    crate.tables[table] = [
                        {"show_id": show_id, "tmdb_id": child_id}
                        for show_id, child_id in ((5, 101), (5, 102), (6, 101))
                    ]
                result = delete_titles_from_crate(crate, "show", [5], spike=CALM)
                for table in SHOW_CHILDREN:
                    self.assertEqual(crate.tables[table], [{"show_id": 6, "tmdb_id": 101}])
                    self.assertEqual(result["rows_deleted"][table], 2)
                    self.assertIn((f"DELETE FROM {table} WHERE show_id = ANY(?)", ([5],)), crate.statements)
                self.assertEqual(crate.tables["show"], [{"tmdb_id": 6}])
                self.assertEqual(crate.tables["movie"], [{"tmdb_id": 5}])
                self.assertEqual(len(crate.tables["user_score"]), 3)
                deletes = [sql.split()[2] for sql, _ in crate.statements if sql.startswith("DELETE")]
                if title_row:
                    self.assertEqual(deletes[-1], "show")
                # Retrying a completed deletion is harmless.
                self.assertEqual(delete_titles_from_crate(crate, "show", [5], spike=CALM)["rows_deleted"], {})

    def test_show_children_obey_spike_guard_budget_and_batches(self):
        from test_orphaned_title_rows import FakeCrate
        from unittest.mock import patch

        crate = FakeCrate()
        ids = list(range(deleted_titles.DELETE_BATCH_SIZE + 1))
        for table in SHOW_CHILDREN:
            crate.tables[table] = [{"show_id": i, "tmdb_id": 101} for i in ids]
        result = delete_titles_from_crate(crate, "show", ids, spike={"tripped": True})
        self.assertTrue(result["refused_spike"])
        self.assertEqual(crate.statements, [])
        with patch.object(deleted_titles, "MAX_DELETED_TITLES_PER_RUN", 1):
            result = delete_titles_from_crate(crate, "show", ids, spike=CALM)
        self.assertTrue(result["budget_reached"])
        self.assertEqual(result["titles_planned"], 1)
        for table in SHOW_CHILDREN:
            self.assertEqual(len(crate.tables[table]), len(ids) - 1)
            self.assertEqual(result["rows_deleted"][table], 1)
        # Restore the first title so every table needs two DELETE batches.
        for table in SHOW_CHILDREN:
            crate.tables[table].append({"show_id": 0, "tmdb_id": 101})
        crate.statements.clear()
        delete_titles_from_crate(crate, "show", ids, spike=CALM)
        for table in SHOW_CHILDREN:
            batches = [params[-1] for sql, params in crate.statements
                       if sql == f"DELETE FROM {table} WHERE show_id = ANY(?)"]
            self.assertEqual([len(batch) for batch in batches], [500, 1])
            self.assertEqual(crate.tables[table], [])

    def test_child_only_orphan_sweep_dry_run_then_delete(self):
        from test_orphaned_title_rows import FakeCrate, mongo

        crate = FakeCrate()
        for table in SHOW_CHILDREN:
            crate.tables[table] = [{"show_id": 5, "tmdb_id": 101}]
        details, daily = mongo()
        result = deleted_titles.sweep_orphaned_titles(crate, "show", details, daily, dry_run=True)
        self.assertEqual(result["plan"], {table: [5] for table in SHOW_CHILDREN})
        self.assertFalse(any(sql.startswith("DELETE") for sql, _ in crate.statements))
        result = deleted_titles.sweep_orphaned_titles(crate, "show", details, daily)
        self.assertEqual(result["rows_deleted"], {table: 1 for table in SHOW_CHILDREN})


if __name__ == "__main__":
    unittest.main()
