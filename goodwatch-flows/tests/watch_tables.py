"""A fake Crate connector for the watch log migration and the fill job: the tables they read and write, in memory."""
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[1] / "windmill"))

from f.sync.models.crate_schemas import SCHEMAS

WRITABLE = ("user_watch_log", "user_watch_state")
INSERT = re.compile(r"INSERT INTO (\w+) \(([\w\", ]+)\) VALUES \(\?(?:, \?)*\) ON CONFLICT \(([\w, ]+)\) DO NOTHING")
SELECT = re.compile(r"SELECT (.+?) FROM (\w+)(?: WHERE (.+?))?(?: GROUP BY (.+))?")
COUNT = "count(*) AS n"


def at(*parts) -> int:
    """A UTC time in the milliseconds Crate returns."""
    return int(datetime(*parts, tzinfo=timezone.utc).timestamp() * 1000)


class WatchTables:
    """Holds rows per table. Reads understand the conditions the jobs use; writes are checked against the schema."""

    def __init__(self, **tables):
        self.tables = {name: [dict(row) for row in rows] for name, rows in tables.items()}
        for name in ("user_watch_history", "user_score", "user_wishlist", "show", "episode", *WRITABLE):
            self.tables.setdefault(name, [])
        self.statements = []
        self.bulk_sizes = []
        self.cur = SimpleNamespace(executemany=self.executemany, rowcount=0)

    def rows(self, table, **equal):
        return [row for row in self.tables[table] if all(row.get(column) == value for column, value in equal.items())]

    def select(self, sql, params=None):
        self.statements.append(sql)
        match = SELECT.fullmatch(sql)
        assert match, sql
        columns, table, where, group_by = match.groups()
        params = list(params or ())
        rows = self.tables[table]
        for condition in (where.split(" AND ") if where else []):
            rows = [row for row in rows if self.holds(condition, row, params)] if "?" not in condition else \
                self.bound(condition, rows, params.pop(0))
        assert not params, (sql, params)
        columns = columns.split(", ")
        for column in columns:
            assert column == COUNT or column in SCHEMAS[table]["columns"], (table, column)
        if group_by:
            keys = group_by.split(", ")
            assert columns == [*keys, COUNT], sql
            groups = {}
            for row in rows:
                key = tuple(row.get(column) for column in keys)
                groups[key] = groups.get(key, 0) + 1
            return [dict(zip(keys, key)) | {"n": n} for key, n in groups.items()]
        return [{column: row.get(column) for column in columns} for row in rows]

    @staticmethod
    def holds(condition, row, params):
        if condition == "season_number > 0":
            return (row.get("season_number") or 0) > 0
        if condition == "removed_at IS NULL":
            return row.get("removed_at") is None
        literal = re.fullmatch(r"(\w+) = '(\w+)'", condition)
        assert literal, condition
        return row.get(literal[1]) == literal[2]

    @staticmethod
    def bound(condition, rows, value):
        equal, any_of = re.fullmatch(r"(\w+) = \?", condition), re.fullmatch(r"(\w+) = ANY\(\?\)", condition)
        assert equal or any_of, condition
        if equal:
            return [row for row in rows if row.get(equal[1]) == value]
        assert isinstance(value, list), condition
        return [row for row in rows if row.get(any_of[1]) in value]

    def executemany(self, sql, data):
        match = INSERT.fullmatch(sql)
        assert match, sql
        table, columns, conflict = match[1], match[2].replace('"', "").split(", "), match[3].split(", ")
        assert table in WRITABLE, f"the jobs must not write {table}"
        schema = SCHEMAS[table]
        assert conflict == schema["primary_key"], conflict
        assert set(columns) == set(schema["columns"]), set(columns) ^ set(schema["columns"])
        self.bulk_sizes.append(len(data))
        results = []
        for values in data:
            row = dict(zip(columns, values, strict=True))
            for column, definition in schema["columns"].items():
                assert row[column] is not None or ("NOT NULL" not in definition and column not in conflict), (column, row)
            key = {column: row[column] for column in conflict}
            exists = bool(self.rows(table, **key))
            if not exists:
                self.tables[table].append(row)
            results.append({"rowcount": 0 if exists else 1})
        return results

    def run(self, sql, params=None):
        self.statements.append(sql)
        if sql.startswith("REFRESH TABLE "):
            return
        assert sql == "DELETE FROM user_watch_log WHERE user_id = ? AND watch_id = ANY(?)", sql
        user_id, watch_ids = params
        kept = [row for row in self.tables["user_watch_log"]
                if not (row["user_id"] == user_id and row["watch_id"] in watch_ids)]
        self.cur.rowcount = len(self.tables["user_watch_log"]) - len(kept)
        self.tables["user_watch_log"] = kept


def old_row(user="ann", tmdb_id=603, media_type="movie", watched=at(2025, 3, 14, 21, 5), **fields):
    return {"user_id": user, "tmdb_id": tmdb_id, "media_type": media_type, "first_watched_at": watched,
            "last_watched_at": watched, "watch_count": 1, "created_at": watched, "updated_at": watched} | fields


def score(user="ann", tmdb_id=680, media_type="movie", updated=at(2024, 11, 2, 8, 15), **fields):
    return {"user_id": user, "tmdb_id": tmdb_id, "media_type": media_type, "score": 8, "created_at": updated,
            "updated_at": updated} | fields


def show(tmdb_id, copied=at(2026, 10, 7, 9)):
    """A show of the catalog. `copied=None` is a show whose episodes the crawl has not reached."""
    return {"tmdb_id": tmdb_id, "episodes_updated_at": copied}


def episode(show_id, episode_id, season, number, aired, **fields):
    return {"show_id": show_id, "tmdb_id": episode_id, "season_number": season, "episode_number": number,
            "air_date": aired, "removed_at": None} | fields


def press(user="ann", show_id=1399, changed=at(2025, 3, 14, 21, 5), group="0193f6a3-11aa", **fields):
    return {"user_id": user, "tmdb_id": show_id, "media_type": "show", "state": "seen", "state_changed_at": changed,
            "pass": 1, "seen_press_group": group, "seen_press_from": "not_started",
            "rate_prompt_dismissed_at": None, "seen_question": None, "created_at": changed, "updated_at": changed} | fields


def watch(user="ann", show_id=1399, episode_id=11, season=1, number=1, **fields):
    return {"user_id": user, "watch_id": f"w-{show_id}-{episode_id}", "media_type": "show", "tmdb_id": show_id,
            "episode_tmdb_id": episode_id, "season_number": season, "episode_number": number, "watched_at": None,
            "watched_at_precision": "unknown", "origin": "single", "group_id": None, "import_id": None, "pass": 1,
            "created_at": at(2025, 1, 1), "updated_at": at(2025, 1, 1)} | fields
