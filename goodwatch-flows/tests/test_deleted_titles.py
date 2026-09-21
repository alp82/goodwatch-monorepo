"""Delete-on-sync: titles flagged tmdb_deleted are removed from the serving stores."""
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from f.sync.copy import deleted_titles
from f.sync.copy.deleted_titles import (
    MAX_DELETED_TITLES_PER_RUN,
    TITLE_KEYED_TABLES,
    delete_titles_from_crate,
    delete_titles_from_qdrant,
    find_flagged_tmdb_ids,
    flagged_among,
)
from f.sync.models.crate_schemas import SCHEMAS


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
    def test_movie_deletes_every_title_keyed_table_scoped_by_media_type(self):
        connector = FakeConnector()
        result = delete_titles_from_crate(connector, "movie", [7, "3", 7])
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
        delete_titles_from_crate(connector, "show", [5])
        tables = [sql.split()[2] for sql, _ in connector.deletes()]
        self.assertEqual(tables[-2:], ["season", "show"])
        self.assertNotIn("movie", tables)
        for sql, params in connector.deletes():
            self.assertTrue(params[0] == "show" or sql.split()[2] in ("season", "show"))

    def test_user_tables_are_untouched_and_all_derived_tables_are_covered(self):
        connector = FakeConnector()
        delete_titles_from_crate(connector, "show", [5])
        self.assertFalse([sql for sql, _ in connector.calls if "user_" in sql])
        derived = {name for name, spec in SCHEMAS.items() if "media_tmdb_id" in spec["columns"]}
        self.assertEqual(derived, set(TITLE_KEYED_TABLES))

    def test_empty_list_issues_no_sql(self):
        connector = FakeConnector()
        result = delete_titles_from_crate(connector, "movie", [])
        self.assertEqual(connector.calls, [])
        self.assertEqual(result["titles_deleted"], 0)

    def test_cap_skips_deletion(self):
        connector = FakeConnector()
        result = delete_titles_from_crate(connector, "movie", range(MAX_DELETED_TITLES_PER_RUN + 1))
        self.assertEqual(connector.deletes(), [])
        self.assertTrue(result["skipped_over_cap"])
        self.assertEqual(result["titles_deleted"], 0)

    def test_only_titles_still_published_are_deleted_and_capped(self):
        connector = FakeConnector()
        connector.missing = set(range(2, MAX_DELETED_TITLES_PER_RUN + 1))
        result = delete_titles_from_crate(connector, "movie", range(MAX_DELETED_TITLES_PER_RUN + 1))
        self.assertFalse(result["skipped_over_cap"])
        self.assertTrue(all(params[-1] == [0, 1] for _, params in connector.deletes()))

    def test_nothing_published_issues_no_delete(self):
        connector = FakeConnector()
        connector.missing = {1, 2}
        delete_titles_from_crate(connector, "movie", [1, 2])
        self.assertEqual(connector.deletes(), [])

    def test_ids_are_batched(self):
        connector = FakeConnector()
        delete_titles_from_crate(connector, "movie", range(deleted_titles.DELETE_BATCH_SIZE + 1))
        movie_deletes = [params for sql, params in connector.deletes() if sql.startswith("DELETE FROM movie")]
        self.assertEqual([len(params[0]) for params in movie_deletes], [deleted_titles.DELETE_BATCH_SIZE, 1])

    def test_unknown_media_type_and_bad_ids_raise(self):
        with self.assertRaises(ValueError):
            delete_titles_from_crate(FakeConnector(), "tv", [1])
        with self.assertRaises(ValueError):
            delete_titles_from_crate(FakeConnector(), "movie", ["1 OR 1=1"])


class DeleteFromQdrantTests(unittest.TestCase):
    def test_deletes_by_media_scoped_point_id(self):
        client = MagicMock()
        client.retrieve.side_effect = lambda ids, **kwargs: [SimpleNamespace(id=point_id) for point_id in ids]
        result = delete_titles_from_qdrant(client, "media", "show", [2, 1], lambda media, tmdb_id: f"9{tmdb_id}")
        client.delete.assert_called_once_with(collection_name="media", points_selector=[91, 92], wait=True)
        self.assertEqual(result["points_requested"], 2)

    def test_points_already_gone_are_not_deleted_again(self):
        client = MagicMock()
        client.retrieve.return_value = []
        delete_titles_from_qdrant(client, "media", "show", [1, 2], lambda media, tmdb_id: tmdb_id)
        client.delete.assert_not_called()

    def test_empty_and_over_cap_issue_no_delete(self):
        client = MagicMock()
        client.retrieve.side_effect = lambda ids, **kwargs: [SimpleNamespace(id=point_id) for point_id in ids]
        delete_titles_from_qdrant(client, "media", "movie", [], int)
        result = delete_titles_from_qdrant(
            client, "media", "movie", range(MAX_DELETED_TITLES_PER_RUN + 1), lambda media, tmdb_id: tmdb_id)
        client.delete.assert_not_called()
        self.assertTrue(result["skipped_over_cap"])


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


if __name__ == "__main__":
    unittest.main()
