"""Rows of titles that are gone are removed even when the title row is already gone (#165)."""
import re
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.copy import deleted_titles
from f.sync.copy.deleted_titles import (
    TITLE_KEYED_TABLES,
    delete_title_rows,
    delete_titles_from_crate,
    plan_flagged_title_rows,
    plan_orphaned_title_rows,
    sweep_orphaned_titles,
)


class FakeCrate:
    """Crate tables as row lists; understands the scoped SELECT DISTINCT / DELETE the module issues."""

    def __init__(self):
        self.tables = {table: [] for table in (*TITLE_KEYED_TABLES, "season", "movie", "show", "user_score")}
        self.cur = SimpleNamespace(rowcount=0)
        self.statements = []

    def add_title(self, media_type, tmdb_id, children=TITLE_KEYED_TABLES, title_row=True):
        if title_row:
            self.tables[media_type].append({"tmdb_id": tmdb_id})
        for table in children:
            self.tables[table].append({"media_tmdb_id": tmdb_id, "media_type": media_type})
        if media_type == "show":
            self.tables["season"].append({"tmdb_id": tmdb_id * 100, "show_id": tmdb_id})
        self.tables["user_score"].append({"tmdb_id": tmdb_id, "media_type": media_type})

    def has_rows(self, media_type, tmdb_id):
        tables = [table for table, rows in self.tables.items() if any(self._owned(table, row, media_type, tmdb_id) for row in rows)]
        return sorted(tables)

    @staticmethod
    def _owned(table, row, media_type, tmdb_id):
        if table in ("movie", "show"):
            return table == media_type and row["tmdb_id"] == tmdb_id
        if table == "season":
            return media_type == "show" and row["show_id"] == tmdb_id
        return row.get("media_type") == media_type and row.get("media_tmdb_id", row.get("tmdb_id")) == tmdb_id

    def _matching(self, table, where, params):
        rows = self.tables[table]
        params = list(params or ())
        if not where:
            return rows
        for condition in where.split(" AND "):
            column, op = re.fullmatch(r"(\w+) = (\?|ANY\(\?\))", condition).groups()
            value = params.pop(0)
            if op == "?":
                rows = [row for row in rows if row.get(column) == value]
            else:
                rows = [row for row in rows if row.get(column) in value]
        return rows

    def _parse(self, sql):
        match = re.fullmatch(r"(?:SELECT DISTINCT (\w+) AS tmdb_id|DELETE) FROM (\w+)(?: WHERE (.*?))?(?: LIMIT \d+)?", sql)
        assert match, sql
        return match.groups()

    def select(self, sql, params=None):
        self.statements.append((sql, params))
        column, table, where = self._parse(sql)
        return [{"tmdb_id": tmdb_id} for tmdb_id in sorted({row[column] for row in self._matching(table, where, params)})]

    def run(self, sql, params=None):
        self.statements.append((sql, params))
        if sql.startswith("REFRESH"):
            return
        _, table, where = self._parse(sql)
        doomed = self._matching(table, where, params)
        self.tables[table] = [row for row in self.tables[table] if row not in doomed]
        self.cur.rowcount = len(doomed)


class FakeCollection:
    def __init__(self, docs):
        self.docs = docs
        self.queries = []

    def find(self, selector, projection=None):
        self.queries.append(selector)
        docs = self.docs
        for field, condition in selector.items():
            if isinstance(condition, dict) and "$in" in condition:
                docs = [doc for doc in docs if doc.get(field) in condition["$in"]]
            elif isinstance(condition, dict) and "$ne" in condition:
                docs = [doc for doc in docs if doc.get(field) != condition["$ne"]]
            else:
                docs = [doc for doc in docs if doc.get(field) == condition]
        return [{"tmdb_id": doc["tmdb_id"]} for doc in docs]


ALL_CHILDREN = [*TITLE_KEYED_TABLES]


class FlaggedTitlesWithoutTitleRowTests(unittest.TestCase):
    def test_flagged_title_without_title_row_loses_its_child_rows(self):
        crate = FakeCrate()
        crate.add_title("show", 5, title_row=False)
        result = delete_titles_from_crate(crate, "show", [5])
        self.assertEqual(crate.has_rows("show", 5), ["user_score"])
        self.assertEqual(result["rows_deleted"]["season"], 1)
        self.assertEqual(result["rows_deleted"]["trope"], 1)
        self.assertEqual(result["titles_deleted"], 0)
        self.assertEqual(result["titles_with_rows"], 1)

    def test_other_media_type_with_the_same_tmdb_id_keeps_its_rows(self):
        crate = FakeCrate()
        crate.add_title("show", 5, title_row=False)
        crate.add_title("movie", 5)
        delete_titles_from_crate(crate, "show", [5])
        self.assertEqual(crate.has_rows("movie", 5), sorted([*TITLE_KEYED_TABLES, "movie", "user_score"]))

    def test_deletes_only_touch_tables_that_hold_rows_of_the_title(self):
        crate = FakeCrate()
        crate.add_title("movie", 7, children=["trope"], title_row=False)
        result = delete_titles_from_crate(crate, "movie", [7])
        deletes = [sql for sql, _ in crate.statements if sql.startswith("DELETE")]
        self.assertEqual(deletes, ["DELETE FROM trope WHERE media_type = ? AND media_tmdb_id = ANY(?)"])
        self.assertEqual(result["rows_deleted"], {"trope": 1})

    def test_flagged_titles_without_any_rows_issue_no_delete(self):
        crate = FakeCrate()
        crate.add_title("movie", 1)
        delete_titles_from_crate(crate, "movie", [2, 3])
        self.assertFalse([sql for sql, _ in crate.statements if sql.startswith("DELETE")])
        self.assertIn("movie", crate.has_rows("movie", 1))

    def test_cap_counts_titles_that_still_have_rows(self):
        crate = FakeCrate()
        cap = deleted_titles.MAX_DELETED_TITLES_PER_RUN
        for tmdb_id in range(cap + 1):
            crate.add_title("movie", tmdb_id, children=["trope"], title_row=False)
        result = delete_titles_from_crate(crate, "movie", range(cap + 1))
        self.assertTrue(result["skipped_over_cap"])
        self.assertEqual(len(crate.tables["trope"]), cap + 1)
        # Flagged titles that are already fully gone do not count toward the cap.
        result = delete_titles_from_crate(crate, "movie", range(cap + 50))
        self.assertTrue(result["skipped_over_cap"])
        crate.tables["trope"] = crate.tables["trope"][:cap]
        result = delete_titles_from_crate(crate, "movie", range(cap + 50))
        self.assertFalse(result["skipped_over_cap"])
        self.assertEqual(crate.tables["trope"], [])


def mongo(details_ids=(), flagged_ids=(), dump=()):
    details = FakeCollection([{"tmdb_id": i} for i in details_ids] + [{"tmdb_id": i, "tmdb_deleted": True} for i in flagged_ids])
    # The TMDB daily dump stores ids as strings.
    daily = FakeCollection([{"tmdb_id": str(i), "type": t} for t, i in dump])
    return details, daily


class OrphanSweepTests(unittest.TestCase):
    def test_title_missing_from_mongo_loses_all_its_rows(self):
        crate = FakeCrate()
        crate.add_title("show", 5)
        crate.add_title("show", 6, title_row=False)
        crate.add_title("show", 1)
        details, daily = mongo(details_ids=[1])
        result = sweep_orphaned_titles(crate, "show", details, daily)
        self.assertEqual(crate.has_rows("show", 5), ["user_score"])
        self.assertEqual(crate.has_rows("show", 6), ["user_score"])
        self.assertIn("show", crate.has_rows("show", 1))
        self.assertEqual(len(crate.has_rows("show", 1)), len(ALL_CHILDREN) + 3)
        self.assertEqual(result["titles_with_rows"], 2)
        self.assertEqual(result["rows_deleted"]["show"], 1)
        self.assertEqual(result["rows_deleted"]["season"], 2)

    def test_same_tmdb_id_live_under_the_other_media_type_is_untouched(self):
        crate = FakeCrate()
        crate.add_title("movie", 5)
        crate.add_title("show", 5)
        # Only the movie exists in Mongo.
        movie_details, daily = mongo(details_ids=[5])
        sweep_orphaned_titles(crate, "movie", movie_details, daily)
        self.assertEqual(len(crate.has_rows("movie", 5)), len(ALL_CHILDREN) + 2)
        show_details, _ = mongo()
        sweep_orphaned_titles(crate, "show", show_details, daily)
        self.assertEqual(crate.has_rows("show", 5), ["user_score"])
        self.assertEqual(len(crate.has_rows("movie", 5)), len(ALL_CHILDREN) + 2)

    def test_title_not_fetched_yet_but_listed_by_tmdb_is_kept(self):
        # tmdb_daily publishes stub title rows before the details are fetched.
        crate = FakeCrate()
        crate.add_title("movie", 8, children=["streaming_availability"])
        crate.add_title("show", 9, children=[])
        details, daily = mongo(dump=[("movie", 8), ("tv", 9)])
        self.assertEqual(sweep_orphaned_titles(crate, "movie", details, daily)["rows_deleted"], {})
        self.assertEqual(sweep_orphaned_titles(crate, "show", details, daily)["rows_deleted"], {})
        self.assertEqual(crate.has_rows("movie", 8), ["movie", "streaming_availability", "user_score"])
        self.assertIn("show", crate.has_rows("show", 9))

    def test_dump_entry_of_the_other_media_type_does_not_protect(self):
        crate = FakeCrate()
        crate.add_title("show", 9)
        details, daily = mongo(dump=[("movie", 9)])
        sweep_orphaned_titles(crate, "show", details, daily)
        self.assertEqual(crate.has_rows("show", 9), ["user_score"])

    def test_live_title_without_a_title_row_keeps_its_rows(self):
        # The details copy owns rows of titles that exist in Mongo; the sweep never deletes them.
        crate = FakeCrate()
        crate.add_title("movie", 3, title_row=False)
        details, daily = mongo(details_ids=[3])
        result = sweep_orphaned_titles(crate, "movie", details, daily)
        self.assertEqual(result["rows_deleted"], {})
        self.assertEqual(len(crate.has_rows("movie", 3)), len(ALL_CHILDREN) + 1)

    def test_flagged_titles_are_left_to_the_flagged_path(self):
        crate = FakeCrate()
        crate.add_title("movie", 4)
        details, daily = mongo(flagged_ids=[4])
        self.assertEqual(plan_orphaned_title_rows(crate, "movie", details, daily), {})

    def test_sweep_is_capped(self):
        crate = FakeCrate()
        cap = deleted_titles.MAX_DELETED_TITLES_PER_RUN
        for tmdb_id in range(cap + 1):
            crate.add_title("movie", tmdb_id, children=["trope"])
        details, daily = mongo()
        result = sweep_orphaned_titles(crate, "movie", details, daily)
        self.assertTrue(result["skipped_over_cap"])
        self.assertEqual(len(crate.tables["movie"]), cap + 1)

    def test_dry_run_plans_without_deleting(self):
        crate = FakeCrate()
        crate.add_title("show", 5)
        details, daily = mongo()
        result = sweep_orphaned_titles(crate, "show", details, daily, dry_run=True)
        self.assertEqual(result["plan"]["season"], [5])
        self.assertFalse([sql for sql, _ in crate.statements if sql.startswith("DELETE")])


class DeleteTitleRowsTests(unittest.TestCase):
    def test_children_before_the_title_row_and_batched(self):
        crate = FakeCrate()
        ids = list(range(deleted_titles.DELETE_BATCH_SIZE + 1))
        for tmdb_id in ids:
            crate.add_title("show", tmdb_id, children=["trope"])
        plan = plan_flagged_title_rows(crate, "show", ids)
        self.assertEqual(list(plan), ["trope", "season", "show"])
        delete_title_rows(crate, "show", plan)
        deletes = [(sql.split()[2], len(params[-1])) for sql, params in crate.statements if sql.startswith("DELETE")]
        self.assertEqual(deletes, [("trope", 500), ("trope", 1), ("season", 500), ("season", 1), ("show", 500), ("show", 1)])
        self.assertIn(("REFRESH TABLE show", None), crate.statements)
        self.assertEqual(crate.tables["user_score"][0]["tmdb_id"], 0)

    def test_unknown_table_in_plan_is_rejected(self):
        with self.assertRaises(ValueError):
            delete_title_rows(FakeCrate(), "movie", {"user_score": [1]})
        with self.assertRaises(ValueError):
            delete_title_rows(FakeCrate(), "movie", {"season": [1]})


if __name__ == "__main__":
    unittest.main()
